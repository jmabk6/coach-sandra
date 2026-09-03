/* ============================================================================
   Coach by JM — Module Sport v2 · écrans
   À charger APRÈS sport_catalogue.js et sport_v2_core.js.
   Point d'entrée : SportUI.monter(elementHote) puis SportUI.aller('banque').
   Réutilise les variables CSS de l'app (--accent, --muted, --surface, --border).
   ========================================================================= */

const SportUI = (function () {

const S = SportV2;
let hote = null, ecran = 'groupes', ctx = {}, auFermer = null;
let filtreTexte = '', filtreGroupe = null, filtreObjectif = null;

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

const objById = id => S.etat().objectifs.find(o => o.id === id) || null;

/* Photo : on ne recopie rien, on pointe vers exo_data.js. */
function photo(ex) {
  if (!ex.photo || !window.EXO_DATA) return null;
  const d = window.EXO_DATA.find(x => x && x.id === ex.photo);
  return d ? (d.thumb || null) : null;
}
function vignette(ex, taille = 44) {
  const p = photo(ex);
  const st = `width:${taille}px;height:${taille}px;border-radius:12px;flex:none;`;
  return p ? `<img src="${p}" style="${st}object-fit:cover;">`
           : `<div style="${st}background:#fdf0ef;display:flex;align-items:center;justify-content:center;font-size:${Math.round(taille*0.48)}px;">${ex.emoji || '🏋️'}</div>`;
}
const pastilles = ex => (ex.objectifs || []).map(l => {
  const o = objById(l.objectifId);
  return o ? `<span class="sv-dot" style="background:${o.couleur}"></span>` : '';
}).join('');

const LIB_POIDS = { plein: 'plein', moyen: 'moyen', leger: 'léger' };

/* Groupes d'entrée dans la banque. Une catégorie du catalogue ne peut
   appartenir qu'à un seul groupe : pas de doublon dans la grille. */
const GROUPES = [
  { id:'dos',       nom:'Dos / Tractions', emoji:'🎯', cats:['dos'] },
  { id:'epaules',   nom:'Épaules',         emoji:'🙌', cats:['epaules'] },
  { id:'pectoraux', nom:'Pectoraux',       emoji:'🤜', cats:['pec','pecs'] },
  { id:'bras',      nom:'Bras',            emoji:'💪', cats:['bras'] },
  { id:'jambes',    nom:'Jambes',          emoji:'🦵', cats:['jambes'] },
  { id:'gainage',   nom:'Gainage',         emoji:'🔥', cats:['gainage'] },
  { id:'cardio',    nom:'Cardio',          emoji:'🚴', cats:['cardio'] },
  { id:'mobilite',  nom:'Mobilité',        emoji:'🤸', cats:['mobilite','rotation'] },
  { id:'souplesse', nom:'Souplesse',       emoji:'🧘', cats:['souplesse','stretching'] }
];
const groupeDe = ex => GROUPES.find(g => g.cats.includes(ex.cat)) || null;
const groupeById = id => GROUPES.find(g => g.id === id) || null;

function joursDepuis(iso) {
  if (!iso) return null;
  const n = Math.round((Date.now() - new Date(iso + 'T12:00').getTime()) / 864e5);
  return n <= 0 ? "aujourd'hui" : n === 1 ? 'hier' : 'il y a ' + n + ' jours';
}
const aujourdhui = () => new Date().toISOString().slice(0, 10);

/* =========================================================================
   1. BANQUE D'EXERCICES
   ====================================================================== */

/* Écran d'entrée : une grille par groupe musculaire. La recherche reste
   accessible ici et court-circuite la grille. */
function vueGroupes() {
  const cat = S.catalogue();
  const blocs = GROUPES.map(g => {
    const n = cat.filter(e => (groupeDe(e) || {}).id === g.id).length;
    if (!n) return '';
    return `<div class="cat-tile" onclick="SportUI.ouvrirGroupe('${g.id}')">
      <span class="emoji">${g.emoji}</span>
      <div class="cname">${esc(g.nom)}</div>
      <div class="ccount">${n} exo${n>1?'s':''}</div></div>`;
  }).join('');

  const orphelins = cat.filter(e => !groupeDe(e)).length;
  const tuileAutres = orphelins ? `<div class="cat-tile" onclick="SportUI.ouvrirGroupe(null)">
      <span class="emoji">📦</span><div class="cname">Non classés</div>
      <div class="ccount">${orphelins} exo${orphelins>1?'s':''}</div></div>` : '';

  return `
  ${entete('Banque d\'exercices')}
  <div class="sv-search"><input class="finput" placeholder="Rechercher dans les ${cat.length} exercices"
       value="${esc(filtreTexte)}" oninput="SportUI.chercherGlobal(this.value)"></div>
  <div class="cat-grid">${blocs}${tuileAutres}
    <div class="cat-tile add" onclick="SportUI.nouvelExercice()">
      <span class="emoji">➕</span><div class="cname">Nouvel</div>
      <div class="ccount">exercice</div></div>
  </div>`;
}

function vueBanque() {
  const cat = S.catalogue();
  const g = groupeById(filtreGroupe);
  const liste = cat.filter(e => {
    if (filtreGroupe !== undefined && filtreGroupe !== '*' ) {
      const gr = groupeDe(e);
      if (filtreGroupe === null) { if (gr) return false; }
      else if (!gr || gr.id !== filtreGroupe) return false;
    }
    if (filtreObjectif && !(e.objectifs || []).some(o => o.objectifId === filtreObjectif)) return false;
    if (filtreTexte && !e.nom.toLowerCase().includes(filtreTexte.toLowerCase())) return false;
    return true;
  });

  const pillsObj = S.etat().objectifs.map(o =>
    `<button class="sv-pill${filtreObjectif===o.id?' on':''}" onclick="SportUI.filtrerObjectif('${o.id}')">
       <span class="sv-dot" style="background:${o.couleur}"></span>${esc(o.nom.split('—')[0].trim())}</button>`).join('');

  const items = liste.map(e => {
    const d = S.derniereFois(e.id);
    const meta = d ? esc(resumeSeries(d.series)) + ' · ' + joursDepuis(d.date) : 'jamais fait';
    return `<div class="card sv-row" onclick="SportUI.aller('fiche','${e.id}')">
      ${vignette(e)}
      <div class="sv-grow"><div class="sv-nm">${esc(e.nom)} ${pastilles(e)}</div>
        <div class="sv-meta">${meta}</div></div>
      <span class="sv-chev">›</span></div>`;
  }).join('') || `<div class="sv-empty">Aucun exercice ne correspond. Change de filtre, ou crée-en un.</div>`;

  const titre = filtreGroupe === '*' ? 'Recherche'
              : g ? g.emoji + ' ' + g.nom : 'Non classés';
  return `
  ${entete(titre)}
  <div class="sv-search"><input class="finput" placeholder="Filtrer cette liste"
       value="${esc(filtreTexte)}" oninput="SportUI.chercher(this.value)"></div>
  <div class="sv-pills">${pillsObj}</div>
  <div class="sv-count">${liste.length} exercice${liste.length>1?'s':''}</div>
  ${items}
  <button class="btn-ghost" onclick="SportUI.nouvelExercice()">+ Créer un exercice</button>`;
}

function resumeSeries(series) {
  if (!series || !series.length) return '';
  const s0 = series[0];
  if (s0.duree != null && s0.reps == null) return series.length + ' × ' + s0.duree + ' s';
  if (s0.charge != null) return series.length + ' × ' + (s0.reps ?? '?') + ' à ' + s0.charge + ' kg';
  return series.length + ' × ' + (s0.reps ?? '?');
}

/* =========================================================================
   2. FICHE EXERCICE
   ====================================================================== */

function vueFiche(exId) {
  const e = S.exoById(exId);
  if (!e) return entete('Introuvable') + `<div class="sv-empty">Cet exercice n'existe plus.</div>`;

  const liens = (e.objectifs || []).map(l => {
    const o = objById(l.objectifId); if (!o) return '';
    return `<div class="sv-row sv-lien">
      <span class="sv-dot" style="background:${o.couleur}"></span>
      <span class="sv-grow">${esc(o.nom)}</span>
      <button class="sv-tag" onclick="SportUI.cyclePoids('${e.id}','${o.id}')">${LIB_POIDS[l.poids]||'plein'}</button>
      <button class="sv-x" onclick="SportUI.retirerObjectif('${e.id}','${o.id}')">✕</button></div>`;
  }).join('') || `<div class="sv-meta">Aucun objectif — cet exercice ne comptera dans aucune statistique.</div>`;

  const restants = S.etat().objectifs.filter(o => !(e.objectifs||[]).some(l => l.objectifId === o.id));
  const ajoutObj = restants.length
    ? `<div class="sv-pills" style="margin-top:8px">${restants.map(o =>
        `<button class="sv-pill" onclick="SportUI.poserObjectif('${e.id}','${o.id}')">
           <span class="sv-dot" style="background:${o.couleur}"></span>+ ${esc(o.nom.split('—')[0].trim())}</button>`).join('')}</div>`
    : '';

  const np = (e.phases || []).length;
  const cur = e.phaseCourante || 1;
  const phases = np ? `
    <div class="klabel">Repère de phase</div>
    <div class="card">
      <div class="sv-phases">${Array.from({length:np},(_,i)=>
        `<button class="sv-ph${i<cur?' on':''}" onclick="SportUI.reglerPhase('${e.id}',${i+1})"></button>`).join('')}</div>
      <div class="sv-meta">Phase ${cur} sur ${np} — ${esc(e.phases[cur-1]?.label||'')}. ${esc(e.phases[cur-1]?.presc||'')}</div>
      <div class="sv-meta" style="margin-top:6px;font-style:italic">Indicatif : rien ne se déverrouille, tu le déplaces quand tu veux.</div>
    </div>` : '';

  const d = S.derniereFois(e.id);
  const dernieres = d ? `<div class="sv-row"><span class="sv-grow">${joursDepuis(d.date)}</span>
      <b>${esc(resumeSeries(d.series))}</b></div>` : `<div class="sv-meta">Jamais pratiqué.</div>`;
  const records = ['reps','charge','duree'].map(m => {
    const v = S.meilleurePerf(e.id, m);
    return v == null ? '' : `<div class="sv-row"><span class="sv-grow">Meilleure ${m}</span><b>${v}</b></div>`;
  }).join('');

  const dansModeles = S.modeles().filter(m => m.blocs.some(b => b.exercices.some(l => l.exId === e.id)));

  const detail = [
    e.desc && `<div class="sv-txt">${esc(e.desc)}</div>`,
    e.consigne && `<div class="sv-txt"><b>Consigne.</b> ${esc(e.consigne)}</div>`,
    e.etapes && e.etapes.length && `<div class="klabel">Déroulé</div><ol class="sv-ol">${e.etapes.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>`,
    e.erreurs && e.erreurs.length && `<div class="klabel">Erreurs fréquentes</div><ul class="sv-ul">${e.erreurs.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`,
    e.precautions && `<div class="card sv-warn">${esc(e.precautions)}</div>`
  ].filter(Boolean).join('');

  return `
  ${entete(e.nom)}
  <div class="card sv-hero">${vignette(e,84)}
    <div class="sv-meta">${esc([e.materiel,e.mouvement,(e.muscles_p||[]).join(', ')].filter(Boolean).join(' · '))}</div>
  </div>
  ${detail}
  <div class="klabel">Objectifs servis</div>
  <div class="card">${liens}${ajoutObj}</div>
  ${phases}
  <div class="klabel">Ton historique</div>
  <div class="card">${dernieres}${records}</div>
  <div class="sv-meta" style="margin:10px 0">Présent dans ${dansModeles.length} modèle${dansModeles.length>1?'s':''}${dansModeles.length?' : '+esc(dansModeles.map(m=>m.nom).join(', ')):''}</div>
  <button class="btn-add" onclick="SportUI.ajouterAuJour('${e.id}')">Ajouter à la séance du jour</button>`;
}

/* =========================================================================
   3. MODÈLES
   ====================================================================== */

function vueModeles() {
  const items = S.modeles().map(m => {
    const rep = S.repartition(m), nb = m.blocs.reduce((a,b)=>a+b.exercices.length,0);
    const barre = rep.length ? `<div class="sv-bar">${rep.map(r=>
      `<i style="width:${r.part}%;background:${r.couleur}"></i>`).join('')}</div>
      <div class="sv-legend">${rep.map(r=>
      `<span><span class="sv-dot" style="background:${r.couleur}"></span>${esc(r.nom.split('—')[0].trim())} ${r.part}%</span>`).join('')}</div>` : '';
    return `<div class="card" onclick="SportUI.aller('modele','${m.id}')">
      <div class="sv-row"><span class="sv-ico" style="background:${m.couleur}">${m.icone||'📋'}</span>
        <div class="sv-grow"><div class="sv-nm">${esc(m.nom)}</div>
          <div class="sv-meta">${nb} exercices · ~${S.dureeEstimee(m)} min</div></div>
        <span class="sv-chev">›</span></div>${barre}</div>`;
  }).join('');
  return entete('Mes séances') + items +
    `<button class="btn-ghost" onclick="SportUI.nouveauModele()">+ Créer une séance</button>`;
}

const LIB_BLOC = { echauffement:['🔥','Échauffement'], corps:['💪','Corps de la séance'], retour_calme:['🌙','Retour au calme'] };

function vueModele(id) {
  const m = S.modeleById(id);
  if (!m) return entete('Introuvable') + `<div class="sv-empty">Ce modèle n'existe plus.</div>`;
  const cat = S.catalogue();

  const blocs = m.blocs.map((b, bi) => {
    const [emo, lib] = LIB_BLOC[b.type];
    const lignes = b.exercices.map((l, li) => {
      const e = cat.find(x => x.id === l.exId);
      if (!e) return '';
      return `<div class="card sv-row sv-ligne">
        <span class="sv-drag">⠿</span>${vignette(e,34)}
        <div class="sv-grow"><div class="sv-nm sv-sm">${esc(e.nom)} ${pastilles(e)}</div>
          <div class="sv-meta">${esc(prescription(l))}</div></div>
        <button class="sv-x" onclick="SportUI.retirerDuModele('${m.id}',${bi},${li})">✕</button></div>`;
    }).join('') || `<div class="sv-empty sv-sm">Vide — le bloc sera masqué.</div>`;
    return `<div class="sv-bloc sv-bloc-${b.type}">
      <div class="sv-bloch"><span>${emo} ${lib}</span><span>${b.exercices.length} ex.</span></div>
      ${lignes}
      <button class="sv-add" onclick="SportUI.choisirPour('${m.id}',${bi})">+ Ajouter depuis la banque</button></div>`;
  }).join('');

  const rep = S.repartition(m);
  return `
  ${entete(m.nom)}
  <div class="sv-meta" style="margin:-6px 0 12px">${S.dureeEstimee(m)} min estimées · version ${m.version}</div>
  ${rep.length ? `<div class="card"><div class="sv-bar">${rep.map(r=>`<i style="width:${r.part}%;background:${r.couleur}"></i>`).join('')}</div>
    <div class="sv-legend">${rep.map(r=>`<span><span class="sv-dot" style="background:${r.couleur}"></span>${esc(r.nom.split('—')[0].trim())} ${r.part}%</span>`).join('')}</div>
    <div class="sv-meta" style="margin-top:8px">Recalculé à chaque modification — c'est une description, pas une consigne.</div></div>` : ''}
  ${blocs}
  <button class="btn-add" onclick="SportUI.lancer('${m.id}')">Faire cette séance aujourd'hui</button>
  <button class="btn-ghost" onclick="SportUI.dupliquer('${m.id}')">Dupliquer</button>`;
}

function prescription(l) {
  const p = [];
  if (l.series) p.push(l.series + ' séries');
  if (l.reps) p.push(l.reps + ' reps');
  if (l.duree) p.push(l.duree + ' s');
  if (l.charge) p.push(l.charge + ' kg');
  return p.join(' · ') || 'libre';
}

/* =========================================================================
   4. SÉANCE DU JOUR
   ====================================================================== */

function vueSeance(id) {
  const s = S.seanceById(id);
  if (!s) return entete('Séance') + `<div class="sv-empty">Aucune séance en cours. Choisis un modèle.</div>`;
  const cat = S.catalogue();
  const ec = S.ecarts(s);

  const cartes = s.exercices.map((ex, i) => {
    const e = cat.find(x => x.id === ex.exId); if (!e) return '';
    const np = (e.phases || []).length;
    const repere = np ? `<span class="sv-tag sv-grey">repère ${e.phaseCourante||1}/${np}</span>` : '';
    const neuf = ex.origine === 'ajout_du_jour' ? `<span class="sv-tag sv-new">ajouté aujourd'hui</span>` : '';
    const d = S.derniereFois(ex.exId);
    const rappel = d ? 'dernière fois : ' + esc(resumeSeries(d.series)) : 'jamais fait';

    const series = ex.series.map((se, k) =>
      `<div class="sv-set"><span class="sv-n">S${k+1}</span>
        <span class="sv-inp">${se.reps!=null?`<b>${se.reps}</b><i>reps</i>`:''}
        ${se.duree!=null?`<b>${se.duree}</b><i>s</i>`:''}
        ${se.charge!=null?`<b>${se.charge}</b><i>kg</i>`:''}</span></div>`).join('');

    return `<div class="card${ex.fait?' sv-fait':''}">
      <div class="sv-row">${vignette(e,34)}
        <div class="sv-grow"><div class="sv-nm sv-sm">${esc(e.nom)}</div>
          <div class="sv-meta">${rappel} ${neuf}</div></div>
        ${repere}
        <button class="sv-check${ex.fait?' on':''}" onclick="SportUI.basculer('${s.id}',${i})">${ex.fait?'✓':''}</button></div>
      ${series}
      <button class="sv-add" onclick="SportUI.saisir('${s.id}',${i})">+ Ajouter une série</button></div>`;
  }).join('');

  const bandeau = (ec && s.statut !== 'terminee') ? `<div class="sv-banner">
      <span>${ec} écart${ec>1?'s':''} délibéré${ec>1?'s':''} avec le modèle</span>
      <button class="sv-tag" onclick="SportUI.reporter('${s.id}')">Enregistrer</button></div>` : '';

  return `
  ${entete(s.nomAffiche)}
  <div class="sv-meta" style="margin:-6px 0 12px">${esc(s.date)} · ${s.statut.replace('_',' ')}</div>
  ${bandeau}
  ${cartes}
  <button class="btn-ghost" onclick="SportUI.aller('banque')">+ Ajouter un exercice</button>
  ${s.statut!=='terminee' ? `<button class="btn-add" onclick="SportUI.terminer('${s.id}')">Terminer la séance</button>` : ''}`;
}

