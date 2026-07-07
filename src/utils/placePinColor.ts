// Curated pin colours for admin "place" pins — a single, consistent, premium palette where each
// emoji maps to a hand-picked background that matches its MEANING (food = warm coral, beach =
// ocean blue, nature = green, nightlife = violet, …). Used as the smart default; admins can also
// pick any colour from PLACE_COLORS. Kept separate from emojiColor.ts (the group chat colouring).

const PALETTE = {
  food:     '#E5573E', // warm coral-red — savoury food
  sweets:   '#EC5F97', // rose — desserts
  coffee:   '#A9744F', // mocha — coffee / tea
  drink:    '#1FA9BD', // aqua — cold soft drinks
  alcohol:  '#D99A28', // amber gold — beer / spirits
  wine:     '#9E3B57', // burgundy — wine
  beach:    '#0EA5E9', // ocean blue — beach / sea
  nature:   '#3BA35F', // forest green — nature / plants / animals
  religion: '#7A57C2', // spiritual purple
  shopping: '#C557A0', // magenta — shopping / fashion
  sport:    '#2F80ED', // energetic blue — sport / activity
  travel:   '#4C63D2', // indigo — travel / transport
  landmark: '#BE8A3D', // bronze — landmarks / culture / attractions
  night:    '#8B5CF6', // violet — nightlife / music / party
  health:   '#E5556B', // medical red
  home:     '#5B93C9', // soft blue — home / lodging
  star:     '#F0A825', // gold — recommendations (⭐)
  default:  '#64748B', // premium slate — anything uncategorised
} as const;

// emoji → semantic group. Order doesn't matter; each emoji appears once.
const GROUPS: Array<[string, string[]]> = [
  [PALETTE.food, [
    '🍕','🍔','🌭','🥪','🌮','🌯','🫔','🥙','🧆','🥗','🥘','🫕','🍝','🍜','🍲','🍛','🍣','🍱',
    '🥟','🍤','🍙','🍚','🍘','🍥','🥠','🥡','🍢','🦪','🍟','🥩','🥓','🍖','🍗','🥚','🍳','🧈',
    '🥞','🧇','🫓','🥯','🥖','🍞','🧀','🥨','🥐','🧄','🧅','🥔','🥕','🌽','🥦','🥬','🥒','🍅',
    '🍆','🥑','🫑','🌶️','🍇','🍈','🍉','🍊','🍋','🍌','🍍','🥭','🍎','🍏','🍐','🍑','🍒','🍓','🫐','🥝',
  ]],
  [PALETTE.sweets, [
    '🍰','🧁','🎂','🥧','🍮','🍭','🍬','🍫','🍩','🍪','🥮','🍡','🍨','🍧','🍦','🍯','🍿',
  ]],
  [PALETTE.coffee, ['☕','🍵','🫖']],
  [PALETTE.drink,  ['🧃','🥤','🧋','🥛']],
  [PALETTE.alcohol,['🍺','🍻','🥂','🍸','🍹','🥃','🍶','🍾','🧉']],
  [PALETTE.wine,   ['🍷']],
  [PALETTE.beach, [
    '🏖️','🏝️','⛱️','🌴','🥥','🌊','🏄','🤿','🩴','🐚','🐠','🐟','🐬','🐳','🐋','🦈','🐙','🦀',
    '🦞','🦐','🦑','⛵','🚤','🛥️','🛶','🚣','🏊','🤽','🌅','🌇',
  ]],
  [PALETTE.nature, [
    '🌿','🌲','🌳','🌵','🍀','🌱','☘️','🍃','🍂','🍁','🍄','🌾','🌻','🌺','🌸','🌼','🌷','🌹',
    '💐','🏞️','⛰️','🏔️','🗻','🌄','🏕️','🐶','🐱','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷',
    '🐸','🐵','🐔','🐧','🐦','🦉','🦋','🐝','🐞','🦌','🐿️','🦔','🐢','🦎','🐎','🐄','🐑','🐐',
    '🦒','🐘','🦓','🐫','🦘','🐇','🐈','🐕',
  ]],
  [PALETTE.religion, ['🕍','⛪','🕌','🛕','📿','✡️','✝️','☪️','🕉️','☸️','🔯','🕎','🛐','⛩️','🙏','📖','🕯️','☦️']],
  [PALETTE.shopping, ['🛍️','🛒','🏬','🏪','👗','👠','👜','👛','👝','💄','💍','👓','🕶️','👑','🧥','👖','👟','🧴','✂️','💇','💆','🎁','👒','🎀']],
  [PALETTE.sport, [
    '⚽','🏀','🏈','⚾','🎾','🏐','🏉','🎱','🏓','🏸','🥊','🥋','🎯','⛳','🎽','🎿','🛷','🥌','⛸️',
    '🏹','🛹','🚵','🏇','🧘','🏋️','🤸','🤼','🤺','🧗','🏌️','🏆','🥇','🥈','🥉','🚴','🏃','🤾','⛷️','🏂','🤹',
  ]],
  [PALETTE.travel, [
    '✈️','🛫','🛬','🚗','🚕','🚌','🚂','🚇','🚉','🚊','🚝','🚄','🚅','🛵','🏍️','🚲','🛴','🚁','🛸',
    '🚀','🧳','🗺️','🧭','🚢','🛳️','⛴️','🛺','🚙','🚐','🚚','🛻','⛽','🅿️','🚏','🚘',
  ]],
  [PALETTE.landmark, ['🏛️','🏰','🗼','🗽','🎭','🎨','🖼️','🏟️','🗿','🏯','💒','🏢','🏣','🏤','🏦','🏨','🏫','🌉','🌃','🌆','🎡','🎢','🎠','🎪']],
  [PALETTE.night, ['🎧','🎵','🎶','🎤','🎸','🎹','🎷','🎺','🥁','🎻','🪕','🪗','🎼','🎉','🎊','🪩','💃','🕺','🎆','🎇','🎮','🕹️','🎬','🎲','🃏','🎰']],
  [PALETTE.health, ['🏥','💊','💉','🩺','🩹','🩸','🚑','⚕️','🧬','🩻','🦷','🧠']],
  [PALETTE.home, ['🏠','🏡','🏘️','🛏️','🛋️','🚪','🔑']],
  [PALETTE.star, ['⭐','🌟','✨','💫']],
];

const MAP: Record<string, string> = {};
for (const [color, list] of GROUPS) for (const e of list) MAP[e] = color;

/** Hand-picked, meaning-matched background colour for a place pin's emoji (smart default). */
export function placePinColor(emoji: string): string {
  return MAP[emoji] || PALETTE.default;
}

/** The full curated palette, ordered warm → cool, for a manual colour picker. */
export const PLACE_COLORS: string[] = [
  PALETTE.food, PALETTE.sweets, PALETTE.star, PALETTE.alcohol, PALETTE.coffee, PALETTE.wine,
  PALETTE.health, PALETTE.shopping, PALETTE.night, PALETTE.religion, PALETTE.travel, PALETTE.sport,
  PALETTE.home, PALETTE.beach, PALETTE.drink, PALETTE.nature, PALETTE.landmark, PALETTE.default,
];
