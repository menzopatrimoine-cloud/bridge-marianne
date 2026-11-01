/* Le Bridge de Marianne — interface tablette */
window.addEventListener("error", e => { window.__err = (window.__err || "") + e.message + " @" + e.lineno + (e.error && e.error.stack ? " [" + e.error.stack.split("\n").slice(1, 6).join(" < ") + "]" : "") + "; "; });
(function () {
'use strict';
const STORE = 'bridge-marianne-v1';
const $app = document.getElementById('app');
const $modal = document.getElementById('modal-root');
const DEFAULTS = { cardSize: 'grand', fourColors: false, speed: 'normal', doubleTap: true, showPoints: true, checkBids: true, deals: 'hasard', sound: true, volume: 'moyen', voice: false, animations: true };
const ORDER = [2, 3, 0, 1];                 // colonnes du tableau d'enchères : S O N E
const SPEED = { lent: 1.6, normal: 1, rapide: 0.55 };

let G = load();
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

function load() {
  try {
    const x = JSON.parse(localStorage.getItem(STORE));
    if (x && x.settings) { x.settings = Object.assign({}, DEFAULTS, x.settings); x.stats = x.stats || { history: [] }; return x; }
  } catch (e) { /* stockage indisponible */ }
  return { settings: Object.assign({}, DEFAULTS), stats: { history: [] }, game: null, nextBoard: 1 };
}
function save() { try { localStorage.setItem(STORE, JSON.stringify(G)); } catch (e) { /* stockage indisponible */ } }

/* ---------- Petits utilitaires d'affichage ---------- */
const su = s => `<svg class="su su${s}" aria-hidden="true"><use href="#su${s}"/></svg>`;
// remplace les symboles ♠♥♦♣ des textes par les dessins (évite les émojis sur iPad)
const rich = t => String(t == null ? '' : t).replace(/[♠♥♦♣]/g, ch => su('♠♥♦♣'.indexOf(ch)));
const SEATN = ['Nord', 'Est', 'Sud', 'Ouest'];
// les adversaires Est et Ouest ont un nom et un visage, tirés au sort à chaque donne
const opp = s => B.PERSOS[((G.game && G.game.opp ? G.game.opp[s === 1 ? 0 : 1] : s) + B.PERSOS.length) % B.PERSOS.length];
const nameOf = s => s === 2 ? 'vous' : s === 0 ? 'Nord' : opp(s).name;
const seatName = s => s === 2 ? 'Vous' : nameOf(s);
const FICHE_PAGES = { '01': 3, '02': 1, '03': 1, '04': 2, '05': 1, '06': 2, '07': 3, '08': 2, '09': 2, '10': 2, '11': 2, '12': 2, '13': 2 };
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
  const pan = screen === 'game' && document.querySelector('.panel');
  if (pan) {
    const r = pan.getBoundingClientRect();
    Object.assign(d.style, { left: r.left + r.width / 2 + 'px', top: r.top + 12 + 'px', maxWidth: r.width - 24 + 'px' });
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
    if (e.target === ov) closeModal();
  });
}
function closeModal() { $modal.innerHTML = ''; }
const delay = kind => ({ bid: 900, card: 700, trick: 1100, lead: 1100 })[kind] * SPEED[G.settings.speed];

/* ---------- Donnes ---------- */
function newDeal(sameHands) {
  cancelTimers();
  closeModal();
  let hands, board;
  if (sameHands && G.game) { hands = G.game.hands; board = G.game.board; }
  else {
    board = G.nextBoard || 1;
    G.nextBoard = board + 1;
    for (let i = 0; i < 300; i++) {
      hands = B.randomHands();
      if (G.settings.deals !== 'jeu') break;
      if (B.hcp(hands[0]) + B.hcp(hands[2]) >= 22) break;
    }
  }
  const info = B.boardInfo(board);
  let oppIdx = sameHands && G.game && G.game.opp;
  if (!oppIdx) {
    const a = Math.floor(Math.random() * B.PERSOS.length);
    oppIdx = [a, (a + 1 + Math.floor(Math.random() * (B.PERSOS.length - 1))) % B.PERSOS.length];
  }
  G.game = { board, dealer: info.dealer, vul: info.vul, hands, auction: [], phase: 'bidding', play: null, contract: null, undo: [], selCall: null, result: null, recorded: false, opp: oppIdx };
  thinking = -1; holdTrick = false; bidLevel = null; selected = null; hintCard = null; lastPlayed = null;
  fly = null; dealAnim = true; dummyRevealKey = null; newBidIdx = -1; robotActed = true; shownWon = [0, 0];
  screen = 'game';
  save();
  snd('shuffle');
  dealing = anim();
  render();
  if (!sameHands) toast(`Vos adversaires : <b>${opp(3).name}</b>, ${opp(3).title} (Ouest), et <b>${opp(1).name}</b>, ${opp(1).title} (Est).`, 4200);
  const tok = runToken;
  setTimeout(() => { if (tok !== runToken) return; dealing = false; step(); }, dealing ? 900 : 0);
}
function userControls(seat) {
  const g = G.game;
  if (seat === 2) return true;
  return g.phase === 'play' && seat === 0 && B.sideOf(g.play.declarer) === 0;
}
function pushUndo() {
  const g = G.game;
  g.undo.push(JSON.parse(JSON.stringify({ auction: g.auction, phase: g.phase, play: g.play, contract: g.contract, selCall: g.selCall })));
  if (g.undo.length > 60) g.undo.shift();
}

