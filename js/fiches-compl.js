/* Le Bridge de Marianne — fiches complémentaires C1 à C5 (règles des robots et du Conseil).
   Ces fiches ne sont pas celles du cours de Roger : elles couvrent les situations que ses fiches ne traitent pas.
   Chaque module remplit B.COMPL.Cx(c) ; bidding.js les consulte quand aucune fiche du cours ne s'applique.
   Fichier assemblé : ne pas le modifier ici, mais dans source/fiches-compl/compl-C1.js … compl-C5.js, puis zsh source/fiches-compl/assembler.sh. */

/* ===================== Fiche complémentaire C1 ===================== */
/* Fiche complémentaire C1 — La suite des enchères sans intervention.
   Notre camp a ouvert, les adversaires n'ont fait que passer : 2e enchère du répondant, 3e enchère de l'ouvreur
   et la suite, après n'importe quelle ouverture. Les règles suivent la fiche (source/lot2-generateur/dC1_suite.py) :
   - le partenaire a conclu (manche, enchère d'arrêt) : Passe, sauf chelem (mes points + son minimum ≥ 33 :
     4SA Blackwood avec un fit, fiche 08 ; 6SA sans fit) ;
   - forcing de manche (2♦, saut en nouvelle couleur, réponse positive à 2♣, 4e couleur…) : jusqu'à la manche,
     4♥/4♠ avec un fit, sinon 3SA ;
   - points (les deux joueurs, fiches 04 et 16) : HLD quand le camp a un fit en majeure, sinon HL ;
   - après une ouverture de 1 à la couleur, 2e enchère du répondant : 6-10 arrêt (répétition 6e, préférence
     mineure avec 4 cartes et plus, 1SA), 11-12 proposition (répétition à saut 6e, sinon 2SA), 13 et plus manche
     (ou 4e couleur forcing) ; avec un fit en majeure, en HLD (« additionnez… 27 ») : arrêt jusqu'à 11, proposition
     avec 12 à 14, manche avec 15 et plus (13 si l'ouvreur a déjà soutenu au palier de 3) ;
     si l'ouvreur a montré une main forte (au moins 15 points) : manche avec 9 et plus ;
     chelem d'abord : 4SA Blackwood avec un atout convenu, 6SA (7SA) sans fit si H + son minimum ≥ 33 (37) ;
   - 3e enchère de l'ouvreur : proposition acceptée avec 14 points et plus (4♥/4♠ avec un fit majeur, sinon 3SA) ;
     après un arrêt du répondant : passe, 17-18 proposition, 19 et plus manche ; après la 4e couleur, il décrit sa main ;
   - ailleurs (suites des autres ouvertures que les fiches ne prévoient pas) : additionner mes points et le minimum
     du partenaire : manche à 27 HLD avec un fit en majeure, à 25 H sinon (3SA) ; sinon passe. */
(function () {
'use strict';
const B = globalThis.B;
const { M, opt, ln, L, nm, dn, cheapest, summarize, gameLevelOf, agreedTrump, explainAt } = B.BH;
const { lens, hcp, HL, HLD, stopper, isBid, levelOf, denOf, bidRank, isLegal, DEN_SUIT } = B;

const F = 'C1';
const ACC = 9;   // le répondant dit la manche face à un ouvreur fort (15 points et plus) ou qui propose : 9 points et plus
const suitOfBid = b => (isBid(b) && denOf(b) !== 'N') ? DEN_SUIT[denOf(b)] : -1;
const isGameBid = b => isBid(b) && levelOf(b) >= gameLevelOf(denOf(b));
const major = t => t === 0 || t === 1;
const noShort = h => lens(h).every(n => n >= 2);
const legal = (c, b) => !!b && isLegal(b, c.auction, c.dealer);
const at = (c, b) => (legal(c, b) ? b : null);

/* ---------- Fits et points ---------- */
// couleurs où le camp a au moins 8 cartes (ma main + ce que le partenaire a montré), majeures d'abord
function fitsOf(h, pm) {
  return [0, 1, 2, 3].filter(t => L(h, t) + pm.len[t][0] >= 8)
    .sort((a, b) => (major(b) - major(a)) || ((L(h, b) + pm.len[b][0]) - (L(h, a) + pm.len[a][0])));
}
const majorFit = (h, pm) => { const f = fitsOf(h, pm).filter(major); return f.length ? f[0] : -1; };
// points : chacun compte HLD quand le camp a un fit en majeure (fiches 04 et 16 : « à l'atout, H + D »), sinon HL
const ptsOf = (h, pm) => { const t = majorFit(h, pm); return t >= 0 ? HLD(h, t) : HL(h); };
// minimum de points H du partenaire, pour les chelems à Sans-Atout (comptés en H) : une enchère annoncée en H
// garde son minimum ; annoncée en HL (ou HLD), on retire les points de longueur de ses couleurs connues
// (4♥ « 6 cartes et 19 points HL » ne promet que 17 H)
function minH(c, pm) {
  const lenPts = [0, 1, 2, 3].reduce((t, s) => t + Math.max(0, pm.len[s][0] - 4), 0);
  let best = 0;
  for (const x of c.calls) {
    if (x.seat !== c.partner || x.call === 'P') continue;
    const m = explainAt(c.auction, c.dealer, x.i);
    if (m && m.pts) best = Math.max(best, m.pts[0] - (m.unit === 'H' ? 0 : lenPts));
  }
  return Math.max(0, Math.min(best, pm.min));
}

/* ---------- Le partenaire a conclu (D9) : passe, sauf chelem ---------- */
function slamOpts(c, pm) {
  const o = [];
  const side = c.seat % 2;
  const usedBW = c.calls.some(x => x.seat % 2 === side && x.call === '4N');
  const t = agreedTrump(c, c.n);
  if (t >= 0 && !usedBW && legal(c, '4N'))
    o.push(opt('4N', M('Blackwood (5 clés)', { forcing: 1, alert: true, fiche: F,
      text: `Fit à ${nm(t)} et au moins 33 points dans le camp (mes points + le minimum du partenaire) : on demande les clés pour le chelem (fiche 08).` }),
      h => L(h, t) + pm.len[t][0] >= 8 && HLD(h, t) + pm.min >= 33));
  // sans fit (ni dans l'atout convenu, ni dans la dernière couleur du partenaire, ni en majeure) : 6SA / 7SA
  const nf = h => !fitSuit(c, h, pm);
  const mh = minH(c, pm), n7 = Math.max(0, 37 - mh), n6 = Math.max(0, 33 - mh);
  if (legal(c, '7N')) o.push(opt('7N', M('Grand chelem à Sans-Atout', { pts: [n7, 37], unit: 'H', fiche: F, conclusion: true,
    text: 'Pas de fit. Mes points H + le minimum du partenaire font 37 ou plus : grand chelem.' }), h => nf(h) && hcp(h) + mh >= 37));
  if (legal(c, '6N')) o.push(opt('6N', M('Petit chelem à Sans-Atout', { pts: [n6, Math.max(n6, n7 - 1)], unit: 'H', fiche: F, conclusion: true,
    text: 'Pas de fit. Mes points H + le minimum du partenaire font 33 ou plus : petit chelem.' }), h => nf(h) && hcp(h) + mh >= 33));
  return o;
}
// couleur où le camp a un fit (8 cartes) : l'atout convenu, la dernière couleur du partenaire, ou une majeure ; sinon null
function fitSuit(c, h, pm) {
  const lb = c.st.lastBid;
  const cand = [agreedTrump(c, c.n), suitOfBid(lb), majorFit(h, pm)];
  for (const s of cand) if (s >= 0 && L(h, s) + pm.len[s][0] >= 8) return { s };
  return null;
}
// le camp a les points du chelem : HLD avec un fit, sinon H (+ le minimum du partenaire)
const slamZone = (c, h, pm) => { const f = fitSuit(c, h, pm); return f ? HLD(h, f.s) + pm.min >= 33 : hcp(h) + minH(c, pm) >= 33; };
// chelem à Sans-Atout sans fit en majeure : mes points H + le minimum du partenaire font 33 (6SA) ou 37 (7SA)
function ntSlamOpts(c, pm) {
  const o = [];
  const mh = minH(c, pm), n7 = Math.max(0, 37 - mh), n6 = Math.max(0, 33 - mh);
  if (legal(c, '7N')) o.push(opt('7N', M('Grand chelem à Sans-Atout', { pts: [n7, 37], unit: 'H', fiche: F, conclusion: true,
    text: 'Pas de fit en majeure. Mes points H + le minimum du partenaire font 37 ou plus : grand chelem.' }),
    h => majorFit(h, pm) < 0 && hcp(h) + mh >= 37));
  if (legal(c, '6N')) o.push(opt('6N', M('Petit chelem à Sans-Atout', { pts: [n6, Math.max(n6, n7 - 1)], unit: 'H', fiche: F, conclusion: true,
    text: 'Pas de fit en majeure. Mes points H + le minimum du partenaire font 33 ou plus : petit chelem.' }),
    h => majorFit(h, pm) < 0 && hcp(h) + mh >= 33));
  return o;
}
function concludedOpts(c, pm, pc) {
  if (levelOf(pc) >= 6) return [opt('P', M('Passe', { fiche: F, text: 'Le partenaire a conclu au chelem : on passe.' }), () => true)];
  const o = slamOpts(c, pm);
  // deux Passes : la main n'a pas les points du chelem (le cas normal), ou elle les a sans moyen prévu d'y aller
  o.push(opt('P', M('Passe', { fiche: F, text: isGameBid(pc)
    ? 'Le partenaire a conclu à la manche. Mes points + son minimum n\'atteignent pas 33 : pas de chelem, on passe.'
    : 'Le partenaire a choisi le contrat (enchère d\'arrêt) : on passe.' }), h => !slamZone(c, h, pm)));
  o.push(opt('P', M('Passe', { fiche: F,
    text: 'Le partenaire a conclu. Le chelem est possible, mais ici on ne peut pas demander les As (pas d\'atout convenu, ou Blackwood déjà fait) : on s\'en tient à son contrat.' }), () => true));
  return o;
}

/* ---------- La manche : dans le fit majeur (ou ma majeure 6e), sinon 3SA ---------- */
function gameOpts(c, pm, ok, lo, own, extra, loFit) {
  // ok(h) : la main est dans la zone de manche ; lo : minimum de points annoncé ; own : ma couleur (6 cartes suffisent), ou -1
  // loFit(t) : minimum annoncé pour la manche dans le fit en majeure t (si différent de lo)
  const o = [];
  for (const t of [1, 0]) {
    const g = '4' + dn(t);
    if (!legal(c, g)) continue;
    const need = Math.max(2, 8 - pm.len[t][0]), mine = t === own ? Math.min(need, 6) : need;
    o.push(opt(g, M('Manche à ' + nm(t), { pts: [t === own || !loFit ? lo : loFit(t), 37], unit: 'HLD', len: ln({ [dn(t)]: [mine, 13] }), fiche: F, conclusion: true,
      text: `Fit à ${nm(t)} (8 cartes dans le camp)` + (t === own ? `, ou 6 cartes à ${nm(t)},` : '') + ' et assez de points pour la manche.' }),
      h => ok(h) && (majorFit(h, pm) === t || (t === own && majorFit(h, pm) < 0 && L(h, t) >= 6))));
  }
  if (extra) o.push(...extra);
  if (legal(c, '3N')) o.push(opt('3N', M('3SA', { pts: [lo, 37], unit: 'HL', fiche: F, conclusion: true,
    text: 'Pas de fit en majeure, assez de points pour la manche : 3SA.' }), h => ok(h)));
  return o;
}

/* ====================================================================
   2e enchère du répondant après une ouverture de 1 à la couleur
   ==================================================================== */
function responderRebid(c, pm) {
  const x = c.seq[0], r1 = c.seq[2], z = c.seq[4];
  const os = DEN_SUIT[x[1]], rs = suitOfBid(r1), zs = suitOfBid(z);
  const zm = explainAt(c.auction, c.dealer, c.openIdx + 4);
  const strong = zm.forcing === 2 || (zm.pts && zm.pts[0] >= 15);
  const o = [];
  const p = h => ptsOf(h, pm);
  const own6 = h => rs >= 0 && rs !== os && L(h, rs) >= 6;
  // chelem d'abord : 4SA Blackwood avec un atout convenu, sinon 6SA / 7SA sans fit en majeure (33 / 37 points)
  const slam = [...slamOpts(c, pm).filter(x => x.call === '4N'), ...ntSlamOpts(c, pm)];

  // --- l'ouvreur a montré une main forte, au moins 15 points (2SA, sauts, bicolore cher) : manche avec 9 points et plus, sinon arrêt
  if (strong) {
    const gf = zm.forcing === 2;
    const lo = gf ? 0 : ACC;
    const ok = h => gf || p(h) >= ACC;
    o.push(...slam);
    o.push(...gameOpts(c, pm, ok, lo, rs !== os ? rs : -1));
    if (zm.forcing >= 1) {
      // bicolore cher (forcing) avec 0 à 7 points : le palier le plus bas
      const weak = (name, txt, len) => M(name, { pts: [0, ACC - 1], unit: 'HL', len, fiche: F, text: txt });
      if (zs >= 0) { const b = cheapest(c, dn(zs)); if (b) o.push(opt(b, weak('Soutien, jeu minimum', `4 cartes à ${nm(zs)}, ${ACC - 1} points au plus : on s'arrête au palier le plus bas.`, ln({ [dn(zs)]: [4, 13] })), h => L(h, zs) >= 4)); }
      if (rs >= 0 && rs !== os) { const b = cheapest(c, dn(rs)); if (b && levelOf(b) === 2) o.push(opt(b, weak('Répétition, jeu minimum', `5 cartes à ${nm(rs)}, ${ACC - 1} points au plus.`, ln({ [dn(rs)]: [5, 13] })), h => L(h, rs) >= 5)); }
      const bx = cheapest(c, dn(os));
      if (bx) o.push(opt(bx, weak('Préférence, jeu minimum', `3 cartes à ${nm(os)}, ${ACC - 1} points au plus : retour à la 1re couleur de l'ouvreur.`, ln({ [dn(os)]: [3, 13] })), h => L(h, os) >= 3));
      const bn = cheapest(c, 'N');
      if (bn && levelOf(bn) === 2) o.push(opt(bn, weak('2SA, jeu minimum', `${ACC - 1} points au plus, sans fit : on s'arrête au palier le plus bas.`), () => true));
      if (bx) o.push(opt(bx, weak('Préférence, jeu minimum', `${ACC - 1} points au plus : retour à la 1re couleur de l'ouvreur.`), () => true));
      return o;
    }
    o.push(opt('P', M('Passe', { pts: [0, ACC - 1], unit: 'HL', fiche: F, text: `L'ouvreur a montré une main forte (au moins 15 points) et j'ai ${ACC - 1} points au plus : on s'arrête, le camp n'a pas la manche.` }), () => true));
    return o;
  }

  // --- l'ouvreur est minimum (12 à 14-15 points, ou bicolore économique, ou nouvelle couleur au palier de 1)
  // Avec un fit en majeure, on compte en HLD et l'on vise 27 (« additionnez » : 12 de l'ouvreur + 15) :
  // arrêt jusqu'à 11, proposition avec 12 à 14, manche avec 15 et plus. Sans fit en majeure (25 pour 3SA) :
  // arrêt jusqu'à 10, proposition avec 11 ou 12, manche avec 13 et plus.
  const fitM = h => majorFit(h, pm) >= 0;
  o.push(...slam);
  // Manche (13 points et plus ; 15 HLD et plus avec un fit en majeure)
  // l'ouvreur a déjà soutenu au palier de 3 (1♠ 2♥ 3♥) : plus de place pour proposer, la manche avec 13 et plus
  const noInv = t => !at(c, '3' + dn(t));
  const G = h => p(h) >= (fitM(h) && !noInv(majorFit(h, pm)) ? 15 : 13);
  const extra = [];
  // 4e couleur forcing : trois couleurs nommées, pas d'arrêt dans la quatrième
  const U = [0, 1, 2, 3].filter(t => t !== os && t !== rs && t !== zs);
  if (rs >= 0 && zs >= 0 && rs !== os && zs !== os && zs !== rs && U.length === 1) {
    const u = U[0], b = cheapest(c, dn(u));
    if (b && bidRank(b) < bidRank('3N'))
      extra.push(opt(b, M('4e couleur forcing', { pts: [13, 37], unit: 'HL', forcing: 2, alert: true, fiche: F,
        text: `13 points et plus, sans fit en majeure et sans arrêt à ${nm(u)} : forcing. L'ouvreur dit SA s'il a l'arrêt, sinon il décrit encore sa main.` }),
        h => G(h) && majorFit(h, pm) < 0 && !stopper(h, u) && !own6(h)));
  }
  o.push(...gameOpts(c, pm, G, 13, rs !== os ? rs : -1, extra, t => (noInv(t) ? 13 : 15)));

  // Proposition (11 ou 12 points HL ; 12 à 14 points HLD avec un fit en majeure)
  const I = h => fitM(h) ? p(h) >= 12 && p(h) <= 14 : p(h) >= 11 && p(h) <= 12;
  const inv = (call, name, txt, len, unit) => opt(call, M(name, { pts: [11, 12], unit: unit || 'HL', len, invite: true, fiche: F, text: txt + ' Proposition de manche : l\'ouvreur dit la manche avec 14 points et plus.' }), null);
  const fitRaise = t => { const b = at(c, '3' + dn(t)); return b; };
  for (const t of [1, 0]) {
    // ma propre majeure n'est « fittée » que si l'ouvreur l'a soutenue ; sinon, 3 dans ma majeure = répétition 6e (plus bas)
    if (t === rs && rs !== os && zs !== rs) continue;
    const b = fitRaise(t);
    if (b) { const q = inv(b, 'Soutien : proposition', `Fit à ${nm(t)}, 12 à 14 points HLD.`, ln({ [dn(t)]: [Math.max(2, 8 - pm.len[t][0]), 13] }), 'HLD'); q.m.pts = [12, 14]; q.ok = h => I(h) && majorFit(h, pm) === t; o.push(q); }
  }
  if (rs >= 0 && rs !== os && zs !== rs) {
    const b = at(c, '3' + dn(rs)), jump = levelOf(cheapest(c, dn(rs)) || '9N') < 3;
    if (b && !o.some(q => q.call === b)) { const q = inv(b, jump ? 'Répétition à saut : proposition' : 'Répétition : proposition', `Au moins 6 cartes à ${nm(rs)}, 11 ou 12 points HL.`, ln({ [dn(rs)]: [6, 13] })); q.ok = h => I(h) && majorFit(h, pm) < 0 && L(h, rs) >= 6; o.push(q); }
  }
  const n2 = at(c, '2N');
  let m2N = null;
  if (n2) { const q = inv('2N', '2SA : proposition', '11 ou 12 points, pas de fit en majeure.'); m2N = q.m; q.ok = h => I(h) && majorFit(h, pm) < 0 && noShort(h); o.push(q); }
  // fit mineur avec un singleton : soutien mineur au palier de 3
  for (const t of [2, 3]) {
    const b = fitRaise(t);
    if (b && !o.some(q => q.call === b)) { const q = inv(b, 'Soutien : proposition', `Fit à ${nm(t)}, 11 ou 12 points.`, ln({ [dn(t)]: [Math.max(3, 8 - pm.len[t][0]), 13] })); q.ok = h => I(h) && majorFit(h, pm) < 0 && fitsOf(h, pm).includes(t); o.push(q); }
  }
  if (n2) o.push(opt('2N', m2N, h => I(h) && majorFit(h, pm) < 0));

  // Arrêt (10 points au plus ; 11 HLD au plus avec un fit en majeure)
  const S = h => p(h) <= (fitM(h) ? 11 : 10) && HL(h) >= 6;
  if (zs >= 0 && zs === rs) {
    // l'ouvreur a soutenu ma couleur : le contrat convient
  } else if (zs >= 0 && zs !== os && levelOf(z) === 1) {
    // nouvelle couleur de l'ouvreur au palier de 1 (majeure 4e)
    const b = cheapest(c, dn(zs));
    o.push(opt(b, M('Soutien simple', { pts: [6, 11], unit: 'HLD', len: ln({ [dn(zs)]: [4, 13] }), fiche: F,
      text: `4 cartes à ${nm(zs)}, 6 à 11 points HLD : on a trouvé le fit, sans assez de points pour la manche.` }), h => S(h) && L(h, zs) >= 4));
    if (rs >= 0) { const r = cheapest(c, dn(rs)); if (r && levelOf(r) === 2) o.push(opt(r, M('Répétition', { pts: [6, 10], unit: 'HL', len: ln({ [dn(rs)]: [6, 13] }), fiche: F,
      text: `Au moins 6 cartes à ${nm(rs)}, 6 à 10 points : pour jouer.` }), h => S(h) && L(h, rs) >= 6)); }
    // retour à sa 1re couleur (mineure) au palier de 2 : 5 cartes, ou 4 cartes avec une main irrégulière (sinon 1SA)
    const bp = cheapest(c, dn(os));
    if (bp && levelOf(bp) === 2) o.push(opt(bp, M('Préférence', { pts: [6, 10], unit: 'HL', len: ln({ [dn(os)]: [4, 13] }), fiche: F,
      text: `6 à 10 points et au moins 4 cartes à ${nm(os)} : retour à la 1re couleur de l'ouvreur, au palier le plus bas.` }),
      h => S(h) && L(h, os) >= 4 && (L(h, os) >= 5 || !noShort(h))));
    o.push(opt('1N', M('1SA', { pts: [6, 10], unit: 'HL', len: ln({ [dn(zs)]: [0, 3] }), fiche: F,
      text: `6 à 10 points, pas 4 cartes à ${nm(zs)} : on s'arrête au palier le plus bas.` }), h => S(h)));
  } else if (zs >= 0 && zs !== os) {
    // bicolore économique : préférence
    const bx = cheapest(c, dn(os));
    if (bx && levelOf(bx) === 2) o.push(opt(bx, M('Préférence', { pts: [6, major(os) ? 11 : 10], unit: 'HL', len: ln({ [dn(os)]: [2, 13] }), fiche: F,
      text: major(os) ? `6 à 10 points (11 HLD au plus avec 3 cartes à ${nm(os)}) : retour à la 1re couleur de l'ouvreur, où j'ai autant de cartes ou plus.`
        : `6 à 10 points : retour à la 1re couleur de l'ouvreur (${nm(os)}), où j'ai autant de cartes ou plus.` }), h => S(h) && L(h, os) >= 2 && L(h, os) >= L(h, zs)));
    if (rs >= 0 && rs !== os) { const r = cheapest(c, dn(rs)); if (r && levelOf(r) === 2) o.push(opt(r, M('Répétition', { pts: [6, 10], unit: 'HL', len: ln({ [dn(rs)]: [6, 13] }), fiche: F,
      text: `Au moins 6 cartes à ${nm(rs)}, 6 à 10 points : pour jouer.` }), h => S(h) && L(h, rs) >= 6 && L(h, zs) <= 2)); }
  } else {
    // 1SA de l'ouvreur : ma couleur 6e plutôt que Sans-Atout ; répétition de l'ouvreur : 2 cartes au plus dans sa couleur (pas de fit)
    const after1N = z === '1N';
    if (rs >= 0 && rs !== os) { const r = cheapest(c, dn(rs)); if (r && levelOf(r) === 2) o.push(opt(r, M('Répétition', { pts: [6, 10], unit: 'HL', len: ln({ [dn(rs)]: [6, 13] }), fiche: F,
      text: after1N ? `Au moins 6 cartes à ${nm(rs)}, 6 à 10 points : pour jouer, plutôt que Sans-Atout.`
        : `Au moins 6 cartes à ${nm(rs)}, 6 à 10 points, pas de fit à ${nm(os)} : pour jouer.` }), h => S(h) && L(h, rs) >= 6 && (after1N || L(h, os) <= 2))); }
  }
  // Passe : sans fit en majeure, 10 points au plus (12 si 2SA n'est plus possible) ; avec un fit en majeure, 11 HLD au plus
  // (12 quand l'ouvreur a déjà soutenu au palier de 3). Le 1er « Passe » donne le sens : il couvre tous les cas.
  const passMax = n2 ? 10 : 12;
  const fitMax = t => (!at(c, '3' + dn(t)) ? 12 : t === rs && rs !== os && zs !== rs ? 14 : 11);
  const allMax = Math.max(passMax, ...[1, 0].filter(t => pm.len[t][0] >= 2).map(fitMax));
  o.push(opt('P', M('Passe', { pts: [0, allMax], unit: 'HL', fiche: F,
    text: `L'ouvreur a une ouverture minimale et j'ai ${passMax} points au plus : le camp n'a pas la manche, le contrat convient.` }), h => !fitM(h)));
  for (const t of [1, 0]) o.push(opt('P', M('Passe', { pts: [0, allMax], unit: 'HL', fiche: F,
    text: `Fit à ${nm(t)}, mais j'ai ${fitMax(t)} points HLD au plus face à une ouverture minimale : pas assez pour la manche, on s'arrête là.` }),
    h => majorFit(h, pm) === t));
  return o;
}

/* ====================================================================
   3e enchère de l'ouvreur (ouverture de 1 à la couleur)
   ==================================================================== */
function openerThird(c, pm) {
  const x = c.seq[0], r1 = c.seq[2], z = c.seq[4], r2 = c.seq[6];
  const os = DEN_SUIT[x[1]], rs = suitOfBid(r1), zs = suitOfBid(z);
  const rm = explainAt(c.auction, c.dealer, c.openIdx + 6);
  const o = [];
  const p = h => ptsOf(h, pm);
  if (rm.name === '4e couleur forcing') {
    const u = suitOfBid(r2);
    const d = (name, txt, len) => M(name, { len, forcing: 1, fiche: F, text: txt + ' Le répondant choisit ensuite la manche.' });
    const bn = cheapest(c, 'N');
    if (bn && levelOf(bn) <= 3) o.push(opt(bn, d('Arrêt dans la 4e couleur', `J'ai l'arrêt à ${nm(u)} : je propose de jouer à Sans-Atout.`), h => stopper(h, u)));
    if (major(rs)) { const b = cheapest(c, dn(rs)); if (b) o.push(opt(b, d('Soutien 3e', `3 cartes à ${nm(rs)}, pas d'arrêt à ${nm(u)}.`, ln({ [dn(rs)]: [3, 3] })), h => L(h, rs) >= 3)); }
    if (zs >= 0 && zs !== os) { const b = cheapest(c, dn(zs)); if (b) o.push(opt(b, d('2e couleur 5e', `5 cartes à ${nm(zs)}, pas d'arrêt à ${nm(u)}.`, ln({ [dn(zs)]: [5, 13] })), h => L(h, zs) >= 5 && L(h, os) <= 5)); }
    const bx = cheapest(c, dn(os));
    if (bx) o.push(opt(bx, d('Répétition', `Pas d'arrêt à ${nm(u)} ni de soutien : je répète ma 1re couleur (${nm(os)}, souvent 6 cartes).`), () => true));
    return o;
  }
  if (rm.invite) {
    // proposition du répondant : manche avec 14 points et plus
    const t = suitOfBid(r2);
    const A = h => p(h) >= 14;
    o.push(...slamOpts(c, pm));
    if (t >= 0 && major(t)) {
      o.push(opt('4' + dn(t), M('Acceptation : manche', { pts: [14, 23], unit: 'HLD', fiche: F, conclusion: true, text: `14 points et plus : j'accepte la proposition, manche à ${nm(t)}.` }),
        h => A(h) && (L(h, t) + pm.len[t][0] >= 8)));
    }
    // fit en majeure que le répondant ne connaît pas (après son 2SA, par exemple) : la manche à l'atout, pas 3SA
    for (const u of [1, 0]) {
      const g = '4' + dn(u);
      if (u === t || !legal(c, g)) continue;
      o.push(opt(g, M('Acceptation : manche', { pts: [14, 23], unit: 'HLD', len: ln({ [dn(u)]: [Math.max(0, 8 - pm.len[u][0]), 13] }), fiche: F, conclusion: true,
        text: `14 points HLD et plus avec le fit à ${nm(u)} : j'accepte la proposition, manche à ${nm(u)}.` }), h => A(h) && majorFit(h, pm) === u));
    }
    if (legal(c, '3N')) o.push(opt('3N', M('Acceptation : 3SA', { pts: [14, 23], unit: 'HL', fiche: F, conclusion: true, text: '14 points et plus, pas de fit en majeure : j\'accepte la proposition, manche à Sans-Atout.' }), h => A(h) && majorFit(h, pm) < 0));
    o.push(opt('P', M('Refus : ouverture minimale', { pts: [12, 13], unit: 'HL', fiche: F, text: '12 ou 13 points : je refuse la proposition, on joue ce contrat.' }), () => true));
    return o;
  }
  if (rm.forcing) return null;
  // enchère d'arrêt du répondant : passe ; 17-18 points : proposition ; 19 et plus : manche (HLD avec un fit en majeure)
  const t = suitOfBid(r2);
  o.push(...gameOpts(c, pm, h => p(h) >= 19, 19, -1));
  const V = h => p(h) >= 17 && p(h) <= 18;
  if (t >= 0 && levelOf(r2) <= 2) {
    const b = at(c, '3' + dn(t));
    if (b) o.push(opt(b, M('Proposition de manche', { pts: [17, 18], unit: major(t) ? 'HLD' : 'HL', len: ln({ [dn(t)]: [Math.max(0, 8 - pm.len[t][0]), 13] }), invite: true, fiche: F,
      text: `17 ou 18 points avec le fit à ${nm(t)} : je propose la manche ; le répondant la dit avec ${ACC} points et plus.` }), h => V(h) && L(h, t) + pm.len[t][0] >= 8));
  }
  if (legal(c, '2N')) o.push(opt('2N', M('2SA : proposition de manche', { pts: [17, 18], unit: 'HL', invite: true, fiche: F,
    text: `17 ou 18 points : je propose la manche à Sans-Atout ; le répondant dit 3SA avec ${ACC} points et plus.` }), h => V(h) && HL(h) >= 17));
  const pmax = legal(c, '2N') ? 16 : 18;
  o.push(opt('P', M('Passe', { pts: [12, pmax], unit: 'HL', fiche: F,
    text: `Le répondant s'est arrêté : avec une ouverture de 12 à ${pmax} points, on passe.` }), () => true));
  return o;
}

/* ====================================================================
   3e enchère du répondant (après la 4e couleur, ou une proposition de l'ouvreur)
   ==================================================================== */
function responderThird(c, pm) {
  const mineIdx = c.openIdx + 6;
  const myM = explainAt(c.auction, c.dealer, mineIdx);
  const om = explainAt(c.auction, c.dealer, c.openIdx + 8);
  const o = [];
  if (myM.name === '4e couleur forcing') {
    o.push(...slamOpts(c, pm));
    o.push(...gameOpts(c, pm, () => true, 13, suitOfBid(c.seq[2])));
    return o;
  }
  if (om.invite) {
    const p = h => ptsOf(h, pm);
    o.push(...gameOpts(c, pm, h => p(h) >= ACC, ACC, suitOfBid(c.seq[2])));
    o.push(opt('P', M('Refus', { pts: [0, ACC - 1], unit: 'HL', fiche: F, text: `${ACC - 1} points au plus : je refuse la proposition de l'ouvreur.` }), () => true));
    return o;
  }
  return null;
}

/* ====================================================================
   Forcing de manche (2♦ fort, réponse positive à 2♣, chassé-croisé…) : on ne s'arrête pas avant la manche
   ==================================================================== */
function gfOpts(c, pm) {
  const o = slamOpts(c, pm);
  const lb = c.st.lastBid;
  if (isGameBid(lb)) {
    o.push(opt('P', M('Passe', { fiche: F, text: 'Forcing de manche : la manche est atteinte, et le camp n\'a pas les 33 points du chelem.' }), h => !slamZone(c, h, pm)));
    o.push(opt('P', M('Passe', { fiche: F, text: 'Forcing de manche : la manche est atteinte. Le chelem est possible, mais ici on ne peut pas demander les As (pas d\'atout convenu, ou Blackwood déjà fait) : on s\'en tient à la manche.' }), () => true));
    return o;
  }
  for (const t of [1, 0]) {
    const g = '4' + dn(t);
    if (legal(c, g)) o.push(opt(g, M('Manche à ' + nm(t), { len: ln({ [dn(t)]: [Math.max(2, 8 - pm.len[t][0]), 13] }), fiche: F, conclusion: true,
      text: `Forcing de manche, fit à ${nm(t)} (8 cartes dans le camp) : la manche.` }), h => L(h, t) + pm.len[t][0] >= 8));
  }
  if (legal(c, '3N')) { o.push(opt('3N', M('3SA', { fiche: F, conclusion: true, text: 'Forcing de manche, pas de fit en majeure : 3SA.' }), () => true)); return o; }
  const ps = suitOfBid(lb);
  if (ps >= 2 && legal(c, '5' + dn(ps))) { o.push(opt('5' + dn(ps), M('Manche à ' + nm(ps), { fiche: F, conclusion: true, text: 'Forcing de manche : la manche dans la couleur du partenaire.' }), () => true)); return o; }
  return null;
}

/* ====================================================================
   Les autres suites (après 1SA, 2SA, 2♣, 2 faibles, barrages…) : additionner mes points et le minimum du partenaire
   ==================================================================== */
function addOpts(c, pm) {
  const o = slamOpts(c, pm);
  for (const t of [1, 0]) {
    const g = '4' + dn(t);
    if (legal(c, g)) o.push(opt(g, M('Manche à ' + nm(t), { pts: [Math.max(0, 27 - pm.min), 37], unit: 'HLD', len: ln({ [dn(t)]: [Math.max(2, 8 - pm.len[t][0]), 13] }), fiche: F, conclusion: true,
      text: `Fit à ${nm(t)} : mes points + le minimum du partenaire font 27 ou plus, la manche.` }), h => majorFit(h, pm) === t && HLD(h, t) + pm.min >= 27));
  }
  if (legal(c, '3N')) o.push(opt('3N', M('3SA', { pts: [Math.max(0, 25 - pm.min), 37], unit: 'H', fiche: F, conclusion: true,
    text: 'Pas de fit en majeure : mes points H + le minimum du partenaire font 25 ou plus, 3SA.' }), h => majorFit(h, pm) < 0 && hcp(h) + pm.min >= 25));
  const short = h => { const t = majorFit(h, pm); return t >= 0 ? HLD(h, t) + pm.min < 27 : hcp(h) + pm.min < 25; };
  o.push(opt('P', M('Passe', { fiche: F, text: 'Mes points + le minimum du partenaire n\'atteignent pas la manche : on s\'arrête là.' }), short));
  o.push(opt('P', M('Passe', { fiche: F, text: 'La manche est peut-être là, mais aucune enchère de la fiche ne convient ici : on laisse le contrat du partenaire.' }), () => true));
  return o;
}

B.COMPL.C1 = function (c) {
  if (c.role !== 'opener' && c.role !== 'responder') return null;
  if (c.seq.some((x, i) => i % 2 === 1 && x !== 'P')) return null;
  const ours = c.seq.filter((x, i) => i % 2 === 0);
  const k = ours.length;
  if (k < 2 || ours.includes('P')) return null;
  const pc = ours[k - 1];
  const pmn = explainAt(c.auction, c.dealer, c.openIdx + 2 * (k - 1));
  const pm = summarize(c, c.partner);
  // une enchère forcing du partenaire n'est jamais une conclusion
  if (!pmn.forcing && (pmn.conclusion || isGameBid(pc))) return concludedOpts(c, pm, pc);
  if (/^1[CDHS]$/.test(ours[0])) {
    if (k === 3 && c.role === 'responder') return responderRebid(c, pm);
    if (k === 4 && c.role === 'opener') return openerThird(c, pm);
    if (k === 5 && c.role === 'responder') return responderThird(c, pm);
  }
  if (pm.gf || summarize(c, c.seat).gf) return gfOpts(c, pm);
  if (pmn.forcing) return null;
  return addOpts(c, pm);
};
})();

