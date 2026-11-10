/* Bridge — système d'enchères des robots, calé sur les fiches du cours (Majeure 5e, 1SA 15-17,
   Stayman, Texas, 2 faibles, 2♣ fort indéterminé, 2♦ forcing de manche, barrages, interventions,
   réponses au contre d'appel, Blackwood 5 clés). Chaque enchère porte son « sens » (points,
   longueurs, forcing, texte, fiche du cours) : c'est ce qu'affiche l'explication. */
var B = globalThis.B = globalThis.B || {};
(function () {
'use strict';
const {
  SUIT_SYM, SUIT_NAME, SUIT_PL, SEAT_NAME, DEN, DEN_SUIT, SUIT_DEN, suitOf, rankOf, partnerOf, sideOf,
  lens, hcp, HL, HLD, isRegular, ranksIn, honors, bigHonors, stopper, stopper15, robust, aces, kings,
  isBid, levelOf, denOf, bidRank, callTxt, auctionState, isLegal,
} = B;

const FICHES = {
  '01': 'Principes du jeu', '02': 'Ouvertures, échelle des points', '03': '1ère réponse à l\'ouvreur',
  '04': '1ère réponse à l\'ouvreur, page 2 bis', '05': '2ème enchère de l\'ouvreur',
  '06': 'Ouvertures faibles 2♥ ou 2♠', '07': 'Ouvertures fortes, tableau', '08': 'Ouvertures fortes, résumé',
  '09': 'Jeu de la carte', '10': 'Interventions en 2ème position', '11': 'Ouverture 1 SA et Stayman',
  '12': 'Barrages niveaux 3 et 4', '13': 'Réponses au contre d\'intervention',
  '14': 'Après ouverture 1 SA : Stayman et Texas', '15': 'Règle des 9',
};

/* ---------- Sens d'une enchère ---------- */
const ANY = [0, 13];
const SK = { S: 0, H: 1, D: 2, C: 3 };
function ln(o) { const a = [ANY, ANY, ANY, ANY]; for (const k in o) a[SK[k]] = o[k]; return a; }
function M(name, o) {
  o = o || {};
  return {
    name, pts: o.pts || null, unit: o.unit || 'H', len: o.len || [ANY, ANY, ANY, ANY],
    forcing: o.forcing || 0, text: o.text || '', fiche: o.fiche || null, alert: !!o.alert,
    conclusion: !!o.conclusion, invite: !!o.invite,
  };
}
const opt = (call, m, ok) => ({ call, m, ok });
const L = (h, s) => lens(h)[s];
const sym = s => SUIT_SYM[s], nm = s => SUIT_NAME[s], dn = s => SUIT_DEN[s];
const bidOf = (lvl, s) => '' + lvl + (s === 4 ? 'N' : SUIT_DEN[s]);

/* ---------- Contexte d'une enchère ---------- */
function ctx(auction, dealer) {
  const n = auction.length, seat = (dealer + n) % 4, partner = partnerOf(seat);
  const st = auctionState(auction, dealer);
  const calls = auction.map((call, i) => ({ call, seat: (dealer + i) % 4, i }));
  const openIdx = auction.findIndex(isBid);
  const opener = openIdx >= 0 ? (dealer + openIdx) % 4 : -1;
  const seq = openIdx >= 0 ? auction.slice(openIdx) : [];
  let role;
  if (openIdx < 0) role = 'open';
  else if (opener === seat) role = 'opener';
  else if (opener === partner) role = 'responder';
  else role = 'defender';
  const mine = calls.filter(x => x.seat === seat);
  const part = calls.filter(x => x.seat === partner);
  const ourActive = calls.some(x => sideOf(x.seat) === sideOf(seat) && x.call !== 'P');
  // main « passée » : j'ai passé avant l'ouverture
  const passedHand = openIdx >= 0 && mine.some(x => x.i < openIdx);
  return { auction, dealer, n, seat, partner, st, calls, openIdx, opener, seq, s: seq.join(' '), role, mine, part, ourActive, passedHand };
}
// Enchère la moins chère dans la dénomination d ('C','D','H','S','N')
function cheapest(c, d) {
  const lb = c.st.lastBid;
  if (!lb) return '1' + d;
  const lvl = levelOf(lb) + (DEN.indexOf(d) <= DEN.indexOf(denOf(lb)) ? 1 : 0);
  return lvl <= 7 ? lvl + d : null;
}
function natSuitsOf(c, side) {
  const r = [];
  for (const x of c.calls) if (sideOf(x.seat) === side && isBid(x.call) && denOf(x.call) !== 'N') {
    const s = DEN_SUIT[denOf(x.call)];
    if (!r.includes(s)) r.push(s);
  }
  return r;
}

/* ---------- Mémoire des explications ---------- */
const memo = new Map();
function explainAt(auction, dealer, i) {
  const key = dealer + ':' + auction.slice(0, i + 1).join(' ');
  if (memo.has(key)) return memo.get(key);
  if (memo.size > 5000) memo.clear();
  const c = ctx(auction.slice(0, i), dealer);
  const call = auction[i];
  let m = null;
  const opts = systemOptions(c);
  if (opts) { const o = opts.find(o => o.call === call); if (o) m = o.m; }
  if (!m) m = genericMeaning(c, call);
  memo.set(key, m);
  return m;
}
// Ce que le joueur `seat` a montré jusqu'ici (intersection des sens de ses enchères)
function summarize(c, seat) {
  let min = 0, max = 37, passed = false;
  const len = [[0, 13], [0, 13], [0, 13], [0, 13]];
  let lastForcing = 0, lastIdx = -1, gf = false;
  for (const x of c.calls) {
    if (x.seat !== seat) continue;
    const m = explainAt(c.auction, c.dealer, x.i);
    if (x.call === 'P') passed = true; else { lastForcing = m.forcing; lastIdx = x.i; }
    if (m.forcing === 2) gf = true;
    if (m.pts) {
      const a = Math.max(min, m.pts[0]), b = Math.min(max, m.pts[1]);
      if (a <= b) { min = a; max = b; } else { min = m.pts[0]; max = m.pts[1]; }
    }
    for (let s = 0; s < 4; s++) {
      const r = m.len[s];
      const a = Math.max(len[s][0], r[0]), b = Math.min(len[s][1], r[1]);
      if (a <= b) len[s] = [a, b];
    }
  }
  if (max >= 37 && passed) max = 12;
  return { min, max, len, lastForcing, lastIdx, gf, passed };
}

/* ====================================================================
   OUVERTURES (fiche 02, 06, 07, 12)
   ==================================================================== */
function canOpen1(h) { return (hcp(h) >= 12 || HL(h) >= 13) && HL(h) <= 23; }
const noMaj5 = h => L(h, 0) < 5 && L(h, 1) < 5;
function bestOpening1(h) {
  const l = lens(h);
  if (l[0] >= 5 && l[0] >= l[1]) return '1S';
  if (l[1] >= 5) return '1H';
  if (l[2] > l[3]) return '1D';
  if (l[3] > l[2]) return '1C';
  return l[2] === 3 ? '1C' : '1D';
}
function strong2C(h) {
  const hc = hcp(h), hl = HL(h), l = lens(h);
  if (isRegular(h) && hc >= 22 && hc <= 23) return true;
  if (hl < 20 || hl > 23 || (isRegular(h) && hc <= 21)) return false;
  for (const s of [0, 1]) if (l[s] >= 7 || (l[s] >= 6 && honors(h, s) >= 3)) return true;
  for (const s of [2, 3]) if (l[s] >= 7 && honors(h, s) >= 2) return true;
  return l[0] >= 5 && l[1] >= 5;
}
function weak2ok(h, s) {
  const l = lens(h), om = s === 0 ? 1 : 0;
  if (l[s] !== 6 || hcp(h) < 6 || hcp(h) > 10 || !robust(h, s)) return false;
  if (l[om] >= 4 || l[2] >= 5 || l[3] >= 5 || aces(h) >= 2) return false;
  let ext = 0;
  for (const c of h) if (suitOf(c) !== s && rankOf(c) >= 11) ext++;
  return ext < 2;
}
function barrageOk(h, s, n) {
  const l = lens(h);
  if (hcp(h) < 6 || hcp(h) > 10) return false;
  if (n === 7 ? l[s] !== 7 : l[s] < 8) return false;
  for (let m = 0; m < 2; m++) if (m !== s && l[m] >= 4) return false;
  if (aces(h) >= 2) return false;
  let extBig = 0;
  for (const c of h) if (suitOf(c) !== s && rankOf(c) >= 11) extBig++;
  if (extBig > 1) return false;
  if (n === 7 && s >= 2 && bigHonors(h, s) === 3) return false;
  return true;
}
const REG_LEN = ln({ S: [2, 4], H: [2, 4], D: [2, 5], C: [2, 5] });

function openingOpts(c) {
  const fourth = c.n === 3;
  const o = [];
  o.push(opt('2D', M('Ouverture 2♦ « forcing de manche »', { pts: [24, 37], unit: 'HL', forcing: 2, alert: true, fiche: '07',
    text: 'Main très forte : au moins 24 points HL, toutes distributions. Le partenaire doit répondre en indiquant ses As.' }), h => HL(h) >= 24));
  o.push(opt('2C', M('Ouverture 2♣ « fort indéterminé »', { pts: [20, 23], unit: 'HL', forcing: 1, alert: true, fiche: '07',
    text: '20 à 23 points HL avec une couleur forte (Majeure de 6 cartes avec 3 honneurs, Mineure de 7 cartes, ou bicolore Majeur 5-5), ou bien 22-23 points H en main régulière. Le partenaire répond 2♦ dans presque tous les cas.' }), strong2C));
  o.push(opt('2N', M('Ouverture 2SA', { pts: [20, 21], unit: 'H', len: REG_LEN, fiche: '07',
    text: '20 ou 21 points H, main régulière, sans Majeure de 5 cartes.' }), h => isRegular(h) && hcp(h) >= 20 && hcp(h) <= 21 && noMaj5(h)));
  o.push(opt('1N', M('Ouverture 1SA', { pts: [15, 17], unit: 'H', len: REG_LEN, fiche: '02',
    text: '15, 16 ou 17 points H, main régulière (4-3-3-3, 4-4-3-2 ou 5-3-3-2), sans Majeure de 5 cartes.' }), h => isRegular(h) && hcp(h) >= 15 && hcp(h) <= 17 && noMaj5(h)));
  o.push(opt('1S', M('Ouverture 1♠', { pts: [12, 23], unit: 'HL', len: ln({ S: [5, 13] }), fiche: '02',
    text: '12 à 23 points HL avec au moins 5 piques (Majeure 5e, prioritaire).' }), h => canOpen1(h) && bestOpening1(h) === '1S'));
  o.push(opt('1H', M('Ouverture 1♥', { pts: [12, 23], unit: 'HL', len: ln({ H: [5, 13], S: [0, 5] }), fiche: '02',
    text: '12 à 23 points HL avec au moins 5 cœurs (Majeure 5e).' }), h => canOpen1(h) && bestOpening1(h) === '1H'));
  o.push(opt('1D', M('Ouverture 1♦', { pts: [12, 23], unit: 'HL', len: ln({ S: [0, 4], H: [0, 4], D: [3, 13] }), fiche: '02',
    text: '12 à 23 points HL sans Majeure de 5 cartes : meilleure Mineure (avec 4-4 en Mineures, on ouvre 1♦).' }), h => canOpen1(h) && bestOpening1(h) === '1D'));
  o.push(opt('1C', M('Ouverture 1♣', { pts: [12, 23], unit: 'HL', len: ln({ S: [0, 4], H: [0, 4], C: [3, 13] }), fiche: '02',
    text: '12 à 23 points HL sans Majeure de 5 cartes : meilleure Mineure (avec 3-3 en Mineures, on ouvre 1♣).' }), h => canOpen1(h) && bestOpening1(h) === '1C'));
  if (!fourth) {
    for (const s of [1, 0]) o.push(opt('2' + dn(s), M('Ouverture 2' + sym(s) + ' « faible »', {
      pts: [6, 10], unit: 'H', len: ln({ [dn(s)]: [6, 6], [dn(1 - s)]: [0, 3] }), alert: true, fiche: '06',
      text: `6 à 10 points H avec une belle couleur de 6 cartes à ${nm(s)} (honneurs liés). Pas 4 cartes dans l'autre Majeure, pas 2 As.` }),
      h => !canOpen1(h) && weak2ok(h, s)));
    for (const s of [0, 1, 2, 3]) {
      o.push(opt('4' + dn(s), M('Barrage à 4' + sym(s), { pts: [6, 10], unit: 'H', len: ln({ [dn(s)]: [8, 13] }), fiche: '12',
        text: `Barrage : au moins 8 cartes à ${nm(s)}, jeu faible (6 à 10 points H). Pour gêner les adversaires.` }), h => !canOpen1(h) && barrageOk(h, s, 8)));
      o.push(opt('3' + dn(s), M('Barrage à 3' + sym(s), { pts: [6, 10], unit: 'H', len: ln({ [dn(s)]: [7, 7] }), fiche: '12',
        text: `Barrage : 7 cartes à ${nm(s)}, jeu faible (6 à 10 points H). Pour gêner les adversaires.` }), h => !canOpen1(h) && barrageOk(h, s, 7)));
    }
  }
  o.push(opt('P', M('Passe', { pts: [0, 12], unit: 'HL', fiche: '02',
    text: 'Pas assez de points pour ouvrir (il faut 12 points H, ou 13 points HL).' }), () => true));
  return o;
}

/* ====================================================================
   1ère RÉPONSE (fiches 03, 04, 06, 07, 11, 12)
   ==================================================================== */
function best2Level(h, os) {
  const l = lens(h);
  const cand = [3, 2, 1].filter(s => s !== os && !(s === 1 && os !== 0) && l[s] >= (s === 1 ? 5 : 4));
  if (!cand.length) return null;
  cand.sort((a, b) => l[b] - l[a] || (l[a] >= 5 ? a - b : b - a));
  return dn(cand[0]);
}
function blackwoodM(trumpS) {
  return M('Blackwood (5 clés)', { forcing: 1, alert: true, fiche: '08',
    text: 'Demande au partenaire combien il a de « clés » : les 4 As et le Roi d\'atout' + (trumpS >= 0 ? ` (atout ${nm(trumpS)})` : '') +
      '. Réponses : 5♣ = 0 ou 3 clés, 5♦ = 1 ou 4, 5♥ = 2 sans la Dame d\'atout, 5♠ = 2 avec la Dame.' });
}

function respMajor(c) {
  const d = c.seq[0][1], s = DEN_SUIT[d];
  const fit = h => L(h, s) >= 3, p = h => HLD(h, s);
  const o = [];
  o.push(opt('4N', blackwoodM(s), h => fit(h) && p(h) >= 19 && !c.passedHand));
  o.push(opt('4' + d, M('Soutien à la manche (+++)', { pts: [13, 18], unit: 'HLD', len: ln({ [d]: [3, 13] }), fiche: '03', conclusion: true,
    text: `Au moins 3 cartes à ${nm(s)} et 13 points HLD ou plus : le camp a de quoi jouer la manche.` }), h => fit(h) && p(h) >= 13));
  o.push(opt('3' + d, M('Soutien à saut (++)', { pts: [11, 12], unit: 'HLD', len: ln({ [d]: [3, 13] }), fiche: '03',
    text: `Au moins 3 cartes à ${nm(s)}, 11 ou 12 points HLD. Proposition de manche : l'ouvreur passe s'il est minimum.` }), h => fit(h) && p(h) >= 11));
  o.push(opt('2' + d, M('Soutien simple (+)', { pts: [6, 10], unit: 'HLD', len: ln({ [d]: [3, 13] }), fiche: '03',
    text: `Au moins 3 cartes à ${nm(s)}, 6 à 10 points HLD.` }), h => fit(h) && p(h) >= 6));
  if (s === 1) o.push(opt('1S', M('Changement de couleur', { pts: [6, 37], unit: 'HL', len: ln({ S: [4, 13], H: [0, 2] }), forcing: 1, fiche: '03',
    text: 'Au moins 4 piques et 6 points HL ou plus, pas de fit à Cœur. Forcing : l\'ouvreur doit reparler.' }), h => !fit(h) && L(h, 0) >= 4 && HL(h) >= 6));
  for (const nd of ['C', 'D', 'H']) {
    if (nd === d || (nd === 'H' && s !== 0)) continue;
    const ns = DEN_SUIT[nd], min = nd === 'H' ? 5 : 4;
    o.push(opt('2' + nd, M('Changement de couleur au palier de 2', { pts: [11, 37], unit: 'HL', len: ln({ [nd]: [min, 13] }), forcing: 1, fiche: '03',
      text: `Au moins ${min} cartes à ${nm(ns)} et 11 points HL ou plus. Forcing : l'ouvreur doit reparler.` }),
      h => !fit(h) && HL(h) >= 11 && best2Level(h, s) === nd));
  }
  const no4S = h => !(s === 1 && L(h, 0) >= 4);
  o.push(opt('3N', M('3SA', { pts: [13, 15], unit: 'H', len: ln({ [d]: [0, 2] }), fiche: '03', conclusion: true,
    text: `13 à 15 points H, main régulière, pas de fit à ${nm(s)}.` }), h => !fit(h) && isRegular(h) && hcp(h) >= 13 && hcp(h) <= 15 && no4S(h)));
  o.push(opt('2N', M('2SA', { pts: [11, 12], unit: 'H', len: ln({ [d]: [0, 2] }), fiche: '03',
    text: `11 ou 12 points H, main régulière, pas de fit à ${nm(s)}. Proposition de manche.` }), h => !fit(h) && isRegular(h) && hcp(h) >= 11 && hcp(h) <= 12 && no4S(h)));
  o.push(opt('1N', M('1SA', { pts: [6, 10], unit: 'HL', len: ln(s === 1 ? { H: [0, 2], S: [0, 3] } : { S: [0, 2] }), fiche: '03',
    text: `6 à 10 points HL, pas de fit à ${nm(s)}` + (s === 1 ? ', pas 4 piques.' : '.') }), h => !fit(h) && HL(h) >= 6 && HL(h) <= 10 && no4S(h)));
  o.push(opt('P', M('Passe', { pts: [0, 5], unit: 'HL', fiche: '03', text: 'Moins de 6 points : pas de réponse.' }), h => (fit(h) ? p(h) : HL(h)) <= 5));
  return o;
}

function respMinor(c) {
  const d = c.seq[0][1], s = DEN_SUIT[d];
  const maj = h => { const l = lens(h); if (l[0] >= 5 && l[0] >= l[1]) return 0; if (l[1] >= 4) return 1; if (l[0] >= 4) return 0; return -1; };
  const noMaj = h => maj(h) < 0;
  const noShort = h => lens(h).every(n => n >= 2);
  const o = [];
  o.push(opt('1H', M('Changement de couleur', { pts: [6, 37], unit: 'HL', len: ln({ H: [4, 13] }), forcing: 1, fiche: '03',
    text: 'Au moins 4 cœurs et 6 points HL ou plus. Forcing : l\'ouvreur doit reparler.' }), h => maj(h) === 1 && HL(h) >= 6));
  o.push(opt('1S', M('Changement de couleur', { pts: [6, 37], unit: 'HL', len: ln({ S: [4, 13] }), forcing: 1, fiche: '03',
    text: 'Au moins 4 piques et 6 points HL ou plus. Forcing : l\'ouvreur doit reparler.' }), h => maj(h) === 0 && HL(h) >= 6));
  if (d === 'C') o.push(opt('1D', M('Changement de couleur', { pts: [6, 37], unit: 'HL', len: ln({ D: [4, 13], H: [0, 3], S: [0, 3] }), forcing: 1, fiche: '03',
    text: 'Au moins 4 carreaux, 6 points HL ou plus, pas de Majeure de 4 cartes. Forcing.' }), h => noMaj(h) && L(h, 2) >= 4 && HL(h) >= 6));
  if (d === 'D') o.push(opt('2C', M('Changement de couleur au palier de 2', { pts: [11, 37], unit: 'HL', len: ln({ C: [4, 13], H: [0, 3], S: [0, 3] }), forcing: 1, fiche: '03',
    text: 'Au moins 4 trèfles (souvent 5), 11 points HL ou plus, pas de Majeure de 4 cartes. Forcing.' }), h => noMaj(h) && L(h, 3) >= 4 && HL(h) >= 11));
  o.push(opt('3N', M('3SA', { pts: [13, 15], unit: 'H', len: ln({ H: [0, 3], S: [0, 3] }), fiche: '03', conclusion: true,
    text: '13 à 15 points H, main régulière, pas de Majeure de 4 cartes.' }), h => noMaj(h) && isRegular(h) && hcp(h) >= 13 && hcp(h) <= 15));
  o.push(opt('2N', M('2SA', { pts: [11, 12], unit: 'H', len: ln({ H: [0, 3], S: [0, 3] }), fiche: '03',
    text: '11 ou 12 points H, main régulière, pas de Majeure de 4 cartes. Proposition de manche.' }), h => noMaj(h) && isRegular(h) && hcp(h) >= 11 && hcp(h) <= 12));
  o.push(opt('1N', M('1SA', { pts: [6, 10], unit: 'HL', len: ln({ H: [0, 3], S: [0, 3] }), fiche: '03',
    text: '6 à 10 points HL, pas de Majeure de 4 cartes.' }), h => noMaj(h) && HL(h) >= 6 && HL(h) <= 10 && noShort(h)));
  o.push(opt('3' + d, M('Soutien à saut (++)', { pts: [11, 12], unit: 'HL', len: ln({ [d]: [5, 13] }), fiche: '03',
    text: `Au moins 5 cartes à ${nm(s)}, 11 ou 12 points. Proposition de manche.` }), h => noMaj(h) && L(h, s) >= 5 && HL(h) >= 11 && HL(h) <= 12));
  o.push(opt('2' + d, M('Soutien simple (+)', { pts: [6, 10], unit: 'HL', len: ln({ [d]: [5, 13] }), fiche: '03',
    text: `Au moins 5 cartes à ${nm(s)}, 6 à 10 points.` }), h => noMaj(h) && L(h, s) >= 5 && HL(h) >= 6 && HL(h) <= 10));
  o.push(opt('1N', null, h => noMaj(h) && HL(h) >= 6 && HL(h) <= 10));
  o[o.length - 1].m = o.find(x => x.call === '1N').m;
  o.push(opt('P', M('Passe', { pts: [0, 5], unit: 'HL', fiche: '03', text: 'Moins de 6 points : pas de réponse.' }), h => HL(h) <= 5));
  return o;
}

function resp1N(c) {
  const o = [];
  const st45 = (h, a) => HL(h) >= 8 && L(h, a) === 5 && L(h, 1 - a) === 4;
  o.push(opt('2H', M('Texas Pique', { pts: [0, 37], unit: 'HL', len: ln({ S: [5, 13] }), forcing: 1, alert: true, fiche: '14',
    text: 'Au moins 5 piques, tous les points possibles. Demande à l\'ouvreur de dire 2♠.' }), h => L(h, 0) >= 5 && L(h, 0) >= L(h, 1) && !st45(h, 0)));
  o.push(opt('2D', M('Texas Cœur', { pts: [0, 37], unit: 'HL', len: ln({ H: [5, 13] }), forcing: 1, alert: true, fiche: '14',
    text: 'Au moins 5 cœurs, tous les points possibles. Demande à l\'ouvreur de dire 2♥.' }), h => L(h, 1) >= 5 && !st45(h, 1)));
  o.push(opt('2C', M('Stayman', { pts: [8, 37], unit: 'HL', forcing: 1, alert: true, fiche: '11',
    text: 'Au moins 8 points HL et une Majeure de 4 cartes (ou 5-4 en Majeures). Demande à l\'ouvreur s\'il a 4 cartes en Majeure.' }),
    h => HL(h) >= 8 && (L(h, 0) === 4 || L(h, 1) === 4) && L(h, 0) <= 5 && L(h, 1) <= 5 && B.shape(h) !== '4333'));
  o.push(opt('2S', M('Texas Trèfle', { pts: [0, 7], unit: 'HL', len: ln({ C: [6, 13] }), forcing: 1, alert: true, fiche: '14',
    text: 'Jeu faible (0 à 7 points) avec au moins 6 trèfles. Demande à l\'ouvreur de dire 3♣.' }),
    h => HL(h) <= 7 && L(h, 3) >= 6 && L(h, 3) >= L(h, 2)));
  o.push(opt('3C', M('Texas Carreau', { pts: [0, 7], unit: 'HL', len: ln({ D: [6, 13] }), forcing: 1, alert: true, fiche: '14',
    text: 'Jeu faible (0 à 7 points) avec au moins 6 carreaux. Demande à l\'ouvreur de dire 3♦.' }),
    h => HL(h) <= 7 && L(h, 2) >= 6));
  o.push(opt('6N', M('Petit chelem à Sans-Atout', { pts: [18, 37], unit: 'H', fiche: '11', conclusion: true, text: '18 points H et plus : le camp a au moins 33 points.' }), h => hcp(h) >= 18));
  o.push(opt('4N', M('Proposition de chelem (quantitatif)', { pts: [15, 17], unit: 'HL', fiche: '11',
    text: '15 à 17 points, pas de Majeure 4e. Avec 17 points, l\'ouvreur répond comme au Blackwood (nombre d\'As) ; sinon il passe.' }), h => HL(h) >= 15));
  o.push(opt('3N', M('3SA', { pts: [10, 14], unit: 'HL', len: ln({ H: [0, 4], S: [0, 4] }), fiche: '11', conclusion: true,
    text: '10 à 14 points HL : conclusion à la manche à Sans-Atout.' }), h => HL(h) >= 10));
  o.push(opt('2N', M('2SA', { pts: [8, 9], unit: 'HL', len: ln({ H: [0, 4], S: [0, 4] }), fiche: '11',
    text: '8 ou 9 points HL. Proposition de manche : l\'ouvreur dit 3SA avec 17 points, sinon il passe.' }), h => HL(h) >= 8));
  o.push(opt('P', M('Passe', { pts: [0, 7], unit: 'HL', fiche: '04', text: 'Moins de 8 points, sans Majeure de 5 cartes ni Mineure de 6 cartes.' }), () => true));
  return o;
}

function resp2N(c) {
  const st45 = (h, a) => L(h, a) === 5 && L(h, 1 - a) === 4;
  return [
    opt('3H', M('Texas Pique', { pts: [4, 37], unit: 'HL', len: ln({ S: [5, 13] }), forcing: 1, alert: true, fiche: '07',
      text: 'Au moins 4 points et 5 piques. Demande à l\'ouvreur de dire 3♠.' }), h => HL(h) >= 4 && L(h, 0) >= 5 && L(h, 0) >= L(h, 1) && !st45(h, 0)),
    opt('3D', M('Texas Cœur', { pts: [4, 37], unit: 'HL', len: ln({ H: [5, 13] }), forcing: 1, alert: true, fiche: '07',
      text: 'Au moins 4 points et 5 cœurs. Demande à l\'ouvreur de dire 3♥.' }), h => HL(h) >= 4 && L(h, 1) >= 5 && !st45(h, 1)),
    opt('3C', M('Stayman', { pts: [5, 37], unit: 'HL', forcing: 1, alert: true, fiche: '07',
      text: 'Au moins 5 points et une Majeure de 4 cartes (ou 5-4). Demande à l\'ouvreur ses Majeures.' }), h => HL(h) >= 5 && (L(h, 0) === 4 || L(h, 1) === 4)),
    opt('4N', M('Proposition de chelem (quantitatif)', { pts: [12, 37], unit: 'H', fiche: '07',
      text: '12 points H et plus, main régulière. L\'ouvreur indique son nombre d\'As.' }), h => hcp(h) >= 12),
    opt('3N', M('3SA', { pts: [5, 11], unit: 'H', fiche: '07', conclusion: true, text: '5 à 11 points H : conclusion à la manche.' }), h => HL(h) >= 5),
    opt('P', M('Passe', { pts: [0, 4], unit: 'HL', fiche: '07', text: 'Moins de 4 ou 5 points : pas de manche.' }), () => true),
  ];
}

function resp2C(c) {
  const o = [];
  for (const s of [1, 0, 3, 2]) o.push(opt((s <= 1 ? '2' : '3') + dn(s), M('Réponse positive naturelle', { pts: [8, 37], unit: 'H', len: ln({ [dn(s)]: [5, 13] }), forcing: 2, fiche: '07',
    text: `Beau jeu avec une belle couleur de 5 cartes à ${nm(s)} : espoir de chelem.` }),
    h => hcp(h) >= 8 && L(h, s) >= 5 && bigHonors(h, s) >= 2 && [0, 1, 2, 3].every(t => L(h, t) < L(h, s) || t === s || (L(h, t) === L(h, s) && t > s))));
  o.push(opt('2D', M('Réponse relais', { forcing: 1, alert: true, fiche: '07',
    text: 'Réponse conventionnelle, quel que soit le nombre de points : elle laisse l\'ouvreur décrire sa main.' }), () => true));
  return o;
}

function resp2D(c) {
  const majAce = h => [0, 1].some(s => h.includes(B.card(s, 12)));
  return [
    opt('3N', M('Réponse : 2 As', { fiche: '07', alert: true, forcing: 2, text: 'Le répondant possède 2 As.' }), h => aces(h) >= 2),
    opt('2S', M('Réponse : 1 As en Majeure', { fiche: '07', alert: true, forcing: 2, text: 'Le répondant possède un As à Cœur ou à Pique.' }), h => aces(h) === 1 && majAce(h)),
    opt('3C', M('Réponse : l\'As de Trèfle', { fiche: '07', alert: true, forcing: 2, text: 'Le répondant possède l\'As de Trèfle.' }), h => aces(h) === 1 && h.includes(B.card(3, 12))),
    opt('3D', M('Réponse : l\'As de Carreau', { fiche: '07', alert: true, forcing: 2, text: 'Le répondant possède l\'As de Carreau.' }), h => aces(h) === 1 && h.includes(B.card(2, 12))),
    opt('2N', M('Réponse : pas d\'As, 8 points H ou plus (ou 2 Rois)', { pts: [8, 37], unit: 'H', fiche: '07', alert: true, forcing: 2,
      text: 'Pas d\'As, mais au moins 8 points H ou 2 Rois.' }), h => hcp(h) >= 8 || kings(h) >= 2),
    opt('2H', M('Réponse : pas d\'As, 7 points H au plus', { pts: [0, 7], unit: 'H', fiche: '07', alert: true, forcing: 2,
      text: 'Pas d\'As et 7 points H au plus.' }), () => true),
  ];
}

function respWeak2(c) {
  const d = c.seq[0][1], s = DEN_SUIT[d];
  const o = [];
  o.push(opt('4' + d, M('Soutien à la manche', { len: ln({ [d]: [3, 13] }), fiche: '06', conclusion: true,
    text: `Enchère d'arrêt : au moins 4 cartes à ${nm(s)} (jeu faible ou jeu fort), ou fit et assez de points pour la manche.` }),
    h => L(h, s) >= 4 || (L(h, s) >= 3 && HL(h) >= 14 && HL(h) <= 15)));
  o.push(opt('3N', M('3SA pour les jouer', { pts: [16, 37], unit: 'H', len: ln({ [d]: [0, 1] }), fiche: '06', conclusion: true,
    text: 'Enchère d\'arrêt : pas de fit, mais 9 levées à soi et des arrêts partout.' }),
    h => L(h, s) <= 1 && hcp(h) >= 17 && [0, 1, 2, 3].every(t => t === s || stopper(h, t))));
  for (const t of [0, 3, 2]) {
    if (t === s) continue;
    o.push(opt(t === 0 ? '2S' : '3' + dn(t), M('Changement de couleur (forcing)', { pts: [16, 37], unit: 'HL', len: ln({ [dn(t)]: [6, 13] }), forcing: 1, fiche: '06',
      text: `Au moins 16 points HL et une belle couleur de 6 cartes à ${nm(t)}. Forcing.` }),
      h => HL(h) >= 16 && L(h, s) <= 1 && L(h, t) >= 6 && robust(h, t)));
  }
  o.push(opt('2N', M('Relais 2SA', { pts: [16, 37], unit: 'HL', forcing: 1, alert: true, fiche: '06',
    text: 'Enchère forcing : espoir de manche ou de chelem (fit d\'au moins 2 cartes), ou le Sans-Atout paraît préférable. L\'ouvreur précise sa force.' }), h => HL(h) >= 16));
  o.push(opt('3' + d, M('Soutien d\'arrêt', { pts: [0, 13], unit: 'HL', len: ln({ [d]: [2, 3] }), fiche: '06',
    text: `Enchère d'arrêt : 2 ou 3 cartes à ${nm(s)}, sans espoir de manche. Pour gêner les adversaires.` }),
    h => (L(h, s) === 3 && HL(h) <= 13) || (L(h, s) === 2 && HL(h) >= 9 && HL(h) <= 13)));
  o.push(opt('P', M('Passe', { pts: [0, 15], unit: 'HL', fiche: '06', text: 'Jeu faible, pas de quoi aller plus loin.' }), () => true));
  return o;
}

function respBarrage(c) {
  const lvl = +c.seq[0][0], d = c.seq[0][1], s = DEN_SUIT[d];
  const o = [];
  if (lvl === 3 && s >= 2) {
    o.push(opt('3N', M('3SA', { pts: [16, 37], unit: 'H', fiche: '12', conclusion: true,
      text: `Arrêts dans les autres couleurs et un ou deux honneurs à ${nm(s)} : 9 levées en vue.` }),
      h => hcp(h) >= 16 && L(h, s) >= 1 && [0, 1, 2, 3].every(t => t === s || stopper(h, t))));
    o.push(opt('5' + d, M('Prolongation au palier de 5', { len: ln({ [d]: [4, 13] }), fiche: '12', text: 'Loi de Vernes : 11 atouts dans le camp, on joue au palier de 5.' }), h => L(h, s) >= 4));
    o.push(opt('4' + d, M('Prolongation au palier de 4', { len: ln({ [d]: [3, 13] }), fiche: '12', text: 'Loi de Vernes : 10 atouts dans le camp, on joue au palier de 4.' }), h => L(h, s) >= 3));
  }
  if (lvl === 3 && s <= 1) {
    o.push(opt('4' + d, M('Prolongation à la manche', { len: ln({ [d]: [3, 13] }), fiche: '12', conclusion: true,
      text: 'Fit d\'au moins 3 cartes : 10 atouts dans le camp, pour gêner ou pour gagner.' }), h => L(h, s) >= 3));
  }
  if (lvl === 4 && s <= 1) o.push(opt('4N', blackwoodM(s), h => HL(h) >= 20 && L(h, s) >= 2));
  if (lvl === 4 && s >= 2) o.push(opt('5' + d, M('Prolongation', { len: ln({ [d]: [3, 13] }), fiche: '12', text: 'Fit et jeu correct : on joue au palier de 5.' }), h => L(h, s) >= 3 && HL(h) >= 13));
  o.push(opt('P', M('Passe', { fiche: '12', text: 'Pas de possibilité de manche (ou de chelem).' }), () => true));
  return o;
}

// Après une intervention adverse (contre ou couleur)
function respAfterInterf(c) {
  const od = c.seq[0][1], os = DEN_SUIT[od], ov = c.seq[1];
  if (ov === 'X') {
    const base = os <= 1 ? respMajor(c) : respMinor(c);
    return [opt('XX', M('Surcontre', { pts: [10, 37], unit: 'H', fiche: '13', text: 'Au moins 10 points H : le camp a la majorité des points.' }), h => hcp(h) >= 10)]
      .concat(base.filter(o => o.call !== 'P'))
      .concat([opt('P', M('Passe', { pts: [0, 9], unit: 'H', text: 'Pas d\'enchère naturelle à faire.' }), () => true)]);
  }
  if (!isBid(ov)) return null;
  const vs = denOf(ov) === 'N' ? -1 : DEN_SUIT[denOf(ov)];
  const o = [];
  const fitMin = os <= 1 ? 3 : 4;
  const raise = (k) => { const b = cheapest(c, od); return b ? bidOf(levelOf(b) + k, os) : null; };
  const p = h => HLD(h, os);
  if (os <= 1) {
    const g = '4' + od;
    if (bidRank(g) > bidRank(ov)) o.push(opt(g, M('Soutien à la manche', { pts: [13, 18], unit: 'HLD', len: ln({ [od]: [3, 13] }), fiche: '03', conclusion: true,
      text: `Au moins 3 cartes à ${nm(os)}, 13 points HLD ou plus.` }), h => L(h, os) >= 3 && p(h) >= 13));
  }
  const r1 = raise(0), r2 = raise(1);
  if (r2 && levelOf(r2) <= 3 + (os <= 1 ? 0 : 0)) o.push(opt(r2, M('Soutien à saut', { pts: [11, 12], unit: 'HLD', len: ln({ [od]: [fitMin, 13] }), fiche: '03',
    text: `Au moins ${fitMin} cartes à ${nm(os)}, 11 ou 12 points. Proposition de manche.` }), h => L(h, os) >= fitMin && p(h) >= 11 && p(h) <= 12));
  if (r1 && levelOf(r1) <= 3) o.push(opt(r1, M('Soutien simple', { pts: [6, 10], unit: 'HLD', len: ln({ [od]: [fitMin, 13] }), fiche: '03',
    text: `Au moins ${fitMin} cartes à ${nm(os)}, 6 à 10 points.` }), h => L(h, os) >= fitMin && p(h) >= 6 && p(h) <= 10));
  if (vs >= 0 && levelOf(ov) <= 2) o.push(opt('X', M('Contre punitif', { pts: [10, 37], unit: 'H', len: ln({ [dn(vs)]: [4, 13] }), fiche: '10',
    text: `Au moins 10 points H et 4 bonnes cartes à ${nm(vs)} : pour faire chuter les adversaires.` }), h => hcp(h) >= 10 && L(h, vs) >= 4 && bigHonors(h, vs) >= 1 && L(h, os) <= 2));
  for (const t of [0, 1, 2, 3]) {
    if (t === os || t === vs) continue;
    const call = cheapest(c, dn(t));
    if (!call) continue;
    const lv = levelOf(call), need = lv === 1 ? 6 : 11, len = lv === 1 ? 4 : 5;
    if (lv > 2) continue;
    o.push(opt(call, M('Nouvelle couleur', { pts: [need, 37], unit: 'HL', len: ln({ [dn(t)]: [len, 13] }), forcing: 1, fiche: '03',
      text: `Au moins ${len} cartes à ${nm(t)} et ${need} points HL ou plus. Forcing.` }),
      h => L(h, t) >= len && HL(h) >= need && L(h, os) < fitMin && [0, 1, 2, 3].every(u => u === t || u === os || u === vs || L(h, u) <= L(h, t))));
  }
  const stopOk = h => vs < 0 || stopper(h, vs);
  for (const [lv, a, b] of [[3, 13, 15], [2, 11, 12], [1, 8, 10]]) {
    const call = lv + 'N';
    if (bidRank(call) <= bidRank(ov)) continue;
    o.push(opt(call, M(call === '3N' ? '3SA' : callTxt(call), { pts: [a, b], unit: 'H', fiche: '03', conclusion: lv === 3,
      text: `${a} à ${b} points H` + (vs >= 0 ? `, avec un arrêt à ${nm(vs)}.` : '.') }), h => L(h, os) < fitMin && stopOk(h) && hcp(h) >= a && hcp(h) <= b));
  }
  o.push(opt('P', M('Passe', { text: 'Pas d\'enchère adaptée après l\'intervention adverse.' }), () => true));
  return o;
}

/* ====================================================================
   2ème ENCHÈRE DE L'OUVREUR (fiche 05) et suites des ouvertures
   ==================================================================== */
function openerRebid1(c) {
  const od = c.seq[0][1], os = DEN_SUIT[od], r = c.seq[2];
  const major = os <= 1;
  const o = [];
  if (!isBid(r)) return null;
  const rl = levelOf(r), rd = denOf(r);
  // (1) Soutien du partenaire dans la couleur d'ouverture
  if (rd === od) {
    const p = h => HLD(h, os);
    if (major) {
      if (rl === 2) o.push(
        opt('4N', blackwoodM(os), h => p(h) >= 23),
        opt('4' + od, M('Manche : ouverture forte', { pts: [19, 23], unit: 'HLD', fiche: '05', conclusion: true, text: '19 points HLD ou plus : le camp a la manche.' }), h => p(h) >= 19),
        opt('3' + od, M('Proposition de manche', { pts: [16, 18], unit: 'HLD', fiche: '05', text: '16 à 18 points HLD : le répondant dit la manche s\'il est maximum.' }), h => p(h) >= 16),
        opt('P', M('Passe', { pts: [12, 15], unit: 'HLD', fiche: '05', text: 'Ouverture minimale (12 à 15 points) : le camp n\'a pas assez pour la manche.' }), () => true));
      else if (rl === 3) o.push(
        opt('4N', blackwoodM(os), h => p(h) >= 21),
        opt('4' + od, M('Acceptation de la manche', { pts: [14, 23], unit: 'HLD', fiche: '05', conclusion: true, text: '14 points HLD ou plus.' }), h => p(h) >= 14),
        opt('P', M('Refus : ouverture minimale', { pts: [12, 13], unit: 'HLD', fiche: '05', text: '12 ou 13 points.' }), () => true));
      else o.push(opt('4N', blackwoodM(os), h => p(h) >= 20 && rl === 4),
        opt('P', M('Passe', { fiche: '05', text: 'Le contrat de manche est atteint.' }), () => true));
      return o;
    }
    const stops = h => [0, 1, 2, 3].filter(t => t !== os && stopper(h, t)).length;
    if (rl === 2) o.push(
      opt('3N', M('3SA', { pts: [18, 23], unit: 'HL', fiche: '05', conclusion: true, text: 'Total fort : 18 points ou plus, main régulière ou arrêts dans les autres couleurs.' }), h => HL(h) >= 18 && stops(h) >= 3),
      opt('5' + od, M('Manche en Mineure', { pts: [18, 23], unit: 'HL', fiche: '05', conclusion: true, text: 'Total fort avec une main irrégulière.' }), h => HL(h) >= 18),
      opt('2N', M('2SA', { pts: [16, 17], unit: 'HL', fiche: '05', text: 'Total moyen : 16 ou 17 points, proposition de manche à Sans-Atout.' }), h => HL(h) >= 16 && stops(h) >= 2),
      opt('3' + od, M('Répétition de la Mineure', { pts: [16, 17], unit: 'HL', fiche: '05', text: '16 ou 17 points, main irrégulière.' }), h => HL(h) >= 16),
      opt('P', M('Passe', { pts: [12, 15], unit: 'HL', fiche: '05', text: 'Total faible : ouverture minimale.' }), () => true));
    else if (rl === 3) o.push(
      opt('3N', M('3SA', { pts: [14, 23], unit: 'HL', fiche: '05', conclusion: true, text: '14 points ou plus avec des arrêts dans les autres couleurs.' }), h => HL(h) >= 14 && stops(h) >= 2),
      opt('5' + od, M('Manche en Mineure', { pts: [15, 23], unit: 'HL', fiche: '05', conclusion: true, text: 'Main forte irrégulière.' }), h => HL(h) >= 15),
      opt('P', M('Passe', { pts: [12, 14], unit: 'HL', fiche: '05', text: 'Ouverture minimale.' }), () => true));
    else o.push(opt('P', M('Passe', { fiche: '05' }), () => true));
    return o;
  }
  // (3) Après une réponse à Sans-Atout
  if (rd === 'N') {
    if (r === '1N') {
      o.push(
        opt('3N', M('3SA', { pts: [18, 19], unit: 'H', fiche: '05', conclusion: true, text: 'Main régulière de 18 ou 19 points H.' }), h => isRegular(h) && hcp(h) >= 18),
        opt('2N', M('2SA', { pts: [15, 17], unit: 'H', fiche: '05', text: 'Main régulière de 15 à 17 points H : proposition de manche.' }), h => isRegular(h) && hcp(h) >= 15),
        opt('P', M('Passe', { pts: [12, 14], unit: 'H', fiche: '05', text: 'Main régulière minimale (12 à 14 points).' }), h => isRegular(h) && hcp(h) <= 14));
      if (major) o.push(opt('4' + od, M('Manche : 6 cartes et main forte', { pts: [19, 23], unit: 'HL', len: ln({ [od]: [6, 13] }), fiche: '05', conclusion: true,
        text: `Au moins 6 cartes à ${nm(os)} et 19 points HL ou plus.` }), h => L(h, os) >= 6 && HL(h) >= 19));
      o.push(opt('3' + od, M('Répétition à saut', { pts: [16, 18], unit: 'HL', len: ln({ [od]: [6, 13] }), fiche: '05',
        text: `Au moins 6 cartes à ${nm(os)} et 16 à 18 points HL.` }), h => L(h, os) >= 6 && HL(h) >= 16));
      o.push(...secondSuitOpts(c, os, r));
      o.push(opt('2' + od, M('Répétition de la couleur', { pts: [12, 15], unit: 'HL', len: ln({ [od]: [major ? 6 : 5, 13] }), fiche: '05',
        text: `Au moins ${major ? 6 : 5} cartes à ${nm(os)}, jeu minimum.` }), h => L(h, os) >= (major ? 6 : 5)));
      o.push(opt('P', M('Passe', { pts: [12, 14], unit: 'HL', fiche: '05', text: 'Ouverture minimale : le contrat de 1SA convient.' }), () => true));
      return o;
    }
    if (r === '2N') {
      if (major) o.push(opt('4' + od, M('Manche à la couleur', { len: ln({ [od]: [6, 13] }), fiche: '05', conclusion: true, text: `6 cartes à ${nm(os)} et 14 points ou plus.` }), h => L(h, os) >= 6 && HL(h) >= 14));
      o.push(opt('3N', M('3SA', { pts: [14, 23], unit: 'HL', fiche: '05', conclusion: true, text: 'Acceptation : 14 points ou plus.' }), h => HL(h) >= 14),
        opt('3' + od, M('Répétition de la couleur', { pts: [12, 13], unit: 'HL', len: ln({ [od]: [6, 13] }), fiche: '05', text: 'Main irrégulière minimale.' }), h => L(h, os) >= 6),
        opt('P', M('Passe', { pts: [12, 13], unit: 'HL', fiche: '05', text: 'Refus : ouverture minimale.' }), () => true));
      return o;
    }
    if (r === '3N') {
      if (major) o.push(opt('4' + od, M('Manche à la couleur', { len: ln({ [od]: [6, 13] }), fiche: '05', conclusion: true, text: `6 cartes à ${nm(os)} : on préfère la manche en Majeure.` }), h => L(h, os) >= 6));
      o.push(opt('P', M('Passe', { fiche: '05' }), () => true));
      return o;
    }
    return null;
  }
  // (2) Changement de couleur du partenaire (forcing) — « il faut reparler »
  const rs = DEN_SUIT[rd];
  if (rl > 2) return null;
  const jumpResp = bidRank(r) - bidRank(c.seq[0]) > 5 && rl === 2 && DEN.indexOf(rd) > DEN.indexOf(od);
  if (jumpResp) return null;
  const supMin = 4;
  const s1 = bidOf(rl + 1, rs), s2 = bidOf(rl + 2, rs);
  if (rs <= 1 && rl === 1) o.push(opt('4' + rd, M('Soutien à la manche', { pts: [19, 23], unit: 'HLD', len: ln({ [rd]: [4, 13] }), fiche: '05', conclusion: true,
    text: `4 cartes à ${nm(rs)} et 19 points HLD ou plus.` }), h => L(h, rs) >= supMin && HLD(h, rs) >= 19));
  if (rl + 2 <= 3) o.push(opt(s2, M('Soutien à saut', { pts: [16, 18], unit: 'HLD', len: ln({ [rd]: [4, 13] }), fiche: '05',
    text: `4 cartes à ${nm(rs)} et 16 à 18 points HLD.` }), h => L(h, rs) >= supMin && HLD(h, rs) >= 16 && (rs <= 1 || !hasMaj4At1(h, c))));
  o.push(opt(s1, M('Soutien simple', { pts: [12, 15], unit: 'HLD', len: ln({ [rd]: [4, 13] }), fiche: '05',
    text: `4 cartes à ${nm(rs)} et 12 à 15 points HLD.` }), h => L(h, rs) >= supMin && (rs <= 1 || !hasMaj4At1(h, c)) && HLD(h, rs) <= 18));
  // Majeure 4e au palier de 1
  for (const t of [1, 0]) {
    if (rl !== 1 || t === os || DEN.indexOf(dn(t)) <= DEN.indexOf(rd)) continue;
    o.push(opt('1' + dn(t), M('Majeure 4e au palier de 1', { pts: [12, 18], unit: 'HL', len: ln({ [dn(t)]: [4, 13] }), fiche: '05',
      text: `4 cartes à ${nm(t)} : priorité à la recherche d'un fit en Majeure.` }), h => firstMaj(h, rs) === t));
  }
  // Sans-Atout
  if (rl === 1) {
    o.push(opt('2N', M('2SA à saut', { pts: [18, 19], unit: 'H', fiche: '05', text: 'Main régulière de 18 ou 19 points H.' }), h => isRegular(h) && hcp(h) >= 18 && hcp(h) <= 19));
    o.push(opt('1N', M('1SA', { pts: [12, 14], unit: 'H', fiche: '05', text: 'Main régulière minimale (12 à 14 points H), sans fit.' }), h => isRegular(h) && hcp(h) <= 14));
  } else {
    o.push(opt('3N', M('3SA', { pts: [15, 19], unit: 'H', fiche: '05', conclusion: true, text: 'Main régulière de 15 à 19 points H.' }), h => isRegular(h) && hcp(h) >= 15 && hcp(h) <= 19));
    o.push(opt('2N', M('2SA', { pts: [12, 14], unit: 'H', fiche: '05', text: 'Main régulière minimale (12 à 14 points H).' }), h => isRegular(h) && hcp(h) <= 14));
  }
  // Saut en nouvelle couleur (main forte)
  for (const t of [0, 1, 2, 3]) {
    if (t === os || t === rs) continue;
    const ch = cheapest(c, dn(t));
    if (!ch) continue;
    const jb = bidOf(levelOf(ch) + 1, t);
    if (levelOf(jb) > 3) continue;
    o.push(opt(jb, M('Saut en nouvelle couleur', { pts: [19, 23], unit: 'HL', len: ln({ [dn(t)]: [4, 13] }), forcing: 2, fiche: '05',
      text: `Main forte (19 points HL et plus) avec 4 cartes ou plus à ${nm(t)}. Forcing de manche.` }), h => HL(h) >= 19 && L(h, t) >= 4 && L(h, rs) < 4 && bestSecond(h, os, rs) === t));
  }
  o.push(...secondSuitOpts(c, os, r));
  // Répétition
  const rep = cheapest(c, od);
  if (rep) {
    const jr = bidOf(levelOf(rep) + 1, os);
    if (levelOf(jr) <= 3) o.push(opt(jr, M('Répétition à saut', { pts: [16, 18], unit: 'HL', len: ln({ [od]: [6, 13] }), fiche: '05',
      text: `Au moins 6 cartes à ${nm(os)} et 16 à 18 points HL.` }), h => L(h, os) >= 6 && HL(h) >= 16 && HL(h) <= 18));
    o.push(opt(rep, M('Répétition de la couleur', { pts: [12, 15], unit: 'HL', len: ln({ [od]: [major ? 6 : 5, 13] }), fiche: '05',
      text: `Au moins ${major ? 6 : 5} cartes à ${nm(os)}, jeu minimum.` }), h => L(h, os) >= (major ? 6 : 5) && HL(h) <= 15));
  }
  // Solutions de repli
  if (rl === 1) o.push(opt('1N', o.find(x => x.call === '1N').m, h => hcp(h) <= 15));
  if (rep) o.push(opt(rep, M('Répétition de la couleur', { pts: [12, 18], unit: 'HL', len: ln({ [od]: [5, 13] }), fiche: '05', text: `Pas de meilleure enchère : on répète ${nm(os)}.` }), h => L(h, os) >= 5));
  return o;
}
function hasMaj4At1(h, c) {
  const r = c.seq[2];
  if (levelOf(r) !== 1) return false;
  return [1, 0].some(t => DEN.indexOf(dn(t)) > DEN.indexOf(denOf(r)) && DEN_SUIT[c.seq[0][1]] !== t && L(h, t) >= 4);
}
function firstMaj(h, rs) {
  if (L(h, 1) >= 4 && rs !== 1 && DEN.indexOf('H') > DEN.indexOf(dn(rs))) return 1;
  if (L(h, 0) >= 4 && rs !== 0) return 0;
  return -1;
}
function bestSecond(h, os, rs) {
  const l = lens(h);
  const c = [0, 1, 2, 3].filter(t => t !== os && t !== rs && l[t] >= 4).sort((a, b) => l[b] - l[a] || a - b);
  return c.length ? c[0] : -1;
}
// Deuxième couleur : bicolore économique ou cher
function secondSuitOpts(c, os, r) {
  const o = [];
  const rs = denOf(r) === 'N' ? -1 : DEN_SUIT[denOf(r)];
  for (const t of [0, 1, 2, 3]) {
    if (t === os || t === rs) continue;
    const call = cheapest(c, dn(t));
    if (!call || levelOf(call) === 1) continue;
    const reverse = DEN.indexOf(dn(t)) > DEN.indexOf(dn(os));
    const lvl3 = levelOf(call) >= 3;
    const need = reverse || lvl3 ? 17 : 12;
    if (levelOf(call) > 3) continue;
    o.push(opt(call, M(reverse ? 'Bicolore « cher »' : 'Bicolore « économique »', { pts: [need, 23], unit: 'HL', len: ln({ [dn(os)]: [reverse ? 5 : 4, 13], [dn(t)]: [4, 13] }), forcing: reverse ? 1 : 0, fiche: '05',
      text: `Deuxième couleur : au moins 4 cartes à ${nm(t)}` + (reverse ? ', main forte (17 points HL et plus). Forcing.' : '.') }),
      h => L(h, t) >= 4 && HL(h) >= need && !(rs >= 0 && L(h, rs) >= 4) && bestSecond(h, os, rs) === t));
  }
  return o;
}

function opener1NRebid(c) {
  const r = c.seq[2];
  const pass = M('Passe', { fiche: '11' });
  if (r === '2C') return [
    opt('2N', M('Réponse au Stayman : 4 cœurs ET 4 piques', { len: ln({ H: [4, 4], S: [4, 4] }), alert: true, fiche: '11', text: 'L\'ouvreur a 4 cartes à Cœur et 4 cartes à Pique.' }), h => L(h, 0) === 4 && L(h, 1) === 4),
    opt('2H', M('Réponse au Stayman : 4 cœurs', { len: ln({ H: [4, 4], S: [0, 3] }), alert: true, fiche: '11', text: 'L\'ouvreur a 4 cartes à Cœur (et pas 4 piques).' }), h => L(h, 1) === 4),
    opt('2S', M('Réponse au Stayman : 4 piques', { len: ln({ S: [4, 4], H: [0, 3] }), alert: true, fiche: '11', text: 'L\'ouvreur a 4 cartes à Pique (et pas 4 cœurs).' }), h => L(h, 0) === 4),
    opt('2D', M('Réponse au Stayman : pas de Majeure 4e', { len: ln({ H: [0, 3], S: [0, 3] }), alert: true, fiche: '11', text: 'L\'ouvreur n\'a pas 4 cartes en Majeure.' }), () => true)];
  if (r === '2D') return [opt('2H', M('Texas complété', { fiche: '14', text: 'L\'ouvreur dit 2♥ comme le demande le Texas.' }), () => true)];
  if (r === '2H') return [opt('2S', M('Texas complété', { fiche: '14', text: 'L\'ouvreur dit 2♠ comme le demande le Texas.' }), () => true)];
  if (r === '2S') return [opt('3C', M('Texas complété', { fiche: '14', text: 'L\'ouvreur dit 3♣ comme le demande le Texas.' }), () => true)];
  if (r === '3C') return [opt('3D', M('Texas complété', { fiche: '14', text: 'L\'ouvreur dit 3♦ comme le demande le Texas.' }), () => true)];
  if (r === '2N') return [
    opt('3N', M('Acceptation : 17 points', { pts: [17, 17], unit: 'H', fiche: '11', conclusion: true, text: 'L\'ouvreur est maximum (17 points).' }), h => hcp(h) >= 17),
    opt('P', M('Refus : 15 ou 16 points', { pts: [15, 16], unit: 'H', fiche: '11', text: 'L\'ouvreur n\'est pas maximum.' }), () => true)];
  if (r === '4N') return simpleBwAnswers(h => hcp(h) >= 17, 'Avec 17 points, l\'ouvreur accepte et indique ses As.')
    .concat([opt('P', M('Refus : 15 ou 16 points', { pts: [15, 16], unit: 'H', fiche: '11', text: 'L\'ouvreur refuse le chelem.' }), () => true)]);
  if (r === '3N' || r === '6N') return [opt('P', pass, () => true)];
  return null;
}
function simpleBwAnswers(okFn, txt) {
  const mk = (call, n) => opt(call, M('Réponse au Blackwood : ' + n, { fiche: '08', alert: true, text: (txt ? txt + ' ' : '') + 'Réponse : ' + n + '.' }),
    h => okFn(h) && ({ '5C': [0, 4], '5D': [1], '5H': [2], '5S': [3] })[call].includes(aces(h)));
  return [mk('5C', '0 ou 4 As'), mk('5D', '1 As'), mk('5H', '2 As'), mk('5S', '3 As')];
}

function responder1NCont(c) {
  const s = c.s;
  let m;
  if ((m = /^1N P 2C P (2D|2H|2S|2N) P$/.exec(s))) {
    const a = m[1];
    if (a === '2D') return [
      opt('3H', M('Chassé-croisé : 5 piques', { pts: [10, 37], unit: 'HL', len: ln({ S: [5, 5], H: [4, 4] }), forcing: 2, alert: true, fiche: '11',
        text: '5 piques (et 4 cœurs), 10 points HL et plus. L\'ouvreur dit 3♠ ou 4♠ avec 3 piques, sinon 3SA.' }), h => HL(h) >= 10 && L(h, 0) === 5 && L(h, 1) >= 4),
      opt('3S', M('Chassé-croisé : 5 cœurs', { pts: [10, 37], unit: 'HL', len: ln({ H: [5, 5], S: [4, 4] }), forcing: 2, alert: true, fiche: '11',
        text: '5 cœurs (et 4 piques), 10 points HL et plus. L\'ouvreur dit 4♥ avec 3 cœurs et 17 points, sinon 3SA.' }), h => HL(h) >= 10 && L(h, 1) === 5 && L(h, 0) >= 4),
      opt('2H', M('5 cœurs, 8-9 points', { pts: [8, 9], unit: 'HL', len: ln({ H: [5, 5], S: [4, 4] }), fiche: '11', text: '5 cœurs et 4 piques, 8 ou 9 points.' }), h => L(h, 1) === 5),
      opt('2S', M('5 piques, 8-9 points', { pts: [8, 9], unit: 'HL', len: ln({ S: [5, 5], H: [4, 4] }), fiche: '11', text: '5 piques et 4 cœurs, 8 ou 9 points.' }), h => L(h, 0) === 5),
      opt('6N', M('Petit chelem', { pts: [18, 37], unit: 'H', fiche: '11', conclusion: true, text: '18 points H et plus.' }), h => hcp(h) >= 18),
      opt('4N', M('Essai de chelem', { pts: [15, 17], unit: 'HL', fiche: '11', text: '15 à 17 points : avec 17 points l\'ouvreur répond au Blackwood.' }), h => HL(h) >= 15),
      opt('3N', M('3SA', { pts: [10, 14], unit: 'HL', fiche: '11', conclusion: true, text: '10 à 14 points HL : manche à Sans-Atout.' }), h => HL(h) >= 10),
      opt('2N', M('2SA', { pts: [8, 9], unit: 'HL', fiche: '11', text: '8 ou 9 points : l\'ouvreur dit 3SA avec 17 points.' }), () => true)];
    if (a === '2H' || a === '2S') {
      const t = a === '2H' ? 1 : 0, d = dn(t);
      const fit = h => L(h, t) >= 4, p = h => HLD(h, t);
      return [
        opt('5' + d, M('Fit : essai de chelem', { pts: [15, 37], unit: 'HLD', len: ln({ [d]: [4, 13] }), fiche: '11', text: `Fit à ${nm(t)} et 15 points ou plus : l'ouvreur dit 6 avec 17 points.` }), h => fit(h) && p(h) >= 15),
        opt('4' + d, M('Fit : manche', { pts: [13, 14], unit: 'HLD', len: ln({ [d]: [4, 13] }), fiche: '11', conclusion: true, text: `Fit à ${nm(t)} et 13 ou 14 points.` }), h => fit(h) && p(h) >= 13),
        opt('3' + d, M('Fit : proposition de manche', { pts: [10, 12], unit: 'HLD', len: ln({ [d]: [4, 13] }), fiche: '11', text: `Fit à ${nm(t)}, 10 à 12 points : l'ouvreur dit la manche avec 17 points.` }), h => fit(h) && p(h) >= 10),
        opt('P', M('Passe', { pts: [8, 9], unit: 'HLD', len: ln({ [d]: [4, 13] }), fiche: '11', text: `Fit à ${nm(t)}, 8 ou 9 points.` }), h => fit(h)),
        opt('4N', M('Essai de chelem', { pts: [16, 37], unit: 'H', fiche: '11', text: 'Sans fit, 16 points ou plus : l\'ouvreur dit 6SA avec 17 points.' }), h => hcp(h) >= 16),
        opt('3N', M('3SA', { pts: [10, 15], unit: 'H', fiche: '11', conclusion: true, text: 'Sans fit, 10 à 15 points.' }), h => HL(h) >= 10),
        opt('2N', M('2SA', { pts: [8, 9], unit: 'H', fiche: '11', text: 'Sans fit, 8 ou 9 points : l\'ouvreur dit 3SA avec 17 points.' }), () => true)];
    }
    return [
      opt('4C', M('Transfert : fit à Cœur, manche', { pts: [10, 37], unit: 'HLD', alert: true, fiche: '11', text: 'Fit à Cœur et 10 points ou plus : l\'ouvreur dit 4♥.' }), h => L(h, 1) >= 4 && HLD(h, 1) >= 10),
      opt('4D', M('Transfert : fit à Pique, manche', { pts: [10, 37], unit: 'HLD', alert: true, fiche: '11', text: 'Fit à Pique et 10 points ou plus : l\'ouvreur dit 4♠.' }), h => L(h, 0) >= 4 && HLD(h, 0) >= 10),
      opt('3C', M('Transfert : fit à Cœur', { pts: [8, 9], unit: 'HLD', alert: true, fiche: '11', text: 'Fit à Cœur, 8 ou 9 points : l\'ouvreur dit 3♥.' }), h => L(h, 1) >= 4),
      opt('3D', M('Transfert : fit à Pique', { pts: [8, 9], unit: 'HLD', alert: true, fiche: '11', text: 'Fit à Pique, 8 ou 9 points : l\'ouvreur dit 3♠.' }), () => true)];
  }
  if ((m = /^1N P (2D|2H) P (2H|2S) P$/.exec(s))) {
    const t = m[1] === '2D' ? 1 : 0, d = dn(t);
    return [
      opt('4N', blackwoodM(t), h => L(h, t) >= 6 && HLD(h, t) >= 16),
      opt('4' + d, M('Manche : 6 cartes', { pts: [10, 15], unit: 'HL', len: ln({ [d]: [6, 13] }), fiche: '04', conclusion: true, text: `Au moins 6 cartes à ${nm(t)} et 10 points ou plus.` }), h => L(h, t) >= 6 && HL(h) >= 10),
      opt('3N', M('3SA : 5 cartes', { pts: [10, 14], unit: 'HL', len: ln({ [d]: [5, 5] }), fiche: '04', text: `5 cartes à ${nm(t)} et 10 à 14 points : l'ouvreur choisit 3SA ou 4${sym(t)}.` }), h => HL(h) >= 10),
      opt('3' + d, M('Proposition : 6 cartes', { pts: [8, 9], unit: 'HL', len: ln({ [d]: [6, 13] }), fiche: '04', text: `6 cartes à ${nm(t)}, 8 ou 9 points.` }), h => L(h, t) >= 6 && HL(h) >= 8),
      opt('2N', M('Proposition : 5 cartes', { pts: [8, 9], unit: 'HL', len: ln({ [d]: [5, 5] }), fiche: '04', text: `5 cartes à ${nm(t)}, 8 ou 9 points.` }), h => HL(h) >= 8),
      opt('P', M('Passe', { pts: [0, 7], unit: 'HL', len: ln({ [d]: [5, 13] }), fiche: '04', text: `Jeu faible : on joue 2${sym(t)}.` }), () => true)];
  }
  if (/^1N P 2S P 3C P$/.test(s)) return [opt('P', M('Passe', { len: ln({ C: [6, 13] }), fiche: '14', text: 'Le répondant a des trèfles : on joue 3♣.' }), () => true)];
  if (/^1N P 3C P 3D P$/.test(s)) return [opt('P', M('Passe', { len: ln({ D: [6, 13] }), fiche: '14', text: 'Le répondant a des carreaux : on joue 3♦.' }), () => true)];
  if ((m = /^1N P 4N P (5[CDHS]) P$/.exec(s)) || (m = /^2N P 4N P (5[CDHS]) P$/.exec(s)) || (m = /^1N P 2C P 2D P 4N P (5[CDHS]) P$/.exec(s))) {
    const pa = { '5C': 0, '5D': 1, '5H': 2, '5S': 3 }[m[1]];
    const tot = h => { let p = pa; if (pa === 0 && aces(h) === 0) p = 4; return p + aces(h); };
    return [
      opt('7N', M('Grand chelem', { fiche: '08', conclusion: true, text: 'Les 4 As sont dans le camp et le total de points est très élevé.' }), h => tot(h) === 4 && hcp(h) >= 21),
      opt('6N', M('Petit chelem', { fiche: '08', conclusion: true, text: 'Il ne manque pas plus d\'un As.' }), h => tot(h) >= 3),
      opt('5N', M('Arrêt à 5SA', { fiche: '08', conclusion: true, text: 'Il manque 2 As : on s\'arrête à 5SA.' }), () => true)];
  }
  return null;
}
function opener1NThird(c) {
  const s = c.s;
  let m;
  const pass = M('Passe', { fiche: '11' });
  if ((m = /^1N P 2C P (2D|2H|2S|2N) P (\S+) P$/.exec(s))) {
    const a = m[1], r = m[2];
    if (a === '2N') {
      const map = { '3C': '3H', '3D': '3S', '4C': '4H', '4D': '4S' };
      if (map[r]) return [opt(map[r], M('Transfert complété', { fiche: '11', conclusion: r[0] === '4', text: 'L\'ouvreur dit la Majeure du fit, comme demandé.' }), () => true)];
      return null;
    }
    if (r === '2N' || (r === '3N' && false)) return [
      opt('3N', M('Acceptation : 17 points', { pts: [17, 17], unit: 'H', fiche: '11', conclusion: true, text: 'L\'ouvreur est maximum.' }), h => hcp(h) >= 17),
      opt('P', M('Refus', { pts: [15, 16], unit: 'H', fiche: '11', text: 'L\'ouvreur n\'est pas maximum.' }), () => true)];
    if (r === '4N' && a === '2D') return simpleBwAnswers(h => hcp(h) >= 17, 'Avec 17 points, l\'ouvreur répond au Blackwood.')
      .concat([opt('P', M('Refus', { pts: [15, 16], unit: 'H', fiche: '11' }), () => true)]);
    if (r === '4N') return [opt('6N', M('Acceptation : petit chelem', { pts: [17, 17], unit: 'H', fiche: '11', conclusion: true, text: 'Avec 17 points, l\'ouvreur dit 6SA.' }), h => hcp(h) >= 17), opt('P', pass, () => true)];
    if (r === '6N') return [opt('7N', M('Grand chelem', { pts: [17, 17], unit: 'H', fiche: '11', conclusion: true, text: 'Avec 17 points.' }), h => hcp(h) >= 17 && aces(h) >= 3), opt('P', pass, () => true)];
    if (a === '2D' && (r === '2H' || r === '2S')) {
      const t = r === '2H' ? 1 : 0;
      return [opt('3' + dn(t), M('Fit et 17 points', { pts: [17, 17], unit: 'H', len: ln({ [dn(t)]: [3, 4] }), fiche: '11', text: `3 cartes à ${nm(t)} et 17 points.` }), h => L(h, t) >= 3 && hcp(h) >= 17), opt('P', pass, () => true)];
    }
    if (a === '2D' && r === '3H') return [
      opt('4S', M('Fit à Pique, 17 points', { pts: [17, 17], unit: 'H', len: ln({ S: [3, 4] }), fiche: '11', conclusion: true, text: '3 piques et 17 points.' }), h => L(h, 0) >= 3 && hcp(h) >= 17),
      opt('3S', M('Fit à Pique, 15-16 points', { pts: [15, 16], unit: 'H', len: ln({ S: [3, 4] }), fiche: '11', text: '3 piques et 15 ou 16 points.' }), h => L(h, 0) >= 3),
      opt('3N', M('Sans fit', { len: ln({ S: [2, 2] }), fiche: '11', conclusion: true, text: 'Pas 3 cartes à Pique.' }), () => true)];
    if (a === '2D' && r === '3S') return [
      opt('4H', M('Fit à Cœur, 17 points', { pts: [17, 17], unit: 'H', len: ln({ H: [3, 4] }), fiche: '11', conclusion: true, text: '3 cœurs et 17 points.' }), h => L(h, 1) >= 3 && hcp(h) >= 17),
      opt('3N', M('3SA', { pts: [15, 16], unit: 'H', fiche: '11', text: 'Sans fit, ou fit avec 15-16 points.' }), () => true)];
    if ((a === '2H' || a === '2S') && r === a.replace('2', '3')) return [
      opt('4' + a[1], M('Acceptation', { pts: [17, 17], unit: 'H', fiche: '11', conclusion: true, text: 'Avec 17 points, l\'ouvreur dit la manche.' }), h => hcp(h) >= 17), opt('P', pass, () => true)];
    if ((a === '2H' || a === '2S') && r === a.replace('2', '5')) return [
      opt('6' + a[1], M('Petit chelem', { pts: [17, 17], unit: 'H', fiche: '11', conclusion: true, text: 'Avec 17 points.' }), h => hcp(h) >= 17), opt('P', pass, () => true)];
    if (r === '3N' || r === '4H' || r === '4S' || r === 'P') return [opt('P', pass, () => true)];
    return null;
  }
  if ((m = /^1N P (2D|2H) P (2H|2S) P (\S+) P$/.exec(s))) {
    const t = m[1] === '2D' ? 1 : 0, d = dn(t), r = m[3];
    if (r === '2N') return [
      opt('4' + d, M('Fit et 17 points', { pts: [17, 17], unit: 'H', len: ln({ [d]: [3, 4] }), fiche: '04', conclusion: true, text: `3 cartes à ${nm(t)} et 17 points.` }), h => L(h, t) >= 3 && hcp(h) >= 17),
      opt('3' + d, M('Fit, 15-16 points', { pts: [15, 16], unit: 'H', len: ln({ [d]: [3, 4] }), fiche: '04', text: `3 cartes à ${nm(t)}, ouverture non maximum.` }), h => L(h, t) >= 3),
      opt('3N', M('3SA : 17 points sans fit', { pts: [17, 17], unit: 'H', len: ln({ [d]: [2, 2] }), fiche: '04', conclusion: true, text: '2 cartes seulement, mais 17 points.' }), h => hcp(h) >= 17),
      opt('P', M('Passe', { pts: [15, 16], unit: 'H', fiche: '04', text: 'Pas de fit et ouverture non maximum.' }), () => true)];
    if (r === '3N') return [opt('4' + d, M('Fit : manche à la couleur', { len: ln({ [d]: [3, 4] }), fiche: '04', conclusion: true, text: `3 cartes à ${nm(t)} : la manche à la couleur est préférable.` }), h => L(h, t) >= 3), opt('P', pass, () => true)];
    if (r === '3' + d) return [opt('4' + d, M('Acceptation', { pts: [17, 17], unit: 'H', fiche: '04', conclusion: true, text: 'Avec 17 points.' }), h => hcp(h) >= 17), opt('P', pass, () => true)];
    if (r === '4' + d) return [opt('P', pass, () => true)];
    return null;
  }
  return null;
}

function opener2NRebid(c) {
  const r = c.seq[2];
  if (r === '3C') return [
    opt('3N', M('Réponse au Stayman : 4 cœurs ET 4 piques', { len: ln({ H: [4, 4], S: [4, 4] }), alert: true, fiche: '07', text: '4 cartes à Cœur et 4 cartes à Pique.' }), h => L(h, 0) === 4 && L(h, 1) === 4),
    opt('3H', M('Réponse au Stayman : 4 cœurs', { len: ln({ H: [4, 4] }), alert: true, fiche: '07', text: '4 cartes à Cœur.' }), h => L(h, 1) === 4),
    opt('3S', M('Réponse au Stayman : 4 piques', { len: ln({ S: [4, 4] }), alert: true, fiche: '07', text: '4 cartes à Pique.' }), h => L(h, 0) === 4),
    opt('3D', M('Réponse au Stayman : pas de Majeure 4e', { len: ln({ H: [0, 3], S: [0, 3] }), alert: true, fiche: '07', text: 'Pas de Majeure de 4 cartes.' }), () => true)];
  if (r === '3D') return [
    opt('4H', M('Texas complété à saut : 4 cœurs', { len: ln({ H: [4, 4] }), fiche: '07', conclusion: true, text: '4 cartes à Cœur : on joue la manche.' }), h => L(h, 1) >= 4),
    opt('3H', M('Texas complété', { fiche: '07', text: '2 ou 3 cartes à Cœur.' }), () => true)];
  if (r === '3H') return [
    opt('4S', M('Texas complété à saut : 4 piques', { len: ln({ S: [4, 4] }), fiche: '07', conclusion: true, text: '4 cartes à Pique : on joue la manche.' }), h => L(h, 0) >= 4),
    opt('3S', M('Texas complété', { fiche: '07', text: '2 ou 3 cartes à Pique.' }), () => true)];
  if (r === '4N') return simpleBwAnswers(() => true, 'L\'ouvreur indique son nombre d\'As.');
  if (r === '3N') return [opt('P', M('Passe', { fiche: '07' }), () => true)];
  return null;
}
function responder2NCont(c) {
  const s = c.s;
  let m;
  if ((m = /^2N P 3C P (3D|3H|3S|3N) P$/.exec(s))) {
    const a = m[1];
    if (a === '3D') return [
      opt('3H', M('Chassé-croisé : 5 piques', { len: ln({ S: [5, 5], H: [4, 4] }), forcing: 2, alert: true, fiche: '07', text: '5 piques et 4 cœurs.' }), h => L(h, 0) === 5 && L(h, 1) >= 4),
      opt('3S', M('Chassé-croisé : 5 cœurs', { len: ln({ H: [5, 5], S: [4, 4] }), forcing: 2, alert: true, fiche: '07', text: '5 cœurs et 4 piques.' }), h => L(h, 1) === 5 && L(h, 0) >= 4),
      opt('3N', M('3SA', { fiche: '07', conclusion: true, text: 'Pas de fit Majeur : manche à Sans-Atout.' }), () => true)];
    if (a === '3N') return [
      opt('4C', M('Transfert pour 4♥', { alert: true, fiche: '07', text: 'Fit à Cœur : l\'ouvreur dit 4♥.' }), h => L(h, 1) >= 4),
      opt('4D', M('Transfert pour 4♠', { alert: true, fiche: '07', text: 'Fit à Pique : l\'ouvreur dit 4♠.' }), h => L(h, 0) >= 4),
      opt('P', M('Passe', { fiche: '07' }), () => true)];
    const t = a === '3H' ? 1 : 0, d = dn(t);
    return [
      opt('6' + d, M('Fit : petit chelem', { pts: [11, 37], unit: 'HLD', fiche: '07', conclusion: true, text: 'Fit et plus de 10 points.' }), h => L(h, t) >= 4 && HLD(h, t) > 10),
      opt('4' + d, M('Fit : manche', { pts: [5, 10], unit: 'HLD', fiche: '07', conclusion: true, text: 'Fit et 10 points au plus.' }), h => L(h, t) >= 4),
      opt('6N', M('Sans fit : petit chelem', { pts: [13, 37], unit: 'H', fiche: '07', conclusion: true, text: 'Plus de 12 points H.' }), h => hcp(h) > 12),
      opt('3N', M('Sans fit : 3SA', { pts: [5, 12], unit: 'H', fiche: '07', conclusion: true, text: '12 points H au plus.' }), () => true)];
  }
  if ((m = /^2N P (3D|3H) P (3H|3S) P$/.exec(s))) {
    const t = m[1] === '3D' ? 1 : 0, d = dn(t);
    return [
      opt('4N', blackwoodM(t), h => L(h, t) >= 6 && HLD(h, t) > 10),
      opt('4' + d, M('Manche à la couleur', { fiche: '07', conclusion: true, text: `6 cartes à ${nm(t)}, ou 5 cartes et 7 à 10 points.` }), h => L(h, t) >= 6 || hcp(h) >= 7),
      opt('3N', M('3SA', { fiche: '07', text: `5 cartes à ${nm(t)} : l'ouvreur choisit 3SA ou 4${sym(t)}.` }), () => true)];
  }
  if ((m = /^2N P 3C P 3D P (3H|3S) P$/.exec(s))) {
    const t = m[1] === '3H' ? 0 : 1;
    return [opt('4' + dn(t), M('Fit : manche', { fiche: '07', conclusion: true, text: `3 cartes à ${nm(t)}.` }), h => L(h, t) >= 3), opt('3N', M('3SA', { fiche: '07', conclusion: true, text: 'Pas de fit.' }), () => true)];
  }
  if ((m = /^2N P 3C P 3N P (4C|4D) P$/.exec(s))) return [opt(m[1] === '4C' ? '4H' : '4S', M('Transfert complété', { fiche: '07', conclusion: true }), () => true)];
  if ((m = /^2N P (3D|3H) P (3H|3S) P 3N P$/.exec(s))) {
    const t = m[1] === '3D' ? 1 : 0;
    return [opt('4' + dn(t), M('Fit : manche à la couleur', { fiche: '07', conclusion: true, text: `3 cartes à ${nm(t)}.` }), h => L(h, t) >= 3), opt('P', M('Passe', { fiche: '07' }), () => true)];
  }
  return null;
}

function opener2CRebid(c) {
  const r = c.seq[2];
  if (r !== '2D') return null;
  const longS = h => { const l = lens(h); const c2 = [0, 1, 2, 3].filter(s => l[s] >= (s <= 1 ? 6 : 7)).sort((a, b) => l[b] - l[a] || a - b); return c2.length ? c2[0] : -1; };
  return [
    opt('3N', M('Fort bicolore Majeur 5-5', { len: ln({ H: [5, 6], S: [5, 6] }), forcing: 0, fiche: '07', text: 'Au moins 5 cartes à Cœur et 5 cartes à Pique, main forte.' }), h => L(h, 0) >= 5 && L(h, 1) >= 5),
    opt('2N', M('« Super SA » : 22-23 points H', { pts: [22, 23], unit: 'H', len: REG_LEN, fiche: '07', text: 'Main régulière de 22 ou 23 points H.' }), h => isRegular(h)),
    opt('2H', M('Couleur forte à Cœur', { pts: [20, 23], unit: 'HL', len: ln({ H: [6, 13] }), fiche: '07', text: 'Au moins 6 cartes à Cœur, main forte.' }), h => longS(h) === 1),
    opt('2S', M('Couleur forte à Pique', { pts: [20, 23], unit: 'HL', len: ln({ S: [6, 13] }), fiche: '07', text: 'Au moins 6 cartes à Pique, main forte.' }), h => longS(h) === 0),
    opt('3C', M('Couleur forte à Trèfle', { pts: [20, 23], unit: 'HL', len: ln({ C: [7, 13] }), fiche: '07', text: 'Au moins 7 cartes à Trèfle, main forte.' }), h => longS(h) === 3),
    opt('3D', M('Couleur forte à Carreau', { pts: [20, 23], unit: 'HL', len: ln({ D: [7, 13] }), fiche: '07', text: 'Au moins 7 cartes à Carreau, main forte.' }), h => longS(h) === 2),
    opt('2N', M('« Super SA » : 22-23 points H', { pts: [20, 23], unit: 'H', fiche: '07', text: 'Main forte sans couleur à annoncer.' }), () => true),
  ];
}
function responder2CCont(c) {
  const m = /^2C P 2D P (\S+) P$/.exec(c.s);
  if (!m) return null;
  const r = m[1];
  const o = [];
  const weak = M('Passe', { pts: [0, 3], unit: 'H', fiche: '07', text: 'Moins de 4 points H : pas de manche.' });
  if (r === '2H' || r === '2S') {
    const t = r === '2H' ? 1 : 0, d = dn(t);
    o.push(opt('P', weak, h => hcp(h) < 4),
      opt('3' + d, M('Fit : espoir de chelem', { pts: [10, 37], unit: 'HLD', len: ln({ [d]: [3, 13] }), forcing: 2, fiche: '07', text: `Au moins 3 cartes à ${nm(t)} et 10 points ou plus : espoir de chelem.` }), h => L(h, t) >= 3 && HLD(h, t) >= 10),
      opt('4' + d, M('Fit : manche', { pts: [4, 9], unit: 'HLD', len: ln({ [d]: [2, 13] }), fiche: '07', conclusion: true, text: `Au moins 2 cartes à ${nm(t)} : la manche.` }), h => L(h, t) >= 2));
    for (const u of [0, 1, 3, 2]) {
      if (u === t) continue;
      const call = cheapest(c, dn(u));
      if (!call || levelOf(call) > 3) continue;
      o.push(opt(call, M('Changement de couleur', { pts: [8, 37], unit: 'H', len: ln({ [dn(u)]: [5, 13] }), forcing: 1, fiche: '07', text: `Sans fit, 8 points H ou plus et une belle couleur de 5 cartes à ${nm(u)}.` }),
        h => hcp(h) >= 8 && L(h, u) >= 5 && robust(h, u)));
    }
    o.push(opt('3N', M('3SA', { pts: [4, 37], unit: 'H', fiche: '07', conclusion: true, text: 'Sans fit, avec des arrêts dans les autres couleurs.' }), h => [0, 1, 2, 3].every(u => u === t || stopper(h, u))),
      opt('2N', M('2SA', { pts: [4, 8], unit: 'H', fiche: '07', text: 'Sans fit, 4 à 8 points H.' }), () => true));
    return o;
  }
  if (r === '3C' || r === '3D') {
    const t = DEN_SUIT[r[1]];
    o.push(opt('P', weak, h => hcp(h) < 4),
      opt('3N', M('3SA', { pts: [4, 9], unit: 'H', fiche: '07', conclusion: true, text: 'Jeu faible mais arrêts dans les autres couleurs.' }), h => hcp(h) <= 9 && [0, 1, 2, 3].every(u => u === t || stopper(h, u))),
      opt('4' + r[1], M('Fit : espoir de chelem', { pts: [10, 37], unit: 'HL', len: ln({ [r[1]]: [3, 13] }), forcing: 2, fiche: '07', text: 'Jeu très fort avec un fit dans la Mineure.' }), h => L(h, t) >= 3 && hcp(h) >= 10),
      opt('5' + r[1], M('Manche en Mineure', { pts: [4, 9], unit: 'HL', len: ln({ [r[1]]: [2, 13] }), fiche: '07', conclusion: true, text: 'Jeu moyen avec un soutien.' }), h => L(h, t) >= 2),
      opt('3N', M('3SA', { pts: [4, 37], unit: 'H', fiche: '07', conclusion: true, text: 'Manche à Sans-Atout.' }), () => true));
    return o;
  }
  if (r === '2N') {
    o.push(opt('P', weak, h => hcp(h) < 4));
    for (const u of [1, 0, 3, 2]) o.push(opt('3' + dn(u), M('Belle couleur 5e', { pts: [4, 37], unit: 'H', len: ln({ [dn(u)]: [5, 13] }), forcing: 2, fiche: '07', text: `Belle couleur de 5 cartes ou plus à ${nm(u)}.` }),
      h => L(h, u) >= 5 && robust(h, u) && !isRegular(h)));
    o.push(opt('4N', M('Proposition de chelem', { pts: [11, 37], unit: 'H', fiche: '07', text: '11 points H ou plus, main régulière.' }), h => hcp(h) >= 11),
      opt('3N', M('3SA', { pts: [4, 10], unit: 'H', fiche: '07', conclusion: true, text: '4 à 10 points H.' }), () => true));
    return o;
  }
  if (r === '3N') {
    o.push(opt('4N', blackwoodM(-1), h => (L(h, 0) >= 3 || L(h, 1) >= 3) && hcp(h) >= 8),
      opt('4D', M('Transfert pour 4♥', { alert: true, fiche: '07', text: 'Fit à Cœur, jeu faible : l\'ouvreur dit 4♥.' }), h => L(h, 1) >= 3 && L(h, 1) >= L(h, 0)),
      opt('4H', M('Transfert pour 4♠', { alert: true, fiche: '07', text: 'Fit à Pique, jeu faible : l\'ouvreur dit 4♠.' }), h => L(h, 0) >= 2),
      opt('P', M('Passe', { fiche: '07', text: 'Pas de fit Majeur.' }), () => true));
    return o;
  }
  return null;
}

function opener2DRebid(c) {
  const o = [];
  for (const s of [0, 1, 2, 3]) {
    const call = cheapest(c, dn(s));
    if (!call) continue;
    o.push(opt(call, M('Couleur longue', { len: ln({ [dn(s)]: [5, 13] }), forcing: 2, fiche: '08', text: `Poursuite naturelle : au moins 5 cartes à ${nm(s)}.` }),
      h => L(h, s) >= 5 && lens(h).every((n, t) => n < L(h, s) || t === s || (n === L(h, s) && t > s))));
  }
  const nt = cheapest(c, 'N');
  if (nt) o.push(opt(nt, M('Jeu régulier', { forcing: 2, fiche: '08', text: 'Poursuite naturelle : main régulière.' }), () => true));
  return o;
}

function openerWeak2Rebid(c) {
  const d = c.seq[0][1], s = DEN_SUIT[d], r = c.seq[2];
  const pass = M('Passe', { fiche: '06', text: 'Après une enchère d\'arrêt du répondant, l\'ouvreur passe.' });
  if (r === '2N') {
    const o = [opt('3N', M('3SA : ouverture maximum', { pts: [9, 10], unit: 'H', fiche: '06', conclusion: true, text: 'Ouverture maximum avec 2 gros honneurs dans la couleur, sans force à côté.' }),
      h => hcp(h) >= 9 && bigHonors(h, s) >= 2 && [0, 1, 2, 3].every(t => t === s || !h.some(x => suitOf(x) === t && rankOf(x) >= 11)))];
    for (const t of [0, 1, 2, 3]) {
      if (t === s) continue;
      const call = cheapest(c, dn(t));
      if (!call || levelOf(call) !== 3) continue;
      o.push(opt(call, M('Force (As ou Roi) : ouverture non minimale', { pts: [9, 10], unit: 'H', forcing: 2, fiche: '06', text: `Ouverture non minimale avec un As ou un Roi à ${nm(t)}. Forcing de manche.` }),
        h => hcp(h) >= 9 && h.some(x => suitOf(x) === t && rankOf(x) >= 11)));
    }
    o.push(opt('3' + d, M('Répétition : ouverture minimale', { pts: [6, 8], unit: 'H', fiche: '06', text: 'Ouverture minimale.' }), () => true));
    return o;
  }
  if (isBid(r) && denOf(r) !== d && denOf(r) !== 'N' && levelOf(r) <= 3) {
    const t = DEN_SUIT[denOf(r)];
    const o = [];
    const sup = cheapest(c, denOf(r));
    if (sup) o.push(opt(sup, M('Soutien', { len: ln({ [denOf(r)]: [2, 13] }), fiche: '06', text: `Au moins 2 cartes à ${nm(t)}.` }), h => L(h, t) >= 2));
    o.push(opt('3N', M('3SA', { fiche: '06', conclusion: true, text: 'Arrêts dans les deux autres couleurs.' }), h => [0, 1, 2, 3].every(u => u === s || u === t || stopper(h, u))));
    const rep = cheapest(c, d);
    if (rep) o.push(opt(rep, M('Répétition de la couleur', { fiche: '06', text: 'Pas de fit.' }), () => true));
    return o;
  }
  return [opt('P', pass, () => true)];
}

/* ====================================================================
   INTERVENTIONS (fiche 10) et RÉPONSES AU CONTRE (fiche 13)
   ==================================================================== */
function takeoutOk(h, os) {
  const l = lens(h), hl = HL(h);
  if (hl >= 18) return true;
  if (hl < 12 || l[os] > 2) return false;
  if ((l[0] >= 5 && os !== 0) || (l[1] >= 5 && os !== 1)) return false;
  if (os >= 2) return l[0] + l[1] >= 7 && l[0] >= 3 && l[1] >= 3;
  const om = os === 0 ? 1 : 0;
  if (l[om] >= 4) return true;
  if (hl >= 14) return [0, 1, 2, 3].every(s => s === os || l[s] >= 3);
  return false;
}
function overcallOpts(c) {
  const od = c.seq[0][1], os = DEN_SUIT[od];
  const direct = c.seq.length === 1;
  const balancing = c.s === c.seq[0] + ' P P';
  const opp = natSuitsOf(c, 1 - sideOf(c.seat));
  const o = [];
  const lighter = balancing ? 2 : 0;
  if (direct || balancing) o.push(opt('1N', M('Intervention à 1SA', { pts: [16 - lighter, 18], unit: 'HL', fiche: '10',
    text: `${16 - lighter} à 18 points HL, main régulière, avec ${os <= 1 ? '1,5' : '1'} arrêt à ${nm(os)}.` }),
    h => isRegular(h) && HL(h) >= 16 - lighter && HL(h) <= 18 && (os <= 1 ? stopper15(h, os) : stopper(h, os))));
  if (direct || balancing) o.push(opt('X', M('Contre d\'appel', { pts: [12, 37], unit: 'HL', len: ln({ [od]: [0, 2] }), fiche: '10',
    text: os >= 2 ? 'Valeur d\'ouverture (12 points HL et plus), au plus 2 cartes dans la couleur d\'ouverture, au moins 7 cartes en Majeures (4-3). Ou 18 points HL et plus. Le partenaire doit répondre.'
      : `Valeur d'ouverture, au plus 2 cartes à ${nm(os)}, 4 cartes dans l'autre Majeure (ou soutien dans les 3 autres couleurs). Ou 18 points HL et plus. Le partenaire doit répondre.` }),
    h => takeoutOk(h, os) && !(HL(h) < 18 && lens(h).some((n, s) => n >= 5 && s !== os && levelOf(cheapest(c, dn(s))) === 1 && s <= 1))));
  // Bicolores (bicolore lyonnais)
  if (direct) {
    const unbid = [0, 1, 2, 3].filter(s => s !== os);
    const cheap2 = unbid.slice().sort((a, b) => b - a).slice(0, 2);      // les 2 moins chères
    const dear2 = unbid.slice().sort((a, b) => a - b).slice(0, 2);       // les 2 plus chères
    const ext = [unbid[0], unbid[unbid.length - 1]];                     // extrêmes
    const bic = (pair) => h => HL(h) >= 10 && hcp(h) >= 8 && hcp(h) <= 15 && pair.every(s => L(h, s) >= 5);
    const pairTxt = p => `${nm(p[0])} et ${nm(p[1])}`;
    o.push(opt('2N', M('Bicolore : les 2 couleurs les moins chères', { pts: [8, 15], unit: 'H', len: ln({ [dn(cheap2[0])]: [5, 13], [dn(cheap2[1])]: [5, 13] }), alert: true, fiche: '10',
      text: `Bicolore 5-5 au moins à ${pairTxt(cheap2)}, environ 11 points H utiles.` }), bic(cheap2)));
    const cue = '2' + (od === 'C' ? 'D' : od);
    o.push(opt(cue, M('Cue-bid : bicolore des 2 couleurs les plus chères', { pts: [8, 15], unit: 'H', len: ln({ [dn(dear2[0])]: [5, 13], [dn(dear2[1])]: [5, 13] }), alert: true, fiche: '10',
      text: `Bicolore 5-5 au moins à ${pairTxt(dear2)}, environ 11 points H utiles.` }), bic(dear2)));
    o.push(opt('3C', M('Bicolore : les 2 couleurs extrêmes', { pts: [8, 15], unit: 'H', len: ln({ [dn(ext[0])]: [5, 13], [dn(ext[1])]: [5, 13] }), alert: true, fiche: '10',
      text: `Bicolore 5-5 au moins à ${pairTxt(ext)}, environ 11 points H utiles.` }), h => od !== 'C' && bic(ext)(h)));
  }
  // Interventions à saut : barrages
  for (const s of [0, 1, 2, 3]) {
    if (opp.includes(s)) continue;
    const ch = cheapest(c, dn(s));
    if (!ch) continue;
    const j1 = bidOf(levelOf(ch) + 1, s);
    if (levelOf(j1) === 2 && s <= 1) o.push(opt(j1, M('Intervention à saut (faible)', { pts: [6, 10], unit: 'H', len: ln({ [dn(s)]: [6, 6] }), fiche: '10',
      text: `Barrage : 6 cartes à ${nm(s)} avec 2 honneurs, 10 points H au plus.` }), h => L(h, s) === 6 && hcp(h) >= 6 && hcp(h) <= 10 && honors(h, s) >= 2));
    for (const [lv, n] of [[3, 7], [4, 8]]) {
      const call = bidOf(lv, s);
      if (bidRank(call) <= bidRank(ch)) continue;
      o.push(opt(call, M('Barrage au palier de ' + lv, { pts: [6, 10], unit: 'H', len: ln({ [dn(s)]: [n, 13] }), fiche: '10',
        text: `Barrage : ${n} cartes à ${nm(s)}, jeu faible.` }), h => (lv === 3 ? L(h, s) === 7 : L(h, s) >= 8) && hcp(h) >= 5 && hcp(h) <= 10));
    }
  }
  // Interventions simples
  const bestS = h => { const l = lens(h); const c2 = [0, 1, 2, 3].filter(s => !opp.includes(s) && l[s] >= 5).sort((a, b) => l[b] - l[a] || a - b); return c2.length ? c2[0] : -1; };
  for (const s of [0, 1, 2, 3]) {
    if (opp.includes(s)) continue;
    const call = cheapest(c, dn(s));
    if (!call) continue;
    if (levelOf(call) === 1) o.push(opt(call, M('Intervention au palier de 1', { pts: [9, 17], unit: 'HL', len: ln({ [dn(s)]: [5, 13] }), fiche: '10',
      text: `Au moins 5 cartes à ${nm(s)}. Valeur d'ouverture (13 à 17 HL), ou 11-12 HL avec une bonne couleur, ou 9-11 HL pour gêner.` }),
      h => L(h, s) >= 5 && HL(h) >= (direct ? 9 : 11) && HL(h) <= 17 && bestS(h) === s));
    else if (levelOf(call) === 2) o.push(opt(call, M('Intervention au palier de 2 (sans saut)', { pts: [12, 17], unit: 'HL', len: ln({ [dn(s)]: [5, 13] }), fiche: '10',
      text: `Valeur d'ouverture et belle couleur de 6 cartes à ${nm(s)} (ou 5 cartes très solides).` }),
      h => HL(h) >= 12 && HL(h) <= 17 && ((L(h, s) >= 6 && robust(h, s)) || (L(h, s) === 5 && honors(h, s) >= 3)) && bestS(h) === s));
  }
  o.push(opt('P', M('Passe', { fiche: '10', text: 'Pas d\'intervention possible.' }), () => true));
  return o;
}
function over1NOpts(c) {
  const o = [opt('X', M('Contre punitif', { pts: [16, 37], unit: 'H', fiche: '10', text: 'Au moins 16 points H : pour faire chuter le contrat.' }), h => hcp(h) >= 16)];
  for (const s of [0, 1, 2, 3]) o.push(opt('2' + dn(s), M('Intervention naturelle', { pts: [10, 15], unit: 'HL', len: ln({ [dn(s)]: [6, 13] }), fiche: '10', text: `Au moins 6 cartes à ${nm(s)}.` }),
    h => L(h, s) >= 6 && HL(h) >= 10 && robust(h, s) && lens(h).every((n, t) => n <= L(h, s) || t === s)));
  o.push(opt('P', M('Passe', { fiche: '10' }), () => true));
  return o;
}
function overPreemptOpts(c) {
  const od = c.seq[0][1], os = DEN_SUIT[od];
  const o = [];
  o.push(opt('3N', M('3SA', { pts: [16, 19], unit: 'H', fiche: '10', conclusion: true, text: `16 à 19 points H avec un arrêt à ${nm(os)}.` }),
    h => hcp(h) >= 16 && hcp(h) <= 19 && stopper(h, os) && isRegular(h) && bidRank('3N') > bidRank(c.st.lastBid)));
  o.push(opt('X', M('Contre d\'appel', { pts: [13, 37], unit: 'HL', len: ln({ [od]: [0, 2] }), fiche: '10', text: `Au moins 13 points HL, au plus 2 cartes à ${nm(os)}, soutien dans les autres couleurs.` }),
    h => HL(h) >= 13 && L(h, os) <= 2 && [0, 1].every(s => s === os || L(h, s) >= 3)));
  for (const s of [0, 1, 2, 3]) {
    if (s === os) continue;
    const call = cheapest(c, dn(s));
    if (!call || levelOf(call) > 4) continue;
    o.push(opt(call, M('Intervention naturelle', { pts: [14, 37], unit: 'HL', len: ln({ [dn(s)]: [6, 13] }), fiche: '10', text: `Au moins 6 cartes à ${nm(s)} et 14 points HL ou plus.` }),
      h => L(h, s) >= 6 && HL(h) >= 14));
  }
  o.push(opt('P', M('Passe', { fiche: '10' }), () => true));
  return o;
}
function respToDoubleOpts(c, od) {
  const os = DEN_SUIT[od];
  const majors = [1, 0].filter(s => s !== os);
  const m4 = h => majors.filter(s => L(h, s) >= 4);
  const cue = cheapest(c, od);
  const o = [];
  const hp = hcp;
  o.push(opt('P', M('Passe : contre transformé en punitif', { pts: [8, 37], unit: 'H', len: ln({ [od]: [5, 13] }), fiche: '13',
    text: `Exceptionnel : au moins 8 points H et 5 bonnes cartes à ${nm(os)} (3 levées sûres). Le contre devient punitif.` }), h => hp(h) >= 8 && L(h, os) >= 5 && bigHonors(h, os) >= 2));
  // Zone forte (11 H et plus)
  o.push(opt(cue, M('Cue-bid', { pts: [11, 37], unit: 'H', forcing: 1, alert: true, fiche: '13',
    text: '11 points H et plus : demande au contreur sa Majeure ou des précisions sur sa force et sa distribution.' }),
    h => hp(h) >= 11 && ((m4(h).length >= 1 && m4(h).every(s => L(h, s) === 4)) || (m4(h).length === 0 && (hp(h) >= 15 || !stopper(h, os))))));
  for (const s of majors) {
    o.push(opt('4' + dn(s), M('Manche', { pts: [8, 37], unit: 'H', len: ln({ [dn(s)]: [5, 13] }), fiche: '13', conclusion: true,
      text: `5 cartes à ${nm(s)} et 11 points H ou plus, ou 6 cartes et 8 points H ou plus.` }), h => (L(h, s) >= 5 && hp(h) >= 11) || (L(h, s) >= 6 && hp(h) >= 8)));
  }
  o.push(opt('3N', M('3SA', { pts: [12, 14], unit: 'H', fiche: '13', conclusion: true, text: `12 à 14 points H, arrêt à ${nm(os)}, pas de Majeure de 4 cartes.` }),
    h => m4(h).length === 0 && stopper(h, os) && hp(h) >= 12 && hp(h) <= 14));
  o.push(opt('2N', M('2SA', { pts: [11, 11], unit: 'H', fiche: '13', text: `11 points H, arrêt à ${nm(os)}, pas de Majeure de 4 cartes.` }),
    h => m4(h).length === 0 && stopper(h, os) && hp(h) === 11));
  // Zone moyenne (8-10 H)
  for (const s of majors) {
    const ch = cheapest(c, dn(s));
    o.push(opt(bidOf(3, s), M('5 cartes, 8 à 10 points', { pts: [8, 10], unit: 'H', len: ln({ [dn(s)]: [5, 5] }), fiche: '13', text: `5 cartes à ${nm(s)} et 8 à 10 points H.` }), h => L(h, s) === 5 && hp(h) >= 8 && hp(h) <= 10));
    const jump = bidOf(levelOf(ch) + 1, s);
    if (levelOf(jump) === 2) o.push(opt(jump, M('4 cartes, 8 à 10 points', { pts: [8, 10], unit: 'H', len: ln({ [dn(s)]: [4, 4] }), fiche: '13', text: `4 cartes à ${nm(s)} et 8 à 10 points H.` }),
      h => L(h, s) === 4 && hp(h) >= 8 && hp(h) <= 10 && !(majors.length === 2 && m4(h).length === 2)));
  }
  if (majors.length === 2) o.push(opt(cue, o.find(x => x.call === cue).m, h => m4(h).length === 2 && hp(h) >= 8));
  o.push(opt('1N', M('1SA', { pts: [8, 10], unit: 'H', fiche: '13', text: `8 à 10 points H, arrêt à ${nm(os)}, pas de Majeure de 4 cartes.` }),
    h => m4(h).length === 0 && stopper(h, os) && hp(h) >= 8 && hp(h) <= 10 && isLegal('1N', c.auction, c.dealer)));
  // Zone faible (0-7 H)
  for (const s of majors) {
    const ch = cheapest(c, dn(s));
    o.push(opt(ch, M('Réponse obligatoire : 4 cartes', { pts: [0, 7], unit: 'H', len: ln({ [dn(s)]: [4, 13] }), fiche: '13', text: `4 cartes ou plus à ${nm(s)}, 0 à 7 points H.` }),
      h => L(h, s) >= 4 && (m4(h).length === 1 || L(h, s) > L(h, majors.find(x => x !== s)) || (L(h, s) === L(h, majors.find(x => x !== s)) && s === 1))));
  }
  if (od === 'C') o.push(opt('1D', M('Réponse obligatoire : carreaux', { pts: [0, 7], unit: 'H', len: ln({ D: [4, 13], H: [0, 3], S: [0, 3] }), fiche: '13', text: '4 cartes à Carreau, pas de Majeure de 4 cartes.' }), h => L(h, 2) >= 4));
  if (od === 'D') o.push(opt('2C', M('Réponse obligatoire : 5 trèfles', { pts: [0, 7], unit: 'H', len: ln({ C: [5, 13], H: [0, 3], S: [0, 3] }), fiche: '13', text: 'Exceptionnel : 5 cartes à Trèfle, pas de Majeure de 4 cartes.' }), h => L(h, 3) >= 5));
  for (const s of majors) {
    const ch = cheapest(c, dn(s));
    o.push(opt(ch, M('Couleur au palier le plus bas', { pts: [0, 7], unit: 'H', len: ln({ [dn(s)]: [3, 3] }), fiche: '13', text: `Réponse obligatoire au palier le plus bas : 3 cartes à ${nm(s)}.` }), h => L(h, s) >= 3));
  }
  for (const s of [3, 2, 1, 0]) {
    if (s === os) continue;
    const ch = cheapest(c, dn(s));
    o.push(opt(ch, M('Réponse obligatoire', { pts: [0, 7], unit: 'H', fiche: '13', text: `Réponse obligatoire : la couleur la moins mauvaise (${nm(s)}).` }), h => L(h, s) >= 3));
  }
  return o;
}
function advanceBicoloreOpts(c, pm) {
  const pair = [0, 1, 2, 3].filter(s => pm.len[s][0] >= 5);
  if (pair.length !== 2) return null;
  const o = [];
  const better = h => (L(h, pair[0]) > L(h, pair[1]) || (L(h, pair[0]) === L(h, pair[1]) && pair[0] > pair[1])) ? pair[0] : pair[1];
  for (const s of pair) {
    const g = bidOf(s <= 1 ? 4 : 5, s);
    if (isLegal(g, c.auction, c.dealer)) o.push(opt(g, M('Manche dans une couleur du bicolore', { len: ln({ [dn(s)]: [3, 13] }), fiche: '10', conclusion: true,
      text: `Fit à ${nm(s)} et assez de points pour la manche.` }), h => L(h, s) >= 3 && better(h) === s && HLD(h, s) >= (s <= 1 ? 12 : 15)));
  }
  for (const s of pair) {
    const b = cheapest(c, dn(s));
    if (b) o.push(opt(b, M('Choix d\'une couleur du bicolore', { fiche: '10', text: `Le partenaire a montré ${nm(pair[0])} et ${nm(pair[1])} : on choisit ${nm(s)}, la meilleure des deux.` }), h => better(h) === s));
  }
  return o;
}
function advanceOvercallOpts(c) {
  const od = c.seq[0][1], os = DEN_SUIT[od], pc = c.seq[1], ps = DEN_SUIT[denOf(pc)];
  const pd = denOf(pc);
  const o = [];
  const p = h => HLD(h, ps);
  if (ps <= 1) o.push(opt('4' + pd, M('Soutien à la manche', { pts: [13, 37], unit: 'HLD', len: ln({ [pd]: [3, 13] }), fiche: '10', conclusion: true, text: `Au moins 3 cartes à ${nm(ps)} et 13 points ou plus.` }), h => L(h, ps) >= 3 && p(h) >= 13));
  const r1 = cheapest(c, pd), r2 = bidOf(levelOf(r1) + 1, ps);
  if (levelOf(r2) <= 3) o.push(opt(r2, M('Soutien à saut', { pts: [11, 12], unit: 'HLD', len: ln({ [pd]: [3, 13] }), fiche: '10', text: `Au moins 3 cartes à ${nm(ps)}, 11 ou 12 points.` }), h => L(h, ps) >= 3 && p(h) >= 11));
  o.push(opt(r1, M('Soutien simple', { pts: [6, 10], unit: 'HLD', len: ln({ [pd]: [3, 13] }), fiche: '10', text: `Au moins 3 cartes à ${nm(ps)}, 6 à 10 points.` }), h => L(h, ps) >= 3 && p(h) >= 6));
  for (const [call, a, b] of [['3N', 13, 15], ['2N', 11, 12], ['1N', 8, 10]]) {
    if (!isLegal(call, c.auction, c.dealer)) continue;
    o.push(opt(call, M(callTxt(call), { pts: [a, b], unit: 'H', fiche: '10', conclusion: call === '3N', text: `${a} à ${b} points H avec un arrêt à ${nm(os)}.` }), h => stopper(h, os) && hcp(h) >= a && hcp(h) <= b));
  }
  for (const s of [0, 1, 2, 3]) {
    if (s === os || s === ps) continue;
    const call = cheapest(c, dn(s));
    if (!call || levelOf(call) > 2) continue;
    o.push(opt(call, M('Nouvelle couleur', { pts: [8, 16], unit: 'HL', len: ln({ [dn(s)]: [5, 13] }), fiche: '10', text: `Au moins 5 cartes à ${nm(s)}, sans fit.` }), h => L(h, s) >= 5 && L(h, ps) <= 2 && HL(h) >= 8));
  }
  o.push(opt('P', M('Passe', { fiche: '10', text: 'Pas de fit et pas assez de points.' }), () => true));
  return o;
}

/* ====================================================================
   BLACKWOOD 5 CLÉS (fiche 08)
   ==================================================================== */
function agreedTrump(c, uptoIdx) {
  // couleur d'atout du camp : celle où les longueurs montrées par les deux partenaires font au moins 8 cartes,
  // sinon la couleur longue (6 cartes et plus, ou 5 cartes montrées) d'un des partenaires ; -1 si aucune (4SA quantitatif)
  const side = sideOf(c.seat);
  const mins = {};
  for (const x of c.calls) {
    if (x.i >= uptoIdx) break;
    if (sideOf(x.seat) !== side || x.call === 'P') continue;
    const m = explainAt(c.auction, c.dealer, x.i);
    const a = mins[x.seat] = mins[x.seat] || [0, 0, 0, 0];
    for (let s = 0; s < 4; s++) a[s] = Math.max(a[s], m.len[s][0]);
  }
  const seats = Object.keys(mins);
  let best = -1, bestTot = 0;
  for (let s = 0; s < 4; s++) {
    const tot = seats.reduce((t, k) => t + mins[k][s], 0);
    const one = Math.max(0, ...seats.map(k => mins[k][s]));
    if ((tot >= 8 || one >= 5) && tot > bestTot) { best = s; bestTot = tot; }
  }
  return best;
}
const keycards = (h, t) => aces(h) + (t >= 0 && h.includes(B.card(t, 11)) ? 1 : 0);
function blackwoodOpts(c) {
  const a = c.auction, n = a.length;
  // Réponse au 4SA du partenaire
  if (n >= 2 && a[n - 2] === '4N' && a[n - 1] === 'P') {
    const t = agreedTrump(c, n - 2);
    if (t < 0) return null;            // 4SA quantitatif : géré ailleurs
    const q = h => h.includes(B.card(t, 10));
    const mk = (call, name, f) => opt(call, M('Réponse au Blackwood : ' + name, { fiche: '08', alert: true, text: `Le partenaire a ${name} (As et Roi d'atout).` }), f);
    return [
      mk('5C', '0 ou 3 clés', h => [0, 3].includes(keycards(h, t))),
      mk('5D', '1 ou 4 clés', h => [1, 4].includes(keycards(h, t))),
      mk('5S', '2 clés avec la Dame d\'atout', h => keycards(h, t) === 2 && q(h)),
      mk('5H', '2 clés sans la Dame d\'atout', () => true),
    ];
  }
  // Décision après la réponse
  if (n >= 4 && a[n - 4] === '4N' && a[n - 3] === 'P' && a[n - 1] === 'P' && /^5[CDHS]$/.test(a[n - 2]) && (c.dealer + n - 4) % 4 === c.seat) {
    const t = agreedTrump(c, n - 4);
    if (t < 0) return null;
    const resp = a[n - 2];
    const pm = summarize(c, c.partner);
    const pk = h => {
      const mine = keycards(h, t);
      if (resp === '5C') return mine >= 3 ? 0 : (pm.min >= 12 || mine === 0 ? 3 : 0);
      if (resp === '5D') return mine >= 2 ? 1 : (pm.min >= 12 ? 4 : 1);
      return 2;
    };
    const missing = h => 5 - keycards(h, t) - pk(h);
    const d = dn(t);
    const o = [];
    const stop5 = bidOf(5, t);
    o.push(opt('7' + d, M('Grand chelem', { fiche: '08', conclusion: true, text: 'Aucune clé ne manque et le camp est très fort.' }), h => missing(h) <= 0 && HLD(h, t) + pm.min >= 37));
    o.push(opt('6' + d, M('Petit chelem', { fiche: '08', conclusion: true, text: 'Il ne manque pas plus d\'une clé.' }), h => missing(h) <= 1));
    if (bidRank(stop5) > bidRank(resp)) o.push(opt(stop5, M('Arrêt au palier de 5', { fiche: '08', conclusion: true, text: 'Il manque 2 clés : on s\'arrête au palier de 5.' }), () => true));
    else if (resp === stop5) o.push(opt('P', M('Passe : arrêt au palier de 5', { fiche: '08', text: 'Il manque 2 clés.' }), () => true));
    else o.push(opt('6' + d, M('Petit chelem', { fiche: '08', conclusion: true }), () => true));
    return o;
  }
  return null;
}

/* ====================================================================
   AIGUILLAGE
   ==================================================================== */
function systemOptions(c) {
  const bw = blackwoodOpts(c);
  if (bw) return bw;
  const s = c.s;
  const myBids = c.mine.filter(x => x.call !== 'P' && x.i >= c.openIdx).length;
  if (c.role === 'open') return openingOpts(c);
  if (c.role === 'responder') {
    if (myBids === 0) {
      if (/^1[HS] P$/.test(s)) return respMajor(c);
      if (/^1[CD] P$/.test(s)) return respMinor(c);
      if (s === '1N P') return resp1N(c);
      if (s === '2N P') return resp2N(c);
      if (s === '2C P') return resp2C(c);
      if (s === '2D P') return resp2D(c);
      if (/^2[HS] P$/.test(s)) return respWeak2(c);
      if (/^[34][CDHS] P$/.test(s)) return respBarrage(c);
      if (/^1[CDHS] (X|1[DHSN]|2[CDHSN]|3[CDHS])$/.test(s)) return respAfterInterf(c);
      return null;
    }
    if (myBids === 1) {
      if (/^1N P/.test(s)) return responder1NCont(c);
      if (/^2N P/.test(s)) return responder2NCont(c);
      if (/^2C P 2D P/.test(s)) return responder2CCont(c);
    }
    if (/^2N P/.test(s)) return responder2NCont(c);
    if (/^1N P/.test(s)) return responder1NCont(c);
    return null;
  }
  if (c.role === 'opener') {
    const myCount = c.mine.filter(x => x.i >= c.openIdx).length;
    if (myCount === 1) {
      if (/^1[CDHS] P \S+ P$/.test(s)) return openerRebid1(c);
      if (/^1N P \S+ P$/.test(s)) return opener1NRebid(c);
      if (/^2N P \S+ P$/.test(s)) return opener2NRebid(c);
      if (/^2C P \S+ P$/.test(s)) return opener2CRebid(c);
      if (/^2D P \S+ P$/.test(s)) return opener2DRebid(c);
      if (/^2[HS] P \S+ P$/.test(s)) return openerWeak2Rebid(c);
      return null;
    }
    if (myCount === 2) {
      if (/^1N P/.test(s)) return opener1NThird(c);
      if (/^2N P/.test(s)) return responder2NCont(c);
    }
    return null;
  }
  // Défense
  const partnerActed = c.part.some(x => x.call !== 'P');
  const iActed = c.mine.some(x => x.call !== 'P' && x.i > c.openIdx);
  if (!partnerActed && !iActed) {
    if (/^1[CDHS]( P P)?$/.test(s)) return overcallOpts(c);
    if (/^1[CDHS] P (1[DHSN]|2[CDH])$/.test(s)) return overcallOpts(c);
    if (/^1N( P P)?$/.test(s)) return over1NOpts(c);
    if (/^(2[HS]|3[CDHS])( P P)?$/.test(s)) return overPreemptOpts(c);
    return null;
  }
  if (partnerActed && !iActed) {
    let m;
    const pm = summarize(c, c.partner);
    if (c.auction[c.n - 1] === 'P' && [0, 1, 2, 3].filter(t => pm.len[t][0] >= 5).length === 2) {
      const bo = advanceBicoloreOpts(c, pm);
      if (bo) return bo;
    }
    if ((m = /^1([CDHS]) X P$/.exec(s)) || (m = /^1([CDHS]) P P X P$/.exec(s))) return respToDoubleOpts(c, m[1]);
    if (/^1[CDHS] (1[DHS]|2[CDHS]) P$/.test(s) && c.seq[1] !== '2' + c.seq[0][1]) return advanceOvercallOpts(c);
  }
  return null;
}

/* ====================================================================
   MOTEUR GÉNÉRAL (suites non couvertes par les fiches)
   ==================================================================== */
function gameLevelOf(d) { return d === 'N' ? 3 : (d === 'H' || d === 'S') ? 4 : 5; }
function genericDecide(c, h) {
  const st = c.st, lb = st.lastBid;
  const l = lens(h);
  const side = sideOf(c.seat);
  const oppSuits = natSuitsOf(c, 1 - side);
  const P = { call: 'P' };
  if (!c.ourActive) {
    // Le camp n'a encore rien dit : intervention tardive seulement avec une main forte
    if (lb && levelOf(lb) <= 2) {
      const cand = [0, 1, 2, 3].filter(s => !oppSuits.includes(s) && l[s] >= 5).sort((a, b) => l[b] - l[a]);
      if (cand.length && HL(h) >= 14) { const b = cheapest(c, dn(cand[0])); if (b && levelOf(b) <= 2) return { call: b }; }
      if (HL(h) >= 17 && oppSuits.every(s => l[s] <= 2) && isLegal('X', c.auction, c.dealer)) return { call: 'X' };
    }
    return P;
  }
  const pm = summarize(c, c.partner);
  const mm = summarize(c, c.seat);
  const lastIsOurs = lb && sideOf(st.lastBidSeat) === side;
  const rhoCall = c.auction[c.n - 1];
  const forcedNow = pm.lastIdx === c.n - 2 && pm.lastForcing >= 1 && rhoCall === 'P';
  // fit
  let trump = -1, best = 0;
  for (let s = 0; s < 4; s++) {
    const tot = l[s] + pm.len[s][0];
    if (tot >= 8 && !oppSuits.includes(s)) { const sc = tot + (s <= 1 ? 1.5 : 0); if (sc > best) { best = sc; trump = s; } }
  }
  const my = trump >= 0 ? HLD(h, trump) : HL(h);
  const tMin = my + pm.min, tMax = my + Math.min(pm.max, 37);
  // dénomination
  const ntStops = oppSuits.every(s => stopper(h, s) || pm.len[s][0] >= 4);
  const shortness = l.some(n => n <= 1);
  let den;
  if (trump >= 0 && trump <= 1) den = dn(trump);
  else if (ntStops && (!shortness || (lastIsOurs && denOf(lb) === 'N'))) den = 'N';
  else if (trump >= 0) den = dn(trump);
  else {
    const long = [0, 1, 2, 3].filter(s => l[s] >= 6 && !oppSuits.includes(s));
    den = long.length ? dn(long[0]) : 'N';
  }
  if ((den === 'C' || den === 'D') && ntStops && !l.some(n => n === 0)) den = 'N';
  const gl = gameLevelOf(den);
  const gfActive = (pm.gf || mm.gf) && !(lastIsOurs && levelOf(lb) >= gameLevelOf(denOf(lb)));
  // seuils de manche de la fiche 08 : 3SA ≥ 25 H, 4♥/4♠ ≥ 27 HS, 5♣/5♦ ≥ 30 HS (points de soutien compris)
  const need = gl === 5 ? 30 : den === 'N' ? 25 : 27;
  let goal;
  if (tMin >= 33 && (trump >= 0 || den === 'N')) goal = 'slam';
  else if (tMin >= need || gfActive) goal = 'game';
  else if (tMin >= need - 4 && my + Math.min(pm.max, pm.min + 8) >= need + 1 && pm.max - pm.min >= 2) goal = 'invite';
  else goal = 'part';
  // un partenaire qui a conclu : on passe sauf chelem
  const pLast = pm.lastIdx >= 0 ? explainAt(c.auction, c.dealer, pm.lastIdx) : null;
  if (lastIsOurs && pLast && pLast.conclusion && goal !== 'slam' && !forcedNow) return P;
  // proposition de manche du partenaire : on accepte dans le haut de sa fourchette
  if (lastIsOurs && pLast && pLast.invite && pm.lastIdx === c.n - 2 && goal !== 'slam') {
    const mid = (mm.min + Math.min(mm.max, mm.min + 8)) / 2;
    const mine = trump >= 0 ? HLD(h, trump) : HL(h);
    const g = gl + den;
    if ((mine >= mid || tMin >= need) && isLegal(g, c.auction, c.dealer)) return { call: g };
    return P;
  }
  const legal = b => b && isLegal(b, c.auction, c.dealer);
  if (goal === 'slam') {
    if (den !== 'N') {
      const asked = c.calls.some(x => x.call === '4N' && sideOf(x.seat) === side);
      if (!asked && legal('4N')) return { call: '4N' };
      const sl = (tMin >= 37 ? '7' : '6') + den;
      if (legal(sl)) return { call: sl };
    } else {
      const sl = tMin >= 37 ? '7N' : '6N';
      if (legal(sl)) return { call: sl };
    }
    goal = 'game';
  }
  const target = goal === 'game' ? gl + den : goal === 'invite' ? (gl - 1) + den : null;
  if (lastIsOurs) {
    const cur = lb;
    if (goal === 'part' && !forcedNow) {
      const cs = denOf(cur) === 'N' ? -1 : DEN_SUIT[denOf(cur)];
      const ok = denOf(cur) === 'N' ? !l.some(n => n === 0) : (l[cs] >= 2 || cs === trump);
      if (ok || levelOf(cur) >= 3) return P;
      const b = cheapest(c, den);
      if (legal(b) && levelOf(b) <= 2 && den !== 'N' && l[DEN_SUIT[den]] >= 6) return { call: b };
      return P;
    }
    if (target) {
      if (bidRank(cur) >= bidRank(target) && !forcedNow) {
        if (denOf(cur) === den || goal === 'invite') return P;
        if (levelOf(cur) >= gameLevelOf(denOf(cur))) return P;
      }
      if (legal(target)) return { call: target };
      const g = gl + den;
      if (goal === 'invite' && legal(g) && tMin >= need - 1) return { call: g };
      if (!forcedNow) return P;
    }
    // forcé de parler
    const opts = [];
    if (trump >= 0) opts.push(cheapest(c, dn(trump)));
    const myLong = [0, 1, 2, 3].sort((a, b) => l[b] - l[a])[0];
    opts.push(cheapest(c, dn(myLong)));
    opts.push(cheapest(c, 'N'));
    for (const b of opts) if (legal(b) && levelOf(b) <= Math.max(3, gl)) return { call: b };
    return P;
  }
  // l'adversaire a la dernière enchère : compétition
  if (target && goal === 'game') {
    const g = gl + den;
    if (legal(g)) return { call: g };
  }
  if (trump >= 0) {
    const tot = l[trump] + pm.len[trump][0];
    const b = cheapest(c, dn(trump));
    if (legal(b) && levelOf(b) <= tot - 6 && levelOf(b) <= 3 && tMin >= 17) return { call: b };
  }
  if (lb && levelOf(lb) >= 2 && tMin >= 22 && isLegal('X', c.auction, c.dealer)) {
    const ts = denOf(lb) === 'N' ? -1 : DEN_SUIT[denOf(lb)];
    if (ts < 0 ? hcp(h) >= 10 : (l[ts] >= 3 && honors(h, ts) >= 1) || l[ts] >= 4) return { call: 'X' };
  }
  if (forcedNow) {
    const b = cheapest(c, den);
    if (legal(b)) return { call: b };
  }
  return P;
}

function genericMeaning(c, call) {
  const side = sideOf(c.seat);
  const st = c.st, lb = st.lastBid;
  const oppSuits = natSuitsOf(c, 1 - side);
  if (call === 'P') return M('Passe', { text: 'Pas d\'enchère utile à ajouter.' });
  if (call === 'XX') return M('Surcontre', { pts: [10, 37], unit: 'H', text: 'Main forte : au moins 10 points H.' });
  if (call === 'X') {
    if (c.ourActive || (lb && levelOf(lb) >= 3)) return M('Contre punitif', { text: 'Contre pour faire chuter les adversaires : le camp a la majorité des points.' });
    const ts = lb && denOf(lb) !== 'N' ? DEN_SUIT[denOf(lb)] : -1;
    return M('Contre d\'appel', { pts: [12, 37], unit: 'HL', len: ts >= 0 ? ln({ [dn(ts)]: [0, 2] }) : undefined, fiche: '10',
      text: 'Valeur d\'ouverture, courte dans la couleur adverse : le partenaire doit choisir une couleur.' });
  }
  const d = denOf(call), lv = levelOf(call);
  const ourSuitsBy = seat => c.calls.filter(x => x.seat === seat && isBid(x.call) && denOf(x.call) !== 'N').map(x => DEN_SUIT[denOf(x.call)]);
  const pSuits = ourSuitsBy(c.partner), mySuits = ourSuitsBy(c.seat);
  if (call === '4N') {
    const t = agreedTrump(c, c.n);
    if (t >= 0) return blackwoodM(t);
    return M('Proposition de chelem à Sans-Atout', { text: 'Invitation au chelem : le partenaire dit 6SA s\'il est maximum.' });
  }
  const isGame = lv >= gameLevelOf(d);
  const slam = lv >= 6;
  if (d === 'N') {
    if (slam) return M(lv === 7 ? 'Grand chelem à Sans-Atout' : 'Petit chelem à Sans-Atout', { conclusion: true, text: 'Le camp a assez de points pour le chelem.' });
    if (lv === 2 && c.ourActive) return M('2SA : proposition de manche', { invite: true, text: 'Proposition de manche à Sans-Atout' +
      (oppSuits.length ? `, avec un arrêt à ${oppSuits.map(nm).join(' et à ')}` : '') + ' : le partenaire dit 3SA s\'il est dans le haut de sa fourchette.' });
    return M(callTxt(call), { conclusion: isGame, text: (isGame ? 'Conclusion à la manche à Sans-Atout' : 'Enchère à Sans-Atout') +
      (oppSuits.length ? `, avec un arrêt à ${oppSuits.map(nm).join(' et à ')}.` : '.') });
  }
  const s = DEN_SUIT[d];
  if (oppSuits.includes(s) && !pSuits.includes(s) && !mySuits.includes(s))
    return M('Cue-bid', { forcing: 1, text: `Enchère dans la couleur adverse : main forte, le partenaire doit préciser son jeu.` });
  if (slam) return M((lv === 7 ? 'Grand' : 'Petit') + ' chelem à ' + nm(s), { conclusion: true, text: 'Le camp a assez de points et de contrôles pour le chelem.' });
  const invite = !isGame && lv === gameLevelOf(d) - 1;
  if (pSuits.includes(s)) {
    const pShown = summarize(c, c.partner).len[s][0];
    const sup = Math.min(4, Math.max(3, 8 - pShown));
    return M(isGame ? 'Conclusion à la manche' : invite ? 'Soutien : proposition de manche' : 'Soutien', { len: ln({ [d]: [sup, 13] }), conclusion: isGame, invite,
      text: isGame ? `Le camp a assez pour la manche, avec un fit à ${nm(s)}.` : `Soutien de la couleur du partenaire (${nm(s)}, au moins ${sup} cartes)` + (invite ? ' : le partenaire dit la manche s\'il est dans le haut de sa fourchette.' : '.') });
  }
  if (mySuits.includes(s)) return M(isGame ? 'Conclusion à la manche' : 'Répétition', { len: ln({ [d]: [6, 13] }), conclusion: isGame,
    text: `Couleur longue à ${nm(s)} (au moins 6 cartes).` });
  return M('Nouvelle couleur', { len: ln({ [d]: [4, 13] }), conclusion: isGame, text: `Enchère naturelle : au moins 4 ou 5 cartes à ${nm(s)}.` });
}

/* ====================================================================
   API
   ==================================================================== */
function decide(hand, auction, dealer) {
  const c = ctx(auction, dealer);
  const opts = systemOptions(c);
  if (opts) for (const o of opts) {
    if (!isLegal(o.call, auction, dealer)) continue;
    let ok = false;
    try { ok = o.ok(hand); } catch (e) { ok = false; }
    if (ok) return { call: o.call, m: o.m || genericMeaning(c, o.call), sure: true };
  }
  const g = genericDecide(c, hand);
  const call = isLegal(g.call, auction, dealer) ? g.call : 'P';
  return { call, m: explainCall(auction, dealer, call), sure: false };
}
function explainCall(auction, dealer, call) {
  return explainAt(auction.concat([call]), dealer, auction.length);
}
function explain(auction, dealer, i) { return explainAt(auction, dealer, i); }

// Texte lisible des longueurs et des points d'un sens d'enchère
function lenText(r) {
  const [a, b] = r;
  if (a === 0 && b >= 13) return 'Pas d\'indication';
  if (a === b) return a === 0 ? 'Aucune carte' : `Exactement ${a} carte${a > 1 ? 's' : ''}`;
  if (b >= 13) return `Au moins ${a} cartes`;
  if (a === 0) return `Au plus ${b} carte${b > 1 ? 's' : ''}`;
  return `Entre ${a} et ${b} cartes`;
}
function ptsText(m) {
  if (!m.pts) return null;
  const [a, b] = m.pts, u = ' points ' + m.unit;
  if (a === b) return a + u;
  if (b >= 37) return 'Au moins ' + a + u;
  if (a === 0) return 'Au plus ' + b + u;
  return 'De ' + a + ' à ' + b + u;
}
function forcingText(m) {
  return m.forcing === 2 ? 'Forcing de manche' : m.forcing === 1 ? 'Forcing (le partenaire doit reparler)' : null;
}

Object.assign(B, { FICHES, decide, explain, explainCall, lenText, ptsText, forcingText, bidCtx: ctx, summarizeSeat: summarize });
})();
