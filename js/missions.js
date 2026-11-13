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

  // ===== Par technique : la bibliothèque (toutes ouvertes, rangées par thème) =====
  {
    id: 'com1', parcours: 'decl', theme: 'communications', tech: true, niveau: 2, titre: 'Le déblocage',
    contrat: '3SA', declarant: 'S', deja: [4, 4], entame: 'S',
    mains: { N: '..RDVT9.', E: 'R..87.RD', S: 'A.A.A3.2', O: '.RDV.65.' },
    histoire: 'Le mort n\'a plus que des carreaux : le Roi, la Dame, le Valet, le 10 et le 9. Vous avez l\'As et le 3 de carreau. Pour faire ces carreaux, il faudra que la main passe au mort, et qu\'elle y reste.',
    astuce: 'Jouez d\'abord l\'As de carreau : c\'est l\'honneur de la main courte (celle qui a le moins de carreaux). Ensuite, le 3 de carreau vous emmène au mort, et ses carreaux feront les derniers plis.',
    lecon: 'Le <b>déblocage</b> (libérer le chemin vers le mort) : on joue d\'abord l\'honneur de la main courte, ici l\'As de carreau. Le 3 de carreau passe ensuite au mort, et ses carreaux font les derniers plis. Si vous jouez le 3 d\'abord, votre As doit fournir au tour suivant et prend le pli à la place du mort : vous voilà dans votre main, les carreaux du mort restent bloqués, et il vous manquera un pli.',
    bon: ['♦A'], piege: ['♦3'],
  },
  {
    id: 'com2', parcours: 'decl', theme: 'communications', tech: true, niveau: 3, titre: 'Laissez passer deux fois',
    contrat: '3SA', declarant: 'S', deja: [4, 1], pli: [['O', '♥R'], ['N', '♥3'], ['E', '♥7']],
    mains: { N: '.4.RDVT9.2', E: '.T2.A5.876', S: '.A65.432.AR', O: '.DV98..543' },
    histoire: 'Ouest a annoncé ses cœurs aux enchères : il en a sûrement cinq, donc Est en a trois. Ouest joue maintenant le Roi de cœur, le mort et Est fournissent. Pour faire les carreaux du mort, il faudra chasser l\'As de carreau.',
    astuce: 'Laissez passer les deux premiers tours de cœur et gardez l\'As pour le 3e. Ensuite, jouez carreau pour chasser l\'As : Est, qui n\'a que trois cœurs, ne pourra plus donner la main à Ouest.',
    lecon: 'Le <b>laisser-passer</b> du déclarant (ne pas prendre tout de suite) : laissez passer deux tours de cœur et gardez l\'As pour le 3e tour. Est n\'a que trois cœurs : quand il prend l\'As de carreau, il ne peut plus donner la main à Ouest, car votre As arrête son dernier cœur. Si vous prenez tout de suite (ou au 2e tour), Est prend l\'As de carreau, rejoue cœur, et Ouest encaisse ses cœurs.',
    bon: ['♥6', '♥5'], piege: ['♥A'],
  },
  {
    id: 'imp1', parcours: 'decl', theme: 'impasses', tech: true, niveau: 1, titre: 'Jouez vers le Roi',
    contrat: '3SA', declarant: 'S', deja: [5, 3], entame: 'N',
    mains: { N: 'R3.2.A.3', E: 'V.DV.D.D', S: '54.A.2.A', O: 'A6.R.R.R' },
    histoire: 'Le mort a la main. Il a Roi-3 de pique. Ouest a ouvert les enchères : l\'As de pique est sûrement chez lui.',
    astuce: 'Ne jouez pas le Roi depuis le mort. Passez dans votre main, puis jouez petit pique <b>vers</b> le Roi : Ouest devra jouer avant le mort.',
    lecon: '<b>Jouer vers le Roi</b> : on part de la main d\'en face (ici la vôtre) et on joue petit pique vers le Roi. Ouest joue avant le mort : s\'il met l\'As, votre Roi devient maître ; sinon, le Roi fait le pli tout de suite. Si le mort joue lui-même le Roi, l\'As d\'Ouest le prend.',
    bon: ['♥2'], piege: ['♠R'],
  },
  {
    id: 'imp2', parcours: 'decl', theme: 'impasses', tech: true, niveau: 3, titre: 'La double impasse',
    contrat: '3SA', declarant: 'S', deja: [5, 2], pli: [['S', '♠2'], ['O', '♠5']],
    mains: { N: 'ADT.2.32.', E: '9.RDV..AR', S: '3.A..432', O: 'RV..AR.V' },
    histoire: 'Il vous manque le Roi et le Valet de pique. Vous avez joué le 2 de pique vers As-Dame-10 du mort, et Ouest a fourni le 5. À vous de choisir la carte du mort.',
    astuce: 'Mettez d\'abord le 10. Ensuite, revenez dans votre main par l\'As de cœur et rejouez petit pique vers la Dame.',
    lecon: 'La <b>double impasse</b> (deux impasses de suite) : avec As-Dame-10, on fait d\'abord l\'impasse au 10, puis, revenu dans sa main, l\'impasse à la Dame. Ici Ouest a le Roi et le Valet : le 10 et la Dame font chacun leur pli, et l\'As le troisième. Si vous mettez tout de suite la Dame, elle fait bien le pli, mais Ouest garde alors Roi-Valet face à votre As-10 : à pique, seul l\'As fera encore un pli.',
    bon: ['♠10'], piege: ['♠D'],
  },
  {
    id: 'imp3', parcours: 'decl', theme: 'impasses', tech: true, niveau: 4, titre: 'Répétez l\'impasse',
    contrat: '3SA', declarant: 'S', deja: [3, 3], entame: 'S',
    mains: { N: 'ADV.2.AR.2', E: '9.RDV.D.AR', S: '32.A.32.43', O: 'R76.65.54.' },
    histoire: 'Le mort a As-Dame-Valet de pique, vous avez le 3 et le 2. Vous espérez le Roi de pique chez Ouest, avec deux petits piques : il faudra faire l\'impasse deux fois. Votre seule reprise (le seul moyen de revenir dans votre main) est l\'As de cœur.',
    astuce: 'Chaque impasse part de votre main. Vous y êtes au départ, et l\'As de cœur vous y ramène une fois : gardez ces deux occasions pour jouer petit pique vers l\'As-Dame-Valet du mort.',
    lecon: '<b>Répéter l\'impasse</b> : jouez pique tout de suite et mettez le Valet du mort (il fait le pli), revenez par l\'As de cœur, votre seule <b>reprise</b>, puis rejouez pique vers la Dame ; l\'As fait ensuite tomber le Roi d\'Ouest. Si vous encaissez d\'abord l\'As de cœur, ou si vous partez au mort par les carreaux, vous gaspillez un passage dans votre main : vous ne pourrez plus faire l\'impasse deux fois, et il vous manquera un pli.',
    bon: ['♠2', '♠3'], piege: ['♥A', '♦2'],
  },
  {
    id: 'atu1', parcours: 'decl', theme: 'atout', tech: true, niveau: 3, titre: 'La double coupe',
    contrat: '4P', declarant: 'S', deja: [4, 3], entame: 'S',
    mains: { N: 'DV.543.2.', E: '.T7.9.D85', S: 'A9..AR.43', O: '84.R2.53.' },
    histoire: 'Vous n\'avez plus de cœur et le mort n\'a plus de trèfle : vos atouts peuvent couper des deux côtés. Il reste deux petits atouts chez les adversaires, et vous avez l\'As et le Roi de carreau.',
    astuce: 'Encaissez d\'abord l\'As et le Roi de carreau. Ensuite seulement, coupez chacun son tour : un trèfle au mort, un cœur dans votre main. Ne jouez pas atout : vos atouts servent à couper.',
    lecon: 'La <b>double coupe</b> : on coupe tour à tour dans les deux mains, les trèfles au mort et les cœurs chez vous, mais il faut d\'abord <b>encaisser les levées maîtresses</b> des autres couleurs : l\'As et le Roi de carreau. Si vous coupez tout de suite, Ouest, qui n\'a plus de trèfle, jette un carreau sur votre premier trèfle. Il pourra alors couper un de vos gros carreaux avec un petit atout ; et si vous faites d\'abord tomber ses atouts, il ne vous en restera plus assez pour couper.',
    bon: ['♦A', '♦R'], piege: ['♣4'],
  },
  {
    id: 'atu2', parcours: 'decl', theme: 'atout', tech: true, niveau: 4, titre: 'Perdante sur perdante',
    contrat: '4P', declarant: 'S', deja: [5, 2], pli: [['O', '♣R']],
    mains: { N: '76.DV8.3.', E: '9.74.V62.', S: 'ARDV..5.2', O: '...DT974' },
    histoire: 'Ouest joue le Roi de trèfle. Le mort n\'a plus de trèfle, et Est non plus (il a défaussé au tour précédent). Il reste un seul atout adverse, le 9, et vous avez un petit carreau perdant, le 5.',
    astuce: 'Ce Roi de trèfle fera le pli de toute façon. Ne le coupez pas avec un petit atout du mort : si Est a le 9, il surcoupera. Défaussez plutôt dessus le 3 de carreau du mort, une carte perdante : ensuite, le mort pourra couper votre 5 de carreau.',
    lecon: '<b>Perdante sur perdante</b> (défausser une carte perdante sur un pli déjà perdu) : le Roi de trèfle fait le pli de toute façon, alors défaussez dessus le 3 de carreau du mort. Le mort n\'a plus de carreau : il coupera votre 5 de carreau, et Est, obligé de fournir à carreau, ne pourra pas surcouper. Ici, c\'est Est qui avait le 9 d\'atout : si le mort coupe le trèfle, Est surcoupe, et votre 5 de carreau reste perdant.',
    bon: ['♦3'], piege: ['♠6', '♠7'],
  },
  {
    id: 'atu3', parcours: 'decl', theme: 'atout', tech: true, niveau: 5, titre: 'Le mort inversé',
    contrat: '4P', declarant: 'S', deja: [3, 3], entame: 'S',
    mains: { N: 'DVT.54.R4.', E: '.R.DT98.T2', S: 'A987..A32.', O: '654.V7.V.3' },
    histoire: 'Vous avez quatre atouts, le mort en a trois beaux : la Dame, le Valet et le 10. Il reste trois petits atouts adverses, tous chez Ouest : Est n\'a pas fourni au premier tour d\'atout. Vous n\'avez plus de cœur, le mort en a deux.',
    astuce: 'Coupez les cœurs du mort dans votre main, et gardez les gros atouts du mort pour faire tomber ceux d\'Ouest. Pour aller au mort : le Roi de carreau, ou un petit atout pris par un gros atout du mort. Gardez un petit atout pour chaque passage : s\'il le faut, coupez avec l\'As.',
    lecon: 'Le <b>mort inversé</b> : c\'est vous, la main aux quatre atouts, qui coupez les cœurs du mort, et ce sont les gros atouts du mort qui font tomber ceux d\'Ouest. Vous faites ainsi 5 levées d\'atout au lieu de 4, et votre 3 de carreau part sur la Dame d\'atout du mort. Si vous jouez l\'As d\'atout tout de suite, le mort doit fournir un de ses gros atouts : il ne reste plus assez d\'atouts, et votre 3 de carreau est perdu.',
    bon: ['♦2', '♠7'], piege: ['♠A'],
  },
  {
    id: 'aff1', parcours: 'decl', theme: 'affranchir', tech: true, niveau: 3, titre: 'Coupez pour affranchir',
    contrat: '4P', declarant: 'S', deja: [4, 3], entame: 'S',
    mains: { N: '..AR654.A', E: '.RV9.DV9.', S: 'AR.65.7.4', O: '.AD7.T8.R' },
    histoire: 'Les adversaires n\'ont plus d\'atout. Le mort a As-Roi et trois petits carreaux, et l\'As de trèfle. Vous avez deux cœurs perdants à faire disparaître.',
    astuce: 'Jouez carreau et prenez au mort avec un gros carreau, puis coupez un petit carreau du mort avec un gros atout : ses derniers carreaux deviendront maîtres. Gardez l\'As de trèfle pour retourner au mort.',
    lecon: 'L\'<b>affranchissement par la coupe</b> : vous coupez un petit carreau du mort avec un gros atout, les adversaires n\'ont bientôt plus de carreau, et les derniers carreaux du mort deviennent maîtres. Vous y jetez vos deux cœurs, en revenant au mort par sa <b>reprise</b> (la carte qui permet d\'y retourner) : l\'As de trèfle. Si vous jouez trèfle trop tôt, les carreaux maîtres restent bloqués au mort et un cœur reste perdant.',
    bon: ['♦7'], piege: ['♣4'],
  },
  {
    id: 'aff2', parcours: 'decl', theme: 'affranchir', tech: true, niveau: 3, titre: 'Cédez le premier tour',
    contrat: '3SA', declarant: 'S', deja: [4, 3], entame: 'N',
    mains: { N: '4..A6543.', E: '.RD.RV.DV', S: 'A2.A.82.A', O: 'DVT.V.DT.' },
    histoire: 'La main est au mort. Il a l\'As et quatre petits carreaux, mais aucune autre carte maîtresse pour y revenir. Vous n\'avez que deux carreaux.',
    astuce: 'Cédez d\'abord un tour de carreau, en jouant petit du mort et petit de votre main. Au tour de carreau suivant, prenez avec l\'As du mort : ses petits carreaux seront alors maîtres.',
    lecon: '<b>Céder le premier tour</b> : en jouant petit du mort, vous laissez un pli aux adversaires, mais l\'As reste au mort comme <b>reprise</b> (la carte qui permet d\'y revenir). Au tour de carreau suivant, l\'As fait le pli, les adversaires n\'ont plus de carreau, et les petits carreaux du mort sont maîtres. Si vous jouez l\'As tout de suite, le mort n\'a plus de reprise et ses petits carreaux restent bloqués.',
    bon: ['♦3'], piege: ['♦A'],
  },
  {
    id: 'aff3', parcours: 'decl', theme: 'affranchir', tech: true, niveau: 4, titre: 'La bonne couleur d\'abord',
    contrat: '3SA', declarant: 'S', deja: [4, 1], entame: 'S',
    mains: { N: '..VT96.VT72', E: 'D86.8.7.A64', S: '94.A.RD2.RD', O: '5.RDVT9.A3.' },
    histoire: 'Ouest a entamé cœur, sa longue couleur : il ne vous reste que l\'As de cœur pour l\'arrêter. Il vous manque l\'As de carreau et l\'As de trèfle. Plus tôt, Ouest n\'a pas fourni à trèfle : l\'As de trèfle est donc chez Est.',
    astuce: 'L\'As de trèfle d\'Est peut attendre : chassez d\'abord l\'As de carreau avec un gros carreau, tant que votre As de cœur arrête encore les cœurs d\'Ouest. Si carreau revient, prenez dans votre main avec votre autre gros carreau, puis jouez trèfle.',
    lecon: 'Deux couleurs à affranchir : l\'<b>ordre</b> compte. Chassez d\'abord l\'As de carreau d\'Ouest, le joueur <b>dangereux</b> (celui qui a les cœurs maîtres) : quand Est prendra l\'As de trèfle, Ouest n\'aura plus d\'As pour reprendre la main et faire ses cœurs. Si vous commencez par les trèfles, Est prend et rejoue cœur : votre As de cœur part, et Ouest, en prenant l\'As de carreau, encaisse tous ses cœurs.',
    bon: ['♦R', '♦D'], piege: ['♣R'],
  },
  {
    id: 'sec1', parcours: 'decl', theme: 'securite', tech: true, niveau: 3, titre: 'Le bon honneur d\'abord',
    contrat: '3SA', declarant: 'S', deja: [2, 4], entame: 'N',
    mains: { N: 'A943.6.5.4', E: '.DV9.DV8.2', S: 'RDT82.A.A.', O: 'V765.R.R.A' },
    histoire: 'La main est au mort. Vous avez As-9-4-3 de pique au mort et Roi-Dame-10-8-2 dans votre main : il ne manque que le Valet et trois petits piques. Il vous faut tous les plis.',
    astuce: 'Du mort, jouez un petit pique vers votre main et mettez le Roi ou la Dame : on commence par la main qui a deux honneurs. Si un adversaire ne fournit pas, vous saurez qui a le Valet, et vous pourrez le prendre en impasse.',
    lecon: '<b>Le bon honneur d\'abord</b> : on commence par la main qui a deux honneurs. C\'est un <b>jeu de sécurité</b> (une précaution) contre un adversaire qui aurait les quatre piques qui manquent : ici, Est ne fournit pas, Ouest a Valet-7-6, et vous le prenez en <b>impasse</b> en jouant petit vers l\'As-9 du mort (le 9 fait le pli). Si vous jouez l\'As du mort en premier, il ne reste plus rien au mort pour capturer le Valet d\'Ouest : il fait un pli.',
    bon: ['♠3'], piege: ['♠A'],
  },
  {
    id: 'sec2', parcours: 'decl', theme: 'securite', tech: true, niveau: 4, titre: 'Assurez le contrat',
    contrat: '3SA', declarant: 'S', deja: [3, 2], pli: [['S', '♣7'], ['O', '♣10']],
    mains: { N: '.A2..AR6543', E: '.9876..DV92', S: 'A32.R43..8', O: 'RDVT.DVT..' },
    histoire: 'Au mort : As-Roi et quatre petits trèfles, et l\'As de cœur. Vous jouez le 7 de trèfle, Ouest fournit le 10. Comptez : avec l\'As de pique et vos deux gros cœurs, trois levées de trèfle vous suffisent.',
    astuce: 'Trois levées de trèfle suffisent : cédez d\'abord un tour de trèfle en jouant petit du mort. Gardez l\'As de cœur du mort pour y revenir.',
    lecon: 'Le <b>jeu de sécurité</b> (une précaution) : trois levées de trèfle suffisent, alors vous <b>cédez volontairement</b> ce pli. Est avait quatre trèfles (Dame-Valet-9-2) : il ne fera plus qu\'un pli de trèfle, et l\'As de cœur gardé au mort vous ramène à ses derniers trèfles. Si vous prenez de l\'As, Est, avec Dame-Valet-9, arrête vos trèfles, et il vous manquera un pli.',
    bon: ['♣3'], piege: ['♣A'],
  },
  {
    id: 'fin1', parcours: 'decl', theme: 'fins', tech: true, niveau: 4, titre: 'Élimination et mise en main',
    contrat: '4P', declarant: 'S', deja: [4, 2], entame: 'S',
    mains: { N: 'VT.2.2.543', E: '..RDVT.VT9', S: 'RD.3.A4.AD', O: '.RV9.96.R8' },
    histoire: 'Les adversaires n\'ont plus d\'atout, mais il vous manque le Roi de trèfle : si vous jouez trèfle vous-même, il risque de prendre votre Dame. Ouest a ouvert d\'1 cœur, et Est n\'a plus de cœur.',
    astuce: 'Ne jouez pas trèfle vous-même, et gardez des atouts dans les deux mains. Videz d\'abord les carreaux (l\'As, puis le 4 coupé au mort), puis donnez la main à Ouest en jouant cœur : s\'il rejoue cœur, coupez au mort et jetez votre Dame de trèfle.',
    lecon: 'C\'est l\'<b>élimination</b> (vider une couleur de vos deux mains) puis la <b>mise en main</b> (donner la main à un adversaire qui sera obligé de vous aider) : l\'As de carreau, le 4 coupé au mort, puis cœur pour Ouest. Ouest doit alors jouer trèfle (votre Dame fait un pli) ou cœur (vous coupez au mort et vous jetez votre Dame de trèfle : c\'est la « coupe et défausse »). Si vous jouez cœur trop tôt, Ouest rejoue carreau sans danger, et votre Dame de trèfle finit sous son Roi.',
    bon: ['♦A'], piege: ['♥3', '♣D'],
  },
  {
    id: 'fin2', parcours: 'decl', theme: 'fins', tech: true, niveau: 5, titre: 'Le squeeze',
    contrat: '6SA', declarant: 'S', deja: [6, 1], entame: 'S',
    mains: { N: '.A3.4.765', E: 'T9..VT7.R', S: 'ARDV.2.D.', O: '.RD9.R9.8' },
    histoire: 'Vous jouez 6 Sans-Atout : il vous faut tous les plis, et vous n\'en comptez que 5 sûrs (4 piques et l\'As de cœur). Ouest a ouvert d\'1 cœur : il a les gros cœurs, et sans doute le Roi de carreau.',
    astuce: 'Jouez tous vos piques en gardant au mort l\'As et le 3 de cœur : Ouest ne pourra pas tout garder. Regardez bien ce qu\'il jette, et seulement après le dernier pique, encaissez la couleur qu\'il a lâchée.',
    lecon: 'C\'est le <b>squeeze</b> (on dit aussi « compression ») : Ouest est seul à garder les cœurs et les carreaux, et sur vos piques <b>il ne peut pas tout garder</b>. S\'il garde le Roi de carreau, il n\'a plus qu\'un cœur : l\'As du mort le fait tomber et le 3 de cœur devient maître ; s\'il garde deux cœurs, il a dû jeter le Roi de carreau, et votre Dame de carreau est maîtresse. Si vous jouez la Dame de carreau trop tôt, Ouest la prend avec son Roi ; si vous jouez cœur trop tôt, le mort prend la main et ne peut plus revenir chez vous pour les piques.',
    bon: ['♠A', '♠R', '♠D', '♠V'], piege: ['♥2', '♦D'],
  },
  {
    id: 'fin3', parcours: 'decl', theme: 'fins', tech: true, niveau: 5, titre: 'Le coup en passant',
    contrat: '4P', declarant: 'S', deja: [5, 2], entame: 'S',
    mains: { N: '.3.76.ARD', E: 'V.RD..765', S: '8.A4..432', O: '.9.ARDV.V' },
    histoire: 'Il reste un seul atout chez les adversaires : le Valet de pique, plus fort que votre 8, et c\'est Est qui l\'a (Ouest n\'a pas fourni au 2e tour d\'atout). Est n\'a plus de carreau, et vous comptez 4 plis sûrs (3 trèfles et l\'As de cœur) : le 5e doit venir de votre 8 d\'atout.',
    astuce: 'Ne jouez pas votre 8 d\'atout en premier : le Valet d\'Est le prendrait. Encaissez vos trèfles et l\'As de cœur, puis jouez carreau du mort : si Est coupe, jetez votre 4 de cœur ; sinon, coupez avec le 8.',
    lecon: 'C\'est le <b>coup en passant</b> : votre petit atout fait un pli parce qu\'Est doit jouer <b>avant</b> vous. Quand le mort joue carreau, si Est coupe avec le Valet, vous jetez votre 4 de cœur perdant ; s\'il ne coupe pas, vous coupez avec le 8. Si vous jouez le 8 d\'atout tout de suite, le Valet d\'Est le prend et votre 4 de cœur reste perdant.',
    bon: ['♣2', '♣3', '♣4', '♥A'], piege: ['♠8'],
  },
  {
    id: 'pln1', parcours: 'decl', theme: 'plan', tech: true, niveau: 4, titre: 'Compter et choisir',
    contrat: '3SA', declarant: 'S', deja: [4, 2], entame: 'S',
    mains: { N: '.AR.43.RDV', E: '2.V4.R72.9', S: 'A..DVT9.42', O: 'RDVT9..A.A' },
    histoire: 'Ouest a ouvert d\'1 pique : il lui reste de beaux piques, et votre As de pique est votre dernier arrêt (la seule carte qui arrête ses piques). Il vous manque l\'As de trèfle, et l\'As et le Roi de carreau.',
    astuce: 'Comptez : trois levées sûres (As et Roi de cœur, As de pique), il en faut deux de plus. Les trèfles vous les donnent en laissant la main une seule fois aux adversaires ; avec les carreaux, il faudrait la leur laisser deux fois.',
    lecon: '<b>Compter et choisir</b> : il vous manque deux levées. Les trèfles (Roi, Dame, Valet) les donnent dès que l\'As est parti : vous ne laissez la main qu\'une fois. Les carreaux en donneraient autant, mais il faut chasser l\'As et le Roi : Ouest prend l\'As et chasse votre As de pique, puis, la fois suivante où vous perdez la main, les adversaires encaissent tous les piques d\'Ouest. Et gardez votre As de pique : si vous le jouez, Ouest fait ses piques dès qu\'il prend la main.',
    bon: ['♣2', '♣4'], piege: ['♦D', '♠A'],
  },
  {
    id: 'ent1', parcours: 'def', theme: 'entame', tech: true, niveau: 2, titre: 'La longue à Sans-Atout',
    contrat: '3SA', declarant: 'E', deja: [1, 6], entame: 'S',
    mains: { N: 'DV.9.8.92', E: 'A52..73.A', S: 'RT743..A.', O: '96.7.RDV.' },
    histoire: 'Est joue 3 Sans-Atout et vous avez la main. Vous avez cinq piques, dont le Roi, et l\'As de carreau. Le mort (Ouest) a Roi-Dame-Valet de carreau : le déclarant voudra faire tomber votre As.',
    astuce: 'Attaquez dans votre longue couleur, avec la 4e meilleure carte (la 4e en partant de la plus forte) : le 4 de pique. Gardez l\'As de carreau : c\'est votre reprise, pour revenir encaisser vos piques.',
    lecon: 'Contre Sans-Atout, on <b>entame dans sa longue couleur, la 4e meilleure carte</b> (ici le 4) : Nord met un honneur et le déclarant doit lâcher son As de pique. Quand il joue carreau, votre <b>As de carreau vous redonne la main</b>, et vos piques sont maîtres. Avec le Roi en tête, l\'honneur qui reste à Nord bloque ensuite vos piques ; avec l\'As de carreau d\'abord, vous n\'avez plus de reprise.',
    bon: ['♠4', '♠3'], piege: ['♠R', '♦A'],
  },
  {
    id: 'ent2', parcours: 'def', theme: 'entame', tech: true, niveau: 2, titre: 'Pas sous l\'As à l\'atout',
    contrat: '4P', declarant: 'E', deja: [2, 4], entame: 'S',
    mains: { N: 'R.VT9.86.9', E: 'DV85.R5..5', S: '.A73.D72.T', O: '63.64.4.V6' },
    histoire: 'Est joue 4 Piques et vous avez la main. Vous avez l\'As de cœur, mais pas le Roi : il est peut-être chez Est, qui jouera après vous.',
    astuce: 'À l\'atout, ne jouez pas un petit cœur sous votre As. Jouez l\'As lui-même, ou une autre couleur : votre As fera son pli.',
    lecon: '<b>À l\'atout, on n\'entame pas sous un As</b> : avec As-7-3, le 3 offre un pli au Roi d\'Est, qui joue en dernier. Ensuite, Est jette son dernier cœur sur un trèfle du mort, et votre As ne fait plus de pli. Avec l\'As ou une autre couleur, votre As et le Roi d\'atout de Nord font chuter le contrat.',
    bon: ['♥A', '♦D', '♦7', '♦2', '♣10'], piege: ['♥3', '♥7'],
  },
  {
    id: 'flc1', parcours: 'def', theme: 'flanc', tech: true, niveau: 1, titre: 'Le 2e joue petit',
    contrat: '3SA', declarant: 'E', deja: [2, 5], pli: [['E', '♥4']],
    mains: { N: 'AD.T73.4.', E: '432...53', S: '.A86.8.T4', O: '9.RD5..AR' },
    histoire: 'Est joue le 4 de cœur vers le Roi-Dame du mort (Ouest). C\'est à vous, en 2e position, avec As-8-6 de cœur.',
    astuce: 'En 2e position, on joue petit : ici le 6. Gardez votre As de cœur pour battre plus tard le Roi ou la Dame du mort.',
    lecon: '<b>Le 2e joue petit</b> : sur le petit cœur d\'Est, fournissez le 6. Le mort fait un pli avec un honneur, mais votre As est toujours là : l\'autre honneur ne fera pas de pli. Si vous mettez l\'As tout de suite, il ne prend que des petits cœurs, et le Roi et la Dame du mort font chacun leur pli.',
    bon: ['♥6', '♥8'], piege: ['♥A'],
  },
  {
    id: 'flc2', parcours: 'def', theme: 'flanc', tech: true, niveau: 2, titre: 'Couvrez un honneur',
    contrat: '3SA', declarant: 'O', deja: [3, 4], pli: [['E', '♥D']],
    mains: { N: '2.T964.V.', E: '9.32..85', S: '7.R5.R3.T', O: '.AV87.9.A' },
    histoire: 'Le mort (Est) joue la Dame de cœur : le déclarant tente l\'impasse au Roi. Vous avez le Roi et le 5 de cœur.',
    astuce: 'Couvrez un honneur par un honneur : mettez votre Roi sur la Dame. L\'As du déclarant tombera dessus, et si Nord a le 10 ou le 9 de cœur, ces cartes prendront de la valeur.',
    lecon: '<b>Couvrir un honneur par un honneur</b> : votre Roi oblige le déclarant à mettre l\'As, et les cœurs de Nord, le 10 et le 9, prennent de la valeur : ils feront des plis. Si vous jouez le 5, la Dame fait le pli, puis votre Roi, resté seul, tombe sous l\'As.',
    bon: ['♥R'], piege: ['♥5'],
  },
  {
    id: 'flc4', parcours: 'def', theme: 'flanc', tech: true, niveau: 2, titre: 'Jouez à travers le mort',
    contrat: '3SA', declarant: 'E', deja: [1, 7], entame: 'S',
    mains: { N: 'ARD.R5..', E: 'V.76.AR.', S: '2.43.DV.', O: '987.AD..' },
    histoire: 'Votre partenaire Nord a ouvert d\'1 pique, mais Est joue 3 Sans-Atout. Le mort (Ouest) a l\'As-Dame de cœur : le Roi de cœur est peut-être chez Nord.',
    astuce: 'Jouez cœur maintenant, à travers le mort : le mort devra jouer juste avant Nord. Les piques de Nord attendront.',
    lecon: '<b>Jouer à travers le mort</b>, c\'est jouer une couleur où le mort joue juste après vous, donc avant Nord : s\'il met la Dame, le Roi de Nord la prend ; s\'il met l\'As, le Roi devient maître. Si vous jouez pique, Nord encaisse ses piques, puis il doit jouer cœur lui-même : le mort joue alors après lui, et l\'As-Dame prend tout.',
    bon: ['♥4', '♥3'], piege: ['♠2'],
  },
  {
    id: 'flc3', parcours: 'def', theme: 'flanc', tech: true, niveau: 4, titre: 'Le déblocage en défense',
    contrat: '3SA', declarant: 'E', deja: [1, 5], entame: 'S',
    mains: { N: 'ADV76.3..9', E: 'T9854..4.6', S: 'R2.V9.T3.D', O: '3.R.D7.R52' },
    histoire: 'Pendant les enchères, Nord a annoncé les piques : il en a au moins cinq, avec de beaux honneurs. Vous avez la main, et seulement deux piques : le Roi et le 2.',
    astuce: 'Dans la couleur de Nord, jouez d\'abord votre honneur, le Roi, puis le 2 : Nord gardera la main pour encaisser ses piques.',
    lecon: 'Le <b>déblocage</b> : quand on a peu de cartes dans la couleur du partenaire, on joue d\'abord la plus forte. Votre Roi fait le pli, puis le 2 donne la main à Nord, qui encaisse ses piques maîtres. Si vous jouez le 2 d\'abord, votre Roi reste seul et bloque la couleur : quoi que fasse Nord, un pli de pique est perdu.',
    bon: ['♠R'], piege: ['♠2'],
  },
  {
    id: 'cas1', parcours: 'def', theme: 'casser', tech: true, niveau: 3, titre: 'La contre-attaque',
    contrat: '4P', declarant: 'E', deja: [2, 4], entame: 'S',
    mains: { N: '.87.987.AR', E: 'ARD2.5..76', S: '.DVT9.62.3', O: '98..RDV.54' },
    histoire: 'Le déclarant a fait tomber les atouts, puis il a joué carreau : vous venez de prendre la main avec l\'As de carreau. Les carreaux du mort sont maintenant tous maîtres, et le mort n\'a plus de cœur.',
    astuce: 'Il y a urgence : dès que le mort aura la main, le déclarant jettera ses cartes perdantes sur les carreaux. Changez de couleur : jouez trèfle, la couleur faible du mort, pour trouver les levées de Nord.',
    lecon: '<b>La contre-attaque</b>, c\'est changer tout de suite de couleur pour prendre vos plis, avant que le déclarant ne jette ses cartes perdantes sur la couleur maîtresse du mort. Le petit trèfle trouve l\'As-Roi de Nord : deux plis, et le contrat chute. Si vous jouez vos cœurs maîtres (le mort coupe) ou un carreau, le mort prend la main, fait ses carreaux, et Est y jette ses deux trèfles.',
    bon: ['♣3'], piege: ['♥D', '♦6'],
  },
  {
    id: 'atd1', parcours: 'def', theme: 'atout-def', tech: true, niveau: 2, titre: 'Donnez la coupe',
    contrat: '4P', declarant: 'E', deja: [1, 5], entame: 'S',
    mains: { N: '54.VT9..D9', E: 'ARDV..86.R', S: '.65.9754.A', O: '7.ARD.RD.3' },
    histoire: 'Au tour de carreau précédent, votre partenaire Nord a défaussé un cœur : il n\'a plus de carreau. En comptant les atouts déjà joués, vous savez qu\'il lui en reste deux petits.',
    astuce: 'Jouez carreau : Nord coupera. Gardez votre As de trèfle : c\'est lui qui vous redonnera la main pour une 2e coupe.',
    lecon: '<b>Donner la coupe</b> : vous jouez carreau, Nord coupe avec un petit atout, puis il vous rend la main à trèfle. Votre As prend, et vous rejouez carreau pour une 2e coupe. Si vous jouez l\'As de trèfle d\'abord, vous n\'avez plus de moyen de reprendre la main : Nord ne coupe qu\'une fois, et le contrat gagne.',
    bon: ['♦9', '♦7', '♦5', '♦4'], piege: ['♣A'],
  },
  {
    id: 'atd2', parcours: 'def', theme: 'atout-def', tech: true, niveau: 3, titre: 'La promotion d\'atout',
    contrat: '4C', declarant: 'O', deja: [3, 3], pli: [['N', '♦A'], ['E', '♦3']],
    mains: { N: '92.V76.D.', E: '76..R8.52', S: '543.T2..43', O: 'AR.ARD84..' },
    histoire: 'Vous avez compté les carreaux : Ouest, le déclarant, n\'en a plus. Nord joue l\'As de carreau, le mort fournit le 3 : Ouest va couper. Vous n\'avez plus de carreau non plus, et il vous reste le 10 et le 2 d\'atout.',
    astuce: 'Coupez avec votre plus gros atout, le 10 de cœur : Ouest devra surcouper (couper plus fort) avec un de ses gros atouts.',
    lecon: '<b>La promotion d\'atout</b> (faire « monter » un atout de Nord) : en coupant avec le 10, vous obligez Ouest à surcouper avec un de ses gros atouts. Il ne lui en reste alors plus assez pour faire tomber le Valet de Nord, qui fait un pli. Si vous coupez avec le 2, ou si vous défaussez, Ouest coupe avec le 4, garde As-Roi-Dame et fait tomber le Valet de Nord.',
    bon: ['♥10'], piege: ['♥2', '♣3'],
  },
  {
    id: 'atd3', parcours: 'def', theme: 'atout-def', tech: true, niveau: 5, titre: 'Raccourcissez le déclarant',
    contrat: '4P', declarant: 'E', deja: [1, 5], entame: 'S',
    mains: { N: '.T98.DVT9.', E: 'RDVT9..AR.', S: 'A876.RDV..', O: '.54.32.432' },
    histoire: 'Vous avez quatre atouts avec l\'As, et vos cœurs sont maîtres. En comptant les cartes jouées, vous savez que le déclarant (Est) a encore cinq atouts, mais plus un seul cœur. Le mort n\'a plus d\'atout.',
    astuce: 'Chaque fois que vous avez la main, jouez cœur : Est doit couper et perd un atout. S\'il joue atout, prenez tout de suite de l\'As et rejouez cœur ; s\'il joue carreau, coupez avec un petit atout.',
    lecon: '<b>Raccourcir le déclarant</b> : à chaque cœur, Est doit couper et perd un atout, et votre As d\'atout vous redonne la main pour le forcer encore. Bientôt il n\'a plus assez d\'atouts pour faire tomber les vôtres, et vos petits atouts coupent ses carreaux. Si vous jouez atout d\'abord (l\'As ou un petit), Est coupe le cœur suivant, puis fait tomber vos derniers atouts et gagne.',
    bon: ['♥R', '♥D', '♥V'], piege: ['♠A', '♠6'],
  },
  {
    id: 'dfs1', parcours: 'def', theme: 'defausse', tech: true, niveau: 2, titre: 'Protégez votre Roi',
    contrat: '3SA', declarant: 'O', deja: [4, 4], pli: [['E', '♦D']],
    mains: { N: 'VT.V.98.', E: '.AD..AR', S: '.R4..765', O: 'AR.7.6.4' },
    histoire: 'Le mort (Est) joue la Dame de carreau, et vous n\'avez plus de carreau. Le mort a encore As-Dame de cœur ; vous, vous avez le Roi et le 4 de cœur.',
    astuce: 'Ne jetez pas le 4 de cœur : tant qu\'il accompagne votre Roi, le Roi est protégé. Jetez vos trèfles, et sur l\'As de cœur, mettez le 4.',
    lecon: 'C\'est la <b>garde</b> : votre Roi de cœur n\'est protégé que s\'il reste accompagné d\'un petit cœur. Sur l\'As du mort, vous mettez le 4, et votre Roi prend ensuite la Dame. Si vous jetez le 4 de cœur, l\'As fait tomber votre Roi tout seul et la Dame du mort devient maîtresse.',
    bon: ['♣7', '♣6', '♣5'], piege: ['♥4'],
  },
  {
    id: 'dfs2', parcours: 'def', theme: 'defausse', tech: true, niveau: 4, titre: 'Gardez la longueur du mort',
    contrat: '3SA', declarant: 'E', deja: [4, 1], pli: [['E', '♠A']],
    mains: { N: '654.T987.4.', E: 'RD.A432..4', S: '.DV6.5.9765', O: '732.5..ARD2' },
    histoire: 'Le déclarant (Est) encaisse ses piques, et vous n\'en avez plus. Le mort (Ouest) a As-Roi-Dame-2 de trèfle ; votre partenaire Nord a ouvert d\'1 cœur : c\'est lui qui garde les cœurs.',
    astuce: 'Comptez les trèfles du mort : il en a quatre, gardez-en quatre jusqu\'au bout. Jetez votre carreau et vos cœurs, même la Dame et le Valet : Nord s\'occupe des cœurs.',
    lecon: '<b>Gardez la longueur du mort</b> : le mort a quatre trèfles, vous devez en garder quatre, sinon son 2 de trèfle devient maître au dernier pli. Les cœurs, c\'est Nord qui les garde : vous pouvez jeter votre Dame et votre Valet sans crainte. On défausse dans la couleur que le partenaire garde, jamais dans celle qu\'on est seul à garder.',
    bon: ['♥6', '♥V', '♥D', '♦5'], piege: ['♣9', '♣7', '♣6', '♣5'],
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