/* ===================== Fiche complémentaire C2 ===================== */
/* Fiche complémentaire C2 — La compétition après notre ouverture.
   Notre camp a ouvert et un adversaire a dit autre chose que Passe (contre ou enchère) :
   1) la 1re réponse du partenaire de l'ouvreur (soutiens, surcontre, contre Spoutnik, nouvelle couleur, SA, cue-bid, passe) ;
   2) la 2e enchère de l'ouvreur (réponse au Spoutnik, après un soutien, un SA, une nouvelle couleur, un surcontre,
      quand le partenaire a passé : bicolore 5-5, contre de réveil ou répétition d'une 6e) et la réponse du partenaire à ce contre ;
      après un soutien simple (6 à 10), la fiche 05 (R10) : en majeure, proposition avec 16 à 18 HLD, manche avec 19 et plus ;
      en mineure, 2SA avec 16-17 HL et des arrêts, 3SA avec 18 et plus et des arrêts (sinon répétition, ou 5 en mineure) ;
   3) la suite de la compétition (le partenaire a conclu, forcing de manche, manche, contre punitif, loi de Vernes,
      nouvelle couleur forcing avec les points de la manche, passe) ;
   4) nos ouvertures 1SA, 2 faibles et barrages quand l'adversaire intervient.
   Chaque règle est écrite sur la fiche C2 (source/lot2-generateur/dC2_competition.py) : les deux disent la même chose.
   « Additionnez » (fiche 05, comme C1) : mes points + le minimum du partenaire atteignent la manche (fiche 16 : 25 / 27 / 30)
   → on la dit ; seul son maximum l'atteint et l'adversaire se tait → on propose ; sinon on passe.
   Loi de Vernes (fiche 12) : palier = atouts du camp − 6, jusqu'au palier 4 en majeure (la manche), jusqu'au palier 5 en mineure
   (R12 : même texte que C3 et C4).
   Soutiens (D1) : 3 cartes en majeure, 5 en mineure, comme la fiche 03. Au palier de 3 sans place pour le saut (comme C4) :
   11 HLD, ou 6 HLD avec 4 atouts (loi de Vernes ; en mineure, les 5 cartes du soutien suffisent). */
