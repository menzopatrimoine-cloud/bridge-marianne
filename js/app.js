/* Le Bridge de Marianne — interface tablette (et téléphone) */
window.addEventListener("error", e => { window.__err = (window.__err || "") + e.message + " @" + e.lineno + (e.error && e.error.stack ? " [" + e.error.stack.split("\n").slice(1, 6).join(" < ") + "]" : "") + "; "; });
(function () {
'use strict';
const STORE = 'bridge-marianne-v1';
const $app = document.getElementById('app');
const $modal = document.getElementById('modal-root');
const DEFAULTS = { cardSize: 'grand', fourColors: false, speed: 'normal', doubleTap: true, showPoints: true, checkBids: true, deals: 'hasard', sound: true, volume: 'moyen', music: 'douce', voice: false, animations: true, tour: true };
const ORDER = [2, 3, 0, 1];                 // colonnes du tableau d'enchères : S O N E
const SPEED = { lent: 1.6, normal: 1, rapide: 0.55 };

let ON = null;               // table en ligne en cours (voir « Jeu en ligne »)
let G = load();
// votre portrait (photo, prénom, situation) : rangé à part pour ne pas réécrire la photo à chaque carte jouée
const PROFILE_KEY = 'bridge-marianne-profil';
let P = (() => { try { return JSON.parse(localStorage.getItem(PROFILE_KEY)) || {}; } catch (e) { return {}; } })();
function saveProfile() { try { localStorage.setItem(PROFILE_KEY, JSON.stringify(P)); return true; } catch (e) { return false; } }
let screen = 'home';
let runToken = 0;
let robotPending = false;   // un robot est déjà en train de réfléchir (jamais deux à la fois)
let dealing = false;        // distribution en cours : on attend avant d'annoncer
function cancelTimers() { runToken++; robotPending = false; }
let thinking = -1;          // joueur robot en train de réfléchir
let holdTrick = false;      // pli complet affiché un instant
let bidLevel = null;        // palier choisi dans la boîte d'enchères
let selected = null;        // carte soulevée (double toucher)
let hintCard = null;        // carte conseillée
let lastPlayed = null;      // dernière carte posée (pour l'animation)
let fly = null;             // carte en vol vers le pli : {card, rect, face}
let dealAnim = false;       // distribution animée au début de la donne
let dummyRevealKey = null;  // donne dont le mort a déjà été étalé (animation faite)
let newBidIdx = -1;         // dernière enchère posée (bulle animée)
let bidboxEnter = false;    // la boîte d'enchères arrive
let robotActed = true;      // un robot a joué depuis la dernière action de l'utilisatrice
let shownWon = null;        // compteurs de plis déjà affichés
const anim = () => G.settings.animations !== false;
const snd = n => { if (B.sound) B.sound.play(n); };
const say = t => { if (B.sound) B.sound.speak(t); };
// téléphone : petit écran → mise en page compacte (panneau réduit à une barre, main sur deux rangées en portrait)
const TEL = matchMedia('(max-width: 600px), (max-height: 520px)'), PORTRAIT = matchMedia('(orientation: portrait)');
const tel = () => TEL.matches;
const telPortrait = () => TEL.matches && PORTRAIT.matches;
let panelOpen = false;      // téléphone : enchères et explications ouvertes par-dessus le tapis
let oneRow = false;         // téléphone : la main repasse sur une rangée si le pli ne tient pas entre les mains

function load() {
  try {
    const x = JSON.parse(localStorage.getItem(STORE));
    if (x && x.settings) {
      x.settings = Object.assign({}, DEFAULTS, x.settings);
      x.stats = x.stats || { history: [] };
      if (!x.stats.me) x.stats.me = { v: x.stats.history.filter(h => h.ns > 0).length, d: x.stats.history.filter(h => h.ns < 0).length };
      return x;
    }
  } catch (e) { /* stockage indisponible */ }
  return { settings: Object.assign({}, DEFAULTS), stats: { history: [] }, game: null, nextBoard: 1 };
}
function save() { try { localStorage.setItem(STORE, JSON.stringify(ON ? Object.assign({}, G, { game: ON.solo }) : G)); } catch (e) { /* stockage indisponible */ } }

/* ---------- Petits utilitaires d'affichage ---------- */
const su = s => `<svg class="su su${s}" aria-hidden="true"><use href="#su${s}"/></svg>`;
// remplace les symboles ♠♥♦♣ des textes par les dessins (évite les émojis sur iPad)
const rich = t => String(t == null ? '' : t).replace(/[♠♥♦♣]/g, ch => su('♠♥♦♣'.indexOf(ch)));
const SEATN = ['Nord', 'Est', 'Sud', 'Ouest'];
// le partenaire (Nord) et les adversaires (Est, Ouest) ont un nom et un visage, tirés au sort à chaque donne
function persoIdx(s) {
  const g = G.game;
  if (!g || !g.opp) return s;
  if (s === 1) return g.opp[0];
  if (s === 3) return g.opp[1];
  if (g.nord != null) return g.nord;
  let i = 0;
  while (g.opp.includes(i)) i++;
  return i;
}
const perso = s => ON && ON.v && G.game && G.game.online ? onlinePerso(s) : B.PERSOS[persoIdx(s) % B.PERSOS.length];
const nameOf = s => s === 2 ? 'vous' : perso(s).name;
const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const seatName = s => s === 2 ? 'Vous' : nameOf(s);
// Roger, le chef du bridge : ses cours à l'Hippocampe
const chefOf = () => B.PERSOS.find(q => q.av.chef);
const CHEF_BADGE = '<span class="chef-badge">★ Chef du bridge</span>';
const CHEF_COURS = '<div class="chef-cours"><b>Le mardi :</b> cours intermédiaires et confirmés<br><b>Le jeudi :</b> cours débutants</div>';
const FICHE_PAGES = { '01': 3, '02': 1, '03': 1, '04': 2, '05': 1, '06': 2, '07': 3, '08': 2, '09': 2, '10': 2, '11': 2, '12': 2, '13': 2, '14': 3, '15': 1, '16': 1, '17': 1 };
const ficheBtn = f => FICHE_PAGES[f] ? `<button class="btn fiche-link" data-fiche="${f}">${ICONS.book}<span>Ouvrir la fiche du cours n° ${f} : ${rich(B.FICHES[f])}</span></button>` : '';
function callHTML(c, long) {
  if (c === 'P') return 'Passe';
  if (c === 'X') return 'Contre';
  if (c === 'XX') return long ? 'Surcontre' : 'Surc.';
  return c[0] + (c[1] === 'N' ? 'SA' : su(B.DEN_SUIT[c[1]]));
}
function callWords(c) {
  if (c === 'P') return 'Passe';
  if (c === 'X') return 'Contre';
  if (c === 'XX') return 'Surcontre';
  return c[0] + ' ' + (c[1] === 'N' ? 'Sans-Atout' : B.SUIT_NAME[B.DEN_SUIT[c[1]]]);
}
function contractHTML(ct) {
  if (!ct) return 'Donne passée';
  return ct.level + (ct.den === 'N' ? 'SA' : su(B.DEN_SUIT[ct.den])) + (ct.dbl === 2 ? ' surcontré' : ct.dbl === 1 ? ' contré' : '');
}
function cardHTML(c, cls) {
  const s = B.suitOf(c), r = B.rankOf(c), rt = B.RANK_TXT[r];
  const face = r >= 9 && r <= 11 ? `<span class="hl">${rt}</span>` : '';
  return `<div class="card c${s} ${cls || ''}" data-c="${c}"><span class="ci"${r === 8 ? ' style="letter-spacing:-0.09em"' : ''}><b>${rt}</b>${su(s)}</span><span class="cc">${face}${su(s)}</span></div>`;
}
function handText(h) {
  return [0, 1, 2, 3].map(s => {
    const r = B.ranksIn(h, s).map(x => B.RANK_TXT[x]).join(' ');
    return `<div>${su(s)} ${r || '—'}</div>`;
  }).join('');
}
function toast(msg, ms) {
  const old = document.querySelector('.toast');
  if (old) old.remove();
  const d = document.createElement('div');
  d.className = 'toast';
  d.innerHTML = rich(msg);
  // pendant la partie, le message s'affiche sur le panneau : jamais par-dessus les cartes
  // (sur téléphone en portrait, par-dessus la barre du bas, collé en bas de l'écran)
  const pan = screen === 'game' && document.querySelector('.panel');
  if (pan) {
    const r = pan.getBoundingClientRect();
    Object.assign(d.style, { left: r.left + r.width / 2 + 'px', top: r.top + (tel() ? 8 : 12) + 'px', maxWidth: r.width - (tel() ? 12 : 24) + 'px' });
    if (telPortrait()) Object.assign(d.style, { top: 'auto', bottom: innerHeight - r.bottom + 6 + 'px' });
  }
  document.body.appendChild(d);
  setTimeout(() => d.remove(), ms || 2600);
}
function modal(html, onClick, cls) {
  $modal.innerHTML = `<div class="overlay"><div class="sheet ${cls || ''}">${html}</div></div>`;
  const ov = $modal.firstChild;
  ov.addEventListener('click', e => {
    const b = e.target.closest('[data-m]');
    if (b) { const v = b.dataset.m; closeModal(); if (onClick) onClick(v); return; }
    if (e.target === ov && !/\b(profil|noclose)\b/.test(cls || '')) closeModal();
  });
}
function closeModal() { $modal.innerHTML = ''; }
// les annonces restent plus longtemps à l'écran, pour bien voir qui a dit quoi
const delay = kind => ({ bid: 2000, card: 700, trick: 1100, lead: 1100 })[kind] * SPEED[G.settings.speed];

/* ---------- Donnes ---------- */
function newDeal(sameHands, preset, expert) {
  cancelTimers();
  closeModal();
  let hands, board;
  panelOpen = false; oneRow = false;
  if (preset) { hands = preset.hands; board = preset.board; }
  else if (sameHands && G.game) { hands = G.game.hands; board = G.game.board; }
  else {
    board = G.nextBoard || 1;
    G.nextBoard = board + 1;
    for (let i = 0; i < 300; i++) {
      hands = B.randomHands();
      if (G.settings.deals !== 'jeu') break;
      if (B.hcp(hands[0]) + B.hcp(hands[2]) >= 22) break;
    }
  }
  const info = preset || (typeof board === 'number' ? B.boardInfo(board) : { dealer: G.game.dealer, vul: G.game.vul });
  // trois personnages différents : Est, Ouest et le partenaire Nord
  const picks = sameHands && G.game && G.game.opp && G.game.nord != null ? [G.game.opp[0], G.game.opp[1], G.game.nord] : pickPersos();
  G.game = { board, dealer: info.dealer, vul: info.vul, hands, auction: [], phase: 'bidding', play: null, contract: null, undo: [], selCall: null, result: null, recorded: false, opp: [picks[0], picks[1]], nord: picks[2], learn: preset ? preset.learn : undefined,
    expert: !preset && (sameHands ? !!(G.game && G.game.expert) : !!expert) };
  thinking = -1; holdTrick = false; bidLevel = null; selected = null; hintCard = null; lastPlayed = null;
  fly = null; dealAnim = true; dummyRevealKey = null; newBidIdx = -1; robotActed = true; shownWon = [0, 0];
  save();
  // une nouvelle partie : chacun se présente d'abord, on distribue ensuite
  if (!preset && !sameHands && G.settings.tour !== false) {
    screen = 'tour';
    render();
    [0, 3, 1].forEach(s => say(perso(s).hello));
    return;
  }
  beginDeal(!sameHands);
}
function beginDeal(announce) {
  screen = 'game';
  snd('shuffle');
  dealing = anim();
  render();
  if (announce) {
    const who = P.name ? `<b>${esc(P.name)}</b>${P.title ? ', ' + esc(P.title) + ',' : ''} joue` : 'Vous jouez';
    toast(`${who} avec <b>${perso(0).name}</b>, ${perso(0).title}, contre <b>${perso(3).name}</b>, ${perso(3).title}, et <b>${perso(1).name}</b>, ${perso(1).title}.${G.game.expert ? EXPERT_TXT : ''}`, 5200);
  } else if (G.game.expert) toast(EXPERT_TXT.slice(4), 3400);
  const tok = runToken;
  setTimeout(() => { if (tok !== runToken) return; dealing = false; step(); }, dealing ? 900 : 0);
}
function pickPersos() {
  const pool = B.PERSOS.map((_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const picks = pool.slice(0, 3);
  // Roger, le chef du bridge, vient plus souvent : environ une donne sur trois, volontiers en partenaire
  const chef = B.PERSOS.indexOf(chefOf());
  if (!picks.includes(chef) && Math.random() < 0.2) picks[2] = chef;
  return picks;
}
const backAct = () => G.game && (G.game.online || G.game.phase !== 'end') ? 'resume' : 'go:home';
/* ---------- Tour de table : chacun se présente avant de jouer ---------- */
function tourSeat(pos, i, av, name, role, text, chef, extra) {
  return `<div class="tour-p ${pos} ${chef ? 'chef' : ''}" style="--i:${i}">${av}<div class="tour-t">
    <div class="tour-n"><b>${name}</b>${chef ? CHEF_BADGE : ''}${extra || ''}<small>${role}</small></div>
    <div class="tour-b">${text}</div>${chef ? CHEF_COURS : ''}</div></div>`;
}
function renderTour() {
  const robot = (s, pos, i, role) => { const q = perso(s); return tourSeat(pos, i, B.avatarSVG(q), q.name, `${role} · ${q.title}`, `« ${q.hello} »`, !!q.av.chef); };
  $app.innerHTML = `<div class="tour ${anim() ? 'anim' : ''}"><div class="tour-in">
    <h1>Tour de table</h1>
    <div class="tour-grid">
      ${robot(0, 'n', 0, 'votre partenaire')}
      ${robot(3, 'w', 1, 'adversaire')}
      ${robot(1, 'e', 2, 'adversaire')}
      ${tourSeat('s', 3, meAvatar(), P.name ? esc(P.name) : 'Vous', P.title ? esc(P.title) : 'Sud', `Vous jouez avec <b>${perso(0).name}</b>, en face de vous, contre <b>${perso(3).name}</b> et <b>${perso(1).name}</b>.`, false)}
    </div>
    <button class="btn primary tour-go" data-act="tour-go">À table !</button>
    <div class="tour-note">Le tour de table peut être retiré dans les Réglages.</div>
  </div></div>`;
}
/* ---------- La découverte des personnages ---------- */
function renderPersos() {
  const list = B.PERSOS.slice().sort((a, b) => (b.av.chef ? 1 : 0) - (a.av.chef ? 1 : 0));
  $app.innerHTML = `<div class="page"><div class="inner">
    <button class="btn back" data-act="${backAct()}">← Retour</button>
    <h1>Les personnages</h1>
    <p>Voici les ${list.length} joueurs que vous pouvez retrouver à votre table, comme partenaire ou comme adversaire.</p>
    <div class="pc-list">${list.map(q => `<div class="pc ${q.av.chef ? 'chef' : ''}">${B.avatarSVG(q)}<div class="pc-t">
      <div class="pc-n"><b>${q.name}</b>${q.av.chef ? CHEF_BADGE : ''}</div><small>${q.title}</small>
      <p>${q.bio}</p>${q.av.chef ? CHEF_COURS : ''}<p class="pc-h">« ${q.hello} »</p></div></div>`).join('')}</div>
  </div></div>`;
}

/* ---------- Missions : des fins de donne à réussir, de plus en plus difficiles ---------- */
const MP = () => G.missions = G.missions || { done: {}, fails: {} };
const missionOf = g => g && g.mission ? B.mission.byId(g.mission) : null;
const missionList = parcours => B.MISSIONS.filter(m => m.parcours === parcours);
const PARCOURS = { decl: 'Faire les plis', def: 'Empêcher les plis' };
const stars = n => `<span class="stars" aria-label="difficulté ${n} sur 5">${'★'.repeat(n)}<i>${'★'.repeat(5 - n)}</i></span>`;
// une mission s'ouvre quand la précédente est réussie (ou ratée 3 fois : on n'est jamais bloquée)
function missionOpen(m) {
  const list = missionList(m.parcours), i = list.indexOf(m);
  if (i <= 0) return true;
  const prev = list[i - 1], mp = MP();
  return !!mp.done[prev.id] || (mp.fails[prev.id] || 0) >= 3;
}
function nextMission(m) {
  const list = missionList(m.parcours);
  return list[list.indexOf(m) + 1] || missionList(m.parcours === 'decl' ? 'def' : 'decl').find(x => !MP().done[x.id] && missionOpen(x)) || null;
}
// plis faits par Nord-Sud depuis le début de la mission, et plis qu'il faut
const missionTricks = g => g.play.won[0] - missionOf(g).deja[0];
function startMission(id) {
  const m = B.mission.byId(id);
  if (!m) return;
  cancelTimers();
  closeModal();
  panelOpen = false; oneRow = false;
  const st = B.mission.startState(m);
  const again = G.game && G.game.mission === id && G.game.opp && G.game.nord != null;
  const picks = again ? [G.game.opp[0], G.game.opp[1], G.game.nord] : pickPersos();
  G.game = { mission: id, board: m.titre, dealer: st.declarer, vul: '-', hands: st.hands.map(h => h.slice()), auction: [], phase: 'play', play: st,
    contract: B.mission.contractOf(m), undo: [], selCall: null, result: null, recorded: false, opp: [picks[0], picks[1]], nord: picks[2] };
  thinking = -1; holdTrick = false; bidLevel = null; selected = null; hintCard = null; lastPlayed = null;
  fly = null; dealAnim = true; dummyRevealKey = id; newBidIdx = -1; robotActed = true; shownWon = st.won.slice();
  screen = 'game';
  save();
  snd('shuffle');
  render();
  const n = missionList(m.parcours).indexOf(m) + 1;
  modal(`<div class="mi-k">${PARCOURS[m.parcours]} · mission ${n} ${stars(m.niveau)}</div><h2>${m.titre}</h2>
    <p>${rich(m.histoire)}</p><p class="mi-goal">${B.mission.objectif(m)}</p>
    <p class="mi-note">${m.parcours === 'decl' ? `Vous jouez vos cartes et celles du mort (${nameOf(0)}, en haut).` : `Vous jouez vos cartes ; ${nameOf(0)}, en haut, est votre partenaire.`}
    Les robots voient toutes les cartes et jouent parfaitement : seul le bon plan réussit. Le bouton « Conseil » donne un indice.</p>
    <div class="btns"><button class="btn primary" data-m="go">C'est parti !</button></div>`, null, 'mission-intro');
  step();
}
function missionSlipCheck(seat, card) {
  // avant de jouer : cette carte rend-elle la mission impossible alors qu'elle était encore jouable ?
  const g = G.game, p = g.play, m = missionOf(g);
  if (!m || p.slip || !userControls(seat) || B.legalCards(p, seat).length < 2) return false;
  try {
    const { ev, top } = B.mission.exact(p, seat);
    const need = B.mission.goalOf(m) - missionTricks(g);
    const mine = ev.find(x => x.card === card);
    return top >= need && mine && mine.ns < need;
  } catch (e) { return false; }
}
// les fiches en PDF, prêtes à imprimer (un onglet s'ouvre ; sur l'iPad : Partager, puis Imprimer)
const PDF_V = 3;   // à augmenter quand une fiche PDF change
const fichePdf = k => `fiches/pdf/fiche-${k}.pdf?v=${PDF_V}`;
const pdfLink = (href, label, cls) => `<a class="btn pdf-btn ${cls || ''}" href="${href}" target="_blank" rel="noopener">${ICONS.print}<span>${label}</span></a>`;
const ficheListHTML = () => `<div class="fiche-list">${Object.keys(B.FICHES).sort().map(k => `<div class="fiche-row"><button class="btn" data-fiche="${k}">${ICONS.book}<span>Fiche ${k} : ${rich(B.FICHES[k])}</span></button>${pdfLink(fichePdf(k), 'PDF')}</div>`).join('')}</div>`;
function renderFiches() {
  const inGame = backAct() === 'resume';
  $app.innerHTML = `<div class="page"><div class="inner">
    <button class="btn back ${inGame ? 'sticky' : ''}" data-act="${backAct()}">${inGame ? '← Retour au jeu' : '← Retour'}</button>
    <h1>Les fiches du cours</h1>
    <div class="chef-box">${B.avatarSVG(chefOf())}<div><div class="pc-n"><b>Roger</b>${CHEF_BADGE}</div><p>Les fiches du cours ont été créées par Roger, le chef du bridge de l'Hippocampe.</p></div></div>
    <p>Toutes les fiches d'apprentissage, en gros caractères. Touchez une fiche pour l'ouvrir en grand.</p>
    <div class="pdf-all">${pdfLink(`fiches/pdf/cours-complet.pdf?v=${PDF_V}`, 'Imprimer tout le cours (PDF)', 'gold')}</div>
    <p class="pdf-how">Pour imprimer une seule fiche, touchez « PDF » à côté d'elle. Sur l'iPad, touchez ensuite le bouton Partager, puis « Imprimer ».</p>
    ${ficheListHTML()}
  </div></div>`;
}
function renderMissions() {
  const mp = MP();
  const done = B.MISSIONS.filter(m => mp.done[m.id]).length;
  const row = (m, i) => {
    const open = missionOpen(m), ok = mp.done[m.id];
    return `<div class="mi-row ${open ? '' : 'locked'} ${ok ? 'ok' : ''}">
      <div class="mi-n">${ok ? '✓' : i + 1}</div>
      <div class="mi-t"><b>${m.titre}</b>${stars(m.niveau)}<small>${ok ? 'Réussie' : open ? (mp.fails[m.id] ? `À réussir · ${plural(mp.fails[m.id], 'essai')}` : 'À jouer') : 'Réussissez d\'abord la mission précédente'}</small></div>
      ${open ? `<button class="btn ${ok ? '' : 'primary'}" data-act="mission:${m.id}">${ok ? 'Rejouer' : 'Jouer'}</button>` : '<span class="mi-lock">🔒</span>'}</div>`;
  };
  const block = k => `<h2>${PARCOURS[k]} <small>${k === 'decl' ? 'vous êtes déclarant : faites vos plis' : 'vous êtes en défense : faites chuter le contrat'}</small></h2>
    <div class="mi-list">${missionList(k).map(row).join('')}</div>`;
  $app.innerHTML = `<div class="page"><div class="inner">
    <button class="btn back" data-act="go:home">← Accueil</button>
    <h1>Les missions</h1>
    <p>Chaque mission est une fin de donne avec un but : faire assez de plis, ou empêcher l'adversaire de faire les siens. Chaque mission reprend une leçon de la fiche « Jeu de la carte », et elles deviennent de plus en plus difficiles. <b>${done} sur ${B.MISSIONS.length}</b> réussies.</p>
    ${block('decl')}${block('def')}
  </div></div>`;
}
function missionEndHTML() {
  const g = G.game, r = g.result, m = missionOf(g), p = g.play;
  const goal = B.mission.goalOf(m), made = missionTricks(g), left = B.mission.startState(m).hands[B.mission.startState(m).turn].length;
  const pa = perso(0), op = perso(m.parcours === 'decl' ? 1 : g.contract.declarer);
  const line = (q, txt, who) => `<div class="quip">${B.avatarSVG(q)}<div><b>${q.name}</b> <small>${who}</small><br>« ${txt} »</div></div>`;
  const nx = nextMission(m), mp = MP();
  ensureAnalysis();
  const h = g.hands;
  const hbox = (s, cls2) => `<div class="h ${cls2}"><div class="nm">${seatName(s)}</div>${handText(h[s])}</div>`;
  return `<div class="end"><div class="box">
    <div class="res ${r.ok ? 'ok' : 'ko'}">${r.ok ? 'Mission réussie !' : 'Mission ratée'}</div>
    <div class="score">Nord-Sud a fait <b>${plural(made, 'pli')}</b> sur les ${left} : il en fallait <b>${goal}</b>.${p.claimed ? ` (dont ${p.claimed} réclamés)` : ''}</div>
    <div class="quips">${line(pa, r.ok ? pa.avecGagne : pa.avecPerd, 'votre partenaire')}${line(op, r.ok ? op.perd : op.gagne, 'adversaire')}</div>
    <div class="mi-lesson"><b>La leçon :</b> ${rich(m.lecon)}${ficheBtn('09')}</div>
    <div class="an-status">${anStatusHTML()}</div>
    <div class="btns">
      ${r.ok && nx ? `<button class="btn primary" data-act="mission:${nx.id}">Mission suivante : ${nx.titre}</button>` : ''}
      ${!r.ok ? '<button class="btn primary" data-act="replay">↻ Recommencer la mission</button>' : '<button class="btn" data-act="replay">↻ Rejouer la mission</button>'}
      ${!r.ok && nx && (mp.fails[m.id] || 0) >= 3 ? `<button class="btn" data-act="mission:${nx.id}">Passer à la suivante</button>` : ''}
      <button class="btn" data-act="go:missions">Toutes les missions</button>
      <button class="btn" data-act="undo" ${g.undo.length ? '' : 'disabled'}>${ICONS.undo}Annuler la dernière carte</button></div>
    <details><summary>Les mains du début de la mission</summary><div class="compass">${hbox(0, 'hn')}${hbox(3, 'hw')}<div class="mid">${m.titre}</div>${hbox(1, 'he')}${hbox(2, 'hs')}</div></details>
  </div></div>`;
}
function finishMission() {
  const g = G.game, p = g.play, m = missionOf(g);
  const ok = B.mission.won(m, p);
  g.result = { mission: true, ok, tricks: p.won[B.sideOf(g.contract.declarer)], made: ok === (B.sideOf(g.contract.declarer) === 0), ns: ok ? 1 : -1 };
  g.phase = 'end';
  g.recorded = true;
  const mp = MP();
  if (ok) mp.done[m.id] = true;
  else mp.fails[m.id] = (mp.fails[m.id] || 0) + 1;
  save();
  render();
  snd(ok ? 'success' : 'fail');
  say(ok ? 'Mission réussie !' : 'Mission ratée.');
  if (ok && anim()) confetti();
}
/* ---------- Apprendre : mini-bridge, cours pas à pas, donnes commentées ---------- */
const LC = B.lecons;
const LP = () => G.learn = G.learn || { lu: {}, donnes: {} };
const boardLabel = g => g.learn || g.mission ? g.board : 'Donne n° ' + g.board + (g.expert ? ' · expert' : '');
const EXPERT_TXT = '<br><b>Mode expert</b> : aucun conseil pendant la donne.';
let learnView = { theme: 'contrat', lecon: null, chap: 'c1', filtre: 'tout' };
const ldKey = (kind, group, i) => `${kind}:${group}:${i}`;
const stIcon = st => `<span class="ld-st ${st || 'vide'}">${st === 'ok' ? '✓' : st === 'ko' ? '✗' : st === 'enc' ? '…' : ''}</span>`;
function groupProgress(kind, group) {
  const n = LC.count(kind, group), d = LP().donnes;
  let ok = 0, any = false;
  for (let i = 0; i < n; i++) { const st = d[ldKey(kind, group, i)]; if (st === 'ok') ok++; if (st) any = true; }
  return { n, ok, any };
}
const chip = (a, b) => `<span class="ld-chip ${a >= b ? 'full' : a ? 'part' : ''}">${a}/${b}</span>`;
function dealRows(kind, group) {
  const n = LC.count(kind, group), d = LP().donnes;
  return Array.from({ length: n }, (_, i) => `<button class="ld-row" data-act="ld:${kind}:${group}:${i}">${stIcon(d[ldKey(kind, group, i)])}<b>Donne ${i + 1}</b><i>›</i></button>`).join('');
}
function startLearn(kind, group, i) {
  const d = LC.dealOf(LC.seedOf(kind, group, i));
  const learn = { kind, group, i, key: ldKey(kind, group, i) }, label = LC.labelOf(kind, group, i), don = LP().donnes;
  if (don[learn.key] !== 'ok') don[learn.key] = 'enc';
  if (kind === 'mini') startMini(d, learn, label);
  else newDeal(false, { hands: d.hands, dealer: d.dealer, vul: d.vul, board: label, learn });
}
function learnBack() {
  const l = G.game && G.game.learn;
  if (l && l.kind === 'mini') { learnView.theme = l.group; screen = 'lm'; }
  else if (l && l.kind === 'cours') { learnView.chap = l.group; screen = 'chapitre'; }
  else screen = 'comm';
  cancelTimers();
  render();
}
function learnNext() {
  const l = G.game.learn;
  if (l.i + 1 < LC.count(l.kind, l.group)) startLearn(l.kind, l.group, l.i + 1);
  else { learnBack(); toast('C\'était la dernière donne de cette série. Bravo !'); }
}
function bidErrors(g) {
  let n = 0;
  g.auction.forEach((call, i) => {
    if ((g.dealer + i) % 4 !== 2) return;
    const h = B.decide(g.hands[2], g.auction.slice(0, i), g.dealer);
    if (h.sure && h.call !== call) n++;
  });
  return n;
}
function learnResult() {
  const g = G.game, l = g.learn, ch = l.kind === 'cours' && LC.chapitre(l.group);
  const ok = (ch && ch.type === 'bid') || g.result.passed ? bidErrors(g) === 0 : g.result.ns > 0;
  const don = LP().donnes;
  don[l.key] = ok || don[l.key] === 'ok' ? 'ok' : 'ko';
}
// cours : les enchères sont finies, on propose le commentaire ou de jouer la carte
function afterBids() {
  const g = G.game, errs = bidErrors(g), l = g.learn, don = LP().donnes;
  don[l.key] = !errs || don[l.key] === 'ok' ? 'ok' : 'ko';
  save();
  render();
  clearToast();
  modal(`<h2>${errs ? 'Enchères terminées' : 'Bravo, vos enchères suivent le cours !'}</h2>
    ${errs ? `<p><b>${plural(errs, 'enchère')}</b> s'écarte${errs > 1 ? 'nt' : ''} du cours : le commentaire montre ce qu'il fallait dire.</p>` : ''}
    <p>Contrat : <b>${contractHTML(g.contract)}</b> joué par ${nameOf(g.contract.declarer)}.</p>
    <div class="btns"><button class="btn primary" data-m="comment">${ICONS.book}Lire le commentaire</button><button class="btn" data-m="play">Jouer la carte</button></div>`,
  v => { if (v === 'comment') { screen = 'comment'; render(); } else step(); }, 'noclose');
}

/* --- le mini-bridge : compter les points, savoir qui joue, choisir le contrat --- */
function startMini(d, learn, label) {
  cancelTimers();
  closeModal();
  panelOpen = false; oneRow = false;
  const picks = pickPersos(), info = LC.miniInfo(d.hands);
  G.game = { board: label, dealer: d.dealer, vul: '-', hands: d.hands, auction: [], phase: 'mini', play: null, contract: null, undo: [], selCall: null, result: null, recorded: false,
    opp: [picks[0], picks[1]], nord: picks[2], learn, mini: Object.assign(info, { step: 0, den: null, manche: null }) };
  thinking = -1; holdTrick = false; bidLevel = null; selected = null; hintCard = null; lastPlayed = null;
  fly = null; dealAnim = true; dummyRevealKey = null; newBidIdx = -1; robotActed = true; shownWon = [0, 0]; dealing = false; bidboxEnter = true;
  screen = 'game';
  save();
  snd('shuffle');
  render();
}
function miniBoxHTML() {
  const g = G.game, m = g.mini, enter = bidboxEnter && anim();
  bidboxEnter = false;
  let body;
  if (m.step === 0) {
    const v = m.pts[2], opts = [v, v + 1, v + 3, Math.max(0, v - 2)].filter((x, i, a) => a.indexOf(x) === i).sort((a, b) => a - b);
    body = `<div class="title">Combien de points H avez-vous ?</div><div class="row levels">${opts.map(x => `<button data-act="mini:pts:${x}">${x}</button>`).join('')}</div>
      <div class="pts">As = 4 · Roi = 3 · Dame = 2 · Valet = 1</div>`;
  } else if (m.step === 1) {
    body = `<div class="title">Quel camp joue le contrat ?</div><div class="pts">Nord-Sud : <b>${m.ns} points</b> · Est-Ouest : <b>${m.eo} points</b></div>
      <div class="row calls"><button data-act="mini:side:0">Nord-Sud</button><button data-act="mini:side:1">Est-Ouest</button></div>`;
  } else {
    const dens = [['C', 3], ['D', 2], ['H', 1], ['S', 0], ['N', -1]];
    const lab = man => m.den ? callHTML(LC.miniLevel(m.den, man) + m.den, true) : '';
    body = `<div class="title">Choisissez le contrat</div><div class="pts">Votre camp a <b>${m.ns} points</b></div>
      <div class="row dens">${dens.map(([d, x]) => `<button data-act="mini:den:${d}" class="${d === 'N' ? 'nt' : ''} ${m.den === d ? 'on' : ''}">${x >= 0 ? su(x) : 'SA'}</button>`).join('')}</div>
      <div class="row calls"><button data-act="mini:man:0" class="${m.manche === false ? 'on' : ''}">Partielle ${lab(false)}</button><button data-act="mini:man:1" class="${m.manche === true ? 'on' : ''}">Manche ${lab(true)}</button></div>
      <div class="row calls"><button class="mini-go" data-act="mini:ok" ${m.den && m.manche != null ? '' : 'disabled'}>Jouer ce contrat</button></div>`;
  }
  return `<div class="bidbox ${enter ? 'enter' : ''}">${body}</div>`;
}
function setMiniContract(ct) {
  const g = G.game;
  g.contract = { level: ct.level, den: ct.den, dbl: 0, declarer: ct.declarer };
  g.play = B.newPlay(g.hands, g.contract);
  g.play.auction = [];
  g.play.dealer = g.dealer;
  g.phase = 'play';
  const ns = B.sideOf(ct.declarer) === 0;
  toast(`Contrat : <b>${contractHTML(g.contract)}</b> joué par ${nameOf(ct.declarer)}.<br>${ns ? `${nameOf(g.play.leader)} entame, puis vous jouez aussi les cartes du mort.` : g.play.leader === 2 ? 'C\'est à vous d\'entamer.' : nameOf(g.play.leader) + ' entame.'}`, 4600);
  save();
  step();
}
function miniAct(what, val) {
  const g = G.game, m = g.mini;
  if (!m || g.phase !== 'mini') return;
  if (what === 'pts') {
    if (+val === m.pts[2]) { m.step = 1; snd('select'); bidboxEnter = true; save(); render(); }
    else { snd('error'); toast('Recomptez : As = 4, Roi = 3, Dame = 2, Valet = 1. Le bouton « Conseil » vous aide.', 3400); }
  } else if (what === 'side') {
    if (+val !== m.side) { snd('error'); toast('Regardez le total : c\'est le camp qui a le plus de points qui joue.', 3400); return; }
    snd('select');
    if (m.side === 0) {
      m.step = 2; bidboxEnter = true; save(); render();
      toast(`Votre camp a le plus de points, et vous en avez plus que ${nameOf(0)} : vous êtes déclarant. ${nameOf(0)} étale son jeu, c'est le mort.`, 4800);
    } else setMiniContract(LC.miniAdvice(g.hands, m.declarer));
  } else if (what === 'den') { m.den = val; snd('select'); render(); }
  else if (what === 'man') { m.manche = val === '1'; snd('select'); render(); }
  else if (what === 'ok') {
    const adv = LC.miniAdvice(g.hands, m.declarer), level = LC.miniLevel(m.den, m.manche), mine = { level, den: m.den, dbl: 0, declarer: m.declarer };
    if (adv.level === level && adv.den === m.den) { setMiniContract(mine); return; }
    modal(`<h2>Le cours conseille plutôt ${callHTML(adv.level + adv.den, true)}</h2><p>${miniReason(adv)}</p>
      <div class="btns"><button class="btn primary" data-m="adv">Jouer ${callHTML(adv.level + adv.den, true)}</button><button class="btn" data-m="mine">Garder ${callHTML(level + m.den, true)}</button></div>`,
    v => { if (v === 'adv') setMiniContract(adv); else if (v === 'mine') setMiniContract(mine); });
  }
}
function miniReason(adv) {
  const fit = adv.den === 'N' ? 'Votre camp n\'a pas 8 cartes à cœur ou à pique : on joue à Sans-Atout.' : `Votre camp a ${adv.trumps} cartes à ${LC.NOM[B.DEN_SUIT[adv.den]]} : c'est l'atout.`;
  return `${fit} Avec ${adv.total} points, ${adv.manche ? 'on peut jouer la manche (25 points ou plus)' : 'on reste en partielle (moins de 25 points)'}.`;
}
function miniHint() {
  const g = G.game, m = g.mini;
  let body;
  if (m.step === 0) {
    const detail = [0, 1, 2, 3].map(s => {
      const pt = B.ranksIn(g.hands[2], s).filter(r => r >= 9).map(r => ({ 12: 'As 4', 11: 'Roi 3', 10: 'Dame 2', 9: 'Valet 1' })[r]);
      return pt.length ? `${su(s)} ${pt.join(' + ')}` : '';
    }).filter(Boolean).join('<br>');
    body = `<h2>Comptez vos honneurs</h2><p>${detail || 'Vous n\'avez aucun honneur.'}</p><p>Total : <b>${m.pts[2]} points H</b>.</p>`;
  } else if (m.step === 1) body = `<h2>Additionnez les deux camps</h2><p>Nord-Sud : ${m.pts[0]} + ${m.pts[2]} = <b>${m.ns}</b>.<br>Est-Ouest : ${m.pts[1]} + ${m.pts[3]} = <b>${m.eo}</b>.</p><p>Le camp qui a le plus de points joue le contrat.</p>`;
  else { const adv = LC.miniAdvice(g.hands, m.declarer); body = `<h2>Conseil : ${callHTML(adv.level + adv.den, true)}</h2><p>${miniReason(adv)}</p>`; }
  modal(`${body}<div class="btns"><button class="btn primary" data-m="no">Compris</button></div>`);
}
function finishMini() {
  const g = G.game, p = g.play, ct = g.contract, side = B.sideOf(ct.declarer), tricks = p.won[side], made = tricks >= ct.level + 6;
  const ok = side === 0 ? made : !made, don = LP().donnes;
  g.result = { mini: true, ok, tricks, made, ns: ok ? 1 : -1 };
  g.phase = 'end';
  g.recorded = true;
  don[g.learn.key] = ok || don[g.learn.key] === 'ok' ? 'ok' : 'ko';
  save();
  render();
  snd(ok ? 'success' : 'fail');
  say(ok ? 'Bravo !' : 'Dommage.');
  if (ok && anim()) confetti();
}
function miniEndHTML() {
  const g = G.game, r = g.result, ct = g.contract, need = ct.level + 6, ns = B.sideOf(ct.declarer) === 0;
  const pa = perso(0), op = perso(1);
  const line = (q, txt, who) => `<div class="quip">${B.avatarSVG(q)}<div><b>${q.name}</b> <small>${who}</small><br>« ${txt} »</div></div>`;
  ensureAnalysis();
  return `<div class="end"><div class="box">
    <div class="res ${r.ok ? 'ok' : 'ko'}">${r.ok ? (ns ? 'Contrat réussi !' : 'Bravo, le contrat adverse chute !') : (ns ? `Chute de ${need - r.tricks}` : 'Les adversaires réussissent leur contrat')}</div>
    <div class="score">${contractHTML(ct)} joué par ${nameOf(ct.declarer)} : <b>${plural(r.tricks, 'pli')}</b>, il en fallait ${need}.</div>
    <div class="quips">${line(pa, r.ok ? pa.avecGagne : pa.avecPerd, 'votre partenaire')}${line(op, r.ok ? op.perd : op.gagne, 'adversaire')}</div>
    <button class="btn green mi-comment" data-act="comment">${ICONS.book}Lire le commentaire de la donne</button>
    <div class="an-status">${anStatusHTML()}</div>
    <div class="btns"><button class="btn primary" data-act="learn-next">Donne suivante</button>
      <button class="btn" data-act="replay">Rejouer cette donne</button>
      <button class="btn" data-act="undo" ${g.undo.length ? '' : 'disabled'}>${ICONS.undo}Annuler la dernière carte</button></div>
  </div></div>`;
}

/* --- les pages --- */
function renderApprendre() {
  const themes = LC.THEMES.map(t => { const p = groupProgress('mini', t.id); return `<button class="ld-row" data-act="lm:${t.id}"><span class="ld-txt"><b>${t.titre}</b><small>${t.resume}</small></span>${chip(p.ok, p.n)}<i>›</i></button>`; }).join('');
  const chaps = LC.CHAPITRES.filter(c => { const p = groupProgress('cours', c.id); return p.n && p.ok === p.n; }).length;
  const comm = groupProgress('comm', 'comm');
  $app.innerHTML = `<div class="page"><div class="inner">
    <button class="btn back" data-act="go:home">← Accueil</button>
    <h1>Apprendre</h1>
    <div class="chef-box">${B.avatarSVG(chefOf())}<div><div class="pc-n"><b>Roger</b>${CHEF_BADGE}</div><p>« Ici, vous apprenez à votre rythme, avec les fiches de cours que j'ai créées. Et pour me retrouver à l'Hippocampe, à Villefranche-sur-Mer : »</p>${CHEF_COURS}</div></div>
    <h2>Mini-bridge <small>sans enchères, pour découvrir le jeu : on compte les points, et on joue</small></h2>
    <div class="ld-list">${themes}</div>
    <h2>Le cours pas à pas <small>chaque chapitre reprend une fiche du cours, avec des donnes pour s'exercer</small></h2>
    <div class="ld-list"><button class="ld-row" data-act="go:cours"><span class="ld-txt"><b>${LC.CHAPITRES.length} chapitres</b><small>Des premiers points jusqu'au contre d'appel</small></span>${chip(chaps, LC.CHAPITRES.length)}<i>›</i></button></div>
    <h2>Donnes commentées <small>jouez la donne, puis lisez l'explication de chaque enchère et le plan de jeu</small></h2>
    <div class="ld-list"><button class="ld-row" data-act="go:comm"><span class="ld-txt"><b>${comm.n} donnes</b><small>De l'initiation au niveau confirmé</small></span>${chip(comm.ok, comm.n)}<i>›</i></button></div>
    <h2>Aussi</h2>
    <div class="ld-list"><button class="ld-row" data-act="go:missions"><span class="ld-txt"><b>★ Les missions</b><small>Faire les plis, ou les empêcher</small></span><i>›</i></button>
      <button class="ld-row" data-act="go:fiches"><span class="ld-txt"><b>Les fiches du cours</b><small>Toutes les fiches, en gros caractères</small></span><i>›</i></button></div>
  </div></div>`;
}
function renderTheme() {
  const t = LC.theme(learnView.theme), lu = LP().lu, p = groupProgress('mini', t.id);
  const nl = t.lecons.filter(l => lu[t.id + ':' + l.id]).length;
  $app.innerHTML = `<div class="page"><div class="inner">
    <button class="btn back" data-act="go:apprendre">← Apprendre</button>
    <h1>${t.titre}</h1><p>${t.resume}</p>
    <h2>Leçons ${chip(nl, t.lecons.length)}</h2>
    <div class="ld-list">${t.lecons.map(l => `<button class="ld-row" data-act="lecon:${t.id}:${l.id}">${stIcon(lu[t.id + ':' + l.id] ? 'ok' : '')}<span class="ld-txt"><b>${l.titre}</b><small>${l.resume}</small></span><i>›</i></button>`).join('')}</div>
    <h2>Donnes ${chip(p.ok, p.n)}</h2>
    <div class="ld-list">${dealRows('mini', t.id)}</div>
  </div></div>`;
}
function renderLecon() {
  const t = LC.theme(learnView.theme), l = t.lecons.find(x => x.id === learnView.lecon);
  $app.innerHTML = `<div class="page"><div class="inner">
    <button class="btn back" data-act="lm:${t.id}">← ${t.titre}</button>
    <h1>${l.titre}</h1>
    ${l.corps.map(([a, b]) => `<div class="lc-bloc"><b>${a}</b><p>${rich(b)}</p></div>`).join('')}
    <div class="an-btns"><button class="btn primary" data-act="lecon-ok">J'ai compris</button></div>
  </div></div>`;
}
function renderCours() {
  const rows = LC.CHAPITRES.map((c, i) => {
    const p = groupProgress('cours', c.id), st = p.n && p.ok === p.n ? 'ok' : p.any ? 'enc' : '';
    return `<button class="ld-row" data-act="chap:${c.id}">${stIcon(st)}<span class="ld-txt"><b>Chapitre ${i + 1} : ${rich(c.titre)}</b></span>${chip(p.ok, p.n)}<i>›</i></button>`;
  }).join('');
  const cur = LC.CHAPITRES.find(c => { const p = groupProgress('cours', c.id); return p.ok < p.n; });
  $app.innerHTML = `<div class="page"><div class="inner">
    <button class="btn back" data-act="go:apprendre">← Apprendre</button>
    <h1>Le cours pas à pas</h1>
    <p>Chaque chapitre rappelle l'essentiel, ouvre la fiche du cours et propose des donnes choisies pour s'exercer. Dans les chapitres d'enchères, l'appli vous prévient si une enchère s'écarte du cours.</p>
    ${cur ? `<div class="an-btns"><button class="btn green" data-act="chap:${cur.id}">Continuer : ${rich(cur.titre)}</button></div>` : ''}
    <div class="ld-list">${rows}</div>
  </div></div>`;
}
function renderChapitre() {
  const c = LC.chapitre(learnView.chap), n = LC.CHAPITRES.indexOf(c) + 1, p = groupProgress('cours', c.id);
  $app.innerHTML = `<div class="page"><div class="inner">
    <button class="btn back" data-act="go:cours">← Les chapitres</button>
    <h1>Chapitre ${n} : ${rich(c.titre)}</h1>
    <h2>L'essentiel</h2>
    <ul class="lc-points">${c.points.map(x => `<li>${rich(x)}</li>`).join('')}</ul>
    <div class="fiche-list">${c.fiches.map(ficheBtn).join('')}</div>
    <h2>Donnes ${chip(p.ok, p.n)}</h2>
    <div class="ld-list">${dealRows('cours', c.id)}</div>
  </div></div>`;
}
function renderComm() {
  const list = LC.list('comm'), don = LP().donnes, f = learnView.filtre, names = Object.fromEntries(LC.NIVEAUX);
  const seg2 = [['tout', 'Toutes']].concat(LC.NIVEAUX).map(([k, l]) => `<button class="${f === k ? 'on' : ''}" data-act="comm-f:${k}">${l}</button>`).join('');
  const rows = list.map((x, i) => [x, i]).filter(([x]) => f === 'tout' || x[1] === f).map(([x, i]) => `<button class="ld-row" data-act="ld:comm:comm:${i}">${stIcon(don[ldKey('comm', 'comm', i)])}
    <span class="ld-txt"><b>Donne n° ${i + 1}</b><small>${rich(x[2])}</small></span><span class="ld-niv ${x[1]}">${names[x[1]]}</span><i>›</i></button>`).join('');
  $app.innerHTML = `<div class="page"><div class="inner">
    <button class="btn back" data-act="go:apprendre">← Apprendre</button>
    <h1>Donnes commentées</h1>
    <p>Jouez la donne en entier. À la fin, le commentaire explique chaque enchère, le plan de jeu et l'entame.</p>
    <div class="seg comm-f">${seg2}</div>
    <div class="ld-list">${rows}</div>
  </div></div>`;
}
function renderComment() {
  const g = G.game, c = LC.comment(g), ct = g.contract, h = g.hands;
  const hbox = (s, cls2) => `<div class="h ${cls2}"><div class="nm">${seatName(s)} <span class="pt">${c.pts[s]} H</span></div>${handText(h[s])}</div>`;
  const bids = c.bids.map(b => {
    const pts = b.m ? B.ptsText(b.m) : '';
    return `<li><div class="cm-h"><b>${seatName(b.seat)}</b> ${callHTML(b.call, true)}${b.m && b.m.name && b.m.name !== 'Passe' ? ' : ' + rich(b.m.name) : ''}</div>
      ${pts ? `<div class="cm-p">${pts}</div>` : ''}${b.m && b.m.text ? `<div class="cm-t">${rich(b.m.text)}</div>` : ''}
      ${b.m && b.m.fiche && FICHE_PAGES[b.m.fiche] ? `<button class="btn small cm-f" data-fiche="${b.m.fiche}">${ICONS.book}Fiche ${b.m.fiche}</button>` : ''}</li>`;
  }).join('');
  const adv = g.mini ? LC.miniAdvice(h, g.mini.declarer) : null;
  $app.innerHTML = `<div class="page"><div class="inner analyse">
    <button class="btn back" data-act="resume">${g.phase === 'end' ? '← Retour à la donne' : 'Jouer la carte →'}</button>
    <h1>Commentaire</h1><p class="an-res">${g.board}</p>
    <h2>Les mains</h2>
    <div class="compass">${hbox(0, 'hn')}${hbox(3, 'hw')}<div class="mid">Nord-Sud <b>${c.ns}</b> H<br>Est-Ouest <b>${c.eo}</b> H</div>${hbox(1, 'he')}${hbox(2, 'hs')}</div>
    ${g.mini ? `<h2>Le choix du contrat</h2><p>${miniReason(adv)}</p><p>Contrat conseillé : <b>${contractHTML(adv)}</b>.${ct ? ` Contrat joué : <b>${contractHTML(ct)}</b>.` : ''}</p>`
      : `<h2>Les enchères</h2><ol class="cm-list">${bids}</ol>`}
    ${ct ? `<h2>Le contrat</h2><p><b>${contractHTML(ct)}</b> joué par ${nameOf(ct.declarer)} : il faut ${ct.level + 6} plis.</p>
      <h2>Le plan de jeu <small>première estimation, en regardant les deux mains du camp</small></h2>
      <ul class="lc-points">${c.plan.map(x => `<li>${rich(x)}</li>`).join('')}</ul>
      ${ficheBtn('09')}
      <h2>L'entame</h2><p>${seatName(c.lead.seat)} ${c.lead.seat === 2 ? 'entamez' : 'entame'} ${cardTxtHTML(c.lead.card)}. ${rich(c.lead.reason)}</p>` : ''}
    <div class="an-btns">${g.phase === 'end' && ct ? `<button class="btn gold" data-act="analyse">★ La meilleure façon de jouer</button>` : ''}
      <button class="btn primary" data-act="learn-next">Donne suivante</button></div>
  </div></div>`;
}
function userControls(seat) {
  const g = G.game;
  if (g.online) {
    if (g.phase !== 'play') return seat === 2;
    return seat === g.play.dummy ? g.play.declarer === 2 : seat === 2;   // le mort est joué par son déclarant
  }
  if (seat === 2) return true;
  return g.phase === 'play' && seat === 0 && B.sideOf(g.play.declarer) === 0;
}
function pushUndo() {
  const g = G.game;
  if (g.online) return;
  g.undo.push(JSON.parse(JSON.stringify({ auction: g.auction, phase: g.phase, play: g.play, contract: g.contract, selCall: g.selCall })));
  if (g.undo.length > 60) g.undo.shift();
}

/* ---------- Déroulement : les robots jouent jusqu'au tour de l'utilisatrice ---------- */
function step() {
  const g = G.game;
  if (!g || screen !== 'game' || dealing) return;
  if (g.online) { render(); return; }            // en ligne, c'est le serveur qui mène le jeu
  if (robotPending) { render(); return; }
  const tok = runToken;
  if (g.phase === 'bidding') {
    if (B.auctionEnded(g.auction)) {
      // les enchères restent affichées un moment avant le jeu de la carte
      thinking = -1;
      robotPending = true;
      render();
      setTimeout(() => { if (tok !== runToken) return; robotPending = false; finishAuction(); }, delay('bid'));
      return;
    }
    const seat = (g.dealer + g.auction.length) % 4;
    if (seat === 2) {
      thinking = -1;
      if (robotActed) { robotActed = false; bidboxEnter = true; setTimeout(() => snd('turn'), 120); }
      render();
      return;
    }
    thinking = seat;
    robotPending = true;
    render();
    setTimeout(() => {
      if (tok !== runToken) return;
      robotPending = false;
      if ((g.dealer + g.auction.length) % 4 !== seat || B.auctionEnded(g.auction)) { step(); return; }
      const r = B.decide(g.hands[seat], g.auction, g.dealer);
      g.auction.push(r.call);
      g.selCall = g.auction.length - 1;
      newBidIdx = g.auction.length - 1;
      robotActed = true;
      snd('bid');
      say(nameOf(seat) + ' : ' + B.sound.callWords(r.call));
      thinking = -1;
      save();
      step();
    }, delay('bid'));
    return;
  }
  if (g.phase === 'play') {
    const p = g.play;
    if (holdTrick) return;
    if (p.done) { finishPlay(); return; }
    const seat = p.turn;
    if (userControls(seat)) {
      thinking = -1;
      if (robotActed) { robotActed = false; snd('turn'); }
      render();
      return;
    }
    thinking = seat;
    robotPending = true;
    render();
    setTimeout(() => {
      if (tok !== runToken) return;
      robotPending = false;
      if (p.turn !== seat || p.done || holdTrick) { step(); return; }
      const r = g.mission ? B.mission.perfectCard(p, seat) : B.chooseCard(p, seat);
      doPlay(seat, r.card);
    }, p.tricks.length === 0 && !p.trick.length ? delay('lead') : delay('card'));
  }
}
function doPlay(seat, card) {
  const g = G.game, p = g.play, tok = runToken;
  if (g.online) { selected = null; hintCard = null; onSend({ t: 'play', card }); render(); return; }
  fly = anim() ? flyOrigin(seat, card) : null;
  const slip = g.mission && missionSlipCheck(seat, card);
  const res = B.playCard(p, seat, card);
  if (slip) {
    p.slip = true;
    setTimeout(() => toast('Aïe : après cette carte, la mission ne peut plus être réussie.<br>Touchez « Annuler » pour rejouer ce coup.', 5200), 300);
  }
  snd('card');
  robotActed = !userControls(seat);
  lastPlayed = card;
  thinking = -1;
  selected = null; hintCard = null;
  save();
  if (res.trickDone) {
    holdTrick = true;
    render();
    setTimeout(() => {
      if (tok !== runToken) return;
      collectTrick(res.winner, () => {
        if (tok !== runToken) return;
        holdTrick = false;
        lastPlayed = null;
        step();
      });
    }, delay('trick'));
  } else step();
}
function finishAuction() {
  const g = G.game;
  const ct = B.contractOf(g.auction, g.dealer);
  thinking = -1;
  if (!ct) {
    say('Donne passée.');
    g.phase = 'end';
    g.result = { passed: true, ns: 0 };
    record();
    save();
    render();
    return;
  }
  g.contract = ct;
  for (let i = g.auction.length - 1; i >= 0; i--) if (B.isBid(g.auction[i])) { g.selCall = i; break; }
  g.play = B.newPlay(g.hands, ct);
  g.play.auction = g.auction.slice();
  g.play.dealer = g.dealer;
  g.phase = 'play';
  const decl = ct.declarer;
  const ns = B.sideOf(decl) === 0;
  let msg = `Contrat : <b>${contractHTML(ct)}</b> joué par ${nameOf(decl)}.`;
  if (ns && decl === 0) msg += `<br>Vous jouez les deux mains : la vôtre et celle de ${nameOf(0)}.`;
  else if (ns) msg += `<br>Vous jouez aussi les cartes du mort (${nameOf(0)}).`;
  else msg += (g.play.leader === 2 ? '<br>C\'est à vous d\'entamer.' : '<br>' + nameOf(g.play.leader) + ' entame.');
  toast(msg, 4200);
  say('Contrat : ' + B.sound.callWords(ct.level + ct.den) + (ct.dbl === 2 ? ' surcontré' : ct.dbl === 1 ? ' contré' : '') + ', joué par ' + nameOf(decl) + '.');
  save();
  if (g.learn && g.learn.kind === 'cours' && LC.chapitre(g.learn.group).type === 'bid') { afterBids(); return; }
  step();
}
function finishPlay() {
  if (G.game.mission) { finishMission(); return; }
  if (G.game.mini) { finishMini(); return; }
  const g = G.game, p = g.play, ct = g.contract;
  const tricks = p.won[B.sideOf(ct.declarer)];
  const sc = B.score(ct, tricks, g.vul);
  g.result = { tricks, score: sc, ns: B.sideOf(ct.declarer) === 0 ? sc : -sc, made: tricks >= ct.level + 6 };
  g.phase = 'end';
  record();
  save();
  render();
  const good = (B.sideOf(ct.declarer) === 0) === g.result.made;
  const diff = tricks - (ct.level + 6);
  snd(good ? 'success' : 'fail');
  if (B.sideOf(ct.declarer) === 0) say(g.result.made ? 'Contrat réussi !' : 'Chute de ' + (-diff) + '.');
  else say(g.result.made ? 'Les adversaires réussissent leur contrat.' : 'Bravo, le contrat adverse chute !');
  if (good && anim()) confetti();
}
function record() {
  const g = G.game;
  if (g.recorded) return;
  g.recorded = true;
  if (g.learn) { learnResult(); return; }    // les donnes d'apprentissage ne comptent pas dans « Mes résultats »
  const h = G.stats.history;
  const ct = g.contract;
  h.push({
    board: g.board, date: new Date().toISOString().slice(0, 10),
    contract: ct ? { level: ct.level, den: ct.den, dbl: ct.dbl, declarer: ct.declarer } : null,
    tricks: g.result.tricks || 0, made: !!g.result.made, ns: g.result.ns,
    role: !ct ? 'passée' : ct.declarer === 2 ? 'déclarant' : ct.declarer === 0 ? 'déclarant (Nord)' : 'défense',
    n: perso(0).name, e: perso(1).name, o: perso(3).name,
  });
  tally(h[h.length - 1], 1);
  if (h.length > 300) h.shift();
}
// victoire = marque positive pour notre camp ; on compte avec le partenaire et contre chaque adversaire
function tally(x, sign) {
  if (!x || !x.ns) return;
  const k = x.ns > 0 ? 'v' : 'd';
  const me = G.stats.me = G.stats.me || { v: 0, d: 0 };
  me[k] = Math.max(0, (me[k] || 0) + sign);
  if (!x.n) return;
  const wl = G.stats.wl = G.stats.wl || {};
  const add = (name, key) => { const r = wl[name] = wl[name] || {}; r[key] = Math.max(0, (r[key] || 0) + sign); };
  add(x.n, 'p' + k); add(x.e, k); add(x.o, k);
}
function wlOf(name, partner) {
  const r = (G.stats.wl || {})[name] || {};
  return partner ? { v: r.pv || 0, d: r.pd || 0 } : { v: r.v || 0, d: r.d || 0 };
}
const wlHTML = w => `<span class="wl"><i class="w">✓ ${w.v}</i><i class="l">✗ ${w.d}</i></span>`;

/* ---------- Actions de l'utilisatrice ---------- */
function submitCall(call, force) {
  const g = G.game;
  if (g.phase !== 'bidding' || B.auctionEnded(g.auction) || (g.dealer + g.auction.length) % 4 !== 2) return;
  if (!B.isLegal(call, g.auction, g.dealer)) return;
  if (!force && !g.expert && (G.settings.checkBids || (g.learn && g.learn.kind === 'cours'))) {
    const h = B.decide(g.hands[2], g.auction, g.dealer);
    if (h.sure && h.call !== call) { deviation(h, call); return; }
  }
  if (g.online) { bidLevel = null; onSend({ t: 'bid', call }); return; }
  pushUndo();
  g.auction.push(call);
  g.selCall = g.auction.length - 1;
  newBidIdx = g.auction.length - 1;
  robotActed = false;
  snd('bid');
  bidLevel = null;
  save();
  step();
}
function deviation(h, call) {
  const g = G.game;
  const mine = B.explainCall(g.auction, g.dealer, call);
  modal(`<h2>Le cours conseille plutôt ${callHTML(h.call, true)}</h2>
    <p><b>${h.m.name === callWords(h.call) || h.m.name === 'Passe' ? callHTML(h.call, true) : callHTML(h.call, true) + ' : ' + rich(h.m.name)}.</b> ${rich(h.m.text)}</p>
    <p style="color:var(--muted)">Votre enchère ${callHTML(call, true)} signifierait : ${rich(mine.name)}${mine.text ? ' — ' + rich(mine.text) : '.'}</p>
    ${h.m.fiche ? ficheBtn(h.m.fiche) : ''}
    <div class="btns"><button class="btn primary" data-m="sugg">Dire ${callHTML(h.call, true)}</button><button class="btn" data-m="mine">Garder ${callHTML(call, true)}</button></div>`,
  v => { if (v === 'sugg') submitCall(h.call, true); else if (v === 'mine') submitCall(call, true); });
}
function tapCard(seat, c) {
  const g = G.game;
  if (!g || g.phase !== 'play' || holdTrick) return;
  const p = g.play;
  if (!userControls(seat)) return;
  if (p.turn !== seat) {
    if (userControls(p.turn)) toast(p.turn === 0 ? `C'est au tour de ${nameOf(0)} : jouez une de ses cartes, en haut.` : 'C\'est à votre main (Sud) de jouer : jouez une carte en bas.');
    else toast('Attendez : c\'est au tour de ' + nameOf(p.turn) + '.');
    return;
  }
  const leg = B.legalCards(p, seat);
  if (!leg.includes(c)) {
    const el = document.querySelector(`.card[data-c="${c}"]`);
    if (el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
    snd('error');
    const ls = B.suitOf(p.trick[0].card);
    toast(`Vous devez fournir à ${su(ls)} ${B.SUIT_NAME[ls]}.`);
    return;
  }
  if (G.settings.doubleTap && selected !== c) { selected = c; snd('select'); render(); return; }
  pushUndo();
  doPlay(seat, c);
}
function undo() {
  const g = G.game;
  if (!g || !g.undo.length) { toast('Il n\'y a rien à annuler.'); return; }
  cancelTimers();
  // une donne annulée après sa fin ne compte plus dans les résultats
  if (g.recorded) { const h = G.stats.history; if (h.length && h[h.length - 1].board === g.board) tally(h.pop(), -1); }
  const s = g.undo.pop();
  Object.assign(g, s);
  g.result = null; g.recorded = false;
  if (g.phase === 'end') g.phase = 'play';
  holdTrick = false; thinking = -1; selected = null; hintCard = null; lastPlayed = null; bidLevel = null;
  save();
  render();
  step();
  toast('Coup annulé.');
}
function hint() {
  const g = G.game;
  if (!g) return;
  if (g.phase === 'mini') { miniHint(); return; }
  if (g.expert) { toast(EXPERT_TXT.slice(4)); return; }
  if (g.phase === 'bidding') {
    if (B.auctionEnded(g.auction) || (g.dealer + g.auction.length) % 4 !== 2) { toast('Attendez votre tour pour demander un conseil.'); return; }
    const h = B.decide(g.hands[2], g.auction, g.dealer);
    const hand = g.hands[2];
    const l = B.lens(hand);
    const answer = () => modal(`<h2>Conseil : ${callHTML(h.call, true)}</h2>
      <p><b>${rich(h.m.name)}.</b> ${rich(h.m.text)}</p>
      <p style="color:var(--muted)">Votre main : <b>${B.hcp(hand)} points H</b>, ${B.HL(hand)} points HL ; ${[0, 1, 2, 3].map(s => l[s] + ' ' + su(s)).join(', ')}.</p>
      ${h.sure ? (h.m.fiche ? ficheBtn(h.m.fiche) : '') : '<p style="color:var(--muted)">Cette situation n\'est pas dans les fiches : c\'est la suggestion du robot.</p>'}
      <div class="btns"><button class="btn primary" data-m="bid">Annoncer ${callHTML(h.call, true)}</button><button class="btn" data-m="no">Fermer</button></div>`,
    v => { if (v === 'bid') submitCall(h.call, true); });
    // d'abord la fiche du cours, pour réfléchir ; la réponse seulement si elle est demandée
    if (h.sure && FICHE_PAGES[h.m.fiche]) openFiche(h.m.fiche, { hand, answer });
    else answer();
    return;
  }
  if (g.phase === 'play') {
    const p = g.play;
    if (holdTrick || !userControls(p.turn)) { toast('Attendez votre tour pour demander un conseil.'); return; }
    if (g.mission) { missionHint(); return; }
    if (g.online) { onSend({ t: 'hint' }); return; }
    const r = B.chooseCard(p, p.turn, { samples: 16 });
    hintCard = r.card;
    if (G.settings.doubleTap) selected = r.card;
    render();
    modal(`<h2>Conseil : jouez ${cardTxtHTML(r.card)}${p.turn === 0 ? ' (du mort)' : ''}</h2><p>${rich(r.reason)}</p>
      ${ficheBtn('09')}
      <div class="btns"><button class="btn primary" data-m="play">Jouer cette carte</button><button class="btn" data-m="no">Fermer</button></div>`,
    v => { if (v === 'play') { pushUndo(); doPlay(p.turn, r.card); } });
  }
}
function missionHint() {
  const g = G.game, p = g.play, m = missionOf(g), seat = p.turn;
  const r = B.mission.perfectCard(p, seat);
  const { top } = B.mission.exact(p, seat);
  const need = B.mission.goalOf(m) - missionTricks(g);
  hintCard = r.card;
  if (G.settings.doubleTap) selected = r.card;
  render();
  modal(`<h2>Conseil : jouez ${cardTxtHTML(r.card)}${seat === 0 ? ' (du mort)' : ''}</h2>
    ${top >= need ? `<p>${rich(m.astuce)}</p><p style="color:var(--muted)">Avec cette carte, la mission peut encore être réussie.</p>`
      : '<p>Après les cartes déjà jouées, la mission ne peut plus être réussie : touchez « Annuler » pour revenir en arrière, ou recommencez la mission. Cette carte limite les dégâts.</p>'}
    ${ficheBtn('09')}
    <div class="btns"><button class="btn primary" data-m="play">Jouer cette carte</button><button class="btn" data-m="no">Fermer</button></div>`,
  v => { if (v === 'play') { pushUndo(); doPlay(seat, r.card); } });
}
const cardTxtHTML = c => `<b>${B.RANK_NAME[B.rankOf(c)]}</b> ${su(B.suitOf(c))}`;
function lastTrick() {
  const p = G.game && G.game.play;
  if (!p || !p.tricks.length) { toast('Aucun pli n\'a encore été joué.'); return; }
  const t = p.tricks[p.tricks.length - 1];
  const cells = [0, 1, 2, 3].map(s => {
    const x = t.cards.find(y => y.seat === s);
    return `<div class="${t.winner === s ? 'win' : ''}">${cardHTML(x.card)}<div class="who">${seatName(s)}${t.leader === s ? ' (entame)' : ''}</div></div>`;
  });
  modal(`<h2>Dernier pli (n° ${p.tricks.length})</h2><div class="mini-trick">${[cells[3], cells[0], cells[1], cells[2]].join('')}</div>
    <p style="text-align:center">Pli gagné par <b>${seatName(t.winner)}</b> (${B.sideOf(t.winner) === 0 ? 'Nord-Sud' : 'Est-Ouest'}).</p>
    <div class="btns"><button class="btn primary" data-m="ok">Fermer</button></div>`);
}
function claim() {
  const g = G.game, p = g && g.play;
  if (!p || g.phase !== 'play') return;
  if (B.sideOf(p.declarer) !== 0) { toast('Seul le camp du déclarant peut réclamer.'); return; }
  if (p.trick.length || !userControls(p.turn) || holdTrick) { toast('Vous pouvez réclamer quand c\'est à vous de commencer un pli.'); return; }
  const left = Math.max(...p.hands.map(h => h.length));
  modal(`<h2>Réclamer les ${left} plis restants ?</h2><p>Si toutes vos cartes sont maîtresses, la donne se termine tout de suite.</p>
    <div class="btns"><button class="btn primary" data-m="yes">Réclamer</button><button class="btn" data-m="no">Continuer à jouer</button></div>`, v => {
    if (v !== 'yes') return;
    if (B.claimCheck(p)) {
      pushUndo();
      p.won[B.sideOf(p.declarer)] += left;
      p.claimed = left;
      p.done = true;
      finishPlay();
    } else toast('Pas encore : les adversaires peuvent encore faire un pli. Continuez à jouer.', 3600);
  });
}
function menu() {
  if (G.game && G.game.online) { onlineMenu(); return; }
  const inGame = screen === 'game' && G.game;
  modal(`<h2>Menu</h2><div class="menu-list">
    <button class="btn primary" data-m="new">Nouvelle donne</button>
    ${inGame ? `<button class="btn" data-m="replay">${G.game.mission ? 'Recommencer la mission' : 'Recommencer cette donne'}</button>` : ''}
    <button class="btn" data-m="apprendre">Apprendre</button>
    <button class="btn" data-m="missions">Les missions</button>
    <button class="btn" data-m="fiches">Les fiches du cours</button>
    <button class="btn" data-m="persos">Les personnages</button>
    <button class="btn" data-m="stats">Mes résultats</button>
    <button class="btn" data-m="help">Comment jouer</button>
    <button class="btn" data-m="settings">Réglages</button>
    <button class="btn" data-m="home">Accueil</button>
    <button class="btn" data-m="close">Fermer</button></div>`, v => {
    if (v === 'new') newDeal(false, null, !!(G.game && G.game.expert));
    else if (v === 'replay') confirmReplay();
    else if (v === 'close') return;
    else go(v);
  });
}
function confirmReplay() {
  if (G.game && G.game.mission) { startMission(G.game.mission); return; }
  if (G.game && G.game.learn) { const l = G.game.learn; startLearn(l.kind, l.group, l.i); return; }
  modal(`<h2>Recommencer cette donne ?</h2><p>Les mêmes cartes seront redistribuées et les enchères reprendront du début.</p>
    <div class="btns"><button class="btn primary" data-m="yes">Recommencer</button><button class="btn" data-m="no">Annuler</button></div>`, v => { if (v === 'yes') newDeal(true); });
}
const clearToast = () => { const t = document.querySelector('.toast'); if (t) t.remove(); };
function go(s) {
  cancelTimers();
  clearToast();
  if (!ON) { thinking = -1; holdTrick = false; }
  screen = s;
  render();
  if (s === 'game') step();
}

/* ---------- Rendu ---------- */
function render() {
  document.body.classList.toggle('four-colors', !!G.settings.fourColors);
  document.body.classList.toggle('tel', tel());
  if (screen === 'home') return renderHome();
  if (screen === 'settings') return renderSettings();
  if (screen === 'stats') return renderStats();
  if (screen === 'help') return renderHelp();
  if (screen === 'missions') return renderMissions();
  if (screen === 'fiches') return renderFiches();
  if (screen === 'persos') return renderPersos();
  if (screen === 'tour' && G.game) return renderTour();
  if (screen === 'online') return renderOnline();
  if (screen === 'onlobby' && ON && ON.v) return renderLobby();
  if (screen === 'ontour' && ON && ON.v) return renderOnTour();
  if (screen === 'apprendre') return renderApprendre();
  if (screen === 'lm') return renderTheme();
  if (screen === 'lecon') return renderLecon();
  if (screen === 'cours') return renderCours();
  if (screen === 'chapitre') return renderChapitre();
  if (screen === 'comm') return renderComm();
  if (screen === 'comment' && G.game) return renderComment();
  if (screen === 'analyse' && G.game) return renderAnalysis();
  if (screen === 'revue' && G.game && AN.res && AN.res.best !== undefined) return renderReview();
  if (!G.game) { screen = 'home'; return renderHome(); }
  renderGame();
}

function renderHome() {
  const g = G.game;
  const resume = g && g.phase !== 'end';
  $app.innerHTML = `<div class="home"><div class="card-box">
    <div class="logo">${su(0)}${su(1)}${su(2)}${su(3)}</div>
    <h1>Le Bridge de Marianne</h1>
    <div class="sub">Jouez contre trois robots qui annoncent comme dans votre cours.</div>
    <div class="menu-list">
      ${resume ? `<button class="btn primary" data-act="resume">${g.mission ? 'Reprendre la mission : ' + g.board : g.learn ? 'Reprendre : ' + g.board : 'Reprendre la ' + boardLabel(g).replace('Donne', 'donne')}</button>` : ''}
      <div class="home-duo"><button class="btn ${resume ? '' : 'primary'}" data-act="new:normal">Nouvelle donne</button>
        <button class="btn expert-btn" data-act="new:expert">Mode expert<small>sans aucun conseil</small></button></div>
      <button class="btn green" data-act="go:apprendre">${ICONS.cap}Apprendre</button>
      <button class="btn gold" data-act="go:missions">★ Les missions <small>${B.MISSIONS.filter(m => MP().done[m.id]).length} / ${B.MISSIONS.length}</small></button>
      ${onlineHomeHTML()}
      <div class="home-mini">
        <button class="btn" data-act="go:fiches">Les fiches</button>
        <button class="btn" data-act="go:stats">Mes résultats</button>
        <button class="btn" data-act="go:help">Comment jouer</button>
        <button class="btn" data-act="go:settings">Réglages</button>
        <button class="btn wide" data-act="go:persos">Découvrir les personnages</button>
      </div>
    </div></div></div>`;
}

function renderGame() {
  const g = G.game;
  const p = g.play;
  const phase = g.phase;
  const decl = g.contract ? g.contract.declarer : -1;
  const dummy = g.contract ? B.partnerOf(decl) : -1;
  const dummyShown = p && B.dummyShown(p);
  const turn = phase === 'bidding' ? (B.auctionEnded(g.auction) ? -1 : (g.dealer + g.auction.length) % 4) : phase === 'play' ? p.turn : -1;
  const hands = phase === 'bidding' || !p ? g.hands : p.hands;
  const role = s => !g.contract || phase === 'bidding' ? '' : s === decl ? 'déclarant' : s === dummy ? 'mort' : 'défense';
  const tag = s => {
    const cls = `tag perso ${turn === s && phase !== 'end' ? 'turn' : ''}`;
    const sub = SEATN[s] + (phase === 'mini' && g.mini.step >= 1 ? ` · ${g.mini.pts[s]} pts` : role(s) ? ' · ' + role(s) : s === 0 ? ' · partenaire' : '');
    if (g.online) {
      const q = perso(s);
      return `<div class="${cls} ${s === 2 ? 'me' : ''}" ${s === 2 ? '' : `data-perso="${s}"`}>${avatarOf(q)}<span class="nm"><b><span class="dot"></span>${q.name}${q.av.chef ? ' ★' : ''}</b><small>${sub}${q.human && !q.online ? ' · hors ligne' : ''}</small></span></div>`;
    }
    if (s === 2) return `<div class="${cls} me" data-me="1">${meAvatar()}<span class="nm"><b><span class="dot"></span>${P.name ? esc(P.name) : 'Vous'}</b><small>${sub}</small></span>${wlHTML(G.stats.me || { v: 0, d: 0 })}</div>`;
    return `<div class="${cls}" data-perso="${s}">${B.avatarSVG(perso(s))}<span class="nm"><b><span class="dot"></span>${perso(s).name}${perso(s).av.chef ? ' ★' : ''}</b><small>${sub}</small></span>${wlHTML(wlOf(perso(s).name, s === 0))}</div>`;
  };
  const lastCallIdx = s => { for (let i = g.auction.length - 1; i >= 0; i--) if ((g.dealer + i) % 4 === s) return i; return -1; };
  const bubble = s => {
    if (phase !== 'bidding') return '';
    const i = lastCallIdx(s);
    if (i < 0) return '';
    const c = g.auction[i];
    return `<div class="bubble ${c === 'P' ? 'pass' : c === 'X' ? 'dbl' : c === 'XX' ? 'rdbl' : ''} ${i === newBidIdx && anim() ? 'new' : ''}" style="position:relative">${callHTML(c, true)}</div>`;
  };
  const userTurnSeat = phase === 'play' && userControls(turn) && !holdTrick ? turn : -1;
  const legal = userTurnSeat >= 0 ? B.legalCards(p, userTurnSeat) : [];
  const cardCls = (s, c) => {
    const cls = [];
    if (userTurnSeat === s) cls.push(legal.includes(c) ? 'playable' : 'dim');
    if (selected === c) cls.push('sel');
    if (hintCard === c) cls.push('hint');
    return cls.join(' ');
  };
  // Nord
  let north;
  const northVisible = phase === 'end' || (phase === 'play' && (g.online ? dummy === 0 && dummyShown : B.sideOf(decl) === 0 || (dummy === 0 && dummyShown))) || (phase === 'mini' && g.mini.step >= 2 && g.mini.side === 0);
  if (northVisible) north = dummyHTML(phase === 'end' ? [] : hands[0], 0, 'cols', cardCls);
  else north = backsHTML(hands[0].length);
  // Est / Ouest
  const sideZone = s => {
    if (phase === 'play' && s === dummy && dummyShown) return dummyHTML(hands[s], s, 'rows', cardCls);
    if (phase === 'end') return '';
    return backsHTML(hands[s].length);
  };
  const rows = phase === 'end' ? [] : handRows(hands[2]);
  const rowHTML = r => r.map(c => cardHTML(c, cardCls(2, c))).join('');
  const south = phase === 'end' ? '' : rows.length > 1 ? `<div class="hand two" data-seat="2">${rows.map(r => `<div class="hrow">${rowHTML(r)}</div>`).join('')}</div>`
    : `<div class="hand" data-seat="2">${rowHTML(rows[0])}</div>`;
  // centre
  let center = '', status = '';
  if (phase === 'bidding') {
    if (B.auctionEnded(g.auction)) center = '<div class="thinking">Fin des enchères</div>';
    else if (turn === 2 && !dealing) center = bidboxHTML();
    else if (thinking >= 0) center = `<div class="thinking">${nameOf(thinking)} réfléchit…</div>`;
  } else if (phase === 'mini') {
    center = miniBoxHTML();
  } else if (phase === 'play') {
    const shown = holdTrick ? p.tricks[p.tricks.length - 1].cards : p.trick;
    const w = holdTrick ? p.tricks[p.tricks.length - 1].winner : -1;
    let msg = '', wait = false;
    if (userTurnSeat >= 0) {
      const isDummy = userTurnSeat === dummy;
      if (tel()) msg = userTurnSeat === 0 ? `À vous : <b>${isDummy ? 'carte du mort' : 'carte de ' + nameOf(0)}</b> ↑`
        : isDummy ? 'À vous : <b>carte du mort</b> ↓' : '<b>À vous de jouer</b>';
      else msg = userTurnSeat === 0 ? (isDummy ? 'À vous :<br><b>carte du mort</b> ↑' : `À vous :<br><b>carte de ${nameOf(0)}</b> ↑`)
        : (isDummy ? 'À vous :<br><b>carte du mort</b> ↓' : 'À vous<br><b>de jouer</b> ↓');
    } else if (holdTrick) msg = `Pli pour${tel() ? ' ' : '<br>'}<b>${B.sideOf(w) === 0 ? 'Nord-Sud' : 'Est-Ouest'}</b>`;
    else if (thinking >= 0 && !shown.length) { msg = `${nameOf(thinking)}${tel() ? ' ' : '<br>'}réfléchit…`; wait = true; }
    center = `<div class="trick">${shown.map(x => `<div class="slot s${x.seat} ${x.seat === w ? 'win' : ''}">${cardHTML(x.card, x.card === lastPlayed && !anim() ? '' : 'nodrop')}</div>`).join('')}</div>`;
    if (msg) status = `<div class="status ${wait ? 'wait' : ''} ${userTurnSeat >= 0 ? 'me' : ''}">${msg}</div>`;
    else if (tel()) status = '<div class="status idle">&nbsp;</div>';   // la barre garde sa hauteur
  }
  const endHTML = phase === 'end' ? endScreenHTML() : '';
  const sheet = panelOpen && tel(), oldScroll = sheet && document.querySelector('.panel .scroll');
  const keep = oldScroll ? oldScroll.scrollTop : 0;
  $app.innerHTML = `<div class="game">
    <div class="table" id="table">
      <div class="zone zone-n">${tag(0)}${bubble(0)}${north}</div>
      <div class="zone zone-w">${tag(3)}${bubble(3)}${sideZone(3)}</div>
      <div class="zone zone-e">${tag(1)}${bubble(1)}${sideZone(1)}</div>
      <div class="zone zone-s">${tag(2)}${bubble(2)}${south}</div>
      <div class="center">${center}</div>
      ${tel() ? '' : status}
      ${endHTML}
    </div>
    <aside class="panel ${sheet ? 'open' : ''}">${panelHTML(tel() ? status : '')}</aside>
  </div>`;
  if (keep) document.querySelector('.panel .scroll').scrollTop = keep;
  if (layout() === 'one-row') { oneRow = true; return renderGame(); }
  fx();
}

// téléphone en portrait : la main sur deux rangées (coupée entre deux couleurs, au plus près du milieu) pour des cartes plus grandes
function handRows(hand) {
  const h = B.sortHand(hand), n = h.length;
  if (!telPortrait() || n < 7 || oneRow) return [h];
  // pendant les enchères sur un écran bas, une seule rangée : la boîte d'enchères garde des boutons assez grands
  const cs = getComputedStyle($app);
  if (G.game.phase !== 'play' && $app.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) < 680) return [h];
  let cut = Math.ceil(n / 2), best = 99;
  for (let i = 1; i < n; i++) {
    if (B.suitOf(h[i]) === B.suitOf(h[i - 1])) continue;
    const d = Math.abs(i - n / 2);
    if (d < best && Math.max(i, n - i) <= Math.ceil(n / 2) + 2) { best = d; cut = i; }
  }
  return [h.slice(0, cut), h.slice(cut)];
}
function backsHTML(n) {
  if (!n) return '';
  const k = Math.min(n, 5);
  return `<div class="backs">${'<div class="card back"></div>'.repeat(k)}<span class="count">${n}</span></div>`;
}
function dummyHTML(hand, seat, mode, cardCls) {
  if (!hand.length) return '';
  const order = [0, 1, 3, 2];
  const bySuit = order.map(s => B.ranksIn(hand, s).map(r => s * 13 + r));
  if (mode === 'cols') {
    return `<div class="dummy" data-seat="${seat}">${bySuit.map(cs => `<div class="col">${cs.length ? cs.map(c => cardHTML(c, 'small ' + cardCls(seat, c))).join('') : '<div class="empty"></div>'}</div>`).join('')}</div>`;
  }
  return `<div class="dummy rows" data-seat="${seat}">${bySuit.filter(cs => cs.length).map(cs => `<div class="row">${cs.map(c => cardHTML(c, 'small ' + cardCls(seat, c))).join('')}</div>`).join('')}</div>`;
}
function bidboxHTML() {
  const g = G.game;
  const lv = [1, 2, 3, 4, 5, 6, 7];
  const levelOk = l => ['C', 'D', 'H', 'S', 'N'].some(d => B.isLegal(l + d, g.auction, g.dealer));
  const dens = [['C', 3], ['D', 2], ['H', 1], ['S', 0], ['N', -1]];
  const hand = g.hands[2];
  const enter = bidboxEnter && anim();
  bidboxEnter = false;
  return `<div class="bidbox ${enter ? 'enter' : ''}">
    <div class="title">${bidLevel ? 'Choisissez la couleur' : 'À vous d\'annoncer : choisissez le palier'}</div>
    <div class="row levels">${lv.map(l => `<button data-act="lvl:${l}" class="${bidLevel === l ? 'on' : ''}" ${levelOk(l) ? '' : 'disabled'}>${l}</button>`).join('')}</div>
    <div class="row dens">${dens.map(([d, s]) => {
      const ok = bidLevel && B.isLegal(bidLevel + d, g.auction, g.dealer);
      return `<button data-act="bid:${d}" class="${d === 'N' ? 'nt' : ''}" ${ok ? '' : 'disabled'}>${bidLevel ? bidLevel : ''}${s >= 0 ? su(s) : 'SA'}</button>`;
    }).join('')}</div>
    <div class="row calls">
      <button class="pass" data-act="call:P">Passe</button>
      <button class="dbl" data-act="call:X" ${B.isLegal('X', g.auction, g.dealer) ? '' : 'disabled'}>Contre</button>
      <button class="rdbl" data-act="call:XX" ${B.isLegal('XX', g.auction, g.dealer) ? '' : 'disabled'}>Surcontre</button>
    </div>
    ${G.settings.showPoints && !g.expert ? `<div class="pts">Votre main : <b>${B.hcp(hand)} points H</b> · ${B.HL(hand)} points HL</div>` : ''}
  </div>`;
}

function panelHTML(status) {
  const g = G.game;
  const p = g.play;
  const vulNS = B.isVul(g.vul, 0), vulEW = B.isVul(g.vul, 1);
  const m = missionOf(g);
  let html = `<div class="scroll">
    <div class="topline"><span class="boardno ${g.learn ? 'small' : ''}">${m ? 'Mission' : boardLabel(g)}</span><button class="menu-btn" data-act="menu"><span class="bars"></span>Menu</button><button class="btn sheet-close" data-act="details">Fermer ✕</button></div>
    ${m ? `<div class="mission-box"><div class="mi-k">${PARCOURS[m.parcours]} ${stars(m.niveau)}</div><div class="mi-title">${m.titre}</div><p>${rich(m.histoire)}</p></div>`
      : g.mini ? `<div class="mission-box"><div class="mi-k">Mini-bridge</div><div class="mi-title">${LC.theme(g.learn.group).titre}</div><p>${LC.theme(g.learn.group).resume}</p></div>`
      : `<div class="info">Donneur : <b>${seatName(g.dealer)}</b><br>
      Nord-Sud <span class="vul ${vulNS ? 'v' : 'nv'}">${vulNS ? 'vulnérables' : 'non vulnérables'}</span><br>
      Est-Ouest <span class="vul ${vulEW ? 'v' : 'nv'}">${vulEW ? 'vulnérables' : 'non vulnérables'}</span>${g.online ? onlineTotalsHTML() : ''}</div>`}`;
  if (g.contract && g.phase !== 'bidding') {
    const ct = g.contract;
    const side = B.sideOf(ct.declarer);
    html += `<div class="contract"><div class="big">${contractHTML(ct)} <span style="font-size:20px;color:var(--muted)">par ${nameOf(ct.declarer)}</span></div>
      <div class="tricks"><span>Nord-Sud<b class="${bumpCls(0)}">${p.won[0]}</b></span><span>Est-Ouest<b class="${bumpCls(1)}">${p.won[1]}</b></span></div>
      ${m ? `<div class="goal mi-progress">Objectif : <b>${B.mission.goalOf(m)} pli${B.mission.goalOf(m) > 1 ? 's' : ''}</b> pour Nord-Sud dans cette fin de donne. Déjà faits : <b>${missionTricks(g)}</b>.</div>`
        : `<div class="goal">Il faut <b>${ct.level + 6} plis</b> au camp ${side === 0 ? 'Nord-Sud' : 'Est-Ouest'} (les défenseurs en veulent ${8 - ct.level}).</div>`}</div>`;
  }
  if (g.mini) html += `<div class="explain"><div class="t">${ICONS.hint} Besoin d'aide ?</div><div class="txt">Au mini-bridge, il n'y a pas d'enchères : on compte les points et on choisit le contrat. Le bouton « Conseil » vous guide à chaque étape.</div></div>`;
  else if (m) html += `<div class="explain"><div class="t">${ICONS.hint} Besoin d'aide ?</div><div class="txt">Le bouton « Conseil » donne un indice et la bonne carte. Si une carte rend la mission impossible, l'appli vous prévient : « Annuler » permet de rejouer le coup.</div></div>`;
  else html += auctionHTML() + explainHTML();
  html += '</div>';
  // téléphone : une seule barre avec le message du coup, le contrat et les plis
  if (tel()) {
    const ct = g.contract;
    const sum = m ? `<div class="sum">${contractHTML(ct)} par ${nameOf(ct.declarer)} · objectif <b>${missionTricks(g)} / ${B.mission.goalOf(m)}</b> plis</div>`
      : ct && g.phase !== 'bidding' ? `<div class="sum">${contractHTML(ct)} par ${nameOf(ct.declarer)} · Nord-Sud <b>${p.won[0]}</b> · Est-Ouest <b>${p.won[1]}</b></div>`
      : g.mini ? `<div class="sum">${g.board}</div>` : `<div class="sum">${boardLabel(g)} · Donneur : <b>${seatName(g.dealer)}</b></div>`;
    html += `<div class="bar ${status ? 'two' : ''}">${status || sum}<button class="menu-btn" data-act="menu"><span class="bars"></span>Menu</button>${status ? sum : ''}</div>`;
  }
  html += `<div class="actions">${actionsHTML()}</div>`;
  return html;
}
function auctionHTML() {
  const g = G.game;
  const head = ORDER.map(s => `<div class="${B.isVul(g.vul, s) ? 'vulh' : ''}">${s === 2 ? 'Sud' : SEATN[s]}</div>`).join('');
  const cells = [];
  const startCol = ORDER.indexOf(g.dealer);
  for (let i = 0; i < startCol; i++) cells.push('<span></span>');
  g.auction.forEach((c, i) => {
    const m = B.explain(g.auction, g.dealer, i);
    const cls = c === 'P' ? 'pass' : c === 'X' ? 'dbl' : c === 'XX' ? 'rdbl' : '';
    cells.push(`<button class="${cls} ${g.selCall === i ? 'sel' : ''}" data-act="sel:${i}">${callHTML(c)}${m.alert ? '<span class="al">!</span>' : ''}</button>`);
  });
  if (g.phase === 'bidding' && !B.auctionEnded(g.auction)) cells.push('<span class="q">?</span>');
  const rows = [];
  for (let i = 0; i < cells.length; i += 4) rows.push(`<div class="row">${cells.slice(i, i + 4).join('')}${'<span></span>'.repeat(Math.max(0, 4 - cells.slice(i, i + 4).length))}</div>`);
  return `<div class="auction"><div class="head">${head}</div>${rows.join('')}
    ${g.auction.length ? '<div class="hint-line">Touchez une enchère pour voir ce qu\'elle veut dire.</div>' : ''}</div>`;
}
function explainHTML() {
  const g = G.game;
  const i = g.selCall;
  if (i == null || i >= g.auction.length) return `<div class="explain"><div class="empty">Les explications des enchères s'afficheront ici.</div></div>`;
  const c = g.auction[i];
  const seat = (g.dealer + i) % 4;
  const m = B.explain(g.auction, g.dealer, i);
  const suits = [0, 1, 2, 3].map(s => {
    const t = B.lenText(m.len[s]);
    return `<div class="${t === 'Pas d\'indication' ? 'none' : ''}">${su(s)} ${t}</div>`;
  }).join('');
  const pts = B.ptsText(m), forcing = B.forcingText(m);
  return `<div class="explain">
    <div class="t">${callHTML(c, true)} <span class="who">${seat === 2 ? 'votre enchère' : 'par ' + nameOf(seat)}</span>${m.alert ? '<span class="badge">ALERTE</span>' : ''}</div>
    <div class="name">${rich(m.name)}</div>
    ${m.len.every(r => r[0] === 0 && r[1] >= 13) ? '' : `<div class="suits">${suits}</div>`}
    ${pts ? `<div class="pts">${pts}</div>` : ''}
    ${forcing ? `<div class="forcing">${forcing}</div>` : ''}
    ${m.text ? `<div class="txt">${rich(m.text)}</div>` : ''}
    ${m.fiche ? `<button class="fiche" data-fiche="${m.fiche}">${ICONS.book}<span>Fiche du cours n° ${m.fiche} : ${rich(B.FICHES[m.fiche])} <u>Ouvrir</u></span></button>` : ''}
  </div>`;
}
const ICONS = {
  print: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 8V3h10v5"/><rect x="3" y="8" width="18" height="9" rx="2"/><path d="M7 14h10v7H7z"/></svg>',
  net: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.8 2.6 4 5.7 4 9s-1.200 6.400-4 9c-2.800-2.600-4-5.700-4-9s1.200-6.400 4-9z"/></svg>',
  hint: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V17h5.2v-1.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/></svg>',
  undo: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>',
  last: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="9" height="13" rx="2"/><path d="M12 8l5-2 4 12-5 2"/></svg>',
  claim: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>',
  cam: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/></svg>',
  pic: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 16l-5-5-9 9"/></svg>',
  book: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 16h7"/></svg>',
  cap: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11.5V16c0 1.5 3 3 6 3s6-1.5 6-3v-4.500M22 9v6"/></svg>',
  list: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M9 4v16M15 4v16"/></svg>',
};
function actionsHTML() {
  const g = G.game;
  const p = g.play;
  const canUndo = g.undo.length > 0;
  // téléphone : les enchères et leurs explications s'ouvrent par-dessus le tapis
  const more = tel() ? `<button class="btn ${panelOpen ? 'on' : ''}" data-act="details">${ICONS.list}${g.mission ? 'Mission' : g.mini ? 'Leçon' : 'Enchères'}</button>` : '';
  if (g.phase === 'mini') return `<button class="btn gold" data-act="hint">${ICONS.hint}Conseil</button>${more}`;
  // en ligne : ni « Annuler » ni « Réclamer », on joue à plusieurs
  const undoBtn = g.online ? '' : `<button class="btn" data-act="undo" ${canUndo ? '' : 'disabled'}>${ICONS.undo}Annuler</button>`;
  // mode expert : pas de bouton Conseil
  const hintBtn = g.expert ? '' : `<button class="btn gold" data-act="hint">${ICONS.hint}Conseil</button>`;
  if (g.phase === 'bidding') return `${hintBtn}${undoBtn}${more}`;
  if (g.phase === 'play') {
    const canClaim = B.sideOf(p.declarer) === 0;
    return `${hintBtn}${undoBtn}
      <button class="btn" data-act="last" ${p.tricks.length ? '' : 'disabled'}>${ICONS.last}Dernier pli</button>
      ${g.online ? '' : `<button class="btn" data-act="claim" ${canClaim ? '' : 'disabled'}>${ICONS.claim}Réclamer</button>`}${more}`;
  }
  if (g.online) return `${onlineReadyBtn('style="grid-column:1/-1"')}${more}`;
  if (g.mission) return `<button class="btn primary" data-act="go:missions" style="grid-column:1/-1">Les missions</button>${more}`;
  if (g.learn) return `<button class="btn primary" data-act="learn-next" style="grid-column:1/-1">Donne suivante</button>${more}`;
  return `<button class="btn primary" data-act="new" style="grid-column:1/-1">Donne suivante</button>${more}`;
}

function endScreenHTML() {
  if (G.game.mission) return missionEndHTML();
  if (G.game.mini) return miniEndHTML();
  const g = G.game, r = g.result, ct = g.contract;
  let res, cls;
  if (r.passed) { res = 'Donne passée : personne n\'a ouvert.'; cls = ''; }
  else {
    const ns = B.sideOf(ct.declarer) === 0;
    const diff = r.tricks - (ct.level + 6);
    const who = nameOf(ct.declarer);
    if (ns) { res = r.made ? `Contrat réussi${diff > 0 ? ' avec ' + diff + ' de mieux' : ''} !` : `Chute de ${-diff}`; cls = r.made ? 'ok' : 'ko'; }
    else { res = r.made ? `Les adversaires réussissent leur contrat${diff > 0 ? ' (+' + diff + ')' : ''}` : `Bravo, le contrat adverse chute de ${-diff} !`; cls = r.made ? 'ko' : 'ok'; }
    res += `<div style="font-size:21px;color:var(--ink);font-weight:700;margin-top:4px">${contractHTML(ct)} joué par ${who} : ${r.tricks} pli${r.tricks > 1 ? 's' : ''}${g.play && g.play.claimed ? ' (dont ' + g.play.claimed + ' réclamés)' : ''}</div>`;
  }
  let quip = '';
  if (!r.passed && !g.online) {
    const win = r.ns > 0;   // « vous » gagnez la donne : votre camp marque les points
    const pa = perso(0), op = perso(g.board % 2 ? 1 : 3);
    const line = (q, txt, who) => `<div class="quip">${B.avatarSVG(q)}<div><b>${q.name}</b> <small>${who}</small><br>« ${txt} »</div></div>`;
    quip = `<div class="quips">${line(pa, win ? pa.avecGagne : pa.avecPerd, 'votre partenaire')}${line(op, win ? op.perd : op.gagne, 'adversaire')}</div>`;
  }
  if (!g.online) ensureAnalysis();
  const scoreTxt = r.passed ? '' : `<div class="score">Marque : Nord-Sud <b>${r.ns > 0 ? '+' : ''}${r.ns}</b> · Est-Ouest <b>${r.ns < 0 ? '+' : ''}${-r.ns}</b></div>`;
  const h = g.hands;
  const hbox = (s, cls2) => `<div class="h ${cls2}"><div class="nm">${seatName(s)} <span class="pt">${B.hcp(h[s])} H</span></div>${handText(h[s])}</div>`;
  let tricks = '';
  if (g.play && g.play.tricks.length) {
    tricks = `<details><summary>Les plis, un par un</summary><table class="trick-list"><tr><th>Pli</th><th>Nord</th><th>Est</th><th>Sud</th><th>Ouest</th><th>Gagné par</th></tr>
      ${g.play.tricks.map((t, k) => `<tr><td>${k + 1}</td>${[0, 1, 2, 3].map(s => { const x = t.cards.find(y => y.seat === s); return `<td class="${t.leader === s ? 'lead' : ''} ${t.winner === s ? 'w' : ''}">${B.RANK_TXT[B.rankOf(x.card)]}${su(B.suitOf(x.card))}</td>`; }).join('')}<td>${seatName(t.winner)}</td></tr>`).join('')}
      </table><p style="font-size:16px;color:var(--muted);margin:6px 0 0">Carte soulignée : l'entame du pli. Case dorée : la carte gagnante.</p></details>`;
  }
  return `<div class="end"><div class="box">
    <div class="res ${cls}">${res}</div>${scoreTxt}${quip}
    ${g.learn ? `<button class="btn green mi-comment" data-act="comment">${ICONS.book}Lire le commentaire de la donne</button>` : ''}
    ${g.online ? `<div class="on-totals">${onlineTotalsHTML()}</div>` : `<div class="an-status">${anStatusHTML()}</div>`}
    <div class="compass">${hbox(0, 'hn')}${hbox(3, 'hw')}<div class="mid">${boardLabel(g)}<br>Donneur : ${seatName(g.dealer)}</div>${hbox(1, 'he')}${hbox(2, 'hs')}</div>
    ${tricks}
    <div class="btns">${g.online ? onlineReadyBtn('') : `<button class="btn primary" data-act="${g.learn ? 'learn-next' : 'new'}">Donne suivante</button>
      <button class="btn" data-act="replay">Rejouer cette donne</button>
      <button class="btn" data-act="undo" ${g.undo.length ? '' : 'disabled'}>${ICONS.undo}Annuler la dernière carte</button>`}</div>
  </div></div>`;
}

/* ---------- Animations ---------- */
function bumpCls(i) {
  const p = G.game.play;
  if (!shownWon) shownWon = p.won.slice();
  const up = p.won[i] > shownWon[i] && anim();
  return up ? 'bump' : '';
}
function flyOrigin(seat, card) {
  const z = '.zone-' + 'nesw'[seat];
  const el = document.querySelector(`${z} .card[data-c="${card}"]`);
  if (el) return { card, rect: el.getBoundingClientRect(), face: true };
  const b = document.querySelector(`${z} .backs`) || document.querySelector(`${z} .tag`);
  return b ? { card, rect: b.getBoundingClientRect(), face: false } : null;
}
const center = r => [r.left + r.width / 2, r.top + r.height / 2];
function fx() {
  const g = G.game;
  if (g && g.play) shownWon = g.play.won.slice();
  newBidIdx = -1;
  if (!anim()) { fly = null; dealAnim = false; return; }
  const t = document.getElementById('table');
  if (!t) return;
  // distribution : les cartes partent du centre du tapis
  if (dealAnim) {
    dealAnim = false;
    const [cx, cy] = center(t.getBoundingClientRect());
    const els = [...t.querySelectorAll('.zone-s .hand .card')];
    const others = ['n', 'e', 'w'].map(z => [...t.querySelectorAll(`.zone-${z} .backs .card`)]);
    els.forEach((el, i) => {
      const [x, y] = center(el.getBoundingClientRect());
      el.animate([{ transform: `translate(${cx - x}px, ${cy - y}px) rotate(${(Math.random() * 40 - 20).toFixed(0)}deg) scale(.45)`, opacity: 0 },
        { transform: 'none', opacity: 1 }], { duration: 430, delay: 40 + i * 55, easing: 'cubic-bezier(.2,.8,.25,1)', fill: 'backwards' });
    });
    others.forEach((list, k) => list.forEach((el, i) => {
      const [x, y] = center(el.getBoundingClientRect());
      el.animate([{ transform: `translate(${cx - x}px, ${cy - y}px) scale(.6)`, opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 380, delay: 60 + (i * 3 + k) * 55, easing: 'cubic-bezier(.2,.8,.25,1)', fill: 'backwards' });
    }));
  }
  // la carte jouée vole de la main (ou du paquet du robot) jusqu'au pli
  if (fly) {
    const f = fly;
    fly = null;
    const el = t.querySelector(`.trick .card[data-c="${f.card}"]`);
    if (el) {
      const to = el.getBoundingClientRect();
      const [fx0, fy0] = center(f.rect), [tx, ty] = center(to);
      const sc = Math.max(0.4, Math.min(1.6, f.rect.width / to.width));
      const rot = (Math.random() * 24 - 12).toFixed(0);
      el.animate([
        { transform: `translate(${fx0 - tx}px, ${fy0 - ty}px) scale(${f.face ? sc : 0.5}) rotate(${rot}deg)`, opacity: f.face ? 1 : 0.2 },
        { transform: 'translate(0, 0) scale(1.08) rotate(0deg)', opacity: 1, offset: 0.8 },
        { transform: 'none', opacity: 1 }], { duration: 400, easing: 'cubic-bezier(.2,.75,.3,1)' });
    }
  }
  // le mort s'étale après l'entame
  if (g && g.phase === 'play' && B.dummyShown(g.play) && dummyRevealKey !== g.board) {
    dummyRevealKey = g.board;
    const cards = [...t.querySelectorAll('.dummy .card')];
    if (cards.length > 1 && cards.length >= g.play.hands[g.play.dummy].length - 1) {
      snd('dummy');
      cards.forEach((el, i) => el.animate([{ transform: 'translateY(-26px) scale(.8)', opacity: 0 }, { transform: 'none', opacity: 1 }],
        { duration: 320, delay: 250 + i * 35, easing: 'cubic-bezier(.2,.9,.3,1.15)', fill: 'backwards' }));
    }
  }
}
// à la fin du pli, les 4 cartes se regroupent puis glissent vers le camp gagnant
function collectTrick(w, done) {
  snd(B.sideOf(w) === 0 ? 'win' : 'lose');
  const t = document.getElementById('table');
  const cards = t ? [...t.querySelectorAll('.trick .slot .card')] : [];
  const tag = t && t.querySelector(`.zone-${'nesw'[w]} .tag`);
  if (!anim() || !cards.length || !tag) { done(); return; }
  const msg = t.querySelector('.status');
  if (msg) msg.style.opacity = 0;
  const [cx, cy] = center(t.querySelector('.trick').getBoundingClientRect());
  const [gx, gy] = center(tag.getBoundingClientRect());
  cards.forEach((el, i) => {
    const [x, y] = center(el.getBoundingClientRect());
    const r = ((i - 1.5) * 7).toFixed(0);
    el.animate([
      { transform: 'none', opacity: 1 },
      { transform: `translate(${cx - x}px, ${cy - y}px) rotate(${r}deg)`, opacity: 1, offset: 0.4 },
      { transform: `translate(${gx - x}px, ${gy - y}px) rotate(${r}deg) scale(.3)`, opacity: 0 }],
    { duration: 600, easing: 'cubic-bezier(.5,0,.3,1)', fill: 'forwards' });
  });
  setTimeout(done, 620);
}
// petite pluie de ♠ ♥ ♦ ♣ quand le contrat est gagné par notre camp
function confetti() {
  const t = document.getElementById('table');
  if (!t) return;
  const box = document.createElement('div');
  box.className = 'confetti';
  t.appendChild(box);
  const W = t.clientWidth, H = t.clientHeight;
  for (let i = 0; i < 40; i++) {
    const d = document.createElement('div');
    d.className = 'cf';
    d.innerHTML = su(i % 4);
    d.style.left = (Math.random() * W).toFixed(0) + 'px';
    d.style.fontSize = (20 + Math.random() * 24).toFixed(0) + 'px';
    box.appendChild(d);
    d.animate([{ transform: 'translate(0, -60px) rotate(0deg)', opacity: 1 },
      { transform: `translate(${(Math.random() * 140 - 70).toFixed(0)}px, ${H + 60}px) rotate(${(Math.random() * 720 - 360).toFixed(0)}deg)`, opacity: 0.9 }],
    { duration: 1900 + Math.random() * 1500, delay: Math.random() * 700, easing: 'cubic-bezier(.3,.1,.6,1)', fill: 'both' });
  }
  setTimeout(() => box.remove(), 4500);
}

/* ---------- Mise en page : taille des cartes selon l'écran ---------- */
function layout(shrink) {
  const t = document.getElementById('table');
  if (!t) return;
  const W = t.clientWidth, H = t.clientHeight;
  const g = G.game;
  // téléphone : en portrait, Ouest et Est sont en haut de chaque côté de Nord ; en paysage, les noms de Nord et Sud sont à gauche de leurs cartes
  const isTel = tel(), port = telPortrait();
  shrink = shrink || 1;
  const nz = t.querySelector('.zone-n'), sz = t.querySelector('.zone-s'), wz = t.querySelector('.zone-w'), ez = t.querySelector('.zone-e');
  const f = (G.settings.cardSize === 'normal' ? 0.85 : 1) * shrink;
  const n = g && g.play && g.phase === 'play' ? g.play.hands[2].length : 13;
  // main de Sud sur deux rangées (téléphone en portrait) : la plus longue rangée décide de la taille des cartes
  const rows = [...t.querySelectorAll('.hand.two .hrow')];
  const long = rows.length ? Math.max(...rows.map(r => r.children.length)) : n;
  const handW = W - 36 - (isTel && !port ? sz.querySelector('.tag').offsetWidth + 10 : 0);
  let cw = rows.length ? Math.min(handW / (1 + 0.5 * (long - 1)), 96) * f : Math.min((W - 40) / 6.4, (H - 60) / 6.2, 150) * f;
  cw = Math.max(52 * shrink, cw);
  const step = Math.min(cw * 0.66, (handW - cw) / Math.max(1, long - 1));
  let cwS = cw * 0.74;
  // téléphone en portrait : si le nom de Nord touche ceux d'Ouest et d'Est, on retire sa 2e ligne (« Nord · partenaire »)
  if (port) {
    const nt = nz.querySelector('.tag');
    nt.classList.remove('slim');
    if (nt.offsetWidth > W - 2 * (Math.max(wz.querySelector('.tag').offsetWidth, ez.querySelector('.tag').offsetWidth) + 7) - 6) nt.classList.add('slim');
  }
  // téléphone en portrait : les colonnes du mort de Nord tiennent entre les noms d'Ouest et d'Est
  if (port) cwS = Math.max(34, Math.min(cwS, (W - 2 * (Math.max(wz.querySelector('.tag').offsetWidth, ez.querySelector('.tag').offsetWidth) + 8) - 12) / 4.42));
  // hauteur visible de chaque carte dans les colonnes du mort
  const maxLen = g && g.play ? Math.max(1, ...[0, 1, 2, 3].map(s => g.play.hands[0].filter(c => B.suitOf(c) === s).length)) : 6;
  const vstep = Math.min(cwS * 1.42 * 0.33, (H * 0.36 - cwS * 1.42) / Math.max(1, maxLen - 1));
  const sideMax = g && g.play ? Math.max(1, ...[1, 3].map(seat => Math.max(0, ...[0, 1, 2, 3].map(s => g.play.hands[seat].filter(c => B.suitOf(c) === s).length)))) : 6;
  const st = t.style;
  st.setProperty('--cw', cw + 'px'); st.setProperty('--ch', cw * 1.42 + 'px'); st.setProperty('--step', step + 'px');
  st.setProperty('--cwS', cwS + 'px'); st.setProperty('--vstep', Math.max(cwS * 0.42, vstep) + 'px');
  // le coin en haut à droite est réservé au message du coup : Nord se décale un peu à gauche si la place manque
  // (sur téléphone, le message est dans la barre du bas)
  let nx = 0;
  if (!isTel && g && g.phase === 'play') {
    const right = W / 2 - nz.offsetWidth / 2, need = 196 + 18 + 12;
    if (right < need) nx = -Math.min(need - right, Math.max(0, right - 16));
  }
  st.setProperty('--nx', nx + 'px');
  let top = nz.offsetTop + nz.offsetHeight;
  const bottom = sz.offsetTop + (sz.querySelector('.hand') ? 22 : 0);
  // mort sur le côté (Est ou Ouest) : rangées qui se recouvrent, à la taille de l'espace libre
  const side = t.querySelector('.dummy.rows');
  const sideRows = side ? side.querySelectorAll('.row').length : 4;
  let cwD = cwS, hstep;
  if (port) {
    // téléphone en portrait : dans le coin en haut, à la largeur laissée par Nord
    const avail = (W - nz.offsetWidth) / 2 - 14;
    cwD = Math.max(32, Math.min(cw * 0.74, avail / (1 + 0.3 * (sideMax - 1))));
    hstep = Math.max(cwD * 0.3, Math.min(cwD * 0.45, (avail - cwD) / Math.max(1, sideMax - 1)));
  } else {
    const availSide = bottom - top + 30;
    const tagH = side ? side.parentElement.querySelector('.tag').offsetHeight + 9 : 50;
    if (tagH + cwD * (1.42 + 0.62 * (sideRows - 1)) > availSide) cwD = Math.max(44, (availSide - tagH) / (1.42 + 0.62 * (sideRows - 1)));
    hstep = Math.max(cwD * 0.36, Math.min(cwD * 0.45, (W * 0.27 - cwD) / Math.max(1, sideMax - 1)));
  }
  st.setProperty('--cwD', cwD + 'px'); st.setProperty('--rstep', cwD * 0.62 + 'px'); st.setProperty('--hstep', hstep + 'px');
  if (port) top = Math.max(top, wz.offsetTop + wz.offsetHeight, ez.offsetTop + ez.offsetHeight);
  const sideSeat = side && !port ? +side.dataset.seat : -1;
  st.setProperty('--cx', sideSeat === 1 ? `calc(50% - ${W * 0.05}px)` : sideSeat === 3 ? `calc(50% + ${W * 0.05}px)` : '50%');
  // le pli au centre : aussi grand que possible dans l'espace libre entre Nord et Sud
  const cwT = Math.max(46, Math.min(cw * (isTel ? 0.9 : 0.74), (bottom - top - 14) / (1.42 * 2.1)));
  st.setProperty('--cwT', cwT + 'px');
  st.setProperty('--cy', ((top + bottom) / 2) + 'px');
  let short = g && g.phase === 'play' && bottom - top - 14 < 46 * 1.42 * 2.1;
  // boîte d'enchères : toute la largeur libre entre Ouest et Est, et jamais par-dessus les cartes de Sud
  const bb = t.querySelector('.bidbox');
  if (bb) {
    const sides = port ? 0 : Math.max(wz.offsetLeft + wz.offsetWidth, W - ez.offsetLeft);
    st.setProperty('--bbw', Math.max(isTel ? 280 : 300, Math.min(560, W - 2 * sides - 16)) + 'px');
    // en haut : sous le nom et l'enchère de Nord (le dos de ses cartes peut être recouvert) — et d'Ouest et d'Est sur téléphone en portrait
    let nb = nz.offsetTop;
    for (const z of port ? [nz, wz, ez] : [nz]) for (const e of z.querySelectorAll('.tag, .bubble')) nb = Math.max(nb, z.offsetTop + e.offsetTop + e.offsetHeight);
    const hb = sz.offsetTop + 22;
    st.setProperty('--bbs', Math.max(0.55, Math.min(1, (hb - nb - 16) / bb.offsetHeight)));
    st.setProperty('--cy', ((nb + hb) / 2) + 'px');
    short = hb - nb - 16 < bb.offsetHeight * 0.55;
  }
  // téléphone : si le pli ou la boîte d'enchères ne tient pas entre les mains, on réduit un peu les cartes
  if (isTel && short && shrink > 0.75) return layout(shrink - 0.08);
  if (isTel && short && rows.length) return 'one-row';
  const pan = document.querySelector('.panel');
  if (isTel && pan) { pan.style.setProperty('--barH', pan.offsetHeight + 'px'); pan.style.setProperty('--panW', pan.offsetWidth + 'px'); }
}
window.addEventListener('resize', () => { if (screen === 'game' && layout() === 'one-row') { oneRow = true; render(); } });
// passage tablette ↔ téléphone, ou portrait ↔ paysage sur téléphone : la mise en page change, on redessine
[TEL, PORTRAIT].forEach(m => m.addEventListener('change', () => { oneRow = false; render(); }));

/* ---------- Pages ---------- */
function seg(key, opts) {
  return `<div class="seg">${opts.map(([v, l]) => `<button class="${G.settings[key] === v ? 'on' : ''}" data-act="set:${key}:${v}">${l}</button>`).join('')}</div>`;
}
function renderSettings() {
  $app.innerHTML = `<div class="page"><div class="inner">
    <button class="btn back" data-act="${backAct()}">← Retour</button>
    <h1>Réglages</h1>
    <div class="setting"><div class="lbl">Votre portrait<small>Votre photo (normale ou avec un effet rigolo), votre prénom et votre situation.</small></div><button class="btn me-btn" data-act="profil">${meAvatar()}Modifier</button></div>
    <div class="setting"><div class="lbl">Taille des cartes<small>« Très grandes » utilise toute la place disponible.</small></div>${seg('cardSize', [['normal', 'Grandes'], ['grand', 'Très grandes']])}</div>
    <div class="setting"><div class="lbl">Couleurs des cartes<small>4 couleurs : ${su(2)} orange et ${su(3)} vert, pour mieux les distinguer.</small></div>${seg('fourColors', [[false, '2 couleurs'], [true, '4 couleurs']])}</div>
    <div class="setting"><div class="lbl">Tour de table<small>Avant chaque nouvelle donne, les joueurs se présentent.</small></div>${seg('tour', [[true, 'Oui'], [false, 'Non']])}</div>
    <div class="setting"><div class="lbl">Vitesse des robots</div>${seg('speed', [['lent', 'Lente'], ['normal', 'Normale'], ['rapide', 'Rapide']])}</div>
    <div class="setting"><div class="lbl">Jouer une carte<small>Deux touchers : le 1er soulève la carte, le 2e la joue (évite les erreurs).</small></div>${seg('doubleTap', [[true, '2 touchers'], [false, '1 toucher']])}</div>
    <div class="setting"><div class="lbl">Afficher mes points<small>Le nombre de points H et HL sous la boîte d'enchères.</small></div>${seg('showPoints', [[true, 'Oui'], [false, 'Non']])}</div>
    <div class="setting"><div class="lbl">Sons<small>Bruit des cartes, petite cloche quand c'est à vous, musique en fin de donne.</small></div>${seg('sound', [[true, 'Oui'], [false, 'Non']])}</div>
    <div class="setting"><div class="lbl">Volume des sons</div>${seg('volume', [['faible', 'Faible'], ['moyen', 'Moyen'], ['fort', 'Fort']])}</div>
    <div class="setting"><div class="lbl">Musique d'ambiance<small>Un air de casino de la Côte d'Azur, tout doux, pendant le jeu.</small></div>${seg('music', [['non', 'Non'], ['douce', 'Douce'], ['moyenne', 'Moyenne'], ['forte', 'Forte']])}</div>
    <div class="setting"><div class="lbl">Enchères à voix haute<small>Les robots disent leurs enchères avec la voix de l'iPad (« Nord : un cœur »).</small></div>${seg('voice', [[true, 'Oui'], [false, 'Non']])}</div>
    <div class="setting"><div class="lbl">Animations<small>Les cartes volent jusqu'au centre, les plis glissent vers le gagnant.</small></div>${seg('animations', [[true, 'Oui'], [false, 'Non']])}</div>
    <button class="btn" data-act="sound-test" style="max-width:420px;margin:6px 0 10px">Tester le son</button>
    <div class="setting"><div class="lbl">Vérifier mes enchères<small>Prévient quand votre enchère s'écarte des fiches du cours.</small></div>${seg('checkBids', [[true, 'Oui'], [false, 'Non']])}</div>
    <div class="setting"><div class="lbl">Les donnes<small>« Plus de jeu » : votre camp a plus souvent la majorité des points.</small></div>${seg('deals', [['hasard', 'Au hasard'], ['jeu', 'Plus de jeu']])}</div>
    <h2>Mes données</h2>
    <p>Les résultats sont gardés sur cette tablette uniquement.</p>
    <button class="btn" data-act="reset-stats" style="max-width:420px">Effacer mes résultats</button>
  </div></div>`;
}
function renderStats() {
  const h = G.stats.history;
  const played = h.filter(x => x.contract);
  const decl = played.filter(x => x.contract.declarer % 2 === 0);
  const def = played.filter(x => x.contract.declarer % 2 === 1);
  const made = decl.filter(x => x.made).length;
  const beat = def.filter(x => !x.made).length;
  const total = h.reduce((t, x) => t + (x.ns || 0), 0);
  const rows = h.slice(-30).reverse().map(x => {
    const ct = x.contract;
    if (!ct) return `<tr><td>${x.board}</td><td>Donne passée</td><td>—</td><td>—</td><td>0</td></tr>`;
    const ns = ct.declarer % 2 === 0;
    const good = ns ? x.made : !x.made;
    const diff = x.tricks - (ct.level + 6);
    return `<tr><td>${x.board}</td><td>${contractHTML(ct)} par ${ct.declarer === 2 ? 'vous' : SEATN[ct.declarer]}</td><td>${x.tricks}</td><td class="${good ? 'ok' : 'ko'}">${x.made ? (diff ? 'Réussi +' + diff : 'Réussi') : 'Chute de ' + (-diff)}</td><td>${x.ns > 0 ? '+' : ''}${x.ns}</td></tr>`;
  }).join('');
  $app.innerHTML = `<div class="page"><div class="inner">
    <button class="btn back" data-act="${G.game && G.game.phase !== 'end' ? 'resume' : 'go:home'}">← Retour</button>
    <h1>Mes résultats</h1>
    <div class="stats-cards">
      <div><b>${h.length}</b>donnes jouées</div>
      <div><b>${decl.length ? Math.round(100 * made / decl.length) + ' %' : '—'}</b>contrats réussis par mon camp (${made} sur ${decl.length})</div>
      <div><b>${def.length ? Math.round(100 * beat / def.length) + ' %' : '—'}</b>contrats adverses chutés (${beat} sur ${def.length})</div>
      <div><b>${total > 0 ? '+' : ''}${total}</b>points au total (Nord-Sud)</div>
    </div>
    ${persoStatsHTML()}
    <h2>Dernières donnes</h2>
    ${rows ? `<table class="hist"><tr><th>Donne</th><th>Contrat</th><th>Plis</th><th>Résultat</th><th>Marque NS</th></tr>${rows}</table>` : '<p>Aucune donne terminée pour l\'instant.</p>'}
  </div></div>`;
}
function persoStatsHTML() {
  const wl = G.stats.wl || {};
  const list = B.PERSOS.filter(q => wl[q.name]);
  if (!list.length) return '';
  const cell = w => w.v + w.d ? `<span class="w">✓ ${w.v}</span> <span class="l">✗ ${w.d}</span>` : '—';
  return `<h2>Avec et contre les personnages</h2><table class="hist persos"><tr><th></th><th>Personnage</th><th>Avec (partenaire)</th><th>Contre (adversaire)</th></tr>
    ${list.map(q => `<tr><td>${B.avatarSVG(q)}</td><td><b>${q.name}</b><br><small>${q.title}</small></td><td>${cell(wlOf(q.name, true))}</td><td>${cell(wlOf(q.name, false))}</td></tr>`).join('')}</table>`;
}
function renderHelp() {
  $app.innerHTML = `<div class="page"><div class="inner">
    <button class="btn back" data-act="${G.game && G.game.phase !== 'end' ? 'resume' : 'go:home'}">← Retour</button>
    <h1>Comment jouer</h1>
    <p>Vous êtes <b>Sud</b>, en bas de l'écran. Votre partenaire (en Nord) et vos deux adversaires (Est et Ouest) sont des robots, joués par des personnages de la Côte d'Azur tirés au sort à chaque donne : touchez un visage pour faire connaissance, et touchez « Vous » pour mettre votre photo. Ils annoncent comme dans les fiches de votre cours (Majeure 5e, 1SA de 15 à 17 points, Stayman, Texas, 2 faibles…).</p>
    <h2>Les enchères</h2>
    <ul>
      <li>Quand c'est à vous, la boîte d'enchères apparaît au milieu du tapis : touchez d'abord le <b>palier</b> (1 à 7), puis la <b>couleur</b> (${su(3)} ${su(2)} ${su(1)} ${su(0)} ou SA).</li>
      <li>Les boutons <b>Passe</b>, <b>Contre</b> et <b>Surcontre</b> sont juste en dessous.</li>
      <li>Dans le tableau des enchères à droite (sur téléphone : bouton « Enchères » en bas), <b>touchez une enchère</b> pour voir ce qu'elle veut dire : nombre de points, nombre de cartes dans chaque couleur, et la fiche du cours qui en parle. Un rond orange <span style="display:inline-block;width:20px;height:20px;border-radius:50%;background:#e8590c;color:#fff;text-align:center;font-size:14px;line-height:20px">!</span> signale une enchère conventionnelle (alerte).</li>
      <li>Si votre enchère s'écarte du cours, l'application vous le signale et vous laisse choisir (réglable).</li>
    </ul>
    <h2>Le jeu de la carte</h2>
    <ul>
      <li>Touchez une carte pour la <b>soulever</b>, touchez-la une 2e fois pour la <b>jouer</b>. Les cartes grisées ne peuvent pas être jouées (il faut fournir à la couleur demandée).</li>
      <li>Quand votre camp joue le contrat, <b>vous jouez aussi les cartes du mort</b> (votre partenaire, en haut). Touchez directement la carte du mort que vous voulez jouer.</li>
      <li>Quand les adversaires jouent le contrat, le mort est étalé sur le côté après l'entame.</li>
    </ul>
    <h2>Apprendre</h2>
    <ul>
      <li>Depuis l'accueil ou le Menu, touchez <b>« Apprendre »</b>.</li>
      <li><b>Mini-bridge</b> : sans enchères. On compte ses points, on voit quel camp joue, puis on choisit le contrat.</li>
      <li><b>Le cours pas à pas</b> : un chapitre par thème des fiches, avec l'essentiel, la fiche et des donnes choisies pour s'exercer.</li>
      <li><b>Donnes commentées</b> : jouez la donne, puis lisez l'explication de chaque enchère, le plan de jeu et l'entame.</li>
      <li>Une coche verte montre une donne réussie. Ces donnes ne comptent pas dans « Mes résultats ».</li>
    </ul>
    <h2>Les missions</h2>
    <ul>
      <li>Depuis l'accueil, touchez <b>« ★ Les missions »</b> : ce sont des fins de donne avec un but, comme dans un jeu.</li>
      <li><b>Faire les plis</b> : vous êtes déclarant, il faut faire assez de plis. <b>Empêcher les plis</b> : vous êtes en défense, il faut faire chuter le contrat.</li>
      <li>Chaque mission reprend une leçon de la fiche « Jeu de la carte ». Elles deviennent de plus en plus difficiles : une mission s'ouvre quand la précédente est réussie (ou après 3 essais).</li>
      <li>Les robots voient toutes les cartes et jouent parfaitement : seul le bon plan réussit. Si une carte rend la mission impossible, l'appli vous prévient tout de suite : « Annuler » permet de rejouer le coup.</li>
    </ul>
    <h2>Les boutons</h2>
    <ul>
      <li><b>Conseil</b> : pendant les enchères, la fiche du cours s'ouvre d'abord pour que vous réfléchissiez ; touchez « Voir la réponse » si vous voulez l'enchère recommandée. Pendant le jeu, la carte que le cours recommande, avec la raison.</li>
      <li><b>Annuler</b> : revenir avant votre dernière enchère ou votre dernière carte.</li>
      <li><b>Dernier pli</b> : revoir les 4 cartes du pli précédent.</li>
      <li><b>Réclamer</b> : terminer la donne quand toutes vos cartes sont maîtresses.</li>
      <li><b>Menu</b> : nouvelle donne, recommencer la donne, résultats, réglages.</li>
      <li><b>En fin de donne</b>, l'ordinateur analyse votre jeu : ce qu'il fallait faire, tous les coups un par un, et la meilleure façon de jouer. Vous pouvez ensuite rejouer la donne.</li>
      <li><b>Votre portrait</b> : touchez « Vous » en bas du tapis pour mettre une photo (normale ou rigolote), votre prénom et votre situation. Les compteurs verts et rouges à côté des visages comptent vos victoires et vos défaites.</li>
    </ul>
    <h2>Mémo du cours</h2>
    <div class="memo">
      <p><b>Points H</b> : As 4, Roi 3, Dame 2, Valet 1. <b>Points L</b> : 1 point par carte à partir de la 5e. <b>Points D</b> (avec un fit) : chicane 3, singleton 2, doubleton 1.</p>
      <p><b>Ouvrir</b> : 12 points H (ou 13 HL). 1SA : 15 à 17 H régulier. 2SA : 20-21 H. 2${su(3)} : 20 à 23 HL fort. 2${su(2)} : 24 HL et plus.</p>
      <p><b>Points pour la manche</b> : 3SA environ 25 H ; 4${su(1)} ou 4${su(0)} environ 27 HS ; 5${su(3)} ou 5${su(2)} environ 30 HS. <b>Petit chelem</b> : 33 points.</p>
      <p><b>Jeu de la carte</b> : petite carte en 2e position, plus forte carte en 3e position, honneur sur honneur, rejouer la couleur d'entame du partenaire.</p>
    </div>
    <h2>Les fiches du cours</h2>
    <p>Touchez une fiche pour l'ouvrir.</p>
    ${ficheListHTML()}
  </div></div>`;
}

/* ---------- Votre portrait : selfie normal ou visage déformé pour rire ---------- */
const CAM_AV = '<svg class="av cam" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="50" fill="#efe6d2"/><path d="M28 39h9l4-6h18l4 6h9a4 4 0 0 1 4 4v25a4 4 0 0 1-4 4H28a4 4 0 0 1-4-4V43a4 4 0 0 1 4-4z" fill="#1d2b4f"/><circle cx="50" cy="56" r="11" fill="#efe6d2"/><circle cx="50" cy="56" r="6.5" fill="#1d2b4f"/><circle cx="76" cy="27" r="12" fill="#c9a34a"/><path d="M76 20.5v13M69.5 27h13" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/></svg>';
const meAvatar = () => P.photo ? `<img class="av" src="${P.photo}" alt="">` : CAM_AV;
const EFFECTS = [['normale', 'Normale'], ['nez', 'Gros nez'], ['yeux', 'Gros yeux'], ['joues', 'Bonnes joues'], ['front', 'Grand front'], ['tourbillon', 'Tourbillon']];
// loupe déformante : à l'intérieur de l'ellipse, on va chercher les pixels plus près du centre (k > 1 grossit)
function bulge(u, v, cx, cy, rx, ry, k) {
  const dx = (u - cx) / rx, dy = (v - cy) / ry, r = Math.hypot(dx, dy);
  if (r >= 1 || r === 0) return null;
  const f = Math.pow(r, k) / r;
  return [cx + dx * f * rx, cy + dy * f * ry];
}
const WARP = {
  normale: (u, v) => [u, v],
  nez: (u, v) => bulge(u, v, 0, 0.1, 0.62, 0.62, 1.9) || [u, v],
  yeux: (u, v) => bulge(u, v, -0.3, -0.12, 0.29, 0.29, 2.1) || bulge(u, v, 0.3, -0.12, 0.29, 0.29, 2.1) || [u, v],
  joues: (u, v) => bulge(u, v, 0, 0.38, 0.9, 0.55, 1.75) || [u, v],
  front: (u, v) => bulge(u, v, 0, -0.45, 0.95, 0.62, 1.8) || [u, v],
  tourbillon: (u, v) => {
    const r = Math.hypot(u, v);
    if (r >= 1) return [u, v];
    const a = (1 - r) * (1 - r) * 2.4, c = Math.cos(a), sn = Math.sin(a);
    return [u * c - v * sn, u * sn + v * c];
  },
};
// applique l'effet : src = pixels carrés S×S, résultat dessiné dans le canvas out
function warp(src, S, out, name) {
  const N = out.width, ctx = out.getContext('2d'), img = ctx.createImageData(N, N), d = img.data, sd = src.data, f = WARP[name] || WARP.normale;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const [us, vs] = f((i + 0.5) / N * 2 - 1, (j + 0.5) / N * 2 - 1);
      const x = Math.min(S - 1, Math.max(0, Math.floor((us + 1) / 2 * S)));
      const y = Math.min(S - 1, Math.max(0, Math.floor((vs + 1) / 2 * S)));
      const a = (y * S + x) * 4, b = (j * N + i) * 4;
      d[b] = sd[a]; d[b + 1] = sd[a + 1]; d[b + 2] = sd[a + 2]; d[b + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
}
function openProfile() {
  const S = 480;
  const ed = { name: P.name || '', title: P.title || '', effect: P.effect || 'normale', img: null, z: 1, cx: 0, cy: 0 };
  const crop = document.createElement('canvas');
  crop.width = crop.height = S;
  let src = null;
  modal(`<h2>Votre portrait</h2>
    <div class="pf">
      <div class="pf-left">
        <div class="pf-photo"><canvas class="pf-big" width="320" height="320"></canvas><div class="pf-empty">${CAM_AV}</div></div>
        <div class="pf-zoom"><span>Zoom</span><input type="range" min="1" max="3" step="0.02" value="1"></div>
        <button class="pf-del">Retirer la photo</button>
      </div>
      <div class="pf-side">
        <div class="pf-pick"><label class="btn primary">${ICONS.cam}Selfie<input type="file" accept="image/*" capture="user" hidden></label>
        <label class="btn">${ICONS.pic}Mes photos<input type="file" accept="image/*" hidden></label></div>
        <p class="pf-tip">Glissez la photo du doigt pour mettre le visage au centre du rond.</p>
        <label class="pf-field">Votre prénom<input type="text" class="pf-name" maxlength="20" placeholder="Marianne" value="${esc(ed.name)}"></label>
        <label class="pf-field">Votre situation<input type="text" class="pf-title" maxlength="40" placeholder="ex. : la reine du bridge de Beaulieu" value="${esc(ed.title)}"></label>
      </div>
    </div>
    <div class="pf-fx">${EFFECTS.map(([k, l]) => `<button class="fx ${k === ed.effect ? 'on' : ''}" data-fx="${k}"><canvas width="96" height="96"></canvas><span>${l}</span></button>`).join('')}</div>
    <div class="btns"><button class="btn primary" data-m="save">Enregistrer</button><button class="btn" data-m="no">Annuler</button></div>`,
  v => { if (v === 'save') commit(); }, 'profil');
  const root = $modal.querySelector('.sheet');
  const big = root.querySelector('.pf-big'), zoom = root.querySelector('.pf-zoom input');
  const thumbs = [...root.querySelectorAll('.fx')];
  const refresh = () => {
    root.classList.toggle('has-photo', !!ed.img);
    if (!ed.img) { src = null; return; }
    const w = ed.img.naturalWidth, h = ed.img.naturalHeight, side = Math.min(w, h) / ed.z;
    ed.cx = Math.min(w - side / 2, Math.max(side / 2, ed.cx));
    ed.cy = Math.min(h - side / 2, Math.max(side / 2, ed.cy));
    const c = crop.getContext('2d');
    c.drawImage(ed.img, ed.cx - side / 2, ed.cy - side / 2, side, side, 0, 0, S, S);
    src = c.getImageData(0, 0, S, S);
    warp(src, S, big, ed.effect);
  };
  const refreshThumbs = () => { if (src) thumbs.forEach(b => warp(src, S, b.querySelector('canvas'), b.dataset.fx)); };
  const useImage = (im, keep) => {
    ed.img = im;
    if (!keep) { ed.z = 1; zoom.value = 1; }
    ed.cx = im.naturalWidth / 2; ed.cy = im.naturalHeight / 2;
    refresh(); refreshThumbs();
  };
  if (P.src) { const im = new Image(); im.onload = () => useImage(im); im.src = P.src; }
  else refresh();
  root.querySelectorAll('input[type=file]').forEach(inp => inp.addEventListener('change', () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    const im = new Image();
    im.onload = () => useImage(im);
    im.onerror = () => toast('Cette photo ne peut pas être ouverte.');
    im.src = URL.createObjectURL(f);
    inp.value = '';
  }));
  zoom.addEventListener('input', () => { ed.z = +zoom.value; refresh(); });
  zoom.addEventListener('change', refreshThumbs);
  // faire glisser la photo pour cadrer le visage
  let drag = null;
  big.addEventListener('pointerdown', e => { if (!ed.img) return; drag = { x: e.clientX, y: e.clientY }; big.setPointerCapture(e.pointerId); });
  big.addEventListener('pointermove', e => {
    if (!drag) return;
    const side = Math.min(ed.img.naturalWidth, ed.img.naturalHeight) / ed.z, k = side / big.clientWidth;
    ed.cx -= (e.clientX - drag.x) * k; ed.cy -= (e.clientY - drag.y) * k;
    drag = { x: e.clientX, y: e.clientY };
    refresh();
  });
  const endDrag = () => { if (drag) { drag = null; refreshThumbs(); } };
  big.addEventListener('pointerup', endDrag);
  big.addEventListener('pointercancel', endDrag);
  thumbs.forEach(b => b.addEventListener('click', () => {
    ed.effect = b.dataset.fx;
    thumbs.forEach(x => x.classList.toggle('on', x === b));
    snd('select');
    refresh();
  }));
  root.querySelector('.pf-del').addEventListener('click', () => { ed.img = null; refresh(); });
  root.querySelector('.pf-name').addEventListener('input', e => { ed.name = e.target.value; });
  root.querySelector('.pf-title').addEventListener('input', e => { ed.title = e.target.value; });
  function commit() {
    P.name = ed.name.trim();
    P.title = ed.title.trim();
    if (src) {
      P.effect = ed.effect;
      P.src = crop.toDataURL('image/jpeg', 0.85);
      const out = document.createElement('canvas');
      out.width = out.height = 320;
      warp(src, S, out, ed.effect);
      P.photo = out.toDataURL('image/jpeg', 0.85);
    } else { delete P.photo; delete P.src; delete P.effect; }
    if (!saveProfile()) toast('Le portrait n\'a pas pu être enregistré sur cette tablette.');
    else { snd('success'); toast(P.photo ? 'Votre portrait est enregistré.' : 'C\'est enregistré.'); }
    render();
  }
}

/* ---------- Analyse de la donne : ce qui n'allait pas, tous les coups, la meilleure façon de jouer ---------- */
let AN = { sig: null, res: null, pct: 0 };
let review = { mode: 'mine', step: 0 };
const dealSig = g => JSON.stringify([g.board, g.hands[2], g.auction, g.play ? g.play.tricks.map(t => t.cards.map(x => x.card)) : 0]);
const userNS = g => !!g.contract && B.sideOf(g.contract.declarer) === 0;
// position de départ (mission : fin de donne avec plis déjà faits) et cartes déjà posées dans le 1er pli
const startOf = g => g.mission ? B.mission.startState(missionOf(g)) : B.newPlay(g.hands, g.contract);
const preOf = g => g.mission ? startOf(g).trick.length : 0;
// lance l'analyse de la donne terminée (une seule fois par donne), un peu après la fin pour laisser la fête se jouer
function ensureAnalysis(delay) {
  const g = G.game;
  if (!g || g.phase !== 'end' || !g.result) return;
  const sig = dealSig(g);
  if (AN.sig === sig) return;
  const job = AN = { sig, res: null, pct: 0 };
  setTimeout(() => {
    if (AN !== job) return;
    B.analyseDeal(g, { userNS: userNS(g), progress: (d, t) => {
      if (AN !== job) throw new Error('donne changée');
      job.pct = Math.round(100 * d / t);
      const b = document.querySelector('.an-bar b');
      if (b) b.style.width = job.pct + '%';
    } }).then(res => { if (AN === job) { job.res = res; refreshAnalysisViews(); } })
      .catch(() => { if (AN === job) { job.res = { bids: [], seq: [], best: null, won: [0, 0], failed: true }; refreshAnalysisViews(); } });
  }, delay == null ? 1500 : delay);
}
function refreshAnalysisViews() {
  if (screen === 'analyse') render();
  const el = document.querySelector('.an-status');
  if (el) el.innerHTML = anStatusHTML();
}
const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;
const ordinal = n => n === 1 ? '1re' : n + 'e';
function anStatusHTML() {
  const a = AN.res;
  if (!a) return `<div class="an-wait">L'ordinateur analyse votre donne…<div class="an-bar"><b style="width:${AN.pct}%"></b></div></div>`;
  const fixes = a.seq.filter(x => x.fix).length, n = a.bids.length + fixes;
  const txt = a.failed ? 'L\'analyse n\'a pas pu être faite pour cette donne.'
    : n ? `<b>${plural(n, 'point')} à revoir</b> : ${[a.bids.length ? plural(a.bids.length, 'enchère') : '', fixes ? plural(fixes, 'carte') : ''].filter(Boolean).join(' et ')}.`
      : '<b>Rien à redire</b> : vous avez suivi le cours.';
  return `<div class="an-done ${n ? 'warn' : 'ok'}">${txt}</div>
    ${a.failed ? '' : `<button class="btn gold" data-act="analyse">${ICONS.hint}${n ? 'Voir ce qu\'il fallait faire et la meilleure façon de jouer' : 'Voir la meilleure façon de jouer'}</button>`}`;
}
function renderAnalysis() {
  const g = G.game, a = AN.res;
  const m = missionOf(g);
  const head = `<button class="btn back" data-act="resume">← Retour ${m ? 'à la mission' : 'à la donne'}</button><h1>${m ? 'Analyse de la mission : ' + m.titre : g.learn ? 'Analyse · ' + g.board : 'Analyse de la donne n° ' + g.board}</h1>`;
  if (!a) {
    $app.innerHTML = `<div class="page"><div class="inner analyse">${head}<div class="an-wait big">L'ordinateur analyse votre donne…<div class="an-bar"><b style="width:${AN.pct}%"></b></div></div></div></div>`;
    return;
  }
  const ct = g.contract, r = g.result;
  const items = [];
  a.bids.forEach(b => items.push(`<li><div class="an-k">Enchères · votre ${ordinal(b.nth)} enchère</div>
    Vous avez dit <b>${callHTML(b.call, true)}</b> ; ${b.sure ? 'le cours conseillait' : 'le robot aurait dit'} <b>${callHTML(b.best, true)}</b>.
    <div class="an-why">${callHTML(b.best, true)} : ${rich(b.m.name)}. ${rich(b.m.text)}</div>
    ${b.mine && b.mine.name && b.call !== 'P' ? `<div class="an-mine">Votre ${callHTML(b.call, true)} voulait dire : ${rich(b.mine.name)}.</div>` : ''}
    ${b.sure && b.m.fiche ? ficheBtn(b.m.fiche) : ''}</li>`));
  a.seq.forEach((x, i) => {
    if (!x.fix) return;
    const k = Math.floor((i + preOf(g)) / 4) + 1;
    items.push(`<li><div class="an-k">Jeu de la carte · pli ${k}</div>
      Vous avez joué ${cardTxtHTML(x.card)}${x.seat === 0 ? ' (de ' + nameOf(0) + ')' : ''} ; ${x.fix.exact ? 'il fallait jouer' : 'le cours conseillait plutôt'} ${cardTxtHTML(x.fix.card)}.
      ${x.fix.reason ? `<div class="an-why">${rich(x.fix.reason)}</div>` : ''}
      ${x.fix.exact ? `<div class="an-mine">En voyant toutes les cartes : ${plural(x.fix.lost, 'pli')} de perdu avec ce coup.</div>` : ''}
      <button class="btn small" data-act="revue:mine:${i + 1}">Voir ce coup</button></li>`);
  });
  let compare = '';
  if (a.best && ct) {
    const nsWas = a.won[0], nsBest = a.best.won[0], ns = B.sideOf(ct.declarer) === 0;
    const need = ct.level + 6, made = t => ns ? t >= need : 13 - t < need;
    compare = nsBest > nsWas
      ? `Avec la meilleure façon de jouer, Nord-Sud fait <b>${plural(nsBest, 'pli')}</b> au lieu de ${nsWas}${made(nsBest) !== made(nsWas) ? (made(nsBest) === ns ? ' : le contrat est réussi' : ' : le contrat adverse chute') : ''}.`
      : `Vous avez fait <b>au moins aussi bien</b> que la meilleure façon de jouer trouvée par l'ordinateur (${plural(nsBest, 'pli')} pour Nord-Sud). Bravo !`;
  }
  $app.innerHTML = `<div class="page"><div class="inner analyse">${head}
    <div class="an-res">${m ? `${r.ok ? 'Mission réussie' : 'Mission ratée'} : Nord-Sud a fait ${plural(missionTricks(g), 'pli')}, il en fallait ${B.mission.goalOf(m)}.`
      : ct ? `${contractHTML(ct)} joué par ${nameOf(ct.declarer)} : ${plural(r.tricks, 'pli')}${r.made ? ', contrat réussi' : ', contrat chuté'}.` : 'Donne passée.'}</div>
    ${m ? `<div class="mi-lesson"><b>La leçon :</b> ${rich(m.lecon)}</div>` : g.mini ? '' : auctionGridHTML(g, a.bids.map(b => b.i))}
    <h2>Ce qui n'allait pas</h2>
    ${items.length ? `<ol class="an-list">${items.join('')}</ol>` : `<p class="an-ok">${m ? 'Rien à redire : vous avez joué les bonnes cartes. Bravo !' : 'Rien à redire : vos enchères et vos cartes suivent le cours. Bravo !'}</p>`}
    ${a.best ? `<h2>Pour bien comprendre</h2><p>${compare}</p>
    <div class="an-btns">
      <button class="btn primary" data-act="revue:mine">Revoir tous les coups de la donne</button>
      <button class="btn gold" data-act="revue:best">★ Voir la meilleure façon de jouer</button>
    </div>` : ''}
    <div class="an-btns">${m ? '<button class="btn green" data-act="replay">↻ Recommencer la mission</button><button class="btn" data-act="go:missions">Toutes les missions</button>'
      : `<button class="btn green" data-act="replay">↻ Rejouer cette donne</button><button class="btn" data-act="${g.learn ? 'learn-next' : 'new'}">Donne suivante</button>`}</div>
    <p class="an-note">${m ? 'Dans les missions, l\'ordinateur calcule exactement chaque coup en voyant toutes les cartes.' : 'Pour les 8 derniers plis, l\'ordinateur calcule exactement en voyant toutes les cartes. Avant, il suit les conseils du cours, comme le bouton « Conseil ».'}</p>
  </div></div>`;
}
function auctionGridHTML(g, bad) {
  const head = ORDER.map(s => `<div>${s === 2 ? (P.name ? esc(P.name) : 'Vous') : perso(s).name}<small>${SEATN[s]}</small></div>`).join('');
  const cells = [];
  for (let i = 0; i < ORDER.indexOf(g.dealer); i++) cells.push('<span></span>');
  g.auction.forEach((c, i) => cells.push(`<span class="${c === 'P' ? 'pass' : ''} ${bad.includes(i) ? 'bad' : ''}">${callHTML(c)}</span>`));
  while (cells.length % 4) cells.push('<span></span>');
  return `<div class="an-auction"><div class="hd">${head}</div><div class="bd">${cells.join('')}</div></div>`;
}
// le lecteur : la donne cartes visibles, une carte à la fois, avec l'explication de chaque coup
function reviewSeq() { return review.mode === 'best' ? AN.res.best.seq : AN.res.seq; }
function reviewMove(how) {
  const seq = reviewSeq(), n = seq.length;
  let p = review.step;
  if (how === 'prev') p--;
  else if (how === 'next') p++;
  else if (how === 'trick') { const o = preOf(G.game); p = Math.floor((p + o) / 4) * 4 + 4 - o; }
  else if (how === 'fix') { const i = seq.findIndex((x, j) => j >= p && x.fix); p = i >= 0 ? i + 1 : p; }
  else if (how === 'start') p = 0;
  review.step = Math.max(0, Math.min(n, p));
  snd(how === 'prev' ? 'select' : 'card');
  render();
}
function renderReview() {
  const g = G.game, a = AN.res, best = review.mode === 'best';
  const seq = reviewSeq(), n = seq.length, p = Math.max(0, Math.min(n, review.step));
  const st = startOf(g);
  for (let i = 0; i < p; i++) B.playCard(st, seq[i].seat, seq[i].card);
  let shown = st.trick, winner = -1;
  if (!shown.length && st.tricks.length && p > 0) { const t = st.tricks[st.tricks.length - 1]; shown = t.cards; winner = t.winner; }
  const last = p > 0 ? seq[p - 1] : null;
  const fixCard = !best && last && last.fix ? last.fix.card : null;
  const isUser = s => s === 2 || (s === 0 && userNS(g));
  const who = s => s === 2 ? (P.name ? esc(P.name) : 'Vous') : perso(s).name;
  const hand = s => `<div class="rv-hand rv-${'nesw'[s]} ${!st.done && st.turn === s && p < n ? 'next' : ''}">
    <div class="rv-who">${s === 2 ? meAvatar() : B.avatarSVG(perso(s))}${who(s)}<small>${SEATN[s]}</small></div>
    ${[0, 1, 2, 3].map(su0 => `<div class="rv-suit">${su(su0)} ${B.ranksIn(st.hands[s], su0).map(r => `<span class="${su0 * 13 + r === fixCard ? 'fix' : ''}">${B.RANK_TXT[r]}</span>`).join(' ') || '—'}</div>`).join('')}</div>`;
  const trick = `<div class="center"><div class="trick">${shown.map(x => `<div class="slot s${x.seat} ${x.seat === winner ? 'win' : ''} ${last && x.card === last.card && last.fix && !best ? 'bad' : ''}">${cardHTML(x.card, x.card === (last && last.card) ? '' : 'nodrop')}</div>`).join('')}</div></div>`;
  let exp;
  if (!last) {
    const ct = g.contract;
    exp = `<p><b>${best ? 'La meilleure façon de jouer' : 'Votre partie, coup par coup'}.</b></p><p>Contrat : <b>${contractHTML(ct)}</b> joué par ${nameOf(ct.declarer)}. ${who((ct.declarer + 1) % 4)} entame.</p>
      <p>Toutes les cartes sont visibles. Touchez « Suivant » pour voir chaque carte${best ? ' et pourquoi elle est jouée' : ', et ce qu\'il fallait jouer quand ce n\'était pas le bon coup'}.</p>`;
  } else {
    exp = `<p class="rv-play">${last.seat === 2 && !P.name ? 'Vous jouez' : who(last.seat) + ' joue'} ${cardTxtHTML(last.card)}.</p>`;
    if (best && last.reason) exp += `<div class="why"><b>Pourquoi ?</b> ${isUser(last.seat) ? '' : `<i>(le conseil pour ${who(last.seat)})</i> `}${rich(last.reason)}</div>`;
    if (!best && last.fix) {
      exp += `<div class="bad"><b>${last.fix.exact ? 'Il fallait jouer' : 'Le cours conseillait plutôt'} ${cardTxtHTML(last.fix.card)}</b> (en couleur dans la main).
        ${last.fix.reason ? '<br>' + rich(last.fix.reason) : ''}${last.fix.exact ? `<br><i>En voyant toutes les cartes : ${plural(last.fix.lost, 'pli')} de perdu avec ce coup.</i>` : ''}</div>`;
    } else if (!best && isUser(last.seat) && last.advice != null) exp += '<div class="good">✓ Bon coup : c\'est aussi ce que conseille le cours.</div>';
    if (winner >= 0) exp += `<p class="rv-won">Pli gagné par <b>${who(winner)}</b> (${B.sideOf(winner) === 0 ? 'Nord-Sud' : 'Est-Ouest'}).</p>`;
  }
  if (p === n && n) {
    const ct = g.contract, ns = best ? a.best.won[0] : a.won[0];
    const declT = B.sideOf(ct.declarer) === 0 ? ns : 13 - ns, ok = declT >= ct.level + 6;
    const m = missionOf(g), claimed = !best && n < startOf(g).hands.flat().length ? ' (la fin a été réclamée)' : '';
    exp += m ? `<p class="rv-end">Fin : Nord-Sud a fait <b>${plural(ns - m.deja[0], 'pli')}</b> dans cette fin de donne${claimed}, il en fallait ${B.mission.goalOf(m)} : mission <b>${ns - m.deja[0] >= B.mission.goalOf(m) ? 'réussie' : 'ratée'}</b>.</p>`
      : `<p class="rv-end">Fin : Nord-Sud a fait <b>${plural(ns, 'pli')}</b>${claimed}. Le contrat de ${nameOf(ct.declarer)} est <b>${ok ? 'réussi' : 'chuté'}</b>.</p>`;
  }
  const nextFix = !best ? seq.findIndex((x, j) => j >= p && x.fix) : -1;
  $app.innerHTML = `<div class="rv">
    <div class="rv-table" id="rvt">${hand(0)}${hand(3)}${hand(1)}${hand(2)}${trick}</div>
    <aside class="rv-side"><div class="scroll">
      <div class="rv-top"><b>${best ? '★ Meilleure façon de jouer' : 'Votre partie'}</b><span class="rv-step">Carte ${p} sur ${n} · pli ${Math.min(13, Math.floor(Math.max(0, p - 1 + preOf(g)) / 4) + 1)}</span></div>
      <div class="rv-exp">${exp}</div></div>
      <div class="rv-ctrl">
        <button class="btn" data-act="rv:prev" ${p === 0 ? 'disabled' : ''}>‹ Précédent</button>
        <button class="btn primary" data-act="rv:next" ${p === n ? 'disabled' : ''}>Suivant ›</button>
        <button class="btn" data-act="rv:trick" ${p === n ? 'disabled' : ''}>Pli suivant »</button>
        ${nextFix >= 0 ? '<button class="btn gold" data-act="rv:fix">Coup à revoir suivant</button>' : `<button class="btn" data-act="rv:start" ${p === 0 ? 'disabled' : ''}>Revenir au début</button>`}
        <button class="btn" data-act="analyse">← Analyse</button>
        <button class="btn" data-act="revue:${best ? 'mine' : 'best'}">${best ? 'Votre partie' : '★ Meilleure façon'}</button>
      </div></aside></div>`;
  // taille des cartes du pli selon la place entre les mains
  const t = document.getElementById('rvt');
  const hn = t.querySelector('.rv-n'), hs = t.querySelector('.rv-s');
  const free = hs.offsetTop - (hn.offsetTop + hn.offsetHeight) - 16;
  // en largeur aussi : le pli tient entre les mains d'Ouest et d'Est (téléphone)
  const hw = t.querySelector('.rv-w'), he = t.querySelector('.rv-e');
  const wide = (t.clientWidth - 2 * Math.max(hw.offsetWidth, he.offsetWidth) - 28) / 3.3;
  t.style.setProperty('--cwT', Math.max(34, Math.min(78, free / (1.42 * 2.1), wide)) + 'px');
}

/* ---------- Jeu en ligne : le serveur distribue et arbitre, l'appli montre ce qu'il envoie ---------- */
// Chaque joueur se voit toujours en bas (Sud), son partenaire en haut : tout est tourné à l'affichage.
const ONLINE_URL = ['127.0.0.1', 'localhost'].includes(location.hostname) ? `ws://${location.hostname}:8770/ws` : 'wss://n8n.b-organic.fr/jeu-bridge/ws';
const TABLE_KEY = 'bridge-marianne-table';
const savedTable = () => { try { return JSON.parse(localStorage.getItem(TABLE_KEY)); } catch (e) { return null; } };
const forgetTable = () => { try { localStorage.removeItem(TABLE_KEY); } catch (e) { /* stockage indisponible */ } };
const codeTxt = c => c.slice(0, 2) + ' ' + c.slice(2);
const onlineForm = { code: '' };
const rotOf = me => (2 - me + 4) % 4;
function onlinePerso(s) {
  const v = ON.v, abs = (s - rotOf(v.me) + 4) % 4;
  return playerCard(v.players[abs], abs);
}
function playerCard(pl, abs) {
  if (pl.kind === 'robot') return B.PERSOS[pl.perso];
  if (pl.kind === 'human') return { human: true, name: esc(pl.name), title: esc(pl.sit), online: pl.online, ready: pl.ready, photo: ON.photos[abs], letter: pl.name.charAt(0).toUpperCase(), av: {} };
  return { human: true, name: 'Place libre', title: '', online: true, letter: '?', av: {} };
}
function avatarOf(q) {
  if (!q.human) return B.avatarSVG(q);
  if (q.photo) return `<img class="av" src="${esc(q.photo)}" alt="">`;
  return `<svg class="av" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="50" fill="#2f5d9e"/><text x="50" y="68" text-anchor="middle" font-size="52" font-weight="800" fill="#fff">${esc(q.letter || '?')}</text></svg>`;
}
const onSend = o => { if (ON && ON.ws && ON.ws.readyState === 1) ON.ws.send(JSON.stringify(o)); };
function banner(on) {
  let b = document.getElementById('on-banner');
  if (!on) { if (b) b.remove(); return; }
  if (b) return;
  b = document.createElement('div');
  b.id = 'on-banner';
  b.textContent = 'Connexion perdue : on se reconnecte…';
  document.body.appendChild(b);
}
const profileMsg = () => ({ name: P.name || '', sit: P.title || '', photo: P.photo && P.photo.length <= 70000 ? P.photo : null });
function onlineEnter(first, saved) {
  if (ON) return;
  cancelTimers();
  ON = { ws: null, code: saved ? saved.code : null, token: saved ? saved.token : null, seat: -1, solo: G.game, v: null, queue: [], busy: false, photos: [null, null, null, null], tries: 0, timer: null, first, hiddenAt: 0, myTurn: false };
  G.game = null;
  onlineConnect();
}
function onlineConnect() {
  if (!ON) return;
  clearTimeout(ON.timer);
  if (ON.ws) { const old = ON.ws; ON.ws = null; try { old.close(); } catch (e) { /* déjà fermée */ } }
  let ws;
  try { ws = new WebSocket(ONLINE_URL); } catch (e) { onlineLost(); return; }
  ON.ws = ws;
  ws.onopen = () => {
    if (!ON || ON.ws !== ws) return;
    ON.tries = 0;
    banner(false);
    ws.send(JSON.stringify(ON.token ? { t: 'resume', code: ON.code, token: ON.token } : ON.first));
  };
  ws.onmessage = e => { if (ON && ON.ws === ws) onlineMsg(JSON.parse(e.data)); };
  ws.onclose = () => { if (ON && ON.ws === ws) { ON.ws = null; onlineLost(); } };
}
function onlineLost() {
  if (!ON) return;
  if (!ON.v) { onlineStop('online'); toast('Impossible de joindre la salle de jeu pour le moment. Vérifiez internet et réessayez.', 4200); return; }
  banner(true);
  ON.tries++;
  ON.timer = setTimeout(onlineConnect, Math.min(10000, 1000 * ON.tries));
}
// la tablette se réveille : la connexion est souvent morte sans le dire, on la refait
function onlineWake() {
  if (document.hidden) { ON.hiddenAt = Date.now(); return; }
  if (!ON.ws || ON.ws.readyState > 1 || (ON.hiddenAt && Date.now() - ON.hiddenAt > 3000)) { if (ON.token) onlineConnect(); }
}
function onlineStop(to) {
  if (!ON) return;
  const o = ON;
  ON = null;
  clearTimeout(o.timer);
  banner(false);
  closeModal();
  if (o.ws) { o.ws.onclose = null; try { o.ws.close(); } catch (e) { /* déjà fermée */ } }
  G.game = o.solo;
  holdTrick = false; thinking = -1; selected = null; hintCard = null; bidLevel = null; panelOpen = false;
  cancelTimers();
  screen = to || 'home';
  render();
}
const ON_ERRORS = { introuvable: 'Aucune table ne porte ce numéro. Vérifiez-le auprès de la personne qui vous a invité.', complete: 'Cette table est déjà complète.', plein: 'La salle de jeu est pleine pour le moment. Réessayez plus tard.', essais: 'Trop de numéros essayés. Réessayez dans quelques minutes.', finie: 'Cette table n\'existe plus : la partie est terminée.' };
function onlineMsg(m) {
  if (m.t === 'joined') {
    ON.code = m.code; ON.token = m.token; ON.seat = m.seat;
    try { localStorage.setItem(TABLE_KEY, JSON.stringify({ code: m.code, token: m.token })); } catch (e) { /* stockage indisponible */ }
  } else if (m.t === 'photos') {
    ON.photos = m.photos;
    if (screen === 'onlobby' || screen === 'ontour') render();
  } else if (m.t === 'err') {
    if (m.code === 'finie') forgetTable();
    onlineStop('online');
    toast(ON_ERRORS[m.code] || 'Une erreur est survenue.', 4600);
  } else if (m.t === 'left') {
    onlineStop();
  } else if (m.t === 'hint') {
    onlineHint(m);
  } else if (m.t === 'state') {
    ON.queue.push(m);
    onlinePump();
  }
}
function onlinePump() {
  if (!ON || ON.busy || !ON.queue.length) return;
  // du retard (tablette en veille) : on passe directement au dernier état, sans animation
  if (ON.queue.length > 2 || document.hidden) { const last = ON.queue.pop(); ON.queue = []; onlineApply(last, true); return; }
  onlineApply(ON.queue.shift(), false);
}
function onlineGame(v, keep) {
  const rot = rotOf(v.me), odd = rot % 2 === 1, R = s => (s + rot) % 4;
  const turned = a => { const o = []; a.forEach((x, s) => { o[R(s)] = x; }); return o; };
  const trickOf = t => ({ leader: R(t.leader), winner: R(t.winner), cards: t.cards.map(x => ({ seat: R(x.seat), card: x.card })) });
  const hands = v.hands ? turned(v.hands.map(h => Array.isArray(h) ? h : Array(h).fill(-1))) : [[], [], [], []];
  let play = null;
  if (v.play) {
    const p = v.play;
    play = Object.assign({}, p, { hands, orig: hands, declarer: R(p.declarer), dummy: R(p.dummy), leader: R(p.leader), turn: R(p.turn), won: odd ? [p.won[1], p.won[0]] : p.won.slice(),
      trick: p.trick.map(x => ({ seat: R(x.seat), card: x.card })), tricks: p.tricks.map(trickOf) });
  }
  const res = v.result ? Object.assign({}, v.result, { ns: odd ? -v.result.ns : v.result.ns }) : null;
  return { online: true, board: v.board, dealer: R(v.dealer), vul: odd ? ({ NS: 'EO', EO: 'NS' }[v.vul] || v.vul) : v.vul, hands, auction: v.auction, phase: v.phase, play,
    contract: v.contract ? Object.assign({}, v.contract, { declarer: R(v.contract.declarer) }) : null, undo: [], selCall: keep, result: res, recorded: true };
}
function onlineThinking(g) {
  if (g.phase === 'bidding') { const s = (g.dealer + g.auction.length) % 4; return s === 2 || B.auctionEnded(g.auction) ? -1 : s; }
  if (g.phase !== 'play' || g.play.done || userControls(g.play.turn)) return -1;
  return g.play.turn === g.play.dummy ? g.play.declarer : g.play.turn;
}
function onlineApply(v, silent) {
  const prev = ON.v, ev = silent ? null : v.ev, side = !['game', 'onlobby', 'ontour', 'online', 'home'].includes(screen);
  ON.v = v;
  if (v.phase === 'lobby') { G.game = null; if (!side) { screen = 'onlobby'; render(); } onlinePump(); return; }
  if (v.phase === 'tour') {
    G.game = null;
    if (!side) { if (screen !== 'ontour') snd('select'); screen = 'ontour'; render(); }
    onlinePump();
    return;
  }
  const fresh = !prev || prev.board !== v.board || !['bidding', 'play', 'end'].includes(prev.phase);
  const oldG = G.game;
  const rot = rotOf(v.me);
  if (fresh) {
    bidLevel = null; selected = null; hintCard = null; lastPlayed = null; fly = null; newBidIdx = -1; holdTrick = false; oneRow = false; panelOpen = false; shownWon = [0, 0]; ON.myTurn = false;
    dealAnim = !!(ev && ev.k === 'deal');
    dummyRevealKey = ev && ev.k === 'deal' ? null : v.board;
    if (dealAnim) snd('shuffle');
    if (!side) { clearToast(); closeModal(); }
  }
  // la carte part de là où elle est encore affichée
  if (ev && ev.k === 'card' && screen === 'game' && oldG) fly = anim() ? flyOrigin((ev.seat + rot) % 4, ev.card) : null;
  const g = onlineGame(v, oldG && !fresh ? oldG.selCall : null);
  G.game = g;
  if (!side) screen = 'game';
  thinking = onlineThinking(g);
  if (ev && ev.k === 'bid') {
    g.selCall = g.auction.length - 1;
    newBidIdx = g.auction.length - 1;
    snd('bid');
    if (ev.seat !== v.me) say(nameOf((ev.seat + rot) % 4) + ' : ' + B.sound.callWords(ev.call));
  }
  if (ev && ev.k === 'card') { snd('card'); lastPlayed = ev.card; selected = null; hintCard = null; }
  if (g.phase === 'play' && prev && prev.phase === 'bidding' && !silent) {
    const ct = g.contract, p = g.play, decl = ct.declarer;
    for (let i = g.auction.length - 1; i >= 0; i--) if (B.isBid(g.auction[i])) { g.selCall = i; break; }
    let msg = `Contrat : <b>${contractHTML(ct)}</b> joué par ${nameOf(decl)}.`;
    if (decl === 2) msg += `<br>Vous jouez aussi les cartes du mort (${nameOf(p.dummy)}).`;
    else if (p.dummy === 2) msg += `<br>Vous êtes le mort : ${nameOf(decl)} jouera vos cartes.`;
    else msg += p.leader === 2 ? '<br>C\'est à vous d\'entamer.' : `<br>${nameOf(p.leader)} entame.`;
    if (!side) toast(msg, 4600);
  }
  const mine = g.phase === 'bidding' ? !B.auctionEnded(g.auction) && (g.dealer + g.auction.length) % 4 === 2 : g.phase === 'play' && !g.play.done && userControls(g.play.turn);
  if (mine && !ON.myTurn && !silent) { if (g.phase === 'bidding') bidboxEnter = true; setTimeout(() => snd('turn'), 120); }
  ON.myTurn = mine;
  if (side) { onlinePump(); return; }
  if (ev && ev.k === 'card' && ev.trickDone) {
    holdTrick = true;
    ON.busy = true;
    render();
    setTimeout(() => {
      if (!ON) return;
      collectTrick((ev.winner + rot) % 4, () => {
        if (!ON) return;
        holdTrick = false; lastPlayed = null; ON.busy = false;
        if (screen === 'game') render();
        onlinePump();
      });
    }, delay('trick'));
    return;
  }
  holdTrick = false;
  render();
  if (g.phase === 'end' && prev && prev.phase !== 'end' && !silent && !g.result.passed) {
    const good = g.result.ns > 0;
    snd(good ? 'success' : 'fail');
    if (good && anim()) confetti();
  }
  onlinePump();
}
function onlineHint(m) {
  const g = G.game, p = g && g.play;
  if (!p || !userControls(p.turn)) return;
  hintCard = m.card;
  if (G.settings.doubleTap) selected = m.card;
  render();
  modal(`<h2>Conseil : jouez ${cardTxtHTML(m.card)}${p.turn === p.dummy ? ' (du mort)' : ''}</h2><p>${rich(esc(m.reason))}</p>${ficheBtn('09')}
    <div class="btns"><button class="btn primary" data-m="play">Jouer cette carte</button><button class="btn" data-m="no">Fermer</button></div>`,
  v => { if (v === 'play') doPlay(p.turn, m.card); });
}
const onlineHomeHTML = () => {
  if (!ONLINE_URL) return '';
  const t = savedTable();
  return `${t ? `<button class="btn primary" data-act="on-back">Retourner à la table n° ${esc(codeTxt(String(t.code)))}</button>` : ''}<button class="btn online-btn" data-act="go:online">${ICONS.net}Jouer en ligne avec des amis</button>`;
};
const onlineTotalsHTML = () => `<div class="on-score">Score de la table : votre camp <b>${ON.v.totals[ON.v.me % 2]}</b> · adversaires <b>${ON.v.totals[(ON.v.me + 1) % 2]}</b></div>`;
function onlineReadyBtn(attrs) {
  const v = ON.v;
  if (!v.players[v.me].ready) return `<button class="btn primary" data-act="on-ready" ${attrs}>Donne suivante</button>`;
  const wait = v.players.filter((p, s) => p.kind === 'human' && p.online && !p.ready && s !== v.me).map(p => esc(p.name));
  return `<button class="btn" disabled ${attrs}>En attente de ${wait.join(', ') || 'la distribution'}…</button>`;
}
function renderOnline() {
  $app.innerHTML = `<div class="page"><div class="inner on-form">
    <button class="btn back" data-act="go:home">← Accueil</button>
    <h1>Jouer en ligne</h1>
    <p>Jouez avec vos amis, chacun sur sa tablette ou son téléphone. Les places libres sont prises par les robots.</p>
    <label for="on-name">Votre prénom</label>
    <input id="on-name" maxlength="24" autocomplete="given-name" value="${esc(P.name || '')}">
    <h2>Inviter des amis</h2>
    <button class="btn primary" data-act="on-create">Créer une table</button>
    <h2>Vous avez reçu un numéro de table ?</h2>
    <label for="on-code">Numéro de la table (5 chiffres)</label>
    <input id="on-code" inputmode="numeric" pattern="[0-9]*" maxlength="6" autocomplete="off" value="${esc(onlineForm.code)}">
    <button class="btn gold" data-act="on-join">Rejoindre la table</button>
  </div></div>`;
}
function onlineName() {
  const n = document.getElementById('on-name').value.trim();
  if (!n) { toast('Indiquez votre prénom : il s\'affichera à la table.'); return null; }
  if (n !== P.name) { P.name = n; saveProfile(); }
  return n;
}
function onlineCreate() { const name = onlineName(); if (name) onlineEnter(Object.assign(profileMsg(), { t: 'create' })); }
function onlineJoin() {
  const name = onlineName();
  if (!name) return;
  const code = document.getElementById('on-code').value.replace(/\D/g, '');
  onlineForm.code = code;
  if (code.length !== 5) { toast('Le numéro de la table a 5 chiffres.'); return; }
  onlineEnter(Object.assign(profileMsg(), { t: 'join', code }));
}
function onlineBack() { const t = savedTable(); if (t) onlineEnter(null, t); }
function onlineMenu() {
  modal(`<h2>Menu</h2><div class="menu-list">
    <button class="btn" data-m="fiches">Les fiches du cours</button>
    <button class="btn" data-m="persos">Les personnages</button>
    <button class="btn" data-m="help">Comment jouer</button>
    <button class="btn" data-m="settings">Réglages</button>
    <button class="btn" data-m="leave">Quitter la table</button>
    <button class="btn primary" data-m="close">Fermer</button></div>`, v => {
    if (v === 'close') return;
    if (v === 'leave') onlineLeave();
    else go(v);
  });
}
function onlineLeave() {
  modal(`<h2>Quitter la table ?</h2><p>Un robot prendra votre place.</p>
    <div class="btns"><button class="btn primary" data-m="yes">Quitter</button><button class="btn" data-m="no">Rester</button></div>`, r => {
    if (r !== 'yes') return;
    onSend({ t: 'leave' });
    forgetTable();
    onlineStop();
  });
}
async function onlineInvite() {
  const url = location.origin + location.pathname + '?table=' + ON.code, text = `Venez jouer au bridge avec moi ! Table n° ${ON.code}`;
  if (navigator.share) { try { await navigator.share({ title: 'Le Bridge de Marianne', text, url }); } catch (e) { /* partage annulé */ } return; }
  try { await navigator.clipboard.writeText(`${text} : ${url}`); toast('Invitation copiée : collez-la dans un message.'); } catch (e) { toast(`Donnez ce numéro à vos amis : <b>${ON.code}</b>`, 4200); }
}
function renderLobby() {
  const v = ON.v, code = codeTxt(v.code);
  const seat = (s, pos) => {
    const pl = v.players[s], q = playerCard(pl, s), mine = s === v.me;
    if (pl.kind === 'empty') return tourSeat(pos, 0, '<div class="on-empty"></div>', 'Place libre', SEATN[s], `Un robot jouera ici si personne ne vient.<button class="btn on-sit" data-act="on-sit:${s}">M'asseoir ici</button>`, false);
    const role = SEATN[s] + (q.title ? ' · ' + q.title : '') + (s === (v.me + 2) % 4 ? ' · votre partenaire' : '');
    return tourSeat(`${pos} ${mine ? 'mine' : ''}`, 0, avatarOf(q), q.name, role, mine ? 'C\'est vous.' : q.online ? 'Est à table.' : 'Est momentanément hors ligne.', false);
  };
  const host = v.players[v.hostSeat];
  $app.innerHTML = `<div class="tour"><div class="tour-in">
    <h1>Table n° <span class="on-code">${code}</span></h1>
    <div class="on-sub">Donnez ce numéro à vos amis pour qu'ils vous rejoignent.</div>
    <button class="btn gold on-invite" data-act="on-invite">Inviter par message</button>
    <div class="tour-grid">${seat(0, 'n')}${seat(3, 'w')}${seat(1, 'e')}${seat(2, 's')}</div>
    ${v.host ? '<button class="btn primary tour-go" data-act="on-start">Commencer la partie</button>' : `<div class="on-sub">La partie commencera quand ${host && host.kind === 'human' ? esc(host.name) : 'l\'organisateur'} la lancera.</div>`}
    <button class="btn on-leave" data-act="on-leave">Quitter la table</button>
  </div></div>`;
}
function renderOnTour() {
  const v = ON.v, rot = rotOf(v.me);
  const seat = (s, pos, i, role) => {
    const abs = (s - rot + 4) % 4, q = playerCard(v.players[abs], abs);
    if (!q.human) return tourSeat(pos, i, B.avatarSVG(q), q.name, `${role} · ${q.title}`, `« ${q.hello} »`, !!q.av.chef);
    return tourSeat(pos, i, avatarOf(q), q.name, role + (q.title ? ' · ' + q.title : ''), s === 2 ? 'C\'est vous !' : q.online ? 'Bonjour à tous !' : 'Est momentanément hors ligne.', false, q.ready ? '<span class="on-ok">✓ Prêt</span>' : '');
  };
  const ready = v.players[v.me].ready;
  const wait = v.players.filter((p, s) => p.kind === 'human' && p.online && !p.ready && s !== v.me).map(p => esc(p.name));
  $app.innerHTML = `<div class="tour"><div class="tour-in">
    <h1>Tour de table</h1>
    <div class="tour-grid">${seat(0, 'n', 0, 'votre partenaire')}${seat(3, 'w', 0, 'adversaire')}${seat(1, 'e', 0, 'adversaire')}${seat(2, 's', 0, 'Vous')}</div>
    ${ready ? `<button class="btn tour-go" disabled>En attente de ${wait.join(', ') || 'la distribution'}…</button>` : '<button class="btn primary tour-go" data-act="on-ready">À table !</button>'}
  </div></div>`;
}
const urlTable = new URLSearchParams(location.search).get('table');
if (ONLINE_URL && /^\d{5}$/.test(urlTable || '')) { onlineForm.code = urlTable; screen = 'online'; }

/* ---------- Gestion des touchers ---------- */
$app.addEventListener('click', e => {
  const pe = e.target.closest('[data-perso]');
  if (pe && screen === 'game') { if (!(G.game.online && perso(+pe.dataset.perso).human)) showPerso(+pe.dataset.perso); return; }
  if (e.target.closest('[data-me]') && screen === 'game') { openProfile(); return; }
  const cardEl = e.target.closest('.card[data-c]');
  if (cardEl && screen === 'game') {
    const zone = cardEl.closest('[data-seat]');
    if (zone) { tapCard(+zone.dataset.seat, +cardEl.dataset.c); return; }
  }
  const a = e.target.closest('[data-act]');
  if (!a) {
    // toucher le tapis désélectionne la carte soulevée
    if (selected != null && screen === 'game' && !e.target.closest('.panel')) { selected = null; render(); }
    return;
  }
  const act = a.dataset.act;
  const [k, v, w, x] = act.split(':');
  if (k === 'new') newDeal(false, null, v === 'expert' ? true : v === 'normal' ? false : !!(G.game && G.game.expert));
  else if (k === 'replay') confirmReplay();
  else if (k === 'resume') go('game');
  else if (k === 'on-create') onlineCreate();
  else if (k === 'on-join') onlineJoin();
  else if (k === 'on-back') onlineBack();
  else if (k === 'on-sit') onSend({ t: 'sit', seat: +v });
  else if (k === 'on-start') onSend({ t: 'start' });
  else if (k === 'on-ready') onSend({ t: 'ready' });
  else if (k === 'on-leave') onlineLeave();
  else if (k === 'on-invite') onlineInvite();
  else if (k === 'tour-go') { if ('speechSynthesis' in window) speechSynthesis.cancel(); beginDeal(false); }
  else if (k === 'go') go(v);
  else if (k === 'menu') menu();
  else if (k === 'profil') openProfile();
  else if (k === 'analyse') { cancelTimers(); screen = 'analyse'; ensureAnalysis(0); render(); window.scrollTo(0, 0); }
  else if (k === 'revue') { review = { mode: v, step: w != null ? +w : 0 }; screen = 'revue'; render(); }
  else if (k === 'rv') reviewMove(v);
  else if (k === 'hint') hint();
  else if (k === 'undo') undo();
  else if (k === 'last') lastTrick();
  else if (k === 'claim') claim();
  else if (k === 'lvl') { bidLevel = +v; render(); }
  else if (k === 'bid') { if (bidLevel) submitCall(bidLevel + v); }
  else if (k === 'call') submitCall(v);
  else if (k === 'sel') { G.game.selCall = +v; save(); render(); }
  else if (k === 'details') { panelOpen = !panelOpen; render(); }
  else if (k === 'mission') startMission(v);
  else if (k === 'lm') { learnView.theme = v; screen = 'lm'; render(); }
  else if (k === 'lecon') { learnView.theme = v; learnView.lecon = w; screen = 'lecon'; render(); }
  else if (k === 'lecon-ok') { LP().lu[learnView.theme + ':' + learnView.lecon] = true; save(); screen = 'lm'; render(); }
  else if (k === 'chap') { learnView.chap = v; screen = 'chapitre'; render(); }
  else if (k === 'ld') startLearn(v, w, +x);
  else if (k === 'comm-f') { learnView.filtre = v; render(); }
  else if (k === 'comment') { cancelTimers(); clearToast(); screen = 'comment'; render(); }
  else if (k === 'learn-next') learnNext();
  else if (k === 'mini') miniAct(v, w);
  else if (k === 'set') {
    const val = w === 'true' ? true : w === 'false' ? false : w;
    G.settings[v] = val;
    save();
    if (B.sound) { B.sound.configure(G.settings); B.sound.unlock(); }
    if (v === 'volume' || (v === 'sound' && val)) snd('card');
    if (v === 'voice' && val) say('Nord : un cœur.');
    render();
  } else if (k === 'sound-test') {
    if (B.sound) B.sound.unlock();
    if (!G.settings.sound && !G.settings.voice) toast('Les sons sont désactivés : choisissez « Oui » à la ligne Sons.');
    else { snd('success'); say('Le son fonctionne.'); toast('Vous devez entendre une petite musique. Sinon, montez le volume de l\'iPad.', 3600); }
  } else if (k === 'reset-stats') {
    modal(`<h2>Effacer tous vos résultats ?</h2><p>L'historique des donnes jouées sera supprimé de cette tablette.</p>
      <div class="btns"><button class="btn primary" data-m="yes">Effacer</button><button class="btn" data-m="no">Garder</button></div>`, r => { if (r === 'yes') { G.stats.history = []; G.stats.wl = {}; G.stats.me = { v: 0, d: 0 }; save(); toast('Résultats effacés.'); } });
  }
});
// une fiche du cours, en grand, par-dessus le jeu (images en cache : marche sans internet)
function openFiche(id, think) {
  const n = FICHE_PAGES[id];
  if (!n) return;
  let zoom = 1;
  // pendant une partie : pas de PDF (il s'ouvrirait dans un autre onglet) et un grand bouton pour revenir au jeu
  const inGame = screen === 'game';
  const v = document.createElement('div');
  v.className = 'fiche-view';
  v.innerHTML = `<div class="bar"><div class="ttl">Fiche du cours n° ${id}<small>${rich(B.FICHES[id])}</small></div>
    ${inGame ? '' : pdfLink(fichePdf(id), 'PDF')}<button class="btn" data-z="-1">A−</button><button class="btn" data-z="1">A+</button><button class="btn primary" data-close>Fermer</button></div>
    ${think ? `<div class="fiche-think"><div class="ft-txt"><b>Réfléchissez avec la fiche.</b> Votre main : ${[0, 1, 2, 3].map(s => `<span class="ft-s">${su(s)} ${B.ranksIn(think.hand, s).map(x => B.RANK_TXT[x]).join(' ') || '—'}</span>`).join('')}<span class="ft-p"><b>${B.hcp(think.hand)} points H</b>, ${B.HL(think.hand)} points HL</span></div>
      <button class="btn gold" data-answer>Voir la réponse</button></div>` : ''}
    <div class="pages">${Array.from({ length: n }, (_, i) => `<img src="fiches/f${id}-${i + 1}.jpg?v=${id === '14' ? 5 : 4}" alt="Fiche ${id}, page ${i + 1}">`).join('')}</div>
    <button class="btn primary fv-close" data-close>✕ Fermer la fiche${inGame ? ' et revenir au jeu' : ''}</button>`;
  document.body.appendChild(v);
  snd('select');
  const pages = v.querySelector('.pages');
  const close = () => { v.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  v.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) { close(); return; }
    if (e.target.closest('[data-answer]')) { close(); think.answer(); return; }
    const z = e.target.closest('[data-z]');
    if (z) { zoom = Math.max(0.6, Math.min(2.2, zoom + 0.4 * +z.dataset.z)); pages.style.setProperty('--z', zoom); }
  });
}
document.addEventListener('click', e => { const f = e.target.closest('[data-fiche]'); if (f) openFiche(f.dataset.fiche); });
function showPerso(s) {
  const q = perso(s), w = wlOf(q.name, s === 0);
  const pl = (n, word) => `<b>${n}</b> ${word}${n > 1 ? 's' : ''}`;
  modal(`<div class="perso-card">${B.avatarSVG(q)}<div><h2>${q.name}</h2><div class="ttl">${q.title} · ${s === 0 ? 'votre partenaire' : 'joue en ' + SEATN[s]}</div></div></div>
    <p>${q.bio}</p>${q.av.chef ? CHEF_COURS : ''}
    <p class="perso-wl">${s === 0 ? 'Avec' : 'Contre'} ${q.name} : <span class="w">${pl(w.v, 'victoire')}</span> · <span class="l">${pl(w.d, 'défaite')}</span></p>
    <div class="btns"><button class="btn primary" data-m="ok">Fermer</button></div>`);
}
// le son ne peut démarrer qu'après un toucher (règle de l'iPad)
['touchend', 'click'].forEach(ev => document.addEventListener(ev, () => { if (B.sound) B.sound.unlock(); }, { capture: true, passive: true }));
if (B.sound) B.sound.configure(G.settings);
document.addEventListener('visibilitychange', () => { if (ON) { onlineWake(); return; } if (!document.hidden && screen === 'game') { cancelTimers(); dealing = false; holdTrick = false; thinking = -1; render(); step(); } });

render();
})();
