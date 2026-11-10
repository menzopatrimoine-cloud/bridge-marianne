/* Bridge — apprendre : mini-bridge, cours pas à pas (d'après les fiches du prof) et donnes commentées.
   Les donnes sont retrouvées à partir d'un numéro (js/lecons-data.js, fabriqué et vérifié par tests/lecons-gen.js). */
var B = globalThis.B = globalThis.B || {};
(function () {
'use strict';
const { suitOf, rankOf, sideOf, partnerOf, DEN_SUIT } = B;
const SYM = '♠♥♦♣', DENS = ['S', 'H', 'D', 'C'], NOM = ['pique', 'cœur', 'carreau', 'trèfle'];

/* ---------- Une donne à partir de son numéro ---------- */
function seeded(seed) { let s = seed; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x80000000; }; }
function dealOf(seed) {
  return { hands: B.randomHands(seeded(seed)), dealer: seed % 4, vul: ['-', 'NS', 'EO', 'T'][(seed >> 2) % 4] };
}

/* ---------- Mini-bridge : pas d'enchères, on compte les points et on choisit le contrat ---------- */
const THEMES = [
  { id: 'contrat', titre: 'Le contrat', resume: 'Compter ses points, savoir qui joue et choisir entre partielle et manche à Sans-Atout.',
    lecons: [
      { id: 'points', titre: 'Compter ses points', resume: 'Ce que vaut votre main.',
        corps: [['Les honneurs', 'As = <b>4</b> points, Roi = <b>3</b>, Dame = <b>2</b>, Valet = <b>1</b>. Ce sont les « points H ».'],
          ['Le total', 'Le jeu complet vaut <b>40 points</b>. Une main moyenne a donc 10 points.'],
          ['À quoi ça sert', 'Plus votre camp a de points, plus il peut promettre de plis.']] },
      { id: 'qui', titre: 'Qui joue le contrat ?', resume: 'Le camp le plus fort prend la main.',
        corps: [['Le camp', 'On additionne les points des deux partenaires. Le camp qui a <b>le plus de points</b> joue le contrat.'],
          ['Le déclarant', 'Dans ce camp, celui qui a le plus de points est le <b>déclarant</b>. Son partenaire étale ses cartes : c\'est le <b>mort</b>, et le déclarant joue les deux mains.'],
          ['L\'entame', 'C\'est le joueur à gauche du déclarant qui joue la première carte.']] },
      { id: 'manche', titre: 'Partielle ou manche ?', resume: 'Combien de plis promettre.',
        corps: [['Sans-Atout', 'Sans fit en majeure, on joue à Sans-Atout : aucune couleur ne coupe.'],
          ['La partielle', 'Moins de 25 points dans le camp : on joue <b>1 SA</b>, il faut 7 plis.'],
          ['La manche', 'À partir de <b>25 points</b> dans le camp : on joue <b>3 SA</b>, il faut 9 plis.']] },
    ] },
  { id: 'atout', titre: 'L\'atout', resume: 'Découvrir la force de l\'atout et choisir entre l\'atout et le Sans-Atout.',
    lecons: [
      { id: 'force', titre: 'La force de l\'atout', resume: 'Une petite carte peut battre un As.',
        corps: [['Couper', 'Quand on n\'a plus de cartes dans la couleur jouée, on peut jouer un <b>atout</b> : même un petit atout bat l\'As des autres couleurs.'],
          ['Faire tomber les atouts', 'Le déclarant joue atout dès qu\'il a la main, pour que les adversaires n\'en aient plus. Il garde ses atouts du mort s\'il a besoin d\'y couper.']] },
      { id: 'choisir', titre: 'Choisir son contrat à l\'atout', resume: 'Le fit de 8 cartes.',
        corps: [['Le fit', 'Si votre camp a <b>8 cartes ou plus</b> à cœur ou à pique, cette couleur sera l\'atout.'],
          ['La partielle', 'Moins de 25 points : <b>2♥ ou 2♠</b>, il faut 8 plis.'],
          ['La manche', 'À partir de <b>25 points</b> : <b>4♥ ou 4♠</b>, il faut 10 plis.'],
          ['Sinon', 'Sans 8 cartes en majeure, on préfère le Sans-Atout.']] },
    ] },
  { id: 'defense', titre: 'La défense', resume: 'Entamer, aider son partenaire et faire chuter le contrat.',
    lecons: [
      { id: 'entame', titre: 'L\'entame', resume: 'Bien choisir la première carte.',
        corps: [['À Sans-Atout', 'Entamez dans votre couleur la plus longue, ou en tête d\'une séquence d\'honneurs (Roi de Roi-Dame-Valet).'],
          ['À l\'atout', 'As-Roi d\'une couleur, un singleton, la couleur du partenaire ou une séquence d\'honneurs.']] },
      { id: 'partenaire', titre: 'Aider son partenaire', resume: 'Jouer à deux contre le déclarant.',
        corps: [['En 2e position', 'Petite carte sur la carte de l\'adversaire.'],
          ['En 3e position', 'Votre plus forte carte sur celle de votre partenaire.'],
          ['Quand vous prenez la main', 'Rejouez la couleur d\'entame de votre partenaire.']] },
    ] },
];
function miniInfo(hands) {
  const pts = hands.map(B.hcp), ns = pts[0] + pts[2], eo = pts[1] + pts[3], side = ns > eo ? 0 : 1;
  const a = side === 0 ? 2 : 1, b = side === 0 ? 0 : 3;
  return { pts, ns, eo, side, declarer: pts[b] > pts[a] ? b : a };
}
// le contrat conseillé : 8 cartes en majeure = atout, sinon Sans-Atout ; manche à partir de 25 points
function miniAdvice(hands, decl) {
  const a = hands[decl], b = hands[partnerOf(decl)], total = B.hcp(a) + B.hcp(b);
  const len = s => a.concat(b).filter(c => suitOf(c) === s).length;
  const tr = [0, 1].filter(s => len(s) >= 8).sort((x, y) => len(y) - len(x))[0];
  const den = tr == null ? 'N' : DENS[tr], manche = total >= 25;
  return { level: den === 'N' ? (manche ? 3 : 1) : (manche ? 4 : 2), den, dbl: 0, declarer: decl, total, trumps: tr == null ? 0 : len(tr), manche };
}
// le palier d'un contrat au mini-bridge, selon la couleur et l'ambition
function miniLevel(den, manche) {
  if (den === 'N') return manche ? 3 : 1;
  return manche ? (den === 'S' || den === 'H' ? 4 : 5) : 2;
}

/* ---------- Le cours pas à pas : un chapitre par thème des fiches ---------- */
const CHAPITRES = [
  { id: 'c1', titre: 'Compter ses points et ouvrir', fiches: ['01', '02'], type: 'bid',
    points: ['As 4, Roi 3, Dame 2, Valet 1 : ce sont les points H. On ajoute 1 point à partir de la 5e carte d\'une couleur (points HL).', 'On ouvre à partir de 12 points H ou 13 HL.', 'Priorité à une majeure de 5 cartes ou plus. Sinon, la meilleure mineure.'] },
  { id: 'c2', titre: 'Ouvrir de 1 SA ou de 2 SA', fiches: ['02', '11'], type: 'bid',
    points: ['1 SA : 15 à 17 points H, main régulière (4-3-3-3, 4-4-3-2 ou 5-3-3-2), sans majeure de 5 cartes.', '2 SA : 20 ou 21 points H, main régulière.'] },
  { id: 'c3', titre: 'Répondre à l\'ouverture', fiches: ['03', '04', '15'], type: 'bid',
    points: ['Jusqu\'à 5 points, on passe, sauf si points H + cartes de la couleur font 9 ou plus (règle des 9) : on annonce alors cette couleur au palier de 1.', 'À partir de 6 points : on soutient, on nomme une couleur ou on dit Sans-Atout.', 'Sur une majeure, le soutien passe d\'abord (3 cartes). Sur une mineure, on cherche d\'abord une majeure.'] },
  { id: 'c4', titre: 'La 2e enchère de l\'ouvreur', fiches: ['05'], type: 'bid',
    points: ['Si le partenaire a changé de couleur, il faut reparler.', 'Priorité à un contrat à 8 atouts en majeure.', 'On additionne les points du camp pour décider : passer, proposer ou conclure à la manche.'] },
  { id: 'c5', titre: 'Le Stayman', fiches: ['11', '14'], type: 'bid',
    points: ['Sur 1 SA, 2♣ demande à l\'ouvreur s\'il a 4 cartes à cœur ou à pique.', 'Il faut au moins 8 points et une majeure de 4 cartes.', 'L\'ouvreur répond 2♦ (aucune), 2♥, 2♠ ou 2 SA (les deux).'] },
  { id: 'c6', titre: 'Le Texas', fiches: ['14', '04'], type: 'bid',
    points: ['Sur 1 SA, 2♦ annonce 5 cœurs, 2♥ annonce 5 piques.', '2♠ annonce 6 trèfles, 3♣ annonce 6 carreaux.', 'L\'ouvreur dit la couleur demandée : c\'est lui qui jouera le contrat.'] },
  { id: 'c7', titre: 'Les ouvertures faibles de 2♥ et 2♠', fiches: ['06'], type: 'bid',
    points: ['6 à 10 points H avec une belle couleur de 6 cartes.', 'Le partenaire passe, soutient pour gêner, ou demande des précisions avec 2 SA.'] },
  { id: 'c8', titre: 'Les barrages', fiches: ['12'], type: 'bid',
    points: ['6 à 10 points H et une couleur très longue : 7 cartes au palier de 3, 8 cartes au palier de 4.', 'Le but : gêner les adversaires.'] },
  { id: 'c9', titre: 'Les ouvertures fortes', fiches: ['07', '08'], type: 'bid',
    points: ['2♣ : main forte (forcing un tour). Le partenaire répond 2♦ dans la plupart des cas.', '2♦ : au moins 24 points HL, forcing de manche.'] },
  { id: 'c10', titre: 'Intervenir sur l\'ouverture adverse', fiches: ['10'], type: 'bid',
    points: ['Au palier de 1 : au moins 5 cartes dans la couleur.', '1 SA : 16 à 18 points, main régulière et arrêt dans la couleur adverse.'] },
  { id: 'c11', titre: 'Le contre d\'appel', fiches: ['10', '13'], type: 'bid',
    points: ['Le contre montre une ouverture, une courte dans la couleur adverse et du soutien dans les autres.', 'Le partenaire du contreur doit répondre, même faible.'] },
  { id: 'c12', titre: 'Jouer le contrat', fiches: ['09'], type: 'play',
    points: ['Avant de jouer : comptez vos plis (Sans-Atout) ou vos perdantes (atout).', 'À l\'atout, faites tomber les atouts sauf si vous avez besoin de couper.', 'À Sans-Atout, affranchissez une couleur longue avant d\'encaisser les autres.'] },
  { id: 'c13', titre: 'Défendre', fiches: ['09'], type: 'play',
    points: ['Choisissez bien votre entame.', 'Petite carte en 2e position, forte carte en 3e position.', 'Rejouez la couleur d\'entame du partenaire.'] },
];

/* ---------- Donnes commentées ---------- */
const NIVEAUX = [['init', 'Initiation'], ['facile', 'Facile'], ['moyen', 'Moyen'], ['conf', 'Confirmé']];

/* ---------- Accès aux donnes ---------- */
const seeds = () => B.LECONS_SEEDS;
function list(kind, group) {
  if (kind === 'comm') return seeds().comm;
  return seeds()[group] || [];
}
const count = (kind, group) => list(kind, group).length;
function seedOf(kind, group, i) { const x = list(kind, group)[i]; return Array.isArray(x) ? x[0] : x; }
const chapitre = id => CHAPITRES.find(c => c.id === id);
const theme = id => THEMES.find(t => t.id === id);
function labelOf(kind, group, i) {
  if (kind === 'mini') return `Mini-bridge · ${theme(group).titre} · donne ${i + 1}`;
  if (kind === 'cours') return `Chapitre ${CHAPITRES.findIndex(c => c.id === group) + 1} · donne ${i + 1}`;
  return `Donne commentée n° ${i + 1}`;
}

/* ---------- Le commentaire d'une donne, calculé à partir des cartes ---------- */
const sideCards = (hands, decl) => hands[decl].concat(hands[partnerOf(decl)]);
function topTricks(hands, decl, s) {
  const a = hands[decl].filter(c => suitOf(c) === s), b = hands[partnerOf(decl)].filter(c => suitOf(c) === s);
  const ours = new Set(a.concat(b).map(rankOf));
  let n = 0;
  for (let r = 12; r >= 0 && ours.has(r); r--) n++;
  return Math.min(n, Math.max(a.length, b.length));
}
function planOf(hands, ct) {
  const decl = ct.declarer, need = ct.level + 6, all = sideCards(hands, decl);
  const len = s => all.filter(c => suitOf(c) === s).length;
  if (ct.den === 'N') {
    const tops = [0, 1, 2, 3].map(s => topTricks(hands, decl, s)), sure = tops.reduce((x, y) => x + y, 0);
    const detail = [0, 1, 2, 3].filter(s => tops[s]).map(s => `${tops[s]} à ${SYM[s]}`).join(', ');
    const out = [`Il faut ${need} plis. Levées sûres : ${sure}${detail ? ' (' + detail + ')' : ''}.`];
    if (sure >= need) out.push('Vous avez assez de levées : encaissez-les, en commençant par les honneurs de la main courte.');
    else {
      const best = [0, 1, 2, 3].slice().sort((x, y) => (len(y) - tops[y] * 0.1) - (len(x) - tops[x] * 0.1))[0];
      out.push(`Il manque ${need - sure} pli${need - sure > 1 ? 's' : ''}. Cherchez-les dans votre couleur longue, ${SYM[best]} (${len(best)} cartes dans le camp) : affranchissez-la avant d'encaisser les autres couleurs, et gardez une reprise pour y revenir.`);
    }
    return out;
  }
  const tr = DEN_SUIT[ct.den], a = hands[decl], b = hands[partnerOf(decl)];
  const count = (h, s) => h.filter(c => suitOf(c) === s).length;
  const longH = count(b, tr) > count(a, tr) ? b : a, shortH = longH === a ? b : a;
  const ours = new Set(all);
  let losers = 0;
  const lost = [];
  for (let s = 0; s < 4; s++) {
    const cards = longH.filter(c => suitOf(c) === s).sort((x, y) => rankOf(y) - rankOf(x));
    let n = 0;
    for (let k = 0; k < Math.min(3, cards.length); k++) if (!ours.has(s * 13 + (12 - k))) n++;
    if (n) { losers += n; lost.push(`${n} à ${SYM[s]}`); }
  }
  const allowed = 13 - need;
  const out = [`À ${SYM[tr]}, votre camp a ${len(tr)} atouts. Il faut ${need} plis : vous pouvez perdre ${allowed} pli${allowed > 1 ? 's' : ''}.`,
    `Perdantes de la main longue : ${losers}${lost.length ? ' (' + lost.join(', ') + ')' : ''}.`];
  if (losers <= allowed) out.push('Le compte y est : jouez atout dès que vous avez la main, puis encaissez vos levées.');
  else {
    const ruff = [0, 1, 2, 3].filter(s => s !== tr && count(shortH, s) < count(longH, s) && count(shortH, tr) > 0);
    const disc = [0, 1, 2, 3].filter(s => s !== tr && count(shortH, s) > count(longH, s) && topTricks(hands, decl, s) > count(longH, s));
    out.push(`Il faut éliminer ${losers - allowed} perdante${losers - allowed > 1 ? 's' : ''}.`);
    if (ruff.length) out.push(`Pensez à couper dans la main courte à ${ruff.map(s => SYM[s]).join(' ou ')}, avant de faire tomber tous les atouts.`);
    if (disc.length) out.push(`Vous pouvez défausser des perdantes sur les levées à ${disc.map(s => SYM[s]).join(' ou ')} de la main courte.`);
    if (!ruff.length && !disc.length) out.push('Cherchez une impasse ou une couleur à affranchir.');
  }
  return out;
}
function leadOf(g) {
  if (!g.contract) return null;
  const st = B.newPlay(g.hands, g.contract);
  st.auction = g.auction.slice();
  st.dealer = g.dealer;
  const seat = st.turn, r = B.chooseCard(st, seat, { samples: 2 });
  return { seat, card: r.card, reason: r.reason };
}
function comment(g) {
  const pts = g.hands.map(B.hcp);
  const bids = g.auction.map((c, i) => ({ seat: (g.dealer + i) % 4, call: c, m: B.explain(g.auction, g.dealer, i) }));
  return { pts, ns: pts[0] + pts[2], eo: pts[1] + pts[3], bids, plan: g.contract ? planOf(g.hands, g.contract) : null, lead: leadOf(g) };
}

B.lecons = { THEMES, CHAPITRES, NIVEAUX, dealOf, seedOf, count, list, labelOf, chapitre, theme, miniInfo, miniAdvice, miniLevel, comment, planOf, NOM };
})();
