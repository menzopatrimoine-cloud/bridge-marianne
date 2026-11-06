/* Bridge — jeu de la carte : règles, robots (déclarant et défense) et conseils.
   Les robots ne voient que ce qu'un joueur voit : leur main, le mort et les cartes jouées.
   Les raisons données reprennent la fiche « Jeu de la carte » du cours. */
var B = globalThis.B = globalThis.B || {};
(function () {
'use strict';
const { SUIT_NAME, SUIT_PL, RANK_TXT, DEN_SUIT, suitOf, rankOf, partnerOf, sideOf, cardTxt } = B;

/* ---------- État de la partie ---------- */
function newPlay(hands, ct) {
  return {
    hands: hands.map(h => h.slice()),
    orig: hands.map(h => h.slice()),
    trump: ct.den === 'N' ? -1 : DEN_SUIT[ct.den],
    declarer: ct.declarer, dummy: partnerOf(ct.declarer),
    level: ct.level, need: ct.level + 6,
    leader: (ct.declarer + 1) % 4, turn: (ct.declarer + 1) % 4,
    trick: [], tricks: [], won: [0, 0],
    voids: [0, 1, 2, 3].map(() => [false, false, false, false]),
    done: false,
  };
}
function cloneState(st) { return JSON.parse(JSON.stringify(st)); }
function legalCards(st, seat) {
  const h = st.hands[seat];
  if (!st.trick.length) return h.slice();
  const ls = suitOf(st.trick[0].card);
  const f = h.filter(c => suitOf(c) === ls);
  return f.length ? f : h.slice();
}
function beats(a, b, trump, ls) {
  const sa = suitOf(a), sb = suitOf(b);
  if (sa === sb) return rankOf(a) > rankOf(b);
  if (sa === trump) return true;
  return false;
}
function currentWinner(trick, trump) {
  if (!trick.length) return null;
  const ls = suitOf(trick[0].card);
  let w = trick[0];
  for (const t of trick.slice(1)) if (beats(t.card, w.card, trump, ls)) w = t;
  return w;
}
function playCard(st, seat, card) {
  if (st.done || seat !== st.turn) throw new Error('Pas le tour de ' + seat);
  if (!legalCards(st, seat).includes(card)) throw new Error('Carte illégale');
  if (st.trick.length && suitOf(card) !== suitOf(st.trick[0].card)) st.voids[seat][suitOf(st.trick[0].card)] = true;
  st.hands[seat] = st.hands[seat].filter(c => c !== card);
  st.trick.push({ seat, card });
  if (st.trick.length === 4) {
    const w = currentWinner(st.trick, st.trump);
    st.tricks.push({ leader: st.trick[0].seat, cards: st.trick.slice(), winner: w.seat });
    st.won[sideOf(w.seat)]++;
    st.trick = [];
    st.leader = st.turn = w.seat;
    if (st.tricks.length === 13 || st.hands.every(h => !h.length)) st.done = true;   // (mission : fin de donne plus courte)
    return { trickDone: true, winner: w.seat };
  }
  st.turn = (seat + 1) % 4;
  return { trickDone: false };
}
const dummyShown = st => !!st.shown || st.tricks.length > 0 || st.trick.length > 0;   // shown : mission, mort déjà étalé
const declTricks = st => st.won[sideOf(st.declarer)];

/* ---------- Connaissances d'un joueur ---------- */
function controllerOf(st, seat) { return seat === st.dummy ? st.declarer : seat; }
function visibleSeats(st, ctrl) {
  const v = [ctrl];
  if (ctrl === st.declarer) v.push(st.dummy);
  else if (dummyShown(st)) v.push(st.dummy);
  return v;
}
function playedCards(st) {
  const p = [];
  for (const t of st.tricks) for (const x of t.cards) p.push(x.card);
  for (const x of st.trick) p.push(x.card);
  return p;
}
// Cartes encore cachées pour ce joueur (dans les mains qu'il ne voit pas)
function hiddenCards(st, ctrl) {
  const vis = visibleSeats(st, ctrl);
  const r = [];
  for (let s = 0; s < 4; s++) if (!vis.includes(s)) r.push(...st.hands[s]);
  return r;
}
const inSuit = (cards, s) => cards.filter(c => suitOf(c) === s).sort((a, b) => rankOf(b) - rankOf(a));
const lowest = cards => cards.slice().sort((a, b) => rankOf(a) - rankOf(b))[0];
const highest = cards => cards.slice().sort((a, b) => rankOf(b) - rankOf(a))[0];
// Une carte est « maîtresse » si aucune carte plus forte de sa couleur n'est encore dans une main
// adverse ou cachée (le joueur ne sait pas où sont les cartes cachées : il raisonne sur leur ensemble)
function isMaster(st, ctrl, card) {
  const s = suitOf(card), r = rankOf(card);
  const vis = visibleSeats(st, ctrl);
  for (let seat = 0; seat < 4; seat++) {
    if (vis.includes(seat) && sideOf(seat) === sideOf(ctrl)) continue;
    if (st.hands[seat].some(c => suitOf(c) === s && rankOf(c) > r)) return false;
  }
  return true;
}
// Plus petite carte d'un groupe de cartes équivalentes (ex. de R-D on joue la D en 3e position)
function lowestEquivalent(st, hand, card) {
  const s = suitOf(card);
  const gone = new Set(playedCards(st));
  let cur = card;
  for (let r = rankOf(card) - 1; r >= 0; r--) {
    const c = s * 13 + r;
    if (hand.includes(c)) cur = c;
    else if (!gone.has(c)) break;
  }
  return cur;
}

/* ---------- Choix d'une carte ---------- */
function chooseCard(st, seat, opts) {
  const leg = legalCards(st, seat);
  if (leg.length === 1) return { card: leg[0], reason: 'C\'est la seule carte que vous pouvez jouer.' };
  const ctrl = controllerOf(st, seat);
  const isDecl = ctrl === st.declarer;
  const h = heuristicCard(st, seat, ctrl, isDecl, leg);
  // fin de coup : calcul exact sur des donnes compatibles avec ce que le joueur a vu
  if (B.dd && st.hands[seat].length <= ((opts && opts.ddTricks) || 6)) {
    try {
      const best = endgameCard(st, seat, ctrl, (opts && opts.samples) || 12);
      if (best != null && best.card !== h.card) {
        const same = best.scores.find(x => x.card === h.card);
        if (!same || same.v < best.v - 0.01) return { card: best.card, reason: 'En comptant les cartes qui restent, c\'est la carte qui rapporte le plus de plis à votre camp.', exact: true };
      }
    } catch (e) { /* calcul trop long : on garde le choix habituel */ }
  }
  return h;
}
function heuristicCard(st, seat, ctrl, isDecl, leg) {
  if (!st.trick.length) {
    if (isDecl) return declarerLead(st, seat);
    if (!st.tricks.length && !st.shown) return openingLead(st, seat);
    return defenderLead(st, seat);
  }
  return follow(st, seat, ctrl, isDecl, leg);
}

/* ----- Entame (fiche « Jeu de la carte », jeu en défense) ----- */
function suitsBidBy(st, side) {
  const r = [];
  if (!st.auction) return r;
  st.auction.forEach((c, i) => {
    const seat = (st.dealer + i) % 4;
    if (sideOf(seat) === side && /^[1-7][CDHS]$/.test(c)) { const s = DEN_SUIT[c[1]]; if (!r.includes(s)) r.push(s); }
  });
  return r;
}
function partnerSuits(st, seat) {
  const r = [];
  if (!st.auction) return r;
  const p = partnerOf(seat);
  st.auction.forEach((c, i) => {
    if ((st.dealer + i) % 4 === p && /^[1-7][CDHS]$/.test(c)) {
      const s = DEN_SUIT[c[1]];
      const m = B.explain ? B.explain(st.auction, st.dealer, i) : null;
      if ((!m || m.len[s][0] >= 4) && !r.includes(s)) r.push(s);
    }
  });
  return r;
}
function seqTop(cards) {
  // cards triés du plus fort au plus faible ; renvoie la tête de séquence d'honneurs si elle existe
  const r = cards.map(rankOf);
  if (r.length >= 2 && r[0] >= 9 && r[1] === r[0] - 1 && (r.length === 2 || r[2] === r[0] - 2 || r[2] === r[0] - 3)) return cards[0];
  return null;
}
function leadCardIn(cards, trumpGame) {
  // cards = cartes d'une couleur, triées décroissant
  const r = cards.map(rankOf);
  if (cards.length === 1) return { card: cards[0], how: 'le singleton' };
  if (r[0] === 12 && r[1] === 11) return { card: cards[0], how: 'l\'As (de As-Roi)' };
  const sq = seqTop(cards);
  if (sq != null) return { card: sq, how: 'la tête de séquence' };
  if (cards.length === 2) return { card: cards[0], how: 'la plus forte de deux cartes' };
  if (r[0] >= 9) {
    if (cards.length >= 4) return { card: cards[3], how: 'la 4ème meilleure' };
    return { card: cards[cards.length - 1], how: 'la plus petite (sous un honneur)' };
  }
  return { card: cards[0], how: 'la plus forte de petites cartes' };
}
function openingLead(st, seat) {
  const h = st.hands[seat], tr = st.trump;
  const opp = suitsBidBy(st, 1 - sideOf(seat));
  const ps = partnerSuits(st, seat);
  const suits = [0, 1, 2, 3].map(s => inSuit(h, s));
  const mk = (s, why) => { const x = leadCardIn(suits[s], tr >= 0); return { card: x.card, reason: `Entame ${tr < 0 ? 'à Sans-Atout' : 'à l\'atout'} : ${why}. On joue ${x.how} (${cardTxt(x.card)}).` }; };
  if (tr < 0) {
    for (const s of ps) if (suits[s].length) return mk(s, `la couleur annoncée par votre partenaire (${SUIT_NAME[s]})`);
    const long = [0, 1, 2, 3].filter(s => suits[s].length >= 4 && rankOf(suits[s][0]) >= 9 && !opp.includes(s))
      .sort((a, b) => suits[b].length - suits[a].length || (a <= 1 ? -1 : 1) - (b <= 1 ? -1 : 1) || rankOf(suits[b][0]) - rankOf(suits[a][0]));
    if (long.length) return mk(long[0], `votre plus longue couleur, commandée par un honneur et non annoncée par l'adversaire (${SUIT_NAME[long[0]]})`);
    const ak = [0, 1, 2, 3].filter(s => suits[s].length >= 3 && rankOf(suits[s][0]) === 12 && rankOf(suits[s][1]) === 11 && !opp.includes(s));
    if (ak.length) return mk(ak[0], 'une couleur commandée par As-Roi');
    const seqS = [0, 1, 2, 3].filter(s => seqTop(suits[s]) != null && !opp.includes(s));
    if (seqS.length) return mk(seqS[0], 'une séquence d\'honneurs');
    const green = [0, 1, 2, 3].filter(s => suits[s].length >= 3 && !opp.includes(s)).sort((a, b) => suits[b].length - suits[a].length);
    if (green.length) return mk(green[0], `une couleur non citée par l'adversaire (${SUIT_NAME[green[0]]})`);
  } else {
    const ak = [0, 1, 2, 3].filter(s => s !== tr && suits[s].length >= 2 && rankOf(suits[s][0]) === 12 && rankOf(suits[s][1]) === 11);
    if (ak.length) return mk(ak[0], 'une couleur commandée par As-Roi');
    const single = [0, 1, 2, 3].filter(s => s !== tr && suits[s].length === 1 && rankOf(suits[s][0]) < 12 && suits[tr].length >= 1 && suits[tr].length <= 3);
    if (single.length) return mk(single[0], 'un singleton, pour couper ensuite');
    for (const s of ps) if (s !== tr && suits[s].length && !(rankOf(suits[s][0]) === 12 && suits[s].length >= 2 && rankOf(suits[s][1]) !== 11)) return mk(s, `la couleur de votre partenaire (${SUIT_NAME[s]})`);
    const seqS = [0, 1, 2, 3].filter(s => s !== tr && seqTop(suits[s]) != null);
    if (seqS.length) return mk(seqS[0], 'une séquence d\'honneurs');
    const neutral = [0, 1, 2, 3].filter(s => s !== tr && suits[s].length >= 3 && rankOf(suits[s][0]) < 9 && !opp.includes(s));
    if (neutral.length) return mk(neutral[0], 'une couleur « neutre » de 3 ou 4 cartes sans honneur');
    const safe = [0, 1, 2, 3].filter(s => s !== tr && suits[s].length >= 2 && rankOf(suits[s][0]) !== 12 && !opp.includes(s))
      .sort((a, b) => rankOf(suits[a][0]) - rankOf(suits[b][0]));
    if (safe.length) return mk(safe[0], 'la couleur la moins dangereuse');
  }
  const any = [0, 1, 2, 3].filter(s => suits[s].length && s !== tr).sort((a, b) => suits[b].length - suits[a].length);
  const s = any.length ? any[0] : tr;
  return mk(s, 'la couleur la plus sûre');
}

/* ----- Défense : reprise de la main ----- */
function defenderLead(st, seat) {
  const h = st.hands[seat], tr = st.trump, ctrl = seat;
  const dummy = st.dummy, dh = st.hands[dummy];
  const defNeed = 14 - st.need - st.won[sideOf(seat)];
  // 1) Encaisser les levées maîtresses si elles font chuter le contrat
  const masters = h.filter(c => isMaster(st, ctrl, c) && (tr < 0 || suitOf(c) === tr || !declSideCanRuff(st, seat, suitOf(c))));
  if (masters.length >= defNeed && defNeed > 0) {
    const c = masters.sort((a, b) => rankOf(b) - rankOf(a))[0];
    return { card: c, reason: 'Encaissez vos cartes maîtresses : elles suffisent à faire chuter le contrat.' };
  }
  // 2) Rejouer la couleur d'entame du partenaire
  const firstLead = st.tricks[0];
  if (firstLead && firstLead.leader === partnerOf(seat)) {
    const s = suitOf(firstLead.cards[0].card);
    const mine = inSuit(h, s);
    if (mine.length && s !== tr && !(inSuit(dh, s).length && isMaster(st, dummy, inSuit(dh, s)[0]) && dummy !== (seat + 1) % 4 && inSuit(dh, s).length >= 2)) {
      const c = mine.length === 2 || mine.length === 1 ? mine[0] : (isMaster(st, ctrl, mine[0]) ? mine[0] : mine[mine.length - 1]);
      return { card: c, reason: `Rejouez dans la couleur d'entame de votre partenaire (${SUIT_NAME[s]}).` };
    }
  }
  // 3) Ma propre couleur affranchie
  for (let s = 0; s < 4; s++) {
    if (s === tr) continue;
    const mine = inSuit(h, s);
    if (mine.length >= 2 && isMaster(st, ctrl, mine[0]) && !declSideCanRuff(st, seat, s)) return { card: mine[0], reason: `Continuez votre couleur maîtresse (${SUIT_NAME[s]}).` };
  }
  // 4) Couper les coupes du mort : jouer atout
  if (tr >= 0 && inSuit(h, tr).length && inSuit(dh, tr).length) {
    const dl = [0, 1, 2, 3].map(s => inSuit(dh, s).length);
    const decl = st.declarer;
    const shortDummy = [0, 1, 2, 3].some(s => s !== tr && dl[s] <= 1 && inSuit(h, s).length >= 2);
    if (shortDummy && inSuit(dh, tr).length <= 3 && st.tricks.length < 8 && decl !== seat) {
      const t = inSuit(h, tr);
      return { card: t[t.length - 1], reason: 'Jouez atout pour empêcher le mort de couper.' };
    }
  }
  // 5) Selon la position du mort
  const dummyLeft = dummy === (seat + 1) % 4;
  const cand = [0, 1, 2, 3].filter(s => s !== tr && inSuit(h, s).length);
  if (cand.length) {
    const strength = s => inSuit(dh, s).reduce((p, c) => p + Math.max(0, rankOf(c) - 8), 0) + inSuit(dh, s).length * 0.3;
    cand.sort((a, b) => dummyLeft ? strength(b) - strength(a) : strength(a) - strength(b));
    // éviter de jouer sous un As ou dans une fourchette du déclarant visible
    const s = cand.find(x => !(rankOf(inSuit(h, x)[0]) === 12 && inSuit(h, x).length >= 2 && !isMaster(st, ctrl, inSuit(h, x)[0]) )) ?? cand[0];
    const mine = inSuit(h, s);
    const sq = seqTop(mine);
    const c = sq != null ? sq : mine.length <= 2 ? mine[0] : (rankOf(mine[0]) >= 9 ? mine[mine.length - 1] : mine[0]);
    return { card: c, reason: dummyLeft
      ? `Vous jouez avant le mort : jouez dans la couleur forte du mort (${SUIT_NAME[s]}).`
      : `Vous jouez après le mort : jouez dans la couleur faible du mort (${SUIT_NAME[s]}).` };
  }
  const t = inSuit(h, tr);
  return { card: t[t.length - 1], reason: 'Il ne vous reste que des atouts.' };
}
function declSideCanRuff(st, seat, s) {
  if (st.trump < 0) return false;
  const decl = st.declarer, dummy = st.dummy;
  const dh = st.hands[dummy];
  const dummyCan = !inSuit(dh, s).length && inSuit(dh, st.trump).length > 0;
  const declCan = st.voids[decl][s] && !st.voids[decl][st.trump];
  return dummyCan || declCan;
}

/* ----- Déclarant : entame d'un pli ----- */
function suitInfo(st, s, a, b) {
  // a = main qui joue, b = main du partenaire (toutes deux visibles pour le déclarant)
  const A = inSuit(st.hands[a], s), Bc = inSuit(st.hands[b], s);
  const ours = A.concat(Bc).sort((x, y) => rankOf(y) - rankOf(x));
  const out = hiddenCards(st, st.declarer).filter(c => suitOf(c) === s).sort((x, y) => rankOf(y) - rankOf(x));
  const outMax = out.length ? rankOf(out[0]) : -1;
  const tops = ours.filter(c => rankOf(c) > outMax).length;
  const maxLen = Math.max(A.length, Bc.length);
  let win = out.length === 0 ? maxLen : Math.min(tops, maxLen);
  if (out.length && tops >= Math.ceil(out.length / 2)) win += Math.max(0, maxLen - tops);
  return { A, B: Bc, ours, out, tops, maxLen, win: Math.min(win, maxLen) };
}
function declarerLead(st, seat) {
  const pa = partnerOf(seat), tr = st.trump;
  const needed = st.need - declTricks(st);
  const info = [0, 1, 2, 3].map(s => suitInfo(st, s, seat, pa));
  const me = st.hands[seat];
  const hand = seat === st.dummy ? 'du mort' : 'de votre main';
  // 1) Faire tomber les atouts adverses
  if (tr >= 0) {
    const I = info[tr];
    const ourTr = I.A.length + I.B.length;
    if (I.out.length > 0 && ourTr > I.out.length) {
      const ruffNeeded = needRuffInShort(st, seat, info);
      if (!ruffNeeded) {
        if (I.A.length && isMaster(st, st.declarer, I.A[0])) return { card: I.A[0], reason: 'Jouez atout dès la prise de la main pour faire tomber les atouts adverses (fiche Jeu de la carte).' };
        if (I.A.length) {
          const toward = I.B.length && isMaster(st, st.declarer, I.B[0]);
          const c = toward ? I.A[I.A.length - 1] : (seqTop(I.A) ?? I.A[I.A.length - 1]);
          return { card: c, reason: 'Jouez atout pour faire tomber les atouts adverses.' };
        }
      } else {
        const r = ruffNeeded;
        return { card: r.card, reason: `Avant de jouer atout, faites couper une perdante ${seat === st.dummy ? 'dans votre main' : 'au mort'} (urgence : besoin de la coupe).` };
      }
    }
  }
  // 2) Assez de levées sûres : les encaisser (honneurs de la main courte d'abord)
  const sure = info.reduce((t, x, s) => t + (s === tr || tr < 0 || info[tr].out.length === 0 ? x.win : Math.min(x.win, x.tops)), 0);
  if (sure >= needed) {
    // couleur où la main courte a des honneurs maîtres
    for (let s = 0; s < 4; s++) {
      const x = info[s];
      if (!x.A.length || x.win === 0) continue;
      if (x.A.length <= x.B.length && isMaster(st, st.declarer, x.A[0])) return { card: x.A[0], reason: 'Vous avez assez de levées : encaissez-les, en commençant par les honneurs de la main courte.' };
    }
    for (let s = 0; s < 4; s++) {
      const x = info[s];
      if (!x.A.length || x.win === 0) continue;
      if (isMaster(st, st.declarer, x.A[0])) return { card: x.A[0], reason: 'Encaissez vos levées maîtresses.' };
      if (x.B.length && isMaster(st, st.declarer, x.B[0])) return { card: x.A[x.A.length - 1], reason: 'Allez au partenaire pour encaisser ses levées maîtresses.' };
    }
  }
  // 3) Coupe au mort (contrat à l'atout)
  if (tr >= 0) {
    const r = ruffInShort(st, seat, info);
    if (r) return r;
  }
  // 4) Affranchir une couleur : impasse ou chasse des honneurs adverses
  const cands = [0, 1, 2, 3].filter(s => s !== tr && info[s].A.length && info[s].out.length && info[s].tops < info[s].maxLen)
    .sort((a, b) => (info[b].ours.length - info[a].ours.length) || (info[b].tops - info[a].tops));
  for (const s of cands) {
    const x = info[s];
    // fourchette chez le partenaire (As-Dame, Roi-Valet...) et petite carte dans ma main : jouer vers elle
    if (x.B.length >= 2 && hasTenace(st, x.B) && rankOf(x.A[x.A.length - 1]) < rankOf(x.B[1])) {
      return { card: x.A[x.A.length - 1], reason: `Impasse : jouez une petite carte vers les honneurs groupés ${seat === st.dummy ? 'de votre main' : 'du mort'} (${SUIT_NAME[s]}).` };
    }
    const sq = seqTop(x.A);
    if (sq != null) return { card: sq, reason: `Affranchissez la couleur à ${SUIT_NAME[s]} : jouez la tête de séquence pour chasser l'honneur adverse.` };
    if (x.A.length >= x.B.length && x.ours.length >= 7 && x.B.length && rankOf(x.B[0]) >= 9 && !isMaster(st, st.declarer, x.A[0]))
      return { card: x.A[x.A.length - 1], reason: `Affranchissez votre couleur longue (${SUIT_NAME[s]}) : jouez vers les honneurs ${seat === st.dummy ? 'de votre main' : 'du mort'}.` };
  }
  // 5) Encaisser une carte maîtresse, ou aller chez le partenaire encaisser les siennes
  const trumpsGone = tr < 0 || info[tr].out.length === 0;
  for (let s = 0; s < 4; s++) if (info[s].A.length && isMaster(st, st.declarer, info[s].A[0]) && (s === tr || trumpsGone) && info[s].A.length <= Math.max(1, info[s].B.length)) return { card: info[s].A[0], reason: 'Encaissez d\'abord les honneurs de la main courte.' };
  const toPartner = [0, 1, 2, 3].filter(s => info[s].A.length && info[s].B.length && (s === tr || trumpsGone))
    .map(s => ({ s, n: info[s].B.filter(c => isMaster(st, st.declarer, c)).length - (isMaster(st, st.declarer, info[s].A[0]) ? 0 : 0) }))
    .filter(x => x.n > 0 && !isMaster(st, st.declarer, info[x.s].A[0])).sort((a, b) => b.n - a.n);
  if (toPartner.length) { const x = info[toPartner[0].s]; return { card: x.A[x.A.length - 1], reason: `Allez ${seat === st.dummy ? 'dans votre main' : 'au mort'} pour encaisser ses levées maîtresses (${SUIT_NAME[toPartner[0].s]}).` }; }
  for (let s = 0; s < 4; s++) if (info[s].A.length && isMaster(st, st.declarer, info[s].A[0]) && (s === tr || trumpsGone)) return { card: info[s].A[0], reason: 'Encaissez une levée maîtresse.' };
  const ls = [0, 1, 2, 3].filter(s => info[s].A.length).sort((a, b) => (a === tr) - (b === tr) || info[b].ours.length - info[a].ours.length);
  const x = info[ls[0]];
  return { card: x.A[x.A.length - 1], reason: `Jouez une petite carte ${hand} dans votre couleur la plus longue.` };
}
function hasTenace(st, cards) {
  // ex. As-Dame, Roi-Valet, As-Valet-10 : un honneur, puis un trou occupé par une carte cachée
  const gone = new Set(playedCards(st));
  const r = cards.map(rankOf);
  if (r[0] < 10) return false;
  for (let i = 0; i + 1 < r.length && r[i] >= 9; i++) {
    if (r[i + 1] < r[i] - 1) {
      for (let k = r[i] - 1; k > r[i + 1]; k--) if (!gone.has(suitOf(cards[0]) * 13 + k)) return r[i + 1] >= 8;
    }
  }
  return false;
}
// Faut-il couper dans la main courte avant de jouer atout ?
function needRuffInShort(st, seat, info) {
  const tr = st.trump;
  const pa = partnerOf(seat);
  const myTr = info[tr].A.length, paTr = info[tr].B.length;
  if (paTr === 0 || paTr >= myTr) return null;
  for (let s = 0; s < 4; s++) {
    if (s === tr) continue;
    const x = info[s];
    if (x.B.length === 0 && x.A.length > 0 && x.tops < x.A.length && paTr <= 3) {
      const c = x.A[x.A.length - 1];
      if (!isMaster(st, st.declarer, c)) return { card: c };
    }
  }
  void pa;
  return null;
}
function ruffInShort(st, seat, info) {
  const tr = st.trump;
  const paTr = info[tr].B.length;
  if (!paTr) return null;
  for (let s = 0; s < 4; s++) {
    if (s === tr) continue;
    const x = info[s];
    if (x.B.length === 0 && x.A.length > 0 && !isMaster(st, st.declarer, x.A[x.A.length - 1])) {
      return { card: x.A[x.A.length - 1], reason: `Coupez une carte perdante ${seat === st.dummy ? 'dans votre main' : 'avec les atouts du mort'} (${SUIT_NAME[s]}).` };
    }
  }
  return null;
}

/* ----- Fournir à un pli ----- */
function follow(st, seat, ctrl, isDecl, leg) {
  const tr = st.trump, trick = st.trick, pos = trick.length;
  const ls = suitOf(trick[0].card);
  const cw = currentWinner(trick, tr);
  const partnerWinning = sideOf(cw.seat) === sideOf(seat);
  const hand = st.hands[seat];
  const canFollow = suitOf(leg[0]) === ls;
  const fourth = (seat + 1) % 4;
  const vis = visibleSeats(st, ctrl);
  const fourthVisible = pos === 2 && vis.includes(fourth);
  const beaters = leg.filter(c => beats(c, cw.card, tr, ls));
  if (canFollow) {
    if (pos === 3) {
      if (partnerWinning) return { card: lowest(leg), reason: 'Le pli est déjà gagné par votre camp : fournissez votre plus petite carte.' };
      if (beaters.length) return { card: lowest(beaters), reason: 'Gagnez le pli avec la plus petite carte suffisante.' };
      return { card: lowest(leg), reason: 'Vous ne pouvez pas gagner ce pli : fournissez votre plus petite carte.' };
    }
    if (pos === 1) {
      const led = trick[0].card;
      const leaderVis = vis.includes(trick[0].seat);
      // Honneur sur honneur
      if (rankOf(led) >= 9 && beaters.length && !partnerWinning) {
        const lh = st.hands[trick[0].seat];
        const fromSeq = leaderVis && lh.some(c => suitOf(c) === ls && rankOf(c) === rankOf(led) - 1);
        const cover = lowestEquivalent(st, hand, lowest(beaters));
        if (!fromSeq && (!isDecl || isMaster(st, ctrl, cover))) return { card: cover, reason: 'Honneur sur honneur : couvrez l\'honneur joué.' };
      }
      // Déclarant en 2e position : prendre si une carte maîtresse le permet et qu'on en a besoin
      if (isDecl && beaters.length) {
        const m = beaters.filter(c => isMaster(st, ctrl, c));
        const paHand = st.hands[partnerOf(seat)];
        const paCanWin = paHand.some(c => suitOf(c) === ls && rankOf(c) > rankOf(cw.card) && isMaster(st, ctrl, c));
        if (m.length && !paCanWin && (tr >= 0 || holdUpDone(st, seat, ls))) return { card: lowest(m), reason: 'Prenez le pli avec une carte maîtresse.' };
        if (tr < 0 && m.length && !paCanWin) return { card: lowest(leg), reason: 'Laisser-passer : à Sans-Atout, on ne prend pas tout de suite dans la couleur adverse, pour couper les communications.' };
      }
      return { card: lowest(leg), reason: 'Petite carte en 2ème position.' };
    }
    // 3e position : le partenaire a entamé le pli
    if (partnerWinning) {
      const pc = cw.card;
      let fourthCanBeat;
      if (fourthVisible) fourthCanBeat = st.hands[fourth].some(c => (suitOf(c) === ls && rankOf(c) > rankOf(pc)) || (suitOf(c) === tr && !st.hands[fourth].some(x => suitOf(x) === ls)));
      else fourthCanBeat = !isMaster(st, ctrl, pc);
      if (!fourthCanBeat) return { card: lowest(leg), reason: 'Votre partenaire est maître du pli : fournissez votre plus petite carte.' };
      if (isDecl) {
        // laisser courir un honneur de séquence (impasse) ; sinon prendre avec une maîtresse
        const leaderHand = st.hands[trick[0].seat];
        if (rankOf(pc) >= 9 && leaderHand.some(c => suitOf(c) === ls && rankOf(c) === rankOf(pc) - 1)) return { card: lowest(leg), reason: 'Laissez courir l\'honneur : c\'est une impasse.' };
        const m = leg.filter(c => isMaster(st, ctrl, c) && rankOf(c) > rankOf(pc));
        if (m.length) return { card: lowest(m), reason: 'Assurez le pli avec une carte maîtresse.' };
        return { card: lowest(leg), reason: 'Fournissez une petite carte.' };
      }
      const hi = highest(leg);
      if (rankOf(hi) > rankOf(pc)) return { card: lowestEquivalent(st, hand, hi), reason: 'Plus forte carte en 3ème position (la plus petite de vos cartes équivalentes).' };
      return { card: lowest(leg), reason: 'Fournissez votre plus petite carte.' };
    }
    if (beaters.length) {
      if (fourthVisible) {
        const f4 = st.hands[fourth].filter(c => suitOf(c) === ls);
        const top4 = f4.length ? Math.max(...f4.map(rankOf)) : -1;
        const safe = beaters.filter(c => rankOf(c) > top4);
        if (safe.length) return { card: lowest(safe), reason: 'Gagnez le pli avec la plus petite carte que le joueur suivant ne peut pas battre.' };
        return { card: lowest(beaters), reason: 'Forcez le joueur suivant à mettre un gros honneur.' };
      }
      if (isDecl) {
        const x = finesseChoice(st, seat, ctrl, ls, beaters);
        return x;
      }
      const hi = highest(beaters);
      return { card: lowestEquivalent(st, hand, hi), reason: 'Plus forte carte en 3ème position (la plus petite de vos cartes équivalentes).' };
    }
    return { card: lowest(leg), reason: 'Vous ne pouvez pas gagner ce pli : fournissez votre plus petite carte.' };
  }
  // Impossible de fournir : couper ou défausser
  const trumps = tr >= 0 ? leg.filter(c => suitOf(c) === tr) : [];
  if (trumps.length) {
    let partnerSafe = false;
    if (partnerWinning) {
      if (pos === 3) partnerSafe = true;
      else if (fourthVisible) partnerSafe = !st.hands[fourth].some(c => beats(c, cw.card, tr, ls));
      else partnerSafe = isMaster(st, ctrl, cw.card) && !(st.voids[fourth][ls]);
    }
    if (!partnerSafe) {
      const winR = trumps.filter(c => beats(c, cw.card, tr, ls));
      if (winR.length) {
        let pick = lowest(winR);
        if (pos < 3 && fourthVisible) {
          const f = st.hands[fourth];
          if (!f.some(c => suitOf(c) === ls)) {
            const top4 = Math.max(-1, ...f.filter(c => suitOf(c) === tr).map(rankOf));
            const over = winR.filter(c => rankOf(c) > top4);
            if (over.length) pick = lowest(over);
          }
        }
        return { card: pick, reason: suitOf(cw.card) === tr ? 'Surcoupez pour gagner le pli.' : 'Vous n\'avez plus de cartes dans la couleur demandée : coupez !' };
      }
    }
  }
  return discard(st, seat, ctrl, leg, partnerWinning);
}
function holdUpDone(st, seat, s) {
  // à Sans-Atout, après un tour de laisser-passer on prend
  let rounds = 0;
  for (const t of st.tricks) if (suitOf(t.cards[0].card) === s) rounds++;
  return rounds >= 1 || st.hands[seat].filter(c => suitOf(c) === s).length <= 1;
}
function finesseChoice(st, seat, ctrl, ls, beaters) {
  const pa = partnerOf(seat);
  const total = st.orig[seat].filter(c => suitOf(c) === ls).length + st.orig[pa].filter(c => suitOf(c) === ls).length;
  const mine = st.hands[seat];
  const hasA = mine.includes(ls * 13 + 12), hasK = mine.includes(ls * 13 + 11), hasQ = mine.includes(ls * 13 + 10), hasJ = mine.includes(ls * 13 + 9);
  const gone = new Set(playedCards(st));
  const kOut = !hasK && !gone.has(ls * 13 + 11) && !st.hands[pa].includes(ls * 13 + 11);
  const qOut = !hasQ && !gone.has(ls * 13 + 10) && !st.hands[pa].includes(ls * 13 + 10);
  if (hasA && hasQ && kOut && total >= 11) return { card: ls * 13 + 12, reason: 'Avec 11 cartes ou plus dans le camp, jouez l\'As plutôt que l\'impasse au Roi (fiche Jeu de la carte).' };
  if (hasA && hasK && hasJ && qOut && total >= 9) return { card: ls * 13 + 12, reason: 'Avec 9 cartes ou plus dans le camp, jouez l\'As et le Roi plutôt que l\'impasse à la Dame.' };
  const c = lowest(beaters);
  const isFinesse = !isMaster(st, ctrl, c);
  return { card: c, reason: isFinesse ? 'Impasse : fournissez la plus petite carte qui bat celle de l\'adversaire.' : 'Gagnez le pli avec la plus petite carte suffisante.' };
}
function discard(st, seat, ctrl, leg, partnerWinning) {
  const tr = st.trump;
  const h = st.hands[seat];
  const pool = leg.filter(c => suitOf(c) !== tr);
  const use = pool.length ? pool : leg;
  // couleur la moins utile : pas de carte maîtresse, la plus longue sans honneur
  const score = c => {
    const s = suitOf(c);
    const cs = inSuit(h, s);
    let v = rankOf(c);
    if (isMaster(st, ctrl, c)) v += 30;
    if (cs.some(x => rankOf(x) >= 10) && cs.length <= 3) v += 8;
    v -= cs.length * 1.5;
    return v;
  };
  const c = use.slice().sort((a, b) => score(a) - score(b))[0];
  return { card: c, reason: partnerWinning ? 'Votre partenaire gagne le pli : défaussez une petite carte d\'une couleur sans intérêt.' : 'Défaussez une petite carte d\'une couleur sans intérêt.' };
}

/* ---------- Fin de coup : échantillons de donnes compatibles + calcul exact ---------- */
function sampleHidden(st, ctrl, rnd) {
  const vis = visibleSeats(st, ctrl);
  const hidden = [0, 1, 2, 3].filter(s => !vis.includes(s));
  const pool = [];
  for (const s of hidden) pool.push(...st.hands[s]);
  const need = hidden.map(s => st.hands[s].length);
  for (let tries = 0; tries < 30; tries++) {
    const cards = B.shuffle(pool.slice(), rnd);
    const res = hidden.map(() => []);
    let ok = true;
    for (const c of cards) {
      const cand = hidden.map((s, i) => i).filter(i => res[i].length < need[i] && !st.voids[hidden[i]][suitOf(c)]);
      if (!cand.length) { ok = false; break; }
      // remplir d'abord la main qui a le moins de choix
      const i = cand[Math.floor((rnd || Math.random)() * cand.length)];
      res[i].push(c);
    }
    if (ok) { const hands = st.hands.map(h => h.slice()); hidden.forEach((s, i) => { hands[s] = res[i]; }); return hands; }
  }
  return null;
}
function endgameCard(st, seat, ctrl, samples) {
  const side = sideOf(seat);
  const leg = legalCards(st, seat);
  const tot = new Map(leg.map(c => [c, 0]));
  let n = 0;
  const vis = visibleSeats(st, ctrl);
  const allVisible = [0, 1, 2, 3].every(s => vis.includes(s) || !st.hands[s].length);
  const S = allVisible ? 1 : samples;
  for (let k = 0; k < S; k++) {
    const hands = allVisible ? st.hands.map(h => h.slice()) : sampleHidden(st, ctrl);
    if (!hands) continue;
    const ev = B.dd.evalMoves(hands, st.trump, st.trick, seat, { maxNodes: 300000 });
    for (const x of ev) tot.set(x.card, tot.get(x.card) + (side === 0 ? x.ns : st.hands[seat].length - x.ns));
    n++;
  }
  if (!n) return null;
  const scores = leg.map(c => ({ card: c, v: tot.get(c) / n }));
  // à valeur égale, la plus petite carte
  scores.sort((a, b) => b.v - a.v || rankOf(a.card) - rankOf(b.card));
  return { card: scores[0].card, v: scores[0].v, scores };
}

/* ---------- Réclamation : calcul exact quand il reste peu de cartes ---------- */
function ddMax(st) {
  // nombre maximal de plis que le camp du déclarant peut encore faire (jeu à cartes ouvertes)
  const side = sideOf(st.declarer);
  const hands = st.hands.map(h => h.slice());
  const trump = st.trump;
  let nodes = 0;
  function moves(seat, trick) {
    const h = hands[seat];
    let f = h;
    if (trick.length) { const ls = suitOf(trick[0].card); const ff = h.filter(c => suitOf(c) === ls); if (ff.length) f = ff; }
    // réduire les cartes équivalentes (consécutives dans la même main)
    const out = [];
    const sorted = f.slice().sort((a, b) => a - b);
    for (let i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] === sorted[i - 1] + 1 && suitOf(sorted[i]) === suitOf(sorted[i - 1])) continue;
      out.push(sorted[i]);
    }
    return out;
  }
  function search(leader, trick, turn, alpha, beta) {
    nodes++;
    if (nodes > 400000) throw new Error('trop long');
    if (hands.every(h => !h.length) && !trick.length) return 0;
    const maxSide = sideOf(turn) === side;
    let best = maxSide ? -1 : 99;
    for (const c of moves(turn, trick)) {
      hands[turn] = hands[turn].filter(x => x !== c);
      const t2 = trick.concat([{ seat: turn, card: c }]);
      let v;
      if (t2.length === 4) {
        const w = currentWinner(t2, trump).seat;
        v = (sideOf(w) === side ? 1 : 0) + search(w, [], w, alpha - (sideOf(w) === side ? 1 : 0), beta - (sideOf(w) === side ? 1 : 0));
      } else v = search(leader, t2, (turn + 1) % 4, alpha, beta);
      hands[turn].push(c);
      if (maxSide) { if (v > best) best = v; if (best > alpha) alpha = best; }
      else { if (v < best) best = v; if (best < beta) beta = best; }
      if (alpha >= beta) break;
    }
    return best;
  }
  return search(st.trick.length ? st.trick[0].seat : st.leader, st.trick.slice(), st.turn, -1, 99);
}
function claimCheck(st) {
  const left = Math.max(...st.hands.map(h => h.length));
  const cards = st.hands.reduce((n, h) => n + h.length, 0);
  if (B.dd && st.trick.length === 0 && left <= 8) {
    try { const r = B.dd.solve(st.hands, st.trump, st.leader, { maxNodes: 2e6 }).ns; const mine = sideOf(st.declarer) === 0 ? r : left - r; return mine >= left; } catch (e) { /* trop long */ }
  }
  if (cards <= 24) {
    try { return ddMax(st) >= left; } catch (e) { /* trop long : test simple */ }
  }
  // test simple : toutes les cartes du camp du déclarant sont maîtresses et l'adversaire n'a plus d'atout
  const decl = st.declarer, dummy = st.dummy;
  const opp = [(decl + 1) % 4, (decl + 3) % 4];
  if (st.trump >= 0 && opp.some(s => st.hands[s].some(c => suitOf(c) === st.trump))) return false;
  const ours = st.hands[decl].concat(st.hands[dummy]);
  return [0, 1, 2, 3].every(s => {
    const mine = Math.max(st.hands[decl].filter(c => suitOf(c) === s).length, st.hands[dummy].filter(c => suitOf(c) === s).length);
    const tops = ours.filter(c => suitOf(c) === s && isMaster(st, decl, c)).length;
    return mine === 0 || tops >= mine;
  }) && st.trick.length === 0;
}

Object.assign(B, { newPlay, cloneState, legalCards, playCard, currentWinner, chooseCard, claimCheck, ddMax, dummyShown, beatsCard: beats });
})();