(function () {
'use strict';
const B = globalThis.B;
const { M, opt, ln, L, nm, dn, bidOf, cheapest, summarize, gameLevelOf, explainAt, respMajor, respMinor } = B.BH;
const { hcp, HL, HLD, isRegular, stopper, honors, bigHonors, isBid, levelOf, denOf, isLegal, sideOf, DEN_SUIT } = B;

const F = 'C2';
const MC = (name, o) => M(name, Object.assign({ fiche: F }, o || {}));
const legal = (c, x) => !!x && isLegal(x, c.auction, c.dealer);
const sOf = call => denOf(call) === 'N' ? 4 : DEN_SUIT[denOf(call)];
const raiseBy = (call, k) => { if (!call) return null; const l = levelOf(call) + k; return l <= 7 ? bidOf(l, sOf(call)) : null; };
const hon = (h, s) => honors(h, s) >= 1;                       // un honneur : As, Roi, Dame, Valet ou 10 (fiche 00)
const NEED = s => s === 4 ? 25 : s <= 1 ? 27 : 30;                 // manche : 3SA 25 H, 4♥/4♠ 27 HLD, 5♣/5♦ 30 HLD (fiche 16)
const MAJ = 22;                                                    // le camp a la majorité : 22 points et plus
const ORDER = [1, 0, 3, 2];                                        // à longueur égale : cœur, pique, trèfle, carreau
const PASSE = (text, o) => opt('P', MC('Passe', Object.assign({ text }, o || {})), () => true);
const REOPEN = 'Contre d\'appel de l\'ouvreur (réveil)';
// Le maximum du partenaire : le haut de sa fourchette ; si elle est très large (enchère non limitée), son minimum + 4
const pmaxOf = pm => pm.max - pm.min <= 10 || pm.max <= 12 ? pm.max : pm.min + 4;
const isGameBid = x => isBid(x) && levelOf(x) >= gameLevelOf(denOf(x));

// Couleurs montrées par les adversaires (au moins 4 cartes d'après leurs enchères)
function theirSuits(c) {
  const side = sideOf(c.seat), ours = [], r = [];
  for (const x of c.calls) if (sideOf(x.seat) === side && isBid(x.call) && denOf(x.call) !== 'N') ours.push(DEN_SUIT[denOf(x.call)]);
  for (const x of c.calls) {
    if (sideOf(x.seat) === side || !isBid(x.call)) continue;
    const m = explainAt(c.auction, c.dealer, x.i);
    let any = false;
    if (m) for (let s = 0; s < 4; s++) if (m.len[s][0] >= 4) { any = true; if (!r.includes(s)) r.push(s); }
    if (!any && denOf(x.call) !== 'N') {
      const s = DEN_SUIT[denOf(x.call)];
      if (!ours.includes(s) && !r.includes(s) && !(m && /cue/i.test(m.name))) r.push(s);
    }
  }
  return r;
}
// L'intervention qui suit notre ouverture
function interv(c, os) {
  const i = c.openIdx + 1, call = c.auction[i];
  if (call === 'X') return { kind: 'X', suits: [] };
  if (!isBid(call)) return { kind: 'P', suits: [] };
  const m = explainAt(c.auction, c.dealer, i);
  const long = [0, 1, 2, 3].filter(s => m && m.len[s][0] >= 4);
  if (long.length >= 2) return { kind: 'bic', suits: long };
  if (denOf(call) === 'N') return { kind: 'NT', suits: [] };
  const s = DEN_SUIT[denOf(call)];
  if (s !== os && !(m && /cue/i.test(m.name))) return { kind: 'suit', s, suits: [s] };
  return { kind: 'cue', suits: long };
}
// Meilleure couleur parmi des candidates (la plus longue ; à égalité, ordre ORDER)
const bestOf = (h, cands) => cands.slice().sort((a, b) => L(h, b) - L(h, a) || ORDER.indexOf(a) - ORDER.indexOf(b))[0];

/* Enchère « loi de Vernes » (fiches 06 et 12) : le Conseil donne le nombre d'atouts du camp (mes cartes + celles que le
   partenaire a promises). La 1re option, jamais choisie, porte le sens général (celui qu'on lit en touchant l'enchère) ;
   les suivantes, même nom, donnent le compte exact pour chaque longueur. txt(n, exact) : le texte pour n atouts. */
function byTrumps(call, name, s, other, need, txt, extra, o2) {
  const ok = extra || (() => true);
  const o = [opt(call, MC(name, Object.assign({ len: ln({ [dn(s)]: [need, 13] }), text: txt(other + need, false) }, o2 || {})), () => false)];
  const top = Math.min(13 - other, need + 3);
  for (let k = need; k <= top; k++) {
    const last = k === top;
    o.push(opt(call, MC(name, Object.assign({ len: ln({ [dn(s)]: [k, last ? 13 : k] }), text: txt(other + k, !last || k === 13 - other) }, o2 || {})),
      h => (last ? L(h, s) >= k : L(h, s) === k) && ok(h)));
  }
  return o;
}

/* ====================================================================
   1. LE PARTENAIRE DE L'OUVREUR, 1re ENCHÈRE
   ==================================================================== */
// Soutiens (décision D1 : comme la fiche 03) : 6-10 HLD au palier le plus bas, 11-12 HLD avec saut, 13 HLD et plus : manche
function supportOpts(c, od, os, fitMin) {
  const p = h => HLD(h, os), fit = h => L(h, os) >= fitMin;
  const o = [];
  const r0 = cheapest(c, od), r1 = raiseBy(r0, 1), g = bidOf(gameLevelOf(od), os);
  const len = ln({ [od]: [fitMin, 13] }), cards = `${fitMin} cartes ou plus à ${nm(os)}`;
  const major = os <= 1;     // en mineure, pas de manche directe : avec 13 H et plus, 3SA (arrêt) ou le cue-bid
  if (major && legal(c, g)) o.push(opt(g, MC('Soutien à la manche', { pts: [13, 37], unit: 'HLD', len, conclusion: true,
    text: `${cards} et 13 points HLD ou plus : la manche.` }), h => fit(h) && p(h) >= 13));
  const jump = r0 && levelOf(r0) <= 3 && r1 && levelOf(r1) <= 3 && r1 !== g;
  if (jump) o.push(opt(r1, MC('Soutien à saut', { pts: [11, major ? 12 : 37], unit: 'HLD', len, invite: true,
    text: `${cards}, ${major ? '11 ou 12 points HLD' : '11 points HLD ou plus'}. Proposition de manche.` }), h => fit(h) && p(h) >= 11 && (!major || p(h) <= 12)));
  if (r0 && levelOf(r0) <= 3 && r0 !== g && jump) {
    o.push(opt(r0, MC('Soutien simple', { pts: [6, 10], unit: 'HLD', len, text: `${cards}, 6 à 10 points HLD.` }), h => fit(h) && p(h) >= 6 && p(h) <= 10));
  } else if (r0 && levelOf(r0) === 3 && r0 !== g) {
    // pas de place pour le saut : le soutien est au palier de 3. Comme C4 (décision de l'orchestrateur) : 11 HLD, ou 6 HLD
    // avec 4 atouts (loi de Vernes : avec les 5 cartes de l'ouverture en majeure, le camp a 9 atouts, palier 3).
    // En mineure, le soutien promet déjà 5 cartes (R3) : 6 HLD suffisent.
    const hi = major ? 12 : 37;
    o.push(opt(r0, MC('Soutien au palier de 3', { pts: [6, hi], unit: 'HLD', len,
      text: major ? `${cards} : 11 ou 12 points HLD, ou 6 à 10 points HLD avec 4 atouts (le camp en a 9 : loi de Vernes, palier 3).`
        : `${cards} et 6 points HLD ou plus : soutien au palier de 3 (pas de place pour le saut).` }),
      h => fit(h) && p(h) <= hi && (p(h) >= 11 || (p(h) >= 6 && L(h, os) >= 4))));
  } else if (!major && r0 && levelOf(r0) === 4) {
    // intervention au palier de 3 sur notre mineure : le soutien est au palier de 4 (proposition de 5♣/5♦)
    o.push(opt(r0, MC('Soutien au palier de 4', { pts: [11, 37], unit: 'HLD', len, invite: true,
      text: `${cards}, 11 points HLD ou plus. Proposition de manche à ${nm(os)}.` }), h => fit(h) && p(h) >= 11));
  }
  return o;
}
// Couleurs « pour jouer » (non forcing) : 5 cartes et plus, au palier le plus bas
function toPlayOpts(c, excl, maxH, maxLvl, minHL) {
  const o = [];
  const cands = [0, 1, 2, 3].filter(t => !excl.includes(t));
  for (const t of ORDER) {
    if (excl.includes(t)) continue;
    const call = cheapest(c, dn(t));
    if (!call || levelOf(call) > maxLvl) continue;
    o.push(opt(call, MC('Couleur pour jouer', { pts: [0, maxH], unit: 'H', len: ln({ [dn(t)]: [5, 13] }), conclusion: true,
      text: `5 cartes ou plus à ${nm(t)}, moins de ${maxH + 1} H : pour jouer (non forcing).` }),
      h => L(h, t) >= 5 && hcp(h) <= maxH && HL(h) >= (minHL || 0) && bestOf(h, cands) === t));
  }
  return o;
}

// Après un contre adverse : comme sans le contre (fiche 03). Avec un soutien de la fiche 03 (3 cartes en majeure,
// 5 en mineure), on soutient ; sans soutien, surcontre avec 10 H et plus.
function r1AfterX(c, od, os) {
  const sup = [], rest = [];
  const seen = new Map();
  for (const x of (os <= 1 ? respMajor(c) : respMinor(c))) {
    if (x.call === 'P' || x.call === '4N' || !x.m || x.m.fiche === '15') continue;
    let m = seen.get(x.call);
    if (!m) {
      m = Object.assign({}, x.m, { fiche: F, text: 'Comme sans le contre (fiche 03). ' + x.m.text.replace(' (ou main très faible avec la règle des 9)', '') });
      if (/saut/i.test(m.name) || x.call === '2N') m.invite = true;      // soutien à saut et 2SA : propositions de manche
      if (/manche/i.test(m.name) && m.pts) m.pts = [m.pts[0], 37];         // la manche : 13 HLD et plus
      seen.set(x.call, m);
    }
    (/^Soutien/.test(m.name) ? sup : rest).push(opt(x.call, m, x.ok));
  }
  const noSup = h => !sup.some(x => x.ok(h));
  const xx = opt('XX', MC('Surcontre', { pts: [10, 37], unit: 'H', len: os <= 1 ? ln({ [od]: [0, 2] }) : undefined,
    text: '10 H et plus, sans soutien : le camp a la majorité des points. Ensuite, on contre (punitif) les adversaires qui se sauvent.' }),
    h => hcp(h) >= 10 && noSup(h));
  const pass = PASSE('Moins de 10 H et pas de réponse de la fiche 03 (le plus souvent moins de 6 points).', { pts: [0, 9], unit: 'H' });
  // sur une majeure, le soutien d'abord (fiche 03) ; sur une mineure, l'ordre de la fiche 03 (le soutien en dernier)
  if (os <= 1) return [...sup, xx, ...rest, pass];
  return [xx, ...rest, ...sup, pass];
}

// Après une intervention naturelle à la couleur (jusqu'au palier de 3)
// Soutien (D1, R3) : 3 cartes en majeure, 5 en mineure, comme après une ouverture (fiche 03).
function r1AfterSuit(c, od, os, ov, vs) {
  const major = os <= 1, fitMin = major ? 3 : 5;
  const xMin = levelOf(ov) >= 3 ? 10 : 8;
  const unbidM = [0, 1].filter(s => s !== os && s !== vs);
  const xSuits = unbidM.length ? unbidM : [0, 1, 2, 3].filter(s => s !== os && s !== vs);
  // 1♣ ou 1♦ (1♥) : le pique se dit encore au palier de 1 ; le Spoutnik promet alors exactement 4 piques (avec 5 : 1♠)
  const at1 = t => { const ch = cheapest(c, dn(t)); return !!ch && levelOf(ch) === 1; };
  const one = unbidM.length === 1 && at1(unbidM[0]) ? unbidM[0] : -1;
  const xl = {}; for (const s of xSuits) xl[dn(s)] = s === one ? [4, 4] : [4, 13];
  const xTxt = unbidM.length === 2 ? '4 cartes ou plus à Cœur et à Pique'
    : one >= 0 ? `exactement 4 cartes à ${nm(one)} (avec 5 cartes, on dit 1${B.SUIT_SYM[one]})`
    : unbidM.length === 1 ? `4 cartes ou plus à ${nm(unbidM[0])}`
    : `4 cartes ou plus à ${nm(xSuits[0])} et à ${nm(xSuits[1])}`;
  const spout = opt('X', MC('Contre Spoutnik', { pts: [xMin, 37], unit: 'H', len: ln(xl), forcing: 1, alert: true,
    text: `Contre d'appel : au moins ${xMin} H et ${xTxt}. L'ouvreur répond comme à un contre d'appel.` }),
    h => hcp(h) >= xMin && xSuits.every(s => L(h, s) >= 4) && (one < 0 || L(h, one) === 4));
  // nouvelle couleur forcing : palier de 1 : 4 cartes (5 pour le pique sur 1♣/1♦ (1♥)), 6 HL ; palier de 2 : 11 HL,
  // 5 cartes en majeure, 4 en mineure (comme la fiche 03) ; palier de 3 : 5 cartes, 12 HL
  const newSuit = [];
  const cands = [0, 1, 2, 3].filter(t => t !== os && t !== vs);
  const spec = t => {
    const call = cheapest(c, dn(t));
    if (!call || levelOf(call) > 3) return null;
    const lv = levelOf(call);
    return { call, lv, need: lv === 1 ? 6 : lv === 2 ? 11 : 12, len: lv === 1 ? (t === one ? 5 : 4) : lv === 2 ? (t <= 1 ? 5 : 4) : 5 };
  };
  const canBid = (h, t) => { const q = spec(t); return !!q && L(h, t) >= q.len && HL(h) >= q.need; };
  for (const t of ORDER) {
    if (t === os || t === vs) continue;
    const q = spec(t);
    if (!q) continue;
    const { call, lv, need, len } = q;
    // la couleur la plus longue ; au palier de 1, aussi quand la plus longue ne peut pas se dire (pas assez de points)
    newSuit.push(opt(call, MC('Nouvelle couleur', { pts: [need, 37], unit: 'HL', len: ln({ [dn(t)]: [len, 13] }), forcing: 1,
      text: `${len} cartes ou plus à ${nm(t)} et ${need} points HL ou plus. Forcing : l'ouvreur doit reparler.` }),
      h => L(h, t) >= len && HL(h) >= need && (bestOf(h, cands) === t || (lv === 1 && !canBid(h, bestOf(h, cands))))));
  }
  // Sans-Atout avec un arrêt, sans fit (sur une mineure, 3SA même avec le fit : le soutien n'a pas de manche directe)
  const nt = [];
  for (const [lv, a, b] of [[3, 13, 37], [2, 11, 12], [1, 8, 10]]) {
    const call = lv + 'N';
    if (!legal(c, call)) continue;
    nt.push(opt(call, MC(lv + 'SA', { pts: [a, b], unit: 'H', conclusion: lv === 3, invite: lv === 2,
      text: `${b >= 37 ? a + ' H et plus' : a + (b === a + 1 ? ' ou ' : ' à ') + b + ' H'}, un arrêt à ${nm(vs)}` + (major || lv < 3 ? ', pas de fit' : '') + (lv === 2 ? ' : proposition de manche.' : '.') }),
      h => ((!major && lv === 3) || L(h, os) < fitMin) && stopper(h, vs) && hcp(h) >= a && hcp(h) <= b));
  }
  // sans arrêt, 13 H et plus : cue-bid de leur couleur (jamais au-delà du palier de 3), forcing de manche
  const cueCall = cheapest(c, dn(vs));
  const cue = cueCall && levelOf(cueCall) <= 3 ? opt(cueCall, MC('Cue-bid', { pts: [13, 37], unit: 'H', forcing: 2, alert: true,
    text: `13 H et plus, sans arrêt à ${nm(vs)} : forcing de manche. L'ouvreur décrit sa main (Sans-Atout s'il a l'arrêt), puis le camp dit la manche.` }),
    h => hcp(h) >= 13 && !stopper(h, vs)) : null;
  const sup = supportOpts(c, od, os, fitMin);
  // R9 : le sens général de la Passe (explication), puis un texte vrai pour chaque main
  const r0 = cheapest(c, od), at3 = !!r0 && levelOf(r0) === 3;
  const pass = [opt('P', MC('Passe', { pts: cue ? [0, 12] : undefined, unit: cue ? 'H' : undefined,
    text: 'Aucune réponse de la fiche ne convient (soutien, contre Spoutnik, couleur, Sans-Atout' + (cue ? ', cue-bid' : '') + ') : on passe.' }), () => false)];
  if (at3) pass.push(opt('P', MC('Passe', { text: `Fit à ${nm(os)}, mais au palier de 3 le soutien demande 11 points HLD, ou 6 points HLD avec 4 atouts (loi de Vernes) : on passe.` }),
    h => L(h, os) >= fitMin && HLD(h, os) >= 6));
  pass.push(cue
    ? PASSE('12 H au plus, et aucune réponse de la fiche ne convient (soutien, contre Spoutnik, couleur, Sans-Atout) : on passe. C\'est souvent une main faible, ou avec des cartes dans leur couleur.')
    : PASSE('Leur intervention au palier de 3 : ni soutien (11 points HLD, ou 6 avec 4 atouts), ni contre Spoutnik (10 H), ni couleur de 5 cartes avec 12 HL, ni 3SA (13 H et un arrêt). On passe.'));
  const cueL = cue ? [cue] : [];
  // fiche 03 : sur une majeure, le soutien d'abord ; sur une mineure, la couleur, puis SA, puis le soutien
  // le Spoutnik passe avant la nouvelle couleur
  if (major) return [...sup, spout, ...newSuit, ...nt, ...cueL, ...pass];
  return [spout, ...newSuit, ...nt, ...cueL, ...sup, ...pass];
}

// Après 1SA, un bicolore, un cue-bid ou une intervention au palier de 4 : contre punitif 10 H et plus
function r1Penalty(c, od, os, ov, it) {
  const major = os <= 1, fitMin = major ? 3 : 5;
  const sup = supportOpts(c, od, os, fitMin);
  const g = bidOf(gameLevelOf(od), os);
  const o = sup.filter(x => x.call === g);     // la manche avec un fit d'abord
  if (legal(c, 'X')) o.push(opt('X', MC('Contre punitif', { pts: [10, 37], unit: 'H', conclusion: true,
    text: '10 H et plus : avec l\'ouverture, le camp a la majorité des points (22 et plus). Pour faire chuter les adversaires.' }), h => hcp(h) >= 10));
  o.push(...sup.filter(x => x.call !== g));
  o.push(...toPlayOpts(c, [os, ...it.suits], 9, 3, 6).map(x => { const ok = x.ok; x.ok = h => L(h, os) < fitMin && ok(h); return x; }));
  // R9 : deux textes vrais (sans fit ni 5e ; avec un fit ou une 5e qu'on ne peut pas dire)
  const five = h => [0, 1, 2, 3].some(t => t !== os && L(h, t) >= 5);      // une 5e, même dans leur couleur (texte vrai)
  o.push(opt('P', MC('Passe', { pts: [0, 9], unit: 'H', text: 'Moins de 10 H, pas de fit, pas de couleur de 5 cartes : on laisse jouer les adversaires.' }),
    h => L(h, os) < fitMin && !five(h)));
  o.push(PASSE('Moins de 10 H, et pas de soutien ni de couleur de 5 cartes à dire jusqu\'au palier de 3 (il faut 6 points) : on laisse jouer les adversaires.', { pts: [0, 9], unit: 'H' }));
  return o;
}

function r1Suit(c) {
  const od = c.seq[0][1], os = DEN_SUIT[od], ov = c.seq[1];
  const it = interv(c, os);
  if (it.kind === 'X') return r1AfterX(c, od, os);
  if (it.kind === 'suit' && levelOf(ov) <= 3) return r1AfterSuit(c, od, os, ov, it.s);
  return r1Penalty(c, od, os, ov, it);
}

// Notre ouverture de 1SA
function r1NT(c) {
  const it = interv(c, -1);
  if (it.kind === 'X') return [
    opt('XX', MC('Surcontre', { pts: [7, 37], unit: 'H', text: '7 H et plus : avec les 15 à 17 H de l\'ouvreur, le camp a la majorité (22 et plus).' }), h => hcp(h) >= 7),
    ...toPlayOpts(c, [], 6, 2),
    PASSE('Moins de 7 H, sans couleur de 5 cartes : on laisse jouer 1SA contré.', { pts: [0, 6], unit: 'H' })];
  const T = it.suits;
  return [
    opt('3N', MC('3SA', { pts: [10, 37], unit: 'H', conclusion: true, text: '10 H et plus avec un arrêt dans la couleur adverse : la manche.' }),
      h => hcp(h) >= 10 && T.every(s => stopper(h, s))),
    opt('X', MC('Contre punitif', { pts: [7, 37], unit: 'H', conclusion: true,
      text: '7 H et plus : avec les 15 à 17 H de l\'ouvreur, le camp a la majorité (22 et plus). Pour faire chuter les adversaires.' }), h => hcp(h) >= 7),
    ...toPlayOpts(c, T, 6, 3),
    PASSE('Moins de 7 H, sans couleur de 5 cartes : on laisse jouer les adversaires.', { pts: [0, 6], unit: 'H' })];
}

// Loi de Vernes (fiche 12, décisions R2 et R12) : palier = atouts du camp − 6, jusqu'au palier 4 en majeure (la manche),
// jusqu'au palier 5 en mineure (« niveau 5 si 11 cartes »). Le même texte dans C2, C3 et C4 (fiches et Conseil) ;
// le Conseil donne aussi le vrai nombre d'atouts. VERNES_S : la règle en phrase (majuscule), à la fin d'un texte.
const VERNES = 'loi de Vernes (fiche 12) : palier = atouts du camp − 6, jusqu\'au palier 4 en majeure (la manche), jusqu\'au palier 5 en mineure';
const VERNES_S = 'L' + VERNES.slice(1) + '.';
// mine : mes cartes (exactes si mx), n : atouts du camp (exacts si nx)
const vernesTxt = (s, mine, n, mx, nx, lv) => `${mine} cartes${mx ? '' : ' ou plus'} à ${nm(s)} : le camp a ${nx ? n : 'au moins ' + n} atouts, on peut jouer au palier de ${lv}. ${VERNES_S}`;

// Nos 2 faibles (fiche 06 : 6 cartes), puis une intervention : comme sur le saut faible du partenaire (C4) :
// la manche avec 3 atouts et 16 HLD (ou 4 atouts : loi de Vernes), 3SA avec 16 H, un arrêt et un honneur dans notre couleur,
// contre punitif avec 13 H et 4 cartes dans leur couleur ; sinon loi de Vernes (3 cartes : palier de 3) ; sinon passe
function r1Weak(c) {
  const d = c.seq[0][1], s = DEN_SUIT[d], g = '4' + d;
  const T = theirSuits(c), lb = c.st.lastBid;
  const vs = isBid(lb) && denOf(lb) !== 'N' && T.includes(DEN_SUIT[denOf(lb)]) ? DEN_SUIT[denOf(lb)] : -1;
  const o = [];
  if (legal(c, g)) {
    const gM = MC('Soutien à la manche', { len: ln({ [d]: [3, 13] }), conclusion: true,
      text: `3 cartes à ${nm(s)} et 16 points HLD ou plus, ou 4 cartes (le camp a 10 atouts : loi de Vernes) : la manche.` });
    o.push(opt(g, gM, () => false));
    o.push(opt(g, MC('Soutien à la manche', { pts: [16, 37], unit: 'HLD', len: ln({ [d]: [3, 3] }), conclusion: true,
      text: `3 cartes à ${nm(s)} et 16 points HLD ou plus : avec les 6 cartes du partenaire, la manche.` }), h => L(h, s) === 3 && HLD(h, s) >= 16));
    o.push(...byTrumps(g, 'Soutien à la manche', s, 6, 4, (n, exact) => vernesTxt(s, n - 6, n, exact, exact, 4), null, { conclusion: true }).slice(1));
  }
  o.push(opt('3N', MC('3SA', { pts: [16, 37], unit: 'H', conclusion: true,
    text: `16 H et plus, un arrêt dans leur couleur et un honneur à ${nm(s)} : 9 levées en vue.` }),
    h => hcp(h) >= 16 && T.every(u => stopper(h, u)) && hon(h, s)));
  if (vs >= 0 && legal(c, 'X')) o.push(opt('X', MC('Contre punitif', { pts: [13, 37], unit: 'H', len: ln({ [dn(vs)]: [4, 13] }), conclusion: true,
    text: `13 H et plus et 4 cartes ou plus à ${nm(vs)} : pour faire chuter les adversaires.` }), h => hcp(h) >= 13 && L(h, vs) >= 4));
  if (legal(c, '3' + d)) o.push(opt('3' + d, MC('Prolongation (loi de Vernes)', { len: ln({ [d]: [3, 3] }), conclusion: true,
    text: vernesTxt(s, 3, 9, true, true, 3) }), h => L(h, s) === 3));
  o.push(PASSE('Pas de manche, pas de contre punitif, et pas assez d\'atouts pour prolonger (loi de Vernes) : on laisse les adversaires se débrouiller.'));
  return o;
}
// Nos barrages (fiche 12) : prolongation selon la loi de Vernes (palier 4 en majeure, 5 en mineure avec 11 atouts)
function r1Barrage(c) {
  const lvl = +c.seq[0][0], d = c.seq[0][1], s = DEN_SUIT[d], n = lvl === 3 ? 7 : 8;
  const o = [];
  for (const lv of [5, 4]) {
    const call = lv + d, need = lv + 6 - n;
    if (lv <= lvl || lv > gameLevelOf(d) || !legal(c, call)) continue;
    o.push(...byTrumps(call, 'Prolongation (loi de Vernes)', s, n, need,
      (k, exact) => vernesTxt(s, k - n, k, exact, exact && n === 7, lv), null, { conclusion: true }));
  }
  o.push(PASSE('Pas assez d\'atouts pour prolonger le barrage (loi de Vernes, fiche 12) : on passe.'));
  return o;
}

/* ====================================================================
   2. LA 2e ENCHÈRE DE L'OUVREUR (ouverture d'1 à la couleur)
   ==================================================================== */
// SA avec un arrêt dans la couleur adverse : 1SA avec 12 à 14 H (main régulière) ; plus haut, on additionne ses H et
// le minimum du partenaire : 3SA s'ils font 25 ; 2SA (proposition, adversaire muet) si seul son maximum donne 25.
// fixed (l'adversaire a reparlé après la nouvelle couleur du partenaire) : les retours à SA de la fiche 05, main régulière :
// 1SA 12-14 H, 2SA 15-17 H, 3SA 18 H et plus.
function ntOpts(c, T, pmin, pmax, free, fixed) {
  const o = [], stops = h => T.every(s => stopper(h, s));
  let m1 = null;
  if (legal(c, '1N')) { m1 = MC('1SA avec un arrêt', { pts: [12, 14], unit: 'H', text: 'Main régulière de 12 à 14 H, avec un arrêt dans la couleur adverse.' }); }
  if (m1) o.push(opt('1N', m1, h => isRegular(h) && stops(h) && hcp(h) <= 14));
  if (fixed) {
    if (legal(c, '3N')) o.push(opt('3N', MC('3SA', { pts: [18, 23], unit: 'H', conclusion: true,
      text: 'Main régulière de 18 H et plus, avec un arrêt dans la couleur adverse : retour à Sans-Atout (fiche 05), la manche.' }),
      h => isRegular(h) && stops(h) && hcp(h) >= 18));
    if (legal(c, '2N')) o.push(opt('2N', MC('2SA', { pts: [15, 17], unit: 'H',
      text: 'Main régulière de 15 à 17 H, avec un arrêt dans la couleur adverse : retour à Sans-Atout (fiche 05).' }),
      h => isRegular(h) && stops(h) && hcp(h) >= 15 && hcp(h) <= 17));
    return { o, n0: m1 ? '1N' : null, m0: m1 };
  }
  const gT = 25 - pmin, iT = 25 - pmax;
  if (legal(c, '3N')) o.push(opt('3N', MC('3SA', { pts: [gT, 23], unit: 'H', conclusion: true,
    text: 'Un arrêt dans la couleur adverse ; mes H + le minimum du partenaire font 25 ou plus : la manche.' }), h => stops(h) && hcp(h) >= gT));
  if (!free && legal(c, '2N') && iT < gT) o.push(opt('2N', MC('2SA', { pts: [iT, gT - 1], unit: 'H', invite: true,
    text: 'Main régulière, un arrêt dans la couleur adverse ; seul le maximum du partenaire donne les 25 H de la manche : proposition.' }),
    h => isRegular(h) && stops(h) && hcp(h) >= iT));
  return { o, n0: m1 ? '1N' : null, m0: m1 };
}
// Réponse au contre Spoutnik : comme à un contre d'appel.
// Si l'adversaire a reparlé : seulement au palier de 2, ou au palier de 3 avec 15 HL et plus ; la manche avec 16 HL ; sinon passe.
function o2Spoutnik(c, od, os, vs, free) {
  const pm = explainAt(c.auction, c.dealer, c.openIdx + 2);
  const T = theirSuits(c);
  const prom = [0, 1, 2, 3].filter(s => pm && pm.len[s][0] >= 4 && !T.includes(s));
  const pmin = pm && pm.pts ? pm.pts[0] : 8;
  const o = [];
  const pick = h => bestOf(h, prom);
  const lvlOk = (call, h) => !free || levelOf(call) <= 2 || (levelOf(call) === 3 && HL(h) >= 15);
  const lo = call => free && levelOf(call) === 3 ? 15 : 12;
  for (const t of prom) {
    const ch = cheapest(c, dn(t));
    if (!ch) continue;
    const j = raiseBy(ch, 1), g = bidOf(gameLevelOf(dn(t)), t);
    const tl = ln({ [dn(t)]: [4, 13] });
    if (t <= 1 && ch === g) {
      // la couleur promise est déjà au palier de la manche
      o.push(opt(g, MC('Réponse au Spoutnik : manche', { pts: [free ? 16 : 12, 23], unit: 'HL', len: tl, conclusion: true,
        text: free ? `4 cartes à ${nm(t)} et 16 HL ou plus : la manche, malgré l'enchère adverse.` : `4 cartes à ${nm(t)} : la couleur promise, déjà au palier de la manche.` }),
        h => L(h, t) >= 4 && pick(h) === t && (!free || HL(h) >= 16)));
      continue;
    }
    if (t <= 1 && legal(c, g)) o.push(opt(g, MC('Réponse au Spoutnik : manche', { pts: [19, 23], unit: 'HL', len: tl, conclusion: true,
      text: `4 cartes à ${nm(t)} et 19 HL ou plus : la manche.` }), h => L(h, t) >= 4 && pick(h) === t && HL(h) >= 19));
    const jhi = t <= 1 && legal(c, g) ? 18 : 23;
    if (j && levelOf(j) <= 3 && j !== g) o.push(opt(j, MC('Réponse au Spoutnik avec saut', { pts: [16, jhi], unit: 'HL', len: tl, invite: true,
      text: `4 cartes à ${nm(t)} et 16 HL ou plus : proposition de manche.` }), h => L(h, t) >= 4 && pick(h) === t && HL(h) >= 16));
    if (free && levelOf(ch) > 3) continue;
    o.push(opt(ch, MC('Réponse au Spoutnik', { pts: [lo(ch), 23], unit: 'HL', len: tl,
      text: `4 cartes ou plus à ${nm(t)}, la couleur promise par le contre` + (lo(ch) > 12 ? ', et 15 HL ou plus (l\'adversaire a reparlé).' : '.') }),
      h => L(h, t) >= 4 && pick(h) === t && lvlOk(ch, h)));
  }
  const nt = ntOpts(c, T, pmin, pm && pm.pts ? pmaxOf({ min: pm.pts[0], max: pm.pts[1] }) : 12, free);
  o.push(...nt.o);
  const rep = cheapest(c, od);
  const minRep = os <= 1 || free ? 5 : nt.n0 ? 4 : 3;
  const repS = MC('Répétition de la couleur', { len: ln({ [od]: [minRep, 13] }),
    text: minRep >= 5 ? `5 cartes ou plus à ${nm(os)} : on répète sa couleur` + (rep && lo(rep) > 12 ? ', avec 15 HL ou plus (l\'adversaire a reparlé).' : '.')
      : `On répète sa couleur d'ouverture (${nm(os)}) : 5 cartes ou plus, ou ${minRep === 3 ? '3 ou 4' : '4'} cartes faute de mieux.` });
  if (rep) {
    const jr = raiseBy(rep, 1);
    if (jr && levelOf(jr) <= 3) o.push(opt(jr, MC('Répétition à saut', { pts: [16, 23], unit: 'HL', len: ln({ [od]: [5, 13] }), invite: true,
      text: `5 cartes ou plus à ${nm(os)} et 16 HL ou plus : proposition de manche.` }), h => L(h, os) >= 5 && HL(h) >= 16));
    if (!free || levelOf(rep) <= 3) o.push(opt(rep, repS, h => L(h, os) >= 5 && lvlOk(rep, h)));
  }
  for (const t of ORDER) {
    if (t === os || prom.includes(t) || T.includes(t)) continue;
    const ch = cheapest(c, dn(t));
    if (!ch || levelOf(ch) > 3) continue;
    const j = raiseBy(ch, 1);
    if (j && levelOf(j) <= 3) o.push(opt(j, MC('Autre couleur avec saut', { pts: [16, 23], unit: 'HL', len: ln({ [dn(t)]: [4, 13] }), invite: true,
      text: `4 cartes ou plus à ${nm(t)} et 16 HL ou plus : proposition de manche.` }), h => L(h, t) >= 4 && HL(h) >= 16));
    o.push(opt(ch, MC('Autre couleur', { pts: [lo(ch), 23], unit: 'HL', len: ln({ [dn(t)]: [4, 13] }),
      text: `4 cartes ou plus à ${nm(t)}` + (lo(ch) > 12 ? ', et 15 HL ou plus (l\'adversaire a reparlé).' : '.') }), h => L(h, t) >= 4 && lvlOk(ch, h)));
  }
  if (free) {
    // R9 : le sens général (explication), puis un texte vrai pour les mains de 15 HL et plus
    const gen = 'L\'adversaire a reparlé : l\'ouvreur n\'est plus obligé de répondre au contre. Il ne parle qu\'au palier de 2, ou au palier de 3 avec 15 HL et plus.';
    o.push(opt('P', MC('Passe', { text: gen }), () => false));
    o.push(opt('P', MC('Passe', { text: 'L\'adversaire a reparlé : l\'ouvreur n\'est plus obligé de répondre au contre. Avec 15 HL et plus, il parle jusqu\'au palier de 3, mais ici aucune enchère ne convient jusqu\'à ce palier : il passe.' }),
      h => HL(h) >= 15));
    o.push(PASSE(gen));
  } else {
    if (rep) o.push(opt(rep, repS, h => L(h, os) >= 4));
    if (nt.n0) o.push(opt(nt.n0, nt.m0, () => true));
    if (rep) o.push(opt(rep, repS, () => true));
  }
  return o;
}
// Après un soutien du partenaire (fiche 05 : additionner le minimum et le maximum du camp) ; en compétition : règles de la suite.
// Après un soutien simple (6 à 10), la fiche 05 (R10, même phrase que C3) : en majeure, proposition avec 16 à 18 HLD,
// manche avec 19 et plus ; en mineure, 2SA avec 16-17 HL et des arrêts, 3SA avec 18 et plus et des arrêts, sinon
// répétition de la mineure (16-17) ou 5 en mineure (18 et plus).
function o2AfterRaise(c, od, os, free) {
  if (free) return null;
  const pm = summarize(c, c.partner);
  const pLast = explainAt(c.auction, c.dealer, pm.lastIdx);
  if (pLast.conclusion) return [PASSE('Le partenaire a conclu à la manche.')];
  const o = [];
  const g = bidOf(gameLevelOf(od), os), r1 = cheapest(c, od);
  const T = theirSuits(c), stops = h => T.every(s => stopper(h, s));
  if (pLast.invite) {
    // D8 : le partenaire propose la manche : l'ouvreur accepte avec le haut de sa fourchette (14 et plus, fiche 05)
    if (os <= 1) {
      if (legal(c, g)) o.push(opt(g, MC('Acceptation de la manche', { pts: [14, 37], unit: 'HLD', conclusion: true,
        text: 'Le partenaire propose la manche : l\'ouvreur accepte avec 14 points HLD et plus.' }), h => HLD(h, os) >= 14));
      o.push(PASSE('Ouverture minimale (moins de 14 points) : on refuse la proposition.', { pts: [12, 13], unit: 'HLD' }));
      return o;
    }
    // en mineure : 3SA avec l'arrêt et 14 H et plus ; 5♣/5♦ seulement si le camp a 30 points (fiche 16)
    const g5 = 30 - pm.min;
    if (legal(c, '3N')) o.push(opt('3N', MC('3SA', { pts: [14, 23], unit: 'H', conclusion: true,
      text: 'Proposition acceptée : 14 H et plus et un arrêt dans la couleur adverse. Le camp a 25 H : la manche à Sans-Atout.' }),
      h => hcp(h) >= 14 && stops(h)));
    if (legal(c, g)) o.push(opt(g, MC('Manche en mineure', { pts: [g5, 37], unit: 'HLD', conclusion: true,
      text: `Proposition acceptée : ${g5} points HLD et plus, le camp a les 30 points de la manche à ${nm(os)} (fiche 16).` }), h => HLD(h, os) >= g5));
    o.push(PASSE(`Proposition refusée : le camp n'a pas les 30 points de la manche à ${nm(os)}, et pas de 3SA (il faut 14 H et un arrêt dans leur couleur).`));
    return o;
  }
  const pmin = pm.min, pmax = pmaxOf(pm);
  const simple = pmin >= 6 && pmax <= 10;          // soutien simple : 6 à 10 points
  if (os <= 1) {
    // soutien simple : 19 et plus, manche ; 16 à 18, proposition (fiche 05) ; sinon additionner (fiche 05, 27 en majeure)
    const gT = simple ? 19 : 27 - pmin, iT = simple ? 16 : 27 - pmax;
    if (legal(c, g)) o.push(opt(g, MC('Manche', { pts: [gT, 37], unit: 'HLD', conclusion: true,
      text: simple ? '19 points HLD et plus en face d\'un soutien simple : la manche (fiche 05).'
        : 'Mes points HLD + le minimum du partenaire font 27 ou plus : la manche.' }), h => HLD(h, os) >= gT));
    const inv = r1 && r1 !== g && levelOf(r1) <= 3 && iT < gT;
    if (inv) o.push(opt(r1, MC('Proposition de manche', { pts: [iT, gT - 1], unit: 'HLD', invite: true,
      text: simple ? '16 à 18 points HLD en face d\'un soutien simple : proposition (fiche 05). Le partenaire dit la manche avec le haut de sa fourchette.'
        : 'Seul le maximum du partenaire donne les 27 points de la manche : proposition. Il la dit avec le haut de sa fourchette.' }), h => HLD(h, os) >= iT));
    o.push(PASSE(simple && inv ? 'Moins de 16 points HLD en face d\'un soutien simple : on s\'arrête là (fiche 05).'
      : simple ? 'Moins de 19 points HLD en face d\'un soutien simple, et plus de place pour proposer la manche : on s\'arrête là.'
      : 'Mes points + le minimum du partenaire n\'atteignent pas la manche, et pas de proposition à faire : on s\'arrête là.'));
    return o;
  }
  if (simple) {
    // en mineure (fiche 05) : 3SA avec 18 HL et plus et des arrêts (dans leur couleur, et 3 couleurs sur 3) ; 5♣/5♦ avec 18 et plus ;
    // 2SA avec 16-17 et des arrêts (leur couleur, 2 couleurs sur 3) ; répétition de la mineure avec 16-17 ; sinon passe
    const nst = h => [0, 1, 2, 3].filter(t => t !== os && stopper(h, t)).length;
    if (legal(c, '3N')) o.push(opt('3N', MC('3SA', { pts: [18, 23], unit: 'HL', conclusion: true,
      text: '18 points HL et plus en face d\'un soutien simple, avec des arrêts (dont un dans leur couleur) : la manche à Sans-Atout (fiche 05).' }),
      h => HL(h) >= 18 && stops(h) && nst(h) >= 3));
    if (legal(c, g)) o.push(opt(g, MC('Manche en mineure', { pts: [18, 23], unit: 'HL', conclusion: true,
      text: `18 points HL et plus en face d'un soutien simple, sans les arrêts pour Sans-Atout : la manche à ${nm(os)} (fiche 05).` }), h => HL(h) >= 18));
    if (legal(c, '2N')) o.push(opt('2N', MC('2SA', { pts: [16, 17], unit: 'HL', invite: true,
      text: '16 ou 17 points HL en face d\'un soutien simple, avec des arrêts (dont un dans leur couleur) : proposition de 3SA (fiche 05).' }),
      h => HL(h) >= 16 && stops(h) && nst(h) >= 2));
    if (r1 && r1 !== g && levelOf(r1) <= 3) o.push(opt(r1, MC('Répétition de la mineure', { pts: [16, 17], unit: 'HL',
      text: `16 ou 17 points HL en face d'un soutien simple, sans les arrêts pour 2SA : on répète ${nm(os)} (fiche 05).` }), h => HL(h) >= 16));
    o.push(opt('P', MC('Passe', { text: 'En face d\'un soutien simple : ni manche, ni proposition (fiche 05).' }), () => false));
    o.push(opt('P', MC('Passe', { pts: [12, 15], unit: 'HL', text: 'Ouverture minimale (12 à 15 points HL) en face d\'un soutien simple : on s\'arrête là (fiche 05).' }), h => HL(h) <= 15));
    o.push(PASSE('16 ou 17 points HL, mais après un soutien au palier de 3, il n\'y a plus de place pour proposer la manche : on s\'arrête là.'));
    return o;
  }
  // en mineure, soutien plus fort : 3SA avec l'arrêt si mes H + son minimum font 25 ; 2SA de proposition si seul son maximum
  // les donne ; 5♣/5♦ si mes points HLD + son minimum font 30 (fiche 16)
  const gN = 25 - pmin, iN = 25 - pmax;
  if (legal(c, '3N')) o.push(opt('3N', MC('3SA', { pts: [gN, 23], unit: 'H', conclusion: true,
    text: 'Un arrêt dans la couleur adverse ; mes H + le minimum du partenaire font 25 ou plus : la manche.' }), h => stops(h) && hcp(h) >= gN));
  if (legal(c, g)) o.push(opt(g, MC('Manche en mineure', { pts: [30 - pmin, 37], unit: 'HLD', conclusion: true,
    text: 'Mes points HLD + le minimum du partenaire font 30 ou plus : la manche en mineure.' }), h => HLD(h, os) + pmin >= 30));
  if (legal(c, '2N') && iN < gN) o.push(opt('2N', MC('2SA', { pts: [iN, gN - 1], unit: 'H', invite: true,
    text: 'Un arrêt dans la couleur adverse ; seul le maximum du partenaire donne les 25 H de la manche : proposition.' }), h => stops(h) && hcp(h) >= iN));
  o.push(PASSE('Mes points + le minimum du partenaire n\'atteignent pas la manche, et pas de proposition à faire : on s\'arrête là.'));
  return o;
}
// Après un SA du partenaire (1SA 8-10, 2SA 11-12 = proposition, 3SA 13 H et plus, avec un arrêt)
function o2AfterNT(c, od, os, free) {
  if (free) return null;
  const pm = summarize(c, c.partner);
  const r = c.seq[2];
  if (r === '3N') return [PASSE('Le partenaire a conclu à 3SA.')];
  const pLast = explainAt(c.auction, c.dealer, c.openIdx + 2);
  const pmin = pm.min, pmax = pmaxOf(pm);
  const o = [];
  const rep = cheapest(c, od), g = bidOf(gameLevelOf(od), os);
  if (pLast && pLast.invite) {
    // D8 : 2SA propose la manche ; l'ouvreur accepte avec 14 H et plus (fiche 05)
    if (os <= 1 && legal(c, g)) o.push(opt(g, MC('Manche à la couleur', { pts: [14, 23], unit: 'HL', len: ln({ [od]: [6, 13] }), conclusion: true,
      text: `Proposition acceptée : 6 cartes à ${nm(os)} et 14 points et plus, la manche en majeure.` }), h => L(h, os) >= 6 && HL(h) >= 14));
    if (legal(c, '3N')) o.push(opt('3N', MC('3SA', { pts: [14, 23], unit: 'H', conclusion: true,
      text: 'Proposition acceptée : 14 H et plus, le camp a 25 H.' }), h => hcp(h) >= 14));
    if (rep && levelOf(rep) <= 3) o.push(opt(rep, MC('Répétition de la couleur', { len: ln({ [od]: [6, 13] }), text: `Proposition refusée : 6 cartes ou plus à ${nm(os)}, main irrégulière.` }), h => L(h, os) >= 6));
    o.push(PASSE('Proposition refusée : moins de 14 H.', { pts: [12, 13], unit: 'H' }));
    return o;
  }
  if (legal(c, '3N')) o.push(opt('3N', MC('3SA', { pts: [25 - pmin, 23], unit: 'H', conclusion: true, text: 'Mes H + le minimum du partenaire font 25 ou plus : la manche.' }),
    h => hcp(h) + pmin >= 25 && (isRegular(h) || L(h, os) < 6)));
  if (r === '1N' && legal(c, '2N')) o.push(opt('2N', MC('2SA', { pts: [25 - pmax, 24 - pmin], unit: 'H', invite: true,
    text: 'Main régulière ; seul le maximum du partenaire donne les 25 H de la manche : proposition.' }), h => isRegular(h) && hcp(h) + pmax >= 25));
  if (rep && levelOf(rep) <= 3) o.push(opt(rep, MC('Répétition de la couleur', { len: ln({ [od]: [6, 13] }), text: `6 cartes ou plus à ${nm(os)}, main irrégulière.` }), h => L(h, os) >= 6));
  o.push(PASSE('Mes H + le minimum du partenaire n\'atteignent pas 25, et pas de proposition à faire : on reste en Sans-Atout.'));
  return o;
}
// Après une nouvelle couleur du partenaire (forcing) : comme la fiche 05
function o2AfterNewSuit(c, od, os, r, free) {
  const rd = denOf(r), rs = DEN_SUIT[rd], rl = levelOf(r);
  const pm = summarize(c, c.partner);
  const shown = pm.len[rs][0];
  const T = theirSuits(c);
  const o = [];
  const fit = h => L(h, rs) + shown >= 8 && L(h, rs) >= 3;
  const s1 = cheapest(c, rd), s2 = raiseBy(s1, 1), g = bidOf(gameLevelOf(rd), rs);
  const fl = ln({ [rd]: [Math.max(3, 8 - shown), 13] });
  const gThr = rl === 1 ? 19 : rl === 2 ? 16 : 12;              // au palier de 3, la nouvelle couleur promet 12 HL : la manche avec un fit
  if (rs <= 1 && legal(c, g)) o.push(opt(g, MC('Soutien à la manche', { pts: [gThr, 37], unit: 'HLD', len: fl, conclusion: true,
    text: rl >= 3 ? `Fit à ${nm(rs)} : le partenaire a 12 HL et plus, la manche.` : `Fit à ${nm(rs)} et ${gThr} points HLD ou plus : la manche (fiche 05).` }), h => fit(h) && HLD(h, rs) >= gThr));
  const jhi = rs <= 1 && legal(c, g) ? gThr - 1 : 37;
  if (s2 && levelOf(s2) <= 3 && s2 !== g && jhi >= 16) o.push(opt(s2, MC('Soutien à saut', { pts: [16, jhi], unit: 'HLD', len: fl, invite: true,
    text: `Fit à ${nm(rs)} et 16 points HLD ou plus : proposition de manche (fiche 05).` }), h => fit(h) && HLD(h, rs) >= 16));
  const s1hi = s2 && levelOf(s2) <= 3 && s2 !== g && jhi >= 16 ? 15 : rs <= 1 && legal(c, g) ? gThr - 1 : 37;
  if (s1 && levelOf(s1) <= 3 && s1 !== g) o.push(opt(s1, MC('Soutien simple', { pts: [12, s1hi], unit: 'HLD', len: fl,
    text: s1hi <= 15 ? `Fit à ${nm(rs)}, ouverture minimale (fiche 05).`
      : `Fit à ${nm(rs)}, ${s1hi >= 37 ? '12 points HLD et plus' : '12 à ' + s1hi + ' points HLD'} : soutien au palier le plus bas (fiche 05).` }), fit));
  // majeure 4e au palier de 1
  for (const t of [1, 0]) {
    const ch = cheapest(c, dn(t));
    if (t === os || t === rs || T.includes(t) || !ch || levelOf(ch) !== 1) continue;
    o.push(opt(ch, MC('Majeure 4e au palier de 1', { pts: [12, 23], unit: 'HL', len: ln({ [dn(t)]: [4, 13] }), text: `4 cartes à ${nm(t)} : priorité au fit en majeure (fiche 05).` }), h => L(h, t) >= 4));
  }
  // l'adversaire a reparlé : contre punitif avec 4 cartes dans leur couleur et 15 H et plus
  const lb = c.st.lastBid, vs = free && isBid(lb) && denOf(lb) !== 'N' && T.includes(DEN_SUIT[denOf(lb)]) ? DEN_SUIT[denOf(lb)] : -1;
  if (vs >= 0 && legal(c, 'X')) o.push(opt('X', MC('Contre punitif', { pts: [15, 23], unit: 'H', len: ln({ [dn(vs)]: [4, 13] }), conclusion: true,
    text: `L'adversaire a reparlé : 4 cartes ou plus à ${nm(vs)} et 15 H et plus, pour faire chuter les adversaires.` }), h => L(h, vs) >= 4 && hcp(h) >= 15));
  // fiche 05 (R13) : 6 cartes dans la majeure d'ouverture et 19 HL : la manche directement (avant les Sans-Atout)
  const g4 = bidOf(4, os);
  if (os <= 1 && legal(c, g4) && !o.some(x => x.call === g4)) o.push(opt(g4, MC('Manche : 6 cartes et main forte', { pts: [19, 23], unit: 'HL',
    len: ln({ [od]: [6, 13] }), conclusion: true, text: `6 cartes ou plus à ${nm(os)} et 19 points HL ou plus : la manche (fiche 05).` }),
    h => L(h, os) >= 6 && HL(h) >= 19));
  // Sans-Atout avec un arrêt dans la couleur adverse (l'adversaire a reparlé : les retours à SA de la fiche 05)
  const nt = ntOpts(c, T, pm.min, pmaxOf(pm), free, free);
  o.push(...nt.o);
  // 2e couleur (bicolore économique ou cher)
  for (const t of [0, 1, 2, 3]) {
    if (t === os || t === rs || T.includes(t)) continue;
    const ch = cheapest(c, dn(t));
    if (!ch || levelOf(ch) === 1 || levelOf(ch) > 3) continue;
    const dear = t < os || levelOf(ch) >= 3;            // plus chère que la couleur d'ouverture, ou au palier de 3
    const need = dear ? 17 : 12;
    o.push(opt(ch, MC(dear ? 'Bicolore « cher »' : 'Bicolore « économique »', { pts: [need, 23], unit: 'HL', len: ln({ [od]: [5, 13], [dn(t)]: [4, 13] }), forcing: dear ? 1 : 0,
      text: `5 cartes à ${nm(os)} et 4 cartes ou plus à ${nm(t)}` + (dear ? ', 17 HL et plus. Forcing.' : '.') }),
      h => L(h, os) >= 5 && L(h, t) >= 4 && HL(h) >= need && L(h, rs) < 4));
  }
  // répétition
  const rep = cheapest(c, od), jr = raiseBy(rep, 1);
  if (jr && levelOf(jr) <= 3) o.push(opt(jr, MC('Répétition à saut', { pts: [16, 18], unit: 'HL', len: ln({ [od]: [6, 13] }), text: `6 cartes ou plus à ${nm(os)}, 16 à 18 HL.` }), h => L(h, os) >= 6 && HL(h) >= 16 && HL(h) <= 18));
  const minRep = free ? 6 : os <= 1 ? 5 : nt.n0 ? 4 : 3;
  const repM = MC('Répétition de la couleur', { len: ln({ [od]: [minRep, 13] }),
    text: free ? `${minRep} cartes ou plus à ${nm(os)} : on répète sa couleur.`
      : os <= 1 ? `Couleur d'ouverture répétée : 6 cartes en majeure (5, faute de mieux).`
      : `Couleur d'ouverture répétée : 5 cartes en mineure, ou ${minRep === 3 ? '3 ou 4' : '4'} cartes faute de mieux.` });
  if (rep && levelOf(rep) <= 3) o.push(opt(rep, repM, h => L(h, os) >= (free || os <= 1 ? 6 : 5)));
  if (free) {
    // R9 : le sens général de la Passe (explication), puis deux textes pour le Conseil : main minimale, main plus forte
    o.push(opt('P', MC('Passe', { text: 'L\'adversaire a reparlé : l\'ouvreur n\'est plus obligé de parler, et aucune enchère de la fiche ne convient à sa main.' }), () => false));
    o.push(opt('P', MC('Passe', { text: 'L\'adversaire a reparlé : avec une ouverture minimale et rien de plus à dire, l\'ouvreur peut passer.' }), h => HL(h) <= 14));
    o.push(PASSE('L\'adversaire a reparlé, et aucune enchère de la fiche ne convient à ma main (fit, contre punitif, Sans-Atout, 2e couleur ou répétition jusqu\'au palier de 3) : l\'ouvreur passe, le partenaire peut encore parler.'));
  } else {
    if (rep) o.push(opt(rep, repM, h => L(h, os) >= minRep));
    if (nt.n0) o.push(opt(nt.n0, nt.m0, () => true));
    if (rep) o.push(opt(rep, repM, () => true));
  }
  return o;
}
// Le partenaire a passé (1x (y) P P, 1x (y) P (z) quand ils ont soutenu ou répété leur couleur, ou 1x P P (y)) :
// leur couleur au palier de 1, 2 ou 3. Contre de réveil (d'appel, comme la fiche 10) : court dans leur couleur (2 cartes au plus)
// et 3 cartes ou plus dans les deux autres couleurs, 12 HL (16 HL au palier de 3) ; ou 18 HL et plus. Au palier de 3 ou 4,
// bicolore 5-5 : la 2e couleur (14 HL au palier de 3, 16 au palier de 4). 6 cartes : on les répète (palier de 3 avec 16 HL).
// Sinon on passe. (Mesuré : le contre sans les 3 cartes, et le bicolore au palier de 2, font perdre des IMP.)
function o2PartnerPassed(c, od, os, it) {
  const o = [];
  const lb = c.st.lastBid, T = theirSuits(c);
  const ls = isBid(lb) && denOf(lb) !== 'N' ? DEN_SUIT[denOf(lb)] : -1;
  // une seule couleur adverse, naturelle, qui est leur dernière enchère (pas un cue-bid dans notre couleur)
  const vs = (it.kind === 'suit' || it.kind === 'P') && T.length === 1 && ls === T[0] ? ls : -1;
  const lv = isBid(lb) ? levelOf(lb) : 0;
  const xOk = vs >= 0 && lv <= 3 && legal(c, 'X');
  const xMin = lv >= 3 ? 16 : 12;
  // bicolore : 5 cartes dans la couleur d'ouverture et 5 dans une 2e couleur, au palier de 3 (14 HL) ou de 4 en mineure (16 HL)
  if (vs >= 0) for (const t of ORDER) {
    if (t === os || T.includes(t)) continue;
    const ch = cheapest(c, dn(t));
    if (!ch || levelOf(ch) < 3 || levelOf(ch) > (t <= 1 ? 3 : 4)) continue;
    const need = levelOf(ch) === 3 ? 14 : 16;
    o.push(opt(ch, MC('Bicolore', { pts: [need, 23], unit: 'HL', len: ln({ [od]: [5, 13], [dn(t)]: [5, 13] }),
      text: `5 cartes ou plus à ${nm(os)} et 5 cartes ou plus à ${nm(t)}, ${need} HL ou plus : on montre sa 2e couleur.` }),
      h => L(h, os) >= 5 && L(h, t) >= 5 && HL(h) >= need && L(h, vs) <= 2 && bestOf(h, [0, 1, 2, 3].filter(u => u !== os && !T.includes(u))) === t));
  }
  const others = [0, 1, 2, 3].filter(u => u !== os && u !== vs);
  if (xOk) o.push(opt('X', MC(REOPEN, { pts: [xMin, 23], unit: 'HL',
    text: `Court à ${nm(vs)} (2 cartes au plus), 3 cartes ou plus à ${nm(others[0])} et à ${nm(others[1])}, et ${xMin} HL ou plus ; ou 18 HL et plus : contre d'appel. Le partenaire répond, ou il passe avec de bonnes cartes à ${nm(vs)}.` }),
    h => (L(h, vs) <= 2 && others.every(u => L(h, u) >= 3) && HL(h) >= xMin) || HL(h) >= 18));
  const rep = cheapest(c, od);
  if (rep && levelOf(rep) <= 3) {
    const l3 = levelOf(rep) === 3;
    o.push(opt(rep, MC('Répétition de la couleur', { pts: [l3 ? 16 : 12, xOk ? 17 : 23], unit: 'HL', len: ln({ [od]: [6, 13] }),
      text: l3 ? `6 cartes ou plus à ${nm(os)} et 16 HL ou plus : on la répète au palier de 3.` : `6 cartes ou plus à ${nm(os)} : on la répète au palier de 2.` }),
      h => L(h, os) >= 6 && (!l3 || HL(h) >= 16)));
  }
  o.push(PASSE(xOk ? `Le partenaire a passé, et ni contre de réveil (court à ${nm(vs)} avec 3 cartes dans les autres couleurs et ${xMin} HL, ou 18 HL), ni couleur à montrer : on laisse jouer.`
    : 'Le partenaire a passé, mais ils ont nommé deux couleurs (ou joué à Sans-Atout, ou fait un bicolore), ou ils sont au palier de 4 : la fiche ne prévoit ici ni contre de réveil, ni couleur de 6 cartes à répéter. On laisse jouer.'));
  return o;
}
// Le partenaire de l'ouvreur répond au contre de réveil : il passe avec de bonnes cartes dans leur couleur (le contre devient
// punitif) ; sinon il répond comme à un contre d'appel, sans sauter sans 11 H
function r2AfterReopen(c, od, os, vs) {
  const T = theirSuits(c);
  const good = h => L(h, vs) >= 5 || (L(h, vs) >= 4 && honors(h, vs) >= 2 && bigHonors(h, vs) >= 1);
  const o = [opt('P', MC('Passe : contre punitif', { len: ln({ [dn(vs)]: [4, 13] }), conclusion: true,
    text: `De bonnes cartes à ${nm(vs)} (4 cartes avec 2 honneurs, ou 5 cartes) : on passe, le contre de l'ouvreur devient punitif.` }), good)];
  const cands = [0, 1, 2, 3].filter(t => !T.includes(t));
  // la couleur de réponse : une majeure 4e non nommée, sinon la couleur d'ouverture (3 cartes en majeure, 4 en mineure), sinon la plus longue
  const pref = h => {
    const m = [1, 0].filter(t => t !== os && !T.includes(t) && L(h, t) >= 4);
    if (m.length) return bestOf(h, m);
    if (L(h, os) >= (os <= 1 ? 3 : 4)) return os;
    return bestOf(h, cands);
  };
  const ntc = cheapest(c, 'N');
  if (ntc && levelOf(ntc) <= 2) o.push(opt(ntc, MC('Sans-Atout au palier le plus bas', { pts: [8, 12], unit: 'H',
    text: `Un arrêt à ${nm(vs)} et 8 à 12 H, pas de majeure 4e : réponse au contre de l'ouvreur.` }),
    h => stopper(h, vs) && hcp(h) >= 8 && pref(h) !== 0 && pref(h) !== 1));
  else if (ntc === '3N') o.push(opt('3N', MC('3SA', { pts: [8, 37], unit: 'H', conclusion: true,
    text: `Un arrêt à ${nm(vs)} et 8 H ou plus, pas de majeure 4e : avec les 16 HL de l'ouvreur, la manche à Sans-Atout.` }),
    h => stopper(h, vs) && hcp(h) >= 8 && pref(h) !== 0 && pref(h) !== 1));
  const jumps = {};
  for (const t of ORDER) {
    if (T.includes(t)) continue;
    const ch = cheapest(c, dn(t)), j = raiseBy(ch, 1);
    if (!j || levelOf(j) > 3 || isGameBid(j)) continue;
    jumps[t] = true;
    o.push(opt(j, MC('Réponse au contre avec saut', { pts: [11, 12], unit: 'H', len: ln({ [dn(t)]: [t === os ? 3 : 4, 13] }), invite: true,
      text: `11 ou 12 H et ${t === os ? '3' : '4'} cartes ou plus à ${nm(t)} : proposition de manche.` }), h => hcp(h) >= 11 && pref(h) === t && L(h, t) >= (t === os ? 3 : 4)));
  }
  for (const t of ORDER) {
    if (T.includes(t)) continue;
    const ch = cheapest(c, dn(t));
    if (!ch) continue;
    const hi = jumps[t] ? 10 : levelOf(ch) >= 4 ? 37 : 12;
    o.push(opt(ch, MC('Réponse au contre de l\'ouvreur', { pts: [0, hi], unit: 'H', len: ln({ [dn(t)]: [3, 13] }), conclusion: isGameBid(ch),
      text: `Au palier le plus bas : ${t === os ? 'la couleur de l\'ouvreur (3 cartes ou plus)' : `4 cartes à ${nm(t)} de préférence (au moins 3)`}` + (hi === 10 ? ', 0 à 10 H.' : hi === 12 ? ', 12 H au plus.' : isGameBid(ch) ? ' : c\'est déjà la manche.' : '.') }),
      h => pref(h) === t));
  }
  return o;
}
function o2AfterXX(c) {
  const z = c.seq[3];
  if (!isBid(z) || denOf(z) === 'N') return [PASSE('Après le surcontre du partenaire, l\'ouvreur passe : le partenaire décide.')];
  const zs = DEN_SUIT[denOf(z)];
  return [opt('X', MC('Contre punitif', { len: ln({ [dn(zs)]: [4, 13] }), conclusion: true, text: `4 cartes ou plus à ${nm(zs)} : pour faire chuter les adversaires.` }), h => L(h, zs) >= 4),
    PASSE('Après le surcontre du partenaire, l\'ouvreur passe : le partenaire décide (il contrera).')];
}

function o2Suit(c) {
  const od = c.seq[0][1], os = DEN_SUIT[od];
  const ov = c.seq[1], r = c.seq[2], z = c.seq[3];
  const free = isBid(z);                  // l'adversaire de droite a enchéri : l'ouvreur n'est plus obligé de parler
  const it = interv(c, os);
  if (r === 'P') return o2PartnerPassed(c, od, os, it);
  if (r === 'XX') return o2AfterXX(c);
  if (r === 'X') {
    if (it.kind === 'suit' && levelOf(ov) <= 3) return o2Spoutnik(c, od, os, it.s, free);
    return null;                           // contre punitif du partenaire : règles de la suite
  }
  if (!isBid(r)) return null;
  const pl = explainAt(c.auction, c.dealer, c.openIdx + 2);
  if (pl && pl.conclusion) return free ? null : [PASSE('Le partenaire a conclu : on passe.')];
  const rd = denOf(r);
  if (rd === od) return o2AfterRaise(c, od, os, free);
  if (rd === 'N') return o2AfterNT(c, od, os, free);
  if (theirSuits(c).includes(DEN_SUIT[rd])) return null;      // cue-bid du partenaire : règles de la suite (forcing de manche)
  return o2AfterNewSuit(c, od, os, r, free);
}
// Ouverture 1SA : l'ouvreur passe ensuite ; si l'adversaire contre le Stayman ou le Texas, il répond normalement (fiches 11 et 14)
function o2NT(c) {
  const ov = c.seq[1], r = c.seq[2], z = c.seq[3];
  if (ov === 'P' && z === 'X' && r === '2C') {
    const t = 'Malgré le contre, l\'ouvreur répond au Stayman comme d\'habitude (fiche 11).';
    return [
      opt('2N', MC('Réponse au Stayman : 4 cœurs et 4 piques', { len: ln({ H: [4, 4], S: [4, 4] }), text: t }), h => L(h, 0) === 4 && L(h, 1) === 4),
      opt('2H', MC('Réponse au Stayman : 4 cœurs', { len: ln({ H: [4, 4] }), text: t }), h => L(h, 1) === 4),
      opt('2S', MC('Réponse au Stayman : 4 piques', { len: ln({ S: [4, 4] }), text: t }), h => L(h, 0) === 4),
      opt('2D', MC('Réponse au Stayman : pas de majeure 4e', { len: ln({ H: [0, 3], S: [0, 3] }), text: t }), () => true)];
  }
  if (ov === 'P' && z === 'X' && (r === '2D' || r === '2H'))
    return [opt(r === '2D' ? '2H' : '2S', MC('Texas complété', { text: 'Malgré le contre, l\'ouvreur complète le Texas comme d\'habitude (fiche 14).' }), () => true)];
  if (ov === 'P' && r !== 'P' && z === 'X') return null;
  return [PASSE('Après l\'intervention, l\'ouvreur de 1SA passe : le partenaire décide.')];
}

/* ====================================================================
   3. LA SUITE DE LA COMPÉTITION
   ==================================================================== */
function later(c) {
  const a = c.auction, n = c.n, side = sideOf(c.seat);
  const lb = c.st.lastBid;
  if (!lb) return null;
  const pm = summarize(c, c.partner), mm = summarize(c, c.seat);
  const theirs = sideOf(c.st.lastBidSeat) !== side;
  const T = theirSuits(c);
  const pIdx = pm.lastIdx, pLast = pIdx >= 0 ? explainAt(a, c.dealer, pIdx) : null;
  const oppBidAfter = i => c.calls.some(x => x.i > i && sideOf(x.seat) !== side && isBid(x.call));
  const ts = isBid(lb) && denOf(lb) !== 'N' ? DEN_SUIT[denOf(lb)] : -1;   // l'atout du contrat en cours
  const trumps = h => ts < 0 || L(h, ts) >= 4 || (L(h, ts) >= 3 && hon(h, ts));
  const fitSuits = [0, 1, 2, 3].filter(s => !T.includes(s) && pm.len[s][0] >= 2);
  const tot = (h, s) => L(h, s) + pm.len[s][0];
  const bestFit = h => { let b = -1, sc = 0; for (const s of fitSuits) { const t = tot(h, s); if (t >= 8) { const v = t + (s <= 1 ? 1.5 : 0); if (v > sc) { sc = v; b = s; } } } return b; };
  const flen = s => ln({ [dn(s)]: [Math.max(0, 8 - pm.len[s][0]), 13] });

  // (c) Le partenaire a conclu (manche, contre punitif, enchère pour jouer) : on passe, sauf chelem.
  // Une enchère forcing ou un cue-bid n'est jamais une conclusion.
  if (pLast && pLast.conclusion && !pLast.forcing && !oppBidAfter(pIdx)) {
    const o = [];
    const ps = isBid(lb) && !theirs && denOf(lb) !== 'N' ? DEN_SUIT[denOf(lb)] : -1;
    if (ps >= 0 && legal(c, '4N') && !c.calls.some(x => x.call === '4N' && sideOf(x.seat) === side))
      o.push(opt('4N', MC('Blackwood (5 clés)', { forcing: 1, alert: true, text: 'Fit et 33 points dans le camp : le chelem est possible. Demande des clés (fiche 08).' }), h => tot(h, ps) >= 8 && HLD(h, ps) + pm.min >= 33));
    o.push(PASSE('Le partenaire a conclu : on passe.'));
    return o;
  }
  // (d), (e) : additionner mes points et le minimum du partenaire : la manche s'ils l'atteignent (fiche 16 : 25 / 27 / 30)
  const o = [];
  const add = (call, m, ok) => { const f = o.find(x => x.call === call); o.push(opt(call, f ? f.m : m, ok)); };
  const ourNamed = [0, 1, 2, 3].filter(s => c.calls.some(x => sideOf(x.seat) === side && isBid(x.call) && denOf(x.call) === dn(s)));
  const pmin = pm.min, pmax = pmaxOf(pm);
  const gameOf = s => bidOf(gameLevelOf(dn(s)), s);
  const six = h => [0, 1].filter(s => !T.includes(s) && L(h, s) >= 6 && tot(h, s) < 8).sort((x, y) => L(h, y) - L(h, x))[0];
  // l'arrêt dans leur couleur : chez moi, ou promis par le partenaire (il a dit SA après leur intervention)
  const firstOpp = c.calls.find(x => sideOf(x.seat) !== side && x.call !== 'P');
  const pNT = !!firstOpp && c.calls.some(x => x.seat === c.partner && x.i > firstOpp.i && isBid(x.call) && denOf(x.call) === 'N');
  const ntOk = h => pNT || T.every(u => stopper(h, u));
  // dénomination : fit en majeure, majeure de 6 cartes, Sans-Atout (arrêt dans leur couleur), fit en mineure
  const den = h => {
    const b = bestFit(h);
    if (b >= 0 && b <= 1) return b;
    const m6 = six(h); if (m6 !== undefined) return m6;
    if (ntOk(h)) return 4;
    return b;
  };
  const pts = (h, s) => s === 4 ? hcp(h) : tot(h, s) >= 8 ? HLD(h, s) : HL(h);
  const mGame = {};
  const gameM = s => mGame[s] = mGame[s] || (s === 4
    ? MC('3SA', { conclusion: true, text: 'Un arrêt dans la couleur adverse (chez soi ou chez le partenaire qui a dit SA) ; mes H + le minimum du partenaire font 25 ou plus : la manche à Sans-Atout.' })
    : MC('Manche', { len: ln({ [dn(s)]: [Math.min(6, Math.max(0, 8 - pm.len[s][0])), 13] }), conclusion: true,
      text: `Fit à ${nm(s)} (ou 6 cartes en majeure) ; mes points + le minimum du partenaire font ${NEED(s)} ou plus : la manche (fiche 16).`
        + (theirs ? ' En compétition, aussi avec assez d\'atouts (loi de Vernes).' : '') }));
  const games = [];
  for (const s of [1, 0, 4, 3, 2]) {
    const g = s === 4 ? '3N' : gameOf(s);
    if (legal(c, g)) games.push(opt(g, gameM(s), h => den(h) === s && pts(h, s) + pmin >= NEED(s)));
  }
  // Forcing de manche (cue-bid, saut en nouvelle couleur…) : on ne s'arrête jamais sous la manche, même si l'adversaire
  // enchérit. comp : l'adversaire vient d'enchérir. Ordre : contre punitif (des atouts chez eux), la manche dans le fit
  // (ou la majeure 6e), 3SA avec l'arrêt, la manche en mineure, sinon sa couleur la plus longue au palier le plus bas
  // (sous la manche) ; en compétition, en dernier recours, le contre punitif (le camp a les points de la manche).
  const gfList = comp => {
    const g = [];
    const xOk = comp && legal(c, 'X') && (ts < 0 || T.includes(ts));
    if (xOk) {
      g.push(opt('X', MC('Contre punitif', { conclusion: true,
        text: 'Forcing de manche, et l\'adversaire enchérit : on contre pour les faire chuter (avec des atouts chez eux, ou faute d\'autre enchère).' }), () => false));
      g.push(opt('X', MC('Contre punitif', { conclusion: true,
        text: 'Forcing de manche, et l\'adversaire enchérit : avec des atouts chez eux (4 cartes, ou 3 avec un honneur), on contre pour les faire chuter.' }), trumps));
    }
    const gfMs = {};
    const gfM = s => gfMs[s] = gfMs[s] || MC(s === 4 ? '3SA' : 'Manche', { conclusion: true, len: s === 4 ? undefined : s <= 1 ? gameM(s).len : flen(s),
      text: s === 4 ? 'Forcing de manche : un arrêt dans leur couleur (chez soi ou chez le partenaire), 3SA.' : `Forcing de manche : fit à ${nm(s)}${s <= 1 ? ' (ou 6 cartes)' : ''}, la manche.` });
    for (const s of [1, 0]) if (legal(c, gameOf(s))) g.push(opt(gameOf(s), gfM(s), h => bestFit(h) === s || six(h) === s));
    if (legal(c, '3N')) g.push(opt('3N', gfM(4), ntOk));
    for (const s of [3, 2]) if (legal(c, gameOf(s))) g.push(opt(gameOf(s), gfM(s), h => bestFit(h) === s));
    // ni fit ni arrêt : sa couleur la plus longue, au palier le plus bas (on continue jusqu'à la manche)
    const cands = [0, 1, 2, 3].filter(s => !T.includes(s));
    const below = comp ? cands.filter(s => { const ch = cheapest(c, dn(s)); return ch && !isGameBid(ch) && !g.some(x => x.call === ch); }) : cands;
    for (const s of ORDER) {
      if (T.includes(s)) continue;
      const ch = cheapest(c, dn(s));
      if (!ch || (comp && !below.includes(s))) continue;
      const ex = g.find(x => x.call === ch);
      g.push(opt(ch, ex ? ex.m : MC('Couleur (forcing de manche)', { len: ln({ [dn(s)]: [3, 13] }), forcing: 1,
        text: `Forcing de manche, ni fit ni arrêt : on nomme sa couleur la plus longue (${nm(s)}), pour chercher le contrat.` }),
        h => bestOf(h, comp ? below : cands) === s && L(h, s) >= 3));
    }
    if (xOk) g.push(opt('X', MC('Contre punitif', { conclusion: true,
      text: 'Forcing de manche : le camp a les points de la manche, mais ni fit, ni arrêt, ni couleur à nommer sous la manche. On contre pour les faire chuter.' }), () => true));
    return g;
  };
  // notre camp a déjà dit une manche
  const ourGame = c.calls.some(x => sideOf(x.seat) === side && isGameBid(x.call));
  if (theirs) {
    // (d) Compétition. Forcing de manche : on continue (voir plus haut).
    if ((mm.gf || pm.gf) && !ourGame) return gfList(true);
    // Sinon : la manche si les points y sont, sinon contre punitif, sinon loi de Vernes (palier 4 en majeure, 5 en mineure),
    // sinon, avec les points de la manche sans fit ni arrêt, une nouvelle couleur forcing (comme en (e)), sinon passe.
    o.push(...games);
    if (legal(c, 'X') && (ts < 0 || T.includes(ts))) o.push(opt('X', MC('Contre punitif', { conclusion: true,
      text: 'Le camp a la majorité (22 points et plus avec le minimum du partenaire) et des atouts adverses (4 cartes, ou 3 avec un honneur) : pour faire chuter.' }),
      h => hcp(h) + pmin >= MAJ && trumps(h)));
    for (const s of fitSuits) {
      const call = cheapest(c, dn(s));
      if (!call) continue;
      const lv = levelOf(call), other = pm.len[s][0], need = Math.max(0, lv + 6 - other);
      if (lv > (s >= 2 ? 5 : 4) || need > 13) continue;
      const name = call === gameOf(s) ? gameM(s).name : 'Compétition (loi de Vernes)';
      o.push(...byTrumps(call, name, s, other, need,
        (k, exact) => `Fit à ${nm(s)} : ${exact ? k - other : 'au moins ' + (k - other)} cartes chez moi et au moins ${other} promises par le partenaire, le camp a au moins ${k} atouts. On peut jouer au palier de ${lv}. ${VERNES_S}`,
        h => bestFit(h) === s, call === gameOf(s) ? { conclusion: true } : {}).slice(call === gameOf(s) ? 1 : 0));
    }
    // les points de la manche (25 H avec le minimum du partenaire), mais ni fit ni arrêt : une nouvelle couleur de 4 cartes,
    // forcing, jusqu'au palier de 3 (la ligne « Son enchère » de la fiche)
    const nsOk = [0, 1, 2, 3].filter(s => {
      if (T.includes(s) || ourNamed.includes(s)) return false;
      const ch = cheapest(c, dn(s));
      return ch && levelOf(ch) <= 3 && !o.some(x => x.call === ch);
    });
    for (const s of ORDER) {
      if (!nsOk.includes(s)) continue;
      o.push(opt(cheapest(c, dn(s)), MC('Nouvelle couleur (forcing)', { len: ln({ [dn(s)]: [4, 13] }), forcing: 1,
        text: `Les points de la manche (25 H avec le minimum du partenaire), mais ni fit ni arrêt : 4 cartes ou plus à ${nm(s)}, pour chercher le contrat.` }),
        h => den(h) < 0 && hcp(h) + pmin >= 25 && L(h, s) >= 4 && bestOf(h, nsOk) === s));
    }
    // R9 : le sens général de la Passe (explication), puis un texte vrai pour chaque main
    const noX = '(il faut 22 points à deux et des atouts chez eux)';
    o.push(opt('P', MC('Passe', { text: 'On laisse jouer les adversaires : ni manche à dire, ni contre punitif, ni enchère permise par la loi de Vernes.' }), () => false));
    o.push(opt('P', MC('Passe', { text: `Notre camp a déjà dit la manche, et l'adversaire enchérit au-dessus. Pas de quoi contrer ${noX}, et pas assez d'atouts pour monter (loi de Vernes) : on passe.` }),
      () => ourGame));
    o.push(opt('P', MC('Passe', { text: 'Le camp a les points de la manche (25 H avec le minimum du partenaire), mais ni fit, ni arrêt dans leur couleur, ni atouts pour contrer, ni couleur de 4 cartes à nommer jusqu\'au palier de 3 : on passe.' }),
      h => den(h) < 0 && hcp(h) + pmin >= 25));
    o.push(opt('P', MC('Passe', { text: `Le camp a les points de la manche, mais l'adversaire a enchéri au-dessus de notre manche. Pas de quoi contrer ${noX}, et la loi de Vernes ne permet pas de monter : on passe.` }),
      h => den(h) >= 0 && pts(h, den(h)) + pmin >= NEED(den(h))));
    o.push(opt('P', MC('Passe', { text: `Le camp a 25 H, mais pas d'arrêt dans leur couleur pour 3SA, et pas les 30 points de la manche en mineure. Pas de quoi contrer ${noX}, et pas assez d'atouts pour monter (loi de Vernes) : on passe.` }),
      h => den(h) >= 2 && !ntOk(h) && hcp(h) + pmin >= 25));
    o.push(PASSE(`Pas assez de points pour la manche, pas de quoi contrer ${noX}, et pas assez d'atouts pour enchérir. ${VERNES_S}`));
    return o;
  }
  // (e) Les adversaires se taisent : comme sans intervention (fiche 05)
  if (c.st.lastBidSeat === c.seat) return [PASSE('On garde notre contrat.')];
  const rhoPass = a[n - 1] === 'P' && pIdx === n - 2;
  const forced = pLast && pLast.forcing >= 1 && rhoPass;
  if (pLast && pLast.invite && rhoPass) {
    // D8 : le partenaire propose la manche : on accepte avec le haut de sa fourchette (ouvreur : 14 et plus, fiche 05),
    // ou si mes points + son minimum atteignent la manche
    const curS = sOf(lb), g = curS === 4 ? '3N' : gameOf(curS);
    const top = c.seat === c.opener ? 14 : Math.floor((mm.min + Math.min(mm.max, mm.min + 8)) / 2) + 1;
    const p = h => curS === 4 ? hcp(h) : tot(h, curS) >= 8 ? HLD(h, curS) : HL(h);
    if (curS >= 2 && curS <= 3) {
      // en mineure : 3SA avec l'arrêt, 5♣/5♦ seulement avec les 30 points du camp (fiche 16)
      if (legal(c, '3N')) o.push(opt('3N', MC('3SA', { conclusion: true, text: 'Proposition acceptée : le haut de sa fourchette et un arrêt dans leur couleur, la manche à Sans-Atout.' }),
        h => ntOk(h) && (hcp(h) >= top || hcp(h) + pmin >= 25)));
      if (legal(c, g)) o.push(opt(g, MC('Acceptation de la manche', { conclusion: true, text: 'Proposition acceptée : mes points HLD + le minimum du partenaire font 30 ou plus.' }),
        h => tot(h, curS) >= 8 && HLD(h, curS) + pmin >= 30));
    } else {
      if (legal(c, g)) o.push(opt(g, MC('Acceptation de la manche', { conclusion: true,
        text: curS === 4 ? 'Le partenaire propose la manche : on accepte avec le haut de sa fourchette, ou si mes points + son minimum l\'atteignent.'
          : `Le partenaire propose la manche à ${nm(curS)} : avec le fit (8 atouts dans le camp), on accepte avec le haut de sa fourchette, ou si mes points + son minimum l'atteignent.` }),
        h => (curS === 4 || tot(h, curS) >= 8) && (p(h) >= top || p(h) + pmin >= NEED(curS))));
      if (curS <= 1 && legal(c, '3N')) o.push(opt('3N', MC('3SA', { conclusion: true,
        text: `Proposition acceptée sans fit à ${nm(curS)} : le haut de ma fourchette et un arrêt dans leur couleur, la manche à Sans-Atout.` }),
        h => tot(h, curS) < 8 && ntOk(h) && (hcp(h) >= top || hcp(h) + pmin >= 25)));
    }
    // R9 : le sens général (explication), puis le texte vrai pour chaque main
    o.push(opt('P', MC('Passe', { text: 'Proposition refusée : pas de quoi accepter la manche.' }), () => false));
    o.push(opt('P', MC('Passe', { text: 'Proposition refusée : on est dans le bas de sa fourchette.' }), h => p(h) < top && p(h) + pmin < NEED(curS)));
    o.push(PASSE(curS === 4 ? 'Proposition refusée : on est dans le bas de sa fourchette.'
      : curS >= 2 ? `Proposition refusée : pas de 3SA (il faut un arrêt dans leur couleur), et le camp n'a pas les 30 points de la manche à ${nm(curS)} (fiche 16).`
      : `Proposition refusée : sans fit à ${nm(curS)} (8 atouts dans le camp), et pas de 3SA (il faut un arrêt dans leur couleur et assez de points H).`));
    return o;
  }
  // forcing de manche (cue-bid) : on ne s'arrête pas avant la manche
  if ((mm.gf || pm.gf) && !isGameBid(lb)) return gfList(false);
  o.push(...games);
  // proposition de manche : seul le maximum du partenaire l'atteint (et l'adversaire se tait)
  const myNamed = [0, 1, 2, 3].filter(s => c.calls.some(x => x.seat === c.seat && isBid(x.call) && denOf(x.call) === dn(s)));
  if (!forced) for (const s of [1, 0, 4, 3, 2]) {
    const inv = s === 4 ? '2N' : bidOf(gameLevelOf(dn(s)) - 1, s);
    if (!legal(c, inv) || (s !== 4 && !fitSuits.includes(s) && !myNamed.includes(s))) continue;
    add(inv, MC('Proposition de manche', { invite: true, len: s === 4 ? undefined : gameM(s).len,
      text: 'Seul le maximum du partenaire donne les points de la manche : proposition. Il la dit avec le haut de sa fourchette.' }), h => den(h) === s && pts(h, s) + pmax >= NEED(s));
  }
  // les points de la manche, mais ni fit ni arrêt : une nouvelle couleur (forcing) pour chercher le contrat
  const cands = [0, 1, 2, 3].filter(s => !T.includes(s));
  if (!forced) for (const s of ORDER) {
    if (T.includes(s) || ourNamed.includes(s)) continue;
    const ch = cheapest(c, dn(s));
    if (!ch || levelOf(ch) > 3) continue;
    add(ch, MC('Nouvelle couleur (forcing)', { len: ln({ [dn(s)]: [4, 13] }), forcing: 1,
      text: `Les points de la manche (25 H avec le minimum du partenaire), mais ni fit ni arrêt : 4 cartes ou plus à ${nm(s)}, pour chercher le contrat.` }),
      h => den(h) < 0 && hcp(h) + pmin >= 25 && L(h, s) >= 4 && bestOf(h, cands.filter(u => !ourNamed.includes(u))) === s);
  }
  if (forced) {
    // enchère obligée : seulement des enchères qui n'ont pas déjà un autre sens dans cette liste
    const free = call => call && !o.some(x => x.call === call);
    for (const s of fitSuits) {
      const ch = cheapest(c, dn(s));
      if (free(ch)) o.push(opt(ch, MC('Soutien', { len: flen(s), text: `Fit à ${nm(s)} (enchère obligée).` }), h => bestFit(h) === s));
      else if (ch && ch === gameOf(s)) o.push(opt(ch, gameM(s), h => bestFit(h) === s));        // le soutien est déjà la manche
    }
    const nt = cheapest(c, 'N');
    if (free(nt)) o.push(opt(nt, MC('SA', { text: 'Enchère obligée : un arrêt dans la couleur adverse.' }), h => ntOk(h)));
    else if (nt === '3N') o.push(opt(nt, gameM(4), h => ntOk(h)));
    for (const s of ORDER) { if (T.includes(s)) continue; const ch = cheapest(c, dn(s)); if (free(ch)) o.push(opt(ch, MC('Couleur longue', { len: ln({ [dn(s)]: [3, 13] }), text: 'Enchère obligée : on nomme sa couleur la plus longue.' }), h => bestOf(h, cands) === s)); }
  }
  // R9 : le sens général (explication), puis un texte vrai pour les mains qui ont 25 H avec le minimum du partenaire
  const gen = 'Mes points + le minimum du partenaire n\'atteignent pas la manche, et pas de proposition à faire : on s\'arrête au palier le plus bas (fiche 05).';
  o.push(opt('P', MC('Passe', { text: gen }), () => false));
  o.push(opt('P', MC('Passe', { text: 'Le camp a 25 H, mais aucune manche ne convient : 3SA demande un arrêt dans leur couleur (et de la place), la manche à la couleur demande un fit et assez de points. Pas de proposition à faire : on s\'arrête au palier le plus bas.' }),
    h => hcp(h) + pmin >= 25));
  o.push(PASSE(gen));
  return o;
}

/* ====================================================================
   AIGUILLAGE
   ==================================================================== */
B.COMPL.C2 = function (c) {
  if (c.openIdx < 0) return null;
  const o = c.seq[0];
  const mine = c.mine.filter(x => x.i >= c.openIdx).length;
  const weak = /^2[HS]$/.test(o) || /^[34][CDHS]$/.test(o);
  if (/^(2C|2D|2N)$/.test(o)) return null;
  if (c.role === 'responder' && mine === 0) {
    if (/^1[CDHS]$/.test(o)) return r1Suit(c);
    if (o === '1N') return r1NT(c);
    if (/^2[HS]$/.test(o)) return r1Weak(c);
    return r1Barrage(c);
  }
  // le partenaire de l'ouvreur répond au contre de réveil de l'ouvreur : 1x (y) P P X P, 1x (y) P (z) X P, 1x P P (y) X P
  if (c.role === 'responder' && /^1[CDHS]$/.test(o) && c.seq.length === 6 && c.seq[2] === 'P' && c.seq[4] === 'X' && c.seq[5] === 'P') {
    const mx = explainAt(c.auction, c.dealer, c.openIdx + 4);
    const T = theirSuits(c);
    if (mx && mx.name === REOPEN && T.length === 1) return r2AfterReopen(c, o[1], DEN_SUIT[o[1]], T[0]);
  }
  if (c.role === 'opener' && weak) {
    const pm = summarize(c, c.partner);
    const pLast = pm.lastIdx >= 0 ? explainAt(c.auction, c.dealer, pm.lastIdx) : null;
    if (pLast && pLast.forcing >= 1 && pm.lastIdx === c.n - 2) return null;
    return [PASSE('Le barrage (ou le 2 faible) a tout dit : l\'ouvreur laisse décider le partenaire.')];
  }
  if (c.role === 'opener' && mine === 1) {
    const r = o === '1N' ? o2NT(c) : o2Suit(c);
    if (r) return r;
  }
  return later(c);
};
})();

