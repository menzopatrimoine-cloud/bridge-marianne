/* Bridge — noyau : cartes, mains, donnes, évaluation des mains, enchères (règles de base) */
var B = globalThis.B = globalThis.B || {};
(function () {
'use strict';

// Couleurs : index 0..3 = Pique, Cœur, Carreau, Trèfle
const SUIT_SYM = ['♠', '♥', '♦', '♣'];
const SUIT_NAME = ['Pique', 'Cœur', 'Carreau', 'Trèfle'];
const SUIT_PL = ['piques', 'cœurs', 'carreaux', 'trèfles'];
const RANK_TXT = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'V', 'D', 'R', 'A'];
const RANK_NAME = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'Valet', 'Dame', 'Roi', 'As'];
// Joueurs : 0 = Nord, 1 = Est, 2 = Sud, 3 = Ouest
const SEAT_CH = ['N', 'E', 'S', 'O'];
const SEAT_NAME = ['Nord', 'Est', 'Sud', 'Ouest'];
// Dénominations d'enchères dans l'ordre croissant
const DEN = ['C', 'D', 'H', 'S', 'N'];
const DEN_SUIT = { C: 3, D: 2, H: 1, S: 0 };
const SUIT_DEN = ['S', 'H', 'D', 'C'];

const suitOf = c => (c / 13) | 0;
const rankOf = c => c % 13;
const card = (s, r) => s * 13 + r;
const partnerOf = s => (s + 2) % 4;
const sideOf = s => s % 2;            // 0 = Nord-Sud, 1 = Est-Ouest

function cardTxt(c) { return RANK_TXT[rankOf(c)] + SUIT_SYM[suitOf(c)]; }
function cardName(c) { return RANK_NAME[rankOf(c)] + ' de ' + SUIT_NAME[suitOf(c)].toLowerCase(); }

// Tri d'une main pour l'affichage : ♠ ♥ ♣ ♦ (couleurs alternées), du plus fort au plus faible
const DISPLAY_ORDER = [0, 1, 3, 2];
function sortHand(hand, order) {
  const ord = order || DISPLAY_ORDER;
  return hand.slice().sort((a, b) => {
    const sa = ord.indexOf(suitOf(a)), sb = ord.indexOf(suitOf(b));
    return sa !== sb ? sa - sb : rankOf(b) - rankOf(a);
  });
}

/* ---------- Évaluation d'une main ---------- */
function lens(h) {
  const l = [0, 0, 0, 0];
  for (const c of h) l[suitOf(c)]++;
  return l;
}
function hcp(h) {
  let p = 0;
  for (const c of h) { const r = rankOf(c); if (r >= 9) p += r - 8; }
  return p;
}
function suitHcp(h, s) {
  let p = 0;
  for (const c of h) if (suitOf(c) === s) { const r = rankOf(c); if (r >= 9) p += r - 8; }
  return p;
}
function lengthPts(h) { return lens(h).reduce((a, n) => a + Math.max(0, n - 4), 0); }
function HL(h) { return hcp(h) + lengthPts(h); }
// Points de distribution (si fit dans la couleur d'atout t) : chicane 3, singleton 2, doubleton 1
function distPts(h, t) {
  const l = lens(h); let d = 0;
  for (let s = 0; s < 4; s++) if (s !== t) d += l[s] === 0 ? 3 : l[s] === 1 ? 2 : l[s] === 2 ? 1 : 0;
  return d;
}
function HLD(h, t) { return HL(h) + distPts(h, t); }
function shape(h) { return lens(h).slice().sort((a, b) => b - a).join(''); }
// Main régulière : 4333, 4432, 5332
function isRegular(h) { const sh = shape(h); return sh === '4333' || sh === '4432' || sh === '5332'; }
function has(h, s, r) { return h.includes(card(s, r)); }
function ranksIn(h, s) { return h.filter(c => suitOf(c) === s).map(rankOf).sort((a, b) => b - a); }
// Nombre d'honneurs (A R D V 10) dans une couleur ; « gros » = A R D
function honors(h, s) { return ranksIn(h, s).filter(r => r >= 8).length; }
function bigHonors(h, s) { return ranksIn(h, s).filter(r => r >= 10).length; }
// Arrêt : As, Rx, Dxx, Vxxx
function stopper(h, s) {
  const r = ranksIn(h, s), n = r.length;
  return r.includes(12) || (r.includes(11) && n >= 2) || (r.includes(10) && n >= 3) || (r.includes(9) && n >= 4);
}
// « 1,5 arrêt » : deux gros honneurs ou As + Valet, avec au moins 3 cartes (ou AR)
function stopper15(h, s) {
  const r = ranksIn(h, s), n = r.length;
  const big = r.filter(x => x >= 9).length;
  return (r.includes(12) && r.includes(11)) || (big >= 2 && n >= 3);
}
// Couleur « robuste » (honneurs liés) : 2 des 3 gros honneurs, ou 3 des 5 honneurs
function robust(h, s) { return bigHonors(h, s) >= 2 || (honors(h, s) >= 3 && bigHonors(h, s) >= 1); }
function aces(h) { return h.filter(c => rankOf(c) === 12).length; }
function kings(h) { return h.filter(c => rankOf(c) === 11).length; }

