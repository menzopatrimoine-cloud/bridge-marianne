/* Bridge — missions : des fins de donne à réussir, de plus en plus difficiles.
   Deux parcours : « Faire les plis » (vous êtes déclarant) et « Empêcher les plis » (vous êtes en défense).
   Chaque mission reprend une fin de donne (4 à 8 cartes par joueur) : les robots y jouent parfaitement
   (calcul exact, cartes visibles), la mission ne se réussit donc qu'avec le bon plan de jeu.
   Toutes les missions sont vérifiées par tests/missions-verif.js : réussissables, avec au moins un piège. */
var B = globalThis.B = globalThis.B || {};
(function () {
'use strict';
const { suitOf, rankOf, sideOf, partnerOf } = B;

// mains écrites « ♠.♥.♦.♣ », honneurs à la française : A R D V 10
const RK = { A: 12, R: 11, D: 10, V: 9, T: 8, 9: 7, 8: 6, 7: 5, 6: 4, 5: 3, 4: 2, 3: 1, 2: 0 };
const SEAT = { N: 0, E: 1, S: 2, O: 3 };
const SUIT = { '♠': 0, '♥': 1, '♦': 2, '♣': 3 };
function parseHand(str) {
  return str.replace(/10/g, 'T').split('.').flatMap((part, s) => part.split('').filter(ch => RK[ch] != null).map(ch => s * 13 + RK[ch]));
}
// « ♥4 » → carte
function parseCard(str) {
  const s = SUIT[str[0]];
  return s * 13 + RK[str.slice(1).replace('10', 'T')];
}

/* ---------- Les missions ----------
   contrat : palier + couleur (P, C, K, T ou SA) ; declarant : N, E, S ou O
   deja : plis déjà faits [Nord-Sud, Est-Ouest] avant la fin de donne
   entame : qui joue la première carte (ou pli : cartes déjà posées dans le pli en cours) */
const MISSIONS = [
  // ===== Faire les plis : vous êtes déclarant (Sud), Nord est le mort =====
  {
    id: 'd1', parcours: 'decl', theme: 'communications', niveau: 1, titre: 'Gardez une reprise',
    contrat: '3SA', declarant: 'S', deja: [4, 4], entame: 'S',
    mains: { N: 'AR.432..', E: '876.RD..', S: 'DVT9.A..', O: '5432.V..' },
    histoire: 'Vos piques sont tous maîtres, mais le mort n\'en a que deux : l\'As et le Roi.',
    astuce: 'Comptez vos levées : 4 piques et l\'As de cœur. L\'As de cœur est votre seul moyen de revenir dans votre main : gardez-le.',
    lecon: 'Jouez d\'abord les piques en passant par l\'As et le Roi du mort, puis revenez dans votre main avec l\'<b>As de cœur</b> pour encaisser vos derniers piques. Si vous jouez l\'As de cœur trop tôt, vos piques restent bloqués : c\'est la « reprise » de la fiche.',
  },
  {
    id: 'd2', parcours: 'decl', theme: 'impasses', niveau: 1, titre: 'L\'impasse',
    contrat: '3SA', declarant: 'S', deja: [5, 4], entame: 'S',
    mains: { N: 'AD.A..2', E: '76.V..D', S: '32.3..A', O: 'R5.D..R' },
    histoire: 'Le mort a As-Dame de pique. Le Roi est chez un adversaire : il faut le capturer.',
    astuce: 'Jouez petit pique de votre main <b>vers</b> l\'As-Dame du mort. Si Ouest ne met pas le Roi, mettez la Dame : c\'est l\'impasse.',
    lecon: 'L\'<b>impasse</b> : on joue <b>vers</b> l\'As-Dame. Ouest, qui a le Roi, joue avant le mort : la Dame fait le pli, puis l\'As fait tomber le Roi. Jouer l\'As puis la Dame depuis le mort perd contre le Roi d\'Ouest.',
  },
  {
    id: 'd3', parcours: 'decl', theme: 'atout', niveau: 2, titre: 'Faites tomber les atouts',
    contrat: '4P', declarant: 'S', deja: [5, 3], entame: 'S',
    mains: { N: '32..432.', E: 'D5.7.RD.', S: 'AR4.AR..', O: '.DVT9.A.' },
    histoire: 'Il reste deux atouts chez les adversaires, et vous avez As-Roi de cœur à encaisser.',
    astuce: 'Jouez atout avec vos gros atouts : l\'As et le Roi de pique font tomber les atouts adverses. Ensuite seulement, encaissez vos cœurs.',
    lecon: 'Si vous jouez vos deux cœurs avant de faire tomber les atouts, Est coupe le 2e cœur. Et si vous jouez le petit atout, Est le prend. La fiche le dit : <b>jouer atout dès la prise de main</b>, avec les gros atouts.',
  },
  {
    id: 'd4', parcours: 'decl', theme: 'atout', niveau: 2, titre: 'Coupez chez le mort',
    contrat: '4C', declarant: 'S', deja: [5, 3], entame: 'S',
    mains: { N: '32.43.2.', E: '5.VT9..R', S: 'A.ARD..2', O: 'DV..AR.A' },
    histoire: 'Votre 2 de trèfle est perdant… mais le mort n\'a plus de trèfle, et il a deux petits atouts.',
    astuce: 'Servez-vous d\'un petit atout du mort pour couper votre trèfle perdant <b>avant</b> de faire tomber tous les atouts.',
    lecon: 'C\'est l\'exception n° 1 de la fiche : <b>besoin de la coupe avec les atouts de la main courte</b>. Jouez trèfle et coupez au mort, puis revenez par l\'As de pique et faites tomber les atouts. Si vous jouez trois tours d\'atout d\'abord, le mort n\'a plus d\'atout pour couper.',
  },
  {
    id: 'd5', parcours: 'decl', theme: 'affranchir', niveau: 3, titre: 'Affranchissez d\'abord',
    contrat: '3SA', declarant: 'S', deja: [4, 3], entame: 'S',
    mains: { N: 'A.2.RDVT.', E: 'DVT9...RD', S: 'R3.A.32.A', O: '.RDV.A54.' },
    histoire: 'Les carreaux du mort sont beaux, mais l\'As de carreau est chez l\'adversaire. Ouest a de bons cœurs.',
    astuce: 'Affranchissez les carreaux tout de suite, pendant que vous avez encore l\'As de cœur pour arrêter les cœurs d\'Ouest.',
    lecon: 'La fiche le dit : <b>affranchir les levées dans une couleur avant d\'encaisser les levées gagnantes</b> des autres couleurs. Si vous encaissez d\'abord vos As, Ouest prend l\'As de carreau et fait ses cœurs.',
  },
  {
    id: 'd6', parcours: 'decl', theme: 'atout', niveau: 3, titre: 'Défaussez avant de jouer atout',
    contrat: '4P', declarant: 'S', deja: [5, 2], entame: 'N',
    mains: { N: '32..AR.54', E: 'A5..43.A9', S: 'RDVT...32', O: '..DVT9.RD' },
    histoire: 'La main est au mort. Il manque l\'As d\'atout, et vos deux trèfles sont perdants.',
    astuce: 'Avant de jouer atout, défaussez vos trèfles perdants sur l\'As et le Roi de carreau du mort.',
    lecon: 'C\'est l\'exception n° 2 de la fiche : <b>besoin de défausse rapide sur des perdantes</b>. Si vous jouez atout d\'abord, l\'adversaire prend l\'As et encaisse ses trèfles.',
  },
  {
    id: 'd7', parcours: 'decl', theme: 'plan', niveau: 4, titre: 'Le plan de jeu à l\'atout',
    contrat: '4C', declarant: 'S', deja: [3, 3], entame: 'S',
    mains: { N: 'AD.43.432.', E: '76.T9.RD.R', S: '32.ARDV..3', O: 'R54..AV.VT' },
    histoire: 'Il vous faut tous les plis qui restent. Comptez vos perdantes avant de jouer.',
    astuce: 'Deux perdantes à éliminer : le 3 de trèfle (coupé au mort) et un pique (par l\'impasse au Roi, en jouant vers l\'As-Dame). Gardez un atout au mort pour la coupe.',
    lecon: 'Le <b>plan de jeu</b> de la fiche : compter les perdantes, puis les éliminer par la coupe et par l\'impasse. Coupez le trèfle au mort, faites l\'impasse au Roi de pique en jouant vers la Dame, et faites tomber les atouts au bon moment.',
  },
  {
    id: 'd8', parcours: 'decl', theme: 'plan', niveau: 5, titre: 'Le grand plan à Sans-Atout',
    contrat: '3SA', declarant: 'S', deja: [2, 3], entame: 'S',
    mains: { N: 'A2.32.RDVT.', E: 'DVT9.RD.A.R', S: 'R3.A54.32.A', O: '87.VT9.654.' },
    histoire: 'Il vous manque des levées. Comptez vos levées, vos communications avec le mort et vos arrêts.',
    astuce: 'Affranchissez les carreaux du mort. Gardez l\'As de pique du mort pour y revenir une fois l\'As de carreau parti.',
    lecon: 'Les trois questions de la fiche : 1) compter les levées (il en manque), 2) les <b>communications</b> avec le mort (l\'As de pique est la seule reprise), 3) les <b>arrêts</b> dans les couleurs adverses. Commencez par les carreaux, en gardant l\'As de pique au mort.',
  },

  // ===== Empêcher les plis : vous êtes en défense (Sud), avec Nord =====
  {
    id: 'f1', parcours: 'def', theme: 'flanc', niveau: 1, titre: 'Encaissez vos levées',
    contrat: '4P', declarant: 'E', deja: [2, 7], entame: 'S',
    mains: { N: '3...RDV', E: 'AR.43..', S: '.AR.3.2', O: '2..ARD.' },
    histoire: 'Les carreaux du mort (Ouest) sont tous maîtres. Vous avez As-Roi de cœur.',
    astuce: 'Si vous laissez la main au mort, Est défaussera ses cœurs sur les carreaux. Encaissez vite ce qui est à vous.',
    lecon: '<b>Encaissez vos levées maîtresses</b> tout de suite : l\'As et le Roi de cœur. Si vous jouez autre chose, le déclarant défausse ses cœurs sur les carreaux du mort.',
  },
  {
    id: 'f2', parcours: 'def', theme: 'flanc', niveau: 1, titre: 'La couleur du partenaire',
    contrat: '3SA', declarant: 'O', deja: [1, 7], entame: 'S',
    mains: { N: '2...RDV9', E: 'DVT.AR..', S: '.5.432.3', O: 'AR..ARD.' },
    histoire: 'Votre partenaire Nord a entamé trèfle au début de la donne. Vous venez de prendre la main.',
    astuce: 'Rejouez la couleur d\'entame de votre partenaire : il a sûrement des trèfles maîtres.',
    lecon: 'La fiche : <b>rejouer dans la couleur d\'entame du partenaire</b>. Nord a Roi-Dame-Valet-9 de trèfle : il fait tous ses trèfles si vous lui donnez la main.',
  },
  {
    id: 'f3', parcours: 'def', theme: 'flanc', niveau: 2, titre: 'Le 3e joue fort',
    contrat: '3SA', declarant: 'O', deja: [3, 5], pli: [['N', '♥4'], ['E', '♥6']],
    mains: { N: '.D93..2', E: '.7.AR.3', S: '.R82..54', O: '.AV5..AR' },
    histoire: 'Votre partenaire Nord joue le 4 de cœur, le mort (Est) fournit le 6. À vous, en 3e position.',
    astuce: 'En 3e position, sur la carte de votre partenaire, jouez votre plus forte carte.',
    lecon: '<b>Plus forte carte en 3e position</b> : votre Roi force l\'As du déclarant, et la Dame de Nord devient maîtresse. Avec le 8, vous laissez le Valet d\'Ouest faire le pli pour rien.',
  },
  {
    id: 'f4', parcours: 'def', theme: 'atout-def', niveau: 2, titre: 'Jouez atout contre la coupe',
    contrat: '4C', declarant: 'O', deja: [2, 5], entame: 'S',
    mains: { N: '5..974.AR', E: '964.32.A.', S: 'A8.54.RV.', O: '.ARDV..94' },
    histoire: 'Le mort (Est) n\'a plus de trèfle et il a deux petits atouts : Ouest compte couper ses deux trèfles perdants au mort.',
    astuce: 'Jouez atout ! Chaque tour d\'atout enlève un atout au mort, qui ne pourra plus couper.',
    lecon: 'La fiche, « casser le jeu adverse » : <b>jouer atout pour éliminer la coupe</b>. Le mort perd ses atouts, et un trèfle d\'Ouest reste perdant pour l\'As-Roi de Nord.',
  },
  {
    id: 'f5', parcours: 'def', theme: 'casser', niveau: 3, titre: 'Le laisser-passer',
    contrat: '3SA', declarant: 'O', deja: [0, 6], pli: [['O', '♦2'], ['N', '♦6'], ['E', '♦R']],
    mains: { N: '.73.87.R3', E: '2..DVT9.5', S: 'A.A4.A54.8', O: '6.D9.3.92' },
    histoire: 'Le mort (Est) a de beaux carreaux mais <b>aucune autre carte maîtresse</b> pour y retourner. Ouest joue le 2 de carreau, Nord fournit le 6, le mort met le Roi. À vous.',
    astuce: 'Ne prenez pas tout de suite avec l\'As : laissez passer. Ouest n\'a plus qu\'un carreau pour retourner au mort.',
    lecon: 'Le <b>laisser-passer</b> de la fiche : en gardant l\'As de carreau pour plus tard, vous coupez le déclarant de son mort, et les carreaux affranchis du mort restent bloqués.',
  },
  {
    id: 'f6', parcours: 'def', theme: 'casser', niveau: 3, titre: 'Coupez les remontées au mort',
    contrat: '3SA', declarant: 'E', deja: [3, 3], entame: 'S',
    mains: { N: '3.V65.A87.', E: '4.D.32.DT4', S: 'DV9..4.873', O: 'A..RDVT96.' },
    histoire: 'Le mort (Ouest) a six carreaux, il lui manque l\'As, et sa seule autre carte maîtresse est l\'As de pique.',
    astuce: 'Attaquez la remontée du mort : jouez pique pour faire partir l\'As de pique tout de suite.',
    lecon: 'La fiche, « casser le jeu adverse » : <b>couper les remontées au mort en jouant dans les couleurs maîtresses du mort</b>. Sans l\'As de pique, le mort ne peut plus faire ses carreaux.',
  },
  {
    id: 'f7', parcours: 'def', theme: 'entame', niveau: 4, titre: 'Entamez en tête de séquence',
    contrat: '4P', declarant: 'E', deja: [2, 4], entame: 'S',
    mains: { N: '6.942.53.V', E: 'AR3.AV3..5', S: 'T.RD7.DT.R', O: '42.86..D84' },
    histoire: 'Vous avez Roi-Dame de cœur : c\'est une séquence d\'honneurs. Le déclarant a peut-être l\'As et le Valet.',
    astuce: 'Entamez en tête de séquence : le Roi de cœur.',
    lecon: 'L\'entame à l\'atout de la fiche : <b>une séquence d\'honneurs</b>, en commençant par le plus fort. Le Roi force l\'As, et la Dame devient maîtresse. Avec un petit cœur, le Valet du déclarant fait le pli.',
  },
  {
    id: 'f8', parcours: 'def', theme: 'entame', niveau: 5, titre: 'L\'entame du singleton',
    contrat: '4C', declarant: 'O', deja: [0, 5], entame: 'S',
    mains: { N: 'D92.2..ART5', E: 'VT8.876.5.D', S: 'A63.A53.8.2', O: 'R5.RDVT9..V' },
    histoire: 'Vous avez un seul trèfle, et l\'As d\'atout pour reprendre la main. Votre partenaire a peut-être des trèfles.',
    astuce: 'À l\'atout, on peut entamer un singleton : si votre partenaire prend la main, il vous rejouera trèfle et vous couperez.',
    lecon: 'L\'entame à l\'atout de la fiche : <b>un singleton</b> (sauf à l\'atout). Nord prend et rejoue trèfle : vous coupez. Votre As d\'atout vous redonne la main au bon moment pour une deuxième coupe.',
  },
];

/* ---------- Les techniques : les missions rangées par thème ----------
   Les 16 premières missions forment « le parcours » (elles s'ouvrent l'une après l'autre) ;
   les missions marquées tech: true ne sont que dans la bibliothèque « Par technique ». */
const THEMES = [
  { k: 'communications', p: 'decl', t: 'Les communications', d: 'Passer d\'une main à l\'autre : garder une reprise, débloquer, couper les liaisons adverses.' },
  { k: 'impasses', p: 'decl', t: 'Les impasses', d: 'Capturer un honneur adverse en jouant vers vos honneurs.' },
  { k: 'atout', p: 'decl', t: 'Le jeu à l\'atout', d: 'Faire tomber les atouts, couper au mort, la double coupe.' },
  { k: 'affranchir', p: 'decl', t: 'Affranchir une couleur', d: 'Céder un pli ou couper pour rendre vos petites cartes maîtresses.' },
  { k: 'securite', p: 'decl', t: 'Le jeu de sécurité', d: 'Se protéger d\'une mauvaise répartition des cartes adverses.' },
  { k: 'fins', p: 'decl', t: 'Les fins de coup', d: 'Les fins de donne : élimination, mise en main, squeeze.' },
  { k: 'plan', p: 'decl', t: 'Le plan de jeu', d: 'Compter, prévoir, puis jouer dans le bon ordre.' },
  { k: 'entame', p: 'def', t: 'L\'entame', d: 'Choisir la première carte de la défense.' },
  { k: 'flanc', p: 'def', t: 'Le jeu en défense', d: 'Le 2e joue petit, le 3e joue fort, couvrir un honneur, encaisser ses levées.' },
  { k: 'casser', p: 'def', t: 'Casser le jeu adverse', d: 'Couper les liaisons du déclarant, prendre ses levées à temps.' },
  { k: 'atout-def', p: 'def', t: 'Les atouts en défense', d: 'Jouer atout, donner la coupe, faire monter un atout, faire couper le déclarant.' },
  { k: 'defausse', p: 'def', t: 'Les défausses', d: 'Garder les bonnes cartes quand on ne peut plus fournir.' },
];

/* ---------- Mise en place ---------- */
function contractOf(m) {
  const level = +m.contrat[0];
  const d = m.contrat.slice(1);
  const den = { P: 'S', C: 'H', K: 'D', T: 'C', SA: 'N' }[d];
  return { level, den, dbl: 0, declarer: SEAT[m.declarant] };
}
function handsOf(m) { return ['N', 'E', 'S', 'O'].map(s => parseHand(m.mains[s])); }
function startState(m) {
  const ct = contractOf(m);
  const st = B.newPlay(handsOf(m), ct);
  const trick = (m.pli || []).map(([s, c]) => ({ seat: SEAT[s], card: parseCard(c) }));
  const leader = trick.length ? trick[0].seat : SEAT[m.entame];
  st.trick = trick;
  st.leader = leader;
  st.turn = (leader + trick.length) % 4;
  st.won = m.deja.slice();
  st.shown = true;          // le mort est déjà étalé
  st.mission = m.id;
  st.auction = []; st.dealer = ct.declarer;
  for (const x of trick) if (suitOf(x.card) !== suitOf(trick[0].card)) st.voids[x.seat][suitOf(trick[0].card)] = true;
  return st;
}
// plis qu'il faut à Nord-Sud dans la fin de donne pour réussir la mission
function goalOf(m) {
  const st = startState(m), ct = contractOf(m);
  const left = st.hands[st.turn].length;
  const side = sideOf(ct.declarer);
  const need = ct.level + 6 - m.deja[side];
  return side === 0 ? need : left - need + 1;
}
// la phrase d'objectif, toujours juste puisqu'elle est calculée
function objectif(m) {
  const st = startState(m), ct = contractOf(m), side = sideOf(ct.declarer);
  const left = st.hands[st.turn].length, goal = goalOf(m);
  const names = ['Nord', 'Est', 'Sud', 'Ouest'];
  const ctTxt = `${ct.level} ${{ S: 'Piques', H: 'Cœurs', D: 'Carreaux', C: 'Trèfles', N: 'Sans-Atout' }[ct.den]}`;
  return side === 0
    ? `Vous jouez <b>${ctTxt}</b> : il faut ${ct.level + 6} plis. Vous en avez déjà fait ${m.deja[0]}. Objectif : <b>faire ${goal} pli${goal > 1 ? 's' : ''} sur les ${left} qui restent</b>.`
    : `${names[ct.declarer]} joue <b>${ctTxt}</b> : il lui faut ${ct.level + 6} plis et il en a déjà ${m.deja[side]}. Objectif : <b>faire ${goal} pli${goal > 1 ? 's' : ''} sur les ${left} qui restent</b>, pour le faire chuter.`;
}
function won(m, st) {
  const ct = contractOf(m), side = sideOf(ct.declarer);
  const decl = st.won[side];
  return side === 0 ? decl >= ct.level + 6 : decl < ct.level + 6;
}

/* ---------- Les robots des missions jouent parfaitement ---------- */
// valeur exacte de chaque carte jouable (plis de Nord-Sud jusqu'à la fin)
function exact(st, seat) {
  const ev = B.dd.makeSolver(st.hands, st.trump, { maxNodes: 6e6 }).evalMoves(st.trick, seat);
  const ns = sideOf(seat) === 0;
  const top = ev.reduce((m, x) => ns ? Math.max(m, x.ns) : Math.min(m, x.ns), ns ? -1 : 99);
  return { ev, top, best: ev.filter(x => x.ns === top).map(x => x.card) };
}
// parmi les meilleures cartes, la plus naturelle : celle que jouerait un bon joueur, sinon la plus petite
function perfectCard(st, seat) {
  const leg = B.legalCards(st, seat);
  if (leg.length === 1) return { card: leg[0], best: leg };
  const { best } = exact(st, seat);
  const h = B.chooseCard(B.cloneState(st), seat, { samples: 4 }).card;
  const card = best.includes(h) ? h : best.slice().sort((a, b) => rankOf(a) - rankOf(b))[0];
  return { card, best, natural: h };
}

B.MISSIONS = MISSIONS;
B.MISSION_THEMES = THEMES;
B.mission = { byId: id => MISSIONS.find(m => m.id === id), contractOf, handsOf, startState, goalOf, objectif, won, exact, perfectCard, parseHand, parseCard };
})();
