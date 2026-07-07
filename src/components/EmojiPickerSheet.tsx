import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { Search, X } from 'lucide-react';

/* ─────────────────────────────────────── types ─── */

interface Cat { id: string; name: string; icon: string }

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedEmoji: string;
  onSelect: (emoji: string) => void;
}

/* ─────────────────────────────────────── data ──── */

const CATS: Cat[] = [
  { id: 'smileys',    name: 'Smileys & Emotion',  icon: '😊' },
  { id: 'people',     name: 'People & Body',       icon: '🤝' },
  { id: 'nature',     name: 'Animals & Nature',    icon: '🐶' },
  { id: 'food',       name: 'Food & Drink',        icon: '🍕' },
  { id: 'travel',     name: 'Travel & Places',     icon: '✈️' },
  { id: 'activities', name: 'Activities',          icon: '⚽' },
  { id: 'objects',    name: 'Objects',             icon: '💡' },
  { id: 'symbols',    name: 'Symbols',             icon: '❤️' },
  { id: 'flags',      name: 'Flags',               icon: '🏳️' },
];

const GROUPS: Record<string, string[]> = {
  smileys: [
    '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇',
    '🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝',
    '🤑','🤗','🤭','🫢','🫣','🤫','🤔','🫠','🤐','🥴','😐','😑','😶',
    '🫥','😏','😒','🙄','😬','🤥','🫨','😌','😔','😪','🤤','😴','😷',
    '🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥱','😵','💫','🤯','🤠','🥳',
    '🥸','😎','🤓','🧐','😕','🫤','😟','🙁','😮','😯','😲','😳','🥺',
    '😦','😧','😨','😰','😥','😢','😭','😱','😖','😣','😞','😓','😩',
    '😫','😤','😡','😠','🤬','😈','👿','💀','☠️','💩','🤡','👹','👺',
    '👻','👽','👾','🤖',
  ],
  people: [
    '👋','🤚','🖐️','✋','🖖','🤙','👌','✌️','🤞','🤟','🤘','👆','👇',
    '👉','👈','☝️','👍','👎','✊','👊','🤛','🤜','🤝','🙌','👐','🤲',
    '🙏','👏','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','👀','👁️','👅',
    '👄','👶','🧒','👦','👧','🧑','👱','👨','👩','🧔','👴','👵','🧓',
    '🧑‍🦰','🧑‍🦱','🧑‍🦳','🧑‍🦲','💆','💇','🧖','🛀','🧘','🏃','🚶','🧍',
    '🧎','👫','👬','👭','💏','💑','👪','🧙','🧝','🧛','🧜','🧚','👼',
    '🤶','🎅','🦸','🦹','🧑‍⚕️','🧑‍🎓','🧑‍🏫','🧑‍⚖️','🧑‍🌾','🧑‍🍳','🧑‍🔧','🧑‍🏭',
    '🧑‍💼','🧑‍🔬','🧑‍🎨','🧑‍✈️','🧑‍🚀','🧑‍🚒',
  ],
  nature: [
    '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷',
    '🐸','🐵','🙈','🙉','🙊','🐔','🐧','🐦','🐤','🦆','🦅','🦉','🦇',
    '🐝','🐛','🦋','🐌','🐞','🐜','🦟','🦗','🦂','🐢','🐍','🦎','🦕',
    '🐙','🦑','🦐','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈','🦭','🐊',
    '🐅','🐆','🦓','🦍','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🐃','🐂',
    '🐄','🐎','🐖','🐏','🐑','🦙','🐐','🦌','🐕','🐩','🐈','🐓','🦃',
    '🦚','🦜','🦢','🦩','🕊️','🐇','🦝','🦨','🦡','🦦','🦥','🐁','🐀','🐿️',
    '🦔','🐾','🐉','🌵','🎄','🌲','🌳','🌴','🌱','🌿','☘️','🍀','🍃',
    '🍂','🍁','🍄','🌾','💐','🌷','🌹','🌺','🌸','🌼','🌻','🌙','⭐',
    '🌟','💫','⚡','🌈','☀️','⛅','☁️','🌦️','🌧️','⛈️','🌨️','❄️','☃️',
    '⛄','💨','🌊',
  ],
  food: [
    '🍇','🍈','🍉','🍊','🍋','🍌','🍍','🥭','🍎','🍏','🍐','🍑','🍒',
    '🍓','🫐','🥝','🍅','🫒','🥥','🥑','🍆','🥔','🥕','🌽','🌶️','🫑',
    '🥒','🥬','🥦','🧄','🧅','🌰','🍞','🥐','🥖','🫓','🥨','🥯','🧀',
    '🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔','🍟','🍕',
    '🫔','🌮','🌯','🥙','🧆','🥗','🥘','🫕','🍝','🍜','🍲','🍛','🍣',
    '🍱','🥟','🍤','🍙','🍚','🍘','🍥','🥮','🍡','🧁','🍰','🎂','🍮',
    '🍭','🍬','🍫','🍿','🍩','🍪','🥜','🍯','☕','🍵','🧃','🥤','🧋',
    '🫖','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧉','🍾',
  ],
  travel: [
    '🌍','🌎','🌏','🌐','🗺️','🧭','🏔️','⛰️','🌋','🗻','🏕️','🏖️','🏜️',
    '🏝️','🏞️','🏟️','🏛️','🏗️','🏘️','🏚️','🏠','🏡','🏢','🏣','🏤','🏥',
    '🏦','🏨','🏩','🏪','🏫','🏬','🏭','🏯','🏰','💒','🗼','🗽','⛪',
    '🕌','⛩️','🕍','⛲','⛺','🚂','🚃','🚄','🚅','🚆','🚇','🚈','🚉',
    '🚊','🚝','🚞','🚋','🚌','🚍','🚎','🚐','🚑','🚒','🚓','🚔','🚕',
    '🚖','🚗','🚘','🚙','🛻','🚚','🚛','🚜','🏎️','🏍️','🛵','🛺','🚲',
    '🛴','🛹','🛼','⛽','🚢','✈️','🛩️','🛫','🛬','🪂','🚁','🛸','🚀',
    '🪐','🌠','🌌','🌃','🌆','🌇','🌉','🌁','⛵','🚣','🛥️','🛳️','⛴️',
  ],
  activities: [
    '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🎱','🏓','🏸','🏒','🥊',
    '🥋','🎯','⛳','🎽','🎿','🛷','🥌','⛸️','🎣','🤿','🛹','🎠','🎡',
    '🎢','🎪','🤹','🎭','🎨','🖼️','🎰','🚵','🏇','🧘','🏋️','🤸','🤼',
    '🤺','🏊','🤽','🚣','🧗','🏌️','🏄','🏆','🥇','🥈','🥉','🏅','🎖️',
    '🏵️','🎗️','🎫','🎟️','🎬','🎤','🎧','🎼','🎹','🎸','🎺','🎻','🥁',
    '🪘','🎷','🪗','🪕','🎙️','🎵','🎶','🎊','🎉','🎏','🎀','🎁','🎈',
    '🎆','🎇','🧨','🎑','🎃','🎄','🎋','🎍',
  ],
  objects: [
    '📱','💻','⌨️','🖥️','🖨️','🖱️','🖲️','💽','💾','💿','📀','🧮','📞',
    '☎️','📟','📠','🔋','🔌','💡','🔦','🕯️','🪔','🗑️','💰','💴','💵',
    '💶','💷','💸','💳','🪙','💹','📈','📉','📊','🗒️','📜','📃','📄',
    '📑','🗃️','🗂️','🗄️','📆','📅','🗓️','📋','📝','✏️','🖊️','🖋️','✂️',
    '📎','🖇️','📐','📏','🔍','🔎','🔏','🔐','🔒','🔓','🔑','🗝️','🔨',
    '⛏️','🪚','⚒️','🛠️','🗡️','⚔️','🔫','🪃','🛡️','🔧','🔩','⚙️','🗜️',
    '🔗','⛓️','🧲','🪜','🧰','💊','💉','🩸','🩹','🩺','🩻','🩼','🪖',
    '👒','🎩','🧢','⛑️','📿','💄','💍','💎','👜','👛','👝','🎒','🧳',
    '🌂','☂️','🧵','🧶','🪡','🧷','👓','🕶️','🥽','🔭','🔬','💈',
  ],
  symbols: [
    '❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞',
    '💓','💗','💖','💘','💝','💟','🫶','❤️‍🔥','☮️','✝️','☪️','🕉️','☸️',
    '✡️','🔯','🕎','☯️','☦️','🛐','⛎','♈','♉','♊','♋','♌','♍',
    '♎','♏','♐','♑','♒','♓','🆔','⚕️','♻️','⚜️','🔰','✅','❎',
    '🆗','🆙','🆒','🆕','🆓','🔞','🔅','🔆','💯','🔱','♿','🚾',
    '🅿️','❓','❔','❕','❗','❇️','✳️','🔴','🟠','🟡','🟢','🔵','🟣',
    '⚫','⚪','🟤','🔺','🔻','💠','🔷','🔹','🔶','🔸','◾','◽','◼',
    '◻','⬛','⬜','🔈','🔉','🔊','📣','📢','💬','💭','🗯️','💤','🔔',
    '🔕','✨','🌟','💫','⚡','🔥','💥','🌀',
  ],
  flags: [
    '🏳️','🏴','🏁','🚩','🏳️‍🌈','🏳️‍⚧️','🏴‍☠️','🇺🇸','🇬🇧','🇨🇦','🇦🇺',
    '🇩🇪','🇫🇷','🇮🇹','🇪🇸','🇵🇹','🇷🇺','🇯🇵','🇨🇳','🇰🇷','🇮🇳','🇧🇷',
    '🇲🇽','🇦🇷','🇮🇱','🇿🇦','🇳🇬','🇬🇭','🇰🇪','🇪🇹','🇹🇿','🇸🇪','🇳🇴',
    '🇩🇰','🇫🇮','🇳🇱','🇧🇪','🇨🇭','🇦🇹','🇵🇱','🇨🇿','🇭🇺','🇷🇴','🇬🇷',
    '🇹🇷','🇮🇩','🇵🇭','🇹🇭','🇻🇳','🇲🇾','🇸🇬','🇳🇿','🇦🇪','🇸🇦','🇮🇶',
    '🇮🇷','🇵🇰','🇧🇩','🇱🇰','🇲🇲','🇪🇬','🇩🇿','🇲🇦','🇹🇳','🇱🇾','🇸🇩',
    '🇨🇮','🇨🇲','🇺🇬','🇦🇴','🇿🇼','🇲🇬','🇿🇲','🇲🇿',
  ],
};