/* ---------- Donnes ---------- */
function shuffle(a, rnd) {
  const r = rnd || Math.random;
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function randomHands(rnd) {
  const d = shuffle([...Array(52).keys()], rnd);
  return [0, 1, 2, 3].map(i => d.slice(i * 13, i * 13 + 13));
}
// Donneur et vulnérabilité selon le numéro de donne (rotation standard 1 à 16)
const VUL_TABLE = ['-', 'NS', 'EO', 'T', 'NS', 'EO', 'T', '-', 'EO', 'T', '-', 'NS', 'T', '-', 'NS', 'EO'];
function boardInfo(n) {
  const i = (n - 1) % 16;
  return { dealer: (n - 1) % 4, vul: VUL_TABLE[i] };
}
function isVul(vul, seat) {
  return vul === 'T' || (vul === 'NS' && sideOf(seat) === 0) || (vul === 'EO' && sideOf(seat) === 1);
}
function vulText(vul) {
  return { '-': 'Personne', NS: 'Nord-Sud', EO: 'Est-Ouest', T: 'Tout le monde' }[vul];
}

/* ---------- Enchères : règles de base ---------- */
const isBid = c => /^[1-7][CDHSN]$/.test(c);
const levelOf = c => +c[0];
const denOf = c => c[1];
const bidRank = c => (levelOf(c) - 1) * 5 + DEN.indexOf(denOf(c));
const mkBid = (lvl, den) => '' + lvl + den;

function callTxt(c, long) {
  if (c === 'P') return 'Passe';
  if (c === 'X') return 'Contre';
  if (c === 'XX') return long ? 'Surcontre' : 'Surc.';
  return c[0] + (c[1] === 'N' ? 'SA' : SUIT_SYM[DEN_SUIT[c[1]]]);
}
function denTxt(d) { return d === 'N' ? 'SA' : SUIT_SYM[DEN_SUIT[d]]; }
function denName(d) { return d === 'N' ? 'Sans-Atout' : SUIT_NAME[DEN_SUIT[d]]; }

function auctionState(auction, dealer) {
  let lastBid = null, lastBidSeat = -1, dbl = 0;
  auction.forEach((c, i) => {
    const seat = (dealer + i) % 4;
    if (isBid(c)) { lastBid = c; lastBidSeat = seat; dbl = 0; }
    else if (c === 'X') dbl = 1;
    else if (c === 'XX') dbl = 2;
  });
  return { lastBid, lastBidSeat, dbl, seat: (dealer + auction.length) % 4 };
}
function isLegal(call, auction, dealer) {
  const st = auctionState(auction, dealer);
  if (call === 'P') return true;
  if (isBid(call)) return !st.lastBid || bidRank(call) > bidRank(st.lastBid);
  if (!st.lastBid) return false;
  const opp = sideOf(st.lastBidSeat) !== sideOf(st.seat);
  if (call === 'X') return opp && st.dbl === 0;
  if (call === 'XX') return !opp && st.dbl === 1;
  return false;
}
function auctionEnded(auction) {
  const n = auction.length;
  if (n < 4) return false;
  if (auction.every(c => c === 'P')) return true;
  return auction[n - 1] === 'P' && auction[n - 2] === 'P' && auction[n - 3] === 'P' &&
    auction.slice(0, n - 3).some(isBid);
}
// Contrat final : {level, den, dbl, declarer} ou null si donne passée
function contractOf(auction, dealer) {
  const st = auctionState(auction, dealer);
  if (!st.lastBid) return null;
  const den = denOf(st.lastBid), side = sideOf(st.lastBidSeat);
  let declarer = st.lastBidSeat;
  for (let i = 0; i < auction.length; i++) {
    const seat = (dealer + i) % 4;
    if (sideOf(seat) === side && isBid(auction[i]) && denOf(auction[i]) === den) { declarer = seat; break; }
  }
  return { level: levelOf(st.lastBid), den, dbl: st.dbl, declarer };
}
function contractTxt(ct) {
  if (!ct) return 'Donne passée';
  return ct.level + denTxt(ct.den) + (ct.dbl === 2 ? ' surcontré' : ct.dbl === 1 ? ' contré' : '');
}

/* ---------- Marque (duplicate) ---------- */
function score(ct, tricks, vul) {
  // renvoie le score du camp du déclarant (positif ou négatif)
  if (!ct) return 0;
  const v = isVul(vul, ct.declarer);
  const need = ct.level + 6;
  const mult = ct.dbl === 2 ? 4 : ct.dbl === 1 ? 2 : 1;
  if (tricks >= need) {
    const per = (ct.den === 'C' || ct.den === 'D') ? 20 : 30;
    let base = ct.den === 'N' ? 40 + 30 * (ct.level - 1) : per * ct.level;
    base *= mult;
    let s = base;
    s += base >= 100 ? (v ? 500 : 300) : 50;
    if (ct.level === 6) s += v ? 750 : 500;
    if (ct.level === 7) s += v ? 1500 : 1000;
    if (ct.dbl === 1) s += 50;
    if (ct.dbl === 2) s += 100;
    const over = tricks - need;
    if (ct.dbl === 0) s += over * per;
    else s += over * (v ? 200 : 100) * (ct.dbl === 2 ? 2 : 1);
    return s;
  }
  const down = need - tricks;
  if (ct.dbl === 0) return -down * (v ? 100 : 50);
  let p = 0;
  for (let i = 1; i <= down; i++) {
    if (v) p += i === 1 ? 200 : 300;
    else p += i === 1 ? 100 : i <= 3 ? 200 : 300;
  }
  return -p * (ct.dbl === 2 ? 2 : 1);
}

Object.assign(B, {
  SUIT_SYM, SUIT_NAME, SUIT_PL, RANK_TXT, RANK_NAME, SEAT_CH, SEAT_NAME, DEN, DEN_SUIT, SUIT_DEN,
  suitOf, rankOf, card, partnerOf, sideOf, cardTxt, cardName, sortHand,
  lens, hcp, suitHcp, lengthPts, HL, distPts, HLD, shape, isRegular, has, ranksIn, honors, bigHonors,
  stopper, stopper15, robust, aces, kings,
  shuffle, randomHands, boardInfo, isVul, vulText,
  isBid, levelOf, denOf, bidRank, mkBid, callTxt, denTxt, denName, auctionState, isLegal, auctionEnded,
  contractOf, contractTxt, score,
});
})();
