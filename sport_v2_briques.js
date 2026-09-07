/* ============================================================================
   Coach by JM — Module Sport v2 · le modèle de briques
   À charger APRÈS sport_catalogue.js et AVANT sport_v2_core.js.

   Une séance n'est pas une liste d'exercices : c'est une suite de briques de
   trois natures différentes. « Cardio » est un enchaînement de machines,
   « Leg press » un exercice à séries, « Assouplissements » une liste à cocher.
   Les forcer dans un moule unique déformait les deux premières.
   ========================================================================= */

const SportBriques = (function () {

/* --- Vocabulaire ---------------------------------------------------------- */

/* Cinq types, larges. Ils servent aux couleurs du calendrier et à proposer un
   remplacement du même genre — ils ne contraignent pas le contenu. Le nom de
   la séance porte la précision : « Muscu A — jambes » est ton nom, pas une
   catégorie imposée. */
const TYPES = [
  { id: 'musculation', nom: 'Musculation', emoji: '🏋️', couleur: '#c0616a' },
  { id: 'cardio',      nom: 'Cardio',      emoji: '🚴', couleur: '#00b4d8' },
  { id: 'mobilite',    nom: 'Mobilité',    emoji: '🧘', couleur: '#7b3fe0' },
  { id: 'marche',      nom: 'Marche',      emoji: '🚶', couleur: '#8ab17d' },
  { id: 'sport',       nom: 'Sport',       emoji: '🎾', couleur: '#c4691c' }
];

const NATURES = {
  cardio:   { nom: 'Bloc cardio',    emoji: '🚴', desc: 'machines et durées' },
  exercice: { nom: 'Exercice',       emoji: '🏋️', desc: 'séries, charge, reps' },
  liste:    { nom: 'Liste à cocher', emoji: '🧘', desc: 'étirements, rappels' }
};

const PROGRESSIONS = {
  reps_puis_charge: 'Reps puis charge',
  reps_seules:      'Reps seules',
  aucune:           'Aucune'
};

const RPE_PLAFOND = 8;

let _seq = 0;
const nouvelId = p => p + Date.now().toString(36) + (_seq++).toString(36);

/* --- Construction des briques --------------------------------------------- */

/* Une brique peut rester incomplète : « charge à établir » est un état
   légitime, la séance reste utilisable et se règle en salle. */
function briqueExercice(exId, nom, champs = {}) {
  return {
    id: nouvelId('b'), nature: 'exercice', exId, nom,
    series: 3, repsMin: 10, repsMax: 12,
    unite: 'reps',                // 'reps' ou 'secondes' (gainage)
    charge: null,                 // null = à établir
    echauffement: null,           // { charge, reps } ou null
    repos: 90,
    rpeAttendu: [6, 7, 8],
    progression: 'reps_puis_charge',
    increment: 5,
    note: '',
    ...champs
  };
}

function briqueCardio(nom, blocs = []) {
  return { id: nouvelId('b'), nature: 'cardio', nom: nom || 'Cardio', blocs };
}

/* Un bloc cardio : la machine, ce qu'on y règle, et la FC qu'on vise. */
function blocCardio(champs = {}) {
  return {
    id: nouvelId('c'), nom: 'Bloc', exId: null,
    duree: 300,                   // secondes
    reglage: {},                  // { vitesse, pente, resistance, cadence }
    rpeCible: null,
    fcMin: null, fcMax: null,
    ...champs
  };
}

function briqueListe(nom, items = []) {
  return {
    id: nouvelId('b'), nature: 'liste', nom: nom || 'Liste',
    items: items.map(t => (typeof t === 'string' ? { texte: t } : t))
  };
}

const LISTE_ASSOUPLISSEMENTS = [
  'Chat / vache à quatre pattes : 8 répétitions lentes',
  "Position de l'enfant : 30 s × 2",
  'Fléchisseur de hanche : 30 s de chaque côté',
  'Arrière des cuisses : 30 s de chaque côté',
  'Fessiers : 30 s de chaque côté'
];

function nouveauModele(champs = {}) {
  return {
    id: nouvelId('m'), nom: 'Nouvelle séance', type: 'musculation',
    couleur: '#c0616a', icone: '🏋️',
    briques: [], version: 1, format: 2,
    creeLe: Date.now(), majLe: Date.now(),
    ...champs
  };
}

/* --- Ce qu'une brique vaut ------------------------------------------------- */

const estAEtablir = b => b.nature === 'exercice' && (b.charge == null || b.charge === 'a_etablir');

/* Dans un modèle, `series` est un nombre ; dans une séance instanciée, c'est le
   tableau des séries réalisées. Toujours passer par ici. */
const nbSeries = b => Array.isArray(b.series) ? b.series.length : (b.series || 3);

function briquePrete(b) {
  if (b.nature === 'exercice') return !estAEtablir(b);
  if (b.nature === 'cardio')   return b.blocs.length > 0 && b.blocs.every(x => x.duree > 0);
  return b.items.length > 0;
}

function resumeBrique(b) {
  if (b.nature === 'exercice') {
    const r = b.repsMin === b.repsMax ? b.repsMin : b.repsMin + '-' + b.repsMax;
    const u = b.unite === 'secondes' ? ' s' : '';
    if (b.unite === 'secondes' && !b.charge) return nbSeries(b) + ' × ' + r + u;
    const c = estAEtablir(b) ? 'charge à établir' : b.charge + ' kg';
    return nbSeries(b) + ' × ' + r + u + ' · ' + c;
  }
  if (b.nature === 'cardio') {
    const mn = Math.round(b.blocs.reduce((a, x) => a + (x.duree || 0), 0) / 60);
    return b.blocs.length + ' machine' + (b.blocs.length > 1 ? 's' : '') + ' · ' + mn + ' mn';
  }
  return b.items.length + ' élément' + (b.items.length > 1 ? 's' : '');
}

/* Durée estimée. Le repos compte, c'est lui qui fait la longueur d'une séance
   de musculation — trois séries de leg press, c'est six minutes d'attente. */
function dureeModele(m) {
  let s = 0;
  for (const b of m.briques || []) {
    if (b.nature === 'exercice') {
      const travail = (b.repsMax || 10) * 3;
      s += nbSeries(b) * (travail + (b.repos || 90));
      if (b.echauffement) s += (b.echauffement.reps || 8) * 3 + 60;
    } else if (b.nature === 'cardio') {
      s += b.blocs.reduce((a, x) => a + (x.duree || 0), 0);
    } else {
      s += b.items.length * 45;
    }
  }
  return Math.round(s / 60);
}

/* Le tonnage n'a de sens que là où charge × répétitions en a un. Ni les
   secondes de gainage, ni le cardio, ni les listes n'y entrent — et
   l'échauffement non plus, c'est la règle de ton fichier. */
const compteAuTonnage = b => b.nature === 'exercice' && b.unite !== 'secondes'
                             && !estAEtablir(b) && (b.charge || 0) > 0;

function tonnagePrevu(m) {
  let t = 0;
  for (const b of m.briques || []) {
    if (!compteAuTonnage(b)) continue;
    t += nbSeries(b) * (b.repsMin || 10) * (b.charge || 0);
  }
  return t;
}

/* --- Instancier : le modèle est copié, jamais partagé ---------------------- */

function instancierBriques(m) {
  return (m.briques || []).map(b => {
    if (b.nature === 'exercice') {
      const series = [];
      for (let i = 0; i < nbSeries(b); i++) {
        series.push({
          charge: estAEtablir(b) ? null : b.charge,
          reps: null,                                  // à saisir
          repsPrevu: b.repsMin,
          rpeAttendu: (b.rpeAttendu || [])[i] ?? null,
          rpe: null, fait: false, note: ''
        });
      }
      /* Le nom est recopié : une séance terminée doit rester lisible même si
         l'exercice est renommé ou retiré du catalogue plus tard. */
      return { ...structuredClone(b), nom: b.nom, series,
               echauffementFait: false, fait: false };
    }
    if (b.nature === 'cardio') {
      return { ...structuredClone(b),
               blocs: b.blocs.map(x => ({ ...structuredClone(x), fcRelevee: null,
                                          dureeReelle: null, fait: false })),
               fait: false };
    }
    return { ...structuredClone(b),
             items: b.items.map(i => ({ ...i, fait: false })), fait: false };
  });
}

/* --- Ce qui a été fait ----------------------------------------------------- */

/* Le tonnage n'a de sens que là où une charge est déplacée un nombre de fois.
   Des secondes de gainage, des minutes de tapis ou une case cochée n'y entrent
   pas — les additionner produirait un chiffre qui ne veut rien dire. */
const compteDansTonnage = b => b.nature === 'exercice'
  && b.tonnage !== false && b.unite !== 'secondes'
  && (b.series || []).some(s => (s.charge || 0) > 0);

function tonnageReel(seance) {
  let t = 0;
  for (const b of seance.briques || []) {
    if (!compteDansTonnage(b)) continue;
    for (const s of b.series) if (s.fait) t += (s.charge || 0) * (s.reps || 0);
  }
  return t;
}

function comptesSeance(seance) {
  let faites = 0, total = 0, rpes = [];
  for (const b of seance.briques || []) {
    if (b.nature === 'exercice') {
      total += b.series.length;
      for (const s of b.series) { if (s.fait) faites++; if (s.rpe != null) rpes.push(s.rpe); }
    } else if (b.nature === 'cardio') {
      total += b.blocs.length;
      faites += b.blocs.filter(x => x.fait).length;
    } else {
      total += b.items.length;
      faites += b.items.filter(x => x.fait).length;
    }
  }
  return { faites, total,
           rpeMoyen: rpes.length ? Math.round(rpes.reduce((a, b) => a + b, 0) / rpes.length * 10) / 10 : null,
           tonnage: tonnageReel(seance) };
}

/* --- La double progression -------------------------------------------------
   La règle de ton fichier : on garde la même charge tant que les trois séries
   de travail ne sont pas au haut de la fourchette sans dépasser 8/10. Quand
   c'est fait, et seulement alors, on monte d'un cran et on repart en bas.
   L'app fait ce que le tableur ne peut pas : te le dire avant la série, pas
   après. */
function verdictProgression(brique, dernieres) {
  if (!brique || brique.nature !== 'exercice') return null;
  if (brique.progression === 'aucune') return null;

  const attendues = nbSeries(brique);          // ce que le MODÈLE demande
  /* Le message de démarrage dépend de ce qu'on mesure : chercher « la charge »
     n'a aucun sens sur un gainage qui se compte en secondes. */
  const enSecondes = brique.unite === 'secondes';
  const sansCharge = brique.progression === 'reps_seules' || brique.charge === 0;
  const debut = { action: 'inchange',
    texte: enSecondes
      ? `Première fois — vise ${brique.repsMin} s et arrête-toi avant que la position se dégrade.`
      : sansCharge
        ? `Première fois — reste léger et monte les répétitions jusqu'à ${brique.repsMax}.`
        : `Première fois — trouve la charge qui donne 8/10 à la ${attendues}e série.` };
  if (!dernieres || !dernieres.series || !dernieres.series.length) return debut;

  const faites = dernieres.series.filter(s => s.fait);
  if (!faites.length) return debut;

  /* Une seule série réussie ne prouve rien. On exige le compte du modèle,
     pas celui de la dernière fois — sinon une série isolée déclenche une
     hausse. */
  if (faites.length < attendues) {
    return { action: 'inchange',
             texte: `Seulement ${faites.length} série${faites.length > 1 ? 's' : ''} la dernière fois sur ${attendues} attendues. Refais la séance complète avant de monter.` };
  }

  /* Des charges qui varient d'une série à l'autre, ce sont des séries
     montantes : elles ne se comparent pas d'une semaine sur l'autre, et c'est
     précisément ce que la charge fixe corrige. */
  const charges = faites.map(s => s.charge);
  const memeCharge = charges.every(c => c === charges[0]);
  if (!memeCharge) {
    return { action: 'inchange',
             texte: `Séries montantes la dernière fois (${charges.join(', ')} kg). Fixe une charge sur les ${attendues} séries pour pouvoir comparer.` };
  }

  const charge = charges[0];
  const rpeMax = Math.max(...faites.map(s => s.rpe ?? 0));

  /* Une charge nulle ou inconnue — une barre à vide jamais pesée — ne peut pas
     servir de base à une progression chiffrée. */
  if (!(charge > 0) && brique.progression !== 'reps_seules') {
    return { action: 'peser',
             texte: 'Charge non renseignée. Pèse la barre une fois, sinon la progression et le tonnage sont faux.' };
  }

  const auHaut = faites.every(s => (s.reps || 0) >= brique.repsMax);

  if (auHaut && rpeMax <= RPE_PLAFOND) {
    if (brique.progression === 'reps_seules') {
      return { action: 'reps', repsMax: brique.repsMax + 3,
               texte: `${attendues} × ${brique.repsMax} atteint à ${rpeMax}/10 — monte la fourchette à ${brique.repsMax + 3} reps, pas les kilos.` };
    }
    const suivante = charge + (brique.increment || 5);
    return { action: 'charge', charge: suivante, reps: brique.repsMin,
             texte: `${attendues} × ${brique.repsMax} à ${charge} kg, RPE max ${rpeMax} — passe à ${suivante} kg et repars à ${brique.repsMin} reps.` };
  }
  if (rpeMax > RPE_PLAFOND) {
    return { action: 'inchange',
             texte: `RPE ${rpeMax}/10 la dernière fois, au-dessus du plafond. Garde ${charge} kg et vise le bas de la fourchette.` };
  }
  const meilleur = Math.max(...faites.map(s => s.reps || 0));
  return { action: 'inchange',
           texte: `${charge} kg — tu en étais à ${meilleur} reps sur ${brique.repsMax}. Même charge, une rep de plus si possible.` };
}

/* --- Conversion des anciens modèles ---------------------------------------
   Les neuf séances actuelles sont en blocs échauffement / corps / retour au
   calme. On les convertit sans rien perdre : le cardio devient un bloc, les
   étirements de fin une liste, le reste des exercices. */
const TYPE_ANCIEN = {
  force: 'musculation', volume: 'musculation', renfo: 'musculation',
  endurance: 'cardio', intervalles: 'cardio', marche: 'marche',
  mobilite: 'mobilite', padel: 'sport', golf: 'sport'
};

function convertirModele(ancien, catalogue) {
  const parId = new Map(catalogue.map(e => [e.id, e]));
  const type = TYPE_ANCIEN[ancien.type] || 'musculation';
  const t = TYPES.find(x => x.id === type);
  const briques = [];
  let listeFin = null;

  for (const bloc of ancien.blocs || []) {
    for (const ligne of bloc.exercices || []) {
      const e = parId.get(ligne.exId);
      if (!e) continue;
      const m = e.metriques || [];
      const doux = e.cat === 'souplesse' || e.cat === 'mobilite';
      /* Une activité qui se mesure en durée sans séries — un parcours de golf,
         un match, un bloc de tapis — est un bloc cardio, pas un exercice. */
      const cardio = e.cat === 'cardio' || m.includes('vitesse') || m.includes('fc')
                     || (m.includes('duree') && !m.includes('series'));
      /* Un corps de séance entièrement fait d'étirements est une liste. */
      const toutDoux = (bloc.exercices || []).length >= 3
        && bloc.exercices.every(l => { const x = parId.get(l.exId);
             return x && (x.cat === 'souplesse' || x.cat === 'mobilite'); });

      if (doux && (bloc.type !== 'corps' || toutDoux)) {
        if (!listeFin) listeFin = briqueListe(bloc.type === 'echauffement' ? 'Échauffement'
                                    : bloc.type === 'corps' ? 'Mobilité' : 'Assouplissements');
        listeFin.items.push({ texte: e.nom, exId: e.id });
        continue;
      }
      if (cardio) {
        briques.push(briqueCardio(e.nom, [blocCardio({
          nom: e.nom, exId: e.id, duree: ligne.duree || 900,
          reglage: {}, fcMin: null, fcMax: null })]));
        continue;
      }
      briques.push(briqueExercice(e.id, e.nom, {
        unite: (e.metriques || []).includes('duree') && !(e.metriques || []).includes('reps')
               ? 'secondes' : 'reps',
        series: ligne.series || 3,
        repsMin: ligne.reps || 10, repsMax: (ligne.reps || 10) + 2,
        charge: ligne.charge ?? null,
        repos: e.charges ? 120 : 60
      }));
    }
    if (listeFin) { briques.push(listeFin); listeFin = null; }
  }
  if (listeFin) briques.push(listeFin);

  return { id: ancien.id, nom: ancien.nom, type, couleur: t.couleur, icone: t.emoji,
           briques, version: (ancien.version || 1) + 1, format: 2,
           legacy: ancien.legacy, creeLe: Date.now(), majLe: Date.now() };
}

const estFormat2 = m => m && m.format === 2 && Array.isArray(m.briques);

return { TYPES, NATURES, PROGRESSIONS, RPE_PLAFOND, LISTE_ASSOUPLISSEMENTS,
         nouvelId, nouveauModele,
         briqueExercice, briqueCardio, blocCardio, briqueListe,
         estAEtablir, nbSeries, compteAuTonnage, briquePrete, resumeBrique,
         dureeModele, tonnagePrevu, instancierBriques,
         tonnageReel, compteDansTonnage, comptesSeance, verdictProgression,
         convertirModele, estFormat2 };
})();
if (typeof window !== 'undefined') window.SportBriques = SportBriques;
