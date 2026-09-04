/* ============================================================================
   Coach by JM — Module Sport v2 · saisie a posteriori
   À charger APRÈS sport_v2_core.js (et avant ou après sport_v2_ui.js).
   Point d'entrée : SportSaisie.monter(el, { auFermer })
                    puis .jour('2026-09-02') ou .rattrapage('2026-09-02')

   Différence de fond avec la séance en direct : ici tout est visible d'un coup
   et pré-rempli. On coche, on corrige, on valide — assis, de mémoire.
   ========================================================================= */

const SportSaisie = (function () {

const S = SportV2;
let hote = null, auFermer = null, ecran = 'jour', ctx = {};
const PILE = [];

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

const JOURS = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
const MOIS  = ['janvier','février','mars','avril','mai','juin','juillet','août',
               'septembre','octobre','novembre','décembre'];
const aujourdhui = () => new Date().toISOString().slice(0, 10);

function libelleDate(iso) {
  const d = new Date(iso + 'T12:00');
  return JOURS[d.getDay()] + ' ' + d.getDate() + ' ' + MOIS[d.getMonth()];
}
function ilYA(iso) {
  const n = Math.round((Date.now() - new Date(iso + 'T12:00').getTime()) / 864e5);
  return n <= 0 ? "aujourd'hui" : n === 1 ? 'hier' : 'il y a ' + n + ' jours';
}
const typeDe = m => S.typeById(m && m.type) || { emoji: '📋', couleur: '#c0616a', nom: '' };

function vignette(ex, t = 34) {
  const d = ex && ex.photo && window.EXO_DATA
    ? window.EXO_DATA.find(x => x && x.id === ex.photo) : null;
  const st = `width:${t}px;height:${t}px;border-radius:10px;flex:none;`;
  return d && d.thumb ? `<img src="${d.thumb}" style="${st}object-fit:cover;">`
    : `<div style="${st}background:#fdf0ef;display:flex;align-items:center;justify-content:center;font-size:${Math.round(t*.5)}px">${(ex&&ex.emoji)||'🏋️'}</div>`;
}

/* Résumé d'un exercice réalisé, en une ligne courte. */
function resume(exLog) {
  const n = exLog.series.length;
  if (!n) return null;
  const s0 = exLog.series[0];
  if (s0.duree != null && s0.reps == null) {
    const m = s0.duree >= 120 ? Math.round(s0.duree / 60) + ' min' : s0.duree + ' s';
    return n > 1 ? n + ' × ' + m : m;
  }
  const c = s0.charge != null ? ' · ' + s0.charge + ' kg' : '';
  return n + ' × ' + (s0.reps ?? '?') + c;
}

/* =========================================================================
   1. UN JOUR PASSÉ
   ====================================================================== */

function vueJour(iso) {
  /* Sur un jour passé, prevuLe() ne renvoie plus rien : on interroge la trame
     pour proposer quand même la séance de ce jour de la semaine. */
  const prevuId = S.prevuLe(iso) || S.trameDe(iso);
  const prevu = prevuId ? S.modeleById(prevuId) : null;
  const deja = S.seancesDe(iso);

  const faites = deja.length ? `
    <div class="lbl">Déjà noté ce jour-là</div>
    ${deja.map(s => {
      const t = S.typeById(s.type) || {};
      return `<div class="card sv-row" onclick="SportSaisie.ouvrir('${s.id}')">
        <span class="ss-ico" style="background:${t.couleur || '#9a7878'}">${t.emoji || '📋'}</span>
        <div class="sv-grow"><div class="sv-nm">${esc(s.nomAffiche)}</div>
          <div class="sv-meta">${s.statut === 'repos' ? 'jour de repos'
            : s.exercices.filter(e => e.fait).length + ' exercices faits'}</div></div>
        <span class="sv-chev">›</span></div>`; }).join('')}` : '';

  const bloc = prevu ? `
    <div class="lbl">Selon ta semaine type</div>
    <div class="card sv-row" onclick="SportSaisie.declarer('${prevu.id}','${iso}')">
      <span class="ss-ico" style="background:${typeDe(prevu).couleur}">${typeDe(prevu).emoji}</span>
      <div class="sv-grow"><div class="sv-nm">${esc(prevu.nom)}</div>
        <div class="sv-meta">${prevu.blocs.reduce((a,b)=>a+b.exercices.length,0)} exercices · ~${S.dureeEstimee(prevu)} min</div></div>
      <span class="sv-chev">›</span></div>` : `
    <div class="lbl">Selon ta semaine type</div>
    <div class="ss-empty">Ce jour-là était un jour de repos.</div>`;

  const autres = S.modeles().filter(m => m.id !== prevuId).map(m =>
    `<button class="ss-chip" onclick="SportSaisie.declarer('${m.id}','${iso}')">
       ${typeDe(m).emoji} ${esc(S.typeById(m.type) ? S.typeById(m.type).nom : m.nom)}</button>`).join('');

  return `
  ${entete(libelleDate(iso))}
  <div class="ss-hero">
    <div class="ss-j">${ilYA(iso)}${deja.length ? '' : ' · rien de noté'}</div>
    <div class="ss-t">Qu'as-tu fait ce jour-là ?</div>
  </div>
  ${faites}
  ${bloc}
  <div class="lbl">Autre séance</div>
  <div class="ss-chips">${autres}</div>
  ${deja.length ? '' : `<div class="lbl">Ou</div>
  <button class="btn-ghost" onclick="SportSaisie.repos('${iso}')">Marquer comme jour de repos</button>`}`;
}

/* =========================================================================
   2. LA SAISIE RAPIDE
   ====================================================================== */

const LIB_BLOC = { echauffement: ['🔥','Échauffement'], corps: ['💪','Corps de la séance'],
                   retour_calme: ['🌙','Retour au calme'] };

function vueSaisie(seanceId) {
  const s = S.seanceById(seanceId);
  if (!s) return entete('Séance') + `<div class="ss-empty">Cette séance n'existe plus.</div>`;
  const cat = S.catalogue();

  const blocs = ['echauffement','corps','retour_calme'].map(bt => {
    const lignes = s.exercices.map((ex, i) => ({ ex, i })).filter(o => o.ex.bloc === bt);
    if (!lignes.length) return '';
    const [emo, lib] = LIB_BLOC[bt];
    return `<div class="lbl">${emo} ${lib}</div><div class="card">` + lignes.map(({ex, i}) => {
      const e = cat.find(x => x.id === ex.exId); if (!e) return '';
      const r = resume(ex);
      const ouvert = ctx.edite === i;
      return `<div class="ss-line">
        <button class="ss-check${ex.fait?' on':''}" onclick="SportSaisie.basculer(${i})">${ex.fait?'✓':''}</button>
        ${vignette(e, 32)}
        <div class="sv-grow"><div class="sv-nm ss-sm${ex.fait?'':' ss-off'}">${esc(e.nom)}</div></div>
        <button class="ss-mini${ex.fait?'':' vide'}" onclick="SportSaisie.editer(${i})">${ex.fait ? esc(r||'—') : 'non fait'}</button>
      </div>${ouvert ? editeur(ex, e, i) : ''}`;
    }).join('') + `</div>`;
  }).join('');

  const DUREES = [20, 30, 45, 60, 75, 90];
  const choixDuree = DUREES.map(d =>
    `<button class="ss-chip${s.dureeReelle===d?' on':''}" onclick="SportSaisie.duree(${d})">${
      d >= 60 ? (d/60 === 1 ? '1 h' : (d/60).toString().replace('.5','\u00a0h\u00a030').replace(/^(\\d+)$/,'$1 h')) : d + ' min'}</button>`).join('');

  const nb = s.exercices.filter(e => e.fait).length;
  return `
  ${entete(s.nomAffiche, `<button class="ss-cta" onclick="SportSaisie.valider('${s.id}')">Valider</button>`)}
  <div class="sv-meta" style="margin:-4px 0 12px">${libelleDate(s.date)} · saisie a posteriori</div>
  <div class="ss-astuce">Les valeurs viennent de ce qui était prévu. Décoche ce que tu n'as pas fait,
  corrige ce qui a changé, valide.</div>
  ${blocs}
  <div class="lbl">Durée</div>
  <div class="ss-chips">${choixDuree}</div>
  <button class="ss-valid" onclick="SportSaisie.valider('${s.id}')">Enregistrer — ${nb} exercice${nb>1?'s':''}</button>
  <button class="btn-ghost" onclick="SportSaisie.ajouter('${s.id}')">+ Ajouter un exercice non prévu</button>`;
}

/* Éditeur inline : pas de clavier, on incrémente. */
/* Les champs affichés viennent des métriques de l'exercice. Une suspension se
   saisit en secondes même si c'est un exercice de dos. */
const CHAMPS = {
  series: { lib: 'séries',      pas: 1,   defaut: 3  },
  reps:   { lib: 'répétitions', pas: 1,   defaut: 8  },
  duree:  { lib: 'secondes',    pas: 15,  defaut: 45 },
  charge: { lib: 'kilos',       pas: 2.5, defaut: 0  }
};
function editeur(ex, e, i) {
  const m = e.metriques || ['series','reps','charge'];
  const s0 = ex.series[0] || {};
  const val = q => q === 'series' ? (ex.series.length || 1) : (s0[q] ?? CHAMPS[q].defaut);
  const pasDe = q => (q === 'duree' && val('duree') >= 300) ? 300 : CHAMPS[q].pas;
  const lib = q => (q === 'duree' && val('duree') >= 300) ? 'minutes' : CHAMPS[q].lib;
  const aff = q => (q === 'duree' && val('duree') >= 300) ? Math.round(val('duree')/60) : val(q);

  return `<div class="ss-edit">
    ${m.map(q => `
    <div class="ss-step">
      <button onclick="SportSaisie.pas(${i},'${q}',${-pasDe(q)})">−</button>
      <div class="v">${aff(q)}<span class="u">${lib(q)}</span></div>
      <button onclick="SportSaisie.pas(${i},'${q}',${pasDe(q)})">+</button>
    </div>`).join('')}
    <button class="ss-ferme" onclick="SportSaisie.editer(null)">Terminé</button>
  </div>`;
}

/* =========================================================================
   3. LE RATTRAPAGE GROUPÉ
   ====================================================================== */

function vueRattrapage(depuis) {
  const jours = S.joursAConfirmer(depuis);
  ctx.coches = ctx.coches || {};

  const lignes = jours.map(j => {
    const m = S.modeleById(j.modeleId), t = typeDe(m);
    const on = ctx.coches[j.date] !== false;
    return `<div class="ss-line">
      <button class="ss-check${on?' on':''}" onclick="SportSaisie.cocher('${j.date}')">${on?'✓':''}</button>
      <span class="ss-ico" style="width:32px;height:32px;font-size:15px;background:${t.couleur}">${t.emoji}</span>
      <div class="sv-grow"><div class="sv-nm ss-sm${on?'':' ss-off'}">${libelleDate(j.date).replace(/ \\d+ .*/, '')} ${j.date.slice(8)} — ${esc(m.nom)}</div>
        <div class="sv-meta">${on ? 'tel que prévu' : 'pas fait'}</div></div>
      ${on ? `<button class="ss-mini" onclick="SportSaisie.declarer('${j.modeleId}','${j.date}')">détailler</button>` : ''}
    </div>`;
  }).join('');

  const n = jours.filter(j => ctx.coches[j.date] !== false).length;
  return `
  ${entete('Rattraper mes séances')}
  <div class="ss-astuce">Ces jours étaient au programme mais rien n'a été noté. Coche ceux que tu as
  faits — tu pourras préciser les charges plus tard, exercice par exercice.</div>
  ${jours.length ? `<div class="card">${lignes}</div>`
    : `<div class="ss-empty">Rien à rattraper : tous les jours prévus sont renseignés.</div>`}
  ${jours.length ? `<button class="ss-valid" onclick="SportSaisie.validerRattrapage('${depuis}')">Enregistrer ${n} séance${n>1?'s':''}</button>
  <div class="sv-meta" style="text-align:center;margin-top:8px">Tes objectifs seront recalculés immédiatement.</div>` : ''}`;
}

/* =========================================================================
   CHÂSSIS
   ====================================================================== */

function entete(titre, action) {
  return `<div class="ss-h2">
    <button class="ss-back" onclick="SportSaisie.retour()">‹ Retour</button>
    <div class="ss-t2">${esc(titre)}</div>
    ${action || '<span style="width:62px;flex:none"></span>'}
  </div>`;
}

function aller(nom, arg) { PILE.push({ ecran, ctx }); ecran = nom; ctx = { arg }; rendre(); }
function retour() {
  const p = PILE.pop();
  if (!p) return fermer();
  ecran = p.ecran; ctx = p.ctx; rendre();
}
function fermer() { if (auFermer) return auFermer(); if (hote) hote.style.display = 'none'; }

function rendre() {
  if (!hote) return;
  const v = ecran === 'jour'       ? vueJour(ctx.arg)
          : ecran === 'saisie'     ? vueSaisie(ctx.arg)
          : ecran === 'rattrapage' ? vueRattrapage(ctx.arg)
          : vueJour(aujourdhui());
  hote.innerHTML = `<div class="sv ss">${v}</div>`;
}

/* ---- actions ---- */

const jour       = iso => { PILE.length = 0; ecran = 'jour';       ctx = { arg: iso }; rendre(); };
const rattrapage = iso => { PILE.length = 0; ecran = 'rattrapage'; ctx = { arg: iso, coches: {} }; rendre(); };

function declarer(modeleId, iso) {
  const s = S.instancierFaite(modeleId, iso);
  aller('saisie', s.id);
}
const ouvrir = seanceId => aller('saisie', seanceId);

function repos(iso) { S.marquerRepos(iso); rendre(); }

function basculer(i) {
  const s = S.seanceById(ctx.arg);
  const ex = s.exercices[i];
  ex.fait = !ex.fait;
  if (!ex.fait) ex.series = [];
  else if (!ex.series.length) {
    const e = S.exoById(ex.exId), m = (e && e.metriques) || ['reps'];
    const se = {};
    if (m.includes('reps'))  se.reps  = 8;
    if (m.includes('duree')) se.duree = m.includes('reps') ? 5 : 45;
    ex.series.push(se);
  }
  S.enregistrerSeance ? S.enregistrerSeance(s) : null;
  sauver(); rendre();
}
const editer = i => { ctx.edite = (ctx.edite === i ? null : i); rendre(); };

/* Un pas modifie toutes les séries à la fois : en saisie a posteriori on ne se
   souvient pas série par série, on se souvient d'un ordre de grandeur. */
function pas(i, quoi, delta) {
  const s = S.seanceById(ctx.arg), ex = s.exercices[i];
  if (!ex.fait) ex.fait = true;
  const e = S.exoById(ex.exId);
  const m = (e && e.metriques) || ['series','reps','charge'];
  if (!m.includes(quoi)) return;
  if (quoi === 'series') {
    const n = Math.max(1, ex.series.length + delta);
    while (ex.series.length > n) ex.series.pop();
    while (ex.series.length < n) ex.series.push({ ...(ex.series[0] || { reps: 8 }) });
  } else {
    if (!ex.series.length) ex.series.push({});
    for (const se of ex.series) {
      const v = Math.max(0, Math.round(((se[quoi] ?? (quoi === 'duree' ? 45 : quoi === 'reps' ? 8 : 0)) + delta) * 10) / 10);
      se[quoi] = v;
    }
  }
  sauver(); rendre();
}
function duree(min) { const s = S.seanceById(ctx.arg); s.dureeReelle = min; sauver(); rendre(); }
function ajouter() { if (window.SportUI) SportUI.monter(hote, { auFermer: () => rendre() }); }

function valider(seanceId) {
  const s = S.seanceById(seanceId);
  S.terminer(seanceId, { dureeReelle: s.dureeReelle, ressenti: null });
  fermer();
}

function cocher(date) { ctx.coches[date] = !(ctx.coches[date] !== false); rendre(); }

function validerRattrapage(depuis) {
  const jours = S.joursAConfirmer(depuis);
  let n = 0;
  for (const j of jours) {
    if (ctx.coches[j.date] === false) { S.marquerRepos(j.date); continue; }
    const s = S.instancierFaite(j.modeleId, j.date);
    S.terminer(s.id, { dureeReelle: S.dureeEstimee(S.modeleById(j.modeleId)) });
    n++;
  }
  fermer();
  return n;
}

/* La séance vit dans hist ; les mutations directes doivent être persistées. */
function sauver() {
  const h = S.hist();
  try { localStorage.setItem('mc_hist_v2', JSON.stringify(h)); } catch (e) {}
}

/* ---- CSS ---- */

const CSS = `
.ss .ss-h2{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:8px}
.ss .ss-t2{font-family:'Cormorant Garamond',serif;font-weight:700;font-size:20px;
  text-align:center;flex:1;min-width:0}
.ss .ss-back{background:none;border:1px solid var(--border);border-radius:10px;padding:7px 12px;
  font-size:14px;color:var(--muted);white-space:nowrap;cursor:pointer}
.ss .ss-cta{background:var(--accent);color:#fff;border:0;border-radius:10px;padding:8px 14px;
  font-weight:600;font-size:14px;cursor:pointer;white-space:nowrap}
.ss .ss-hero{background:var(--surface);border:1.5px solid var(--accent);border-radius:18px;
  padding:15px;margin-bottom:12px}
.ss .ss-j{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);font-weight:700}
.ss .ss-t{font-family:'Cormorant Garamond',serif;font-weight:700;font-size:23px;margin-top:5px}
.ss .ss-ico{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;
  justify-content:center;font-size:19px;flex:none;color:#fff}
.ss .ss-chips{display:flex;gap:7px;flex-wrap:wrap;margin-bottom:6px}
.ss .ss-chip{background:var(--surface);border:1px solid var(--border);border-radius:20px;
  padding:7px 13px;font-size:13px;cursor:pointer;color:var(--text)}
.ss .ss-chip.on{border-color:var(--accent);border-width:1.5px;font-weight:600}
.ss .ss-empty{border:1.5px dashed var(--border);border-radius:14px;padding:14px;text-align:center;
  font-size:12.5px;color:var(--muted);margin-bottom:9px}
.ss .ss-astuce{background:#fbf4f3;border-radius:12px;padding:11px 13px;font-size:12.5px;
  color:#7a5b59;line-height:1.5;margin-bottom:10px}
.ss .ss-line{display:flex;align-items:center;gap:9px;padding:9px 0;border-bottom:1px solid #faeceb}
.ss .ss-line:last-child{border:0}
.ss .ss-sm{font-size:14px}
.ss .ss-off{color:var(--muted)}
.ss .ss-check{width:26px;height:26px;border-radius:8px;border:1.5px solid var(--border);flex:none;
  background:var(--surface);color:#fff;font-size:13px;cursor:pointer;padding:0}
.ss .ss-check.on{background:#5f8a2f;border-color:#5f8a2f}
.ss .ss-mini{background:#f6efee;border:0;border-radius:9px;padding:7px 10px;font-size:13px;
  white-space:nowrap;cursor:pointer;color:var(--text)}
.ss .ss-mini.vide{color:var(--muted);background:none}
.ss .ss-edit{display:flex;flex-direction:column;gap:8px;padding:10px 0 12px}
.ss .ss-step{display:flex;align-items:center;gap:9px}
.ss .ss-step button{width:38px;height:38px;border-radius:11px;border:1px solid var(--border);
  background:var(--surface);font-size:19px;color:var(--accent);flex:none;cursor:pointer}
.ss .ss-step .v{flex:1;text-align:center;font-family:'Cormorant Garamond',serif;
  font-size:24px;font-weight:700}
.ss .ss-step .u{display:block;font-size:11px;color:var(--muted);font-weight:400;
  font-family:'Inter',sans-serif}
.ss .ss-ferme{background:none;border:1px solid var(--border);border-radius:10px;padding:8px;
  font-size:13px;color:var(--muted);cursor:pointer}
.ss .ss-valid{display:block;width:100%;background:var(--accent);color:#fff;border:0;
  border-radius:13px;padding:13px;text-align:center;font-weight:600;font-size:15px;
  margin-top:12px;cursor:pointer}
`;

function monter(el, options) {
  hote = typeof el === 'string' ? document.getElementById(el) : el;
  auFermer = (options && options.auFermer) || null;
  if (!document.getElementById('ss-css')) {
    const st = document.createElement('style'); st.id = 'ss-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }
  if (hote) hote.style.display = 'block';
  rendre();
}

return { monter, jour, rattrapage, retour, fermer, rendre,
         declarer, ouvrir, repos, basculer, editer, pas, duree, ajouter,
         valider, cocher, validerRattrapage };
})();
if (typeof window !== 'undefined') window.SportSaisie = SportSaisie;