/* ===================== Fiche complémentaire C3 ===================== */
/* Fiche complémentaire C3 — La 2ème enchère de l'intervenant.
   L'adversaire a ouvert ; dans notre camp, c'est moi qui ai parlé le premier (contre d'appel ou intervention), et je reparle.
   Les règles sont exactement celles de la fiche (source/lot2-generateur/dC3_intervenant.py) :
   (1) pour toutes les situations : le partenaire a conclu → Passe (D9) ; proposition → j'accepte avec le haut
       de ma fourchette (D8) ; enchère forcing ou cue-bid (jamais une conclusion) → je reparle ; ensuite Passe,
       sauf loi de Vernes (fiche 12) : palier = atouts du camp − 6, jusqu'au palier 4 en majeure (la manche), jusqu'au palier 5 en mineure ;
   (2) après mon contre d'appel, le partenaire a répondu (fiche 13) ;
   (3) après mon contre d'appel, l'adversaire a enchéri et le partenaire a passé (le cas de la capture) ;
   (4) après mon intervention à la couleur ;
   (5) après 1SA (D3), un bicolore ou le Landy (D6), un barrage. */
(function () {
'use strict';
const B = globalThis.B;
const { M, opt, ln, L, nm, dn, cheapest, natSuitsOf, summarize, gameLevelOf, explainAt } = B.BH;
const { HL, HLD, stopper, isRegular, isBid, levelOf, denOf, isLegal, sideOf, DEN, DEN_SUIT, callTxt } = B;
const F = 'C3';
// loi de Vernes : même texte dans les fiches et le Conseil de C2, C3 et C4 (R12)
const VERNES = 'loi de Vernes (fiche 12) : palier = atouts du camp − 6, jusqu\'au palier 4 en majeure (la manche), jusqu\'au palier 5 en mineure';
const VERNES_CAP = VERNES[0].toUpperCase() + VERNES.slice(1);
const bid = (lvl, s) => '' + lvl + (s === 4 ? 'N' : dn(s));
const suitOf = call => (isBid(call) && denOf(call) !== 'N') ? DEN_SUIT[denOf(call)] : -1;
const lastBidBefore = (c, i) => B.auctionState(c.auction.slice(0, i), c.dealer).lastBid;
// enchère à saut : au-dessus du palier le plus bas possible dans cette dénomination
function isJump(c, i) {
  const call = c.auction[i], prev = lastBidBefore(c, i);
  if (!isBid(call) || !prev) return false;
  return levelOf(call) > levelOf(prev) + (DEN.indexOf(denOf(call)) <= DEN.indexOf(denOf(prev)) ? 1 : 0);
}
// Nature de ma première enchère (celle qui fait de moi l'intervenant)
function kindOf(c, f) {
  const m0 = explainAt(c.auction, c.dealer, f.i);
  const call = f.call;
  if (call === 'X') {
    const before = lastBidBefore(c, f.i);
    if (!before || denOf(before) === 'N' || /punitif/i.test(m0.name)) return null;   // contre punitif sur 1SA : hors fiche
    return { k: 'X' };
  }
  if (!isBid(call)) return null;
  if (m0.alert) {                                           // bicolores (2SA, cue-bid, 3♣) et Landy
    const pair = [0, 1, 2, 3].filter(s => m0.len[s][0] >= 4);
    return pair.length === 2 ? { k: 'B', pair } : null;
  }
  if (call === '1N') return { k: 'N' };
  if (denOf(call) === 'N') return { k: 'G' };               // 3SA sur un barrage : conclusion
  const s = DEN_SUIT[denOf(call)];
  if (m0.pts && m0.pts[1] <= 10) return { k: 'J', s };      // intervention à saut, barrage
  if (levelOf(call) >= gameLevelOf(denOf(call))) return { k: 'G' };
  return { k: 'S', s };
}
const PASSE_CONCL = M('Passe', { fiche: F, text: 'Le partenaire a conclu : je passe (sauf chelem, avec 33 points dans le camp).' });
const blackwood = t => M('Blackwood (5 clés)', { forcing: 1, alert: true, fiche: '08',
  text: `Le camp a 33 points ou plus avec un fit à ${nm(t)} : je demande les clés (les 4 As et le Roi d'atout).` });
// Points montrés par une enchère du partenaire, en mots (« 8 à 10 points », « 11 points », « 11 ou 12 points »)
function rng(m, dflt) {
  if (!m || !m.pts) return dflt;
  const [a, b] = m.pts;
  return a === b ? `${a} points` : b === a + 1 ? `${a} ou ${b} points` : b >= 37 ? `${a} points ou plus` : `${a} à ${b} points`;
}
// Ce qu'il me faut pour la manche en face de cette fourchette (25 points dans le camp, fiche 16) :
// 16 en face de 8 à 10 (saut, 1SA), 14 en face de 11 (2SA) ou de 11-12 (saut après un réveil, D7)
function needFor(m, dflt) {
  if (!m || !m.pts) return dflt;
  const [a, b] = m.pts;
  return Math.ceil(25 - (a + Math.min(b, a + 4)) / 2);
}

B.COMPL.C3 = function (c) {
  if (c.role !== 'defender') return null;
  const side = sideOf(c.seat);
  const f = c.calls.find(x => sideOf(x.seat) === side && x.call !== 'P');
  if (!f || f.seat !== c.seat) return null;
  const K = kindOf(c, f);
  if (!K) return null;
  // couleurs adverses : celles que l'adversaire a nommées le premier (son cue-bid dans notre couleur n'en fait pas une couleur adverse)
  const firstSide = s => { const x = c.calls.find(y => suitOf(y.call) === s); return x ? sideOf(x.seat) : -1; };
  const opp = natSuitsOf(c, 1 - side).filter(s => firstSide(s) !== side);
  const unbid = [0, 1, 2, 3].filter(s => !opp.includes(s));
  const lb = c.st.lastBid;
  const lastOurs = !!lb && sideOf(c.st.lastBidSeat) === side;
  const rho = c.auction[c.n - 1];
  const rhoQuiet = rho === 'P' || rho === 'X';                 // un contre de l'adversaire de droite ne change rien à mes règles
  const pActs = c.part.filter(x => x.i > f.i && x.call !== 'P');
  const pLast = pActs.length ? pActs[pActs.length - 1] : null;
  const pLastM = pLast ? explainAt(c.auction, c.dealer, pLast.i) : null;
  // cue-bid du partenaire : une enchère dans une couleur de l'adversaire (forcing, jamais une conclusion)
  const pCue = !!pLast && isBid(pLast.call) && opp.includes(suitOf(pLast.call));
  const myBids = c.mine.filter(x => x.i >= f.i && x.call !== 'P');
  const second = myBids.length === 1;                        // c'est ma 2e enchère
  const pm = summarize(c, c.partner);
  // le partenaire vient de parler et l'enchère en cours est la sienne
  const pJust = !!pLast && lastOurs && c.st.lastBidSeat === c.partner && pLast.i === c.n - 2;
  const legal = call => !!call && isLegal(call, c.auction, c.dealer);
  const stops = h => opp.every(s => stopper(h, s));
  const shown = t => pm.len[t][0];
  const o = [];
  // une seule signification par enchère dans la liste : une enchère déjà présente avec un autre sens n'est pas ajoutée
  const add = (call, m, ok) => {
    if (!call || !legal(call)) return;
    const prev = o.find(x => x.call === call);
    if (prev && prev.m !== m) return;
    o.push(opt(call, m, ok));
  };
  const pass = text => add('P', M('Passe', { fiche: F, text }), () => true);
  // plusieurs Passes de suite (main faible, main forte sans enchère prévue) : même nom, textes différents, chacun vrai pour sa main
  const passIf = (text, ok) => o.push(opt('P', M('Passe', { fiche: F, text }), ok));

  /* ===== (1) Le partenaire a conclu : Passe (D9), sauf chelem ===== */
  // une enchère forcing ou un cue-bid du partenaire n'est jamais une conclusion : je lui réponds (plus bas)
  const texasFirst = K.k === 'N' && pActs.length >= 2 && /Texas/i.test(explainAt(c.auction, c.dealer, pActs[0].i).name || '');
  if (pJust && rhoQuiet && isBid(pLast.call) && !(texasFirst && pLast.call === '3N') && !pLastM.forcing && !pCue &&
      (pLastM.conclusion || pLast.call === '3N' || levelOf(pLast.call) >= gameLevelOf(denOf(pLast.call)))) {
    const t = suitOf(pLast.call);
    if (t >= 0 && levelOf(pLast.call) <= 4) add('4N', blackwood(t), h => L(h, t) >= 3 && HL(h) + pm.min >= 33);
    if (pLast.call === '3N') add('6N', M('Petit chelem à Sans-Atout', { fiche: F, conclusion: true,
      text: 'Le camp a 33 points ou plus : petit chelem.' }), h => HL(h) + pm.min >= 33);
    add('P', PASSE_CONCL, () => true);
    return o;
  }
  if (K.k === 'G') { pass('J\'ai déjà dit la manche : je passe.'); return o; }
  // Notre contrat est contré alors que nous avons déjà parlé tous les deux (ou c'est mon enchère, et le partenaire a passé) : je passe
  const lastBidIdx = (() => { for (let i = c.n - 1; i >= 0; i--) if (isBid(c.auction[i])) return i; return -1; })();
  const myLastIdx = c.mine.length ? c.mine[c.mine.length - 1].i : -1;
  if (lastOurs && c.st.dbl === 1 && rhoQuiet && lastBidIdx <= myLastIdx &&
      !(K.k === 'B' && c.st.lastBidSeat === c.seat && !K.pair.includes(suitOf(lb)))) {
    pass('Notre contrat est contré et nous avons déjà décrit nos mains : je passe.');
    return o;
  }
  // Le partenaire a contré : je laisse un contre punitif ; les autres contres du partenaire ne sont pas dans la fiche
  if (pLast && !isBid(pLast.call)) {
    if (pLast.call === 'X' && /punitif/i.test(pLastM.name) && c.st.dbl === 1 && rho === 'P') {
      pass('Le partenaire a contré pour faire chuter les adversaires : je laisse le contre.');
      return o;
    }
    return null;
  }
  // (1) enchère forcing ou cue-bid du partenaire : je dois reparler (même si l'adversaire de droite a contré)
  const forced = pJust && rhoQuiet && (pLastM.forcing >= 1 || pCue);

  if (K.k === 'X') return second ? contreOpts() : suiteOpts(-1);
  if (K.k === 'S') return second ? couleurOpts(K.s) : suiteOpts(K.s);
  if (K.k === 'N') return sansAtoutOpts();
  if (K.k === 'B') return bicoloreOpts(K.pair);
  if (K.k === 'J') {
    if (forced) return forcedOpts(K.s);
    pass('Mon barrage a tout dit (jeu faible, couleur longue) : je passe.');
    return o;
  }
  return null;

  /* ---------- outils ---------- */
  function bestSuit(h, cand) { return cand.slice().sort((a, b) => L(h, b) - L(h, a) || a - b)[0]; }
  // nouvelle couleur après un contre = main forte (18 HL et plus) : 5 cartes au palier de 1 ou 2, 6 cartes au palier de 3,
  // jamais au-dessus (fiche : « palier 3 au plus »). Parmi les couleurs possibles, la plus longue (la plus chère à égalité).
  // fit(h) : la main a un fit de 8 cartes dans la couleur du partenaire (elle le soutient au lieu de nommer sa couleur).
  // Renvoie la liste des couleurs proposées (pour le texte de la Passe) ; .all : toutes les couleurs libres sont nommables.
  function newSuitStrong(t, fit) {
    const cand = unbid.filter(u => u !== t), ok = [];
    const needOf = s => { const b = cheapest(c, dn(s)); if (!b || !legal(b)) return 0; const l = levelOf(b); return l <= 2 ? 5 : l === 3 ? 6 : 0; };
    const elig = (h, s) => { const n = needOf(s); return n > 0 && L(h, s) >= n; };
    for (const s of cand) {
      const n = needOf(s);
      if (!n) continue;
      const b = cheapest(c, dn(s));
      ok.push(s);
      add(b, M('Nouvelle couleur : main forte', { pts: [18, 37], unit: 'HL', len: ln({ [dn(s)]: [n, 13] }), fiche: F,
        text: `Après mon contre, une couleur que je nomme montre une main forte : 18 HL et plus, au moins ${n} cartes à ${nm(s)}.` }),
        h => HL(h) >= 18 && elig(h, s) && !fit(h) && bestSuit(h, cand.filter(u => elig(h, u))) === s);
    }
    ok.all = ok.length === cand.length; ok.cand = cand.length;
    return ok;
  }
  // SA après un contre : main régulière (comme le 1SA de la fiche 10), 1SA avec 18 à 20 HL, 3SA avec 21 HL et plus,
  // arrêt dans la couleur adverse. On l'essaie après ma couleur de 5 cartes (newSuitStrong).
  // Renvoie le morceau de texte de la Passe « main forte » (ce qu'il faudrait pour le SA), ou null
  function sansAtoutFort(fit, with3N) {
    const has3 = with3N !== false && legal('3N'), has1 = legal('1N');
    if (has3) add('3N', M('3SA', { pts: [21, 37], unit: 'HL', fiche: F, conclusion: true,
      text: 'Main régulière, pas de fit, 21 HL et plus avec un arrêt dans la couleur adverse : 3SA.' }),
      h => !fit(h) && isRegular(h) && HL(h) >= 21 && stops(h));
    if (has1) add('1N', M('1SA', { pts: [18, 20], unit: 'HL', fiche: F,
      text: 'Main régulière, pas de fit, 18 à 20 HL avec un arrêt dans la couleur adverse : 1SA.' }),
      h => !fit(h) && isRegular(h) && HL(h) >= 18 && HL(h) <= 20 && stops(h));
    return has1 && has3 ? 'une main régulière et un arrêt dans leur couleur pour le Sans-Atout'
      : has3 ? 'une main régulière de 21 HL et un arrêt dans leur couleur pour 3SA'
      : has1 ? 'une main régulière de 18 à 20 HL et un arrêt dans leur couleur pour 1SA' : null;
  }
  // nouveau contre = encore d'appel (renvoie vrai s'il est proposé)
  function contreEncore(fit) {
    const ls = suitOf(lb);
    if (ls < 0 || levelOf(lb) > 2 || !legal('X')) return false;
    add('X', M('Nouveau contre (encore d\'appel)', { pts: [16, 37], unit: 'HL', len: ln({ [dn(ls)]: [0, 2] }), forcing: 1, fiche: F,
      text: `Encore un contre d'appel : 16 HL et plus, au plus 2 cartes à ${nm(ls)}. Le partenaire choisit une couleur.` }),
      h => HL(h) >= 16 && L(h, ls) <= 2 && !fit(h));
    return true;
  }
  // Passe d'une main forte qui n'a pas d'enchère prévue : le texte dit ce qui manque (seulement les enchères possibles ici)
  function strongPassText(ctx, label, parts) {
    return parts.length ? `${ctx} : ${label}, mais il me faudrait ${parts.join(', ou ')}. Je passe.`
      : `${ctx} : ${label}, mais c'est trop haut : la fiche ne prévoit pas d'enchère à ce palier. Je passe.`;
  }
  function suitPart(list) {
    if (!list.length) return list.cand ? 'une couleur à nommer au palier de 3 au plus' : null;
    const max = Math.max(...list.map(s => levelOf(cheapest(c, dn(s)))));
    return max <= 2 && list.all ? 'une couleur de 5 cartes à nommer' : `une couleur à nommer au palier de ${max} au plus (5 cartes${max === 3 ? ', 6 au palier de 3' : ''})`;
  }
  // enchère forcing du partenaire : soutien avec 3 cartes, sinon je répète ma couleur
  function forcedOpts(s) {
    const t = suitOf(pLast.call);
    if (t >= 0 && !opp.includes(t) && t !== s) add(cheapest(c, dn(t)), M('Soutien (enchère forcing du partenaire)', { len: ln({ [dn(t)]: [3, 13] }), fiche: F,
      text: `Le partenaire a fait une enchère forcing : avec 3 cartes à ${nm(t)}, je le soutiens au palier le plus bas.` }), h => L(h, t) >= 3);
    if (s >= 0) add(cheapest(c, dn(s)), M('Répétition (enchère forcing du partenaire)', { len: ln({ [dn(s)]: [5, 13] }), fiche: F,
      text: `Le partenaire a fait une enchère forcing : je répète ma couleur (${nm(s)}) au palier le plus bas.` }), () => true);
    return o.length ? o : null;
  }
  // L'adversaire a reparlé : ma couleur très longue (7 cartes et plus, plus que ce que j'ai montré) avec une main forte
  // (18 HL) : je la répète, au palier de 4 au plus (fiche : « Si l'adversaire reparle, avec 18 HL et 7 cartes… »).
  // ms : ma couleur (celle de mon intervention, ou celle que j'ai nommée après mon contre).
  // Renvoie le morceau de texte de la Passe forte (ce qui manque pour répéter), ou null.
  function repeatLong(ms) {
    if (ms === undefined || ms < 0 || opp.includes(ms)) return null;
    const sh = summarize(c, c.seat).len[ms][0], need7 = Math.max(7, sh + 1), r = cheapest(c, dn(ms));
    if (!(r && legal(r) && levelOf(r) <= 4)) return `et répéter ma couleur (${nm(ms)}) serait trop haut`;
    if (o.some(x => x.call === r)) return null;                       // la loi de Vernes a déjà pris cette enchère
    add(r, M('Répétition de ma couleur très longue', { pts: [18, 37], unit: 'HL', len: ln({ [dn(ms)]: [need7, 13] }), fiche: F,
      conclusion: levelOf(r) >= gameLevelOf(dn(ms)),
      text: `Au moins ${need7} cartes à ${nm(ms)} (plus que je n'en ai montré) et 18 HL ou plus : je répète ma couleur.` }),
      h => L(h, ms) >= need7 && HL(h) >= 18);
    return `ni ${need7} cartes à ${nm(ms)} pour répéter ma couleur`;
  }
  // loi de Vernes (fiches 06 et 12) : avec un fit, palier = atouts du camp − 6.
  // Le Conseil donne le vrai nombre d'atouts du camp : une variante par longueur de ma couleur (même nom, même sens) ;
  // la 1re option, jamais choisie, donne l'explication générale de l'enchère.
  // Fiche 12 : jusqu'au palier 4 en majeure (la manche), jusqu'au palier 5 en mineure (« niveau 5 si 11 cartes »).
  function vernes(u, extra) {
    const r = cheapest(c, dn(u)), sh = shown(u), top = u >= 2 ? 5 : 4;
    if (!legal(r) || levelOf(r) > top || o.some(x => x.call === r)) return;   // l'enchère a déjà un autre sens
    const lo = Math.max(1, levelOf(r) + 6 - sh, 8 - sh);                     // au moins 8 atouts : un fit
    const name = 'Compétition : loi de Vernes', len = ln({ [dn(u)]: [lo, 13] });
    const concl = levelOf(r) >= gameLevelOf(dn(u));
    o.push(opt(r, M(name, { len, fiche: F, conclusion: concl,
      text: `Fit à ${nm(u)} : au moins ${levelOf(r) + 6} atouts dans le camp, on peut jouer au palier de ${levelOf(r)}. ${VERNES_CAP}.` }), () => false));
    for (let l = lo; l + sh <= 13; l++) {
      const n = l + sh;
      o.push(opt(r, M(name, { len, fiche: F, conclusion: concl,
        text: `Fit à ${nm(u)} : j'ai ${l} atouts, le partenaire en a montré ${sh}, cela fait ${n} dans le camp : on peut jouer jusqu'au palier de ${Math.min(top, n - 6)}. ${VERNES_CAP}.` }),
        h => L(h, u) === l && (!extra || extra(h))));
    }
  }

  /* ===== (2) et (3) : 2e enchère après mon contre d'appel ===== */
  function contreOpts() {
    // (3) le partenaire n'a rien dit, l'adversaire a enchéri
    if (!pLast) {
      if (lastOurs) return null;
      if (c.st.dbl === 2 && rho === 'P') {      // surcontre adverse, Passe du partenaire : je nomme ma meilleure couleur
        for (const s of unbid) add(cheapest(c, dn(s)), M('Sauvetage : ma meilleure couleur', { len: ln({ [dn(s)]: [3, 13] }), fiche: F,
          text: `L'adversaire a surcontré et le partenaire a passé : je nomme ma meilleure couleur (${nm(s)}) au palier le plus bas.` }),
          h => bestSuit(h, unbid) === s);
        return o.length ? o : null;
      }
      const none = () => false;
      const sl = newSuitStrong(-1, none);
      const nt = sansAtoutFort(none, false);
      const xx = contreEncore(none);
      const ctx = 'Le partenaire a passé et mon contre a déjà montré ma main';
      // main faible (moins de 16 HL, ou de 18 HL sans nouveau contre possible), puis 16-17 HL trop longue dans leur couleur, puis main forte
      passIf(`${ctx} : sans main forte (18 HL et plus)${xx ? ' ni 16 HL pour un nouveau contre' : ''}, je passe.`,
        h => HL(h) < (xx ? 16 : 18));
      if (xx) passIf(`${ctx} : avec 16 ou 17 HL et plus de 2 cartes dans leur couleur, pas de nouveau contre. Je passe.`,
        h => HL(h) < 18);
      passIf(strongPassText('Le partenaire a passé', 'ma main est forte (18 HL et plus)', [suitPart(sl), nt,
        xx ? '2 cartes au plus dans leur couleur pour un nouveau contre' : null].filter(Boolean)), () => true);
      return o;
    }
    const pc = pLast.call, t = suitOf(pc);
    // fit = 8 cartes connues : sa réponse au palier le plus bas ne promet que 3 cartes (fiche 13), parfois aucune
    const need = t >= 0 ? Math.max(3, 8 - shown(t)) : 13;
    const fit = h => t >= 0 && need <= 5 && L(h, t) >= need;
    const fitLen = t >= 0 ? ln({ [dn(t)]: [need, 13] }) : null;
    const fitTxt = t >= 0 ? `Fit à ${nm(t)} : le partenaire en a promis ${shown(t)}, j'en ai ${need} ou plus, le camp en a 8` : '';
    // cue-bid du partenaire (forcing, fiche 13) : je nomme ma majeure 4e, sinon ma couleur longue, sinon SA.
    // Un cue-bid n'est jamais une conclusion, même au palier de 4 ou plus.
    if (forced && pCue) {
      const majors = unbid.filter(s => s <= 1).sort((a, b) => b - a);           // Cœur d'abord
      const maj = h => { const m4 = majors.filter(s => L(h, s) >= 4); if (!m4.length) return -1; return m4.length === 2 && L(h, 0) > L(h, 1) ? 0 : m4[0]; };
      // le bas de ma fourchette est celui de mon contre (un contre de réveil peut être plus faible, D7)
      const lo = Math.min(12, summarize(c, c.seat).min);
      for (const s of majors) {
        const b = cheapest(c, dn(s)), j = b ? bid(levelOf(b) + 1, s) : null;
        if (!b || levelOf(b) > 6) continue;                                     // jamais un grand chelem en réponse
        const withJump = !!j && levelOf(j) <= 3 && legal(j);
        if (withJump) add(j, M('Réponse au cue-bid : ma majeure, main maximum', { pts: [15, 37], unit: 'HL', len: ln({ [dn(s)]: [4, 13] }), fiche: F,
          text: `Le cue-bid du partenaire est forcing : avec 15 HL et plus, je nomme ma majeure de 4 cartes (${nm(s)}) avec un saut.` }), h => maj(h) === s && HL(h) >= 15);
        add(b, M('Réponse au cue-bid : ma majeure', { pts: [lo, withJump ? 14 : 37], unit: 'HL', len: ln({ [dn(s)]: [4, 13] }), fiche: F,
          text: withJump ? `Le cue-bid du partenaire est forcing : jusqu'à 14 HL, je nomme ma majeure de 4 cartes (${nm(s)}) au palier le plus bas.`
            : `Le cue-bid du partenaire est forcing : je nomme ma majeure de 4 cartes (${nm(s)}) au palier le plus bas.` }), h => maj(h) === s);
      }
      const minors = unbid.filter(s => s >= 2);
      const sa = cheapest(c, 'N');                                              // jamais 4SA (ce serait le Blackwood)
      if (sa && levelOf(sa) <= 3) add(sa, M('Réponse au cue-bid : SA', { fiche: F,
        text: 'Pas de majeure 4e : SA au palier le plus bas, avec un arrêt dans la couleur adverse.' }), h => maj(h) < 0 && stops(h));
      for (const s of minors) {
        const b = cheapest(c, dn(s));
        if (b && levelOf(b) <= 6) add(b, M('Réponse au cue-bid : ma couleur longue', { len: ln({ [dn(s)]: [4, 13] }), fiche: F,
          text: `Pas de majeure 4e : je nomme ma couleur la plus longue (${nm(s)}).` }), h => maj(h) < 0 && L(h, s) >= 4 && bestSuit(h, minors) === s);
      }
      return o.length ? o : null;
    }
    if (forced) return forcedOpts(-1);
    // le partenaire a répondu, puis l'adversaire a reparlé : compétition
    if (!lastOurs) {
      let sup4 = false, supR = false;
      if (t >= 0 && !opp.includes(t) && need <= 5) {
        if (t <= 1 && legal('4' + dn(t))) { sup4 = true; add('4' + dn(t), M('Manche', { pts: [21, 37], unit: 'HLD', len: fitLen, fiche: F, conclusion: true,
          text: `${fitTxt}. Avec 21 points HLD ou plus : la manche.` }), h => fit(h) && HLD(h, t) >= 21); }
        const r = cheapest(c, dn(t));
        if (r && levelOf(r) <= 3) { supR = true; add(r, M('Soutien dans la compétition', { pts: [15, t <= 1 ? 20 : 37], unit: 'HLD', len: fitLen, fiche: F,
          text: `${fitTxt}. Avec 15 points HLD ou plus, je le soutiens au palier le plus bas.` }), h => fit(h) && HLD(h, t) >= 15); }
      }
      const sl = newSuitStrong(t, fit);
      const nt = sansAtoutFort(fit, false);
      // pas de nouveau contre avec 4 cartes dans sa couleur (mesuré : le partenaire passe souvent le contre, et ce n'est pas le sens annoncé)
      const four = h => t >= 0 && !opp.includes(t) && L(h, t) >= 4;
      const xx = contreEncore(h => fit(h) || four(h));
      const ctx = 'L\'adversaire a reparlé';
      const minPts = xx ? 16 : 18;
      const supTxt = supR ? 'un fit de 8 cartes et 15 points HLD pour le soutenir' : sup4 ? 'un fit de 8 cartes et 21 points HLD pour la manche' : null;
      const why = [supTxt, xx ? '16 HL pour un nouveau contre' : null, '18 HL pour une main forte'].filter(Boolean).join(', ou ');
      passIf(`${ctx} : il me faudrait ${why}. Je passe.`,
        h => HL(h) < minPts && !(fit(h) && HLD(h, t) >= (supR ? 15 : 21)));
      if (t >= 0 && !opp.includes(t) && need > 4) passIf(`${ctx} : j'ai au moins 4 cartes à ${nm(t)}, mais ${shown(t) ? `le partenaire peut n'en avoir que ${shown(t)}` : 'le partenaire n\'en a promis aucune'} : pas de fit sûr pour le soutenir, et pas de nouveau contre avec 4 cartes dans sa couleur. Je passe.`,
        h => four(h) && !fit(h));
      passIf(strongPassText(ctx, 'j\'ai des points', [supR ? 'un fit de 8 cartes pour le soutenir' : sup4 ? 'un fit de 8 cartes et 21 points HLD pour la manche' : null,
        suitPart(sl), nt, xx ? '2 cartes au plus dans leur couleur pour un nouveau contre' : null].filter(Boolean)), () => true);
      return o;
    }
    if (!pJust || !rhoQuiet) return null;
    // (2) le partenaire a répondu, l'adversaire a passé (ou contré).
    // Ses points sont ceux de sa réponse : fiche 13 (saut 8 à 10, 1SA 8 à 10, 2SA 11), ou après mon réveil (D7) : saut 11-12.
    if (pc === '1N' || pc === '2N') {
      const pr = rng(pLastM, pc === '1N' ? '8 à 10 points' : '11 points'), nd = needFor(pLastM, pc === '1N' ? 16 : 14);
      // 2SA = proposition (11 points, fiche 13 ; 11-12 après un réveil) ; sur le contre d'un barrage, 2SA = 8 à 10 points
      const prop = pc === '2N' && (pLastM.invite || !pLastM.pts || pLastM.pts[0] >= 11);
      if (!prop) {
        add('3N', M('3SA', { pts: [nd, 37], unit: 'HL', fiche: F, conclusion: true, text: `${pc[0]}SA du partenaire = ${pr} avec un arrêt : avec ${nd} HL et plus, 3SA.` }), h => HL(h) >= nd);
        pass(`${pc[0]}SA du partenaire = ${pr} : avec moins de ${nd} HL, je passe.`);
      } else {
        add('3N', M('3SA : acceptation', { pts: [nd, 37], unit: 'HL', fiche: F, conclusion: true, text: `2SA du partenaire = ${pr}, proposition : avec ${nd} HL et plus, j'accepte.` }), h => HL(h) >= nd);
        add('P', M('Passe : refus', { fiche: F, text: `2SA du partenaire = proposition : avec moins de ${nd} HL, je refuse.` }), () => true);
      }
      return o;
    }
    if (t < 0 || opp.includes(t)) return null;
    if (isJump(c, pLast.i)) {
      // saut du partenaire : 8 à 10 H (fiche 13), 11-12 H après mon réveil (D7) : manche avec 16 (14 en face de 11-12)
      const fitJ = h => L(h, t) + shown(t) >= 8;
      const pr = rng(pLastM, '8 à 10 points'), nd = needFor(pLastM, 16);
      if (t <= 1) add('4' + dn(t), M('Manche', { pts: [nd, 37], unit: 'HLD', len: ln({ [dn(t)]: [Math.max(0, 8 - shown(t)), 13] }), fiche: F, conclusion: true,
        text: `Le partenaire a sauté (${pr}) : fit à ${nm(t)} et ${nd} points HLD ou plus, la manche.` }), h => fitJ(h) && HLD(h, t) >= nd);
      add('3N', M('3SA', { pts: [nd, 37], unit: 'HL', fiche: F, conclusion: true, text: `Le partenaire a sauté (${pr}) : sans fit en majeure, ${nd} HL et plus avec un arrêt, 3SA.` }),
        h => !(t <= 1 && fitJ(h)) && HL(h) >= nd && stops(h));
      passIf(`Le partenaire a sauté (${pr}) : avec moins de ${nd} points, pas assez pour la manche, je passe.`,
        h => (t <= 1 && fitJ(h) ? HLD(h, t) : HL(h)) < nd);
      passIf(`Le partenaire a sauté (${pr}) : j'ai les points de la manche, mais ${t <= 1 ? `ni fit à ${nm(t)} ni arrêt` : 'pas d\'arrêt'} dans leur couleur pour 3SA. Je passe.`, () => true);
      return o;
    }
    // réponse au palier le plus bas (0 à 10 H) : sa couleur peut n'avoir que 3 cartes (fiche 13), il faut 8 cartes connues
    const r1 = cheapest(c, dn(t)), r2 = r1 ? bid(levelOf(r1) + 1, t) : null;
    const jumpOk = !!r2 && levelOf(r2) <= 3 && need <= 5;
    let sup = 0;                                                     // plus petit nombre de points HLD d'un soutien proposé
    if (t <= 1 && need <= 5 && legal('4' + dn(t))) { sup = 21; add('4' + dn(t), M('Manche', { pts: [21, 37], unit: 'HLD', len: fitLen, fiche: F, conclusion: true,
      text: `${fitTxt}. Avec 21 points HLD ou plus : la manche.` }), h => fit(h) && HLD(h, t) >= 21); }
    // comme la fiche : avec 8 cartes à deux, le soutien ; sinon ma couleur de 5 cartes, puis le SA avec une main régulière
    const sl = newSuitStrong(t, fit);
    const nt = sansAtoutFort(fit);
    if (jumpOk) { sup = 18; add(r2, M('Soutien à saut', { pts: [18, t <= 1 ? 20 : 37], unit: 'HLD', len: fitLen, fiche: F, invite: true,
      text: `${fitTxt}. Avec 18 points HLD ou plus : soutien à saut, proposition de manche.` }), h => fit(h) && HLD(h, t) >= 18); }
    if (r1 && levelOf(r1) <= 3 && need <= 5) { sup = 15; add(r1, M('Soutien simple', { pts: [15, jumpOk ? 17 : 37], unit: 'HLD', len: fitLen, fiche: F,
      text: `${fitTxt}. Avec 15 points HLD ou plus, je le soutiens.` }), h => fit(h) && HLD(h, t) >= 15); }
    const ctx = `Le partenaire a répondu au palier le plus bas (${rng(pLastM, '0 à 10 points')})`;
    passIf(`${ctx} : ${sup ? `ni soutien (fit de 8 cartes et ${sup} points HLD), ni main forte (18 HL)` : 'sans main forte (18 HL)'}, je passe.`,
      h => HL(h) < 18 && !(sup && fit(h) && HLD(h, t) >= sup));
    passIf(strongPassText(ctx, 'ma main est forte (18 HL et plus)', [sup ? (sup === 21 ? 'un fit de 8 cartes et 21 points HLD pour la manche' : 'un fit de 8 cartes pour le soutenir') : null,
      suitPart(sl), nt].filter(Boolean)), () => true);
    return o;
  }

  /* ===== (4) 2e enchère après mon intervention à la couleur ===== */
  function couleurOpts(s) {
    if (!pLast) {
      if (lastOurs) { pass('Mon intervention est contrée et le partenaire n\'a rien dit : je ne bouge pas.'); return o; }
      // partenaire silencieux, l'adversaire reparle : répétition d'une 6e au palier de 2, d'une 7e au palier de 3
      const r = cheapest(c, dn(s));
      if (r && levelOf(r) <= 3) add(r, M('Répétition de ma couleur', { pts: [12, 37], unit: 'HL', len: ln({ [dn(s)]: [levelOf(r) + 4, 13] }), fiche: F,
        text: `Au moins ${levelOf(r) + 4} cartes à ${nm(s)} et 12 HL ou plus : je répète ma couleur (6 cartes au palier de 2, 7 au palier de 3).` }),
        h => HL(h) >= 12 && L(h, s) >= levelOf(r) + 4);
      pass(r && levelOf(r) <= 3 ? 'Le partenaire n\'a rien dit : sans 6 cartes (7 au palier de 3) et 12 HL, je passe.'
        : 'Le partenaire n\'a rien dit et ma couleur serait au palier de 4 ou plus : je passe.');
      return o;
    }
    const pc = pLast.call, t = suitOf(pc);
    if (forced) return forcedOpts(s);
    // le partenaire a parlé, puis l'adversaire : loi de Vernes dans la couleur du fit
    if (!lastOurs) {
      if (t >= 0 && !opp.includes(t)) {
        if (t === s && s <= 1) {
          const jump = isJump(c, pLast.i), sup = jump ? 15 : 19;          // comme la fiche 05 : 19 sur un soutien simple
          add('4' + dn(s), M('Manche', { pts: [sup, 37], unit: 'HLD', fiche: F, conclusion: true,
            text: `Le partenaire m'a soutenu${jump ? ' avec un saut' : ''} : avec ${sup} points HLD ou plus, je dis la manche.` }), h => HLD(h, s) >= sup);
        }
        vernes(t);
      }
      if (t !== s) repeatLong(s);
      pass('L\'adversaire a reparlé : la loi de Vernes ne permet pas d\'aller plus haut, je passe.');
      return o;
    }
    if (!pJust || !rhoQuiet) return null;
    if (t === s) {
      if (isJump(c, pLast.i) || pLastM.invite) {
        // soutien à saut (11-12) = proposition : j'accepte avec 15 points et plus
        const pr = rng(pLastM, '11 ou 12 points');
        if (s <= 1) add('4' + dn(s), M('Acceptation de la manche', { pts: [15, 37], unit: 'HLD', fiche: F, conclusion: true,
          text: `Le soutien à saut (${pr}) est une proposition : avec 15 points HLD ou plus, je dis la manche.` }), h => HLD(h, s) >= 15);
        else add('3N', M('Acceptation : 3SA', { pts: [15, 37], unit: 'HL', fiche: F, conclusion: true,
          text: `Le soutien à saut (${pr}) est une proposition : avec 15 HL ou plus et un arrêt dans la couleur adverse, 3SA.` }), h => HL(h) >= 15 && stops(h));
        add('P', M('Passe : refus', { fiche: F, text: s <= 1 ? 'Le soutien à saut est une proposition : avec moins de 15 points HLD, je refuse.'
          : 'Le soutien à saut est une proposition : sans 15 HL et un arrêt dans la couleur adverse, je refuse.' }), () => true);
        return o;
      }
      // soutien simple (6 à 10) : comme l'ouvreur (fiche 05, openerRebid1) :
      // majeure : proposition avec 16 à 18 HLD, manche avec 19 HLD et plus ;
      // mineure : 3SA avec 18 HL et plus et un arrêt (sans arrêt : 5 en mineure), 2SA avec 16-17 HL et un arrêt
      // (sans arrêt : répétition), 2SA et la répétition seulement si son soutien est au palier de 2.
      const pr = rng(pLastM, '6 à 10 points');
      const r = cheapest(c, dn(s));
      if (s <= 1) {
        const room = !!r && levelOf(r) <= 3;                       // la proposition au palier de 3 est possible
        add('4' + dn(s), M('Manche', { pts: [19, 37], unit: 'HLD', fiche: F, conclusion: true,
          text: `Le partenaire me soutient (${pr}) : avec 19 points HLD ou plus, la manche (comme la fiche 05).` }), h => HLD(h, s) >= 19);
        if (room) add(r, M('Proposition de manche', { pts: [16, 18], unit: 'HLD', fiche: F, invite: true,
          text: `Le partenaire me soutient (${pr}) : avec 16 à 18 points HLD, je propose la manche (comme la fiche 05).` }), h => HLD(h, s) >= 16);
        pass(room ? `Le partenaire me soutient (${pr}) : avec moins de 16 points HLD, je passe.`
          : `Le partenaire me soutient (${pr}) au palier de 3 : pas de place pour proposer la manche, avec moins de 19 points HLD je passe.`);
        return o;
      }
      const room = legal('2N');                                     // son soutien est au palier de 2
      add('3N', M('3SA', { pts: [18, 37], unit: 'HL', fiche: F, conclusion: true,
        text: `Le partenaire me soutient en mineure (${pr}) : avec 18 HL ou plus et un arrêt dans la couleur adverse, 3SA (comme la fiche 05).` }),
        h => HL(h) >= 18 && stops(h));
      add('5' + dn(s), M('Manche en mineure', { pts: [18, 37], unit: 'HL', fiche: F, conclusion: true,
        text: `Le partenaire me soutient en mineure (${pr}) : 18 HL ou plus, mais pas d'arrêt dans la couleur adverse pour 3SA, la manche à ${nm(s)} (comme la fiche 05).` }),
        h => HL(h) >= 18);
      if (room) {
        add('2N', M('2SA', { pts: [16, 17], unit: 'HL', fiche: F, invite: true,
          text: `Le partenaire me soutient en mineure (${pr}) : avec 16 ou 17 HL et un arrêt dans la couleur adverse, 2SA propose la manche (comme la fiche 05).` }),
          h => HL(h) >= 16 && stops(h));
        if (r && levelOf(r) === 3) add(r, M('Répétition de la mineure', { pts: [16, 17], unit: 'HL', fiche: F, invite: true,
          text: `Le partenaire me soutient en mineure (${pr}) : 16 ou 17 HL sans arrêt dans la couleur adverse, je répète ma couleur pour proposer la manche (comme la fiche 05).` }),
          h => HL(h) >= 16);
      }
      pass(room ? `Le partenaire me soutient en mineure (${pr}) : avec moins de 16 HL, je passe.`
        : `Le partenaire me soutient en mineure (${pr}) au palier de 3 : pas de place pour proposer la manche, avec moins de 18 HL je passe.`);
      return o;
    }
    if (pc === '1N' || pc === '2N') {
      // 1SA (8 à 10) : 3SA avec 16 HL ; 2SA (11-12, proposition) : 3SA avec 14 HL. Avec 6 cartes en majeure : la manche dans ma couleur.
      const pr = rng(pLastM, pc === '1N' ? '8 à 10 points' : '11 ou 12 points'), nd = pc === '1N' ? 16 : 14;
      if (s <= 1 && legal('4' + dn(s))) add('4' + dn(s), M(pc === '1N' ? 'Manche dans ma majeure' : 'Acceptation : manche dans ma majeure',
        { pts: [nd, 37], unit: 'HL', len: ln({ [dn(s)]: [6, 13] }), fiche: F, conclusion: true,
          text: `${pc === '1N' ? '1' : '2'}SA du partenaire = ${pr} : ${nd} HL et plus avec 6 cartes en majeure, la manche dans ma couleur.` }), h => HL(h) >= nd && L(h, s) >= 6);
      if (pc === '1N') {
        add('3N', M('3SA', { pts: [nd, 37], unit: 'HL', fiche: F, conclusion: true, text: `1SA du partenaire = ${pr} : avec ${nd} HL et plus, 3SA.` }), h => HL(h) >= nd);
        pass(`1SA du partenaire = ${pr} : avec moins de ${nd} HL, je passe.`);
      } else {
        add('3N', M('3SA : acceptation', { pts: [nd, 37], unit: 'HL', fiche: F, conclusion: true, text: `2SA du partenaire = ${pr}, proposition : avec ${nd} HL et plus, j'accepte.` }), h => HL(h) >= nd);
        add('P', M('Passe : refus', { fiche: F, text: `2SA du partenaire = proposition : avec moins de ${nd} HL, je refuse.` }), () => true);
      }
      return o;
    }
    if (t >= 0 && !opp.includes(t)) {
      // nouvelle couleur du partenaire (D4) : non forcing
      const r = cheapest(c, dn(t));
      if (r && levelOf(r) <= 3) add(r, M('Soutien de sa couleur', { pts: [14, 37], unit: 'HLD', len: ln({ [dn(t)]: [3, 13] }), fiche: F,
        text: `3 cartes à ${nm(t)} et 14 points HLD ou plus : je soutiens la couleur du partenaire.` }), h => L(h, t) >= 3 && HLD(h, t) >= 14);
      pass(r && levelOf(r) <= 3 ? 'La nouvelle couleur du partenaire n\'est pas forcing : pas de soutien (3 cartes et 14 points), je passe.'
        : 'La nouvelle couleur du partenaire n\'est pas forcing et la soutenir serait trop haut : je passe.');
      return o;
    }
    return null;
  }

  /* ===== (1) suites : 3e enchère et plus après un contre ou une intervention à la couleur ===== */
  function suiteOpts(s) {
    if (forced) return forcedOpts(s);
    const t = pLast ? suitOf(pLast.call) : -1;
    // proposition du partenaire (D8) : j'accepte avec le haut de ce que j'ai montré.
    // Une enchère faite juste après une enchère adverse est de la compétition, pas une proposition.
    const prevB = pLast ? lastBidBefore(c, pLast.i) : null;
    const quiet = !!prevB && B.auctionState(c.auction.slice(0, pLast.i), c.dealer).lastBidSeat === c.seat;
    if (pJust && rho === 'P' && quiet && t >= 0 && !opp.includes(t) && (pLastM.invite || isJump(c, pLast.i))) {
      const mm = summarize(c, c.seat);
      const top = mm.min + Math.ceil(2 * (Math.min(mm.max, mm.min + 6) - mm.min) / 3);
      const g = gameLevelOf(dn(t)) + dn(t);
      if (levelOf(pLast.call) < gameLevelOf(dn(t))) {
        const pts = h => L(h, t) + shown(t) >= 8 ? HLD(h, t) : HL(h);      // HLD avec un fit, HL sinon
        add(g, M('Acceptation de la proposition', { pts: [top, 37], unit: 'HLD', fiche: F, conclusion: true,
          text: 'Le partenaire propose la manche : je suis dans le haut de ce que j\'ai montré, j\'accepte.' }), h => pts(h) >= top);
        add('P', M('Passe : refus', { fiche: F, text: 'Le partenaire propose la manche : je suis dans le bas de ce que j\'ai montré, je refuse.' }), () => true);
        return o;
      }
    }
    // l'adversaire a reparlé : loi de Vernes dans la couleur du fit
    if (!lastOurs) {
      const cand = [0, 1, 2, 3].filter(u => !opp.includes(u) && shown(u) >= 3);
      for (const u of cand) vernes(u, h => bestSuit(h, cand.filter(v => L(h, v) + shown(v) >= 8)) === u);
      const me = summarize(c, c.seat);
      const ms = s >= 0 ? s : [0, 1, 2, 3].filter(u => !opp.includes(u) && shown(u) < 3 && me.len[u][0] >= 5)
        .sort((a, b) => me.len[b][0] - me.len[a][0])[0];
      const rep = repeatLong(ms);                                       // texte de la Passe forte sur ma couleur
      // deux Passes (R9) : main moyenne, puis main forte ; chacune a un texte vrai pour sa main
      passIf('J\'ai déjà décrit ma main : sans fit qui permette d\'enchérir (loi de Vernes), je passe.', h => HL(h) < 18);
      passIf(`Ma main est forte, mais je n'ai pas de fit qui permette d'aller plus haut (loi de Vernes)${rep ? (rep[0] === 'n' ? ', ' : ' ') + rep : ''} : je passe.`, () => true);
      return o;
    }
    if (pJust && rhoQuiet && pLastM.forcing === 0) {
      pass('Le partenaire a fait une enchère non forcing et j\'ai déjà décrit ma main : je passe.');
      return o;
    }
    return null;
  }

  /* ===== (5) après mon intervention à 1SA (D3) : comme l'ouvreur de 1SA (fiches 11 et 14), avec 16 à 18 HL ===== */
  function sansAtoutOpts() {
    if (!pLast) {
      pass('Mon 1SA a décrit ma main et le partenaire n\'a rien dit : je passe.');
      return o;
    }
    const pc = pLast.call, name = pLastM.name || '';
    // bas de mon 1SA : 16 HL (fiche 10), 14 HL au réveil (1x Passe Passe 1SA)
    const my1 = explainAt(c.auction, c.dealer, f.i).pts, lo1 = my1 ? Math.min(16, my1[0]) : 16;
    const low1 = lo1 === 16 ? '16 HL' : 'moins de 17 HL';
    if (second && pLast.i === c.n - 2 && (rho === 'P' || rho === 'X')) {
      if (pc === '2C' && /Stayman/i.test(name)) {
        add('2N', M('Réponse au Stayman : 4 cœurs et 4 piques', { len: ln({ H: [4, 4], S: [4, 4] }), alert: true, fiche: F, text: 'Comme l\'ouvreur de 1SA (fiche 11) : 4 cartes à Cœur et 4 cartes à Pique.' }), h => L(h, 0) === 4 && L(h, 1) === 4);
        add('2H', M('Réponse au Stayman : 4 cœurs', { len: ln({ H: [4, 5], S: [0, 3] }), alert: true, fiche: F, text: 'Comme l\'ouvreur de 1SA (fiche 11) : 4 cartes à Cœur.' }), h => L(h, 1) >= 4 && L(h, 0) < 4);
        add('2S', M('Réponse au Stayman : 4 piques', { len: ln({ S: [4, 5], H: [0, 3] }), alert: true, fiche: F, text: 'Comme l\'ouvreur de 1SA (fiche 11) : 4 cartes à Pique.' }), h => L(h, 0) >= 4 && L(h, 1) < 4);
        add('2D', M('Réponse au Stayman : pas de majeure 4e', { len: ln({ H: [0, 3], S: [0, 3] }), alert: true, fiche: F, text: 'Comme l\'ouvreur de 1SA (fiche 11) : pas 4 cartes en majeure.' }), h => L(h, 0) < 4 && L(h, 1) < 4);
        return o.length ? o : null;
      }
      const tex = { '2D': '2H', '2H': '2S', '2S': '3C', '3C': '3D' }[pc];
      if (tex && /Texas/i.test(name)) {
        add(tex, M('Texas complété', { fiche: F, text: 'Comme l\'ouvreur de 1SA (fiche 14) : je dis la couleur demandée par le Texas.' }), () => true);
        return o.length ? o : null;
      }
      if (rho !== 'P') return null;
      if (pc === '2N') {
        add('3N', M('3SA : acceptation', { pts: [17, 18], unit: 'HL', fiche: F, conclusion: true, text: '2SA du partenaire = proposition : avec 17 ou 18 HL (haut de mon 1SA), 3SA.' }), h => HL(h) >= 17);
        add('P', M('Passe : refus', { pts: [lo1, 16], unit: 'HL', fiche: F, text: `2SA du partenaire = proposition : avec ${low1}, je refuse.` }), () => true);
        return o;
      }
      if (pLastM.forcing === 0) { pass('Le partenaire a choisi le contrat : je passe.'); return o; }
      return null;
    }
    if (!lastOurs) { pass('L\'adversaire a reparlé : mon 1SA a décrit ma main, je passe.'); return o; }
    // suites (fiches 11 et 14) : proposition du partenaire acceptée avec 17 ou 18 HL
    if (pJust && rho === 'P' && myBids.length === 2) {
      const myPrev = myBids[1], pFirst = pActs[0];
      const firstName = explainAt(c.auction, c.dealer, pFirst.i).name || '';
      const texas = /Texas/i.test(firstName), stay = /Stayman/i.test(firstName);
      const tf = suitOf(myPrev.call), t = suitOf(pc);
      // proposition : 2SA, ou 3 dans la majeure du fit (après mon Texas complété, ma réponse au Stayman, ou ma réponse 2SA avec les deux majeures)
      const fit3 = t >= 0 && levelOf(pc) === 3 && ((t === tf && (stay || texas)) || (stay && myPrev.call === '2N' && t <= 1));
      if (pc === '2N' || fit3) {
        if (pc === '2N' && texas && tf >= 0) add('4' + dn(tf), M('Acceptation : manche à la couleur', { pts: [17, 18], unit: 'HL', len: ln({ [dn(tf)]: [3, 5] }), fiche: F, conclusion: true,
          text: 'Proposition du partenaire : 17 ou 18 HL et 3 cartes dans sa majeure, la manche à la couleur.' }), h => HL(h) >= 17 && L(h, tf) >= 3);
        add(pc === '2N' ? '3N' : '4' + dn(t), M('Acceptation', { pts: [17, 18], unit: 'HL', fiche: F, conclusion: true,
          text: 'Proposition du partenaire : avec 17 ou 18 HL (haut de mon 1SA), j\'accepte la manche.' }), h => HL(h) >= 17);
        if (pc === '2N' && texas && tf >= 0) add('3' + dn(tf), M('Préférence pour l\'atout', { len: ln({ [dn(tf)]: [3, 5] }), fiche: F,
          text: 'Proposition du partenaire : sans 17 HL, avec 3 cartes dans sa majeure, je préfère jouer à la couleur.' }), h => L(h, tf) >= 3);
        add('P', M('Passe : refus', { pts: [lo1, 16], unit: 'HL', fiche: F, text: `Proposition du partenaire : avec ${low1}, je refuse.` }), () => true);
        return o;
      }
      // après ma réponse 2SA au Stayman (4 cœurs et 4 piques, fiche 11) : 3♣ vers 3♥, 3♦ vers 3♠, 4♣ vers 4♥, 4♦ vers 4♠
      const tr = { '3C': '3H', '3D': '3S', '4C': '4H', '4D': '4S' }[pc];
      if (stay && myPrev.call === '2N' && tr && /Texas|transfert/i.test(pLastM.name || '')) {
        add(tr, M('Transfert complété', { fiche: F, conclusion: tr[0] === '4',
          text: `Comme l'ouvreur de 1SA (fiche 11) : le partenaire a le fit, je dis la majeure demandée (${callTxt(tr)}).` }), () => true);
        return o;
      }
      if (pc === '3N' && texas && tf >= 0) {
        add('4' + dn(tf), M('Fit : manche à la couleur', { len: ln({ [dn(tf)]: [3, 5] }), fiche: F, conclusion: true,
          text: 'Comme l\'ouvreur de 1SA (fiche 14) : avec 3 cartes dans la majeure du partenaire, la manche à la couleur.' }), h => L(h, tf) >= 3);
        add('P', PASSE_CONCL, () => true);
        return o;
      }
      if (pLastM.forcing === 0) { pass('Le partenaire a choisi le contrat : je passe.'); return o; }
    }
    return null;
  }

  /* ===== (5) après un bicolore (2SA, cue-bid, 3♣) ou le Landy (D6) ===== */
  function bicoloreOpts(pair) {
    const better = h => (L(h, pair[0]) > L(h, pair[1]) || (L(h, pair[0]) === L(h, pair[1]) && pair[0] < pair[1])) ? pair[0] : pair[1];
    // mon enchère artificielle a été contrée et le partenaire a passé, ou relais 2♦ du Landy : je nomme ma meilleure couleur
    const mine = lastOurs && c.st.lastBidSeat === c.seat && c.st.dbl >= 1 && !pLast && rho === 'P' && !pair.includes(suitOf(lb));
    const relay = pJust && pLast.call === '2D' && /relais/i.test(pLastM.name || '');
    if (mine || relay || (forced && !pair.includes(suitOf(pLast.call)))) {
      for (const s of pair) add(cheapest(c, dn(s)), M('Ma meilleure couleur', { len: ln({ [dn(s)]: [4, 13] }), fiche: F,
        text: `Je nomme la meilleure de mes deux couleurs (${nm(s)}) au palier le plus bas.` }), h => better(h) === s);
      return o.length ? o : null;
    }
    if (forced) return null;
    pass('Mon bicolore a décrit ma main : le partenaire choisit, je passe ensuite.');
    return o;
  }
};
})();