/* =========================================================================
   5. OBJECTIFS
   ====================================================================== */

function vueObjectifs() {
  const inv = S.investissement();

  const cartes = S.etat().objectifs.map(o => {
    const a = S.avancement(o), i = inv[o.id];
    const tete = a.type === 'valeur'
      ? `<div class="sv-val" style="color:${o.couleur}">${a.valeur ?? '—'}
           <small>${a.cible!=null?'cible '+a.cible:'à saisir'}</small></div>`
      : `<div class="sv-ring" style="background:conic-gradient(${o.couleur} ${a.pourcentage}%, #f1e3e2 0)">
           <span style="color:${o.couleur}">${a.pourcentage}%</span></div>`;
    const sous = a.type === 'valeur'
      ? `<button class="sv-tag" onclick="SportUI.saisirValeur('${o.id}')">Mettre à jour</button>`
      : `<div class="sv-meta">${esc(a.detail || '')}</div>`;

    return `<div class="card">
      <div class="sv-row">${tete}
        <div class="sv-grow"><div class="sv-nm">${esc(o.nom)}</div>${sous}</div></div>
      <div class="sv-invbar"><i style="width:${i.part}%;background:${o.couleur}"></i></div>
      <div class="sv-meta">${i.part} % de ton volume · ${i.nbSeances} séance${i.nbSeances>1?'s':''} · 4 dernières semaines</div>
    </div>`;
  }).join('');

  const oublies = S.jamaisFaits().filter(e => (e.objectifs||[]).length);
  const bloc = oublies.length ? `
    <div class="klabel">Laissés de côté</div>
    <div class="card"><div class="sv-meta">${esc(oublies.slice(0,4).map(e=>e.nom).join(', '))}${oublies.length>4?` et ${oublies.length-4} autres`:''} n'ont jamais été faits.</div>
    <button class="sv-add" onclick="SportUI.aller('banque')">Voir dans la banque</button></div>` : '';

  return entete('Mes objectifs') + cartes + bloc;
}

