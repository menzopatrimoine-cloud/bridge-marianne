/* Bridge — les adversaires (Est et Ouest) : retraités aisés de la Côte d'Azur, avec un visage dessiné.
   Deux d'entre eux sont tirés au sort à chaque donne. */
var B = globalThis.B = globalThis.B || {};
(function () {
'use strict';

// gagne / perd : ce qu'il dit en adversaire quand il gagne ou perd la donne ;
// avecGagne / avecPerd : ce qu'il dit en partenaire quand vous gagnez ou perdez ensemble
// av : bg fond, skin peau, hair couleur des cheveux, style coiffure, outfit tenue, cloth couleur de la tenue,
//      accent détail (col, cravate…), puis les accessoires
const PERSOS = [
  { name: 'Jean-Marc', title: 'le jardinier du Cap-Ferrat',
    hello: 'Bonjour ! Jean-Marc, du Cap-Ferrat. Le matin je taille mes rosiers, l\'après-midi je compte mes atouts : un par un, comme mes tomates.',
    bio: 'Taille les rosiers de sa villa du Cap-Ferrat tous les matins. Compte ses atouts comme ses tomates : un par un, et sans en oublier.',
    gagne: 'Ah, ça pousse bien chez nous aujourd\'hui !', perd: 'Bien joué ! Vous avez la main verte, vous aussi.',
    avecGagne: 'On a bien semé, on récolte ! Bravo, partenaire.', avecPerd: 'Pas grave : il faut parfois tailler pour que ça repousse.',
    av: { bg: '#b9d3a8', skin: '#efc5a4', hair: '#eeece6', style: 'chauve', outfit: 'polo', cloth: '#4f7d4a', accent: '#f4f1e6', hat: 'paille', mustache: 'large' } },
  { name: 'Yvette', title: 'la comédienne',
    hello: 'Bonsoir, bonsoir ! Yvette, des planches cannoises. Ne vous levez pas… Enfin, si c\'est pour applaudir, ne vous gênez pas.',
    bio: 'Ancienne vedette des planches cannoises. Fait toujours une entrée remarquée, même pour dire « Passe ».',
    gagne: 'Merci, merci… Pas d\'autographe pendant la partie !', perd: 'Quelle performance… Vous méritez un César, ma chère !',
    avecGagne: 'Quel duo ! On nous rappelle sur scène !', avecPerd: 'Un petit trou de mémoire… La prochaine représentation sera la bonne !',
    av: { bg: '#f3c1cf', skin: '#f4d2bd', hair: '#f3e7c9', style: 'brushing', outfit: 'robe', cloth: '#b02a5b', sunglasses: true, lips: true, beauty: true, earrings: 'perle' } },
  { name: 'Gérard', title: 'le notaire de Cimiez',
    hello: 'Gérard, quarante ans de notariat à Cimiez. Je lirai vos enchères comme un contrat : lentement, et jusqu\'à la dernière clause.',
    bio: 'Quarante ans d\'études notariales à Cimiez. Lit chaque enchère comme un contrat : lentement, et sans laisser passer une clause.',
    gagne: 'Tout est en règle : signé, paraphé, gagné.', perd: 'Je n\'ai rien à redire… et pourtant, j\'ai cherché.',
    avecGagne: 'Affaire conclue, et dans les règles. Félicitations !', avecPerd: 'Simple acte manqué : nous signerons la prochaine.',
    av: { bg: '#b8c6dc', skin: '#ecc4a6', hair: '#c7c4bd', style: 'court', outfit: 'costume', cloth: '#2c3e63', accent: '#7a1f2b', tie: 'cravate', glasses: 'carre', glassColor: '#5a3b22', forehead: true } },
  { name: 'Huguette', title: 'la parfumeuse de Grasse',
    hello: 'Huguette, de Grasse. J\'ai du nez : je sens les impasses de loin. Et ce brin de mimosa me porte chance.',
    bio: 'Un « nez » réputé de Grasse. Elle sent les impasses de loin… et porte toujours un brin de mimosa dans les cheveux.',
    gagne: 'Ça sentait bon pour nous, cette donne !', perd: 'Vous avez du flair, je dois l\'avouer.',
    avecGagne: 'Ça sent la victoire ! Quel joli bouquet.', avecPerd: 'Une note un peu amère… La prochaine sera plus douce.',
    av: { bg: '#d6c8ea', skin: '#f2cdb4', hair: '#d9d6d0', style: 'chignon', outfit: 'robe', cloth: '#7a5ea8', pearls: true, mimosa: true, earrings: 'or' } },
  { name: 'Raymond', title: 'le capitaine de Villefranche',
    hello: 'Raymond, capitaine à Villefranche. Quarante ans de Méditerranée : ce n\'est pas un contrat qui va me faire peur. Bienvenue à bord !',
    bio: 'A navigué quarante ans sur son yacht en Méditerranée. Garde le cap dans toutes les enchères et ne coule jamais un contrat sans se battre.',
    gagne: 'Cap tenu, matelot ! Le contrat est au port.', perd: 'Je baisse pavillon : bien navigué !',
    avecGagne: 'Bien manœuvré ! On rentre au port en vainqueurs.', avecPerd: 'Un coup de mistral… On écope et on repart !',
    av: { bg: '#a9cde6', skin: '#e2ae8a', hair: '#f1f0ec', style: 'court', outfit: 'mariniere', cloth: '#ffffff', accent: '#1e3a6b', hat: 'capitaine', beard: true } },
  { name: 'Monique', title: 'la galeriste de Saint-Paul',
    hello: 'Monique, ma galerie est à Saint-Paul-de-Vence. Je collectionne les tableaux et les levées. Méfiez-vous de mes lunettes rouges : elles voient tout.',
    bio: 'Tient une galerie d\'art à Saint-Paul-de-Vence. Collectionne les tableaux… et les levées. Ses lunettes rouges voient tout.',
    gagne: 'Un vrai chef-d\'œuvre, cette défense !', perd: 'Très joli coup. Je l\'encadrerais bien.',
    avecGagne: 'Un chef-d\'œuvre à quatre mains !', avecPerd: 'Ce n\'était qu\'une esquisse : le tableau sera parfait la prochaine fois.',
    av: { bg: '#f1d49a', skin: '#f0c9ad', hair: '#d2d4d8', style: 'carre', outfit: 'col-roule', cloth: '#26262b', glasses: 'rond', glassColor: '#d2232a', necklace: true, lips: true } },
  { name: 'Bernard', title: 'le chirurgien du Mont-Boron',
    hello: 'Bernard, ancien chirurgien au Mont-Boron. Rassurez-vous : aujourd\'hui, je n\'opère plus que les contrats.',
    bio: 'Ancien chef de chirurgie, retraité au Mont-Boron. Découpe les contrats adverses avec une précision… chirurgicale.',
    gagne: 'Opération réussie. Le patient n\'a rien senti.', perd: 'Intervention parfaite, docteur. Chapeau.',
    avecGagne: 'Opération réussie, et en équipe !', avecPerd: 'Petite complication, rien de grave. On recoud et on continue.',
    av: { bg: '#b4dfd2', skin: '#efc8aa', hair: '#e4e2dc', style: 'chauve', outfit: 'blouse', cloth: '#ffffff', accent: '#8fbbe0', glasses: 'rond', glassColor: '#3a3a3a', forehead: true } },
  { name: 'Ginette', title: 'la reine du golf de Mougins',
    hello: 'Ginette, du golf de Mougins. Ma visière ? Je la garde, c\'est pour la concentration.',
    bio: 'Handicap 12 au golf de Mougins, mais aucun au bridge. Garde sa visière même au salon, « pour la concentration ».',
    gagne: 'Trou en un ! Enfin… contrat en un.', perd: 'Joli swing ! Vous m\'avez eue au dernier trou.',
    avecGagne: 'Birdie ! On fait une sacrée équipe.', avecPerd: 'Un coup dans le bunker… On se rattrape au trou suivant !',
    av: { bg: '#bfe0a8', skin: '#e9bb98', hair: '#f4f3ef', style: 'frise', outfit: 'polo', cloth: '#e86f9a', accent: '#ffffff', hat: 'visiere', hatColor: '#ffffff', earrings: 'or' } },
  { name: 'Lucien', title: 'l\'antiquaire du Vieux-Nice',
    hello: 'Lucien, antiquaire rue Droite. Permettez que j\'examine vos cartes au monocle… Je plaisante : je ne regarde que les miennes.',
    bio: 'Antiquaire rue Droite, dans le Vieux-Nice. Examine chaque carte au monocle : pour lui, une Dame de pique de 1950 vaut une fortune.',
    gagne: 'Une pièce rare, cette levée ! Je la garde.', perd: 'Superbe. Une vraie pièce de collection.',
    avecGagne: 'Une victoire de grande valeur : je la mets en vitrine !', avecPerd: 'Un petit défaut sur la pièce… elle garde tout son charme.',
    av: { bg: '#e6c2b0', skin: '#efc6a8', hair: '#bdb8ae', style: 'raie', outfit: 'gilet', cloth: '#7b4a2a', accent: '#1f5c4a', tie: 'noeud', monocle: true, mustache: 'fine' } },
  { name: 'Colette', title: 'la retraitée au grand cœur de Villefranche',
    hello: 'Bonjour, je suis Colette, de Villefranche. J\'ai tout mon temps : si quelque chose n\'est pas clair, on regarde ça ensemble.',
    bio: 'Retraitée à Villefranche-sur-Mer, cheveux gris coupés court. Elle a tout son temps et une patience d\'ange : avec elle, un débutant a toujours droit à un sourire et à une explication.',
    gagne: 'Ce n\'est rien : c\'est comme ça qu\'on apprend. Vous y êtes presque !', perd: 'Bravo, vous progressez à vue d\'œil !',
    avecGagne: 'Très bien joué ! Vous voyez, ce n\'était pas si difficile.', avecPerd: 'Ce n\'est pas grave du tout : on regarde ça ensemble et on recommence.',
    av: { bg: '#f6c9a8', skin: '#f1cbb0', hair: '#a9abae', style: 'court-f', outfit: 'robe', cloth: '#7f9e8a', earrings: 'perle' } },
  { name: 'Albert', title: 'le banquier de Monaco',
    hello: 'Albert, j\'ai dirigé une banque à Monaco. Je garde toujours un atout en réserve : question de prudence.',
    bio: 'A dirigé une banque privée à Monaco. Ne joue que des cartes à haut rendement et garde toujours un atout en réserve, comme ses lingots.',
    gagne: 'Excellent placement : les intérêts sont pour nous.', perd: 'Beau rendement, je dois l\'admettre.',
    avecGagne: 'Excellent rendement pour notre association !', avecPerd: 'Une petite perte : les marchés remontent toujours.',
    av: { bg: '#e8d79e', skin: '#ecc3a3', hair: '#dcdad5', style: 'raie', outfit: 'costume', cloth: '#1d1f29', accent: '#c9a34a', tie: 'cravate', pochette: true, glasses: 'carre', glassColor: '#c9a34a', mustache: 'fine' } },
  { name: 'Paulette', title: 'l\'hôtelière de la Promenade',
    hello: 'Bienvenue ! Paulette, j\'ai tenu un grand hôtel sur la Promenade. Installez-vous, vous êtes ici chez vous… jusqu\'à la chute de votre contrat.',
    bio: 'A tenu un grand hôtel sur la Promenade des Anglais. Accueille vos contrats avec le sourire… et les fait chuter avec élégance.',
    gagne: 'La maison vous remercie de votre visite !', perd: 'Bravo ! Je vous offre la suite avec vue mer.',
    avecGagne: 'Champagne pour notre table ! Bravo.', avecPerd: 'La maison vous offre la revanche, bien sûr !',
    av: { bg: '#bcd4ef', skin: '#f3d0b8', hair: '#f7f5f0', style: 'brushing', outfit: 'robe', cloth: '#2f5d9e', pearls: true, earrings: 'perle', lips: true } },
  { name: 'Anne-Marie', title: 'la présidente de l\'Hippocampe',
    hello: 'Bonjour, Anne-Marie, présidente de l\'Hippocampe, à Villefranche-sur-Mer. Un tournoi à organiser, une donne à expliquer : je suis disponible !',
    bio: 'Présidente de l\'Hippocampe, l\'association de bridge de Villefranche-sur-Mer. Très dynamique et toujours disponible : un tournoi à organiser, une donne à expliquer, elle répond présente.',
    gagne: 'Belle partie ! Je vous attends au prochain tournoi à Villefranche.', perd: 'Bravo ! Je vous inscris tout de suite à l\'Hippocampe.',
    avecGagne: 'Quelle équipe ! On s\'inscrit ensemble au prochain tournoi ?', avecPerd: 'Pas grave, je suis disponible : on la rejoue quand vous voulez !',
    av: { bg: '#a8dbe0', skin: '#f0c9ad', hair: '#b58a5e', style: 'carre', outfit: 'robe', cloth: '#0e7c8a', earrings: 'or', lips: true, broche: true } },
  { name: 'Christine', title: 'la danseuse toujours de bonne humeur',
    hello: 'Coucou, c\'est Christine ! Je joue comme je danse, et rien ne m\'arrête. On commence ?',
    bio: 'Toujours de bonne humeur, elle joue au bridge aussi bien qu\'elle danse. Rien ne l\'arrête pour danser, pas même une rupture du col du fémur.',
    gagne: 'Et hop, un petit pas de danse pour fêter ça !', perd: 'Bravo ! Vous m\'accordez cette danse ?',
    avecGagne: 'On a dansé sur leurs atouts, partenaire !', avecPerd: 'Même pas mal ! J\'ai connu pire, et j\'ai continué à danser.',
    av: { bg: '#ffd9a8', skin: '#f2cbb0', hair: '#c9964f', style: 'frise', outfit: 'robe', cloth: '#d0342c', earrings: 'or', lips: true, fleur: true } },
  { name: 'Roger', title: 'le chef du bridge et des cours de l\'Hippocampe',
    hello: 'Bonjour, moi c\'est Roger, de l\'Hippocampe. C\'est moi qui ai créé les fiches de cours, et mes cours, je les donne de bon cœur. Un problème pendant la donne ? On trouvera la solution.',
    bio: 'Le chef du bridge de l\'Hippocampe, à Villefranche-sur-Mer, et le créateur des fiches de cours de l\'application. De son propre gré, il donne les cours : le mardi pour les intermédiaires et les confirmés, le jeudi pour les débutants. Il trouve toujours une solution, et toujours le temps de l\'expliquer.',
    gagne: 'J\'ai trouvé la solution : elle était dans mon jeu ! On la reverra en cours.', perd: 'Bien joué ! À ce rythme, je vous fais passer du cours du jeudi à celui du mardi.',
    avecGagne: 'Vous voyez, il y a toujours une solution ! C\'est exactement ce qu\'on voit en cours.', avecPerd: 'Pas de problème, on va trouver la solution. On revoit ça au prochain cours !',
    av: { bg: '#f2d98f', skin: '#ecc4a6', hair: '#c2c0ba', style: 'raie', outfit: 'costume', cloth: '#1f4f7a', accent: '#c9a34a', tie: 'cravate', glasses: 'carre', glassColor: '#333333', chef: true } },
  { name: 'Dédé', title: 'dit André, le brave',
    hello: 'Dédé, dit André. Un petit conseil pour commencer : osez ! Moi, j\'ouvre même quand je n\'ai pas forcément les points.',
    bio: 'Dédé, dit André, joue bien et donne volontiers des conseils. Il ouvre même quand il n\'a pas forcément les points : il est brave.',
    gagne: 'Je n\'avais pas les points, mais j\'ai ouvert quand même !', perd: 'Bien joué ! Un petit conseil : continuez comme ça.',
    avecGagne: 'Bravo ! Vous voyez, il faut oser.', avecPerd: 'J\'ai peut-être ouvert un peu léger… mais quel courage !',
    av: { bg: '#e9d3c0', skin: '#e8ba96', hair: '#eeece6', style: 'court', outfit: 'col-roule', cloth: '#b5482f', hat: 'beret', hatColor: '#26303f', mustache: 'large' } },
  { name: 'Thierry', title: 'le benjamin de l\'aéronautique',
    hello: 'Thierry, le plus jeune de la bande, et déjà retraité de l\'aéronautique. Un chouchou avant le décollage ?',
    bio: 'Le plus jeune de la bande, mais déjà retraité : il a fait carrière dans l\'aéronautique. Le mardi, il apporte des chouchous à l\'Hippocampe.',
    gagne: 'Décollage réussi ! Un chouchou pour fêter ça ?', perd: 'Bravo, atterrissage parfait ! Je vous offre un chouchou.',
    avecGagne: 'Vol sans turbulence, partenaire ! Chouchous pour tout le monde.', avecPerd: 'Petite turbulence… Prenez un chouchou, ça repart !',
    av: { bg: '#bcdcf2', skin: '#f0c8a8', hair: '#6b5a48', style: 'court', outfit: 'polo', cloth: '#3f6d9e', accent: '#ffffff', avion: true } },
  { name: 'Cathy', title: 'la reine de la country',
    hello: 'Yee-haw ! Moi, c\'est Cathy : bridge, danse et gymnastique. Et la country, bien sûr !',
    bio: 'Bridge, danse et gymnastique : Cathy ne tient pas en place. C\'est la reine de la country.',
    gagne: 'Yee-haw ! Celle-là, je la danse en ligne.', perd: 'Bravo ! Chapeau bas… et c\'est un chapeau de cow-boy.',
    avecGagne: 'Yee-haw, partenaire ! On a gagné en rythme.', avecPerd: 'Allez, souplesse ! Un petit échauffement et on repart.',
    av: { bg: '#f5dfa6', skin: '#f1c9aa', hair: '#d8b878', style: 'carre', outfit: 'robe', cloth: '#3f6fa8', earrings: 'or', lips: true, hat: 'cowboy', hatColor: '#a8743e' } },
  { name: 'Annick', title: 'docteur et reine des apéritifs',
    hello: 'Bonjour, je suis Annick, docteur. Après la partie, je vous invite pour un simple apéritif. Juste un petit quelque chose… enfin, ne prévoyez pas de dîner.',
    bio: 'Docteur. Elle vous invite pour un simple apéritif et, finalement, vous vous retrouvez devant un banquet royal.',
    gagne: 'Un tout petit contrat de rien du tout… comme mes apéritifs !', perd: 'Bravo ! Vous restez bien pour l\'apéritif ? J\'ai prévu douze plats.',
    avecGagne: 'Bravo, partenaire ! Passons à table : j\'ai préparé deux ou trois bricoles, et le homard.', avecPerd: 'Ordonnance du docteur : un simple apéritif, et on repart. Enfin, simple…',
    av: { bg: '#f7d6c4', skin: '#f2cdb4', hair: '#b98f62', style: 'carre', outfit: 'blouse', cloth: '#dcebf3', accent: '#c9a34a', earrings: 'or', lips: true, tiare: true } },
  { name: 'Menzo', title: 'le créateur de l\'application',
    hello: 'Bonjour, je suis Menzo : c\'est moi qui ai créé cette application. Si les cartes ne vous plaisent pas, vous savez à qui vous plaindre !',
    bio: 'Le créateur de cette application. Il l\'a imaginée pour que Marianne puisse jouer au bridge comme dans son cours, à toute heure et avec tout ce petit monde.',
    gagne: 'Je n\'ai pas triché, promis : c\'est le robot qui distribue !', perd: 'Bravo ! Je crois que je vais devoir mettre mon jeu à jour.',
    avecGagne: 'Bravo, partenaire ! Je mets cette donne dans la prochaine version.', avecPerd: 'Ce n\'est pas une erreur, c\'est un bug. Je corrige ça tout de suite.',
    av: { bg: '#f2dcb0', skin: '#f1cdb6', hair: '#2f2620', style: 'ondule', outfit: 'polo', cloth: '#c6daee', accent: '#dfeaf5', glasses: 'rond', glassColor: '#55705c', sourcils: '#2f2620', barbe3j: true, tablette: true } },
  { name: 'Tao', title: 'le chihuahua de Marianne, mascotte du bridge',
    hello: 'Ouaf ! Moi, c\'est Tao, le chihuahua de Marianne et la mascotte du bridge. Je veux bien jouer, mais d\'abord : vous avez une croquette ?',
    bio: 'Le chihuahua de Marianne, mascotte canine du bridge. Toujours prêt pour une croquette ou une friandise.',
    gagne: 'Ouaf ! Contrat gagné : ça mérite une croquette.', perd: 'Ouaf… Bien joué. Vous n\'auriez pas une friandise pour me consoler ?',
    avecGagne: 'Ouaf ouaf ! Bravo, partenaire. On partage la friandise ?', avecPerd: 'Pas grave ! Une petite croquette et ça repart.',
    av: { bg: '#bfe3dc', chien: true } },
  { name: 'Elisabeth', title: 'la montagnarde descendue à la mer',
    hello: 'Bonjour, moi c\'est Elisabeth ! Née à la montagne, je suis descendue vivre au bord de la mer. Randonnée, soleil, ping-pong… et maintenant le bridge : je ne tiens pas en place !',
    bio: 'Née à la montagne, elle est descendue à la mer pour y vivre. Elle aime la randonnée, le soleil et le ping-pong : toujours active.',
    gagne: 'Sommet atteint ! Ça valait bien la grimpette.', perd: 'Bien joué ! Vous m\'avez renvoyé la balle comme au ping-pong.',
    avecGagne: 'Belle cordée, partenaire ! On est arrivées au sommet.', avecPerd: 'Une petite descente… On remonte à la prochaine donne !',
    av: { bg: '#bfe0f0', skin: '#e6b48f', hair: '#8a6a4a', style: 'court-f', outfit: 'polo', cloth: '#e0672f', accent: '#ffffff', hat: 'visiere', hatColor: '#ffffff', earrings: 'or' } },
  { name: 'Roseline', title: 'l\'ancienne du Sénat',
    hello: 'Bonjour, je suis Roseline. J\'ai travaillé au Sénat : les sénateurs n\'ont plus de secret pour moi. Le bridge, en revanche, j\'ai encore tout à découvrir !',
    bio: 'Elle a travaillé au Sénat : les sénateurs n\'ont plus de secret pour elle. Le bridge, en revanche, reste à découvrir.',
    gagne: 'Adopté à l\'unanimité ! La séance est levée.', perd: 'Bravo ! Je propose un amendement… pour la prochaine donne.',
    avecGagne: 'Motion adoptée, partenaire ! Quel beau vote.', avecPerd: 'Simple renvoi en commission : on revient en deuxième lecture !',
    av: { bg: '#d9cfe8', skin: '#f1cbb0', hair: '#cfc6b8', style: 'chignon', outfit: 'costume', cloth: '#5a2a44', accent: '#f4e3c0', tie: 'noeud', pearls: true, glasses: 'rond', glassColor: '#7a3b55' } },
  { name: 'Florence', title: 'l\'infirmière du bloc',
    hello: 'Bonjour, Florence, infirmière de bloc. Le soin du corps n\'a pas de secret pour moi ; les astuces du bridge, par contre, je suis là pour les apprendre !',
    bio: 'Infirmière de bloc opératoire. Le soin du corps n\'a pas de secret pour elle ; les astuces du bridge, par contre, sont à apprendre.',
    gagne: 'Intervention réussie, et sans anesthésie !', perd: 'Bien joué ! Je prends note pour la prochaine opération.',
    avecGagne: 'Bravo, partenaire : on a sauvé le patient !', avecPerd: 'Petit pansement et on repart, ce n\'est rien.',
    av: { bg: '#cde8e2', skin: '#f0c8aa', hair: '#6b4a32', style: 'carre', outfit: 'blouse', cloth: '#7fbfb3', accent: '#5f9f93', earrings: 'perle' } },
  { name: 'Joëlle', title: 'la dentiste',
    hello: 'Bonjour, Joëlle, dentiste ! Au bridge comme au cabinet, j\'aime qu\'on me montre toutes ses dents… pardon, toutes ses cartes. Ouvrez grand !',
    bio: 'Dentiste. Avec elle, pas besoin d\'arracher les plis : elle les extrait sans douleur. Et pour vos enchères, elle a toujours un plombage d\'avance.',
    gagne: 'Extraction réussie : votre contrat est tombé sans douleur !', perd: 'Bravo, quel sourire ! Vous avez de belles cartes… et de belles dents.',
    avecGagne: 'On a gagné ! Souriez, partenaire, c\'est la plus belle des couronnes.', avecPerd: 'Pas de quoi grincer des dents : on se rattrape à la prochaine !',
    av: { bg: '#f6d6e3', skin: '#f2cdb4', hair: '#b25a36', style: 'frise', outfit: 'blouse', cloth: '#e3eef8', accent: '#9ec9e8', lips: true, glasses: 'carre', glassColor: '#c0306a' } },
  // Marianne joue elle-même en Sud : elle a sa carte dans « Les personnages », mais n'est jamais tirée comme robot (joueuse: true)
  { name: 'Marianne', title: 'la maman de Menzo', joueuse: true,
    hello: 'Bonjour, je suis Marianne, la maman de Menzo. C\'est pour moi qu\'il a créé cette application : à cette table, c\'est moi qui joue en Sud !',
    bio: 'La maman de Menzo. C\'est pour elle que l\'application a été créée : elle y joue en Sud, révise les fiches de Roger, et Tao, son chihuahua, n\'est jamais bien loin.',
    gagne: 'Bien joué, mais je prendrai ma revanche !', perd: 'Bravo ! Je vais réviser mes fiches.',
    avecGagne: 'Bravo, partenaire ! Ce sont les fiches de Roger qui nous portent chance.', avecPerd: 'Pas grave, on refait une donne !',
    av: { bg: '#e3d9f2', skin: '#f2cdb4', hair: '#d8cdb8', style: 'court', outfit: 'gilet', cloth: '#3a5a8c', accent: '#f4efe4', earrings: 'perle', lips: true } },
];

const BROW = 'rgba(90, 80, 70, .75)';
const LINE = 'rgba(0, 0, 0, .16)';

function hairFront(a) {
  const h = a.hair, f = `fill="${h}"`;
  switch (a.style) {
    case 'chauve':
      return `<path d="M28.5 50 C27 38 30 31 35.5 28.5 C33 35 33 42 33.5 50Z" ${f}/><path d="M71.5 50 C73 38 70 31 64.5 28.5 C67 35 67 42 66.5 50Z" ${f}/>
        <ellipse cx="43" cy="28" rx="7" ry="3" fill="#fff" opacity=".28"/>`;
    case 'ondule':
      return `<path d="M28.5 48 C26.5 37 28.5 28 35 24 C41 20 59 20 65 24 C71.5 28 73.5 37 71.5 48 C70.5 41 69 36 65.5 32.5 C60 29.5 40 29.5 34.5 32.5 C31 36 29.5 41 28.5 48Z" ${f}/>`
        + [[40.5, 24, 3.8], [45.5, 22, 4.2], [51, 21, 4.5], [56.5, 22, 4.2], [61, 24.5, 3.6]].map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" ${f}/>`).join('');
    case 'court':
      return `<path d="M28.5 46 C26 27 37 20 50 20 C63 20 74 27 71.5 46 C70 37 66 31 60 29.5 C52 31.5 43 30.5 36 31.5 C32 35 29.5 40 28.5 46Z" ${f}/>`;
    case 'raie':
      return `<path d="M28.5 46 C26 26 37 19 51 19 C64 19 74 26 71.5 46 C70 37 67 31 61 28.5 C54 27.5 47 28 41 30 C36 32 30.5 38 28.5 46Z" ${f}/>
        <path d="M41 21 Q44 25 41 30" stroke="${LINE}" stroke-width="1.4" fill="none"/><path d="M47 22 Q55 23 62 28" stroke="#fff" stroke-width="1.2" opacity=".45" fill="none"/>`;
    case 'court-f':
      return `<path d="M28.5 48 C26 28 37 21 50 21 C63 21 74 28 71.5 48 C68 39 62 33 52 32 C44 33 34 38 28.5 48Z" ${f}/>`;
    case 'chignon':
      return `<path d="M28.5 48 C26 27 38 21 50 21 C62 21 74 27 71.5 48 C69 38 63 31.5 50 31 C38 31.5 31 38 28.5 48Z" ${f}/>
        <path d="M38 27 Q50 24 62 27" stroke="${LINE}" stroke-width="1.2" fill="none"/>`;
    case 'carre':
      return `<path d="M28.5 46 C27 28 37 21 50 21 C63 21 73 28 71.5 46 C66 37 58 33.5 49 34 C42 34 34 38 28.5 46Z" ${f}/>`;
    case 'brushing': {
      const c = [[29, 40, 9], [32, 29, 10], [41, 22, 10.5], [52, 20, 10.5], [62, 23, 10], [69, 31, 9.5], [71.5, 41, 8], [28, 48, 6.5], [72, 49, 6]];
      return c.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" ${f} stroke="rgba(0,0,0,.07)" stroke-width="1"/>`).join('');
    }
    case 'frise': {
      const c = [[31, 38, 6], [34, 30, 6.5], [40, 25, 6.5], [47, 22, 6.5], [54, 22, 6.5], [61, 25, 6.5], [66, 30, 6.5], [69, 38, 6], [29, 45, 4.5], [71, 45, 4.5]];
      return c.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" ${f} stroke="rgba(0,0,0,.08)" stroke-width="1"/>`).join('');
    }
  }
  return '';
}
function hairBack(a) {
  if (a.style === 'carre') return `<path d="M26 50 C23 25 38 18 50 18 C62 18 77 25 74 50 L74.5 64 Q69 68 63.5 64 L63 44 L37 44 L36.5 64 Q31 68 25.5 64Z" fill="${a.hair}"/>`;
  if (a.style === 'chignon') return `<circle cx="50" cy="17" r="9" fill="${a.hair}" stroke="rgba(0,0,0,.08)"/>`;
  if (a.style === 'brushing') return `<path d="M25 52 C24 60 30 64 34 60 L34 44Z M75 52 C76 60 70 64 66 60 L66 44Z" fill="${a.hair}"/>`;
  return '';
}
function outfit(a) {
  const c = a.cloth, ac = a.accent || '#fff';
  const body = col => `<path d="M9 104 C11 84 28 74 50 74 C72 74 89 84 91 104 Z" fill="${col}"/>`;
  switch (a.outfit) {
    case 'polo':
      return body(c) + `<path d="M50 82 V97" stroke="rgba(0,0,0,.18)" stroke-width="1.4"/><circle cx="50" cy="87" r="1.3" fill="rgba(0,0,0,.25)"/><circle cx="50" cy="92" r="1.3" fill="rgba(0,0,0,.25)"/>
        <path d="M39 74.5 L50 83 L45 73Z M61 74.5 L50 83 L55 73Z" fill="${ac}"/>`;
    case 'costume':
      return body(c) + `<path d="M41 75 L50 97 L59 75Z" fill="#fff"/>
        ${a.tie === 'noeud' ? `<path d="M44 78 L50 81 L56 78 L56 85 L50 82 L44 85Z" fill="${ac}"/>` : `<path d="M48 78.5 H52 L53.5 91 L50 95.5 L46.5 91Z" fill="${ac}"/><path d="M47.5 77 H52.5 L51.5 80 H48.5Z" fill="${ac}"/>`}
        <path d="M36 76 L50 99 L43 76Z M64 76 L50 99 L57 76Z" fill="rgba(0,0,0,.28)"/>
        ${a.pochette ? '<path d="M27 89 L31 85 L33 88 L36 85 L36 90 L27 90Z" fill="#f2e2b0"/>' : ''}`;
    case 'gilet':
      return body('#f4f1ea') + `<path d="M17 104 C19 88 29 78 41 76 L50 98 V104Z M83 104 C81 88 71 78 59 76 L50 98 V104Z" fill="${c}"/>
        <circle cx="47" cy="92" r="1.3" fill="#e2c37a"/><circle cx="53" cy="92" r="1.3" fill="#e2c37a"/>
        <path d="M44 78 L50 81 L56 78 L56 85 L50 82 L44 85Z" fill="${ac}"/><circle cx="50" cy="81.5" r="1.6" fill="${ac}"/>`;
    case 'mariniere':
      return body(c) + `<path d="M22 81 H78 M16.5 87.5 H83.5 M13 94 H87 M11 100.5 H89" stroke="${ac}" stroke-width="3.2"/>
        <path d="M40 74.5 Q50 82 60 74.5" fill="${a.skin}"/>`;
    case 'cuisine':
      return body(c) + `<path d="M9 104 C11 84 28 74 50 74 C72 74 89 84 91 104" fill="none" stroke="#dcd8cf" stroke-width="1.2"/>
        <path d="M40 74 Q50 80 60 74 L60.5 78.5 Q50 85 39.5 78.5Z" fill="#ece8df"/>
        ${[[43, 87], [43, 95], [57, 87], [57, 95]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.7" fill="#b9b3a6"/>`).join('')}`;
    case 'blouse':
      return body(c) + `<path d="M9 104 C11 84 28 74 50 74 C72 74 89 84 91 104" fill="none" stroke="#d7dde2" stroke-width="1.2"/>
        <path d="M41 75 L50 95 L59 75Z" fill="${ac}"/><path d="M37 76 L50 99 M63 76 L50 99" stroke="#c9d0d6" stroke-width="1.5" fill="none"/>
        <path d="M40 77 Q35 92 45.5 96 M60 77 Q65 92 54.5 96" stroke="#3b3f45" stroke-width="2" fill="none" stroke-linecap="round"/><circle cx="50" cy="97" r="3.6" fill="#8a9097" stroke="#3b3f45" stroke-width="1.2"/>`;
    case 'col-roule':
      return body(c);
    case 'robe':
    default:
      return body(c) + `<path d="M38 75 Q50 90 62 75Z" fill="${a.skin}"/>`;
  }
}
function pearls(cx, y0, w, dip, n, col, r) {
  let s = '';
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1), x = cx - w / 2 + w * t, y = y0 + dip * 4 * t * (1 - t);
    s += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${Array.isArray(col) ? col[i % col.length] : col}" stroke="rgba(0,0,0,.15)" stroke-width=".6"/>`;
  }
  return s;
}
function face(a) {
  let s = '';
  // yeux, sourcils, petites rides : des visages souriants et bienveillants
  s += `<ellipse cx="42" cy="48" rx="2.3" ry="2.7" fill="#2b2622"/><ellipse cx="58" cy="48" rx="2.3" ry="2.7" fill="#2b2622"/>
    <circle cx="42.8" cy="47" r=".8" fill="#fff"/><circle cx="58.8" cy="47" r=".8" fill="#fff"/>
    <path d="M37.5 42.5 Q42 39.8 46.3 42" stroke="${a.sourcils || BROW}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M53.7 42 Q58 39.8 62.5 42.5" stroke="${a.sourcils || BROW}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M35 46.5 l-2.6 -1.1 M35 49.2 l-2.6 .9 M65 46.5 l2.6 -1.1 M65 49.2 l2.6 .9" stroke="${LINE}" stroke-width="1" stroke-linecap="round"/>
    <path d="M50 49.5 Q47.3 56 50.6 57.2" stroke="rgba(0,0,0,.25)" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <circle cx="37.5" cy="56" r="3.8" fill="#ee8270" opacity=".32"/><circle cx="62.5" cy="56" r="3.8" fill="#ee8270" opacity=".32"/>
    <path d="M39.5 57.5 Q40.5 62 43 64 M60.5 57.5 Q59.5 62 57 64" stroke="${LINE}" stroke-width="1" fill="none"/>`;
  if (a.forehead) s += `<path d="M43 33.5 Q50 32 57 33.5 M44.5 36.5 Q50 35.3 55.5 36.5" stroke="${LINE}" stroke-width="1" fill="none"/>`;
  if (a.beard) s += `<path d="M28.5 50 C29.5 67 39 75.5 50 75.5 C61 75.5 70.5 67 71.5 50 C68.5 58 63 61.5 57 61 Q50 59 43 61 C37 61.5 31.5 58 28.5 50Z" fill="${a.hair}" stroke="rgba(0,0,0,.06)"/>`;
  // barbe de trois jours
  if (a.barbe3j) s += '<path d="M31 56 C34 65 42 70.2 50 70.2 C58 70.2 66 65 69 56 C65 62 60.5 63.5 57 62.5 Q50 60.3 43 62.5 C39.5 63.5 35 62 31 56Z" fill="rgba(50,40,35,.2)"/><path d="M42 59 Q50 55 58 59 Q50 58.4 42 59Z" fill="rgba(50,40,35,.3)"/>';
  if (a.lips) s += `<path d="M44 61 Q47 59.6 50 60.6 Q53 59.6 56 61 Q50 67.5 44 61Z" fill="#c8323c"/>`;
  else s += `<path d="M43.8 61 Q50 66.8 56.2 61" stroke="#8a3b2e" stroke-width="2" fill="none" stroke-linecap="round"/>`;
  if (a.mustache === 'large' || a.beard) s += `<path d="M40.5 59.5 Q45.5 55 50 57.8 Q54.5 55 59.5 59.5 Q54.5 61.5 50 59.6 Q45.5 61.5 40.5 59.5Z" fill="${a.hair}" stroke="rgba(0,0,0,.08)" stroke-width=".6"/>`;
  if (a.mustache === 'fine') s += `<path d="M42.5 59 Q50 56.3 57.5 59 Q50 58.2 42.5 59Z" fill="#9c958a" stroke="#9c958a" stroke-width="1.2" stroke-linejoin="round"/>`;
  if (a.beauty) s += '<circle cx="57.5" cy="57.5" r=".9" fill="#4a2f2a"/>';
  return s;
}
function glasses(a) {
  const c = a.glassColor || '#333';
  const lens = 'fill="rgba(255,255,255,.18)"';
  if (a.glasses === 'rond') return `<circle cx="42" cy="48" r="6.2" ${lens} stroke="${c}" stroke-width="1.9"/><circle cx="58" cy="48" r="6.2" ${lens} stroke="${c}" stroke-width="1.9"/>
    <path d="M48.2 47.5 Q50 46 51.8 47.5 M35.8 47 L29.5 45.5 M64.2 47 L70.5 45.5" stroke="${c}" stroke-width="1.7" fill="none"/>`;
  if (a.glasses === 'carre') return `<rect x="35" y="43.5" width="13" height="9.5" rx="2.2" ${lens} stroke="${c}" stroke-width="1.9"/><rect x="52" y="43.5" width="13" height="9.5" rx="2.2" ${lens} stroke="${c}" stroke-width="1.9"/>
    <path d="M48 47 Q50 45.8 52 47 M35 46.5 L29.5 45.5 M65 46.5 L70.5 45.5" stroke="${c}" stroke-width="1.7" fill="none"/>`;
  return '';
}
function extras(a) {
  let s = '';
  if (a.earrings === 'perle') s += '<circle cx="28.5" cy="57.5" r="2.3" fill="#fbf8f0" stroke="rgba(0,0,0,.2)" stroke-width=".6"/><circle cx="71.5" cy="57.5" r="2.3" fill="#fbf8f0" stroke="rgba(0,0,0,.2)" stroke-width=".6"/>';
  if (a.earrings === 'or') s += '<circle cx="28.5" cy="58" r="2.6" fill="none" stroke="#d4a72c" stroke-width="1.4"/><circle cx="71.5" cy="58" r="2.6" fill="none" stroke="#d4a72c" stroke-width="1.4"/>';
  if (a.pearls) s += pearls(50, 77, 24, 8, 11, '#fbf8f0', 1.7);
  // broche en forme d'hippocampe (Anne-Marie)
  if (a.broche) s += '<path d="M36.5 83 C40.5 81.5 42.5 85.5 40 88 C38 90 39.5 93.5 42 94 C44.5 94.5 45.5 92 43.5 91.2 M37 83.6 L33 85.2 M41 86.4 L43.8 87.4" stroke="#f0c64a" stroke-width="1.7" fill="none" stroke-linecap="round"/><circle cx="37.6" cy="84" r=".6" fill="#7a5a10"/>';
  // fleur dans les cheveux (Christine) et petit avion sur le polo (Thierry)
  if (a.fleur) s += [[67, 24], [72.5, 27.5], [70.5, 33.5], [64, 33.5], [62, 27.5]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.7" fill="#e23b3b" stroke="rgba(0,0,0,.12)" stroke-width=".6"/>`).join('') + '<circle cx="67.3" cy="29.3" r="2.6" fill="#f6cf45"/>';
  // la tablette du créateur (Menzo), avec un petit pique
  if (a.tablette) s += '<rect x="55" y="83" width="15" height="19" rx="2" fill="#f4f6fa" stroke="rgba(0,0,0,.35)" stroke-width=".8"/><path d="M62.5 87.5 C61.5 90 58.8 91.5 58.8 93.8 C58.8 95.6 61 96.2 62 94.8 L61.2 97.6 H63.8 L63 94.8 C64 96.2 66.2 95.6 66.2 93.8 C66.2 91.5 63.5 90 62.5 87.5Z" fill="#18202e"/>';
  // la tiare du banquet royal (Annick) ; l'étoile du chef, sur le revers (Roger)
  if (a.tiare) s += '<path d="M35.5 26.5 L39.5 15 L45 22.5 L50 11.5 L55 22.5 L60.5 15 L64.5 26.5 Q50 21 35.5 26.5Z" fill="#f0c64a" stroke="#b98d1e" stroke-width=".8" stroke-linejoin="round"/><circle cx="50" cy="13" r="2" fill="#d2232a"/><circle cx="39.7" cy="16" r="1.4" fill="#2a8fbd"/><circle cx="60.3" cy="16" r="1.4" fill="#2a8fbd"/>';
  if (a.chef) s += '<path d="M31 80.5 L33.2 85.2 L38.3 85.8 L34.5 89.2 L35.6 94.2 L31 91.6 L26.4 94.2 L27.5 89.2 L23.7 85.8 L28.8 85.2Z" fill="#f4cd55" stroke="#a97f18" stroke-width=".8" stroke-linejoin="round"/><circle cx="50" cy="50" r="48" fill="none" stroke="#d4a72c" stroke-width="4"/>';
  if (a.avion) s += '<path d="M56 89 L70 85 L71 86.2 L65 89.2 L66.5 93 L65 93.4 L62.2 90.2 L58.5 91.4 L56.4 90.4Z" fill="#f4f6fa" stroke="rgba(0,0,0,.2)" stroke-width=".5"/>';
  if (a.necklace) s += pearls(50, 78, 26, 9, 8, ['#e8b923', '#d2232a', '#2a8fbd', '#3aa76d'], 2.6);
  if (a.monocle) s += '<circle cx="58" cy="48" r="6.4" fill="rgba(255,255,255,.2)" stroke="#c9a34a" stroke-width="1.8"/><path d="M63.5 52 Q68 66 62 78" stroke="#c9a34a" stroke-width="1" fill="none"/>';
  if (a.sunglasses) s += `<ellipse cx="41" cy="27" rx="7.5" ry="5.2" fill="#262626"/><ellipse cx="59" cy="27" rx="7.5" ry="5.2" fill="#262626"/>
    <path d="M48.5 26.5 Q50 25 51.5 26.5" stroke="#262626" stroke-width="1.8" fill="none"/><path d="M37 25.5 l3 -1.6 M55 25.5 l3 -1.6" stroke="#fff" stroke-width="1.2" opacity=".55"/>`;
  if (a.mimosa) s += [[66, 26], [69.5, 24], [71, 28], [67.5, 30.5], [72.5, 31.5], [70, 21.5], [74, 25.5]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#f4c518" stroke="#d9a90c" stroke-width=".5"/>`).join('')
    + '<path d="M63 31 Q66 33 70 33" stroke="#5f8f3e" stroke-width="1.6" fill="none"/>';
  return s;
}
function hat(a) {
  switch (a.hat) {
    case 'paille':
      return `<path d="M32 31 C31.5 13.5 68.5 13.5 68 31Z" fill="#e2bf73"/><path d="M32 26.5 H68 V31 H32Z" fill="#5f8d48"/>
        <path d="M36 21 Q50 18 64 21 M34 25 Q50 22 66 25" stroke="rgba(120,80,20,.25)" stroke-width="1" fill="none"/>
        <ellipse cx="50" cy="31.5" rx="31" ry="6.8" fill="#ebcf8e" stroke="rgba(120,80,20,.25)" stroke-width="1"/>`;
    case 'capitaine':
      return `<path d="M28 31 C26.5 14 73.5 14 72 31Z" fill="#fbfbf8" stroke="#d5d5d0" stroke-width="1"/><path d="M28.5 26 H71.5 V32 H28.5Z" fill="#1d2b4f"/>
        <path d="M30 32 Q50 41.5 70 32 Q50 35.5 30 32Z" fill="#141414"/><circle cx="50" cy="21.5" r="3.6" fill="#d4af37"/><path d="M50 19.5 V23.5 M48.2 22.5 Q50 24.5 51.8 22.5" stroke="#1d2b4f" stroke-width=".9" fill="none"/>`;
    case 'toque':
      return `<path d="M33 33 V21 C25 19 26 6.5 36.5 8.5 C39 -0.5 61 -0.5 63.5 8.5 C74 6.5 75 19 67 21 V33Z" fill="#fff" stroke="#dcd8cf" stroke-width="1.2"/>
        <path d="M33 27 H67 M42 21 V12 M50 21 V9 M58 21 V12" stroke="#e4e0d7" stroke-width="1.2" fill="none"/>`;
    case 'cowboy': {
      const c = a.hatColor || '#a8743e';
      return `<path d="M35 33 C35 18 41 10.5 46 12.5 Q50 15.5 54 12.5 C59 10.5 65 18 65 33Z" fill="${c}"/><path d="M35 28.5 Q50 32.5 65 28.5 L65 33 Q50 36.5 35 33Z" fill="#4a2c14"/>
        <path d="M15 26 C22 35.5 38 34.5 50 34.5 C62 34.5 78 35.5 85 26 C83 38 66 40.5 50 40 C34 40.5 17 38 15 26Z" fill="${c}" stroke="rgba(0,0,0,.18)" stroke-width="1"/>`;
    }
    case 'beret': {
      const c = a.hatColor || '#26303f';
      return `<path d="M26.5 32 C24 19 40 12.5 55 13.5 C70 14.5 77 25 73.5 32 Q50 24.5 26.5 32Z" fill="${c}"/><path d="M51 14 q1 -4.5 3.5 -5.5" stroke="${c}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
    }
    case 'visiere': {
      const c = a.hatColor || '#fff';
      return `<path d="M28 34 Q50 25 72 34 L72 37.5 Q50 29.5 28 37.5Z" fill="${c}" stroke="rgba(0,0,0,.12)" stroke-width="1"/>
        <path d="M31 36.5 Q50 47 69 36.5 Q50 40.5 31 36.5Z" fill="#2f8a4e"/>`;
    }
  }
  return '';
}
// ce qui recouvre le cou (col roulé)
function collar(a) {
  if (a.outfit !== 'col-roule') return '';
  return `<path d="M40.5 65 H59.5 L60.5 78 Q50 82.5 39.5 78Z" fill="${a.cloth}"/><path d="M40.8 69.5 H59.2 M40.6 73.5 H59.4" stroke="rgba(255,255,255,.14)" stroke-width="1.2"/>`;
}
// le visage complet, dans un cercle (découpé en CSS)
// Tao, chihuahua noir, blanc et feu : liste blanche sur le front, taches feu au-dessus des yeux
function dogSVG(a, cls) {
  const ear = (flip) => `<g ${flip ? 'transform="translate(100 0) scale(-1 1)"' : ''}><path d="M28 45 C18 31 16 16 20 9 C32 12 42 21 47 30Z" fill="#1c1a1c"/><path d="M27 35 C23 28 22 20 24 15 C30 18 36 24 39.500 30Z" fill="#c98b4b"/></g>`;
  const eye = x => `<circle cx="${x}" cy="49" r="5.4" fill="#3a2418"/><circle cx="${x}" cy="49" r="3.6" fill="#120b07"/><circle cx="${x + 1.6}" cy="47.2" r="1.5" fill="#fff"/>`;
  const brow = (x, r) => `<ellipse cx="${x}" cy="41" rx="5.200" ry="3.400" transform="rotate(${r} ${x} 41)" fill="#d99a58"/>`;
  const whisk = '<path d="M38 62 L25 59 M38 65 L26 66 M62 62 L75 59 M62 65 L74 66" stroke="rgba(60,60,60,.45)" stroke-width=".8"/>';
  const bone = '<g transform="translate(70 88) rotate(-24)" fill="#f4e3c0" stroke="#c9a877" stroke-width=".7"><rect x="-7" y="-2" width="14" height="4" rx="1"/><circle cx="-7" cy="-2.200" r="2.600"/><circle cx="-7" cy="2.200" r="2.600"/><circle cx="7" cy="-2.200" r="2.600"/><circle cx="7" cy="2.200" r="2.600"/></g>';
  return `<svg class="av ${cls || ''}" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="50" fill="${a.bg}"/>
    <path d="M16 104 C18 86 33 77 50 77 C67 77 82 86 84 104Z" fill="#f1eee6" stroke="#dcd8cc" stroke-width="1"/>
    <path d="M34 75 Q50 84 66 75 L66 80 Q50 89 34 80Z" fill="#c9313a"/><circle cx="50" cy="86" r="3.300" fill="#f0c64a" stroke="#b98d1e" stroke-width=".7"/>
    ${ear(false)}${ear(true)}
    <path d="M50 26 C34 26 25 37 26 50 C27 62 36 72 50 74 C64 72 73 62 74 50 C75 37 66 26 50 26Z" fill="#1c1a1c"/>
    <path d="M41 28 C41.500 36 45.500 44 47.500 51 L52.500 51 C52.500 42 51 34 49.500 26.500 Q45 26 41 28Z" fill="#fff"/>
    <ellipse cx="50" cy="62.500" rx="14.500" ry="12" fill="#fff"/>
    ${brow(38, -20)}${brow(62, 20)}${eye(38.5)}${eye(61.5)}
    <path d="M44 57.500 Q50 54 56 57.500 Q56.500 63 50 65 Q43.500 63 44 57.500Z" fill="#191719"/><ellipse cx="48" cy="57.800" rx="2" ry="1" fill="#fff" opacity=".55"/>
    <path d="M47 69.500 Q50 76.500 53 69.500Z" fill="#ef8fa1"/><path d="M50 65 V68.500 M50 68.500 Q45 72 41 69 M50 68.500 Q55 72 59 69" stroke="#555" stroke-width="1.400" fill="none" stroke-linecap="round"/>
    ${whisk}${bone}</svg>`;
}
function avatarSVG(p, cls) {
  const a = p.av;
  if (a.chien) return dogSVG(a, cls);
  return `<svg class="av ${cls || ''}" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="50" fill="${a.bg}"/>
    ${hairBack(a)}${outfit(a)}
    <path d="M42 60 V77 Q50 83 58 77 V60Z" fill="${a.skin}"/><path d="M42 64 Q50 71 58 64 V61 H42Z" fill="rgba(0,0,0,.08)"/>
    ${collar(a)}
    <ellipse cx="29" cy="49" rx="4.6" ry="6.2" fill="${a.skin}"/><ellipse cx="71" cy="49" rx="4.6" ry="6.2" fill="${a.skin}"/>
    <ellipse cx="50" cy="46" rx="21.5" ry="24.5" fill="${a.skin}"/>
    ${face(a)}${hairFront(a)}${glasses(a)}${extras(a)}${hat(a)}</svg>`;
}

B.PERSOS = PERSOS;
B.avatarSVG = avatarSVG;
})();