/* ===================== Fiche complémentaire C4 ===================== */
/* Fiche complémentaire C4 — Répondre à l'intervention du partenaire.
   L'adversaire a ouvert ; dans notre camp, c'est le partenaire qui a parlé le premier (intervention à la couleur,
   bicolore, intervention faible ou barrage, 1SA, contre) : ma réponse, puis la suite.
   Écrite pour l'application (pas par Roger), selon le SEF et les décisions communes D1 à D9.
   Restent ailleurs : la réponse au contre quand l'adversaire de droite passe sur 1♣/1♦/1♥/1♠ (fiche 13),
   la réponse au Landy quand l'adversaire de droite passe (fiche 17). */
(function () {
'use strict';
const B = globalThis.B;
const { M, opt, ln, L, nm, dn, bidOf, cheapest, natSuitsOf, summarize, explainAt, gameLevelOf } = B.BH;
const { lens, hcp, HL, HLD, stopper, honors, bigHonors, isBid, levelOf, denOf, bidRank, isLegal, sideOf, DEN_SUIT, SUIT_SYM } = B;
const F = 'C4';
const mk = (name, o) => M(name, Object.assign({ fiche: F }, o || {}));
const sym = s => SUIT_SYM[s];

/* ---------- Outils ---------- */
// Couleurs de l'adversaire : celles qu'il a nommées le premier. Une enchère adverse dans une couleur que notre camp avait
// déjà nommée (au moins 4 cartes promises) est un cue-bid : ce n'est pas « leur » couleur (piège de natSuitsOf).
function theirSuits(c, side) {
  const ours = [], theirs = [];
  for (const x of c.calls) {
    if (!isBid(x.call) || denOf(x.call) === 'N') continue;
    const s = DEN_SUIT[denOf(x.call)];
    if (ours.includes(s) || theirs.includes(s)) continue;
    if (sideOf(x.seat) !== side) theirs.push(s);
    else { const m = explainAt(c.auction, c.dealer, x.i); if (m && m.len[s][0] >= 4) ours.push(s); }
  }
  return theirs;
}
function env(c) {
  const side = sideOf(c.seat);
  const opp = theirSuits(c, side);                         // couleurs nommées par l'adversaire (sans ses cue-bids)
  const legal = call => !!call && isLegal(call, c.auction, c.dealer);
  const stops = h => opp.every(s => stopper(h, s));        // un arrêt dans chaque couleur adverse
  const arret = opp.length === 0 ? '' : opp.length === 1 ? `un arrêt à ${nm(opp[0])}` : 'un arrêt dans chaque couleur adverse';
  return { side, opp, legal, stops, arret, rho: c.auction[c.n - 1] };
}
// liste d'options : une seule signification par enchère (la première gagne)
function list() {
  const o = [];
  o.add = (call, m, ok) => { if (call && !o.some(x => x.call === call)) o.push(opt(call, m, ok)); return o; };
  // même enchère, même nom, autre texte : le Conseil donne le texte vrai pour la main (R9) ou le vrai nombre d'atouts
  // (loi de Vernes). La 1re option d'une enchère reste son explication (on la met souvent « jamais choisie »).
  o.alt = (call, m, ok) => { if (call) o.push(opt(call, m, ok)); return o; };
  return o;
}
const passList = text => list().add('P', mk('Passe', { text }), () => true);
// meilleure couleur parmi `suits` : une majeure de 4 cartes d'abord, puis la plus longue, puis la plus belle
function bestSuit(h, suits) {
  const l = lens(h);
  return suits.slice().sort((a, b) => {
    const ma = a <= 1 && l[a] >= 4 ? 1 : 0, mb = b <= 1 && l[b] >= 4 ? 1 : 0;
    return (mb - ma) || (l[b] - l[a]) || (honors(h, b) - honors(h, a)) || (a - b);
  })[0];
}
const jumpOf = (c, s) => { const ch = cheapest(c, dn(s)); return ch ? bidOf(levelOf(ch) + 1, s) : null; };
// réveil de la fiche C5 (« Réveil à la couleur », « Contre de réveil ») : on a prêté un Roi au partenaire
const isReveil = m => !!m && m.fiche === 'C5' && /^(Contre de réveil|Réveil)/.test(m.name);

/* ---------- Loi de Vernes (fiche 12) : avec un fit, palier = atouts du camp − 6,
   jusqu'au palier 4 en majeure (la manche) et jusqu'au palier 5 en mineure (« niveau 5 si 11 cartes »),
   même si l'adversaire de droite passe ---------- */
const vCap = s => s <= 1 ? 4 : 5;
const vLevel = (s, n) => Math.min(vCap(s), n - 6);
// même règle et même texte que C2 et C3
const V_RULE = 'Loi de Vernes (fiche 12) : palier = atouts du camp − 6, jusqu\'au palier 4 en majeure (la manche), jusqu\'au palier 5 en mineure.';
const vExact = (s, mine, shown) => `Vous avez ${mine} atouts à ${nm(s)} et le partenaire en a montré ${shown} : le camp en a ${mine + shown}. ` +
  `Loi de Vernes (fiche 12) : on peut jouer jusqu'au palier de ${vLevel(s, mine + shown)}.`;
// Enchère « loi de Vernes » : une option générale, jamais choisie (c'est l'explication de l'enchère), puis une variante
// par longueur (même nom, même sens) : le Conseil donne le vrai nombre d'atouts du camp.
function addVernes(o, call, name, s, shown, lo, ok, w) {
  w = w || {};
  if (!call) return;
  if (w.general !== false) {
    if (o.some(x => x.call === call)) return;              // l'enchère a déjà un autre sens
    o.alt(call, mk(name, Object.assign({ len: ln({ [dn(s)]: [lo, 13] }), conclusion: levelOf(call) >= gameLevelOf(dn(s)),
      text: (w.pre || '') + `Fit à ${nm(s)} : au moins ${levelOf(call) + 6} atouts dans le camp, on peut jouer au palier de ${levelOf(call)}. ` + V_RULE }, w.extra || {})), () => false);
  }
  for (let l = Math.max(0, lo); l + shown <= 13; l++)
    o.alt(call, mk(name, Object.assign({ len: ln({ [dn(s)]: [lo, 13] }), conclusion: levelOf(call) >= gameLevelOf(dn(s)),
      text: (w.pre || '') + vExact(s, l, shown) }, w.extra || {})), h => L(h, s) === l && ok(h));
}

// Nature de la 1re enchère du partenaire
function kindOf(c, pFirst, m1) {
  const pc = pFirst.call;
  const before = c.auction.slice(0, pFirst.i).filter(isBid).pop();
  if (pc === 'X') return before === '1N' || /punitif/i.test(m1.name) ? 'XPUN' : 'X';
  if (!isBid(pc)) return null;
  if (/Landy/i.test(m1.name)) return 'LANDY';                                    // fiche 17
  if ([0, 1, 2, 3].filter(t => m1.len[t][0] >= 5).length === 2) return 'BIC';   // bicolore (fiche 10)
  if (pc === '1N' && m1.pts && m1.pts[0] >= 14 && m1.pts[1] <= 18) return 'NT';  // intervention 1SA (fiche 10)
  if (denOf(pc) === 'N') return levelOf(pc) >= 3 ? 'CONCL' : null;
  if (m1.conclusion && !m1.forcing) return 'CONCL';
  if (m1.pts && m1.pts[1] <= 10) return 'BARR';                                  // intervention à saut faible, barrage
  return 'OVC';                                                                  // intervention à la couleur
}

/* ====================================================================
   (1) Intervention à la couleur du partenaire (D1, D4, D5)
   ==================================================================== */
function overcallResp(c, E, ps, plen, rev) {
  const pd = dn(ps), maj = ps <= 1;
  const fitN = maj ? 3 : 5;                                   // comme la fiche 03 : 3 cartes en majeure, 5 en mineure
  const fit = h => L(h, ps) >= fitN, p = h => HLD(h, ps);
  const flen = ln({ [pd]: [fitN, 13] });
  const r1 = cheapest(c, pd);
  if (!r1) return null;
  const lv = levelOf(r1);
  const majFit = h => maj && fit(h);
  const o = list();
  // réveil du partenaire (fiche C5) : il a parlé en comptant sur un Roi chez nous, on compte 3 points de plus ; pas de saut sans 11 H
  const k = rev ? 3 : 0;
  const rv = rev ? ' Après un réveil, il faut 3 points de plus : le partenaire a déjà compté un Roi chez vous.' : '';
  const h11 = h => !rev || hcp(h) >= 11;
  const ftxt = `Fit à ${nm(ps)} (${fitN} cartes au moins)`;
  // soutien au palier de 3 (intervention au palier de 2, ou l'adversaire de droite a fait monter) : 11 HLD, ou 9 atouts (loi de Vernes)
  const raise3 = () => maj
    ? o.add(r1, mk('Soutien au palier de 3', { pts: [6 + k, rev ? 37 : 12 + k], unit: 'HLD', len: flen,
        text: `${ftxt} : ${11 + k} points HLD ou plus, ou ${6 + k} à ${10 + k} points HLD avec 9 atouts dans le camp (loi de Vernes : palier 3).` + rv }),
        h => fit(h) && (p(h) >= 11 + k || (p(h) >= 6 + k && L(h, ps) + plen >= 9)))
    : o.add(r1, mk('Soutien au palier de 3', { pts: [6 + k, 37], unit: 'HLD', len: flen,
        text: `${ftxt} et ${6 + k} points HLD ou plus : le camp a au moins 10 atouts, le palier de 3 est permis (loi de Vernes).` + rv }),
        h => fit(h) && p(h) >= 6 + k);
  // fit en majeure : comme après une ouverture (fiche 03)
  if (maj) {
    const g = '4' + pd;
    if (lv === 4) {
      // le palier le plus bas est déjà la manche : 13 points HLD, ou 10 atouts dans le camp (loi de Vernes)
      o.alt(g, mk('Soutien à la manche', { pts: [6 + k, 37], unit: 'HLD', len: flen, conclusion: true,
        text: `${ftxt} et ${13 + k} points HLD ou plus, ou ${6 + k} points HLD ou plus avec au moins 10 atouts dans le camp (loi de Vernes) : on dit la manche.` + rv }), () => false);
      o.alt(g, mk('Soutien à la manche', { pts: [13 + k, 37], unit: 'HLD', len: flen, conclusion: true,
        text: `${ftxt} et ${13 + k} points HLD ou plus` + (rev ? ', dont 11 H' : '') + ' : on dit la manche.' + rv }), h => fit(h) && p(h) >= 13 + k && h11(h));
      addVernes(o, g, 'Soutien à la manche', ps, plen, Math.max(fitN, 10 - plen), h => p(h) >= 6 + k, { general: false, extra: { pts: [6 + k, 37], unit: 'HLD' } });
    } else {
      o.add(g, mk('Soutien à la manche', { pts: [13 + k, 37], unit: 'HLD', len: flen, conclusion: true,
        text: `${ftxt} et ${13 + k} points HLD ou plus` + (rev ? ', dont 11 H' : '') + ' : on dit la manche.' + rv }),
        h => fit(h) && p(h) >= 13 + k && h11(h));
      if (lv === 2) {
        o.add('3' + pd, mk('Soutien à saut', { pts: [11 + k, 12 + k], unit: 'HLD', len: flen, invite: true,
          text: `${ftxt}, ${11 + k} ou ${12 + k} points HLD : proposition de manche.` + rv }), h => fit(h) && p(h) >= 11 + k && h11(h));
        o.add(r1, mk('Soutien simple', { pts: [6 + k, rev ? 37 : 10 + k], unit: 'HLD', len: flen,
          text: `${ftxt}, ${6 + k} à ${10 + k} points HLD.` + rv }), h => fit(h) && p(h) >= 6 + k);
      } else if (lv === 3) raise3();
    }
  }
  // Sans-Atout avec arrêt (D5)
  const nt = (call, a, b) => o.add(call, mk(call === '3N' ? '3SA' : call === '2N' ? '2SA' : '1SA', {
    pts: [a, b], unit: 'H', conclusion: call === '3N', invite: call === '2N',
    text: `Pas de fit, ${a} à ${b} points H` + (E.arret ? ` et ${E.arret}` : '') + (call === '2N' ? ' : proposition de manche.' : '.') + rv }),
    h => !majFit(h) && E.stops(h) && hcp(h) >= a && hcp(h) <= b);
  if (E.legal('3N')) nt('3N', 13 + k, 15 + k);
  if (E.legal('2N')) nt('2N', 11 + k, 12 + k);
  // fit en mineure (5 cartes) : après les Sans-Atout
  if (!maj) {
    if (lv === 2) {
      o.add('3' + pd, mk('Soutien à saut', { pts: [11 + k, 37], unit: 'HLD', len: flen, invite: true,
        text: `${ftxt}, ${11 + k} points HLD ou plus, sans arrêt pour le Sans-Atout : proposition de manche.` + rv }), h => fit(h) && p(h) >= 11 + k && h11(h));
      o.add(r1, mk('Soutien simple', { pts: [6 + k, rev ? 37 : 10 + k], unit: 'HLD', len: flen,
        text: `${ftxt}, ${6 + k} à ${10 + k} points HLD.` + rv }), h => fit(h) && p(h) >= 6 + k);
    } else if (lv === 3) raise3();
    else if (lv <= 5)                                        // l'adversaire a fait monter : loi de Vernes (10 atouts au moins)
      addVernes(o, r1, 'Soutien (loi de Vernes)', ps, plen, Math.max(fitN, lv + 6 - plen), h => p(h) >= 6 + k && vLevel(ps, L(h, ps) + plen) >= lv, { extra: { pts: [6 + k, 37], unit: 'HLD' } });
  }
  // nouvelle couleur (D4) : 5 cartes, sans fit, non forcing
  const others = [0, 1, 2, 3].filter(t => t !== ps && !E.opp.includes(t));
  const nsBest = h => { const cand = others.filter(t => L(h, t) >= 5); return cand.length ? bestSuit(h, cand) : -1; };
  for (const t of others) {
    const call = cheapest(c, dn(t));
    if (!E.legal(call) || levelOf(call) > 2) continue;
    o.add(call, mk('Nouvelle couleur', { pts: [8 + k, 12 + k], unit: 'H', len: ln({ [dn(t)]: [5, 13] }),
      text: `Pas de fit, au moins 5 cartes à ${nm(t)} et ${8 + k} à ${12 + k} points H. Non forcing : l'intervenant peut passer.` + rv }),
      h => !fit(h) && hcp(h) >= 8 + k && hcp(h) <= 12 + k && nsBest(h) === t);
  }
  if (E.legal('1N')) nt('1N', 8 + k, 10 + k);
  // cue-bid : main forte (13 H et plus) sans autre enchère, jamais au-delà du palier de 3
  const od = denOf(c.seq[0]);
  const cue = od === 'N' ? null : cheapest(c, od);
  if (E.legal(cue) && levelOf(cue) <= 3) o.add(cue, mk('Cue-bid', { pts: [13 + k, 37], unit: 'H', forcing: 1, alert: true,
    text: `${13 + k} points H ou plus, sans autre enchère possible : enchère dans la couleur de l'ouvreur, forcing. L'intervenant décrit sa main, puis on dit la manche.` + rv }),
    h => hcp(h) >= 13 + k);
  const hasCue = o.some(x => x.call === cue);
  // Passe : l'explication générale, puis un texte vrai pour chaque sorte de main (R9)
  o.alt('P', mk('Passe', Object.assign(hasCue ? { pts: [0, 12 + k], unit: 'H' } : {},
    { text: 'Ni soutien, ni Sans-Atout (il faut un arrêt), ni nouvelle couleur possible : on passe.' + rv })), () => false);
  o.alt('P', mk('Passe', { text: `${ftxt}, mais pas assez de points pour le soutien${lv >= 3 ? ' au palier de ' + lv : ''} : on passe.` + rv }),
    h => fit(h) && hcp(h) < 13 + k);
  o.alt('P', mk('Passe', { text: `${13 + k} points H ou plus, mais aucune enchère ne convient : le cue-bid serait au-dessus du palier de 3. On passe.` + rv }),
    h => hcp(h) >= 13 + k);
  o.alt('P', mk('Passe', { text: `Moins de ${8 + k} points H, et pas ${fitN} cartes à ${nm(ps)} pour le soutien : on passe.` + rv }), h => hcp(h) < 8 + k);
  o.alt('P', mk('Passe', { text: `Pas de soutien (${fitN} cartes à ${nm(ps)}), pas de couleur de 5 cartes à nommer au palier de 1 ou 2, et pas de Sans-Atout possible (il faut un arrêt et les bons points) : on passe.` + rv }), () => true);
  return o;
}

/* ====================================================================
   (2) Bicolore du partenaire (D6) : choisir la meilleure des deux couleurs
   ==================================================================== */
function bicoloreResp(c, E, m1) {
  const pair = [0, 1, 2, 3].filter(s => m1.len[s][0] >= 5);
  const better = h => (L(h, pair[0]) > L(h, pair[1]) || (L(h, pair[0]) === L(h, pair[1]) && pair[0] > pair[1])) ? pair[0] : pair[1];
  const free = isBid(E.rho);                                  // l'adversaire de droite a parlé : on peut passer
  const need = s => s <= 1 ? 14 : 16;                         // points HLD pour la manche
  // l'adversaire de droite a parlé : seulement avec 3 cartes, selon la loi de Vernes (le partenaire en a 5)
  const vOk = (h, s, b) => L(h, s) >= 3 && levelOf(b) <= vLevel(s, L(h, s) + 5);
  const pre = 'L\'adversaire a parlé : on choisit une couleur du bicolore seulement avec assez d\'atouts. ';
  const o = list();
  for (const s of pair) {
    const g = bidOf(s <= 1 ? 4 : 5, s), b = cheapest(c, dn(s));
    const len3 = ln({ [dn(s)]: [3, 13] });
    const gameTxt = `Fit à ${nm(s)} (3 cartes au moins) et ${need(s)} points HLD ou plus : on dit la manche.`;
    const withPts = h => L(h, s) >= 3 && better(h) === s && HLD(h, s) >= need(s);
    if (b !== g) { o.add(g, mk('Manche dans une couleur du bicolore', { pts: [need(s), 37], unit: 'HLD', len: len3, conclusion: true, text: gameTxt }), withPts); continue; }
    // le palier le plus bas est déjà la manche
    if (!free) { o.add(g, mk('Manche dans une couleur du bicolore', { conclusion: true,
      text: `Le partenaire a 5 cartes à ${nm(pair[0])} et 5 cartes à ${nm(pair[1])}. Ici, le palier le plus bas est déjà la manche : on la dit dans la meilleure couleur (${nm(s)}).` }),
      h => better(h) === s); continue; }
    if (o.some(x => x.call === g)) continue;
    o.alt(g, mk('Manche dans une couleur du bicolore', { len: len3, conclusion: true,
      text: `Fit à ${nm(s)} : 3 cartes au moins et ${need(s)} points HLD, ou assez d'atouts pour la loi de Vernes : on dit la manche.` }), () => false);
    o.alt(g, mk('Manche dans une couleur du bicolore', { pts: [need(s), 37], unit: 'HLD', len: len3, conclusion: true, text: gameTxt }), withPts);
    addVernes(o, g, 'Manche dans une couleur du bicolore', s, 5, Math.max(3, levelOf(g) + 1), h => better(h) === s && vOk(h, s, g), { general: false, pre });
  }
  for (const s of pair) {
    const b = cheapest(c, dn(s));
    if (!E.legal(b) || b === bidOf(s <= 1 ? 4 : 5, s)) continue;
    if (!free) o.add(b, mk('Choix d\'une couleur du bicolore',
      { text: `Le partenaire a 5 cartes à ${nm(pair[0])} et 5 cartes à ${nm(pair[1])} : on choisit la meilleure (${nm(s)}) au palier le plus bas.` }),
      h => better(h) === s);
    else addVernes(o, b, 'Choix d\'une couleur du bicolore', s, 5, Math.max(3, levelOf(b) + 1), h => better(h) === s && vOk(h, s, b), { pre });
  }
  if (free) o.add('P', mk('Passe', { text: 'L\'adversaire de droite a parlé : sans assez d\'atouts pour monter, on passe. ' + V_RULE }), () => true);
  return o;
}

/* ====================================================================
   (3) Intervention à saut faible ou barrage du partenaire : comme nos barrages (fiches 06 et 12)
       manche avec des points ; loi de Vernes (palier = atouts du camp − 6, jusqu'au palier 4 en majeure, 5 en mineure),
       même si l'adversaire passe ; sinon passe
   ==================================================================== */
function barrageResp(c, E, ps, plen) {
  const pd = dn(ps), maj = ps <= 1;
  const tot = h => L(h, ps) + plen;
  const vern = h => vLevel(ps, tot(h));                     // palier permis par la loi de Vernes
  const r1 = cheapest(c, pd);
  const o = list();
  const pour = { conclusion: true };                         // pour jouer : le partenaire passe ensuite
  if (maj) {
    // manche : 3 atouts et 16 HLD, ou 10 atouts (loi de Vernes) ; une seule signification pour 4♥/4♠
    const g = '4' + pd, vOk = E.legal(r1) && levelOf(r1) <= 4;
    const len3 = ln({ [pd]: [3, 13] });
    o.alt(g, mk('Manche', { len: len3, conclusion: true,
      text: `Fit à ${nm(ps)} : 3 atouts et 16 points HLD ou plus` + (vOk ? ', ou au moins 10 atouts dans le camp (loi de Vernes)' : '') + ' : on dit la manche.' }), () => false);
    o.alt(g, mk('Manche', { pts: [16, 37], unit: 'HLD', len: len3, conclusion: true,
      text: `Fit à ${nm(ps)} (3 atouts ou plus) et 16 points HLD ou plus : on dit la manche.` }), h => L(h, ps) >= 3 && HLD(h, ps) >= 16);
    if (vOk) addVernes(o, g, 'Manche', ps, plen, Math.max(3, 10 - plen), h => vern(h) >= 4, { general: false });
  }
  o.add('3N', mk('3SA', { pts: [16, 37], unit: 'H', conclusion: true,
    text: `16 points H ou plus, ${E.arret || 'des arrêts'} et un honneur à ${nm(ps)} : 9 levées en vue.` }),
    h => hcp(h) >= 16 && E.stops(h) && honors(h, ps) >= 1);
  // loi de Vernes : on va directement au palier permis (fiche 06 : soutien à 3 avec 3 cartes, à 4 avec 4 cartes)
  if (E.legal(r1)) for (let lv = levelOf(r1); lv <= vCap(ps); lv++) {
    if (maj && lv === 4) continue;                          // 4♥/4♠ : déjà la manche ci-dessus
    addVernes(o, bidOf(lv, ps), 'Prolongation (loi de Vernes)', ps, plen, Math.max(0, lv + 6 - plen), h => vern(h) === lv, { extra: pour });
  }
  const pTxt = 'Le partenaire a un jeu faible : sans jeu pour la manche ni assez d\'atouts pour monter, on passe. ' + V_RULE;
  o.alt('P', mk('Passe', { text: pTxt }), () => false);
  o.alt('P', mk('Passe', { text: `Le partenaire a un jeu faible. Même avec 16 points H, sans 3 atouts et sans arrêt ni honneur à ${nm(ps)} pour 3 SA, on passe.` }), h => hcp(h) >= 16);
  o.alt('P', mk('Passe', { text: pTxt }), () => true);
  return o;
}

/* ====================================================================
   (4) Intervention 1SA du partenaire (D3) : comme sur une ouverture de 1SA
   ==================================================================== */
function ntResp(c, E) {
  if (E.rho !== 'P') {
    // l'adversaire de droite a parlé : plus de Stayman ni de Texas
    const o = list();
    o.add('3N', mk('3SA', { pts: [10, 37], unit: 'H', conclusion: true,
      text: `L'adversaire a parlé : 10 points H ou plus et ${E.arret || 'un arrêt'}, on dit 3SA.` }), h => hcp(h) >= 10 && E.stops(h));
    for (const s of [0, 1, 2, 3]) {
      const b = cheapest(c, dn(s));
      if (!E.legal(b) || levelOf(b) > 2 || E.opp.includes(s)) continue;
      o.add(b, mk('Couleur de 5 cartes', { len: ln({ [dn(s)]: [5, 13] }),
        text: `L'adversaire a parlé : on nomme sa couleur de 5 cartes (${nm(s)}) au palier de 2, pour jouer.` }),
        h => L(h, s) >= 5 && bestSuit(h, [0, 1, 2, 3].filter(t => !E.opp.includes(t) && L(h, t) >= 5)) === s);
    }
    return o.add('P', mk('Passe', { text: 'L\'adversaire a parlé : sans 3SA ni couleur de 5 cartes au palier de 2, on passe.' }), () => true);
  }
  const st45 = (h, a) => hcp(h) >= 8 && L(h, a) === 5 && L(h, 1 - a) === 4;
  return list()
    .add('2H', mk('Texas Pique', { len: ln({ S: [5, 13] }), forcing: 1, alert: true,
      text: 'Au moins 5 piques, avec ou sans points : l\'intervenant dit 2♠ (fiche 14).' }), h => L(h, 0) >= 5 && L(h, 0) >= L(h, 1) && !st45(h, 0))
    .add('2D', mk('Texas Cœur', { len: ln({ H: [5, 13] }), forcing: 1, alert: true,
      text: 'Au moins 5 cœurs, avec ou sans points : l\'intervenant dit 2♥ (fiche 14).' }), h => L(h, 1) >= 5 && !st45(h, 1))
    .add('2C', mk('Stayman', { pts: [8, 37], unit: 'H', forcing: 1, alert: true,
      text: 'Au moins 8 points H et une majeure de 4 cartes : l\'intervenant dit sa majeure de 4 cartes, ou 2♦ (fiche 11).' }),
      h => hcp(h) >= 8 && (L(h, 0) === 4 || L(h, 1) === 4))
    .add('3N', mk('3SA', { pts: [10, 37], unit: 'H', conclusion: true, text: '10 points H ou plus : la manche à Sans-Atout.' }), h => hcp(h) >= 10)
    .add('2N', mk('2SA', { pts: [8, 9], unit: 'H', invite: true, text: '8 ou 9 points H : proposition de manche, l\'intervenant dit 3SA s\'il est maximum.' }), h => hcp(h) >= 8)
    .add('P', mk('Passe', { pts: [0, 7], unit: 'H', text: 'Moins de 8 points H, sans majeure de 5 cartes : on laisse jouer 1SA.' }), () => true);
}
// la suite après le Stayman ou le Texas (fiches 11 et 14)
function ntCont(c, E, tail) {
  if (tail.some((x, i) => i % 2 === 1 && x !== 'P')) return null;
  const t = tail.join(' ');
  let m;
  if ((m = /^1N P 2C P (2D|2H|2S) P$/.exec(t))) {
    const o = list();
    if (m[1] !== '2D') {
      // fit en majeure : on compte les points HLD (fiches 04 et 16)
      const s = m[1] === '2H' ? 1 : 0, d = dn(s);
      o.add('4' + d, mk('Fit : manche', { pts: [10, 37], unit: 'HLD', len: ln({ [d]: [4, 13] }), conclusion: true, text: `Fit à ${nm(s)} et 10 points HLD ou plus : la manche.` }), h => L(h, s) >= 4 && HLD(h, s) >= 10);
      o.add('3' + d, mk('Fit : proposition de manche', { pts: [8, 9], unit: 'HLD', len: ln({ [d]: [4, 13] }), invite: true, text: `Fit à ${nm(s)}, 8 ou 9 points HLD : proposition de manche.` }), h => L(h, s) >= 4);
    }
    return o.add('3N', mk('3SA', { pts: [10, 37], unit: 'H', conclusion: true, text: 'Pas de fit en majeure, 10 points H ou plus : 3SA.' }), h => hcp(h) >= 10)
      .add('2N', mk('2SA', { pts: [8, 9], unit: 'H', invite: true, text: 'Pas de fit en majeure, 8 ou 9 points H : proposition de manche.' }), () => true);
  }
  // réponse 2SA au Stayman : l'intervenant a 4 cœurs et 4 piques (fiche 11). Le fit est sûr : on le dit par un transfert,
  // 3♣ vers 3♥ et 3♦ vers 3♠ avec 8 ou 9 points, 4♣ vers 4♥ et 4♦ vers 4♠ avec 10 points et plus (comptés en HLD).
  if (t === '1N P 2C P 2N P') {
    const fs = h => L(h, 0) > L(h, 1) ? 0 : 1;               // la majeure la plus longue ; à égalité, Cœur (ordre de la fiche 11)
    const o = list();
    for (const [call, s, game] of [['4C', 1, true], ['4D', 0, true], ['3C', 1, false], ['3D', 0, false]]) {
      const tr = (game ? '4' : '3') + sym(s);
      o.add(call, mk(`Transfert : fit à ${nm(s)}` + (game ? ', manche' : ''), { len: ln({ [dn(s)]: [4, 13] }), forcing: 1, alert: true,
        text: `Le partenaire a 4 cœurs et 4 piques. Fit à ${nm(s)}, ` + (game ? '10 points HLD ou plus' : '8 ou 9 points HLD') +
          ` : ${call[0]}${sym(call[1] === 'C' ? 3 : 2)} lui demande de dire ${tr} (fiche 11).` }),
        h => fs(h) === s && (!game || HLD(h, s) >= 10));
    }
    return o;
  }
  // le transfert au palier de 3 est complété : avec 8 ou 9 points, on joue la majeure au palier de 3 (fiche 11)
  if ((m = /^1N P 2C P 2N P (3C|3D) P (3H|3S) P$/.exec(t)) && { '3C': '3H', '3D': '3S' }[m[1]] === m[2])
    return passList(`Le partenaire a dit ${m[2][0]}${sym(m[2] === '3H' ? 1 : 0)} : avec 8 ou 9 points, on joue ce contrat (fiche 11).`);
  if ((m = /^1N P (2D|2H) P (2H|2S) P$/.exec(t))) {
    const s = m[1] === '2D' ? 1 : 0, d = dn(s);
    return list()
      .add('4' + d, mk('Manche : 6 cartes', { pts: [10, 37], unit: 'H', len: ln({ [d]: [6, 13] }), conclusion: true, text: `6 cartes à ${nm(s)} et 10 points H ou plus : la manche.` }), h => L(h, s) >= 6 && hcp(h) >= 10)
      .add('3N', mk('3SA : 5 cartes', { pts: [10, 37], unit: 'H', len: ln({ [d]: [5, 5] }), text: `5 cartes à ${nm(s)} et 10 points H ou plus : l'intervenant choisit 3SA ou 4${sym(s)}.` }), h => hcp(h) >= 10)
      .add('3' + d, mk('Proposition : 6 cartes', { pts: [8, 9], unit: 'H', len: ln({ [d]: [6, 13] }), invite: true, text: `6 cartes à ${nm(s)}, 8 ou 9 points H : proposition de manche.` }), h => L(h, s) >= 6 && hcp(h) >= 8)
      .add('2N', mk('2SA : 5 cartes', { pts: [8, 9], unit: 'H', len: ln({ [d]: [5, 5] }), invite: true, text: `5 cartes à ${nm(s)}, 8 ou 9 points H : proposition de manche.` }), h => hcp(h) >= 8)
      .add('P', mk('Passe', { pts: [0, 7], unit: 'H', len: ln({ [d]: [5, 13] }), text: `Moins de 8 points H : on joue 2${sym(s)}.` }), () => true);
  }
  return null;
}

/* ====================================================================
   (5) Contre d'appel du partenaire, quand la fiche 13 ne s'applique pas :
       contre d'un barrage (2♥, 2♠, 3♣…), contre de réveil (D7), ou l'adversaire de droite a parlé (enchère libre)
   ==================================================================== */
function doubleResp(c, E, pFirst, again) {
  const free = E.rho !== 'P';
  const doubled = c.auction.slice(0, c.n - 1).filter(isBid).pop();
  const ds = denOf(doubled) === 'N' ? -1 : DEN_SUIT[denOf(doubled)];
  // contre direct d'une ouverture de barrage : comme la fiche 13, un palier plus haut (saut avec 8 à 10 H)
  const mode = free ? 'libre' : (!again && pFirst.i === c.openIdx + 1 && levelOf(c.seq[0]) >= 2) ? 'barrage' : 'reveil';
  const Z = mode === 'barrage' ? { lo: 0, mid: 8, game: 11 } : { lo: free ? 6 : 0, mid: 11, game: 13 };
  const unbid = [0, 1, 2, 3].filter(s => !E.opp.includes(s));
  if (!unbid.length) return null;
  const um = unbid.filter(s => s <= 1);
  const m4 = h => um.filter(s => L(h, s) >= 4);
  const best = h => bestSuit(h, unbid);
  const H = hcp;
  const inMid = h => H(h) >= Z.mid && H(h) < Z.game;
  const arr = E.arret || 'un arrêt';
  const lvd = levelOf(doubled);
  // contre au palier de 4 ou plus (contre d'un barrage à 4, fiche C5) : il montre surtout de la force
  const high = !free && lvd >= 4;
  // cartes demandées pour nommer une couleur : 5 au palier de 5 (et au palier de 4 après un contre à 4, sauf la manche
  // en majeure) ; 4 pour la manche en majeure, ou quand l'adversaire de droite a parlé ; sinon 3 (contre forcé)
  const majGame4 = s => s <= 1 && cheapest(c, dn(s)) === '4' + dn(s);
  const needOf = (s, b) => (levelOf(b) >= 5 || (high && !majGame4(s))) ? 5 : (high || free || majGame4(s)) ? 4 : 3;
  const bidOk = (h, s) => { const b = cheapest(c, dn(s)); return E.legal(b) && (!free || levelOf(b) <= 3) && L(h, s) >= needOf(s, b); };
  // la couleur nommée : une majeure de 4 cartes d'abord, puis la plus longue ; à égalité, la plus belle des deux majeures,
  // sinon la moins chère (fiche 13 : couleur au palier le plus bas)
  const rank = s => bidRank(cheapest(c, dn(s)));
  const pick = h => {
    const ok = unbid.filter(s => bidOk(h, s));
    if (!ok.length) return -1;
    const l = lens(h), mj = s => s <= 1 && l[s] >= 4 ? 1 : 0;
    return ok.sort((a, b) => (mj(b) - mj(a)) || (l[b] - l[a]) || (a <= 1 && b <= 1 ? honors(h, b) - honors(h, a) : 0) || (rank(a) - rank(b)))[0];
  };
  // cue-bid : jamais au-delà du palier de 3
  const cueS = isBid(E.rho) && denOf(E.rho) !== 'N' ? DEN_SUIT[denOf(E.rho)] : E.opp.length ? E.opp[0] : -1;
  const cue = cueS >= 0 ? cheapest(c, dn(cueS)) : null;
  const cueOk = E.legal(cue) && levelOf(cue) <= 3;
  const o = list();
  const punitive = h => H(h) >= 8 && L(h, ds) >= 5 && bigHonors(h, ds) >= 2;
  if (high) {
    // contre au palier de 4 : sans couleur de 5 cartes (ou majeure de 4 cartes à la manche), on passe
    const g4 = um.filter(majGame4);
    const noSuit = 'Sans couleur de 5 cartes à nommer' + (g4.length ? ` (ni 4 cartes à ${g4.map(nm).join(' ou à ')} pour la manche)` : '');
    o.alt('P', mk('Passe : contre laissé', {
      text: `Contre au palier de ${lvd} : il montre surtout de la force. ${noSuit}, ou avec 5 bonnes cartes dans leur couleur, on passe : le contre devient punitif.` }), () => false);
    if (ds >= 0) o.alt('P', mk('Passe : contre laissé', {
      text: `Contre au palier de ${lvd} : avec 8 points H et 5 bonnes cartes à ${nm(ds)}, on passe. Le contre devient punitif.` }), punitive);
    o.alt('P', mk('Passe : contre laissé', {
      text: `Contre au palier de ${lvd} : il montre surtout de la force. ${noSuit} : on passe, le contre devient punitif.` }), h => pick(h) < 0);
  } else if (!free && ds >= 0) {
    // passe exceptionnelle : le contre devient punitif
    o.add('P', mk('Passe : contre transformé en punitif', { pts: [8, 37], unit: 'H', len: ln({ [dn(ds)]: [5, 13] }),
      text: `Exceptionnel : 8 points H ou plus et 5 bonnes cartes à ${nm(ds)} (comme à la fiche 13). Le contre devient punitif.` }), punitive);
  }
  o.add('3N', mk('3SA', { pts: [Z.game, 37], unit: 'H', conclusion: true,
    text: `${Z.game} points H ou plus, ${arr}, pas de majeure de 4 cartes : 3SA.` }),
    h => !m4(h).length && E.stops(h) && H(h) >= Z.game);
  // manche en majeure : 4 cartes et assez de points ; quand le palier le plus bas est déjà la manche (contre forcé), avec tous les points
  for (const s of um) {
    const g = '4' + dn(s), b = cheapest(c, dn(s));
    const isCheap = b === g && !free;
    o.add(g, mk('Manche', { pts: [isCheap ? Z.lo : Z.game, 37], unit: 'H', len: ln({ [dn(s)]: [isCheap ? needOf(s, b) : 4, 13] }), conclusion: true,
      text: isCheap ? `Ici, le palier le plus bas est déjà la manche : on la dit avec ${needOf(s, b)} cartes ou plus à ${nm(s)} (la meilleure couleur), quels que soient les points.`
        : `4 cartes ou plus à ${nm(s)} et ${Z.game} points H ou plus : la manche.` }),
      h => (m4(h).length > 0 && bestSuit(h, m4(h)) === s && H(h) >= Z.game) || (isCheap && pick(h) === s));
  }
  // zone du saut : 8 à 10 H (contre d'un barrage) ou 11-12 H ; avec un arrêt et sans majeure de 4 cartes, 2SA d'abord
  const midTxt = `${Z.mid} à ${Z.game - 1} points H`;
  o.add('2N', mk('2SA', { pts: [Z.mid, Z.game - 1], unit: 'H', invite: mode !== 'barrage',
    text: `${midTxt}, ${arr}, pas de majeure de 4 cartes` + (mode === 'barrage' ? '.' : ' : proposition de manche.') }),
    h => inMid(h) && E.stops(h) && !m4(h).length);
  for (const s of unbid) {
    const j = jumpOf(c, s);
    if (!E.legal(j) || levelOf(j) > 3) continue;
    o.add(j, mk(mode === 'barrage' ? 'Saut' : 'Saut : proposition de manche', { pts: [Z.mid, Z.game - 1], unit: 'H', len: ln({ [dn(s)]: [4, 13] }), invite: mode !== 'barrage',
      text: `4 cartes ou plus à ${nm(s)} et ${midTxt} : on saute d'un palier` + (mode === 'barrage' ? '.' : ', proposition de manche.') }),
      h => inMid(h) && L(h, s) >= 4 && best(h) === s);
  }
  // cue-bid : main forte sans autre enchère (palier de 3 au plus)
  if (cueOk) o.add(cue, mk('Cue-bid', { pts: [Z.game, 37], unit: 'H', forcing: 1, alert: true,
    text: `${Z.game} points H ou plus, sans autre enchère claire : enchère dans la couleur adverse, forcing. Le contreur décrit sa main.` }), h => H(h) >= Z.game);
  // manche en mineure : 13 H et 5 cartes, quand le cue-bid n'est pas possible (ou quand le palier le plus bas est déjà la manche)
  for (const s of unbid.filter(t => t >= 2)) {
    const g = '5' + dn(s);
    if (!E.legal(g)) continue;
    const isCheap = cheapest(c, dn(s)) === g && !free;
    o.add(g, mk('Manche en mineure', { pts: [isCheap ? Z.lo : 13, 37], unit: 'H', len: ln({ [dn(s)]: [5, 13] }), conclusion: true,
      text: isCheap ? `Ici, le palier le plus bas est déjà la manche : on la dit avec 5 cartes ou plus à ${nm(s)} (la meilleure couleur), quels que soient les points.`
        : `5 cartes ou plus à ${nm(s)} et 13 points H ou plus, sans autre enchère possible : la manche en mineure.` }),
      h => L(h, s) >= 5 && ((H(h) >= 13 && best(h) === s) || (isCheap && pick(h) === s)));
  }
  // palier le plus bas : 1SA avec un arrêt, ou la meilleure couleur (sans saut possible : jusqu'à 12 H)
  const top = mode === 'barrage' ? 10 : 12;
  const capTop = !free && !cueOk ? 37 : top;               // contre forcé sans cue-bid possible : toutes les mains qui restent
  if (mode !== 'barrage') o.add('1N', mk('1SA', { pts: [8, 10], unit: 'H', text: `8 à 10 points H, ${arr}, pas de majeure de 4 cartes.` }),
    h => H(h) >= 8 && H(h) <= 10 && E.stops(h) && !m4(h).length);
  for (const s of unbid) {
    const b = cheapest(c, dn(s));
    if (!E.legal(b) || (free && levelOf(b) > 3)) continue;
    const n = needOf(s, b);
    o.add(b, mk('Couleur au palier le plus bas', { pts: [Z.lo, capTop], unit: 'H', len: ln({ [dn(s)]: [n, 13] }),
      text: (free ? `${Z.lo} à ${top} points H et ${n} cartes ou plus à ${nm(s)} : on la nomme au palier le plus bas, sans sauter.`
        : `${again ? 'Le partenaire contre de nouveau' : 'Le contre oblige à répondre'} : on nomme sa meilleure couleur (${nm(s)}${n >= 4 ? `, ${n} cartes au moins` : ''}) au palier le plus bas.`) +
        (top > 10 ? ' Avec 11 ou 12 points H, seulement si le saut n\'est pas possible.' : '') }),
      h => H(h) >= Z.lo && H(h) <= capTop && pick(h) === s);
  }
  if (free) {
    // Passe : l'explication générale, puis un texte vrai pour chaque sorte de main (R9)
    o.alt('P', mk('Passe', Object.assign(cueOk ? { pts: [0, 12], unit: 'H' } : {}, {
      text: 'L\'adversaire de droite a parlé : on n\'est plus obligé de répondre. Avec moins de 6 points H, ou sans couleur de 4 cartes à nommer jusqu\'au palier de 3 (et sans manche), on passe.' })), () => false);
    o.alt('P', mk('Passe', { text: 'L\'adversaire de droite a parlé : on n\'est plus obligé de répondre. Avec moins de 6 points H, on passe.' }), h => H(h) < 6);
    o.alt('P', mk('Passe', { text: '13 points H ou plus, mais aucune enchère ne convient jusqu\'au palier de 3 (couleur de 4 cartes, cue-bid ou 3SA) : on passe, le partenaire pourra reparler.' }), h => H(h) >= 13);
    o.alt('P', mk('Passe', { text: 'L\'adversaire de droite a parlé : on n\'est plus obligé de répondre. Sans couleur de 4 cartes à nommer jusqu\'au palier de 3, on passe.' }), () => true);
  } else if (!high && ds >= 0) {
    // aucune couleur à nommer : on a beaucoup de cartes dans leur couleur, le contre devient punitif
    o.alt('P', mk('Passe : contre transformé en punitif', { len: ln({ [dn(ds)]: [5, 13] }),
      text: `Aucune couleur à nommer : avec autant de cartes à ${nm(ds)}, on passe. Le contre devient punitif.` }), h => pick(h) < 0 && L(h, ds) >= 5);
  }
  return o;
}

/* ====================================================================
   (6) La suite : je reparle (D8, D9, loi de Vernes)
   ==================================================================== */
function myPts(h, m, t) {
  if (m.unit === 'HLD' && t >= 0) return HLD(h, t);
  if (m.unit === 'HL') return HL(h);
  return hcp(h);
}
// couleurs de fit (8 cartes) : mes cartes et celles promises par le partenaire
function fitSuits(c, E, h, pm) {
  return natSuitsOf(c, E.side).filter(s => !E.opp.includes(s) && L(h, s) + pm.len[s][0] >= 8)
    .sort((a, b) => (L(h, b) + pm.len[b][0]) - (L(h, a) + pm.len[a][0]) || a - b);
}
function laSuite(c, E, pFirst, kind) {
  if (kind === 'NT') { const r = ntCont(c, E, c.auction.slice(pFirst.i)); if (r) return r; }
  const pm = summarize(c, c.partner);
  const myBids = c.calls.filter(x => x.seat === c.seat && x.call !== 'P' && x.i > pFirst.i);
  const myLast = myBids[myBids.length - 1];
  const myM = explainAt(c.auction, c.dealer, myLast.i);
  const lb = c.st.lastBid, lbSeat = c.st.lastBidSeat;
  const ourLast = sideOf(lbSeat) === E.side;
  const pLast = c.calls.filter(x => x.seat === c.partner && x.call !== 'P').pop();
  const pLastM = explainAt(c.auction, c.dealer, pLast.i);
  const justNow = pLast.i === c.n - 2;
  // notre contrat est contré
  if (ourLast && c.st.dbl >= 1) return passList('Notre contrat est contré : on ne fuit pas, on passe.');
  // le partenaire vient de contrer l'adversaire : contre punitif, on le laisse
  if (!ourLast && pLast.call === 'X' && justNow && E.rho === 'P' && pLast.i > myLast.i) {
    if (explainAt(c.auction, c.dealer, pLast.i).forcing) return doubleResp(c, E, pLast, true);   // contre encore d'appel (C3) : tableau 3
    return passList('Le partenaire a contré l\'adversaire pour le faire chuter : on laisse le contre.');
  }
  // (D9) le partenaire a conclu (manche) : on passe, sauf chelem. Une enchère forcing ou un cue-bid n'est jamais une conclusion.
  const pCue = denOf(lb) !== 'N' && E.opp.includes(DEN_SUIT[denOf(lb)]);
  if (ourLast && lbSeat === c.partner && !pLastM.forcing && !pCue && (pLastM.conclusion || levelOf(lb) >= gameLevelOf(denOf(lb)))) {
    const d = denOf(lb), o = list();
    if (d === 'N') {
      o.add('6N', mk('Petit chelem à Sans-Atout', { conclusion: true, text: 'Le camp a 33 points H ou plus : petit chelem (fiche 08).' }), h => hcp(h) + pm.min >= 33);
    } else {
      const t = DEN_SUIT[d];
      const asked = c.calls.some(x => x.call === '4N' && sideOf(x.seat) === E.side);
      if (!asked) o.add('4N', M('Blackwood (5 clés)', { forcing: 1, alert: true, fiche: '08',
        text: 'Le camp a 33 points ou plus avec un fit : on demande les clés (fiche 08).' }), h => L(h, t) + pm.len[t][0] >= 8 && HLD(h, t) + pm.min >= 33);
    }
    return o.add('P', mk('Passe', { text: 'Le partenaire a conclu à la manche : on passe (sauf chelem, avec 33 points dans le camp).' }), () => true);
  }
  // après mon cue-bid (forcing) : on dit la manche. 3SA seulement avec un arrêt dans leur couleur (ou si le partenaire l'a montré par un SA)
  if (myM.forcing && /Cue-bid/.test(myM.name) && ourLast && lbSeat === c.partner && justNow) {
    const o = list();
    const pSA = denOf(pLast.call) === 'N' || /SA/.test(pLastM.name);
    const stopOk = h => E.stops(h) || pSA;
    const fit8 = (h, s) => L(h, s) + pm.len[s][0] >= 8;
    const maj52 = (h, s) => pm.len[s][0] >= 5 && L(h, s) >= 2;          // sa majeure de 5 cartes, 2 cartes chez moi
    // 4♥/4♠ : 8 cartes à deux ; sans arrêt, aussi sa majeure de 5 cartes avec 2 cartes chez moi, ou ma majeure de 6 cartes
    const g4 = (h, s) => E.legal('4' + dn(s)) && (fit8(h, s) || (!stopOk(h) && (maj52(h, s) || (L(h, s) >= 6 && !E.opp.includes(s)))));
    // 5 en mineure : 8 cartes à deux ; si 3SA n'est plus possible, aussi sa mineure de 5 cartes avec 2 cartes chez moi
    const no3N = !E.legal('3N');
    const g5 = (h, s) => E.legal('5' + dn(s)) && (fit8(h, s) || (no3N && pm.len[s][0] >= 5 && L(h, s) >= 2));
    for (const s of [0, 1]) o.add('4' + dn(s), mk('Manche après le cue-bid', {
      len: ln({ [dn(s)]: [pm.len[s][0] >= 5 ? 2 : Math.max(0, Math.min(6, 8 - Math.max(4, pm.len[s][0]))), 13] }), conclusion: true,
      text: `Après le cue-bid : 8 cartes à ${nm(s)} à deux, ou sans arrêt dans leur couleur, sa majeure de 5 cartes avec 2 cartes chez vous (ou 6 cartes chez vous) : la manche.` }),
      h => g4(h, s));
    o.add('3N', mk('3SA après le cue-bid', { conclusion: true,
      text: `Après le cue-bid, sans fit en majeure : 3SA avec ${E.arret || 'un arrêt'} (ou si le partenaire a dit Sans-Atout). Sans arrêt, 3SA seulement si aucune autre manche n'est possible.` }),
      h => stopOk(h) || ![0, 1].some(s => g4(h, s)) && ![2, 3].some(s => g5(h, s)));
    for (const s of [2, 3]) o.add('5' + dn(s), mk('Manche après le cue-bid', {
      len: ln({ [dn(s)]: [no3N && pm.len[s][0] >= 5 ? 2 : Math.max(0, 8 - Math.max(4, pm.len[s][0])), 13] }), conclusion: true,
      text: no3N ? `Après le cue-bid, 3SA n'est plus possible : la manche à ${nm(s)} avec 8 cartes à deux, ou sa couleur de 5 cartes avec 2 cartes chez vous.`
        : `Après le cue-bid : 8 cartes à ${nm(s)} à deux et pas d'arrêt pour 3SA : la manche en mineure.` }), h => g5(h, s));
    return o;
  }
  if (myM.forcing) return null;
  // (D8) le partenaire propose la manche : on accepte avec le haut de sa fourchette
  if (ourLast && lbSeat === c.partner && justNow && pLastM.invite) {
    const d = denOf(lb), t = d === 'N' ? -1 : DEN_SUIT[d];
    // mon enchère de compétition (loi de Vernes) ne promet pas de points : le partenaire l'a lue comme un soutien simple (6 à 10)
    const vernesBid = !myM.pts && /loi de Vernes/.test(myM.name);
    const r = vernesBid ? [6, 10] : myM.pts;
    if (!r) return null;
    const top = Math.floor((r[0] + Math.min(r[1], r[0] + 10)) / 2) + 1;
    const myT = t >= 0 ? t : (denOf(myLast.call) !== 'N' && isBid(myLast.call) ? DEN_SUIT[denOf(myLast.call)] : -1);
    const g = t >= 0 && t <= 1 ? '4' + d : '3N';
    const mu = vernesBid ? { unit: 'HLD' } : myM;
    const vTxt = 'Le partenaire propose la manche : il a lu notre enchère de compétition (loi de Vernes) comme un soutien simple, 6 à 10 points.';
    return list()
      .add(g, mk('Acceptation de la manche', { conclusion: true,
        text: (vernesBid ? `${vTxt} Avec ${top} points HLD ou plus, on accepte.`
          : `Le partenaire propose la manche : on accepte avec le haut de sa fourchette (${top} points ou plus).`) + (g === '3N' && t >= 2 ? ' En mineure, on accepte par 3SA, avec un arrêt.' : '') }),
        h => myPts(h, mu, myT) >= top && (g !== '3N' || t < 0 || E.stops(h)))
      .add('P', mk('Refus de la manche', { text: vernesBid ? `${vTxt} Avec moins de ${top} points HLD${g === '3N' && t >= 2 ? ' (ou sans arrêt pour 3SA)' : ''}, on refuse : on passe.`
        : `Le partenaire propose la manche, mais on est dans le bas de sa fourchette${g === '3N' && t >= 2 ? ' (ou sans arrêt pour 3SA)' : ''} : on passe.` }), () => true);
  }
  // l'adversaire a la dernière enchère : loi de Vernes (palier = atouts du camp − 6, jusqu'au palier 4 en majeure, 5 en mineure), sinon passe
  if (!ourLast) {
    const o = list();
    const vern = h => {
      for (const s of fitSuits(c, E, h, pm)) {
        const b = cheapest(c, dn(s));
        if (E.legal(b) && levelOf(b) <= vLevel(s, L(h, s) + pm.len[s][0])) return b;
      }
      return null;
    };
    for (const s of [0, 1, 2, 3]) {
      const b = cheapest(c, dn(s));
      if (!E.legal(b) || levelOf(b) > vCap(s) || E.opp.includes(s)) continue;
      const sh = pm.len[s][0];
      addVernes(o, b, 'Compétition (loi de Vernes)', s, sh, Math.max(1, levelOf(b) + 6 - sh), h => vern(h) === b);
    }
    return o.add('P', mk('Passe', { text: 'L\'adversaire a reparlé : sans assez d\'atouts pour monter, on passe. ' + V_RULE }), () => true);
  }
  // le partenaire fait une enchère forcing : pas dans la fiche
  if (lbSeat === c.partner && justNow && pLastM.forcing) return null;
  return passList('Le partenaire a décrit sa main sans forcing ni proposition de manche : on passe.');
}

/* ---------- J'ai passé après l'enchère du partenaire, et c'est de nouveau à moi ---------- */
function afterMyPass(c, E, pFirst) {
  const pLast = c.calls.filter(x => x.seat === c.partner && x.call !== 'P').pop();
  const justNow = pLast.i === c.n - 2;
  if (justNow && E.rho === 'P') {
    if (pLast.call === 'X' && pLast.i > pFirst.i) return doubleResp(c, E, pLast, true);   // le partenaire contre de nouveau
    if (explainAt(c.auction, c.dealer, pLast.i).forcing) return null;
  }
  const o = list();
  const ourLast = sideOf(c.st.lastBidSeat) === E.side;
  const theirNT = !ourLast && denOf(c.st.lastBid) === 'N';
  if (!ourLast && !theirNT) {
    // l'adversaire a reparlé à la couleur : loi de Vernes (section 4 de la fiche, « La suite »), dans une couleur que le partenaire
    // a montrée (5 cartes au moins), avec 6 points HLD comme un soutien. Pas sur leur Sans-Atout : ils n'ont pas de fit
    // (mesuré : −53 IMP sur 9000 donnes)
    const pm = summarize(c, c.partner), nat = natSuitsOf(c, E.side);
    const cand = [0, 1, 2, 3].filter(s => !E.opp.includes(s) && (nat.includes(s) || pm.len[s][0] >= 5));
    const vern = h => {
      const fs = cand.filter(s => L(h, s) + pm.len[s][0] >= 8 && HLD(h, s) >= 6)   // 6 HLD, comme un soutien (mesuré : +50 IMP)
        .sort((a, b) => (L(h, b) + pm.len[b][0]) - (L(h, a) + pm.len[a][0]) || a - b);
      for (const s of fs) {
        const b = cheapest(c, dn(s));
        if (E.legal(b) && levelOf(b) <= vLevel(s, L(h, s) + pm.len[s][0])) return b;
      }
      return null;
    };
    for (const s of cand) {
      const b = cheapest(c, dn(s));
      if (!E.legal(b) || levelOf(b) > vCap(s)) continue;
      const sh = pm.len[s][0];
      addVernes(o, b, 'Compétition (loi de Vernes)', s, sh, Math.max(1, levelOf(b) + 6 - sh, 8 - sh), h => vern(h) === b,
        { pre: 'On avait passé, mais l\'adversaire a reparlé, et vous avez 6 points HLD ou plus. ' });
    }
  }
  // Passe : l'explication générale, puis un texte vrai pour chaque sorte de main (R9)
  const tail = theirNT ? 'L\'adversaire a reparlé à Sans-Atout : la loi de Vernes sert contre une enchère à la couleur. On le laisse décider.'
    : !ourLast ? 'Sans fit qui permette de monter (loi de Vernes), on le laisse décider.'
    : c.st.dbl >= 1 ? 'Notre contrat est contré : on ne fuit pas, on le laisse décider.'
    : 'Il a reparlé sans forcing : on le laisse décider.';
  o.alt('P', mk('Passe', { text: 'On a déjà passé : le partenaire sait que notre jeu est faible, ou que la fiche ne nous donnait pas d\'enchère. On le laisse décider.' }), () => false);
  o.alt('P', mk('Passe', { text: 'On a déjà passé : le partenaire sait que notre jeu est faible (ou sans fit). On le laisse décider.' }), h => hcp(h) < 8);
  o.alt('P', mk('Passe', { text: 'On a déjà passé : le partenaire sait que la fiche ne nous donnait pas d\'enchère au tour précédent. ' + tail }), () => true);
  return o;
}

/* ====================================================================
   AIGUILLAGE
   ==================================================================== */
B.COMPL.C4 = function (c) {
  if (c.role !== 'defender') return null;
  const E = env(c);
  const pFirst = c.calls.find(x => x.seat === c.partner && x.call !== 'P');
  if (!pFirst) return null;
  const myAfter = c.calls.filter(x => x.seat === c.seat && x.i > pFirst.i);
  const m1 = explainAt(c.auction, c.dealer, pFirst.i);
  const kind = kindOf(c, pFirst, m1);
  if (!kind) return null;
  if (myAfter.some(x => x.call !== 'P')) return laSuite(c, E, pFirst, kind);
  if (myAfter.length) return afterMyPass(c, E, pFirst);
  // ma 1re réponse
  const pc = pFirst.call;
  if (kind === 'OVC') { const ps = DEN_SUIT[denOf(pc)]; return overcallResp(c, E, ps, Math.max(5, m1.len[ps][0]), isReveil(m1)); }
  if (kind === 'BARR') { const ps = DEN_SUIT[denOf(pc)]; return barrageResp(c, E, ps, Math.max(6, m1.len[ps][0])); }
  if (kind === 'BIC') return bicoloreResp(c, E, m1);
  if (kind === 'NT') return ntResp(c, E);
  if (kind === 'X') return doubleResp(c, E, pFirst, false);
  if (kind === 'XPUN') return passList('Le partenaire a contré 1SA pour le faire chuter (16 H et plus) : on le laisse décider, on passe.');
  if (kind === 'CONCL') return passList('Le partenaire a conclu à la manche : on passe.');
  return null;                                        // Landy contré ou surenchéri : pas dans la fiche
};
})();

