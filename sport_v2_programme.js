/* ============================================================================
   Coach by JM — Module Sport v2 · Mon programme
   À charger APRÈS sport_v2_seance.js et AVANT sport_v2_accueil.js.
   Point d'entrée : SportProgramme.monter(el, { auFermer })

   Trois onglets : Objectifs, Séances, Exercices. C'est l'écran de
   configuration — celui qu'on ouvre le dimanche soir, pas en arrivant à la
   salle. Les exercices sont délégués à la banque, qui existe déjà.
   ========================================================================= */

const SportProgramme = (function () {

const S = SportV2;
const B = () => window.SportBriques;
let hote = null, auFermer = null, onglet = 'seances', ecran = 'racine', ctx = {};
const PILE = [];

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

const typeDe = m => S.typeById(m && m.type) || { emoji: '📋', couleur: '#c0616a', nom: '' };
const aujourdhui = () => new Date().toISOString().slice(0, 10);

/* =========================================================================
   ONGLET SÉANCES — la grille par famille
   ====================================================================== */

function vueSeances() {
  const familles = S.famillesType().map(f => {
    const tuiles = f.types.map(t => {
      const n = S.modelesDuType(t.id).length;
      return `<div class="cat-tile" onclick="SportProgramme.ouvrirType('${t.id}')">
        <span class="emoji">${t.emoji}</span>
        <div class="cname">${esc(t.nom)}</div>
        <div class="ccount">${n} séance${n > 1 ? 's' : ''}</div></div>`;
    }).join('');
    return `<div class="pg-fam">${esc(f.nom)}</div><div class="cat-grid">${tuiles}</div>`;
  }).join('');

  const orphelines = S.modeles().filter(m => !S.typeById(m.type));
  return `
  ${familles}
  ${orphelines.length ? `<div class="pg-fam">Sans type</div><div class="cat-grid">
    <div class="cat-tile" onclick="SportProgramme.ouvrirType(null)"><span class="emoji">📦</span>
      <div class="cname">Sans type</div><div class="ccount">${orphelines.length}</div></div></div>` : ''}
  <div class="cat-grid">
    <div class="cat-tile add" onclick="SportProgramme.creer()">
      <span class="emoji">➕</span><div class="cname">Nouvelle</div><div class="ccount">séance</div></div>
  </div>`;
}

function vueType(typeId) {
  const t = S.typeById(typeId);
  const liste = typeId ? S.modelesDuType(typeId) : S.modeles().filter(m => !S.typeById(m.type));

  const cartes = liste.map(m => {
    const n = S.nbElements(m);
    const ton = B().tonnagePrevu(m);
    const flou = (m.briques || []).filter(b => B().estAEtablir(b)).length;
    return `<div class="card sv-row" onclick="SportProgramme.ouvrirModele('${m.id}')">
      <span class="pg-ico" style="background:${typeDe(m).couleur}">${m.icone || '📋'}</span>
      <div class="sv-grow"><div class="sv-nm">${esc(m.nom)}</div>
        <div class="sv-meta">${n} éléments · ~${S.dureeEstimee(m)} mn${
          ton ? ' · ' + ton.toLocaleString('fr') + ' kg' : ''}${
          flou ? ' · ' + flou + ' à définir' : ''}</div></div>
      <span class="sv-chev">›</span></div>`;
  }).join('') || `<div class="pg-empty">Aucune séance de ce type. Crée-en une.</div>`;

  return `
  ${entete((t ? t.emoji + ' ' + t.nom : 'Sans type'),
           `<button class="pg-cta" onclick="SportProgramme.creer('${typeId || ''}')">+ Créer</button>`)}
  ${cartes}`;
}

/* =========================================================================
   UN MODÈLE — la structure, brique par brique
   ====================================================================== */

const NAT = { exercice: ['🏋️','#c0616a'], cardio: ['🚴','#00b4d8'], liste: ['🧘','#7b3fe0'] };

function vueModele(id) {
  const m = S.modeleById(id);
  if (!m) return entete('Introuvable') + `<div class="pg-empty">Cette séance n'existe plus.</div>`;
  if (!Array.isArray(m.briques)) m.briques = [];

  const briques = m.briques.map((b, i) => {
    const [emo, coul] = NAT[b.nature] || NAT.exercice;
    const flou = B().estAEtablir(b);
    return `<div class="card sv-row${flou ? ' pg-flou' : ''}">
      <span class="pg-pas" style="background:${coul}">${emo}</span>
      <div class="sv-grow" onclick="SportProgramme.editerBrique('${id}',${i})">
        <div class="sv-nm">${esc(b.nom)}</div>
        <div class="sv-meta">${esc(B().resumeBrique(b))}</div></div>
      <div class="pg-ordre">
        <button onclick="SportProgramme.monterBrique('${id}',${i})">▲</button>
        <button onclick="SportProgramme.descendreBrique('${id}',${i})">▼</button>
      </div>
      <span class="sv-chev" onclick="SportProgramme.editerBrique('${id}',${i})">›</span></div>`;
  }).join('') || `<div class="pg-empty">Aucune brique. Pose d'abord la structure, tu détailleras ensuite.</div>`;

  const flous = m.briques.filter(b => B().estAEtablir(b)).length;
  const ton = B().tonnagePrevu(m);

  return `
  ${entete(m.nom, `<button class="pg-cta" onclick="SportProgramme.lancer('${id}')">Lancer</button>`)}
  <div class="sv-meta" style="margin:-4px 0 12px">${esc(typeDe(m).nom)} · ${S.nbElements(m)} éléments
    · ~${S.dureeEstimee(m)} mn${ton ? ' · ' + ton.toLocaleString('fr') + ' kg prévus' : ''}</div>
  ${flous ? `<div class="pg-info">${flous} brique${flous > 1 ? 's' : ''} à définir — la séance reste
    utilisable, tu régleras la charge en salle.</div>` : ''}
  ${briques}
  <div class="pg-lbl">Ajouter une brique</div>
  <div class="pg-chips">
    <button class="pg-chip" onclick="SportProgramme.ajouterExercice('${id}')">🏋️ Exercice</button>
    <button class="pg-chip" onclick="SportProgramme.ajouterCardio('${id}')">🚴 Bloc cardio</button>
    <button class="pg-chip" onclick="SportProgramme.ajouterListe('${id}')">🧘 Liste à cocher</button>
  </div>
  <div class="pg-lbl">La séance</div>
  <button class="pg-sec" onclick="SportProgramme.renommer('${id}')">✏️ Renommer et changer de type</button>
  <button class="pg-sec" onclick="SportProgramme.dupliquer('${id}')">⧉ Dupliquer</button>
  <button class="pg-suppr" onclick="SportProgramme.supprimer('${id}')">Supprimer cette séance</button>`;
}

/* --- Le détail d'une brique ------------------------------------------------ */

const CH = {
  series:  { lib: 'séries',       pas: 1,   min: 1 },
  repsMin: { lib: 'reps minimum', pas: 1,   min: 1 },
  repsMax: { lib: 'reps maximum', pas: 1,   min: 1 },
  charge:  { lib: 'kilos',        pas: 2.5, min: 0 },
  repos:   { lib: 's de repos',   pas: 15,  min: 0 },
  increment: { lib: 'kg par palier', pas: 2.5, min: 0.5 }
};
const molette = (champ, val, action) => `<div class="pg-step">
  <button onclick="${action}(${-CH[champ].pas})">−</button>
  <div class="v">${val == null ? '—' : val}<span class="u">${CH[champ].lib}</span></div>
  <button onclick="${action}(${CH[champ].pas})">+</button></div>`;

function vueBrique(id, i) {
  const m = S.modeleById(id); const b = m && m.briques[i];
  if (!b) return entete('Introuvable') + `<div class="pg-empty">Brique supprimée.</div>`;
  const a = `SportProgramme.pas('${id}',${i},`;

  if (b.nature === 'exercice') {
    const sec = b.unite === 'secondes';
    return `
    ${entete(b.nom)}
    <div class="pg-lbl">Ce qu'il faut faire</div>
    <div class="card">
      ${molette('series', B().nbSeries(b), a + `'series',`)}
      ${molette('repsMin', b.repsMin, a + `'repsMin',`)}
      ${molette('repsMax', b.repsMax, a + `'repsMax',`)}
      ${sec ? '<div class="sv-meta">Exercice compté en secondes.</div>'
            : molette('charge', b.charge, a + `'charge',`)}
      ${molette('repos', b.repos, a + `'repos',`)}
    </div>
    ${sec ? '' : `<div class="pg-lbl">Charge</div>
    <div class="card">
      <button class="pg-sec" style="margin:0" onclick="SportProgramme.aEtablir('${id}',${i})">${
        B().estAEtablir(b) ? '✓ À établir en salle' : 'Marquer « à établir en salle »'}</button>
      <div class="sv-meta" style="margin-top:8px">Une charge non définie n'empêche pas de faire la
      séance : tu la règles devant la machine.</div>
    </div>`}
    <div class="pg-lbl">Échauffement</div>
    <div class="card">
      ${b.echauffement
        ? `<div class="sv-row"><span class="sv-grow">${b.echauffement.charge} kg × ${b.echauffement.reps}</span>
           <button class="pg-x" onclick="SportProgramme.echauffement('${id}',${i},null)">retirer</button></div>
           <div class="sv-meta" style="margin-top:6px">Hors tonnage, hors décompte des séries.</div>`
        : `<button class="pg-sec" style="margin:0" onclick="SportProgramme.echauffement('${id}',${i},1)">
             Ajouter une série d'échauffement</button>`}
    </div>
    <div class="pg-lbl">Progression</div>
    <div class="pg-chips">${Object.entries(B().PROGRESSIONS).map(([k, v]) =>
      `<button class="pg-chip${b.progression === k ? ' on' : ''}"
         onclick="SportProgramme.progression('${id}',${i},'${k}')">${esc(v)}</button>`).join('')}</div>
    ${b.progression === 'reps_puis_charge' ? `<div class="card" style="margin-top:9px">
      ${molette('increment', b.increment, a + `'increment',`)}
      <div class="sv-meta">Au haut de la fourchette sous 8/10 : la charge monte d'un cran et les
      répétitions repartent en bas.</div></div>` : ''}
    <button class="pg-suppr" onclick="SportProgramme.retirerBrique('${id}',${i})">Retirer de la séance</button>`;
  }

  if (b.nature === 'cardio') {
    const blocs = (b.blocs || []).map((x, k) => {
      const r = x.reglage || {};
      return `<div class="card sv-row">
        <div class="sv-grow"><div class="sv-nm">${esc(x.nom || 'Palier ' + (k + 1))}</div>
          <div class="sv-meta">${Math.round((x.duree || 0) / 60)} mn${
            r.vitesse ? ' · ' + r.vitesse + ' km/h' : ''}${r.pente ? ' · ' + r.pente + ' %' : ''}${
            x.fcMin || x.fcMax ? ' · FC ' + (x.fcMin || '') + (x.fcMax ? '-' + x.fcMax : '') : ''}</div></div>
        <div class="pg-ordre">
          <button onclick="SportProgramme.pasBloc('${id}',${i},${k},'duree',-60)">−</button>
          <button onclick="SportProgramme.pasBloc('${id}',${i},${k},'duree',60)">+</button></div>
        <button class="pg-x" onclick="SportProgramme.retirerBloc('${id}',${i},${k})">✕</button></div>`;
    }).join('') || `<div class="pg-empty">Aucun palier.</div>`;
    return `
    ${entete(b.nom)}
    <div class="pg-lbl">Les paliers</div>
    ${blocs}
    <button class="pg-sec" onclick="SportProgramme.ajouterBloc('${id}',${i})">+ Ajouter un palier</button>
    <div class="sv-meta" style="margin-top:8px">Les vitesses, pentes et fréquences se règlent
    finement pendant la séance ; ici on pose la trame.</div>
    <button class="pg-suppr" onclick="SportProgramme.retirerBrique('${id}',${i})">Retirer de la séance</button>`;
  }

  const items = (b.items || []).map((it, k) =>
    `<div class="card sv-row"><span class="sv-grow">${esc(it.texte)}</span>
      <button class="pg-x" onclick="SportProgramme.retirerItem('${id}',${i},${k})">✕</button></div>`).join('')
    || `<div class="pg-empty">Liste vide.</div>`;
  return `
  ${entete(b.nom)}
  ${items}
  <button class="pg-sec" onclick="SportProgramme.ajouterItem('${id}',${i})">+ Ajouter une ligne</button>
  <button class="pg-suppr" onclick="SportProgramme.retirerBrique('${id}',${i})">Retirer de la séance</button>`;
}

/* =========================================================================
   ONGLET OBJECTIFS
   ====================================================================== */

function vueObjectifs() {
  const inv = S.investissement();
  return S.etat().objectifs.map(o => {
    const a = S.avancement(o), i = inv[o.id] || { part: 0, nbSeances: 0 };
    const tete = a.type === 'valeur'
      ? `<div class="pg-val" style="color:${o.couleur}">${a.valeur ?? '—'}
           <small>${a.cible != null ? 'cible ' + a.cible : 'à saisir'}</small></div>`
      : `<div class="pg-ring" style="background:conic-gradient(${o.couleur} ${a.pourcentage}%,#f1e3e2 0)">
           <span style="color:${o.couleur}">${a.pourcentage}%</span></div>`;
    return `<div class="card">
      <div class="sv-row">${tete}
        <div class="sv-grow"><div class="sv-nm">${esc(o.nom)}</div>
          <div class="sv-meta">${esc(a.detail || (a.type === 'valeur' ? 'saisie manuelle' : ''))}</div></div></div>
      <div class="pg-inv"><i style="width:${i.part}%;background:${o.couleur}"></i></div>
      <div class="sv-meta">${i.part} % de ton volume · ${i.nbSeances} séance${i.nbSeances > 1 ? 's' : ''} · 4 dernières semaines</div>
    </div>`;
  }).join('');
}

/* =========================================================================
   CHÂSSIS
   ====================================================================== */

function entete(titre, action) {
  return `<div class="pg-h2"><button class="pg-back" onclick="SportProgramme.retour()">‹ Retour</button>
    <div class="pg-t2">${esc(titre)}</div>${action || '<span style="width:62px;flex:none"></span>'}</div>`;
}

function rendre() {
  if (!hote) return;
  let corps;
  if (ecran === 'type')        corps = vueType(ctx.arg);
  else if (ecran === 'modele') corps = vueModele(ctx.arg);
  else if (ecran === 'brique') corps = vueBrique(ctx.id, ctx.i);
  else {
    const tabs = [['objectifs','Objectifs'], ['seances','Séances'], ['exercices','Exercices']]
      .map(([k, l]) => `<div class="${onglet === k ? 'on' : ''}" onclick="SportProgramme.tab('${k}')">${l}</div>`).join('');
    corps = `<div class="pg-h1">
        <div class="pg-t1">📋 Mon programme</div>
        <button class="pg-back" onclick="SportProgramme.fermer()">Fermer</button></div>
      <div class="pg-tabs">${tabs}</div>
      ${onglet === 'objectifs' ? vueObjectifs() : vueSeances()}`;
  }
  hote.innerHTML = `<div class="sv pg">${corps}</div>`;
}

function aller(nom, ctx2) { PILE.push({ ecran, ctx }); ecran = nom; ctx = ctx2; rendre(); }
function retour() {
  const p = PILE.pop();
  if (!p) return fermer();
  ecran = p.ecran; ctx = p.ctx; rendre();
}
function fermer() { if (auFermer) return auFermer(); if (hote) hote.style.display = 'none'; }

/* --- Actions --------------------------------------------------------------- */

function tab(k) {
  if (k === 'exercices') { SportUI.monter(hote, { auFermer: () => { SportProgramme.monter(hote, { auFermer }); } }); return; }
  onglet = k; rendre();
}
const ouvrirType   = id => aller('type', { arg: id || null });
const ouvrirModele = id => aller('modele', { arg: id });
const editerBrique = (id, i) => aller('brique', { id, i });

function creer(typeId) {
  const nom = prompt('Nom de la séance ?');
  if (!nom || !nom.trim()) return;
  const t = S.typeById(typeId) || S.types()[0];
  const m = B().nouveauModele({ nom: nom.trim(), type: t.id, couleur: t.couleur, icone: t.emoji });
  S.enregistrerModele(m);
  ecran = 'modele'; ctx = { arg: m.id }; PILE.length = 0; rendre();
}

function renommer(id) {
  const m = S.modeleById(id);
  const nom = prompt('Nom de la séance', m.nom);
  if (nom && nom.trim()) m.nom = nom.trim();
  const noms = S.types().map((t, k) => (k + 1) + ' ' + t.nom).join(', ');
  const rep = prompt('Type ? ' + noms, String(S.types().findIndex(t => t.id === m.type) + 1));
  const t = S.types()[parseInt(rep, 10) - 1];
  if (t) { m.type = t.id; m.couleur = t.couleur; m.icone = t.emoji; }
  S.enregistrerModele(m); rendre();
}
function dupliquer(id) {
  const src = S.modeleById(id);
  const copie = B().nouveauModele({ ...structuredClone(src), id: B().nouvelId('m'),
                                    nom: src.nom + ' (copie)', version: 1 });
  S.enregistrerModele(copie);
  ecran = 'modele'; ctx = { arg: copie.id }; rendre();
}
function supprimer(id) {
  const m = S.modeleById(id);
  if (!confirm('Supprimer « ' + m.nom + ' » ? Les séances déjà faites ne sont pas touchées.')) return;
  S.supprimerModele(id); retour();
}
function lancer(id) {
  const s = S.instancierV3(id, aujourdhui());
  window.SportSeance.monter(hote, { auFermer: () => SportProgramme.monter(hote, { auFermer }) });
  window.SportSeance.ouvrir(s.id);
}

/* Ajout de briques */
function ajouterExercice(id) {
  const retourIci = () => { SportProgramme.monter(hote, { auFermer });
                            ecran = 'modele'; ctx = { arg: id }; rendre(); };
  SportUI.monter(hote, { auFermer: retourIci, onChoisir: exId => {
    const e = S.exoById(exId);
    const met = e.metriques || [];
    const sec = met.includes('duree') && !met.includes('charge');
    const m = S.modeleById(id);
    m.briques.push(B().briqueExercice(exId, e.nom,
      sec ? { unite: 'secondes', charge: 0, repsMin: 30, repsMax: 45, progression: 'reps_seules' } : {}));
    S.enregistrerModele(m); retourIci();
  } });
}
function ajouterCardio(id) {
  const m = S.modeleById(id);
  m.briques.push(B().briqueCardio('Cardio', [B().blocCardio({ nom: 'Palier 1', duree: 600 })]));
  S.enregistrerModele(m); rendre();
}
function ajouterListe(id) {
  const m = S.modeleById(id);
  m.briques.push(B().briqueListe('Assouplissements', B().LISTE_ASSOUPLISSEMENTS));
  S.enregistrerModele(m); rendre();
}
function retirerBrique(id, i) {
  const m = S.modeleById(id);
  if (!confirm('Retirer « ' + m.briques[i].nom + ' » ?')) return;
  m.briques.splice(i, 1); S.enregistrerModele(m); retour();
}
function monterBrique(id, i) {
  const m = S.modeleById(id); if (i === 0) return;
  [m.briques[i - 1], m.briques[i]] = [m.briques[i], m.briques[i - 1]];
  S.enregistrerModele(m); rendre();
}
function descendreBrique(id, i) {
  const m = S.modeleById(id); if (i >= m.briques.length - 1) return;
  [m.briques[i + 1], m.briques[i]] = [m.briques[i], m.briques[i + 1]];
  S.enregistrerModele(m); rendre();
}

/* Réglages d'une brique */
function pas(id, i, champ, delta) {
  const m = S.modeleById(id), b = m.briques[i], c = CH[champ];
  if (champ === 'series') {
    b.series = Math.max(1, B().nbSeries(b) + delta);
  } else {
    let v = Math.round(((b[champ] ?? 0) + delta) * 100) / 100;
    if (c.min != null) v = Math.max(c.min, v);
    b[champ] = v;
    if (champ === 'repsMin' && b.repsMax < v) b.repsMax = v;
    if (champ === 'repsMax' && b.repsMin > v) b.repsMin = v;
  }
  S.enregistrerModele(m); rendre();
}
function aEtablir(id, i) {
  const m = S.modeleById(id), b = m.briques[i];
  b.charge = B().estAEtablir(b) ? 0 : null;
  S.enregistrerModele(m); rendre();
}
function echauffement(id, i, on) {
  const m = S.modeleById(id), b = m.briques[i];
  b.echauffement = on ? { charge: Math.round((b.charge || 20) / 2), reps: 8 } : null;
  S.enregistrerModele(m); rendre();
}
function progression(id, i, k) {
  const m = S.modeleById(id); m.briques[i].progression = k;
  S.enregistrerModele(m); rendre();
}
function ajouterBloc(id, i) {
  const m = S.modeleById(id), b = m.briques[i];
  const d = b.blocs[b.blocs.length - 1] || {};
  b.blocs.push(B().blocCardio({ nom: 'Palier ' + (b.blocs.length + 1), exId: d.exId || null,
                                duree: d.duree || 300, reglage: { ...(d.reglage || {}) } }));
  S.enregistrerModele(m); rendre();
}
function retirerBloc(id, i, k) {
  const m = S.modeleById(id); m.briques[i].blocs.splice(k, 1);
  S.enregistrerModele(m); rendre();
}
function pasBloc(id, i, k, champ, delta) {
  const m = S.modeleById(id), x = m.briques[i].blocs[k];
  if (champ === 'duree') x.duree = Math.max(0, (x.duree || 0) + delta);
  S.enregistrerModele(m); rendre();
}
function ajouterItem(id, i) {
  const t = prompt('Ligne à ajouter ?');
  if (!t || !t.trim()) return;
  const m = S.modeleById(id); m.briques[i].items.push({ texte: t.trim() });
  S.enregistrerModele(m); rendre();
}
function retirerItem(id, i, k) {
  const m = S.modeleById(id); m.briques[i].items.splice(k, 1);
  S.enregistrerModele(m); rendre();
}

/* --- CSS ------------------------------------------------------------------- */

const CSS = `
.pg .pg-h1{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:8px}
.pg .pg-t1{font-family:'Cormorant Garamond',serif;font-weight:700;font-size:28px}
.pg .pg-h2{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:8px}
.pg .pg-t2{font-family:'Cormorant Garamond',serif;font-weight:700;font-size:20px;text-align:center;flex:1;min-width:0}
.pg .pg-back{background:none;border:1px solid var(--border);border-radius:10px;padding:7px 12px;
  font-size:14px;color:var(--muted);cursor:pointer;white-space:nowrap}
.pg .pg-cta{background:var(--accent);color:#fff;border:0;border-radius:10px;padding:8px 14px;
  font-weight:600;font-size:14px;cursor:pointer;white-space:nowrap}
.pg .pg-tabs{display:flex;background:var(--surface);border:1.5px solid var(--border);
  border-radius:14px;padding:4px;margin-bottom:14px}
.pg .pg-tabs div{flex:1;text-align:center;padding:9px;border-radius:11px;font-size:14px;
  color:var(--muted);cursor:pointer}
.pg .pg-tabs div.on{background:var(--accent);color:#fff;font-weight:600}
.pg .pg-fam{font-size:10.5px;letter-spacing:.15em;text-transform:uppercase;color:var(--muted);margin:14px 0 8px}
.pg .pg-lbl{font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:#c9a6a3;margin:16px 0 8px}
.pg .pg-ico{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;
  justify-content:center;font-size:19px;flex:none;color:#fff}
.pg .pg-pas{width:34px;height:34px;border-radius:10px;display:flex;align-items:center;
  justify-content:center;font-size:16px;flex:none;color:#fff}
.pg .pg-flou{border-style:dashed}
.pg .pg-ordre{display:flex;flex-direction:column;gap:3px;flex:none}
.pg .pg-ordre button{width:26px;height:20px;border:1px solid var(--border);background:var(--surface);
  border-radius:6px;font-size:9px;color:var(--muted);cursor:pointer;padding:0}
.pg .pg-x{background:none;border:0;color:#c9a6a3;font-size:12px;cursor:pointer;text-decoration:underline}
.pg .pg-empty{border:1.5px dashed var(--border);border-radius:14px;padding:15px;text-align:center;
  font-size:13px;color:var(--muted);margin-bottom:9px}
.pg .pg-info{background:#fff7e6;border-radius:12px;padding:11px 13px;font-size:12.5px;
  color:#8a6a1e;line-height:1.5;margin-bottom:10px}
.pg .pg-chips{display:flex;gap:7px;flex-wrap:wrap}
.pg .pg-chip{background:var(--surface);border:1px solid var(--border);border-radius:20px;
  padding:9px 14px;font-size:13.5px;cursor:pointer;color:var(--text)}
.pg .pg-chip.on{border-color:var(--accent);border-width:1.5px;font-weight:600}
.pg .pg-step{display:flex;align-items:center;gap:9px;margin-bottom:8px}
.pg .pg-step button{width:40px;height:40px;border-radius:11px;border:1px solid var(--border);
  background:var(--surface);font-size:20px;color:var(--accent);flex:none;cursor:pointer}
.pg .pg-step .v{flex:1;text-align:center;font-family:'Cormorant Garamond',serif;font-size:25px;font-weight:700}
.pg .pg-step .u{display:block;font-size:11px;color:var(--muted);font-weight:400;font-family:'Inter',sans-serif}
.pg .pg-sec{display:block;width:100%;background:var(--surface);border:1.5px solid var(--accent);
  border-radius:13px;padding:12px;font-size:14.5px;font-weight:600;color:var(--accent);
  margin-top:9px;cursor:pointer}
.pg .pg-suppr{display:block;width:100%;background:none;border:1.5px solid #e8c4c7;border-radius:13px;
  padding:12px;font-size:14px;font-weight:600;color:#b8434f;margin-top:16px;cursor:pointer}
.pg .pg-ring{width:56px;height:56px;border-radius:50%;flex:none;display:flex;align-items:center;
  justify-content:center;position:relative}
.pg .pg-ring::after{content:"";position:absolute;inset:8px;background:var(--surface);border-radius:50%}
.pg .pg-ring span{position:relative;z-index:1;font-size:14px;font-weight:700}
.pg .pg-val{width:56px;flex:none;text-align:center;font-size:18px;font-weight:700;line-height:1.1}
.pg .pg-val small{display:block;font-size:10px;color:var(--muted);font-weight:400;margin-top:2px}
.pg .pg-inv{height:7px;border-radius:5px;background:#f3e5e4;overflow:hidden;margin-top:10px}
.pg .pg-inv i{display:block;height:100%}
`;

function monter(el, options) {
  hote = typeof el === 'string' ? document.getElementById(el) : el;
  auFermer = (options && options.auFermer) || null;
  if (!document.getElementById('pg-css')) {
    const st = document.createElement('style'); st.id = 'pg-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }
  if (hote) hote.style.display = 'block';
  ecran = 'racine'; ctx = {}; PILE.length = 0;
  rendre();
}

return { monter, rendre, retour, fermer, tab, ouvrirType, ouvrirModele, editerBrique,
         creer, renommer, dupliquer, supprimer, lancer,
         ajouterExercice, ajouterCardio, ajouterListe, retirerBrique,
         monterBrique, descendreBrique,
         pas, aEtablir, echauffement, progression,
         ajouterBloc, retirerBloc, pasBloc, ajouterItem, retirerItem };
})();
if (typeof window !== 'undefined') window.SportProgramme = SportProgramme;
