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
    bio: 'Taille les rosiers de sa villa du Cap-Ferrat tous les matins. Compte ses atouts comme ses tomates : un par un, et sans en oublier.',
    gagne: 'Ah, ça pousse bien chez nous aujourd\'hui !', perd: 'Bien joué ! Vous avez la main verte, vous aussi.',
    avecGagne: 'On a bien semé, on récolte ! Bravo, partenaire.', avecPerd: 'Pas grave : il faut parfois tailler pour que ça repousse.',
    av: { bg: '#b9d3a8', skin: '#efc5a4', hair: '#eeece6', style: 'chauve', outfit: 'polo', cloth: '#4f7d4a', accent: '#f4f1e6', hat: 'paille', mustache: 'large' } },
  { name: 'Yvette', title: 'la comédienne',
    bio: 'Ancienne vedette des planches cannoises. Fait toujours une entrée remarquée, même pour dire « Passe ».',
    gagne: 'Merci, merci… Pas d\'autographe pendant la partie !', perd: 'Quelle performance… Vous méritez un César, ma chère !',
    avecGagne: 'Quel duo ! On nous rappelle sur scène !', avecPerd: 'Un petit trou de mémoire… La prochaine représentation sera la bonne !',
    av: { bg: '#f3c1cf', skin: '#f4d2bd', hair: '#f3e7c9', style: 'brushing', outfit: 'robe', cloth: '#b02a5b', sunglasses: true, lips: true, beauty: true, earrings: 'perle' } },
  { name: 'Gérard', title: 'le notaire de Cimiez',
    bio: 'Quarante ans d\'études notariales à Cimiez. Lit chaque enchère comme un contrat : lentement, et sans laisser passer une clause.',
    gagne: 'Tout est en règle : signé, paraphé, gagné.', perd: 'Je n\'ai rien à redire… et pourtant, j\'ai cherché.',
    avecGagne: 'Affaire conclue, et dans les règles. Félicitations !', avecPerd: 'Simple acte manqué : nous signerons la prochaine.',
    av: { bg: '#b8c6dc', skin: '#ecc4a6', hair: '#c7c4bd', style: 'court', outfit: 'costume', cloth: '#2c3e63', accent: '#7a1f2b', tie: 'cravate', glasses: 'carre', glassColor: '#5a3b22', forehead: true } },
  { name: 'Huguette', title: 'la parfumeuse de Grasse',
    bio: 'Un « nez » réputé de Grasse. Elle sent les impasses de loin… et porte toujours un brin de mimosa dans les cheveux.',
    gagne: 'Ça sentait bon pour nous, cette donne !', perd: 'Vous avez du flair, je dois l\'avouer.',
    avecGagne: 'Ça sent la victoire ! Quel joli bouquet.', avecPerd: 'Une note un peu amère… La prochaine sera plus douce.',
    av: { bg: '#d6c8ea', skin: '#f2cdb4', hair: '#d9d6d0', style: 'chignon', outfit: 'robe', cloth: '#7a5ea8', pearls: true, mimosa: true, earrings: 'or' } },
  { name: 'Raymond', title: 'le capitaine de Villefranche',
    bio: 'A navigué quarante ans sur son yacht en Méditerranée. Garde le cap dans toutes les enchères et ne coule jamais un contrat sans se battre.',
    gagne: 'Cap tenu, matelot ! Le contrat est au port.', perd: 'Je baisse pavillon : bien navigué !',
    avecGagne: 'Bien manœuvré ! On rentre au port en vainqueurs.', avecPerd: 'Un coup de mistral… On écope et on repart !',
    av: { bg: '#a9cde6', skin: '#e2ae8a', hair: '#f1f0ec', style: 'court', outfit: 'mariniere', cloth: '#ffffff', accent: '#1e3a6b', hat: 'capitaine', beard: true } },
  { name: 'Monique', title: 'la galeriste de Saint-Paul',
    bio: 'Tient une galerie d\'art à Saint-Paul-de-Vence. Collectionne les tableaux… et les levées. Ses lunettes rouges voient tout.',
    gagne: 'Un vrai chef-d\'œuvre, cette défense !', perd: 'Très joli coup. Je l\'encadrerais bien.',
    avecGagne: 'Un chef-d\'œuvre à quatre mains !', avecPerd: 'Ce n\'était qu\'une esquisse : le tableau sera parfait la prochaine fois.',
    av: { bg: '#f1d49a', skin: '#f0c9ad', hair: '#d2d4d8', style: 'carre', outfit: 'col-roule', cloth: '#26262b', glasses: 'rond', glassColor: '#d2232a', necklace: true, lips: true } },
  { name: 'Bernard', title: 'le chirurgien du Mont-Boron',
    bio: 'Ancien chef de chirurgie, retraité au Mont-Boron. Découpe les contrats adverses avec une précision… chirurgicale.',
    gagne: 'Opération réussie. Le patient n\'a rien senti.', perd: 'Intervention parfaite, docteur. Chapeau.',
    avecGagne: 'Opération réussie, et en équipe !', avecPerd: 'Petite complication, rien de grave. On recoud et on continue.',
    av: { bg: '#b4dfd2', skin: '#efc8aa', hair: '#e4e2dc', style: 'chauve', outfit: 'blouse', cloth: '#ffffff', accent: '#8fbbe0', glasses: 'rond', glassColor: '#3a3a3a', forehead: true } },
  { name: 'Ginette', title: 'la reine du golf de Mougins',
    bio: 'Handicap 12 au golf de Mougins, mais aucun au bridge. Garde sa visière même au salon, « pour la concentration ».',
    gagne: 'Trou en un ! Enfin… contrat en un.', perd: 'Joli swing ! Vous m\'avez eue au dernier trou.',
    avecGagne: 'Birdie ! On fait une sacrée équipe.', avecPerd: 'Un coup dans le bunker… On se rattrape au trou suivant !',
    av: { bg: '#bfe0a8', skin: '#e9bb98', hair: '#f4f3ef', style: 'frise', outfit: 'polo', cloth: '#e86f9a', accent: '#ffffff', hat: 'visiere', hatColor: '#ffffff', earrings: 'or' } },
  { name: 'Lucien', title: 'l\'antiquaire du Vieux-Nice',
    bio: 'Antiquaire rue Droite, dans le Vieux-Nice. Examine chaque carte au monocle : pour lui, une Dame de pique de 1950 vaut une fortune.',
    gagne: 'Une pièce rare, cette levée ! Je la garde.', perd: 'Superbe. Une vraie pièce de collection.',
    avecGagne: 'Une victoire de grande valeur : je la mets en vitrine !', avecPerd: 'Un petit défaut sur la pièce… elle garde tout son charme.',
    av: { bg: '#e6c2b0', skin: '#efc6a8', hair: '#bdb8ae', style: 'raie', outfit: 'gilet', cloth: '#7b4a2a', accent: '#1f5c4a', tie: 'noeud', monocle: true, mustache: 'fine' } },
  { name: 'Colette', title: 'la cheffe étoilée de Mougins',
    bio: 'Ancienne cheffe étoilée à Mougins. Mijote ses enchères à feu doux… puis vous sert le chelem.',
    gagne: 'Et voilà, c\'est servi chaud !', perd: 'Délicieux ! Je vous mets trois étoiles.',
    avecGagne: 'Une recette parfaite, cuisinée à deux !', avecPerd: 'Un peu trop cuit… On remet la casserole sur le feu !',
    av: { bg: '#f6c9a8', skin: '#f1cbb0', hair: '#cfcac2', style: 'court-f', outfit: 'cuisine', cloth: '#ffffff', hat: 'toque', earrings: 'perle' } },
  { name: 'Albert', title: 'le banquier de Monaco',
    bio: 'A dirigé une banque privée à Monaco. Ne joue que des cartes à haut rendement et garde toujours un atout en réserve, comme ses lingots.',
    gagne: 'Excellent placement : les intérêts sont pour nous.', perd: 'Beau rendement, je dois l\'admettre.',
    avecGagne: 'Excellent rendement pour notre association !', avecPerd: 'Une petite perte : les marchés remontent toujours.',
    av: { bg: '#e8d79e', skin: '#ecc3a3', hair: '#dcdad5', style: 'raie', outfit: 'costume', cloth: '#1d1f29', accent: '#c9a34a', tie: 'cravate', pochette: true, glasses: 'carre', glassColor: '#c9a34a', mustache: 'fine' } },
  { name: 'Paulette', title: 'l\'hôtelière de la Promenade',
    bio: 'A tenu un grand hôtel sur la Promenade des Anglais. Accueille vos contrats avec le sourire… et les fait chuter avec élégance.',
    gagne: 'La maison vous remercie de votre visite !', perd: 'Bravo ! Je vous offre la suite avec vue mer.',
    avecGagne: 'Champagne pour notre table ! Bravo.', avecPerd: 'La maison vous offre la revanche, bien sûr !',
    av: { bg: '#bcd4ef', skin: '#f3d0b8', hair: '#f7f5f0', style: 'brushing', outfit: 'robe', cloth: '#2f5d9e', pearls: true, earrings: 'perle', lips: true } },
];