/* =========================================================================
   CHÂSSIS
   ====================================================================== */

function entete(titre) {
  return `<div class="top"><button class="back" onclick="SportUI.retour()">‹</button>
          <div class="ttl">${esc(titre)}</div></div>`;
}

const PILE = [];
function aller(nom, arg) {
  PILE.push({ ecran, ctx: { ...ctx } });
  ecran = nom; ctx = { arg };
  rendre();
}
/* Racine atteinte : on ferme au lieu de ne rien faire — c'est ce qui rendait
   l'écran de test sans issue. */
function retour() {
  const p = PILE.pop();
  if (!p) return fermer();
  ecran = p.ecran; ctx = p.ctx;
  rendre();
}
function fermer() {
  if (auFermer) return auFermer();
  if (hote) hote.style.display = 'none';
}

function rendre() {
  if (!hote) return;
  const v = ecran === 'groupes'   ? vueGroupes()
          : ecran === 'banque'    ? vueBanque()
          : ecran === 'fiche'     ? vueFiche(ctx.arg)
          : ecran === 'modeles'   ? vueModeles()
          : ecran === 'modele'    ? vueModele(ctx.arg)
          : ecran === 'seance'    ? vueSeance(ctx.arg)
          : ecran === 'objectifs' ? vueObjectifs()
          : vueGroupes();
  hote.innerHTML = `<div class="sv">${v}</div>`;
}

