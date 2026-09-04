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
      debut: '2026-09-01',           // rien avant : le programme commence ici
      semaineType: { 0:'m105', 1:'m107', 2:'m101', 4:'m108', 5:'m103', 6:'m106' },
      planning:  []                  // { id, date:'YYYY-MM-DD', modeleId, ecart }
    };
    reprendreAncienModule();
    ecrire(K_ETAT, etat);
  }
  if (!hist) { hist = { seances: [], prochainId: 1 }; ecrire(K_HIST, hist); }

  /* Rattrapage des installations faites avant cette règle : on jette le
     planning hérité, qui n'était que du remplissage automatique. */
  if (!etat.debut) {
    etat.debut = '2026-09-01';
    etat.planning = (etat.planning || []).filter(p => p.ecart);
    sauverEtat();
  }
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
  /* On n'importe PAS v1.events : l'ancien module semait un mois de séances à
     l'avance (seedMonth). Ce n'était pas un planning, c'était du remplissage. */
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

/* --- Types de séance ------------------------------------------------------
   Neuf types en trois familles. Le repos n'en est pas un : c'est un état du
   calendrier, il n'a pas de contenu à ouvrir. */
const types    = () => window.SPORT_TYPES || [];
const typeById = id => types().find(t => t.id === id) || null;
function famillesType() {
  const out = [];
  for (const t of types()) {
    let f = out.find(x => x.nom === t.famille);
    if (!f) out.push(f = { nom: t.famille, types: [] });
    f.types.push(t);
  }
  return out;
}
const modelesDuType = id => etat.modeles.filter(m => m.type === id);
/* Les séances du même type, hors celle en cours : c'est ce que propose
   « Changer » quand tu n'as qu'une demi-heure. */
function alternatives(modeleId) {
  const m = modeleById(modeleId);
  return m ? modelesDuType(m.type).filter(x => x.id !== modeleId) : [];
}

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
    /* Le repos dépend de l'effort : rien après un étirement, longtemps après
       une série lourde. Sans ça une séance de mobilité s'estimait au double. */
    const repos = ex.cat === 'cardio' ? 0
                : (ex.cat === 'souplesse' || ex.cat === 'mobilite') ? 10
                : ex.charges ? 90 : 30;
    s += series * (travail + repos);
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
              nomAffiche: m.nom, couleur: m.couleur, type: m.type, statut: 'planifiee',
              exercices, dureeReelle: null, ressenti: null, commentaire: '' };
  hist.seances.push(s); sauverHist();
  return s;
}

const seanceById = id => hist.seances.find(s => s.id === id) || null;

/* --- Ce qui était prévu ---------------------------------------------------
   Le planning explicite l'emporte sur la semaine type. */
/* Ce qui est prévu n'existe que dans le présent et l'avenir. Le passé, lui,
   n'affiche que ce qui a réellement eu lieu : une séance non faite disparaît
   du calendrier au lieu d'y rester comme un reproche. */
function prevuLe(iso) {
  if (etat.debut && iso < etat.debut) return null;
  const p = etat.planning.find(x => x.date === iso);
  if (p) return p.modeleId;
  if (iso < new Date().toISOString().slice(0, 10)) return null;
  const jour = new Date(iso + 'T12:00').getDay();
  return etat.semaineType[jour] || null;
}
/* Ce que la semaine type dit d'un jour, sans borne de date. Sert à proposer
   une séance quand on déclare a posteriori, pas à peupler le calendrier. */
function trameDe(iso) {
  const jour = new Date(iso + 'T12:00').getDay();
  return etat.semaineType[jour] || null;
}
const estRepos = iso => !prevuLe(iso);

/* Les jours passés qui avaient une séance au programme et dont rien n'a été
   noté. C'est la matière du rattrapage groupé. */
