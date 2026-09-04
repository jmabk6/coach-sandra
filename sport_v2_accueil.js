/* ============================================================================
   Coach by JM — Module Sport v2 · page 1, l'accueil
   À charger APRÈS sport_v2_core.js, sport_v2_saisie.js et sport_v2_ui.js.
   Point d'entrée : SportAccueil.monter(el)

   Principe : le plan est posé d'avance par la semaine type. Rien à décider en
   arrivant à la salle. Le calendrier sert à consulter et à corriger.
   ========================================================================= */

const SportAccueil = (function () {

const S = SportV2;
let hote = null, ecran = 'accueil', ctx = {}, curseur = null;
const PILE = [];

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

const JOURS_L = ['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
const MOIS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août',
              'Septembre','Octobre','Novembre','Décembre'];
const aujourdhui = () => new Date().toISOString().slice(0, 10);
const libelleDate = iso => { const d = new Date(iso + 'T12:00');
  return JOURS_L[d.getDay()] + ' ' + d.getDate() + ' ' + MOIS[d.getMonth()].toLowerCase(); };
const typeDe = m => S.typeById(m && m.type) || { emoji: '📋', couleur: '#c0616a', nom: '' };

/* =========================================================================
   ACCUEIL
   ====================================================================== */

function vueAccueil() {
  const iso = aujourdhui();
  const e = S.etatJour(iso);
  const m = e.modeleId ? S.modeleById(e.modeleId) : null;

  /* La séance du jour, avant tout le reste : c'est l'écran qu'on ouvre en
     arrivant à la salle, pas un tableau de bord. */
  const hero = e.statut === 'fait' ? `
    <div class="sa-hero sa-ok">
      <div class="sa-j">${libelleDate(iso)}</div>
      <div class="sa-t">${esc(e.seance.nomAffiche)}</div>
      <div class="sv-meta">Séance faite ${e.seance.dureeReelle ? '· ' + e.seance.dureeReelle + ' min' : ''}</div>
      <div class="sa-btns"><button class="sa-o" onclick="SportAccueil.jour('${iso}')">Voir le détail</button></div>
    </div>`
    : !m ? `
    <div class="sa-hero sa-repos">
      <div class="sa-j">${libelleDate(iso)}</div>
      <div class="sa-t">Jour de repos</div>
      <div class="sv-meta">Rien au programme. Une marche ou 15 min de mobilité restent possibles.</div>
      <div class="sa-btns"><button class="sa-o" onclick="SportAccueil.changer('${iso}')">Faire quelque chose</button></div>
    </div>`
    : `
    <div class="sa-hero">
      <div class="sa-j">${libelleDate(iso)}</div>
      <div class="sa-t">${esc(m.nom)}</div>
      <div class="sv-meta">${typeDe(m).nom} — ${m.blocs.reduce((a,b)=>a+b.exercices.length,0)} exercices · ~${S.dureeEstimee(m)} min</div>
      <div class="sa-btns">
        <button class="sa-f" onclick="SportAccueil.commencer('${iso}','${m.id}')">Commencer</button>
        <button class="sa-o" onclick="SportAccueil.changer('${iso}')">Changer</button>
      </div>
    </div>`;

  /* La semaine : plus parlant qu'un mois entier pour savoir où on en est. */
  const sem = S.semaineDe(iso);
  const faits = sem.filter(j => j.statut === 'fait').length;
  const prevus = sem.filter(j => j.statut !== 'repos').length;
  const bande = sem.map(j => {
    const mm = j.modeleId ? S.modeleById(j.modeleId) : null;
    const t = mm ? typeDe(mm) : null;
    const cls = j.statut === 'fait' ? ' fait' : j.statut === 'manque' ? ' manque'
              : j.iso === iso ? ' now' : j.statut === 'repos' ? ' rep' : '';
    return `<button class="sa-sj${cls}" onclick="SportAccueil.jour('${j.iso}')">
      <span class="d">${'LMMJVSD'[(new Date(j.iso+'T12:00').getDay()+6)%7]}</span>
      <span class="e">${t ? t.emoji : '🌙'}</span>
      ${j.statut === 'fait' ? '<span class="v">✓</span>' : ''}</button>`;
  }).join('');

  return `
  <div class="sa-lbl">Aujourd'hui</div>
  ${hero}
  <div class="sa-lbl">Ma semaine</div>
  <div class="sa-sem">${bande}</div>
  <div class="sv-meta" style="margin-bottom:4px">${faits} séance${faits>1?'s':''} faite${faits>1?'s':''} sur ${prevus} cette semaine.</div>
  <div class="sa-lbl">Mon planning</div>
  ${calendrier()}
  <div class="card sv-row" onclick="SportAccueil.exercices()">
    <span class="sa-ico" style="background:var(--accent)">🏋️</span>
    <div class="sv-grow"><div class="sv-nm">Consulter mes exercices</div>
      <div class="sv-meta">${S.catalogue().length} exercices · fiches, consignes, historique</div></div>
    <span class="sv-chev">›</span></div>
  <div class="card sv-row" onclick="SportAccueil.programme()">
    <span class="sa-ico" style="background:#9a7878">📋</span>
    <div class="sv-grow"><div class="sv-nm">Mon programme</div>
      <div class="sv-meta">Objectifs · séances · semaine type</div></div>
    <span class="sv-chev">›</span></div>`;
}

/* =========================================================================
   CALENDRIER — n'importe quel jour est cliquable, passé compris
   ====================================================================== */

function calendrier() {
  const c = curseur || new Date();
  const an = c.getFullYear(), mo = c.getMonth();
  const jours = S.moisJours(an, mo);
  const auj = aujourdhui();
  const decalage = (new Date(an, mo, 1).getDay() + 6) % 7;

  const cases = '<div class="sa-day off"></div>'.repeat(decalage) + jours.map(j => {
    const mm = j.modeleId ? S.modeleById(j.modeleId) : null;
    const cls = [j.statut === 'fait' ? 'fait' : '', j.statut === 'manque' ? 'manque' : '',
                 j.iso === auj ? 'today' : ''].filter(Boolean).join(' ');
    const point = mm ? `<i class="p" style="background:${typeDe(mm).couleur}"></i>` : '';
    return `<button class="sa-day ${cls}" onclick="SportAccueil.jour('${j.iso}')">
      ${j.statut === 'fait' ? '<span class="chk">✓</span>' : ''}${j.jour}${point}</button>`;
  }).join('');

  const utilises = new Set(jours.map(j => j.modeleId).filter(Boolean)
    .map(id => (S.modeleById(id) || {}).type));
  const legende = S.types().filter(t => utilises.has(t.id)).map(t =>
    `<span><i class="sa-dot" style="background:${t.couleur}"></i>${esc(t.nom)}</span>`).join('');

  const ec = S.ecartsDuMois(jours[0] ? jours[0].iso : auj);
  return `<div class="card sa-cal">
    <div class="sa-calh">
      <button onclick="SportAccueil.mois(-1)">‹</button>
      <div class="m">${MOIS[mo]} ${an}</div>
      <button onclick="SportAccueil.mois(1)">›</button></div>
    <div class="sa-dows">${['L','M','M','J','V','S','D'].map(d=>`<div>${d}</div>`).join('')}</div>
    <div class="sa-days">${cases}</div>
    <div class="sa-lg">${legende}</div>
    ${ec ? `<div class="sv-meta" style="margin-top:8px">${ec} écart${ec>1?'s':''} au plan ce mois-ci.</div>` : ''}
  </div>
  <div class="sv-meta" style="margin:-2px 0 10px;text-align:center">Touche un jour pour noter ou modifier une séance.</div>`;
}

/* =========================================================================
   CHANGER — l'ajustement encadré
   ====================================================================== */

function vueChanger(iso) {
  const prevuId = S.prevuLe(iso);
  const m = prevuId ? S.modeleById(prevuId) : null;
  const memeType = prevuId ? S.alternatives(prevuId) : [];

  const carte = (mm, action, sous) => `<div class="card sv-row" onclick="${action}">
    <span class="sa-ico" style="background:${typeDe(mm).couleur}">${typeDe(mm).emoji}</span>
    <div class="sv-grow"><div class="sv-nm">${esc(mm.nom)}</div>
      <div class="sv-meta">${sous || (mm.blocs.reduce((a,b)=>a+b.exercices.length,0) + ' exercices · ~' + S.dureeEstimee(mm) + ' min')}</div></div>
    <span class="sv-chev">›</span></div>`;

  const autres = S.famillesType().map(f => {
    const dispo = f.types.filter(t => !m || t.id !== m.type).flatMap(t => S.modelesDuType(t.id));
    if (!dispo.length) return '';
    return dispo.map(mm => `<button class="sa-chip" onclick="SportAccueil.remplacer('${iso}','${mm.id}')">
        ${typeDe(mm).emoji} ${esc(typeDe(mm).nom)}</button>`).join('');
  }).join('');

  return `
  ${entete(libelleDate(iso))}
  ${m ? `<div class="sa-lbl">Au programme</div>${carte(m, `SportAccueil.commencer('${iso}','${m.id}')`)}` : ''}
  ${memeType.length ? `<div class="sa-lbl">Même type, plus court</div>` +
      memeType.map(mm => carte(mm, `SportAccueil.remplacer('${iso}','${mm.id}')`)).join('') : ''}
  ${m ? `<div class="sa-lbl">Décaler</div>
  <div class="card sv-row" onclick="SportAccueil.reporter('${iso}')">
    <span class="sa-ico" style="background:#9a7878">📅</span>
    <div class="sv-grow"><div class="sv-nm">Reporter au prochain jour libre</div>
      <div class="sv-meta">La semaine reste complète</div></div>
    <span class="sv-chev">›</span></div>` : ''}
  <div class="sa-lbl">Autre chose</div>
  <div class="sa-chips">${autres}</div>
  <div class="sv-meta" style="margin-top:8px">Changer de type sera noté comme un écart au plan.</div>
  ${m ? `<div class="sa-lbl">Rien aujourd'hui</div>
  <button class="btn-ghost" onclick="SportAccueil.repos('${iso}')">Marquer comme jour de repos</button>` : ''}`;
}

/* =========================================================================
   CHÂSSIS
   ====================================================================== */

function entete(titre) {
  return `<div class="sa-h2"><button class="sa-back" onclick="SportAccueil.retour()">‹ Retour</button>
    <div class="sa-t2">${esc(titre)}</div><span style="width:62px;flex:none"></span></div>`;
}

function aller(nom, arg) { PILE.push({ ecran, ctx }); ecran = nom; ctx = { arg }; rendre(); }
function retour() {
  const p = PILE.pop();
  if (!p) { ecran = 'accueil'; ctx = {}; }
  else { ecran = p.ecran; ctx = p.ctx; }
  rendre();
}

function rendre() {
  if (!hote) return;
  hote.innerHTML = `<div class="sv sa">${ecran === 'changer' ? vueChanger(ctx.arg) : vueAccueil()}</div>`;
}

/* ---- actions ---- */

function mois(d) {
  const c = curseur || new Date();
  curseur = new Date(c.getFullYear(), c.getMonth() + d, 1);
  rendre();
}

/* Le geste central : toucher un jour, quel qu'il soit. La saisie a posteriori
   s'occupe du passé, la déclaration du présent — c'est le même écran. */
function jour(iso) {
  SportSaisie.monter(hote, { auFermer: () => { SportAccueil.monter(hote); } });
  SportSaisie.jour(iso);
}

const changer = iso => aller('changer', iso);

function commencer(iso, modeleId) {
  const e = S.etatJour(iso);
  const s = (e.seance && e.seance.statut !== 'terminee') ? e.seance : S.instancier(modeleId, iso);
  if (window.SportSeance) { SportSeance.monter(hote, { auFermer: () => SportAccueil.monter(hote) });
                            SportSeance.ouvrir(s.id); return; }
  /* Tant que l'écran en direct n'existe pas, on retombe sur la saisie. */
  SportSaisie.monter(hote, { auFermer: () => SportAccueil.monter(hote) });
  SportSaisie.ouvrir(s.id);
}

function remplacer(iso, modeleId) { S.remplacerLeJour(iso, modeleId); retour(); }
function reporter(iso) {
  const cible = S.reporter(iso);
  if (!cible) alert("Aucun jour libre dans les sept prochains jours.");
  retour();
}
function repos(iso) { S.marquerRepos(iso); retour(); }

function exercices() {
  SportUI.monter(hote, { auFermer: () => SportAccueil.monter(hote) });
}
function programme() {
  if (window.SportProgramme) { SportProgramme.monter(hote, { auFermer: () => SportAccueil.monter(hote) }); return; }
  SportUI.monter(hote, { auFermer: () => SportAccueil.monter(hote) });
}

/* ---- CSS ---- */

const CSS = `
.sa .sa-lbl{font-size:10.5px;letter-spacing:.16em;text-transform:uppercase;color:#c9a6a3;margin:16px 0 8px}
.sa .sa-lbl:first-child{margin-top:0}
.sa .sa-h2{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:8px}
.sa .sa-t2{font-family:'Cormorant Garamond',serif;font-weight:700;font-size:20px;text-align:center;flex:1}
.sa .sa-back{background:none;border:1px solid var(--border);border-radius:10px;padding:7px 12px;
  font-size:14px;color:var(--muted);cursor:pointer;white-space:nowrap}
.sa .sa-hero{background:var(--surface);border:1.5px solid var(--accent);border-radius:18px;
  padding:15px;margin-bottom:8px}
.sa .sa-hero.sa-ok{border-color:#5f8a2f;background:#f7faf3}
.sa .sa-hero.sa-repos{border-color:var(--border)}
.sa .sa-j{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);font-weight:700}
.sa .sa-hero.sa-ok .sa-j{color:#5f8a2f}
.sa .sa-hero.sa-repos .sa-j{color:var(--muted)}
.sa .sa-t{font-family:'Cormorant Garamond',serif;font-weight:700;font-size:23px;margin:5px 0 2px}
.sa .sa-btns{display:flex;gap:8px;margin-top:12px}
.sa .sa-f{flex:1;background:var(--accent);color:#fff;border:0;border-radius:13px;padding:12px;
  font-weight:600;font-size:14.5px;cursor:pointer}
.sa .sa-o{border:1.5px solid var(--border);background:none;color:var(--muted);border-radius:13px;
  padding:12px 14px;font-weight:600;font-size:14px;cursor:pointer;white-space:nowrap}
.sa .sa-sem{display:grid;grid-template-columns:repeat(7,1fr);gap:5px;margin-bottom:6px}
.sa .sa-sj{background:var(--surface);border:1px solid var(--border);border-radius:11px;
  padding:8px 2px;text-align:center;cursor:pointer;position:relative}
.sa .sa-sj .d{font-size:10px;color:var(--muted);display:block}
.sa .sa-sj .e{font-size:16px;display:block;margin-top:3px}
.sa .sa-sj .v{position:absolute;top:2px;right:4px;font-size:9px;color:#5f8a2f}
.sa .sa-sj.rep{background:#fbf3f2;opacity:.7}
.sa .sa-sj.now{border-color:var(--accent);border-width:1.5px}
.sa .sa-sj.fait{background:#f2f7ec;border-color:#d8e6c6}
.sa .sa-sj.manque{border-color:#eccfcf;background:#fdf6f6}
.sa .sa-cal{padding:13px 11px}
.sa .sa-calh{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.sa .sa-calh .m{font-family:'Cormorant Garamond',serif;font-weight:700;font-size:19px}
.sa .sa-calh button{width:28px;height:28px;border-radius:50%;border:1px solid var(--border);
  background:none;color:var(--accent);cursor:pointer}
.sa .sa-dows,.sa .sa-days{display:grid;grid-template-columns:repeat(7,1fr);gap:4px}
.sa .sa-dows div{text-align:center;font-size:10.5px;color:var(--muted);padding-bottom:4px}
.sa .sa-day{aspect-ratio:1;border-radius:9px;background:#fdf7f7;border:1px solid transparent;
  display:flex;flex-direction:column;align-items:center;justify-content:center;font-size:13px;
  gap:3px;position:relative;cursor:pointer;color:var(--text);padding:0}
.sa .sa-day.off{background:none;cursor:default}
.sa .sa-day.today{border-color:var(--accent);border-width:1.5px;font-weight:700}
.sa .sa-day.fait{background:#eef3e6}
.sa .sa-day.manque{background:#fdeeee}
.sa .sa-day .p{width:6px;height:6px;border-radius:50%;display:block}
.sa .sa-day .chk{position:absolute;top:1px;right:3px;font-size:9px;color:#5f8a2f}
.sa .sa-lg{display:flex;flex-wrap:wrap;gap:4px 11px;font-size:11px;color:var(--muted);margin-top:10px}
.sa .sa-lg span{display:inline-flex;align-items:center;gap:5px}
.sa .sa-dot{width:7px;height:7px;border-radius:50%;display:inline-block}
.sa .sa-ico{width:40px;height:40px;border-radius:12px;display:flex;align-items:center;
  justify-content:center;font-size:19px;flex:none;color:#fff}
.sa .sa-chips{display:flex;gap:7px;flex-wrap:wrap}
.sa .sa-chip{background:var(--surface);border:1px solid var(--border);border-radius:20px;
  padding:8px 13px;font-size:13px;cursor:pointer;color:var(--text)}
`;

function monter(el, options) {
  hote = typeof el === 'string' ? document.getElementById(el) : el;
  if (!document.getElementById('sa-css')) {
    const st = document.createElement('style'); st.id = 'sa-css'; st.textContent = CSS;
    document.head.appendChild(st);
  }
  if (hote) hote.style.display = 'block';
  ecran = 'accueil'; ctx = {}; PILE.length = 0;
  rendre();
}

return { monter, rendre, retour, mois, jour, changer, commencer, remplacer,
         reporter, repos, exercices, programme };
})();
if (typeof window !== 'undefined') window.SportAccueil = SportAccueil;