/* ---- actions ---- */

const chercher = v => { filtreTexte = v; rendre(); };
const filtrerObjectif = o => { filtreObjectif = (filtreObjectif === o ? null : o); rendre(); };
/* Depuis la grille : on entre dans un groupe. null = les non classés. */
function ouvrirGroupe(id) { filtreGroupe = id; filtreTexte = ''; filtreObjectif = null; aller('banque'); }
/* Recherche depuis la grille : elle traverse tous les groupes. */
function chercherGlobal(v) {
  if (!v) { filtreTexte = ''; return rendre(); }
  filtreGroupe = '*'; filtreTexte = v; aller('banque');
  const i = hote && hote.querySelector('.sv-search input');
  if (i) { i.focus(); i.setSelectionRange(v.length, v.length); }
}

const ORDRE_POIDS = ['plein', 'moyen', 'leger'];
function cyclePoids(exId, objId) {
  const ex = S.exoById(exId);
  const l = (ex.objectifs || []).find(o => o.objectifId === objId);
  const suivant = ORDRE_POIDS[(ORDRE_POIDS.indexOf(l.poids) + 1) % 3];
  S.poserObjectif(exId, objId, suivant); rendre();
}
const poserObjectif   = (e, o) => { S.poserObjectif(e, o); rendre(); };
const retirerObjectif = (e, o) => { S.retirerObjectif(e, o); rendre(); };
const reglerPhase     = (e, r) => { S.reglerPhase(e, r); rendre(); };

