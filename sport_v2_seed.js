/* ============================================================================
   Coach by JM — Module Sport v2 · données réelles
   À charger APRÈS sport_v2_briques.js et sport_v2_core.js.

   Reprise contrôlée des deux fichiers Excel :
     — les 5 exercices absents du catalogue,
     — les 5 séances de la version 3 (à partir du 07/09/2026),
     — la semaine type dimanche → jeudi, repos vendredi et samedi,
     — les 5 séances réellement faites du 01 au 06/09, en séances libres.

   Rien n'est deviné : chaque charge, chaque rep et chaque RPE vient du fichier.
   Les séances du 1er au 6 n'ont pas de modèle derrière — Muscu A n'existait pas
   encore, et les machines n'étaient pas les mêmes.
   ========================================================================= */

const SportSeed = (function () {

const VERSION = 'v3-2026-09-07';

/* --- 1. Les exercices qui manquaient -------------------------------------- */

const EXERCICES = [
  { id:'chest-press', nom:'Chest press', emoji:'🤜', cat:'pec', famille:'haut',
    metriques:['series','reps','charge'], charges:true,
    desc:"Machine de développé assis. Dos plaqué, coudes à 45° du buste, on ne verrouille pas les coudes en fin de poussée." },
  { id:'poulie-haute-bodyguard', nom:'Poulie haute bodyguard', emoji:'🎏', cat:'dos', famille:'haut',
    metriques:['series','reps','charge'], charges:true,
    desc:"Tirage à la poulie haute sur la Bodyguard. Machine différente du lat pulldown : les charges ne se comparent pas entre les deux." },
  { id:'curl-biceps-ez', nom:'Curl biceps EZ', emoji:'💪', cat:'bras', famille:'haut',
    metriques:['series','reps','charge'], charges:true,
    desc:"Barre EZ. Peser la barre à vide une fois pour toutes, sinon le tonnage est faux." },
  { id:'pec-deck', nom:'Pec deck', emoji:'🦋', cat:'pec', famille:'haut',
    metriques:['series','reps','charge'], charges:true,
    desc:"Écarté machine. Mouvement d'ouverture, pas de poussée : on cherche l'étirement, pas la charge." },
  { id:'leg-press-inclinee', nom:'Leg press inclinée à disques', emoji:'🦵', cat:'jambes', famille:'bas',
    metriques:['series','reps','charge'], charges:true,
    desc:"Presse inclinée chargée en disques. Distincte de la presse horizontale à colonne : les charges ne sont pas comparables." }
];

/* --- 2. Les cinq séances de la version 3 ---------------------------------- */

const A = () => SportBriques.briqueListe('Assouplissements', SportBriques.LISTE_ASSOUPLISSEMENTS);
const ex = (exId, nom, c) => SportBriques.briqueExercice(exId, nom, c);
const bc = c => SportBriques.blocCardio(c);

/* L'échauffement général au tapis est commun aux trois séances de muscu. */
const echauffementTapis = () => SportBriques.briqueCardio('Échauffement général', [
  bc({ nom:'Tapis', exId:'marche-en-pente-tapis', duree:480,
       reglage:{ vitesse:5, pente:2 }, rpeCible:3, fcMax:100 }) ]);

function modeles() {
  return [

  { id:'m201', nom:'Cardio long, 3 machines', type:'cardio', icone:'🚴', couleur:'#00b4d8',
    version:1, format:2, briques:[
      SportBriques.briqueCardio('Cardio long', [
        bc({ nom:'Échauffement — Tapis', exId:'marche-en-pente-tapis', duree:300,
             reglage:{ vitesse:4.5, pente:0 }, rpeCible:3, fcMax:100 }),
        bc({ nom:'Bloc 1 — Tapis', exId:'marche-en-pente-tapis', duree:900,
             reglage:{ vitesse:5, pente:7 }, rpeCible:6, fcMin:115, fcMax:125 }),
        bc({ nom:'Bloc 2 — Elliptique', exId:'elliptique', duree:900,
             reglage:{ resistance:'modérée' }, rpeCible:6, fcMin:115, fcMax:125 }),
        bc({ nom:'Bloc 3 — Rameur', exId:'rameur', duree:600,
             reglage:{ cadence:'22-24 coups/mn' }, rpeCible:6, fcMin:115, fcMax:125 }),
        bc({ nom:'Retour au calme — Tapis', exId:'marche-en-pente-tapis', duree:300,
             reglage:{ vitesse:4, pente:0 }, rpeCible:2, fcMax:100 })
      ]),
      A() ] },

  { id:'m202', nom:'Muscu A — jambes + gainage', type:'musculation', icone:'🏋️', couleur:'#c0616a',
    version:1, format:2, briques:[
      echauffementTapis(),
      ex('presse-a-cuisses','Leg press horizontale',
         { charge:85, repsMin:10, repsMax:12, repos:120, increment:5,
           echauffement:{ charge:45, reps:8 } }),
      ex('leg-curl-couche','Leg curl', { charge:15, repsMin:10, repsMax:12, repos:90 }),
      ex('leg-extension','Leg extension', { charge:null, repsMin:10, repsMax:12, repos:90 }),
      ex('mollets-machine','Mollets à la presse', { charge:null, repsMin:12, repsMax:15, repos:60 }),
      ex('gainage-planche','Gainage planche',
         { charge:0, repsMin:25, repsMax:40, repos:60, unite:'secondes',
           progression:'reps_seules', rpeAttendu:[7,7,8] }),
      ex('gainage-lateral','Planche latérale',
         { series:2, charge:0, repsMin:20, repsMax:30, repos:60, unite:'secondes',
           progression:'reps_seules', rpeAttendu:[7,8] }),
      A() ] },

  { id:'m203', nom:'Muscu B — tirage', type:'musculation', icone:'🏋️', couleur:'#c0616a',
    version:1, format:2, briques:[
      echauffementTapis(),
      ex('tirage-vertical','Lat pulldown',
         { charge:35, repsMin:8, repsMax:10, repos:90, echauffement:{ charge:17.5, reps:8 } }),
      ex('tirage-horizontal','Rowing poulie basse',
         { charge:32.5, repsMin:10, repsMax:12, repos:90, echauffement:{ charge:15, reps:8 } }),
      ex('poulie-haute-bodyguard','Poulie haute bodyguard',
         { charge:30, repsMin:10, repsMax:12, repos:90 }),
      ex('curl-biceps-ez','Curl biceps EZ', { charge:0, repsMin:10, repsMax:12, repos:60 }),
      ex('curl-marteau','Curl marteau', { charge:6, repsMin:10, repsMax:12, repos:60 }),
      ex('oiseau-halteres','Oiseau / arrière d\'épaule',
         { charge:4, repsMin:12, repsMax:15, repos:60, progression:'reps_seules' }),
      A() ] },

  { id:'m204', nom:'Cardio qualité', type:'cardio', icone:'⚡', couleur:'#f4c20d',
    version:1, format:2, briques:[
      SportBriques.briqueCardio('Tapis — 5 blocs en pente', [
        bc({ nom:'Échauffement', exId:'marche-en-pente-tapis', duree:480,
             reglage:{ vitesse:4.5, pente:1 }, rpeCible:4 }),
        bc({ nom:'Bloc 1', exId:'marche-en-pente-tapis', duree:180,
             reglage:{ vitesse:5.2, pente:8 }, rpeCible:8, fcMin:130, fcMax:140 }),
        bc({ nom:'Récup 1', exId:'marche-en-pente-tapis', duree:120,
             reglage:{ vitesse:4.5, pente:0 }, rpeCible:3 }),
        bc({ nom:'Bloc 2', exId:'marche-en-pente-tapis', duree:180,
             reglage:{ vitesse:5.2, pente:8 }, rpeCible:8, fcMin:130, fcMax:140 }),
        bc({ nom:'Récup 2', exId:'marche-en-pente-tapis', duree:120,
             reglage:{ vitesse:4.5, pente:0 }, rpeCible:3 }),
        bc({ nom:'Bloc 3', exId:'marche-en-pente-tapis', duree:180,
             reglage:{ vitesse:5.2, pente:8 }, rpeCible:8, fcMin:130, fcMax:140 }),
        bc({ nom:'Récup 3', exId:'marche-en-pente-tapis', duree:120,
             reglage:{ vitesse:4.5, pente:0 }, rpeCible:3 }),
        bc({ nom:'Bloc 4', exId:'marche-en-pente-tapis', duree:180,
             reglage:{ vitesse:5.2, pente:8 }, rpeCible:8, fcMin:130, fcMax:140 }),
        bc({ nom:'Récup 4', exId:'marche-en-pente-tapis', duree:120,
             reglage:{ vitesse:4.5, pente:0 }, rpeCible:3 }),
        bc({ nom:'Bloc 5', exId:'marche-en-pente-tapis', duree:180,
             reglage:{ vitesse:5.2, pente:8 }, rpeCible:8, fcMin:130, fcMax:140 }),
        bc({ nom:'Retour au calme', exId:'marche-en-pente-tapis', duree:420,
             reglage:{ vitesse:4.2, pente:0 }, rpeCible:2 })
      ]),
      ex('gainage-planche','Gainage planche',
         { charge:0, repsMin:30, repsMax:30, repos:60, unite:'secondes', progression:'reps_seules' }),
      ex('gainage-lateral','Planche latérale',
         { series:2, charge:0, repsMin:20, repsMax:20, repos:60, unite:'secondes', progression:'reps_seules' }),
      A() ] },

  { id:'m205', nom:'Muscu C — poussée', type:'musculation', icone:'🏋️', couleur:'#c0616a',
    version:1, format:2, briques:[
      echauffementTapis(),
      ex('chest-press','Chest press',
         { charge:30, repsMin:8, repsMax:10, repos:120, echauffement:{ charge:15, reps:8 } }),
      ex('developpe-militaire','Développé épaules',
         { charge:15, repsMin:8, repsMax:10, repos:90, echauffement:{ charge:7.5, reps:8 } }),
      ex('pec-deck','Pec deck', { charge:null, repsMin:10, repsMax:12, repos:90 }),
      ex('extension-triceps-poulie','Triceps poulie', { charge:7.5, repsMin:10, repsMax:12, repos:60 }),
      ex('elevations-laterales','Élévations latérales',
         { charge:4, repsMin:12, repsMax:15, repos:60, progression:'reps_seules' }),
      ex('gainage-planche','Gainage planche',
         { charge:0, repsMin:30, repsMax:45, repos:60, unite:'secondes', progression:'reps_seules' }),
      A() ] }
  ];
}

/* Dimanche → jeudi. Vendredi et samedi : repos. */
const SEMAINE_TYPE = { 0:'m201', 1:'m202', 2:'m203', 3:'m204', 4:'m205' };

/* --- 3. Ce qui a réellement été fait du 1er au 6 septembre ------------------
   Séances libres, sans modèle : la version 3 démarre le 7, et les machines
   n'étaient pas les mêmes (presse inclinée le 1er, horizontale le 5). */

const s = (charge, reps, rpe, note) => ({ charge, reps, rpe, fait:true, note: note || '' });
const palier = (mn, vitesse, pente, fc) => ({ duree: mn*60, reglage:{ vitesse, pente },
                                              fcRelevee: fc ?? null, dureeReelle: mn*60, fait:true });

const REALISE = [
  { date:'2026-09-01', nom:'Tapis + haut du corps', type:'musculation', duree:75, briques:[
    { nature:'cardio', nom:'Tapis', blocs:[
      palier(5,4.5,0,78), palier(5,5,5,95), palier(5,5,7,100), palier(3,5,15,137), palier(7,4.5,0,85) ] },
    { nature:'exercice', exId:'leg-press-inclinee', nom:'Leg press inclinée à disques',
      series:[ s(60,10,5), s(80,10,6), s(120,10,8) ] },
    { nature:'exercice', exId:'chest-press', nom:'Chest press',
      series:[ s(15,10,2), s(25,10,5), s(35,10,8) ] },
    { nature:'exercice', exId:'tirage-horizontal', nom:'Rowing poulie basse',
      series:[ s(30,10,5), s(40,10,8) ] },
    { nature:'exercice', exId:'tirage-vertical', nom:'Lat pulldown',
      series:[ s(40,10,8) ] },
    { nature:'liste', nom:'Assouplissements', tous:true }
  ] },

  { date:'2026-09-02', nom:'Tapis + haut du corps', type:'musculation', duree:70, briques:[
    { nature:'cardio', nom:'Tapis', blocs:[
      palier(4,4.5,0), palier(8,5,6,114), palier(3,4.5,0) ] },
    { nature:'exercice', exId:'developpe-militaire', nom:'Développé épaules',
      series:[ s(20,12,8), s(20,12,10) ] },
    { nature:'exercice', exId:'tirage-horizontal', nom:'Rowing poulie basse',
      series:[ s(30,12,6), s(40,12,10), s(30,12,10) ] },
    { nature:'exercice', exId:'leg-curl-couche', nom:'Leg curl',
      series:[ s(20,12,6), s(20,12,10), s(15,12,10) ] },
    { nature:'exercice', exId:'curl-biceps-ez', nom:'Curl biceps EZ',
      series:[ s(0,12,8,'à vide'), s(0,12,8,'à vide'), s(0,12,8,'à vide') ] },
    { nature:'exercice', exId:'extension-triceps-poulie', nom:'Triceps',
      series:[ s(10,12,8), s(10,12,10,'tremblement') ] }
  ] },

  { date:'2026-09-03', nom:'Tapis — montée en pente', type:'cardio', duree:40, briques:[
    { nature:'cardio', nom:'Tapis', blocs:[
      palier(5,4.5,0), palier(5,5,5), palier(5,5.2,7),
      palier(5,5.2,8,130), palier(15,5.2,8,143), palier(5,4.5,0,102) ] }
  ] },

  { date:'2026-09-05', nom:'Tapis + jambes et épaules', type:'musculation', duree:65, briques:[
    { nature:'cardio', nom:'Tapis', blocs:[
      palier(5,4.5,0), palier(7,5,5,105), palier(3,4.5,0,85) ] },
    { nature:'exercice', exId:'presse-a-cuisses', nom:'Leg press horizontale',
      series:[ s(70,12,4), s(90,12,6), s(100,12,8) ] },
    { nature:'exercice', exId:'poulie-haute-bodyguard', nom:'Poulie haute bodyguard',
      series:[ s(40,12,10), s(30,12,8), s(35,12,10) ] },
    { nature:'exercice', exId:'elevations-laterales', nom:'Élévations latérales',
      series:[ s(5,12,8), s(5,12,10), s(5,8,10) ] }
  ] },

  { date:'2026-09-06', nom:'Marche 7 km', type:'marche', duree:80, briques:[
    { nature:'cardio', nom:'Marche', blocs:[
      { nom:'Marche extérieure', exId:'marche-rapide', duree:4800, reglage:{ distance:'7 km' },
        dureeReelle:4800, fait:true } ] }
  ] }
];

/* --- Application ----------------------------------------------------------- */

function appliquer(S, options = {}) {
  const etat = S.etat(), hist = S.hist();
  if (etat.seed === VERSION && !options.force) return { deja: true };

  /* Les exercices manquants rejoignent le catalogue de l'utilisateur. */
  const connus = new Set(S.catalogue().map(e => e.id));
  let nEx = 0;
  for (const e of EXERCICES) {
    if (connus.has(e.id)) continue;
    S.creerExercice({ ...e, phases: [], phaseCourante: 1, objectifs: [] });
    nEx++;
  }

  /* Les cinq séances. On remplace celles du même identifiant, on garde le reste
     — les modèles créés à la main ne sont jamais écrasés. */
  const nouveaux = modeles();
  const ids = new Set(nouveaux.map(m => m.id));
  etat.modeles = etat.modeles.filter(m => !ids.has(m.id)).concat(nouveaux);
  etat.semaineType = { ...SEMAINE_TYPE };
  etat.debut = etat.debut || '2026-09-01';

  /* Les séances réellement faites, en libres. Idempotent : on n'écrit pas deux
     fois la même date. */
  let nS = 0;
  for (const r of REALISE) {
    if (hist.seances.some(x => x.date === r.date && x.statut === 'terminee')) continue;
    const seance = {
      id: 's' + (hist.prochainId++), date: r.date, modeleId: null, format: 2,
      nomAffiche: r.nom, type: r.type, couleur: '#9a7878', statut: 'terminee',
      dureeReelle: r.duree, courbatures: null, sommeil: null, gene: null,
      remarques: 'Repris du suivi Excel', termineeLe: Date.now(),
      briques: r.briques.map(b => {
        if (b.nature === 'cardio') {
          return { id: SportBriques.nouvelId('b'), nature: 'cardio', nom: b.nom,
                   blocs: b.blocs.map(x => ({ id: SportBriques.nouvelId('c'), fcRelevee: null,
                                              rpeCible: null, fcMin: null, fcMax: null, ...x })),
                   fait: true };
        }
        if (b.nature === 'liste') {
          return { id: SportBriques.nouvelId('b'), nature: 'liste', nom: b.nom,
                   items: SportBriques.LISTE_ASSOUPLISSEMENTS.map(t => ({ texte: t, fait: !!b.tous })),
                   fait: true };
        }
        const reps = b.series.map(x => x.reps);
        return { id: SportBriques.nouvelId('b'), nature: 'exercice', exId: b.exId, nom: b.nom,
                 series: b.series, repsMin: Math.min(...reps), repsMax: Math.max(...reps),
                 charge: b.series[b.series.length - 1].charge,
                 repos: 90, progression: 'reps_puis_charge', increment: 5,
                 echauffement: null, note: '', fait: true };
      })
    };
    hist.seances.push(seance); nS++;
  }

  etat.seed = VERSION;
  localStorage.setItem('mc_sport_v2', JSON.stringify(etat));
  localStorage.setItem('mc_hist_v2', JSON.stringify(hist));
  return { exercices: nEx, modeles: nouveaux.length, seances: nS };
}

return { VERSION, EXERCICES, modeles, SEMAINE_TYPE, REALISE, appliquer };
})();
if (typeof window !== 'undefined') window.SportSeed = SportSeed;