function joursAConfirmer(depuis, jusqua) {
  if (etat.debut && depuis < etat.debut) depuis = etat.debut;
  const fin = jusqua || new Date().toISOString().slice(0, 10);
  const out = [];
  for (let d = new Date(depuis + 'T12:00'); d.toISOString().slice(0, 10) <= fin; d.setDate(d.getDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    if (seancesDe(iso).length) continue;
    const modeleId = prevuLe(iso) || trameDe(iso);
    if (modeleId && modeleById(modeleId)) out.push({ date: iso, modeleId });
  }
  return out;
}

/* --- État d'un jour, pour le calendrier -----------------------------------
   fait    : une séance terminée
   repos   : repos déclaré, ou rien au programme
   prevu   : une séance au programme, aujourd'hui ou plus tard
   manque  : c'était prévu, c'est passé, rien n'a été noté */
function etatJour(iso) {
  const auj = new Date().toISOString().slice(0, 10);
  const faites = seancesDe(iso);
  const terminee = faites.find(s => s.statut === 'terminee');
  const modeleId = prevuLe(iso);
  if (terminee) return { statut: 'fait', seance: terminee, modeleId: terminee.modeleId };
  if (faites.some(s => s.statut === 'repos')) return { statut: 'repos', modeleId: null };
  const enCours = faites.find(s => s.statut === 'en_cours' || s.statut === 'planifiee');
  if (enCours) return { statut: 'prevu', seance: enCours, modeleId: enCours.modeleId };
  if (!modeleId) return { statut: iso < auj ? 'vide' : 'repos', modeleId: null };
  return { statut: 'prevu', modeleId };
}

function moisJours(annee, mois) {
  const out = [], d = new Date(annee, mois, 1);
  while (d.getMonth() === mois) {
    const iso = new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    out.push({ jour: d.getDate(), iso, ...etatJour(iso) });
    d.setDate(d.getDate() + 1);
  }
  return out;
}

/* Semaine courante, du lundi au dimanche. */
function semaineDe(iso) {
  const d = new Date(iso + 'T12:00');
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const out = [];
  for (let i = 0; i < 7; i++) {
    const j = new Date(d.getTime() + i * 864e5).toISOString().slice(0, 10);
    out.push({ iso: j, ...etatJour(j) });
  }
  return out;
}

/* Remplacer la séance d'un jour. On note l'écart quand on change de type :
   changer de séance dans le même type n'en est pas un. */
function remplacerLeJour(iso, modeleId) {
  const avant = prevuLe(iso), a = avant && modeleById(avant), b = modeleById(modeleId);
  const ecart = !!(a && b && a.type !== b.type);
  const i = etat.planning.findIndex(p => p.date === iso);
  const entree = { id: 'p' + Date.now(), date: iso, modeleId, ecart };
  if (i < 0) etat.planning.push(entree); else etat.planning[i] = entree;
  sauverEtat();
  return entree;
}
/* Reporter au premier jour libre suivant, sans écraser ce qui est déjà prévu. */
function reporter(iso) {
  const modeleId = prevuLe(iso);
  if (!modeleId) return null;
  const d = new Date(iso + 'T12:00');
  for (let k = 1; k <= 7; k++) {
    d.setDate(d.getDate() + 1);
    const cible = d.toISOString().slice(0, 10);
    if (!prevuLe(cible) && !seancesDe(cible).length) {
      remplacerLeJour(cible, modeleId);
      marquerRepos(iso);
      return cible;
    }
  }
  return null;
}

/* Combien de fois la trame a-t-elle été contournée ce mois-ci. */
function ecartsDuMois(iso) {
  const p = (iso || new Date().toISOString().slice(0, 10)).slice(0, 7);
  return etat.planning.filter(x => x.ecart && x.date.slice(0, 7) === p).length;
}

function marquerRepos(iso) {
  const s = { id: 's' + (hist.prochainId++), date: iso, modeleId: null, type: 'repos',
              nomAffiche: 'Repos', statut: 'repos', exercices: [] };
  hist.seances.push(s); sauverHist();
  return s;
}

/* Séance passée pré-remplie : tout est considéré fait, aux valeurs prévues.
   Dans le cas courant — « je l'ai faite, j'ai juste oublié de la noter » —
   il n'y a plus qu'à valider. */
function instancierFaite(modeleId, date) {
  const s = instancier(modeleId, date);
  const cat = catalogue();
  for (const ex of s.exercices) {
    const e = cat.find(x => x.id === ex.exId); if (!e) continue;
    /* Ce qu'on enregistre vient des métriques de l'exercice, pas de sa
       catégorie : « Suspension à la barre » est un exercice de dos qui se
       mesure en secondes. Sans ça, son palier ne se déclenchait jamais. */
    const m = e.metriques || ['series','reps','charge'];
    const p = ex.prevu || {};
    const n = m.includes('series') ? (p.series || 3) : 1;
    for (let i = 0; i < n; i++) {
      const serie = {};
      if (m.includes('reps'))   serie.reps   = p.reps   || 8;
      if (m.includes('duree'))  serie.duree  = p.duree  || (m.includes('reps') ? 5 : 45);
      if (m.includes('charge')) serie.charge = p.charge ?? null;
      ex.series.push(serie);
    }
    ex.fait = true;
  }
  s.statut = 'en_cours';
  sauverHist();
  return s;
}
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
         types, typeById, famillesType, modelesDuType, alternatives,
         modeles, modeleById, enregistrerModele, dupliquerModele, supprimerModele,
         repartition, dureeEstimee,
         instancier, instancierFaite, seanceById, seancesDe, ajouterExercice, retirerExercice,
         prevuLe, trameDe, estRepos, joursAConfirmer, marquerRepos,
         etatJour, moisJours, semaineDe, remplacerLeJour, reporter, ecartsDuMois,
         noterSerie, ecarts, terminer, reporterDansModele,
         investissement, avancement, meilleurePerf, jamaisFaits, derniereFois, seancesRecentes };
})();