function nouvelExercice() {
  const nom = prompt('Nom du nouvel exercice ?'); if (!nom) return;
  const ex = S.creerExercice({ nom }); aller('fiche', ex.id);
}
function nouveauModele() {
  const nom = prompt('Nom de la séance ?'); if (!nom) return;
  const m = S.enregistrerModele({ id: 'm' + Date.now(), nom, couleur: '#c0616a', icone: '📋',
    blocs: [{type:'echauffement',exercices:[]},{type:'corps',exercices:[]},{type:'retour_calme',exercices:[]}], version: 0 });
  aller('modele', m.id);
}
const dupliquer = id => { const c = S.dupliquerModele(id); if (c) aller('modele', c.id); };

function retirerDuModele(mId, bi, li) {
  const m = S.modeleById(mId); m.blocs[bi].exercices.splice(li, 1);
  S.enregistrerModele(m); rendre();
}
/* Choisir un exercice pour un bloc : on part dans la banque, la sélection revient ici. */
function choisirPour(mId, bi) { ctx.cible = { mId, bi }; aller('banque'); }

function ajouterAuJour(exId) {
  const cible = PILE.map(p => p.ctx && p.ctx.cible).filter(Boolean).pop();
  if (cible) {                                   // on venait d'un modèle
    const m = S.modeleById(cible.mId);
    m.blocs[cible.bi].exercices.push({ exId, series:null, reps:null, charge:null, duree:null, note:'' });
    S.enregistrerModele(m);
    ecran = 'modele'; ctx = { arg: cible.mId }; rendre(); return;
  }
  const s = seanceDuJour(true);
  S.ajouterExercice(s.id, exId);
  ecran = 'seance'; ctx = { arg: s.id }; rendre();
}