/* keyword index — covers the most-searched emojis */
const KW: Record<string, string> = {
  '😀':'grin happy smile','😃':'happy smile face','😄':'smile grinning','😁':'beam grin','😆':'laugh funny haha',
  '😅':'sweat nervous laugh','🤣':'rofl laugh floor','😂':'joy laugh cry funny lol','🙂':'slight smile',
  '🙃':'upside smile irony','😉':'wink','😊':'smile blush happy','😇':'angel halo innocent',
  '🥰':'love hearts smiling','😍':'heart eyes love','🤩':'star struck amazing','😘':'kiss love',
  '😋':'yum food tasty','😛':'tongue playful','😜':'wink tongue silly','🤪':'crazy silly wacky',
  '🤑':'money dollar rich','🤗':'hug happy embrace','🤔':'think hmm curious idea','🤐':'zip mouth silent',
  '🥴':'dizzy confused drunk','😐':'neutral blank','😏':'smirk sly','😒':'unamused annoyed',
  '🙄':'eye roll annoyed','😬':'grimace awkward','🤥':'lying liar','😔':'sad pensive',
  '😪':'sleepy tired','😴':'sleep zzz tired','😷':'mask sick ill','🤒':'sick fever',
  '🤕':'hurt bandage injured','🤢':'nausea sick','🤮':'vomit sick','🤧':'sneeze cold',
  '🥵':'hot sweat fire','🥶':'cold freeze ice','🥱':'yawn bored tired','😵':'dizzy spiral',
  '🤯':'mindblown exploding','🤠':'cowboy western','🥳':'party celebrate birthday',
  '😎':'cool sunglasses awesome','🤓':'nerd glasses smart','🧐':'monocle curious',
  '😢':'crying sad tear','😭':'crying loud sob','😱':'scream horror fear',
  '😫':'tired exhausted','😤':'angry steam','😡':'angry mad','😠':'angry annoyed',
  '🤬':'swearing cursing','😈':'devil evil','💀':'skull death dead','☠️':'skull crossbones pirate',
  '💩':'poop funny','🤡':'clown joker','👻':'ghost halloween','🤖':'robot machine',
  '👋':'wave hand hello bye','👍':'thumbs up good yes like','👎':'thumbs down no dislike',
  '🤝':'handshake deal agreement','🙌':'celebrate clap hands','👏':'clap applause',
  '🙏':'pray please thank folded','💪':'muscle strong bicep','👶':'baby infant',
  '👦':'boy child','👧':'girl child','👨':'man adult male','👩':'woman adult female',
  '👴':'old man grandpa','👵':'old woman grandma',
  '🐶':'dog puppy pet','🐱':'cat kitty pet','🐭':'mouse','🐹':'hamster','🐰':'rabbit bunny',
  '🦊':'fox','🐻':'bear','🐼':'panda','🐨':'koala','🐯':'tiger','🦁':'lion king',
  '🐮':'cow moo farm','🐷':'pig oink','🐸':'frog green','🐵':'monkey ape',
  '🐔':'chicken bird','🐧':'penguin cold','🐦':'bird tweet','🦅':'eagle fly',
  '🦉':'owl wise','🦋':'butterfly insect','🐝':'bee honey','🐛':'bug caterpillar',
  '🐞':'ladybug bug','🐢':'turtle slow','🐍':'snake','🦎':'lizard','🐙':'octopus sea',
  '🦀':'crab seafood','🐬':'dolphin ocean','🐳':'whale ocean','🦈':'shark danger',
  '🐊':'crocodile','🐘':'elephant big','🦒':'giraffe tall','🐎':'horse run',
  '🐕':'dog pet','🐈':'cat pet','🌵':'cactus desert','🌲':'tree pine forest',
  '🌳':'tree nature park','🌴':'palm tropical beach','🌱':'seedling plant grow',
  '🌿':'herb plant nature','☘️':'shamrock clover lucky','🍀':'four leaf clover lucky',
  '🍃':'leaf green nature','🍂':'autumn fall','🍁':'maple leaf canada autumn',
  '🍄':'mushroom fungi','🌾':'wheat grass','💐':'bouquet flowers gift',
  '🌷':'tulip flower','🌹':'rose love red','🌺':'hibiscus flower','🌸':'cherry blossom spring',
  '🌼':'blossom yellow','🌻':'sunflower','🌙':'moon night crescent','⭐':'star yellow',
  '🌟':'glowing star bright','💫':'dizzy sparkle','⚡':'lightning electricity',
  '🌈':'rainbow colorful pride','☀️':'sun sunny warm','❄️':'snowflake cold winter',
  '☃️':'snowman winter','🌊':'wave ocean sea water',
  '🍕':'pizza food italian','🍔':'burger hamburger fast food','🍟':'fries chips',
  '🌮':'taco mexican food','🌯':'wrap burrito','🍜':'noodles ramen soup',
  '🍣':'sushi japanese fish','🍱':'bento japanese','🍛':'curry rice indian',
  '🍝':'pasta spaghetti italian','🍲':'stew pot soup','🥗':'salad healthy',
  '🥞':'pancakes breakfast','🧇':'waffle breakfast','🥓':'bacon breakfast',
  '🥩':'steak meat','🍗':'chicken','🍖':'bone meat bbq','🌭':'hotdog sausage',
  '🍰':'cake slice dessert','🎂':'birthday cake','🧁':'cupcake sweet','🍩':'donut sweet',
  '🍪':'cookie biscuit','🍫':'chocolate sweet','🍿':'popcorn movie','☕':'coffee hot drink',
  '🍵':'tea hot drink','🧋':'bubble tea boba','🍺':'beer mug','🍻':'beers cheers',
  '🥂':'champagne celebrate','🍷':'wine red drink','🥃':'whiskey','🍸':'cocktail martini',
  '🍹':'tropical cocktail','🍾':'champagne bottle celebrate',
  '✈️':'airplane fly travel','🚀':'rocket space launch','🚢':'ship cruise ocean',
  '🚗':'car drive','🚕':'taxi cab','🚌':'bus transport','🚂':'train locomotive',
  '🚇':'metro subway','🚲':'bicycle bike','🛵':'scooter moped','🏎️':'racing car fast',
  '🏍️':'motorcycle bike','⛵':'sailboat boat','🚁':'helicopter fly','🛸':'ufo alien space',
  '🌍':'earth globe africa europe','🌎':'earth americas','🌏':'earth asia',
  '🗺️':'map world travel','🧭':'compass navigation','🏔️':'mountain snow peak',
  '🏕️':'camping tent outdoor','🏖️':'beach sand sun','🏜️':'desert sand',
  '🏝️':'island tropical','🏞️':'national park','🏠':'house home','🏡':'house garden',
  '🏰':'castle medieval','🗼':'eiffel tower paris','🗽':'statue liberty new york',
  '🌃':'night city stars','🌆':'sunset city','🌉':'bridge night',
  '⚽':'soccer football sport','🏀':'basketball sport','🏈':'american football',
  '⚾':'baseball sport','🎾':'tennis sport','🏐':'volleyball','🏉':'rugby',
  '🎱':'billiards pool','🏓':'ping pong table tennis','🏸':'badminton',
  '🥊':'boxing fight','🥋':'martial arts karate','🎯':'target dart goal',
  '⛳':'golf','🏆':'trophy winner award','🥇':'gold medal first',
  '🥈':'silver medal second','🥉':'bronze medal third','🎨':'art palette creative',
  '🎬':'movie cinema film','🎤':'microphone sing','🎧':'headphones music',
  '🎹':'piano keyboard music','🎸':'guitar rock','🎺':'trumpet','🎻':'violin classic',
  '🥁':'drums beat','🎷':'saxophone jazz','🎵':'music note song','🎶':'musical notes',
  '🎊':'confetti party','🎉':'party tada celebration','🎈':'balloon party',
  '🎁':'gift present box','🎃':'halloween pumpkin','🎄':'christmas tree holiday',
  '🏋️':'weightlifting gym','🏊':'swimming pool','🧘':'yoga meditation calm',
  '🏄':'surfing wave','🤿':'diving scuba underwater','🎿':'ski skiing winter',
  '📱':'phone mobile smartphone','💻':'laptop computer','🖥️':'desktop monitor',
  '💡':'lightbulb idea','🔦':'flashlight torch','💰':'money bag cash',
  '💵':'dollar money','💳':'credit card payment','📊':'chart graph data',
  '📈':'chart growth','📝':'memo note write','✏️':'pencil write draw',
  '✂️':'scissors cut','🔍':'search magnify','🔒':'lock secure','🔓':'unlock open',
  '🔑':'key access','🔨':'hammer tool','🛠️':'tools fix','⚔️':'swords fight',
  '🔧':'wrench fix','⚙️':'gear settings','🧲':'magnet','🧰':'toolbox repair',
  '💊':'pill medicine','💉':'syringe injection','🩺':'stethoscope doctor',
  '🧢':'cap hat baseball','🎩':'top hat formal','👒':'hat straw summer',
  '💍':'ring diamond','💎':'gem diamond','👜':'purse bag','🎒':'backpack bag school',
  '🧳':'luggage suitcase travel','🌂':'umbrella rain','👓':'glasses spectacles',
  '🕶️':'sunglasses cool','🔭':'telescope astronomy','🔬':'microscope science',
  '❤️':'heart love red','🧡':'heart orange','💛':'heart yellow','💚':'heart green',
  '💙':'heart blue','💜':'heart purple','🖤':'heart black','💔':'broken heart sad',
  '💕':'two hearts love','💖':'sparkling heart','💘':'heart arrow love',
  '🫶':'heart hands love','❤️‍🔥':'heart fire passion','✅':'check done yes',
  '❎':'cross no cancel','🔴':'red circle','🟢':'green circle','🔵':'blue circle',
  '⚫':'black circle','⚪':'white circle','💯':'hundred perfect score',
  '✨':'sparkles magic','🔥':'fire hot flame','💥':'explosion boom',
  '💬':'speech chat','💭':'thought thinking','💤':'sleep zzz','🔔':'bell notification',
  '❓':'question mark','❗':'exclamation mark','♻️':'recycle green','☮️':'peace',
  '🌀':'cyclone spiral swirl',
};