/* ---------- Déroulement : les robots jouent jusqu'au tour de l'utilisatrice ---------- */
function step() {
  const g = G.game;
  if (!g || screen !== 'game' || dealing) return;
  if (robotPending) { render(); return; }
  const tok = runToken;
  if (g.phase === 'bidding') {
    if (B.auctionEnded(g.auction)) { finishAuction(); return; }
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
      const r = B.chooseCard(p, seat);
      doPlay(seat, r.card);
    }, p.tricks.length === 0 && !p.trick.length ? delay('lead') : delay('card'));
  }
}
function doPlay(seat, card) {
  const g = G.game, p = g.play, tok = runToken;
  fly = anim() ? flyOrigin(seat, card) : null;
  const res = B.playCard(p, seat, card);
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
  if (ns && decl === 0) msg += '<br>Vous jouez les deux mains (Nord et Sud).';
  else if (ns) msg += '<br>Vous jouez aussi les cartes du mort (Nord).';
  else msg += (g.play.leader === 2 ? '<br>C\'est à vous d\'entamer.' : '<br>' + nameOf(g.play.leader) + ' entame.');
  toast(msg, 4200);
  say('Contrat : ' + B.sound.callWords(ct.level + ct.den) + (ct.dbl === 2 ? ' surcontré' : ct.dbl === 1 ? ' contré' : '') + ', joué par ' + nameOf(decl) + '.');
  save();
  step();
}
function finishPlay() {
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
  const h = G.stats.history;
  const ct = g.contract;
  h.push({
    board: g.board, date: new Date().toISOString().slice(0, 10),
    contract: ct ? { level: ct.level, den: ct.den, dbl: ct.dbl, declarer: ct.declarer } : null,
    tricks: g.result.tricks || 0, made: !!g.result.made, ns: g.result.ns,
    role: !ct ? 'passée' : ct.declarer === 2 ? 'déclarant' : ct.declarer === 0 ? 'déclarant (Nord)' : 'défense',
  });
  if (h.length > 300) h.shift();
}