function seanceDuJour(creer) {
  const encours = S.seancesDe(aujourdhui()).find(s => s.statut !== 'terminee');
  if (encours || !creer) return encours;
  const m = S.modeles()[0];
  return S.instancier(m.id, aujourdhui());
}
function lancer(mId) { const s = S.instancier(mId, aujourdhui()); aller('seance', s.id); }

function saisir(sId, i) {
  const s = S.seanceById(sId), ex = s.exercices[i], e = S.exoById(ex.exId);
  const cardio = ['cardio','souplesse','mobilite','gainage'].includes(e.cat);
  const serie = {};
  if (cardio) { const d = prompt('Durée en secondes ?'); if (!d) return; serie.duree = +d; }
  else {
    const r = prompt('Répétitions ?'); if (!r) return; serie.reps = +r;
    const c = prompt('Charge en kg ? (vide si poids du corps)'); if (c) serie.charge = +c;
  }
  S.noterSerie(sId, i, serie); rendre();
}
function basculer(sId, i) {
  const s = S.seanceById(sId); s.exercices[i].fait = !s.exercices[i].fait;
  S.terminer && rendre();
}
function terminer(sId) {
  const d = prompt('Durée réelle en minutes ?');
  S.terminer(sId, { dureeReelle: d ? +d : null });
  aller('objectifs');
}
function reporter(sId) {
  if (!confirm('Enregistrer les écarts de cette séance dans le modèle ?')) return;
  S.reporterDansModele(sId); rendre();
}
function saisirValeur(objId) {
  const o = objById(objId);
  const v = prompt('Valeur actuelle ? (' + o.nom + ')'); if (!v) return;
  o.cible = { ...(o.cible||{}), valeurActuelle: +v, majLe: aujourdhui() };
  S.etat().objectifs; localStorage.setItem('mc_sport_v2', JSON.stringify(S.etat()));
  rendre();
}

