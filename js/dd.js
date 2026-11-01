/* Bridge — calcul « à cartes ouvertes » (double mort) : nombre exact de plis faisables par Nord-Sud
   avec un jeu parfait des 4 côtés. Recherche par seuils (alpha-bêta booléen) avec table de
   transposition et levées de tête. Utilisé pour les fins de coup (8 plis ou moins). */
var B = globalThis.B = globalThis.B || {};
(function () {
'use strict';
const { suitOf, rankOf } = B;

const bitCount = x => { let n = 0; while (x) { x &= x - 1; n++; } return n; };

function makeSolver(hands, trump, opts) {
  const M = hands.map(h => { const m = [0, 0, 0, 0]; for (const c of h) m[suitOf(c)] |= 1 << rankOf(c); return m; });
  const limit = (opts && opts.maxNodes) || 2e6;
  const TT = new Map();
  let nodes = 0;

  function key(leader) {
    let k = '' + leader;
    for (let s = 0; s < 4; s++) for (let p = 0; p < 4; p++) k += ',' + M[p][s];
    return k;
  }
  function genMoves(seat, ledSuit, winCard) {
    const h = M[seat];
    let suits = [0, 1, 2, 3];
    if (ledSuit >= 0 && h[ledSuit]) suits = [ledSuit];
    const res = [];
    for (const s of suits) {
      const mine = h[s];
      if (!mine) continue;
      const all = M[0][s] | M[1][s] | M[2][s] | M[3][s];
      let prevKept = -1;
      for (let r = 12; r >= 0; r--) {
        if (!(mine & (1 << r))) continue;
        if (prevKept >= 0) {
          let eq = true;
          for (let k = r + 1; k < prevKept; k++) if ((all & (1 << k)) && !(mine & (1 << k))) { eq = false; break; }
          if (eq) continue;
        }
        res.push(s * 13 + r);
        prevKept = r;
      }
    }
    if (winCard != null) {
      const ws = suitOf(winCard), wr = rankOf(winCard);
      const winning = c => (suitOf(c) === ws && rankOf(c) > wr) || (suitOf(c) === trump && ws !== trump);
      res.sort((a, b) => (winning(b) - winning(a)) || rankOf(a) - rankOf(b));
    }
    return res;
  }
  function quickTricks(leader, left) {
    const p = leader, o1 = (leader + 1) % 4, o2 = (leader + 3) % 4;
    const oppTr = trump >= 0 && (M[o1][trump] | M[o2][trump]) !== 0;
    let n = 0;
    for (let s = 0; s < 4; s++) {
      const mine = M[p][s];
      if (!mine) continue;
      const all = M[0][s] | M[1][s] | M[2][s] | M[3][s];
      let k = 0;
      for (let r = 12; r >= 0; r--) {
        if (!(all & (1 << r))) continue;
        if (mine & (1 << r)) k++; else break;
      }
      if (trump >= 0 && s !== trump && oppTr) k = Math.min(k, bitCount(M[o1][s]), bitCount(M[o2][s]));
      n += k;
    }
    return Math.min(n, left);
  }
  function ge(leader, target, left) {
    if (target <= 0) return true;
    if (target > left) return false;
    const k = key(leader);
    let e = TT.get(k);
    if (e) { if (e.lo >= target) return true; if (e.hi < target) return false; }
    else { e = { lo: 0, hi: left }; TT.set(k, e); }
    const qt = quickTricks(leader, left);
    if ((leader & 1) === 0) { if (qt >= target) { if (qt > e.lo) e.lo = qt; return true; } }
    else if (left - qt < target) { if (left - qt < e.hi) e.hi = left - qt; return false; }
    const r = pos(leader, 0, -1, null, -1, target, left);
    if (r) { if (target > e.lo) e.lo = target; } else if (target - 1 < e.hi) e.hi = target - 1;
    return r;
  }
  function pos(leader, p, ledSuit, winCard, winSeat, target, left) {
    if (++nodes > limit) throw new Error('trop long');
    const seat = (leader + p) % 4;
    const maxi = (seat & 1) === 0;
    for (const c of genMoves(seat, ledSuit, winCard)) {
      const s = suitOf(c), bit = 1 << rankOf(c);
      M[seat][s] &= ~bit;
      let nWin = winCard, nSeat = winSeat;
      if (winCard == null) { nWin = c; nSeat = seat; }
      else {
        const ws = suitOf(winCard);
        if ((s === ws && rankOf(c) > rankOf(winCard)) || (s === trump && ws !== trump)) { nWin = c; nSeat = seat; }
      }
      const r = p === 3 ? ge(nSeat, target - ((nSeat & 1) === 0 ? 1 : 0), left - 1)
        : pos(leader, p + 1, p === 0 ? s : ledSuit, nWin, nSeat, target, left);
      M[seat][s] |= bit;
      if (maxi && r) return true;
      if (!maxi && !r) return false;
    }
    return !maxi;
  }
  // Plis de Nord-Sud pour la suite de la donne, pli en cours compris.
  // trick : [{seat, card}] déjà posées (0 à 3 cartes), turn : joueur qui doit jouer
  function value(trick, turn) {
    const cardsLeft = M.reduce((n, m) => n + m.reduce((a, x) => a + bitCount(x), 0), 0);
    const left = (cardsLeft + trick.length) / 4;
    let ledSuit = -1, winCard = null, winSeat = -1;
    for (const x of trick) {
      if (winCard == null) { ledSuit = suitOf(x.card); winCard = x.card; winSeat = x.seat; continue; }
      const s = suitOf(x.card), ws = suitOf(winCard);
      if ((s === ws && rankOf(x.card) > rankOf(winCard)) || (s === trump && ws !== trump)) { winCard = x.card; winSeat = x.seat; }
    }
    const leader = trick.length ? trick[0].seat : turn;
    const test = t => trick.length === 0 ? ge(leader, t, left) : pos(leader, trick.length, ledSuit, winCard, winSeat, t, left);
    let lo = 0, hi = left;
    while (lo < hi) {
      const t = Math.floor((lo + hi + 1) / 2);
      if (test(t)) lo = t; else hi = t - 1;
    }
    return lo;
  }
  // Valeur de chaque carte jouable par `turn` (la table est partagée entre les candidats)
  function evalMoves(trick, turn) {
    const ledSuit = trick.length ? suitOf(trick[0].card) : -1;
    const h = M[turn];
    const cards = [];
    for (let s = 0; s < 4; s++) for (let r = 0; r < 13; r++) if (h[s] & (1 << r)) cards.push(s * 13 + r);
    const leg = ledSuit >= 0 && h[ledSuit] ? cards.filter(c => suitOf(c) === ledSuit) : cards;
    const out = [];
    for (const c of leg) {
      M[turn][suitOf(c)] &= ~(1 << rankOf(c));
      const t2 = trick.concat([{ seat: turn, card: c }]);
      let v;
      if (t2.length === 4) {
        let w = t2[0];
        for (const x of t2.slice(1)) {
          const s = suitOf(x.card), ws = suitOf(w.card);
          if ((s === ws && rankOf(x.card) > rankOf(w.card)) || (s === trump && ws !== trump)) w = x;
        }
        v = ((w.seat & 1) === 0 ? 1 : 0) + value([], w.seat);
      } else v = value(t2, (turn + 1) % 4);
      M[turn][suitOf(c)] |= 1 << rankOf(c);
      out.push({ card: c, ns: v });
    }
    return out;
  }
  return { value, evalMoves, nodes: () => nodes };
}

function solve(hands, trump, leader, opts) {
  const s = makeSolver(hands, trump, opts);
  return { ns: s.value([], leader), nodes: s.nodes() };
}
function evalMoves(hands, trump, trick, turn, opts) {
  return makeSolver(hands, trump, opts).evalMoves(trick, turn);
}

B.dd = { makeSolver, solve, evalMoves, bitCount };
})();
