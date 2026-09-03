/* ============================================================================
   Coach by JM — Module Sport v2 · noyau
   À charger APRÈS sport_catalogue.js et exo_data.js.

   Écrit dans localStorage uniquement : le shim de l'app pousse en Firestore
   tout seul. Deux clés à ajouter dans PRIVATE_KEYS (ligne 1327) :
       'mc_sport_v2', 'mc_hist_v2'
   ========================================================================= */

const SportV2 = (function () {

const K_ETAT = 'mc_sport_v2';   // objectifs, modèles, planning, retouches du catalogue
const K_HIST = 'mc_hist_v2';    // séances réalisées

/* ---------------------------------------------------------------------------
   ÉTAT
   Pas de SPSEEDV, pas de remise à zéro conditionnelle. Une version de schéma
   sert à migrer, jamais à effacer : c'est ce qui rendait l'historique otage
   d'une constante.
------------------------------------------------------------------------------ */

const SCHEMA = 2;

let etat = null, hist = null;

function lire(cle, defaut) {
  try { const v = JSON.parse(localStorage.getItem(cle) || 'null'); return v || defaut; }
  catch (e) { return defaut; }
}
function ecrire(cle, valeur) {
  try { localStorage.setItem(cle, JSON.stringify(valeur)); } catch (e) { console.warn('sport:save', e); }
}

function charger() {
  etat = lire(K_ETAT, null);
  hist = lire(K_HIST, null);

  if (!etat) {
    etat = {
      schema: SCHEMA,
      objectifs: structuredClone(window.SPORT_OBJECTIFS),
      modeles:   structuredClone(window.SPORT_MODELES),
      retouches: {},                 // exId -> champs surchargés (phaseCourante, objectifs, nom…)
      ajouts:    [],                 // exercices créés par l'utilisateur
      semaineType: { 0:'m105', 1:'m107', 2:'m101', 4:'m108', 5:'m103', 6:'m106' },
      planning:  []                  // { id, date:'YYYY-MM-DD', modeleId, seanceId? }
    };
    reprendreAncienModule();
    ecrire(K_ETAT, etat);
  }
  if (!hist) { hist = { seances: [], prochainId: 1 }; ecrire(K_HIST, hist); }
  return { etat, hist };
}

/* Reprise unique de l'ancien module : planning, semaine type et surtout les
   séances déjà réalisées stockées dans mc_sport. Rien n'est effacé côté v1. */
function reprendreAncienModule() {
  const v1 = lire('mc_sport', null);
  if (!v1) return;
  const map = window.SPORT_LEGACY.exos;

  if (v1.pattern) {
    etat.semaineType = {};
    for (const [jour, seaId] of Object.entries(v1.pattern)) etat.semaineType[jour] = 'm' + seaId;
  }
  if (Array.isArray(v1.events)) {
    etat.planning = v1.events.map(e => ({ id: e.id, date: e.date, modeleId: 'm' + e.seaId }));
  }
  if (v1.logs) {
    hist = { seances: [], prochainId: 1 };
    for (const lg of Object.values(v1.logs)) {
      hist.seances.push({
        id: 's' + (hist.prochainId++),
        date: lg.dateISO,
        modeleId: 'm' + lg.seaId,
        nomAffiche: lg.nom,
        statut: 'terminee',
        exercices: (lg.items || []).map((it, i) => ({
          exId: map[it.id] || null, ordre: i,
          bloc: it.corps ? 'corps' : 'echauffement',
          origine: 'modele',
          series: (it.sets || []).map(s => ({ reps: s.reps ?? null, charge: s.charge ?? null, duree: s.duree ?? null })),
          fait: !!it.done, note: it.note || ''
        })).filter(e => e.exId)
      });
    }
    ecrire(K_HIST, hist);
  }
}

const sauverEtat = () => ecrire(K_ETAT, etat);
const sauverHist = () => ecrire(K_HIST, hist);

/* ---------------------------------------------------------------------------
   CATALOGUE
   Le fichier généré est la base ; les retouches et les ajouts se superposent.
------------------------------------------------------------------------------ */

function catalogue() {
  const base = window.SPORT_CATALOGUE.map(e => {
    const r = etat.retouches[e.id];
    return r ? { ...e, ...r } : e;
  });
  return base.concat(etat.ajouts);
}
const exoById = id => catalogue().find(e => e.id === id) || null;

function retoucher(exId, champs) {
  etat.retouches[exId] = { ...(etat.retouches[exId] || {}), ...champs };
  sauverEtat();
}

/* La phase est une préférence d'affichage, réglée à la main. Elle est persistée
   — c'est précisément ce que l'ancien `const prog={}` ne faisait pas. */
const reglerPhase = (exId, rang) => retoucher(exId, { phaseCourante: rang });

function creerExercice(champs) {
  const id = (champs.nom || 'exercice').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  const ex = { id, emoji: '🏋️', cat: 'dos', famille: 'haut', desc: '', consigne: '',
               phases: [], phaseCourante: 1, photo: null, objectifs: [], ...champs };
  etat.ajouts.push(ex); sauverEtat();
  return ex;
}

const POIDS = { plein: 1, moyen: 0.5, leger: 0.25 };

function poserObjectif(exId, objectifId, poids = 'plein') {
  const ex = exoById(exId); if (!ex) return;
  const liens = (ex.objectifs || []).filter(o => o.objectifId !== objectifId);
  liens.push({ objectifId, poids });
  retoucher(exId, { objectifs: liens });
}
function retirerObjectif(exId, objectifId) {
  const ex = exoById(exId); if (!ex) return;
  retoucher(exId, { objectifs: (ex.objectifs || []).filter(o => o.objectifId !== objectifId) });
}

/* ---------------------------------------------------------------------------
   MODÈLES
------------------------------------------------------------------------------ */

const modeles = () => etat.modeles;
const modeleById = id => etat.modeles.find(m => m.id === id) || null;

function enregistrerModele(modele) {
  const i = etat.modeles.findIndex(m => m.id === modele.id);
  modele.version = (modele.version || 1) + 1;
  if (i < 0) etat.modeles.push(modele); else etat.modeles[i] = modele;
  sauverEtat();
  return modele;
}
function dupliquerModele(id) {
  const src = modeleById(id); if (!src) return null;
  const copie = { ...structuredClone(src), id: 'm' + Date.now(), nom: src.nom + ' (copie)', version: 1 };
  etat.modeles.push(copie); sauverEtat();
  return copie;
}
function supprimerModele(id) {
  etat.modeles = etat.modeles.filter(m => m.id !== id);
  etat.planning = etat.planning.filter(p => p.modeleId !== id);
  sauverEtat();
}

/* Répartition par objectif : elle décrit la composition, elle ne la dicte plus. */
function repartition(modele) {
  const cat = catalogue(), total = {};
  for (const bloc of modele.blocs) {
    for (const ligne of bloc.exercices) {
      const ex = cat.find(e => e.id === ligne.exId); if (!ex) continue;
      const u = unitesPrevues(ligne, ex);
      for (const l of ex.objectifs || []) total[l.objectifId] = (total[l.objectifId] || 0) + u * (POIDS[l.poids] || 0);
    }
  }
  const somme = Object.values(total).reduce((a, b) => a + b, 0);
  if (!somme) return [];
  return etat.objectifs
    .map(o => ({ objectifId: o.id, nom: o.nom, couleur: o.couleur,
                 part: Math.round(((total[o.id] || 0) / somme) * 100) }))
    .filter(r => r.part > 0).sort((a, b) => b.part - a.part);
}

function dureeEstimee(modele) {
  const cat = catalogue(); let s = 0;
  for (const bloc of modele.blocs) for (const ligne of bloc.exercices) {
    const ex = cat.find(e => e.id === ligne.exId); if (!ex) continue;
    const series = ligne.series || 3;
    const travail = ligne.duree || (ligne.reps || 8) * 3;
    s += series * (travail + (ex.cat === 'cardio' ? 0 : ex.charges ? 90 : 30));
  }
  return Math.round(s / 60);
}

/* ---------------------------------------------------------------------------
   SÉANCES
   Instancier = copier. La séance du jour et le modèle ne se parlent plus.
------------------------------------------------------------------------------ */

function instancier(modeleId, date) {
  const m = modeleById(modeleId); if (!m) return null;
  const exercices = []; let ordre = 0;
  for (const bloc of m.blocs) for (const l of bloc.exercices) {
    exercices.push({ exId: l.exId, ordre: ordre++, bloc: bloc.type, origine: 'modele',
                     prevu: { series: l.series, reps: l.reps, charge: l.charge, duree: l.duree },
                     series: [], fait: false, note: '' });
  }
  const s = { id: 's' + (hist.prochainId++), date, modeleId, modeleVersion: m.version,
              nomAffiche: m.nom, couleur: m.couleur, statut: 'planifiee',
              exercices, dureeReelle: null, ressenti: null, commentaire: '' };
  hist.seances.push(s); sauverHist();
  return s;
}

const seanceById = id => hist.seances.find(s => s.id === id) || null;
const seancesDe = iso => hist.seances.filter(s => s.date === iso);

function ajouterExercice(seanceId, exId, bloc = 'corps') {
  const s = seanceById(seanceId); if (!s) return null;
  s.exercices.push({ exId, ordre: s.exercices.length, bloc, origine: 'ajout_du_jour',
                     prevu: {}, series: [], fait: false, note: '' });
  sauverHist(); return s;
}
function retirerExercice(seanceId, index) {
  const s = seanceById(seanceId); if (!s) return null;
  s.exercices.splice(index, 1); s.exercices.forEach((e, i) => (e.ordre = i));
  sauverHist(); return s;
}
function noterSerie(seanceId, index, serie) {
  const s = seanceById(seanceId); if (!s) return null;
  s.exercices[index].series.push(serie);
  s.exercices[index].fait = true;
  if (s.statut === 'planifiee') s.statut = 'en_cours';
  sauverHist(); return s;
}
/* Écarts délibérés seulement : ce que tu as ajouté, et ce que tu as retiré
   explicitement. Un exercice simplement pas encore fait n'est pas un écart —
   sinon toute séance partielle en déclencherait des dizaines. */
function ecarts(seance) {
  const m = seance.modeleId ? modeleById(seance.modeleId) : null;
  const ajouts = seance.exercices.filter(e => e.origine === 'ajout_du_jour').length;
  if (!m) return ajouts;
  const presents = new Set(seance.exercices.map(e => e.exId));
  const retires = m.blocs.flatMap(b => b.exercices).filter(l => !presents.has(l.exId)).length;
  return ajouts + retires;
}
function terminer(seanceId, { dureeReelle, ressenti, commentaire } = {}) {
  const s = seanceById(seanceId); if (!s) return null;
  Object.assign(s, { statut: 'terminee', dureeReelle, ressenti, commentaire, termineeLe: Date.now() });
  sauverHist(); return s;
}
/* Remontée explicite des ajustements du jour dans le modèle — jamais automatique. */
function reporterDansModele(seanceId) {
  const s = seanceById(seanceId); if (!s || !s.modeleId) return null;
  const m = modeleById(s.modeleId); if (!m) return null;
  for (const bloc of m.blocs) bloc.exercices = [];
  for (const e of s.exercices) {
    if (!e.fait && e.origine === 'modele') continue;
    const bloc = m.blocs.find(b => b.type === e.bloc) || m.blocs[1];
    bloc.exercices.push({ exId: e.exId, series: e.series.length || null,
                          reps: e.series[0]?.reps ?? null, charge: e.series[0]?.charge ?? null,
                          duree: e.series[0]?.duree ?? null, note: '' });
  }
  return enregistrerModele(m);
}

/* ---------------------------------------------------------------------------
   STATISTIQUES
------------------------------------------------------------------------------ */

const FENETRE = 4; // semaines

function unitesRealisees(exLog, ex) {
  if (!exLog.series || !exLog.series.length) return exLog.fait ? 1 : 0;
  if (ex.cat === 'cardio' || ex.cat === 'souplesse' || ex.cat === 'mobilite' || ex.cat === 'gainage') {
    const sec = exLog.series.reduce((a, s) => a + (s.duree || 0), 0);
    return sec ? sec / 300 : exLog.series.length * 0.5;
  }
  return exLog.series.length;
}
function unitesPrevues(ligne, ex) {
  if (ex.cat === 'cardio' || ex.cat === 'souplesse' || ex.cat === 'mobilite')
    return ((ligne.series || 2) * (ligne.duree || 45)) / 300;
  return ligne.series || 3;
}

function seancesRecentes(semaines = FENETRE) {
  const depuis = new Date(Date.now() - semaines * 7 * 864e5).toISOString().slice(0, 10);
  return hist.seances.filter(s => s.statut === 'terminee' && s.date >= depuis);
}

/* Investissement : ce que tu as réellement consacré à chaque objectif.
   C'est l'indicateur qui bouge dès la première séance validée. */
function investissement(semaines = FENETRE) {
  const cat = catalogue(), recentes = seancesRecentes(semaines);
  const brut = {}; etat.objectifs.forEach(o => (brut[o.id] = { u: 0, s: new Set() }));

  for (const s of recentes) for (const exLog of s.exercices) {
    const ex = cat.find(e => e.id === exLog.exId); if (!ex) continue;
    const u = unitesRealisees(exLog, ex); if (!u) continue;
    for (const l of ex.objectifs || []) {
      if (!brut[l.objectifId]) continue;
      brut[l.objectifId].u += u * (POIDS[l.poids] || 0);
      brut[l.objectifId].s.add(s.id);
    }
  }
  const somme = Object.values(brut).reduce((a, b) => a + b.u, 0);
  const res = {};
  for (const o of etat.objectifs) res[o.id] = {
    unites: Math.round(brut[o.id].u * 10) / 10,
    part: somme ? Math.round((brut[o.id].u / somme) * 100) : 0,
    nbSeances: brut[o.id].s.size
  };
  return res;
}

function meilleurePerf(exId, metrique) {
  let max = null;
  for (const s of hist.seances) for (const e of s.exercices) {
    if (e.exId !== exId) continue;
    for (const serie of e.series || []) {
      const v = serie[metrique]; if (v == null) continue;
      if (max == null || v > max) max = v;
    }
  }
  return max;
}

/* Avancement : une mécanique par nature d'objectif. L'ancien calcul en
   appliquait une seule aux cinq, d'où le 0 % général. */
function avancement(objectif) {
  if (objectif.nature === 'externe') {
    const c = objectif.cible || {};
    return { type: 'valeur', valeur: c.valeurActuelle ?? null, cible: c.valeurCible ?? null, majLe: c.majLe ?? null };
  }
  if (objectif.nature === 'mesure') {
    const suivi = lire('sandra_poids', []);
    const derniere = [].concat(suivi).filter(Boolean).sort((a, b) => String(b.date).localeCompare(String(a.date)))[0];
    const { depart, cible } = objectif.cible || {};
    if (!derniere || depart == null || depart === cible) return { type: 'pourcentage', pourcentage: 0 };
    const v = derniere.valeur ?? derniere.poids;
    return { type: 'pourcentage',
             pourcentage: Math.max(0, Math.min(100, Math.round(((depart - v) / (depart - cible)) * 100))),
             detail: v + ' → ' + cible + ' kg' };
  }
  if (objectif.nature === 'jalons') {
    const jalons = objectif.cible?.jalons || [];
    let n = 0, dernier = null;
    for (const j of jalons) {
      const perf = meilleurePerf(j.exId, j.metrique);
      const atteint = perf != null && (j.valeur < 0 ? perf >= j.valeur : perf >= j.valeur);
      if (!atteint) break;
      n++; dernier = j.libelle;
    }
    return { type: 'pourcentage',
             pourcentage: jalons.length ? Math.round((n / jalons.length) * 100) : 0,
             detail: dernier || 'premier palier à franchir' };
  }
  // couverture
  const rattaches = catalogue().filter(e => (e.objectifs || []).some(o => o.objectifId === objectif.id));
  const pratiques = new Set();
  for (const s of hist.seances) for (const e of s.exercices) if (e.fait) pratiques.add(e.exId);
  const n = rattaches.filter(e => pratiques.has(e.id)).length;
  return { type: 'pourcentage',
           pourcentage: rattaches.length ? Math.round((n / rattaches.length) * 100) : 0,
           detail: n + ' exercices sur ' + rattaches.length + ' pratiqués' };
}

function jamaisFaits(objectifId = null) {
  const pratiques = new Set();
  for (const s of hist.seances) for (const e of s.exercices) if (e.fait) pratiques.add(e.exId);
  return catalogue().filter(e => !pratiques.has(e.id) &&
    (!objectifId || (e.objectifs || []).some(o => o.objectifId === objectifId)));
}

function derniereFois(exId) {
  const s = hist.seances.filter(x => x.exercices.some(e => e.exId === exId && e.fait))
                        .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!s) return null;
  const e = s.exercices.find(e => e.exId === exId);
  return { date: s.date, series: e.series };
}

/* ------------------------------------------------------------------------- */

charger();

return { charger, etat: () => etat, hist: () => hist,
         catalogue, exoById, retoucher, reglerPhase, creerExercice, poserObjectif, retirerObjectif,
         modeles, modeleById, enregistrerModele, dupliquerModele, supprimerModele,
         repartition, dureeEstimee,
         instancier, seanceById, seancesDe, ajouterExercice, retirerExercice,
         noterSerie, ecarts, terminer, reporterDansModele,
         investissement, avancement, meilleurePerf, jamaisFaits, derniereFois, seancesRecentes };
})();