const BROW = 'rgba(90, 80, 70, .75)';
const LINE = 'rgba(0, 0, 0, .16)';

function hairFront(a) {
  const h = a.hair, f = `fill="${h}"`;
  switch (a.style) {
    case 'chauve':
      return `<path d="M28.5 50 C27 38 30 31 35.5 28.5 C33 35 33 42 33.5 50Z" ${f}/><path d="M71.5 50 C73 38 70 31 64.5 28.5 C67 35 67 42 66.5 50Z" ${f}/>
        <ellipse cx="43" cy="28" rx="7" ry="3" fill="#fff" opacity=".28"/>`;
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
    <path d="M37.5 42.5 Q42 39.8 46.3 42" stroke="${BROW}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M53.7 42 Q58 39.8 62.5 42.5" stroke="${BROW}" stroke-width="2" fill="none" stroke-linecap="round"/>
    <path d="M35 46.5 l-2.6 -1.1 M35 49.2 l-2.6 .9 M65 46.5 l2.6 -1.1 M65 49.2 l2.6 .9" stroke="${LINE}" stroke-width="1" stroke-linecap="round"/>
    <path d="M50 49.5 Q47.3 56 50.6 57.2" stroke="rgba(0,0,0,.25)" stroke-width="1.6" fill="none" stroke-linecap="round"/>
    <circle cx="37.5" cy="56" r="3.8" fill="#ee8270" opacity=".32"/><circle cx="62.5" cy="56" r="3.8" fill="#ee8270" opacity=".32"/>
    <path d="M39.5 57.5 Q40.5 62 43 64 M60.5 57.5 Q59.5 62 57 64" stroke="${LINE}" stroke-width="1" fill="none"/>`;
  if (a.forehead) s += `<path d="M43 33.5 Q50 32 57 33.5 M44.5 36.5 Q50 35.3 55.5 36.5" stroke="${LINE}" stroke-width="1" fill="none"/>`;
  if (a.beard) s += `<path d="M28.5 50 C29.5 67 39 75.5 50 75.5 C61 75.5 70.5 67 71.5 50 C68.5 58 63 61.5 57 61 Q50 59 43 61 C37 61.5 31.5 58 28.5 50Z" fill="${a.hair}" stroke="rgba(0,0,0,.06)"/>`;
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
function avatarSVG(p, cls) {
  const a = p.av;
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
