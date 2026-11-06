/* Bridge — analyse d'une donne terminée :
   - les enchères de Sud qui s'écartent du cours ;
   - les cartes jouées par l'utilisatrice qui auraient dû être différentes
     (calcul exact « à cartes ouvertes » sur les 8 derniers plis, conseil du cours avant) ;
   - une façon de jouer conseillée pour toute la donne, carte par carte, avec la raison de chaque carte.
   Le calcul est découpé en petites étapes pour que l'écran reste fluide. */
var B = globalThis.B = globalThis.B || {};
(function () {
'use strict';
const { suitOf, rankOf } = B;
const pause = () => new Promise(r => setTimeout(r, 0));
const EXACT = 8;   // plis restants à partir desquels le calcul exact est assez rapide

// deux cartes d'une couleur se valent si toutes les cartes entre elles sont dans la même main ou déjà jouées
function equivalent(st, seat, a, b) {
  if (suitOf(a) !== suitOf(b)) return false;
  const s = suitOf(a), lo = Math.min(rankOf(a), rankOf(b)), hi = Math.max(rankOf(a), rankOf(b));
  for (let r = lo + 1; r < hi; r++) {
    const c = s * 13 + r;
    if ([0, 1, 2, 3].some(p => p !== seat && st.hands[p].includes(c))) return false;
  }
  return true;
}
// valeur exacte (plis de Nord-Sud jusqu'à la fin) de chaque carte jouable
function exactMoves(st, seat) {
  const ev = B.dd.makeSolver(st.hands, st.trump, { maxNodes: 4e6 }).evalMoves(st.trick, seat);
  const ns = seat % 2 === 0;
  const top = ev.reduce((m, x) => ns ? Math.max(m, x.ns) : Math.min(m, x.ns), ns ? -1 : 99);
  return { ev, top, best: ev.filter(x => x.ns === top).map(x => x.card) };
}
// parmi des cartes qui se valent, la plus naturelle : celle du conseil si elle en fait partie, sinon la plus petite
function natural(cards, advice) {
  if (cards.includes(advice)) return advice;
  return cards.slice().sort((a, b) => rankOf(a) - rankOf(b))[0];
}
function startState(g) {
  // mission : la fin de donne de départ (plis déjà faits, pli en cours, mort étalé)
  if (g.mission) return B.mission.startState(B.mission.byId(g.mission));
  const st = B.newPlay(g.hands, g.contract);
  st.auction = g.auction.slice();
  st.dealer = g.dealer;
  return st;
}

function reviewBids(g) {
  const out = [];
  if (g.mission) return out;
  let nth = 0;
  g.auction.forEach((call, i) => {
    if ((g.dealer + i) % 4 !== 2) return;
    nth++;
    const before = g.auction.slice(0, i);
    const h = B.decide(g.hands[2], before, g.dealer);
    if (h.call !== call) out.push({ i, nth, call, best: h.call, m: h.m, sure: h.sure, mine: B.explainCall(before, g.dealer, call) });
  });
  return out;
}

async function reviewPlay(g, user, tick) {
  const st = startState(g);
  const seq = [];
  let pre = st.trick.length;   // mission : cartes déjà posées au départ, qui ne se rejouent pas
  for (const t of g.play.tricks) {
    for (const x of t.cards) {
      if (pre > 0) { pre--; continue; }
      const item = { seat: x.seat, card: x.card };
      if (user(x.seat) && B.legalCards(st, x.seat).length > 1) {
        const advice = B.chooseCard(B.cloneState(st), x.seat, { samples: 12 });
        item.advice = advice.card;
        if (st.hands[x.seat].length <= EXACT) {
          try {
            const { ev, top, best } = exactMoves(st, x.seat);
            const mine = ev.find(e => e.card === x.card).ns;
            if (mine !== top) {
              const card = natural(best, advice.card);
              item.fix = { card, exact: true, lost: Math.abs(top - mine), reason: card === advice.card ? advice.reason : '' };
            }
          } catch (e) { /* calcul trop long : on ne juge pas ce coup */ }
        } else if (advice.card !== x.card && !equivalent(st, x.seat, advice.card, x.card)) {
          item.fix = { card: advice.card, exact: false, reason: advice.reason };
        }
        await pause();
        tick();
      }
      B.playCard(st, x.seat, x.card);
      seq.push(item);
    }
  }
  return seq;
}

async function bestLine(g, tick) {
  const st = startState(g);
  const seq = [];
  while (!st.done) {
    const seat = st.turn;
    const r = B.chooseCard(B.cloneState(st), seat, { samples: 12 });
    let card = r.card, reason = r.reason;
    if (st.hands[seat].length <= EXACT && B.legalCards(st, seat).length > 1) {
      try {
        const { best } = exactMoves(st, seat);
        if (!best.includes(card)) {
          card = natural(best, card);
          reason = 'En voyant toutes les cartes, c\'est la carte qui rapporte le plus de plis à ce camp.';
        }
      } catch (e) { /* calcul trop long : on garde le conseil */ }
    }
    B.playCard(st, seat, card);
    seq.push({ seat, card, reason });
    await pause();
    tick();
  }
  return { seq, won: st.won.slice() };
}

// g : la donne terminée ; userNS : l'utilisatrice jouait aussi Nord (son camp avait le contrat)
async function analyseDeal(g, opts) {
  opts = opts || {};
  const user = seat => seat === 2 || (seat === 0 && opts.userNS);
  const bids = reviewBids(g);
  if (!g.contract || !g.play) return { bids, seq: [], best: null, won: [0, 0] };
  const mine = g.play.tricks.reduce((n, t) => n + t.cards.filter(x => user(x.seat)).length, 0);
  const total = mine + startState(g).hands.flat().length;
  let done = 0;
  const tick = () => { done++; if (opts.progress) opts.progress(done, total); };
  const seq = await reviewPlay(g, user, tick);
  const best = await bestLine(g, tick);
  return { bids, seq, best, won: g.play.won.slice() };
}

B.analyseDeal = analyseDeal;
})();