/* ---- CSS ---- */

const CSS = `
.sv{padding:4px 0}
.sv .sv-row{display:flex;align-items:center;gap:10px}
.sv .sv-grow{flex:1;min-width:0}
.sv .sv-nm{font-weight:600;font-size:15px;line-height:1.25}
.sv .sv-nm.sv-sm{font-size:14px}
.sv .sv-meta{font-size:12px;color:var(--muted);margin-top:3px}
.sv .sv-txt{font-size:13.5px;line-height:1.55;margin:10px 0;color:var(--text)}
.sv .sv-dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:3px}
.sv .sv-chev{color:#d8bebc;font-size:18px}
.sv .sv-x{background:none;border:0;color:#d8bebc;font-size:15px;cursor:pointer}
.sv .sv-drag{color:#d8bebc;letter-spacing:-2px}
.sv .sv-search{margin:6px 0 10px}
.sv .sv-pills{display:flex;gap:6px;overflow-x:auto;padding-bottom:6px;margin-bottom:4px}
.sv .sv-pill{border:1px solid var(--border);background:var(--surface);color:var(--muted);
  border-radius:20px;padding:6px 12px;font-size:12.5px;white-space:nowrap;cursor:pointer}
.sv .sv-pill.on{background:var(--accent);color:#fff;border-color:var(--accent)}
.sv .sv-count{font-size:11.5px;color:var(--muted);margin:6px 0 8px}
.sv .sv-empty{border:1.5px dashed var(--border);border-radius:14px;padding:16px;
  text-align:center;font-size:13px;color:var(--muted);margin-bottom:10px}
.sv .sv-hero{text-align:center;display:flex;flex-direction:column;align-items:center;gap:8px}
.sv .sv-warn{background:#fff7e6;border-color:#f3d9a8;font-size:12.5px;line-height:1.5}
.sv .sv-ol,.sv .sv-ul{margin:6px 0 12px 18px;font-size:13px;line-height:1.6;color:var(--text)}
.sv .sv-lien{padding:6px 0}
.sv .sv-tag{border:1px solid var(--border);background:var(--surface);color:var(--accent);
  border-radius:12px;padding:4px 10px;font-size:11.5px;cursor:pointer}
.sv .sv-tag.sv-grey{color:var(--muted)}
.sv .sv-tag.sv-new{background:#fde7f3;color:#c0176f;border-color:#f6cde3}
.sv .sv-phases{display:flex;gap:5px;margin-bottom:8px}
.sv .sv-ph{flex:1;height:8px;border-radius:5px;background:#f1e1e0;border:0;cursor:pointer}
.sv .sv-ph.on{background:var(--accent)}
.sv .sv-bar{height:9px;border-radius:6px;display:flex;overflow:hidden;margin:10px 0 8px}
.sv .sv-bar i{display:block;height:100%}
.sv .sv-legend{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px;color:var(--muted)}
.sv .sv-ico{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;
  justify-content:center;font-size:18px;flex:none}
.sv .sv-bloc{border-left:3px solid var(--accent-light);padding-left:10px;margin:14px 0}
.sv .sv-bloc-corps{border-color:var(--accent)}
.sv .sv-bloc-retour_calme{border-color:#a9c4ce}
.sv .sv-bloch{display:flex;justify-content:space-between;font-size:11px;letter-spacing:.12em;
  text-transform:uppercase;color:var(--muted);margin-bottom:8px}
.sv .sv-add{background:none;border:0;color:var(--accent);font-size:13px;font-weight:600;
  padding:8px 0;cursor:pointer}
.sv .sv-set{display:flex;align-items:center;gap:8px;margin-top:8px}
.sv .sv-n{width:26px;font-size:12px;color:var(--muted)}
.sv .sv-inp{flex:1;background:#faf3f3;border-radius:10px;padding:8px 11px;font-size:14px}
.sv .sv-inp i{font-style:normal;color:var(--muted);font-size:12px;margin:0 6px 0 3px}
.sv .sv-check{width:26px;height:26px;border-radius:8px;border:1.5px solid var(--border);
  background:var(--surface);flex:none;cursor:pointer;color:#fff}
.sv .sv-check.on{background:#2d6a4f;border-color:#2d6a4f}
.sv .sv-fait{opacity:.62}
.sv .sv-banner{background:#fff7e6;border-radius:14px;padding:10px 12px;font-size:12.5px;
  color:#8a6a1e;display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px}
.sv .sv-ring{width:58px;height:58px;border-radius:50%;flex:none;display:flex;
  align-items:center;justify-content:center;position:relative}
.sv .sv-ring::after{content:"";position:absolute;inset:8px;background:var(--surface);border-radius:50%}
.sv .sv-ring span{position:relative;z-index:1;font-size:14px;font-weight:700}
.sv .sv-val{width:58px;flex:none;text-align:center;font-size:17px;font-weight:700;line-height:1.15}
.sv .sv-val small{display:block;font-size:10px;color:var(--muted);font-weight:400;margin-top:2px}
.sv .sv-invbar{height:7px;border-radius:5px;background:#f3e5e4;overflow:hidden;margin-top:10px}
.sv .sv-invbar i{display:block;height:100%}
`;

function monter(el, options) {
  hote = typeof el === 'string' ? document.getElementById(el) : el;
  auFermer = (options && options.auFermer) || null;
  ecran = 'groupes'; ctx = {}; PILE.length = 0;
  filtreTexte = ''; filtreGroupe = null; filtreObjectif = null;
  if (!document.getElementById('sv-css')) {
    const st = document.createElement('style'); st.id = 'sv-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }
  rendre();
}

return { monter, aller, retour, rendre, fermer,
         chercher, chercherGlobal, ouvrirGroupe, filtrerObjectif,
         cyclePoids, poserObjectif, retirerObjectif, reglerPhase,
         nouvelExercice, nouveauModele, dupliquer, retirerDuModele, choisirPour,
         ajouterAuJour, lancer, saisir, basculer, terminer, reporter, saisirValeur };
})();
if (typeof window !== 'undefined') window.SportUI = SportUI;