/* ---------- Actions de l'utilisatrice ---------- */
function submitCall(call, force) {
  const g = G.game;
  if (g.phase !== 'bidding' || (g.dealer + g.auction.length) % 4 !== 2) return;
  if (!B.isLegal(call, g.auction, g.dealer)) return;
  if (!force && G.settings.checkBids) {
    const h = B.decide(g.hands[2], g.auction, g.dealer);
    if (h.sure && h.call !== call) { deviation(h, call); return; }
  }
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
function tapCard(seat, c, fromLoupe) {
  const g = G.game;
  if (!g || g.phase !== 'play' || holdTrick) return;
  const p = g.play;
  if (!userControls(seat)) return;
  if (p.turn !== seat) {
    if (userControls(p.turn)) toast(p.turn === 0 ? 'C\'est au tour du mort (Nord) : jouez une carte en haut.' : 'C\'est à votre main (Sud) de jouer : jouez une carte en bas.');
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
  if (seat === 0 && !fromLoupe) {
    const same = p.hands[0].filter(x => B.suitOf(x) === B.suitOf(c));
    if (same.length > 1) { loupe(c, same); return; }
  }
  if (G.settings.doubleTap && selected !== c && !fromLoupe) { selected = c; snd('select'); render(); return; }
  pushUndo();
  doPlay(seat, c);
}
// les cartes d'une couleur du mort, en grand et côte à côte : un toucher sur la bonne carte la joue
function loupe(c, cards) {
  const g = G.game, s = B.suitOf(c);
  const list = cards.slice().sort((x, y) => B.rankOf(y) - B.rankOf(x));
  const n = list.length;
  const room = Math.min(900, window.innerWidth - 40) - 48;
  const cw = Math.max(56, Math.min(130, (room - (n - 1) * 12) / n));
  snd('select');
  modal(`<h2>Les ${su(s)} ${g.play.dummy === 0 ? 'du mort' : 'de Nord'}</h2><p>Touchez la carte que vous voulez jouer.</p>
    <div class="loupe-cards" style="--cw:${cw}px;--ch:${cw * 1.42}px">${list.map((x, i) => `<button class="pick" data-m="${x}" style="animation-delay:${i * 45}ms">${cardHTML(x, x === hintCard ? 'hint' : '')}</button>`).join('')}</div>
    <div class="btns"><button class="btn" data-m="no">Fermer</button></div>`,
  v => { if (v !== 'no') tapCard(0, +v, true); }, 'loupe');
}
function undo() {
  const g = G.game;
  if (!g || !g.undo.length) { toast('Il n\'y a rien à annuler.'); return; }
  cancelTimers();
  // une donne annulée après sa fin ne compte plus dans les résultats
  if (g.recorded) { const h = G.stats.history; if (h.length && h[h.length - 1].board === g.board) h.pop(); }
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
  if (g.phase === 'bidding') {
    if ((g.dealer + g.auction.length) % 4 !== 2) { toast('Attendez votre tour pour demander un conseil.'); return; }
    const h = B.decide(g.hands[2], g.auction, g.dealer);
    const hand = g.hands[2];
    const l = B.lens(hand);
    modal(`<h2>Conseil : ${callHTML(h.call, true)}</h2>
      <p><b>${rich(h.m.name)}.</b> ${rich(h.m.text)}</p>
      <p style="color:var(--muted)">Votre main : <b>${B.hcp(hand)} points H</b>, ${B.HL(hand)} points HL ; ${[0, 1, 2, 3].map(s => l[s] + ' ' + su(s)).join(', ')}.</p>
      ${h.sure ? (h.m.fiche ? ficheBtn(h.m.fiche) : '') : '<p style="color:var(--muted)">Cette situation n\'est pas dans les fiches : c\'est la suggestion du robot.</p>'}
      <div class="btns"><button class="btn primary" data-m="bid">Annoncer ${callHTML(h.call, true)}</button><button class="btn" data-m="no">Fermer</button></div>`,
    v => { if (v === 'bid') submitCall(h.call, true); });
    return;
  }
  if (g.phase === 'play') {
    const p = g.play;
    if (holdTrick || !userControls(p.turn)) { toast('Attendez votre tour pour demander un conseil.'); return; }
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
  const left = 13 - p.tricks.length;
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
  const inGame = screen === 'game' && G.game;
  modal(`<h2>Menu</h2><div class="menu-list">
    <button class="btn primary" data-m="new">Nouvelle donne</button>
    ${inGame ? '<button class="btn" data-m="replay">Recommencer cette donne</button>' : ''}
    <button class="btn" data-m="stats">Mes résultats</button>
    <button class="btn" data-m="help">Comment jouer</button>
    <button class="btn" data-m="settings">Réglages</button>
    <button class="btn" data-m="home">Accueil</button>
    <button class="btn" data-m="close">Fermer</button></div>`, v => {
    if (v === 'new') newDeal(false);
    else if (v === 'replay') confirmReplay();
    else if (v === 'close') return;
    else go(v);
  });
}
function confirmReplay() {
  modal(`<h2>Recommencer cette donne ?</h2><p>Les mêmes cartes seront redistribuées et les enchères reprendront du début.</p>
    <div class="btns"><button class="btn primary" data-m="yes">Recommencer</button><button class="btn" data-m="no">Annuler</button></div>`, v => { if (v === 'yes') newDeal(true); });
}
function go(s) {
  cancelTimers();
  thinking = -1; holdTrick = false;
  screen = s;
  render();
  if (s === 'game') step();
}

/* ---------- Rendu ---------- */
function render() {
  document.body.classList.toggle('four-colors', !!G.settings.fourColors);
  if (screen === 'home') return renderHome();
  if (screen === 'settings') return renderSettings();
  if (screen === 'stats') return renderStats();
  if (screen === 'help') return renderHelp();
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
      ${resume ? `<button class="btn primary" data-act="resume">Reprendre la donne n° ${g.board}</button>` : ''}
      <button class="btn ${resume ? '' : 'primary'}" data-act="new">Nouvelle donne</button>
      <button class="btn" data-act="go:stats">Mes résultats</button>
      <button class="btn" data-act="go:help">Comment jouer</button>
      <button class="btn" data-act="go:settings">Réglages</button>
    </div></div></div>`;
}

function renderGame() {
  const g = G.game;
  const p = g.play;
  const phase = g.phase;
  const decl = g.contract ? g.contract.declarer : -1;
  const dummy = g.contract ? B.partnerOf(decl) : -1;
  const dummyShown = p && B.dummyShown(p);
  const turn = phase === 'bidding' ? (g.dealer + g.auction.length) % 4 : phase === 'play' ? p.turn : -1;
  const hands = phase === 'bidding' || !p ? g.hands : p.hands;
  const role = s => !g.contract || phase === 'bidding' ? '' : s === decl ? 'déclarant' : s === dummy ? 'mort' : 'défense';
  const tag = s => {
    const cls = `tag ${turn === s && phase !== 'end' ? 'turn' : ''}`;
    if (s === 1 || s === 3) return `<div class="${cls} perso" data-perso="${s}">${B.avatarSVG(opp(s))}<span class="nm"><b><span class="dot"></span>${opp(s).name}</b><small>${SEATN[s]}${role(s) ? ' · ' + role(s) : ''}</small></span></div>`;
    return `<div class="${cls}"><span class="dot"></span>${seatName(s)}${role(s) ? ` <span class="role">· ${role(s)}</span>` : ''}</div>`;
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
  const northVisible = phase === 'end' || (phase === 'play' && (B.sideOf(decl) === 0 || (dummy === 0 && dummyShown)));
  if (northVisible) north = dummyHTML(phase === 'end' ? [] : hands[0], 0, 'cols', cardCls);
  else north = backsHTML(hands[0].length);
  // Est / Ouest
  const sideZone = s => {
    if (phase === 'play' && s === dummy && dummyShown) return dummyHTML(hands[s], s, 'rows', cardCls);
    if (phase === 'end') return '';
    return backsHTML(hands[s].length);
  };
  const south = phase === 'end' ? '' : `<div class="hand" data-seat="2">${B.sortHand(hands[2]).map(c => cardHTML(c, cardCls(2, c))).join('')}</div>`;
  // centre
  let center = '', status = '';
  if (phase === 'bidding') {
    if (turn === 2 && !dealing) center = bidboxHTML();
    else if (thinking >= 0) center = `<div class="thinking">${nameOf(thinking)} réfléchit…</div>`;
  } else if (phase === 'play') {
    const shown = holdTrick ? p.tricks[p.tricks.length - 1].cards : p.trick;
    const w = holdTrick ? p.tricks[p.tricks.length - 1].winner : -1;
    let msg = '', wait = false;
    if (userTurnSeat >= 0) {
      const isDummy = userTurnSeat === dummy;
      msg = userTurnSeat === 0 ? (isDummy ? 'À vous :<br><b>carte du mort</b> ↑' : 'À vous :<br><b>carte de Nord</b> ↑')
        : (isDummy ? 'À vous :<br><b>carte du mort</b> ↓' : 'À vous<br><b>de jouer</b> ↓');
    } else if (holdTrick) msg = `Pli pour<br><b>${B.sideOf(w) === 0 ? 'Nord-Sud' : 'Est-Ouest'}</b>`;
    else if (thinking >= 0 && !shown.length) { msg = `${nameOf(thinking)}<br>réfléchit…`; wait = true; }
    center = `<div class="trick">${shown.map(x => `<div class="slot s${x.seat} ${x.seat === w ? 'win' : ''}">${cardHTML(x.card, x.card === lastPlayed && !anim() ? '' : 'nodrop')}</div>`).join('')}</div>`;
    if (msg) status = `<div class="status ${wait ? 'wait' : ''} ${userTurnSeat >= 0 ? 'me' : ''}">${msg}</div>`;
  }
  const endHTML = phase === 'end' ? endScreenHTML() : '';
  $app.innerHTML = `<div class="game">
    <div class="table" id="table">
      <div class="zone zone-n">${tag(0)}${bubble(0)}${north}</div>
      <div class="zone zone-w">${tag(3)}${bubble(3)}${sideZone(3)}</div>
      <div class="zone zone-e">${tag(1)}${bubble(1)}${sideZone(1)}</div>
      <div class="zone zone-s">${tag(2)}${bubble(2)}${south}</div>
      <div class="center">${center}</div>
      ${status}
      ${endHTML}
    </div>
    <aside class="panel">${panelHTML()}</aside>
  </div>`;
  layout();
  fx();
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
    ${G.settings.showPoints ? `<div class="pts">Votre main : <b>${B.hcp(hand)} points H</b> · ${B.HL(hand)} points HL</div>` : ''}
  </div>`;
}

function panelHTML() {
  const g = G.game;
  const p = g.play;
  const vulNS = B.isVul(g.vul, 0), vulEW = B.isVul(g.vul, 1);
  let html = `<div class="scroll">
    <div class="topline"><span class="boardno">Donne n° ${g.board}</span><button class="menu-btn" data-act="menu"><span class="bars"></span>Menu</button></div>
    <div class="info">Donneur : <b>${seatName(g.dealer)}</b><br>
      Nord-Sud <span class="vul ${vulNS ? 'v' : 'nv'}">${vulNS ? 'vulnérables' : 'non vulnérables'}</span><br>
      Est-Ouest <span class="vul ${vulEW ? 'v' : 'nv'}">${vulEW ? 'vulnérables' : 'non vulnérables'}</span></div>`;
  if (g.contract && g.phase !== 'bidding') {
    const ct = g.contract;
    const side = B.sideOf(ct.declarer);
    html += `<div class="contract"><div class="big">${contractHTML(ct)} <span style="font-size:20px;color:var(--muted)">par ${nameOf(ct.declarer)}</span></div>
      <div class="tricks"><span>Nord-Sud<b class="${bumpCls(0)}">${p.won[0]}</b></span><span>Est-Ouest<b class="${bumpCls(1)}">${p.won[1]}</b></span></div>
      <div class="goal">Il faut <b>${ct.level + 6} plis</b> au camp ${side === 0 ? 'Nord-Sud' : 'Est-Ouest'} (les défenseurs en veulent ${8 - ct.level}).</div></div>`;
  }
  html += auctionHTML() + explainHTML();
  html += `</div><div class="actions">${actionsHTML()}</div>`;
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
  if (g.phase === 'bidding') cells.push('<span class="q">?</span>');
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
  hint: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.6 10.8c.6.5 1 1.2 1 2V17h5.2v-1.2c0-.8.4-1.5 1-2A6 6 0 0 0 12 3z"/></svg>',
  undo: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 0 1 0 10h-3"/></svg>',
  last: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="9" height="13" rx="2"/><path d="M12 8l5-2 4 12-5 2"/></svg>',
  claim: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l5 5L20 6"/></svg>',
  book: '<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h7M9 16h7"/></svg>',
};
function actionsHTML() {
  const g = G.game;
  const p = g.play;
  const canUndo = g.undo.length > 0;
  if (g.phase === 'bidding') return `<button class="btn gold" data-act="hint">${ICONS.hint}Conseil</button><button class="btn" data-act="undo" ${canUndo ? '' : 'disabled'}>${ICONS.undo}Annuler</button>`;
  if (g.phase === 'play') {
    const canClaim = B.sideOf(p.declarer) === 0;
    return `<button class="btn gold" data-act="hint">${ICONS.hint}Conseil</button><button class="btn" data-act="undo" ${canUndo ? '' : 'disabled'}>${ICONS.undo}Annuler</button>
      <button class="btn" data-act="last" ${p.tricks.length ? '' : 'disabled'}>${ICONS.last}Dernier pli</button>
      <button class="btn" data-act="claim" ${canClaim ? '' : 'disabled'}>${ICONS.claim}Réclamer</button>`;
  }
  return `<button class="btn primary" data-act="new" style="grid-column:1/-1">Donne suivante</button>`;
}

function endScreenHTML() {
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
  if (!r.passed) {
    const theyWon = (B.sideOf(ct.declarer) === 1) === r.made;
    const q = opp(g.board % 2 ? 1 : 3);
    quip = `<div class="quip">${B.avatarSVG(q)}<div><b>${q.name}</b> : « ${theyWon ? q.gagne : q.perd} »</div></div>`;
  }
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
    <div class="compass">${hbox(0, 'hn')}${hbox(3, 'hw')}<div class="mid">Donne n° ${g.board}<br>Donneur : ${seatName(g.dealer)}</div>${hbox(1, 'he')}${hbox(2, 'hs')}</div>
    ${tricks}
    <div class="btns"><button class="btn primary" data-act="new">Donne suivante</button>
      <button class="btn" data-act="replay">Rejouer cette donne</button>
      <button class="btn" data-act="undo" ${g.undo.length ? '' : 'disabled'}>${ICONS.undo}Annuler la dernière carte</button></div>
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
function layout() {
  const t = document.getElementById('table');
  if (!t) return;
  const W = t.clientWidth, H = t.clientHeight;
  const g = G.game;
  const f = G.settings.cardSize === 'normal' ? 0.85 : 1;
  let cw = Math.min((W - 40) / 6.4, (H - 60) / 6.2, 150) * f;
  cw = Math.max(52, cw);
  const n = g && g.play && g.phase === 'play' ? g.play.hands[2].length : 13;
  const step = Math.min(cw * 0.66, (W - 36 - cw) / Math.max(1, n - 1));
  const cwS = cw * 0.74;
  // hauteur visible de chaque carte dans les colonnes du mort
  const maxLen = g && g.play ? Math.max(1, ...[0, 1, 2, 3].map(s => g.play.hands[0].filter(c => B.suitOf(c) === s).length)) : 6;
  const vstep = Math.min(cwS * 1.42 * 0.33, (H * 0.36 - cwS * 1.42) / Math.max(1, maxLen - 1));
  const sideMax = g && g.play ? Math.max(1, ...[1, 3].map(seat => Math.max(0, ...[0, 1, 2, 3].map(s => g.play.hands[seat].filter(c => B.suitOf(c) === s).length)))) : 6;
  const st = t.style;
  st.setProperty('--cw', cw + 'px'); st.setProperty('--ch', cw * 1.42 + 'px'); st.setProperty('--step', step + 'px');
  st.setProperty('--cwS', cwS + 'px'); st.setProperty('--vstep', Math.max(cwS * 0.42, vstep) + 'px');
  const nz = t.querySelector('.zone-n'), sz = t.querySelector('.zone-s');
  // le coin en haut à droite est réservé au message du coup : Nord se décale un peu à gauche si la place manque
  let nx = 0;
  if (g && g.phase === 'play') {
    const right = W / 2 - nz.offsetWidth / 2, need = 208;
    if (right < need) nx = -Math.min(need - right, Math.max(0, right - 16));
  }
  st.setProperty('--nx', nx + 'px');
  const top = nz.offsetTop + nz.offsetHeight, bottom = sz.offsetTop + (sz.querySelector('.hand') ? 22 : 0);
  // mort sur le côté (Est ou Ouest) : rangées qui se recouvrent, à la taille de l'espace libre
  const side = t.querySelector('.dummy.rows');
  const sideRows = side ? side.querySelectorAll('.row').length : 4;
  const availSide = bottom - top + 30;
  let cwD = cwS;
  if (50 + cwD * (1.42 + 0.62 * (sideRows - 1)) > availSide) cwD = Math.max(44, (availSide - 50) / (1.42 + 0.62 * (sideRows - 1)));
  const hstep = Math.max(cwD * 0.36, Math.min(cwD * 0.45, (W * 0.27 - cwD) / Math.max(1, sideMax - 1)));
  st.setProperty('--cwD', cwD + 'px'); st.setProperty('--rstep', cwD * 0.62 + 'px'); st.setProperty('--hstep', hstep + 'px');
  const sideSeat = side ? +side.dataset.seat : -1;
  st.setProperty('--cx', sideSeat === 1 ? `calc(50% - ${W * 0.05}px)` : sideSeat === 3 ? `calc(50% + ${W * 0.05}px)` : '50%');
  // le pli au centre : aussi grand que possible dans l'espace libre entre Nord et Sud
  const cwT = Math.max(46, Math.min(cw * 0.74, (bottom - top - 14) / (1.42 * 2.1)));
  st.setProperty('--cwT', cwT + 'px');
  st.setProperty('--cy', ((top + bottom) / 2) + 'px');
  // boîte d'enchères : toute la largeur libre entre Ouest et Est, et jamais par-dessus les cartes de Sud
  const bb = t.querySelector('.bidbox');
  if (bb) {
    const wz = t.querySelector('.zone-w'), ez = t.querySelector('.zone-e');
    const sides = Math.max(wz.offsetLeft + wz.offsetWidth, W - ez.offsetLeft);
    st.setProperty('--bbw', Math.max(300, Math.min(560, W - 2 * sides - 16)) + 'px');
    // en haut : sous le nom et l'enchère de Nord (le dos de ses cartes peut être recouvert)
    let nb = nz.offsetTop;
    for (const e of nz.querySelectorAll('.tag, .bubble')) nb = Math.max(nb, nz.offsetTop + e.offsetTop + e.offsetHeight);
    const hb = sz.offsetTop + 22;
    st.setProperty('--bbs', Math.max(0.55, Math.min(1, (hb - nb - 16) / bb.offsetHeight)));
    st.setProperty('--cy', ((nb + hb) / 2) + 'px');
  }
}
window.addEventListener('resize', () => { if (screen === 'game') layout(); });

/* ---------- Pages ---------- */
function seg(key, opts) {
  return `<div class="seg">${opts.map(([v, l]) => `<button class="${G.settings[key] === v ? 'on' : ''}" data-act="set:${key}:${v}">${l}</button>`).join('')}</div>`;
}
function renderSettings() {
  $app.innerHTML = `<div class="page"><div class="inner">
    <button class="btn back" data-act="${G.game && G.game.phase !== 'end' ? 'resume' : 'go:home'}">← Retour</button>
    <h1>Réglages</h1>
    <div class="setting"><div class="lbl">Taille des cartes<small>« Très grandes » utilise toute la place disponible.</small></div>${seg('cardSize', [['normal', 'Grandes'], ['grand', 'Très grandes']])}</div>
    <div class="setting"><div class="lbl">Couleurs des cartes<small>4 couleurs : ${su(2)} orange et ${su(3)} vert, pour mieux les distinguer.</small></div>${seg('fourColors', [[false, '2 couleurs'], [true, '4 couleurs']])}</div>
    <div class="setting"><div class="lbl">Vitesse des robots</div>${seg('speed', [['lent', 'Lente'], ['normal', 'Normale'], ['rapide', 'Rapide']])}</div>
    <div class="setting"><div class="lbl">Jouer une carte<small>Deux touchers : le 1er soulève la carte, le 2e la joue (évite les erreurs).</small></div>${seg('doubleTap', [[true, '2 touchers'], [false, '1 toucher']])}</div>
    <div class="setting"><div class="lbl">Afficher mes points<small>Le nombre de points H et HL sous la boîte d'enchères.</small></div>${seg('showPoints', [[true, 'Oui'], [false, 'Non']])}</div>
    <div class="setting"><div class="lbl">Sons<small>Bruit des cartes, petite cloche quand c'est à vous, musique en fin de donne.</small></div>${seg('sound', [[true, 'Oui'], [false, 'Non']])}</div>
    <div class="setting"><div class="lbl">Volume des sons</div>${seg('volume', [['faible', 'Faible'], ['moyen', 'Moyen'], ['fort', 'Fort']])}</div>
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
    <h2>Dernières donnes</h2>
    ${rows ? `<table class="hist"><tr><th>Donne</th><th>Contrat</th><th>Plis</th><th>Résultat</th><th>Marque NS</th></tr>${rows}</table>` : '<p>Aucune donne terminée pour l\'instant.</p>'}
  </div></div>`;
}
function renderHelp() {
  $app.innerHTML = `<div class="page"><div class="inner">
    <button class="btn back" data-act="${G.game && G.game.phase !== 'end' ? 'resume' : 'go:home'}">← Retour</button>
    <h1>Comment jouer</h1>
    <p>Vous êtes <b>Sud</b>, en bas de l'écran. Votre partenaire Nord et les adversaires Est et Ouest sont des robots. Ils annoncent comme dans les fiches de votre cours (Majeure 5e, 1SA de 15 à 17 points, Stayman, Texas, 2 faibles…).</p>
    <h2>Les enchères</h2>
    <ul>
      <li>Quand c'est à vous, la boîte d'enchères apparaît au milieu du tapis : touchez d'abord le <b>palier</b> (1 à 7), puis la <b>couleur</b> (${su(3)} ${su(2)} ${su(1)} ${su(0)} ou SA).</li>
      <li>Les boutons <b>Passe</b>, <b>Contre</b> et <b>Surcontre</b> sont juste en dessous.</li>
      <li>Dans le tableau des enchères à droite, <b>touchez une enchère</b> pour voir ce qu'elle veut dire : nombre de points, nombre de cartes dans chaque couleur, et la fiche du cours qui en parle. Un rond orange <span style="display:inline-block;width:20px;height:20px;border-radius:50%;background:#e8590c;color:#fff;text-align:center;font-size:14px;line-height:20px">!</span> signale une enchère conventionnelle (alerte).</li>
      <li>Si votre enchère s'écarte du cours, l'application vous le signale et vous laisse choisir (réglable).</li>
    </ul>
    <h2>Le jeu de la carte</h2>
    <ul>
      <li>Touchez une carte pour la <b>soulever</b>, touchez-la une 2e fois pour la <b>jouer</b>. Les cartes grisées ne peuvent pas être jouées (il faut fournir à la couleur demandée).</li>
      <li>Quand votre camp joue le contrat, <b>vous jouez aussi les cartes du mort</b> (Nord, en haut).</li>
      <li>Quand les adversaires jouent le contrat, le mort est étalé sur le côté après l'entame.</li>
    </ul>
    <h2>Les boutons</h2>
    <ul>
      <li><b>Conseil</b> : l'enchère ou la carte que le cours recommande, avec la raison.</li>
      <li><b>Annuler</b> : revenir avant votre dernière enchère ou votre dernière carte.</li>
      <li><b>Dernier pli</b> : revoir les 4 cartes du pli précédent.</li>
      <li><b>Réclamer</b> : terminer la donne quand toutes vos cartes sont maîtresses.</li>
      <li><b>Menu</b> : nouvelle donne, recommencer la donne, résultats, réglages.</li>
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
    <div class="fiche-list">${Object.keys(B.FICHES).sort().map(k => [k, B.FICHES[k]]).map(([k, v]) => `<button class="btn" data-fiche="${k}">${ICONS.book}<span>Fiche ${k} : ${rich(v)}</span></button>`).join('')}</div>
  </div></div>`;
}

/* ---------- Gestion des touchers ---------- */
$app.addEventListener('click', e => {
  const pe = e.target.closest('[data-perso]');
  if (pe && screen === 'game') { showPerso(+pe.dataset.perso); return; }
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
  const [k, v, w] = act.split(':');
  if (k === 'new') newDeal(false);
  else if (k === 'replay') confirmReplay();
  else if (k === 'resume') go('game');
  else if (k === 'go') go(v);
  else if (k === 'menu') menu();
  else if (k === 'hint') hint();
  else if (k === 'undo') undo();
  else if (k === 'last') lastTrick();
  else if (k === 'claim') claim();
  else if (k === 'lvl') { bidLevel = +v; render(); }
  else if (k === 'bid') { if (bidLevel) submitCall(bidLevel + v); }
  else if (k === 'call') submitCall(v);
  else if (k === 'sel') { G.game.selCall = +v; save(); render(); }
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
      <div class="btns"><button class="btn primary" data-m="yes">Effacer</button><button class="btn" data-m="no">Garder</button></div>`, r => { if (r === 'yes') { G.stats.history = []; save(); toast('Résultats effacés.'); } });
  }
});
// une fiche du cours, en grand, par-dessus le jeu (images en cache : marche sans internet)
function openFiche(id) {
  const n = FICHE_PAGES[id];
  if (!n) return;
  let zoom = 1;
  const v = document.createElement('div');
  v.className = 'fiche-view';
  v.innerHTML = `<div class="bar"><div class="ttl">Fiche du cours n° ${id}<small>${rich(B.FICHES[id])}</small></div>
    <button class="btn" data-z="-1">A−</button><button class="btn" data-z="1">A+</button><button class="btn primary" data-close>Fermer</button></div>
    <div class="pages">${Array.from({ length: n }, (_, i) => `<img src="fiches/f${id}-${i + 1}.jpg?v=3" alt="Fiche ${id}, page ${i + 1}">`).join('')}</div>`;
  document.body.appendChild(v);
  snd('select');
  const pages = v.querySelector('.pages');
  v.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) { v.remove(); return; }
    const z = e.target.closest('[data-z]');
    if (z) { zoom = Math.max(0.6, Math.min(2.2, zoom + 0.4 * +z.dataset.z)); pages.style.setProperty('--z', zoom); }
  });
}
document.addEventListener('click', e => { const f = e.target.closest('[data-fiche]'); if (f) openFiche(f.dataset.fiche); });
function showPerso(s) {
  const q = opp(s);
  modal(`<div class="perso-card">${B.avatarSVG(q)}<div><h2>${q.name}</h2><div class="ttl">${q.title} · joue en ${SEATN[s]}</div></div></div>
    <p>${q.bio}</p><div class="btns"><button class="btn primary" data-m="ok">Fermer</button></div>`);
}
// le son ne peut démarrer qu'après un toucher (règle de l'iPad)
['touchend', 'click'].forEach(ev => document.addEventListener(ev, () => { if (B.sound) B.sound.unlock(); }, { capture: true, passive: true }));
if (B.sound) B.sound.configure(G.settings);
document.addEventListener('visibilitychange', () => { if (!document.hidden && screen === 'game') { cancelTimers(); dealing = false; holdTrick = false; thinking = -1; render(); step(); } });

render();
})();