/* ===================== Fiche complémentaire C5 ===================== */
/* Fiche complémentaire C5 — En défense : se taire, intervenir plus tard ou se réveiller.
   L'adversaire a ouvert et notre camp n'a dit que Passe. Les interventions directes restent aux fiches 10 et 17
   et au moteur des barrages (overcallOpts, over1NOpts, overPreemptOpts) ; cette fiche traite tout le reste :
   1. se taire : adversaires à la manche ou au palier de 3, ouverture de 1SA suivie d'une réponse, adversaires fittés
      qui enchérissent encore, 1er tour où il faudrait parler au palier de 3 ; juste après leur soutien au palier
      de 2, on parle seulement comme la fiche 10 avec la valeur d'ouverture (13 HL) ;
   2. intervenir plus tard (2e tour, adversaires sans fit au palier de 1 ou 2) : valeur d'ouverture, belle couleur
      au palier de 2 au plus, ou contre d'appel (2 cartes au plus dans leur couleur, les couleurs libres) ;
   3. le réveil (adversaires fittés arrêtés au palier de 2) : on prête un Roi au partenaire, donc environ 3 points
      de moins : contre ou couleur dès 10 HL (13 HL - 3) ;
   Dès 18 HL, avec 2 cartes au plus dans leur couleur, on contre avant de nommer sa couleur (fiche 10) ; la couleur
   directe seulement si le contre est impossible. Les Passes ont un texte vrai pour la main (main faible / main forte).
   4. ouvertures fortes (2♣, 2♦, 2SA) : belle couleur au 1er tour ; barrage au palier de 4 : contre ou couleur, 16 HL. */
