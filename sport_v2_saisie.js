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

/* Résumé d'une séance, quel que soit son format. */
function resumeSeance(s) {
  if (s.statut === 'repos') return 'jour de repos';
  const duree = s.dureeReelle ? ' · ' + s.dureeReelle + ' mn' : '';
  if (S.estSeanceV2 && S.estSeanceV2(s)) {
    const c = S.comptes(s) || {};
    return [c.faites + ' sur ' + c.total,
            c.tonnage ? c.tonnage.toLocaleString('fr') + ' kg' : null].filter(Boolean).join(' · ') + duree;
  }
  return (s.exercices || []).filter(e => e.fait).length + ' exercices faits' + duree;
}

/* Résumé d'un exercice réalisé, en une ligne courte. */
function resume(exLog) {
  const n = exLog.series.length;
  if (!n) return null;
  const s0 = exLog.series[0];
  /* Un tapis à paliers : on résume le total et le plus dur, pas la moyenne. */
  if (s0.vitesse != null || s0.fc != null) {
    const tot = exLog.series.reduce((a, x) => a + (x.duree || 0), 0);
    const fcMax = Math.max(...exLog.series.map(x => x.fc || 0));
    const bits = [Math.round(tot / 60) + ' min'];
    if (n > 1) bits.push(n + ' paliers');
    if (fcMax) bits.push(fcMax + ' bpm max');
    return bits.join(' · ');
  }
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
      return `<div class="card sv-row">
        <span class="ss-ico" style="background:${t.couleur || '#9a7878'}">${t.emoji || '📋'}</span>
        <div class="sv-grow" onclick="SportSaisie.ouvrir('${s.id}')">
          <div class="sv-nm">${esc(s.nomAffiche)}</div>
          <div class="sv-meta">${resumeSeance(s)}</div></div>
        <button class="ss-suppr" onclick="SportSaisie.supprimer('${s.id}')">Supprimer</button>
        </div>`; }).join('')}` : '';

  const bloc = prevu ? `
    <div class="lbl">Selon ta semaine type</div>
    <div class="card sv-row" onclick="SportSaisie.declarer('${prevu.id}','${iso}')">
      <span class="ss-ico" style="background:${typeDe(prevu).couleur}">${typeDe(prevu).emoji}</span>
      <div class="sv-grow"><div class="sv-nm">${esc(prevu.nom)}</div>
        <div class="sv-meta">${S.nbElements(prevu)} exercices · ~${S.dureeEstimee(prevu)} min</div></div>
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
  <div class="lbl">Séance libre</div>
  <div class="card sv-row" onclick="SportSaisie.libre('${iso}')">
    <span class="ss-ico" style="background:#9a7878">✏️</span>
    <div class="sv-grow"><div class="sv-nm">Je choisis mes exercices</div>
      <div class="sv-meta">Un par un, dans l'ordre que je veux</div></div>
    <span class="sv-chev">›</span></div>
  <div class="lbl">Une de mes séances</div>
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
  /* Les séances en briques appartiennent aux écrans C et D, qui n'existent pas
     encore. En attendant, on les montre en lecture au lieu de planter. */
  if (S.estSeanceV2 && S.estSeanceV2(s)) return vueLecture(s);
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

  const vide = !s.exercices.length ? `<div class="ss-empty">Aucun exercice pour l'instant.
    Ajoute ce que tu as fait, dans l'ordre que tu veux.</div>` : '';
  /* Sur une séance libre, ajouter est le seul geste possible : le bouton doit
     être le plus visible de l'écran, pas une action secondaire en gris. */
  const boutonAjout = `<button class="ss-add" onclick="SportSaisie.ajouter('${s.id}')">
      <span class="ss-plus">+</span><span>Ajouter un exercice</span></button>`;
  const nb = s.exercices.filter(e => e.fait).length;
  return `
  ${entete(s.nomAffiche, `<button class="ss-cta" onclick="SportSaisie.valider('${s.id}')">Valider</button>`)}
  <div class="sv-meta" style="margin:-4px 0 12px">${libelleDate(s.date)} · saisie a posteriori</div>
  ${s.modeleId ? `<div class="ss-astuce">Les valeurs viennent de ce qui était prévu. Décoche ce que tu
  n'as pas fait, corrige ce qui a changé, valide.</div>` : ''}
  ${vide}${blocs}
  ${boutonAjout}
  <div class="lbl">Durée</div>
  <div class="ss-chips">${choixDuree}</div>
  <button class="ss-valid${nb ? '' : ' ss-off-btn'}" onclick="SportSaisie.valider('${s.id}')">${
    nb ? 'Enregistrer — ' + nb + ' exercice' + (nb>1?'s':'') : 'Rien à enregistrer'}</button>
  <button class="ss-suppr-l" onclick="SportSaisie.supprimer('${s.id}')">Supprimer cette séance</button>`;
}

/* Lecture d'une séance en briques, en attendant les écrans C et D. */
function vueLecture(s) {
  const blocs = (s.briques || []).map(b => {
    if (b.nature === 'exercice') {
      const lignes = (b.series || []).filter(x => x.fait).map((x, i) =>
        `<div class="ss-line"><span class="ss-check on">✓</span>
          <span class="sv-grow ss-sm">Série ${i + 1}</span>
          <span class="ss-mini">${[x.charge ? x.charge + ' kg' : null,
            x.reps != null ? x.reps + (b.unite === 'secondes' ? ' s' : ' reps') : null,
            x.rpe != null ? 'RPE ' + x.rpe : null].filter(Boolean).join(' · ')}</span></div>`).join('');
      return `<div class="lbl">${esc(b.nom)}</div><div class="card">${lignes ||
        '<div class="sv-meta">Non fait</div>'}</div>`;
    }
    if (b.nature === 'cardio') {
      const lignes = (b.blocs || []).map(x =>
        `<div class="ss-line"><span class="sv-grow ss-sm">${esc(x.nom || 'Bloc')}</span>
          <span class="ss-mini">${[Math.round((x.dureeReelle || x.duree || 0) / 60) + ' mn',
            x.reglage && x.reglage.vitesse ? x.reglage.vitesse + ' km/h' : null,
            x.reglage && x.reglage.pente ? x.reglage.pente + ' %' : null,
            x.fcRelevee ? x.fcRelevee + ' bpm' : null].filter(Boolean).join(' · ')}</span></div>`).join('');
      return `<div class="lbl">${esc(b.nom)}</div><div class="card">${lignes}</div>`;
    }
    const lignes = (b.items || []).map(i =>
      `<div class="ss-line"><span class="ss-check${i.fait ? ' on' : ''}">${i.fait ? '✓' : ''}</span>
        <span class="sv-grow ss-sm">${esc(i.texte)}</span></div>`).join('');
    return `<div class="lbl">${esc(b.nom)}</div><div class="card">${lignes}</div>`;
  }).join('');

  const c = S.comptes(s) || {};
  return `
  ${entete(s.nomAffiche)}
  <div class="sv-meta" style="margin:-4px 0 12px">${libelleDate(s.date)}${
    s.dureeReelle ? ' · ' + s.dureeReelle + ' mn' : ''}${
    c.tonnage ? ' · ' + c.tonnage.toLocaleString('fr') + ' kg' : ''}${
    c.rpeMoyen != null ? ' · RPE ' + c.rpeMoyen : ''}</div>
  <div class="ss-astuce">Séance au nouveau format. La modification arrivera avec
  l'écran de séance ; pour l'instant elle est consultable.</div>
  ${blocs}
  <button class="ss-suppr-l" onclick="SportSaisie.supprimer('${s.id}')">Supprimer cette séance</button>`;
}

/* Éditeur inline : pas de clavier, on incrémente. */
/* Les champs affichés viennent des métriques de l'exercice. Une suspension se
   saisit en secondes même si c'est un exercice de dos. */
const CHAMPS = {
  series:  { lib: 'séries',      pas: 1,   defaut: 3   },
  reps:    { lib: 'répétitions', pas: 1,   defaut: 8   },
  duree:   { lib: 'secondes',    pas: 15,  defaut: 45  },
  charge:  { lib: 'kilos',       pas: 2.5, defaut: 0   },
  vitesse: { lib: 'km/h',        pas: 0.5, defaut: 5   },
  pente:   { lib: '% de pente',  pas: 1,   defaut: 0   },
  fc:      { lib: 'bpm',         pas: 5,   defaut: 100 }
};
/* On édite une série à la fois. Un tapis se fait par paliers — 5 min à 4,5 puis
   5 min à 5 % de pente — et chaque palier a ses propres valeurs. Modifier
   toutes les séries d'un coup écrasait justement ce qu'il y a d'intéressant. */
function editeur(ex, e, i) {
  const m = e.metriques || ['series','reps','charge'];
  if (!ex.series.length) ex.series.push({});
  const k = Math.min(ctx.serie || 0, ex.series.length - 1);
  const cur = ex.series[k];
  const perSerie = m.filter(q => q !== 'series');

  const val = q => cur[q] ?? CHAMPS[q].defaut;
  const enMin = q => q === 'duree' && val('duree') >= 120;
  const pasDe = q => enMin(q) ? 60 : CHAMPS[q].pas;
  const lib   = q => enMin(q) ? 'minutes' : CHAMPS[q].lib;
  const aff   = q => enMin(q) ? Math.round(val('duree') / 60 * 10) / 10 : val(q);

  const onglets = ex.series.map((_, n) =>
    `<button class="ss-onglet${n===k?' on':''}" onclick="SportSaisie.serie(${n})">${
      m.includes('vitesse') || m.includes('fc') ? 'P' + (n+1) : 'S' + (n+1)}</button>`).join('')
    + `<button class="ss-onglet plus" onclick="SportSaisie.plusSerie(${i})">+</button>`
    + (ex.series.length > 1 ? `<button class="ss-onglet moins" onclick="SportSaisie.moinsSerie(${i})">−</button>` : '');

  return `<div class="ss-edit">
    <div class="ss-onglets">${onglets}</div>
    ${perSerie.map(q => `
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
/* Quitter une saisie sans valider annule le brouillon : on ne laisse jamais
   une séance vide derrière une simple exploration. */
function abandonner() {
  if (ecran !== 'saisie') return;
  const s = S.seanceById(ctx.arg);
  if (s && s.statut === 'brouillon') S.supprimerSeance(s.id);
}
function retour() {
  abandonner();
  const p = PILE.pop();
  if (!p) return fermer();
  ecran = p.ecran; ctx = p.ctx; rendre();
}
function fermer() {
  abandonner();
  if (auFermer) return auFermer();
  if (hote) hote.style.display = 'none';
}

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

/* Une séance notée par erreur doit pouvoir disparaître entièrement — sinon on
   n'ose plus rien saisir de peur de se tromper. */
function supprimer(seanceId) {
  const s = S.seanceById(seanceId);
  if (!s) return;
  if (!confirm('Supprimer « ' + s.nomAffiche + ' » ? Cette séance sera effacée.')) return;
  S.supprimerSeance(seanceId);
  if (ecran === 'saisie') retour(); else rendre();
}

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
const editer = i => { ctx.edite = (ctx.edite === i ? null : i); ctx.serie = 0; rendre(); };

/* Un pas modifie toutes les séries à la fois : en saisie a posteriori on ne se
   souvient pas série par série, on se souvient d'un ordre de grandeur. */
function pas(i, quoi, delta) {
  const s = S.seanceById(ctx.arg), ex = s.exercices[i];
  if (!ex.fait) ex.fait = true;
  const e = S.exoById(ex.exId);
  const m = (e && e.metriques) || ['series','reps','charge'];
  if (!m.includes(quoi)) return;
  if (!ex.series.length) ex.series.push({});
  const k = Math.min(ctx.serie || 0, ex.series.length - 1);
  const se = ex.series[k];
  const base = se[quoi] ?? CHAMPS[quoi].defaut;
  se[quoi] = Math.max(0, Math.round((base + delta) * 10) / 10);
  sauver(); rendre();
}
const serie = k => { ctx.serie = k; rendre(); };
function plusSerie(i) {
  const ex = S.seanceById(ctx.arg).exercices[i];
  ex.series.push({ ...(ex.series[ex.series.length - 1] || {}) });
  ctx.serie = ex.series.length - 1;
  ex.fait = true; sauver(); rendre();
}
function moinsSerie(i) {
  const ex = S.seanceById(ctx.arg).exercices[i];
  if (ex.series.length <= 1) return;
  ex.series.splice(Math.min(ctx.serie || 0, ex.series.length - 1), 1);
  ctx.serie = Math.min(ctx.serie || 0, ex.series.length - 1);
  sauver(); rendre();
}
function duree(min) { const s = S.seanceById(ctx.arg); s.dureeReelle = min; sauver(); rendre(); }
function libre(iso) {
  const s = S.seanceLibre(iso);
  aller('saisie', s.id);
}

/* On ouvre la banque en mode choix ; l'exercice retenu revient ici et la
   saisie reprend là où elle en était. */
function ajouter(seanceId) {
  if (!window.SportUI) return;
  const garde = auFermer;
  const retourIci = () => { SportSaisie.monter(hote, { auFermer: garde }); ecran = 'saisie';
                            ctx = { arg: seanceId }; rendre(); };
  SportUI.monter(hote, {
    auFermer: retourIci,
    onChoisir: exId => {
      const s = S.seanceById(seanceId);
      const e = S.exoById(exId);
      const bloc = (e && (e.cat === 'souplesse' || e.cat === 'mobilite')) ? 'echauffement' : 'corps';
      S.ajouterExercice(seanceId, exId, bloc);
      const ex = s.exercices[s.exercices.length - 1];
      ex.fait = true;
      const m = (e && e.metriques) || ['series','reps','charge'];
      const serie = {};
      if (m.includes('reps'))   serie.reps  = 8;
      if (m.includes('duree'))  serie.duree = m.includes('reps') ? 5 : 45;
      if (m.includes('charge')) serie.charge = null;
      const n = m.includes('series') ? 3 : 1;
      for (let i = 0; i < n; i++) ex.series.push({ ...serie });
      sauver();
      retourIci();
    }
  });
}

function valider(seanceId) {
  const s = S.seanceById(seanceId);
  if (!s) return;
  if (!s.exercices.some(e => e.fait)) {
    alert("Aucun exercice n'est coché : il n'y a rien à enregistrer.");
    return;
  }
  S.terminer(seanceId, { dureeReelle: s.dureeReelle, ressenti: null });
  ecran = 'jour'; ctx = { arg: s.date }; PILE.length = 0;
  rendre();
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
.ss .ss-onglets{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:4px}
.ss .ss-onglet{min-width:38px;padding:7px 10px;border-radius:10px;border:1px solid var(--border);
  background:var(--surface);font-size:13px;color:var(--muted);cursor:pointer}
.ss .ss-onglet.on{background:var(--accent);color:#fff;border-color:var(--accent);font-weight:600}
.ss .ss-onglet.plus{color:var(--accent);font-weight:700}
.ss .ss-onglet.moins{color:#b8434f}
.ss .ss-step{display:flex;align-items:center;gap:9px}
.ss .ss-step button{width:38px;height:38px;border-radius:11px;border:1px solid var(--border);
  background:var(--surface);font-size:19px;color:var(--accent);flex:none;cursor:pointer}
.ss .ss-step .v{flex:1;text-align:center;font-family:'Cormorant Garamond',serif;
  font-size:24px;font-weight:700}
.ss .ss-step .u{display:block;font-size:11px;color:var(--muted);font-weight:400;
  font-family:'Inter',sans-serif}
.ss .ss-ferme{background:none;border:1px solid var(--border);border-radius:10px;padding:8px;
  font-size:13px;color:var(--muted);cursor:pointer}
/* Le geste central de l'écran. Il est répété en haut quand la séance est vide,
   et forcé en !important : les règles globales sur <button> de l'app le
   ramenaient sinon à un lien gris de 13 px. */
.ss button.ss-add{display:flex !important;align-items:center;justify-content:center;gap:10px;
  width:100% !important;background:var(--accent) !important;color:#fff !important;
  border:0 !important;border-radius:16px !important;padding:18px !important;
  font-family:'Inter',sans-serif !important;font-size:17px !important;font-weight:700 !important;
  margin:14px 0 !important;cursor:pointer;box-shadow:0 4px 14px rgba(192,97,106,.32);
  letter-spacing:.01em;text-transform:none !important;line-height:1 !important}
.ss button.ss-add .ss-plus{font-size:24px;font-weight:700;line-height:1;margin-top:-2px}
.ss button.ss-add:active{transform:scale(.985);box-shadow:0 2px 8px rgba(192,97,106,.28)}
.ss .ss-suppr{background:none;border:1px solid #e8c4c7;border-radius:10px;padding:6px 11px;
  font-size:12px;color:#b8434f;cursor:pointer;flex:none}
.ss .ss-suppr-l{display:block;width:100%;background:none;border:1.5px solid #e8c4c7;
  border-radius:13px;padding:12px;font-size:14px;font-weight:600;color:#b8434f;
  margin-top:8px;cursor:pointer}
.ss .ss-valid.ss-off-btn{background:#e7d6d4;color:#fff}
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
         declarer, ouvrir, libre, repos, supprimer, basculer, editer, pas, duree, ajouter,
         serie, plusSerie, moinsSerie,
         valider, cocher, validerRattrapage };
})();
if (typeof window !== 'undefined') window.SportSaisie = SportSaisie;
