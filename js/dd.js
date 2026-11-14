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
  const T = [0, 0, 0, 0];   // cartes du pli en cours : deux cartes ne sont pas équivalentes si une carte du pli les sépare
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
      const all = M[0][s] | M[1][s] | M[2][s] | M[3][s] | T[s];
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
      let r;
      if (p === 3) {
        // pli fini : le suivant commence sans carte sur la table
        const saved = T.slice();
        T.fill(0);
        r = ge(nSeat, target - ((nSeat & 1) === 0 ? 1 : 0), left - 1);
        for (let k = 0; k < 4; k++) T[k] = saved[k];
      } else {
        T[s] |= bit;
        r = pos(leader, p + 1, p === 0 ? s : ledSuit, nWin, nSeat, target, left);
        T[s] &= ~bit;
      }
      M[seat][s] |= bit;
      if (maxi && r) return true;
      if (!maxi && !r) return false;
    }
    return !maxi;
  }
  // Plis de Nord-Sud pour la suite de la donne, pli en cours compris.
  // trick : [{seat, card}] déjà posées (0 à 3 cartes), turn : joueur qui doit jouer
  function value(trick, turn) {
    T.fill(0);
    for (const x of trick) T[suitOf(x.card)] |= 1 << rankOf(x.card);
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

// Bornes « quel que soit le jeu » : le moins et le plus de plis que Nord-Sud peut encore faire si les quatre joueurs
// jouent n'importe quelles cartes permises. Si les deux sont égaux, la fin de donne est jouée d'avance (on peut la finir
// automatiquement). Recherche complète avec cartes équivalentes regroupées et table de transposition ; lève une erreur
// si elle dépasse maxNodes.
function range(hands, trump, trick, turn, opts) {
  const M = hands.map(h => { const m = [0, 0, 0, 0]; for (const c of h) m[suitOf(c)] |= 1 << rankOf(c); return m; });
  const limit = (opts && opts.maxNodes) || 3e5;
  const TT = new Map();
  let nodes = 0;
  const key = leader => { let k = '' + leader; for (let s = 0; s < 4; s++) for (let p = 0; p < 4; p++) k += ',' + M[p][s]; return k; };
  // cartes jouables, une seule par groupe de cartes qui se suivent (aucune carte d'un autre joueur, ni du pli en cours, entre elles)
  function moves(seat, led, t) {
    const h = M[seat];
    const suits = led >= 0 && h[led] ? [led] : [0, 1, 2, 3];
    const res = [];
    for (const s of suits) {
      const mine = h[s];
      if (!mine) continue;
      let all = M[0][s] | M[1][s] | M[2][s] | M[3][s];
      for (const x of t) if (suitOf(x.card) === s) all |= 1 << rankOf(x.card);
      let prev = false;
      for (let r = 12; r >= 0; r--) {
        const bit = 1 << r;
        if (!(all & bit)) continue;
        if (mine & bit) { if (!prev) res.push(s * 13 + r); prev = true; } else prev = false;
      }
    }
    return res;
  }
  function win(t) {
    const led = suitOf(t[0].card);
    let w = t[0];
    for (const x of t.slice(1)) {
      const sx = suitOf(x.card), sw = suitOf(w.card);
      if (sx === sw ? rankOf(x.card) > rankOf(w.card) : sx === trump) w = x;
    }
    return w.seat;
  }
  function rec(t, turn) {
    if (++nodes > limit) throw new Error('fin de donne trop longue à calculer');
    if (!t.length) {
      if (!M.some(h => h[0] | h[1] | h[2] | h[3])) return [0, 0];
      const k = key(turn), hit = TT.get(k);
      if (hit) return hit;
      const r = inner(t, turn);
      TT.set(k, r);
      return r;
    }
    return inner(t, turn);
  }
  function inner(t, turn) {
    const led = t.length ? suitOf(t[0].card) : -1;
    let lo = 99, hi = -1;
    for (const c of moves(turn, led, t)) {
      M[turn][suitOf(c)] &= ~(1 << rankOf(c));
      const t2 = t.concat([{ seat: turn, card: c }]);
      let v;
      if (t2.length === 4) { const w = win(t2), ns = (w & 1) === 0 ? 1 : 0, sub = rec([], w); v = [sub[0] + ns, sub[1] + ns]; }
      else v = rec(t2, (turn + 1) % 4);
      M[turn][suitOf(c)] |= 1 << rankOf(c);
      if (v[0] < lo) lo = v[0];
      if (v[1] > hi) hi = v[1];
    }
    return [lo, hi];
  }
  return rec(trick.slice(), turn);
}

// La « ligne simple » de Nord-Sud, sans aucune technique : faire tomber les atouts, encaisser ses cartes maîtresses (la main
// courte d'abord), aller chez le partenaire encaisser les siennes, sinon céder le pli avec sa plus petite carte ; en suite de
// pli, prendre au plus juste, ou fournir petit si le partenaire tient le pli. M : masques des mains ; renvoie une carte.
function simpleCard(M, trump, seat, t) {
  const pm = (seat + 2) % 4, opp = [(seat + 1) % 4, (seat + 3) % 4];
  const has = (p, s) => M[p][s] !== 0;
  const top = s => { const all = M[0][s] | M[1][s] | M[2][s] | M[3][s]; return all ? 31 - Math.clz32(all) : -1; };
  const cards = (p, s) => { const r = []; for (let k = 12; k >= 0; k--) if (M[p][s] & (1 << k)) r.push(k); return r; };   // du plus fort au plus faible
  const len = (p, s) => bitCount(M[p][s]);
  // défausse : la plus petite carte qui n'est pas maîtresse, dans la couleur la plus longue (jamais un atout si possible)
  const discard = () => {
    let best = null;
    for (let s = 0; s < 4; s++) {
      const cs = cards(seat, s);
      if (!cs.length) continue;
      const low = cs[cs.length - 1], master = low === top(s);
      const score = (s === trump ? 1000 : 0) + (master ? 100 : 0) - len(seat, s);
      if (!best || score < best.score) best = { c: s * 13 + low, score };
    }
    return best.c;
  };
  if (!t.length) {
    const lowest = s => { const cs = cards(seat, s); return s * 13 + cs[cs.length - 1]; };
    const tOpp = trump >= 0 && opp.some(p => has(p, trump));
    // 1) faire tomber les atouts adverses : avec l'atout maître, ou un petit atout vers l'atout maître du partenaire
    if (tOpp && has(seat, trump)) {
      if (cards(seat, trump)[0] === top(trump)) return trump * 13 + top(trump);
      if (has(pm, trump) && cards(pm, trump)[0] === top(trump)) return lowest(trump);
    }
    // 2) encaisser ses cartes maîtresses, en commençant par la main courte
    const masters = [];
    for (let s = 0; s < 4; s++) if (s !== trump && has(seat, s) && cards(seat, s)[0] === top(s)) masters.push(s);
    if (masters.length) {
      masters.sort((a, b) => (len(seat, a) - len(pm, a)) - (len(seat, b) - len(pm, b)));
      return masters[0] * 13 + top(masters[0]);
    }
    // 3) aller chez le partenaire, qui a des cartes maîtresses dans une couleur où l'on a une petite carte
    const toPm = [];
    for (let s = 0; s < 4; s++) if (s !== trump && has(seat, s) && has(pm, s) && cards(pm, s)[0] === top(s)) toPm.push(s);
    if (toPm.length) { toPm.sort((a, b) => len(pm, b) - len(pm, a)); return lowest(toPm[0]); }
    // 4) les atouts maîtres, quand l'adversaire n'en a plus
    if (trump >= 0 && has(seat, trump) && cards(seat, trump)[0] === top(trump)) return trump * 13 + top(trump);
    // 5) rien de maître : on cède avec la plus petite carte de la couleur la plus longue
    let ls = -1;
    for (let s = 0; s < 4; s++) if (has(seat, s) && (ls < 0 || len(seat, s) > len(seat, ls) || (len(seat, s) === len(seat, ls) && s !== trump && ls === trump))) ls = s;
    return lowest(ls);
  }
  const led = suitOf(t[0].card);
  let w = t[0];
  for (const x of t.slice(1)) { const sx = suitOf(x.card), sw = suitOf(w.card); if (sx === sw ? rankOf(x.card) > rankOf(w.card) : sx === trump) w = x; }
  const partnerWins = w.seat === pm;
  const beats = c => { const sc = suitOf(c), sw = suitOf(w.card); return sc === sw ? rankOf(c) > rankOf(w.card) : sc === trump; };
  if (has(seat, led)) {
    const cs = cards(seat, led);
    if (partnerWins) return led * 13 + cs[cs.length - 1];
    const win = cs.filter(r => beats(led * 13 + r));
    return led * 13 + (win.length ? win[win.length - 1] : cs[cs.length - 1]);
  }
  if (!partnerWins && trump >= 0 && has(seat, trump)) {
    const win = cards(seat, trump).filter(r => beats(trump * 13 + r));
    if (win.length) return trump * 13 + win[win.length - 1];
  }
  return discard();
}
// La fin de donne se joue-t-elle « toute seule » pour Nord-Sud ? Si la ligne simple fait autant de plis que le meilleur
// jeu (calcul exact), contre TOUTES les défenses possibles, le résultat est acquis : on peut proposer de finir la donne.
// Renvoie { ns } (plis de Nord-Sud qui restent à faire) ou null.
function claimable(hands, trump, trick, turn, opts) {
  const maxNodes = (opts && opts.maxNodes) || 3e5;
  const n = hands[turn].length;
  if (!n || hands.some((h, p) => h.length !== n - (trick.some(x => x.seat === p) ? 1 : 0))) return null;
  const v = makeSolver(hands, trump, { maxNodes: 2e6 }).value(trick, turn);   // le meilleur résultat possible pour Nord-Sud
  const M = hands.map(h => { const m = [0, 0, 0, 0]; for (const c of h) m[suitOf(c)] |= 1 << rankOf(c); return m; });
  const TT = new Map();
  let nodes = 0;
  const key = leader => { let k = '' + leader; for (let s = 0; s < 4; s++) for (let p = 0; p < 4; p++) k += ',' + M[p][s]; return k; };
  function win(t) {
    let w = t[0];
    for (const x of t.slice(1)) { const sx = suitOf(x.card), sw = suitOf(w.card); if (sx === sw ? rankOf(x.card) > rankOf(w.card) : sx === trump) w = x; }
    return w.seat;
  }
  function moves(seat, led, t) {   // toutes les cartes de la défense, une par groupe de cartes équivalentes
    const h = M[seat], suits = led >= 0 && h[led] ? [led] : [0, 1, 2, 3], res = [];
    for (const s of suits) {
      const mine = h[s];
      if (!mine) continue;
      let all = M[0][s] | M[1][s] | M[2][s] | M[3][s];
      for (const x of t) if (suitOf(x.card) === s) all |= 1 << rankOf(x.card);
      let prev = false;
      for (let r = 12; r >= 0; r--) { const bit = 1 << r; if (!(all & bit)) continue; if (mine & bit) { if (!prev) res.push(s * 13 + r); prev = true; } else prev = false; }
    }
    return res;
  }
  // le moins de plis que la ligne simple de Nord-Sud peut faire, contre la pire défense
  function low(t, turn) {
    if (++nodes > maxNodes) throw new Error('trop long');
    if (!t.length) {
      if (!M.some(h => h[0] | h[1] | h[2] | h[3])) return 0;
      const k = key(turn), hit = TT.get(k);
      if (hit !== undefined) return hit;
      const r = step(t, turn);
      TT.set(k, r);
      return r;
    }
    return step(t, turn);
  }
  function step(t, turn) {
    const led = t.length ? suitOf(t[0].card) : -1;
    const opts = (turn & 1) === 0 ? [simpleCard(M, trump, turn, t)] : moves(turn, led, t);
    let best = 99;
    for (const c of opts) {
      M[turn][suitOf(c)] &= ~(1 << rankOf(c));
      const t2 = t.concat([{ seat: turn, card: c }]);
      let r;
      if (t2.length === 4) { const w = win(t2); r = ((w & 1) === 0 ? 1 : 0) + low([], w); } else r = low(t2, (turn + 1) % 4);
      M[turn][suitOf(c)] |= 1 << rankOf(c);
      if (r < best) best = r;
    }
    return best;
  }
  return low(trick.slice(), turn) >= v ? { ns: v } : null;
}

B.dd = { makeSolver, solve, evalMoves, range, claimable, simpleCard, bitCount };
})();