(function () {
'use strict';
const B = globalThis.B;
const { M, opt, ln, L, nm, dn, cheapest, natSuitsOf, gameLevelOf } = B.BH;
const { HL, hcp, honors, bigHonors, robust, levelOf, denOf, sideOf, DEN_SUIT } = B;
const F = 'C5';
const SUITS = [0, 1, 2, 3];
const pass = text => opt('P', M('Passe', { fiche: F, text }), () => true);
// deux Passes (R9) : la 1re pour la main de moins de 18 HL (elle donne aussi l'explication), la 2e pour la main forte
const pass2 = (weak, strong) => [opt('P', M('Passe', { fiche: F, text: weak }), h => HL(h) < 18), pass(strong)];
const haut3 = () => pass2('Les adversaires sont au palier de 3 ou plus : c\'est trop haut, on se tait.',
  'Jeu fort, mais les adversaires sont déjà au palier de 3 ou plus : la fiche ne prévoit pas d\'enchère ici, on se tait.');
// parmi les couleurs qui conviennent à la main : la plus longue (à égalité, la plus chère)
const best = (h, list) => list.slice().sort((a, b) => L(h, b) - L(h, a) || a - b)[0];

B.COMPL.C5 = function (c) {
  if (c.openIdx < 0 || c.ourActive) return null;
  const lb = c.st.lastBid;
  if (!lb || sideOf(c.st.lastBidSeat) === sideOf(c.seat)) return null;
  const opp = 1 - sideOf(c.seat);
  const named = natSuitsOf(c, opp);                     // couleurs nommées par les adversaires
  const free = SUITS.filter(s => !named.includes(s));   // couleurs « libres »
  const firstTurn = !c.mine.some(x => x.i > c.openIdx); // je n'ai encore rien dit depuis l'ouverture
  const reveil = c.n >= 2 && c.auction[c.n - 1] === 'P' && c.auction[c.n - 2] === 'P';
  const lv = levelOf(lb), ld = denOf(lb), ls = ld === 'N' ? -1 : DEN_SUIT[ld];
  const call = s => cheapest(c, dn(s));
  const pal = s => call(s) ? levelOf(call(s)) : 9;      // palier de mon enchère dans la couleur s
  // couleur s choisie par la main : elle convient et c'est la meilleure de celles qui conviennent
  const pick = (list, okFn) => list.map(s => opt(call(s), null, h => okFn(h, s) && best(h, list.filter(t => okFn(h, t))) === s));
  const o = [];

  // 4. Barrage adverse au palier de 4 (1er tour) : contre = jeu fort, couleur naturelle
  if (/^4[CDHS]( P P)?$/.test(c.s)) {
    const os = DEN_SUIT[c.seq[0][1]];
    const nat = lvl => {
      const list = SUITS.filter(s => s !== os && pal(s) === lvl);
      for (const x of pick(list, (h, s) => L(h, s) >= 6 && HL(h) >= 16)) {
        const s = DEN_SUIT[denOf(x.call)];
        x.m = M('Couleur sur un barrage', { pts: [16, 37], unit: 'HL', len: ln({ [dn(s)]: [6, 13] }), fiche: F,
          text: `Au moins 6 cartes à ${nm(s)} et un jeu fort (16 points HL et plus).` });
        o.push(x);
      }
    };
    nat(4);
    // le partenaire (fiche C4) nomme une couleur de 5 cartes, ou une majeure de 4 cartes au palier de 4 ; sinon il passe
    const g4 = [0, 1].filter(s => s !== os && pal(s) === 4);
    o.push(opt('X', M('Contre d\'un barrage', { pts: [16, 37], unit: 'HL', len: ln({ [dn(os)]: [0, 2] }), fiche: F,
      text: `Jeu fort (16 points HL et plus), au plus 2 cartes à ${nm(os)}. Le partenaire passe le plus souvent : il nomme seulement ` +
        `une couleur de 5 cartes` + (g4.length ? ` (ou 4 cartes à ${g4.map(nm).join(' ou à ')} pour la manche).` : '.') }),
      h => HL(h) >= 16 && L(h, os) <= 2));
    nat(5);
    // deux Passe (texte vrai pour chaque main) ; la 1re donne aussi l'explication d'une Passe dans le tableau
    o.push(opt('P', M('Passe', { fiche: F, text: 'Barrage au palier de 4 : sans jeu fort (16 points HL), on passe.' }), h => HL(h) < 16));
    o.push(pass(`Jeu fort, mais ni 6 cartes à nommer ni 2 cartes au plus à ${nm(os)} pour contrer : on passe.`));
    return o;
  }
  // 1. Se taire : les adversaires sont à la manche ou plus haut
  if (lv >= gameLevelOf(ld)) return pass2('Les adversaires sont à la manche : on se tait et on prépare l\'entame.',
    'Jeu fort, mais les adversaires sont déjà à la manche : la fiche ne prévoit pas d\'enchère ici. On se tait et on prépare l\'entame.');
  // 4. Ouverture forte adverse (2♣, 2♦, 2SA) : seulement une belle couleur, au 1er tour (adversaires au palier de 2)
  if (/^(2C|2D|2N)/.test(c.s)) {
    if (firstTurn && lv <= 2) {
      const list = free.filter(s => pal(s) <= 3);
      for (const x of pick(list, (h, s) => L(h, s) >= (pal(s) === 3 ? 7 : 6) && bigHonors(h, s) >= 2 && HL(h) >= 10)) {
        const s = DEN_SUIT[denOf(x.call)], n = pal(s) === 3 ? 7 : 6;
        x.m = M('Belle couleur sur une ouverture forte', { pts: [10, 37], unit: 'HL', len: ln({ [dn(s)]: [n, 13] }), fiche: F,
          text: `Belle couleur de ${n} cartes à ${nm(s)} avec 2 gros honneurs : pour indiquer l'entame au partenaire.` });
        o.push(x);
      }
    }
    if (lv >= 3) o.push(...haut3());
    else o.push(pass('Ouverture forte adverse : on se tait, sauf belle couleur au 1er tour.'));
    return o;
  }
  // 1. Se taire : ouverture de 1SA suivie d'une réponse, adversaires au palier de 3
  if (/^1N/.test(c.s)) return [
    opt('P', M('Passe', { fiche: F, text: 'Ouverture de 1SA : les adversaires ont la majorité des points. Le Landy (fiche 17) se fait seulement juste après le 1SA ; ici, on se tait.' }),
      h => hcp(h) <= 12),
    pass('Ouverture de 1SA : le Landy (fiche 17) se fait seulement juste après le 1SA ; ici, on se tait.')];
  if (lv >= 3) return haut3();

  // contre d'appel (comme la fiche 10) : 2 cartes au plus dans leur couleur (celle de leur dernière enchère) et les
  // couleurs libres : 4 cartes au moins dans chacune s'il en reste 2, 3 cartes au moins s'il en reste 3.
  // Dès 18 HL (fiche 10), toute distribution, toujours avec 2 cartes au plus dans leur couleur (x18).
  const need = free.length === 2 ? 4 : 3;
  const xShape = h => free.every(s => L(h, s) >= need) && L(h, ls) <= 2;
  const x18 = h => HL(h) >= 18 && L(h, ls) <= 2;
  // avec 18 HL et plus, le contre est-il possible ? (sinon, la couleur directe)
  const xOk18 = h => free.length >= 2 && ls >= 0 && L(h, ls) <= 2;
  // longueurs vraies pour toutes les mains du contre (forme ou 18 HL) : 2 cartes au plus dans leur couleur
  const xLen = () => ln({ [ld]: [0, 2] });
  const freeTxt = free.map(s => nm(s)).join(', ').replace(/, ([^,]*)$/, ' et $1');
  const xTxt = () => `au plus 2 cartes à ${nm(ls)} et au moins ${need} cartes à ${freeTxt} (ou 18 HL et plus)`;
  // main forte (18 HL et plus) qui ne peut pas contrer : 3 cartes ou plus dans leur couleur
  const strongNoX = ls >= 0 ? `Main forte (18 HL et plus), mais pas de contre avec 3 cartes ou plus à ${nm(ls)} (leur couleur)` : '';
  // fit adverse : une couleur nommée par l'ouvreur et par son partenaire
  const oppSeats = [c.opener, (c.opener + 2) % 4];
  const fitOf = s => oppSeats.every(p => c.calls.some(x => x.seat === p && /^[1-7][CDHS]$/.test(x.call) && DEN_SUIT[denOf(x.call)] === s));
  const oppFit = named.some(fitOf);

  // 3. Le réveil : les adversaires ont un fit et s'arrêtent au palier de 2. On prête un Roi au partenaire :
  //    environ 3 points de moins que la valeur d'ouverture (13 HL), donc 10 HL. Avec 18 HL et plus, on contre ;
  //    la couleur seulement si le contre est impossible (comme la fiche 10).
  if (reveil && lv === 2 && ls >= 0 && fitOf(ls)) {
    for (const x of pick(free.filter(s => pal(s) === 2), (h, s) => L(h, s) >= 5 && HL(h) >= 10 && (HL(h) <= 17 || !xOk18(h)))) {
      const s = DEN_SUIT[denOf(x.call)];
      x.m = M('Réveil à la couleur', { pts: [10, 37], unit: 'HL', len: ln({ [dn(s)]: [5, 13] }), fiche: F,
        text: `Réveil : au moins 5 cartes à ${nm(s)} et 10 points HL ou plus. Les adversaires ont un fit et s'arrêtent : on prête un Roi au partenaire.` });
      o.push(x);
    }
    if (free.length >= 2) o.push(opt('X', M('Contre de réveil', { pts: [10, 37], unit: 'HL', len: xLen(), forcing: 1, fiche: F,
      text: `Contre d'appel de réveil : 10 points HL ou plus (on prête un Roi au partenaire), ${xTxt()}. Le partenaire répond comme à un contre d'appel.` }),
      h => (HL(h) >= 10 && xShape(h)) || x18(h)));
    for (const x of pick(free.filter(s => pal(s) === 3), (h, s) => L(h, s) >= 6 && HL(h) >= 10 && (HL(h) <= 17 || !xOk18(h)))) {
      const s = DEN_SUIT[denOf(x.call)];
      x.m = M('Réveil à la couleur', { pts: [10, 37], unit: 'HL', len: ln({ [dn(s)]: [6, 13] }), fiche: F,
        text: `Réveil au palier de 3 : au moins 6 cartes à ${nm(s)} et 10 points HL ou plus (on prête un Roi au partenaire).` });
      o.push(x);
    }
    o.push(opt('P', M('Passe', { fiche: F, text: 'Moins de 10 points HL : pas de réveil, on laisse jouer les adversaires.' }), h => HL(h) < 10));
    if (free.length >= 2) o.push(opt('P', M('Passe', { fiche: F, text: strongNoX +
      ', ni 5 cartes à nommer au palier de 2, ni 6 cartes au palier de 3 : on laisse jouer les adversaires.' }), h => HL(h) >= 18));
    o.push(pass('Ni couleur de 5 cartes à nommer au palier de 2, ni 6 cartes au palier de 3, ni la forme du contre d\'appel : on laisse jouer les adversaires.'));
    return o;
  }
  // 1. Juste après leur soutien au palier de 2 (1♠ P 2♠ ?) : comme la fiche 10, avec la valeur d'ouverture (13 HL).
  //    Le réveil, lui, sera pour le partenaire.
  if (oppFit && !reveil && lv === 2 && ls >= 0 && fitOf(ls) && c.st.lastBidSeat === (c.seat + 3) % 4) {
    // belle couleur : au palier de 2, 6 cartes solides ou 5 cartes avec 3 honneurs ; au palier de 3, 6 cartes solides
    const nice = (h, s) => (L(h, s) >= 6 && robust(h, s)) || (pal(s) === 2 && L(h, s) === 5 && honors(h, s) >= 3);
    // avec 18 HL et plus, on contre (fiche 10) ; la couleur seulement si le contre est impossible
    const canX = h => free.length >= 2 && L(h, ls) <= 2;
    for (const x of pick(free.filter(s => pal(s) <= 3), (h, s) => HL(h) >= 13 && (HL(h) <= 17 || !canX(h)) && nice(h, s))) {
      const s = DEN_SUIT[denOf(x.call)], n = pal(s) === 3 ? 6 : 5;
      x.m = M('Intervention après leur soutien', { pts: [13, 37], unit: 'HL', len: ln({ [dn(s)]: [n, 13] }), fiche: F,
        text: `Juste après leur soutien, comme la fiche 10 : valeur d'ouverture (13 HL et plus) et belle couleur à ${nm(s)}` +
          (n === 6 ? ' : 6 cartes au palier de 3.' : ' : 6 cartes, ou 5 cartes avec 3 honneurs.') });
      o.push(x);
    }
    if (free.length >= 2) o.push(opt('X', M('Contre d\'appel après leur soutien', { pts: [13, 37], unit: 'HL', len: ln({ [ld]: [0, 2] }), forcing: 1, fiche: F,
      text: `Juste après leur soutien, comme la fiche 10 : au plus 2 cartes à ${nm(ls)}, et 13 HL avec au moins ${need} cartes à ${freeTxt} (ou 18 HL et plus). Le partenaire choisit sa couleur.` }),
      h => canX(h) && ((HL(h) >= 13 && xShape(h)) || HL(h) >= 18)));
    o.push(opt('P', M('Passe', { fiche: F, text: 'Les adversaires ont un fit : sans la valeur d\'ouverture (13 HL), on passe. Le partenaire pourra se réveiller.' }),
      h => HL(h) < 13));
    if (free.length >= 2) o.push(opt('P', M('Passe', { fiche: F, text: strongNoX +
      ', et pas de belle couleur à nommer : on passe. Le partenaire pourra se réveiller.' }), h => HL(h) >= 18));
    o.push(pass('Valeur d\'ouverture, mais ni belle couleur ni la forme du contre d\'appel : on passe. Le partenaire pourra se réveiller.'));
    return o;
  }
  // 1. Se taire : adversaires fittés qui enchérissent encore, ou 1er tour (il faudrait parler au palier de 3)
  if (oppFit) return [pass(reveil ? 'Les adversaires ont un fit mais ne s\'arrêtent pas au palier de 2 dans leur couleur : pas de réveil, on passe.'
    : 'Les adversaires ont un fit et enchérissent encore : on passe.')];
  if (firstTurn) return [pass('Il faudrait intervenir au palier de 3 : on se tait.')];

  // 2. Intervenir plus tard (2e tour, adversaires sans fit au palier de 1 ou 2) : valeur d'ouverture
  // avec 18 HL et plus, on contre ; la couleur seulement si le contre est impossible (comme la fiche 10)
  const good = (h, s) => (L(h, s) >= 6 && honors(h, s) >= 2) || (L(h, s) === 5 && honors(h, s) >= 3);
  for (const x of pick(free.filter(s => pal(s) <= 2), (h, s) => HL(h) >= 12 && (HL(h) <= 17 || !xOk18(h)) && good(h, s))) {
    const s = DEN_SUIT[denOf(x.call)];
    x.m = M('Intervention différée', { pts: [12, 37], unit: 'HL', len: ln({ [dn(s)]: [5, 13] }), fiche: F,
      text: `Valeur d'ouverture (12 HL et plus) et belle couleur à ${nm(s)} : 6 cartes avec 2 honneurs, ou 5 cartes avec 3 honneurs.` });
    o.push(x);
  }
  if (free.length >= 2 && ls >= 0) o.push(opt('X', M('Contre d\'appel différé', { pts: [12, 37], unit: 'HL', len: xLen(), forcing: 1, fiche: F,
    text: `Valeur d'ouverture (12 HL et plus), ${xTxt()}. Le partenaire choisit sa couleur.` }),
    h => (HL(h) >= 12 && xShape(h)) || x18(h)));
  o.push(opt('P', M('Passe', { fiche: F, text: reveil ? 'Les adversaires n\'ont pas de fit : pour parler, il faut la valeur d\'ouverture (12 HL). Ici, on passe.'
    : 'Il faut la valeur d\'ouverture (12 HL) pour parler : on se tait.' }), h => HL(h) < 12));
  if (free.length >= 2 && ls >= 0) o.push(opt('P', M('Passe', { fiche: F, text: strongNoX +
    ', et pas de belle couleur à nommer au palier de 2 : on passe.' }), h => HL(h) >= 18));
  else if (ls < 0) o.push(opt('P', M('Passe', { fiche: F, text: 'Main forte (18 HL et plus), mais pas de belle couleur à nommer au palier de 2, ' +
    'et on ne contre pas ainsi un Sans-Atout : on passe.' }), h => HL(h) >= 18));
  o.push(pass('Valeur d\'ouverture, mais pas de belle couleur à nommer au palier de 2' +
    (ls >= 0 ? ' ni la forme du contre d\'appel : on passe.' : ' (on ne contre pas un Sans-Atout) : on passe.')));
  return o;
};
})();
