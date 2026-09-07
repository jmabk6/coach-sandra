/* ============================================================================
   Coach by JM — Module Sport v2 · la séance en briques, modifiable
   À charger APRÈS sport_v2_core.js et sport_v2_ui.js.
   Point d'entrée : SportSeance.monter(el, { auFermer }) puis .ouvrir(seanceId)

   Tout est corrigeable : une charge, une répétition, un RPE, un palier de
   tapis, le nom de la séance, sa durée. Une erreur de saisie ne doit jamais
   obliger à supprimer et recommencer.
   ========================================================================= */

const SportSeance = (function () {

const S = SportV2;
const B = () => window.SportBriques;
let hote = null, auFermer = null, sid = null, ouvert = null, edite = null;

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

const JOURS = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
const MOIS  = ['janvier','février','mars','avril','mai','juin','juillet','août',
               'septembre','octobre','novembre','décembre'];
function libelleDate(iso) {
  const d = new Date(iso + 'T12:00');
  return JOURS[d.getDay()] + ' ' + d.getDate() + ' ' + MOIS[d.getMonth()];
}

const seance = () => S.seanceById(sid);
const sauver = () => { try { localStorage.setItem('mc_hist_v2', JSON.stringify(S.hist())); }
                       catch (e) {} };

/* --- Molettes -------------------------------------------------------------- */

const CHAMPS = {
  charge:  { lib: 'kilos',       pas: 2.5, min: 0,  defaut: 0   },
  reps:    { lib: 'répétitions', pas: 1,   min: 0,  defaut: 10  },
  secondes:{ lib: 'secondes',    pas: 5,   min: 0,  defaut: 30  },
  rpe:     { lib: 'RPE sur 10',  pas: 1,   min: 0,  max: 10, defaut: 7 },
  duree:   { lib: 'minutes',     pas: 1,   min: 0,  defaut: 5   },
  vitesse: { lib: 'km/h',        pas: 0.5, min: 0,  defaut: 5   },
  pente:   { lib: '% de pente',  pas: 1,   min: 0,  defaut: 0   },
  fc:      { lib: 'bpm',         pas: 5,   min: 0,  defaut: 110 }
};

function molette(champ, valeur, action) {
  const c = CHAMPS[champ];
  return `<div class="sq-step">
    <button onclick="${action}(${-c.pas})">−</button>
    <div class="v">${valeur == null ? '—' : valeur}<span class="u">${c.lib}</span></div>
    <button onclick="${action}(${c.pas})">+</button>
  </div>`;
}

/* --- Brique : exercice ----------------------------------------------------- */

function vueExercice(b, i) {
  const enSecondes = b.unite === 'secondes';
  const conseil = S.conseilPour ? S.conseilPour(b) : null;

  const lignes = (b.series || []).map((x, k) => {
    const actif = edite && edite.b === i && edite.s === k;
    const val = [x.charge != null && !enSecondes ? x.charge + ' kg' : null,
                 x.reps != null ? x.reps + (enSecondes ? ' s' : ' reps') : null,
                 x.rpe != null ? 'RPE ' + x.rpe : null].filter(Boolean).join(' · ');
    return `<div class="sq-line">
      <button class="sq-check${x.fait ? ' on' : ''}" onclick="SportSeance.basculerSerie(${i},${k})">${x.fait ? '✓' : ''}</button>
      <span class="sq-n">Série ${k + 1}</span>
      <button class="sq-val${actif ? ' on' : ''}" onclick="SportSeance.editer(${i},${k})">${val || 'à saisir'}</button>
    </div>${actif ? `<div class="sq-edit">
      ${enSecondes ? molette('secondes', x.reps ?? 30, `SportSeance.pas(${i},${k},'reps',`)
                   : molette('charge', x.charge ?? 0, `SportSeance.pas(${i},${k},'charge',`)}
      ${enSecondes ? '' : molette('reps', x.reps ?? b.repsMin ?? 10, `SportSeance.pas(${i},${k},'reps',`)}
      ${molette('rpe', x.rpe ?? 7, `SportSeance.pas(${i},${k},'rpe',`)}
      <div class="sq-actions">
        <button class="sq-sec" onclick="SportSeance.retirerSerie(${i},${k})">Retirer la série</button>
        <button class="sq-sec" onclick="SportSeance.editer(null)">Terminé</button>
      </div></div>` : ''}`;
  }).join('');

  const fourchette = b.repsMin != null
    ? `${b.repsMin}${b.repsMax !== b.repsMin ? ' à ' + b.repsMax : ''} ${enSecondes ? 's' : 'reps'}`
    : null;

  return `<div class="lbl sq-h">
      <span>${esc(b.nom)}</span>
      <button class="sq-x" onclick="SportSeance.retirerBrique(${i})">retirer</button></div>
    <div class="card">
      ${conseil && conseil.texte ? `<div class="sq-conseil">${esc(conseil.texte)}</div>` : ''}
      ${fourchette ? `<div class="sv-meta" style="margin-bottom:6px">Fourchette : ${fourchette}</div>` : ''}
      ${b.echauffement ? `<div class="sq-ech">Échauffement ${b.echauffement.charge} kg × ${b.echauffement.reps} — hors tonnage</div>` : ''}
      ${lignes || '<div class="sv-meta">Aucune série.</div>'}
      <button class="sq-add-l" onclick="SportSeance.ajouterSerie(${i})">+ Ajouter une série</button>
    </div>`;
}

/* --- Brique : bloc cardio -------------------------------------------------- */

function vueCardio(b, i) {
  const lignes = (b.blocs || []).map((x, k) => {
    const actif = edite && edite.b === i && edite.s === k;
    const mn = Math.round((x.dureeReelle ?? x.duree ?? 0) / 60);
    const r = x.reglage || {};
    const val = [mn + ' mn', r.vitesse ? r.vitesse + ' km/h' : null,
                 r.pente ? r.pente + ' %' : null,
                 x.fcRelevee ? x.fcRelevee + ' bpm' : null].filter(Boolean).join(' · ');
    return `<div class="sq-line">
      <button class="sq-check${x.fait ? ' on' : ''}" onclick="SportSeance.basculerBloc(${i},${k})">${x.fait ? '✓' : ''}</button>
      <span class="sq-n">${esc(x.nom || 'Bloc ' + (k + 1))}</span>
      <button class="sq-val${actif ? ' on' : ''}" onclick="SportSeance.editer(${i},${k})">${val}</button>
    </div>${actif ? `<div class="sq-edit">
      ${molette('duree', mn, `SportSeance.pasBloc(${i},${k},'duree',`)}
      ${molette('vitesse', r.vitesse ?? 5, `SportSeance.pasBloc(${i},${k},'vitesse',`)}
      ${molette('pente', r.pente ?? 0, `SportSeance.pasBloc(${i},${k},'pente',`)}
      ${molette('fc', x.fcRelevee ?? 110, `SportSeance.pasBloc(${i},${k},'fc',`)}
      <div class="sq-actions">
        <button class="sq-sec" onclick="SportSeance.retirerBloc(${i},${k})">Retirer le palier</button>
        <button class="sq-sec" onclick="SportSeance.editer(null)">Terminé</button>
      </div></div>` : ''}`;
  }).join('');

  const total = Math.round((b.blocs || []).reduce((a, x) => a + (x.dureeReelle ?? x.duree ?? 0), 0) / 60);
  return `<div class="lbl sq-h">
      <span>${esc(b.nom)} · ${total} mn</span>
      <button class="sq-x" onclick="SportSeance.retirerBrique(${i})">retirer</button></div>
    <div class="card">${lignes || '<div class="sv-meta">Aucun palier.</div>'}
      <button class="sq-add-l" onclick="SportSeance.ajouterBloc(${i})">+ Ajouter un palier</button>
    </div>`;
}

/* --- Brique : liste -------------------------------------------------------- */

function vueListe(b, i) {
  const lignes = (b.items || []).map((it, k) =>
    `<div class="sq-line">
      <button class="sq-check${it.fait ? ' on' : ''}" onclick="SportSeance.basculerItem(${i},${k})">${it.fait ? '✓' : ''}</button>
      <span class="sq-txt">${esc(it.texte)}</span>
    </div>`).join('');
  const n = (b.items || []).filter(x => x.fait).length;
  return `<div class="lbl sq-h">
      <span>${esc(b.nom)} · ${n} sur ${(b.items || []).length}</span>
      <button class="sq-x" onclick="SportSeance.retirerBrique(${i})">retirer</button></div>
    <div class="card">${lignes}
      <button class="sq-add-l" onclick="SportSeance.toutCocher(${i})">Tout cocher</button></div>`;
}

/* --- L'écran --------------------------------------------------------------- */

function rendre() {
  if (!hote) return;
  const s = seance();
  if (!s) { hote.innerHTML = `<div class="sv sq"><div class="sv-meta">Séance introuvable.</div></div>`; return; }

  const c = S.comptes(s) || {};
  const corps = (s.briques || []).map((b, i) =>
    b.nature === 'exercice' ? vueExercice(b, i)
    : b.nature === 'cardio' ? vueCardio(b, i)
    : vueListe(b, i)).join('');

  const DUREES = [20, 30, 45, 60, 75, 90];
  hote.innerHTML = `<div class="sv sq">
    <div class="sq-h2">
      <button class="sq-back" onclick="SportSeance.retour()">‹ Retour</button>
      <div class="sq-t2">${esc(s.nomAffiche)}</div>
      <button class="sq-cta" onclick="SportSeance.valider()">${s.statut === 'terminee' ? 'Fermer' : 'Terminer'}</button>
    </div>
    <div class="sv-meta" style="margin:-4px 0 10px">${libelleDate(s.date)}${
      s.dureeReelle ? ' · ' + s.dureeReelle + ' mn' : ''} · ${c.faites || 0} sur ${c.total || 0}${
      c.tonnage ? ' · ' + c.tonnage.toLocaleString('fr') + ' kg' : ''}${
      c.rpeMoyen != null ? ' · RPE ' + c.rpeMoyen : ''}</div>

    <button class="sq-renom" onclick="SportSeance.renommer()">✏️ Renommer la séance</button>
    ${corps}

    <div class="lbl">Durée totale</div>
    <div class="sq-chips">${DUREES.map(d =>
      `<button class="sq-chip${s.dureeReelle === d ? ' on' : ''}" onclick="SportSeance.duree(${d})">${
        d >= 60 ? (d / 60 === 1 ? '1 h' : d === 75 ? '1 h 15' : '1 h 30') : d + ' mn'}</button>`).join('')}</div>

    <div class="lbl">Ajouter</div>
    <div class="sq-chips">
      <button class="sq-chip" onclick="SportSeance.ajouterExercice()">🏋️ Un exercice</button>
      <button class="sq-chip" onclick="SportSeance.ajouterCardio()">🚴 Un bloc cardio</button>
      <button class="sq-chip" onclick="SportSeance.ajouterListe()">🧘 Assouplissements</button>
    </div>

    <button class="sq-suppr" onclick="SportSeance.supprimer()">Supprimer cette séance</button>
  </div>`;
}

/* --- Actions --------------------------------------------------------------- */

const editer = (i, k) => {
  edite = (i == null || (edite && edite.b === i && edite.s === k)) ? null : { b: i, s: k };
  rendre();
};

function pas(i, k, champ, delta) {
  const b = seance().briques[i], x = b.series[k];
  const c = CHAMPS[b.unite === 'secondes' && champ === 'reps' ? 'secondes' : champ];
  const base = x[champ] ?? c.defaut;
  let v = Math.round((base + delta) * 100) / 100;
  if (c.min != null) v = Math.max(c.min, v);
  if (c.max != null) v = Math.min(c.max, v);
  x[champ] = v; x.fait = true;
  sauver(); rendre();
}

function pasBloc(i, k, champ, delta) {
  const x = seance().briques[i].blocs[k];
  x.reglage = x.reglage || {};
  if (champ === 'duree') {
    const mn = Math.max(0, Math.round((x.dureeReelle ?? x.duree ?? 0) / 60) + delta);
    x.dureeReelle = mn * 60; x.duree = mn * 60;
  } else if (champ === 'fc') {
    x.fcRelevee = Math.max(0, (x.fcRelevee ?? CHAMPS.fc.defaut) + delta);
  } else {
    const base = x.reglage[champ] ?? CHAMPS[champ].defaut;
    x.reglage[champ] = Math.max(0, Math.round((base + delta) * 10) / 10);
  }
  x.fait = true;
  sauver(); rendre();
}

function basculerSerie(i, k) { const x = seance().briques[i].series[k]; x.fait = !x.fait; sauver(); rendre(); }
function basculerBloc(i, k)  { const x = seance().briques[i].blocs[k];  x.fait = !x.fait; sauver(); rendre(); }
function basculerItem(i, k)  { const x = seance().briques[i].items[k];  x.fait = !x.fait; sauver(); rendre(); }
function toutCocher(i) { seance().briques[i].items.forEach(x => (x.fait = true)); sauver(); rendre(); }

function ajouterSerie(i) {
  const b = seance().briques[i];
  const d = b.series[b.series.length - 1] || {};
  b.series.push({ charge: d.charge ?? null, reps: d.reps ?? b.repsMin ?? null,
                  rpe: null, fait: false, note: '' });
  edite = { b: i, s: b.series.length - 1 };
  sauver(); rendre();
}
function retirerSerie(i, k) {
  const b = seance().briques[i];
  b.series.splice(k, 1); edite = null; sauver(); rendre();
}
function ajouterBloc(i) {
  const b = seance().briques[i];
  const d = b.blocs[b.blocs.length - 1] || {};
  b.blocs.push({ id: B().nouvelId('c'), nom: 'Palier ' + (b.blocs.length + 1),
                 exId: d.exId || null, duree: d.duree || 300,
                 reglage: { ...(d.reglage || {}) }, fcRelevee: null, fait: false });
  edite = { b: i, s: b.blocs.length - 1 };
  sauver(); rendre();
}
function retirerBloc(i, k) { seance().briques[i].blocs.splice(k, 1); edite = null; sauver(); rendre(); }

function retirerBrique(i) {
  const b = seance().briques[i];
  if (!confirm('Retirer « ' + b.nom + ' » de cette séance ?')) return;
  seance().briques.splice(i, 1); edite = null; sauver(); rendre();
}

function renommer() {
  const s = seance();
  const n = prompt('Nom de la séance', s.nomAffiche);
  if (n && n.trim()) { s.nomAffiche = n.trim(); sauver(); rendre(); }
}
function duree(mn) { seance().dureeReelle = mn; sauver(); rendre(); }

/* Ajout d'un exercice : la banque en mode choix, puis retour ici. */
function ajouterExercice() {
  const retourIci = () => { SportSeance.monter(hote, { auFermer }); SportSeance.ouvrir(sid); };
  SportUI.monter(hote, { auFermer: retourIci, onChoisir: exId => {
    const e = S.exoById(exId);
    const enSecondes = (e.metriques || []).includes('duree') && !(e.metriques || []).includes('charge');
    const b = B().briqueExercice(exId, e.nom, enSecondes ? { unite: 'secondes', charge: 0 } : {});
    b.series = [0, 1, 2].map(() => ({ charge: enSecondes ? 0 : null, reps: b.repsMin,
                                      rpe: null, fait: false, note: '' }));
    seance().briques.push(b); sauver(); retourIci();
  } });
}
function ajouterCardio() {
  const b = B().briqueCardio('Cardio', [ B().blocCardio({ nom: 'Palier 1', duree: 300 }) ]);
  b.blocs = b.blocs.map(x => ({ ...x, fcRelevee: null, fait: false }));
  seance().briques.push(b); sauver(); rendre();
}
function ajouterListe() {
  const b = B().briqueListe('Assouplissements', B().LISTE_ASSOUPLISSEMENTS);
  b.items = b.items.map(i => ({ ...i, fait: false }));
  seance().briques.push(b); sauver(); rendre();
}

function valider() {
  const s = seance();
  if (s.statut !== 'terminee') S.terminer(sid, { dureeReelle: s.dureeReelle });
  else sauver();
  fermer();
}
function supprimer() {
  const s = seance();
  if (!confirm('Supprimer « ' + s.nomAffiche + ' » ? Cette séance sera effacée.')) return;
  S.supprimerSeance(sid); fermer();
}
const retour = () => { sauver(); fermer(); };
function fermer() { if (auFermer) return auFermer(); if (hote) hote.style.display = 'none'; }

/* --- CSS ------------------------------------------------------------------- */

const CSS = `
.sq .sq-h2{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px}
.sq .sq-t2{font-family:'Cormorant Garamond',serif;font-weight:700;font-size:20px;text-align:center;flex:1;min-width:0}
.sq .sq-back{background:none;border:1px solid var(--border);border-radius:10px;padding:7px 12px;
  font-size:14px;color:var(--muted);cursor:pointer;white-space:nowrap}
.sq .sq-cta{background:var(--accent);color:#fff;border:0;border-radius:10px;padding:8px 14px;
  font-weight:600;font-size:14px;cursor:pointer;white-space:nowrap}
.sq .sq-h{display:flex;justify-content:space-between;align-items:baseline}
.sq .sq-x{background:none;border:0;color:#c9a6a3;font-size:11px;text-transform:none;
  letter-spacing:0;cursor:pointer;text-decoration:underline}
.sq .sq-line{display:flex;align-items:center;gap:9px;padding:7px 0;border-bottom:1px solid #faeceb}
.sq .sq-line:last-of-type{border:0}
.sq .sq-n{font-size:13.5px;color:var(--muted);flex:none;min-width:74px}
.sq .sq-txt{font-size:13.5px;flex:1}
.sq .sq-val{flex:1;background:#f6efee;border:0;border-radius:10px;padding:10px;font-size:14px;
  color:var(--text);cursor:pointer;text-align:center;font-weight:600}
.sq .sq-val.on{background:var(--accent);color:#fff}
.sq .sq-check{width:26px;height:26px;border-radius:8px;border:1.5px solid var(--border);flex:none;
  background:var(--surface);color:#fff;font-size:13px;cursor:pointer;padding:0}
.sq .sq-check.on{background:#5f8a2f;border-color:#5f8a2f}
.sq .sq-edit{display:flex;flex-direction:column;gap:8px;padding:10px 0 12px}
.sq .sq-step{display:flex;align-items:center;gap:9px}
.sq .sq-step button{width:40px;height:40px;border-radius:11px;border:1px solid var(--border);
  background:var(--surface);font-size:20px;color:var(--accent);flex:none;cursor:pointer}
.sq .sq-step .v{flex:1;text-align:center;font-family:'Cormorant Garamond',serif;font-size:25px;font-weight:700}
.sq .sq-step .u{display:block;font-size:11px;color:var(--muted);font-weight:400;font-family:'Inter',sans-serif}
.sq .sq-actions{display:flex;gap:8px}
.sq .sq-sec{flex:1;background:none;border:1px solid var(--border);border-radius:10px;padding:9px;
  font-size:13px;color:var(--muted);cursor:pointer}
.sq .sq-conseil{background:#eef3e6;border-radius:11px;padding:10px 12px;font-size:12.5px;
  color:#3f5c22;line-height:1.45;margin-bottom:9px}
.sq .sq-ech{background:#f4f2f0;border-radius:10px;padding:7px 10px;font-size:12px;
  color:#8a7c78;margin-bottom:7px}
.sq .sq-add-l{background:none;border:0;color:var(--accent);font-size:13.5px;font-weight:600;
  padding:9px 0 2px;cursor:pointer}
.sq .sq-renom{display:block;width:100%;background:none;border:1px solid var(--border);
  border-radius:12px;padding:11px;font-size:14px;color:var(--muted);margin-bottom:6px;cursor:pointer}
.sq .sq-chips{display:flex;gap:7px;flex-wrap:wrap}
.sq .sq-chip{background:var(--surface);border:1px solid var(--border);border-radius:20px;
  padding:9px 14px;font-size:13.5px;cursor:pointer;color:var(--text)}
.sq .sq-chip.on{border-color:var(--accent);border-width:1.5px;font-weight:600}
.sq .sq-suppr{display:block;width:100%;background:none;border:1.5px solid #e8c4c7;border-radius:13px;
  padding:12px;font-size:14px;font-weight:600;color:#b8434f;margin-top:16px;cursor:pointer}
`;

function monter(el, options) {
  hote = typeof el === 'string' ? document.getElementById(el) : el;
  auFermer = (options && options.auFermer) || null;
  if (!document.getElementById('sq-css')) {
    const st = document.createElement('style'); st.id = 'sq-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }
  if (hote) hote.style.display = 'block';
}
function ouvrir(seanceId) { sid = seanceId; edite = null; rendre(); }

return { monter, ouvrir, rendre, retour, fermer, editer, pas, pasBloc,
         basculerSerie, basculerBloc, basculerItem, toutCocher,
         ajouterSerie, retirerSerie, ajouterBloc, retirerBloc, retirerBrique,
         renommer, duree, ajouterExercice, ajouterCardio, ajouterListe,
         valider, supprimer };
})();
if (typeof window !== 'undefined') window.SportSeance = SportSeance;