/* flat list for search */
const ALL_EMOJIS = Object.values(GROUPS).flat();

/* ─────────────────────────────────────── component ─ */

export function EmojiPickerSheet({ isOpen, onClose, selectedEmoji, onSelect }: Props) {
  const [query,     setQuery]     = useState('');
  const [activeCat, setActiveCat] = useState('smileys');
  const dragControls = useDragControls();
  const searchRef    = useRef<HTMLInputElement>(null);
  const gridRef      = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) { setQuery(''); setActiveCat('smileys'); }
  }, [isOpen]);

  useEffect(() => {
    if (gridRef.current) gridRef.current.scrollTop = 0;
  }, [activeCat, query]);

  const searchResults = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return null;
    return ALL_EMOJIS.filter(e => (KW[e] || '').includes(q) || e === q);
  }, [query]);

  const isSearching = searchResults !== null;
  const displayed   = isSearching ? searchResults! : (GROUPS[activeCat] || []);
  const title       = isSearching
    ? (searchResults!.length === 0 ? 'No results' : 'Search Results')
    : CATS.find(c => c.id === activeCat)?.name || '';

  const handleSelect = useCallback((emoji: string) => {
    onSelect(emoji);
    onClose();
  }, [onSelect, onClose]);

  const switchCat = useCallback((id: string) => {
    setActiveCat(id);
    setQuery('');
  }, []);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* semi-transparent overlay */}
          <motion.div
            className="fixed inset-0 z-[70]"
            style={{ background: 'rgba(0,0,0,0.50)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22 }}
            onClick={onClose}
          />

          {/* bottom sheet */}
          <motion.div
            dir="ltr"
            className="fixed bottom-0 left-0 right-0 bg-white z-[71] flex flex-col"
            style={{
              maxHeight: 'calc(76dvh - env(safe-area-inset-bottom, 0px))',
              borderRadius: '26px 26px 0 0',
              boxShadow: '0 -6px 48px rgba(0,0,0,0.18)',
            }}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0, bottom: 0.35 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 500) onClose();
            }}
          >
            {/* drag handle */}
            <div
              className="w-full pt-3 pb-2 flex justify-center flex-shrink-0 cursor-grab active:cursor-grabbing touch-none select-none"
              onPointerDown={e => dragControls.start(e)}
            >
              <div className="w-9 h-[4px] rounded-full bg-[#D1D1D6]" />
            </div>

            {/* search bar */}
            <div className="px-4 pb-3 flex-shrink-0">
              <div className="flex items-center gap-2 bg-[#F2F2F7] rounded-[12px] px-3 h-11">
                <Search size={15} className="text-[#8E8E93] flex-shrink-0" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Search"
                  className="flex-1 bg-transparent border-none outline-none text-[16px] text-[#1C1C1E] placeholder-[#8E8E93]"
                />
                {query && (
                  <button
                    onClick={() => setQuery('')}
                    className="flex-shrink-0 w-[18px] h-[18px] rounded-full bg-[#AEAEB2] flex items-center justify-center"
                  >
                    <X size={10} className="text-white" />
                  </button>
                )}
              </div>
            </div>

            {/* category label */}
            <div className="px-4 pb-2 flex-shrink-0">
              <p className="text-[12px] font-semibold text-[#8E8E93] tracking-wider uppercase">
                {title}
              </p>
            </div>

            {/* emoji grid */}
            <div ref={gridRef} className="flex-1 overflow-y-auto overscroll-contain px-2" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)' }}>
              {displayed.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-28 gap-2">
                  <p className="text-3xl">🔍</p>
                  <p className="text-sm text-[#8E8E93]">No emojis found</p>
                </div>
              ) : (
                <div className="grid grid-cols-8 gap-0.5">
                  {displayed.map((emoji, i) => (
                    <button
                      key={`${emoji}-${i}`}
                      onClick={() => handleSelect(emoji)}
                      className={`
                        aspect-square flex items-center justify-center
                        text-[26px] rounded-[10px] transition-all duration-100
                        active:scale-90
                        ${selectedEmoji === emoji
                          ? 'bg-black/[0.09] scale-105'
                          : 'hover:bg-black/[0.05]'}
                      `}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* bottom category nav */}
            <div
              className="flex-shrink-0 flex items-center px-1 gap-0"
              style={{
                borderTop: '1px solid #E5E5EA',
                paddingTop: 8,
                paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 8px)',
              }}
            >
              {CATS.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => switchCat(cat.id)}
                  className={`
                    flex-1 h-10 flex items-center justify-center rounded-[10px]
                    text-[20px] transition-colors duration-150
                    ${activeCat === cat.id && !isSearching
                      ? 'bg-[#E5E5EA]'
                      : 'hover:bg-black/[0.04]'}
                  `}
                  title={cat.name}
                >
                  {cat.icon}
                </button>
              ))}
              {/* search tab */}
              <button
                onClick={() => searchRef.current?.focus()}
                className={`
                  flex-1 h-10 flex items-center justify-center rounded-[10px]
                  transition-colors duration-150
                  ${isSearching ? 'bg-[#E5E5EA]' : 'hover:bg-black/[0.04]'}
                `}
                title="Search"
              >
                <Search size={18} className="text-[#8E8E93]" />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
