// ────────────────────────────────────────────────────────────────────────────
// Country travel guides — the content behind the home "מקומות" tab.
//
// A guide is a country (keyed by ISO2, matching src/utils/countries.ts) holding
// SECTIONS ("אפליקציות שימושיות", "סים ואינטרנט", …). Each section holds ITEMS,
// and tapping an item opens its full description. Everything here is plain data
// so the UI (CountryGuide / GuideSectionSheet / GuideItemSheet) stays generic —
// to add a country or a section you only edit this file.
//
// Icons are emoji by design (instant, offline, on-brand with the app's pin
// language). `image` is optional: drop a bundled logo URL there later and the
// item tile will use it instead of the emoji, no code change needed.
// ────────────────────────────────────────────────────────────────────────────

export interface GuideItem {
  id: string;
  name: string;
  subtitle?: string;        // one-line hook shown in the list
  emoji?: string;           // tile icon (fallback when no image)
  image?: string;           // optional logo/photo URL
  description: string;      // full text; use \n for paragraphs
  bullets?: string[];       // optional quick facts
  tag?: string;             // small chip, e.g. "חינם" / "₪₪" / "מומלץ"
  link?: string;            // optional website / download URL
  linkLabel?: string;       // e.g. "לאתר", "להורדה"
}

export interface GuideSection {
  id: string;
  title: string;
  emoji: string;
  color: string;            // accent hex (matches the app's place palette)
  subtitle?: string;
  items: GuideItem[];
}

export interface CountryGuide {
  code: string;             // ISO2
  intro?: string;           // short blurb over the hero
  sections: GuideSection[];
}

// Section accent colours — reuse the app's semantic place palette so the guide
// feels like part of the same product.
const C = {
  apps:      '#6366F1', // indigo
  sim:       '#0EA5E9', // sky
  money:     '#D99A28', // amber
  transport: '#2F80ED', // blue
  chabad:    '#7A57C2', // spiritual purple
  safety:    '#E5556B', // medical red
  sights:    '#8B5CF6', // violet — nightlife / must-see
  season:    '#3BA35F', // green
  food:      '#E5573E', // coral
} as const;

// ─── תאילנד ─────────────────────────────────────────────────────────────────
const TH: CountryGuide = {
  code: 'TH',
  intro: 'המדינה הראשונה של כל תרמילאי. חופים, מקדשים, אוכל רחוב ומסיבות — והכל בזול.',
  sections: [
    {
      id: 'apps', title: 'אפליקציות שימושיות', emoji: '📱', color: C.apps,
      subtitle: 'מה להוריד לפני שממריאים',
      items: [
        { id: 'grab', name: 'Grab', emoji: '🚕', image: '/app-icons/grab.svg', tag: 'חובה', subtitle: 'מוניות, טוקטוק ומשלוחי אוכל',
          description: 'ה"אובר" של דרום מזרח אסיה. מזמינים רכב, אופנוע או משלוח אוכל — המחיר ידוע מראש, אז אין מיקוח ואין הפתעות. משלמים במזומן או בכרטיס.\n\nהכי שימושי בבנגקוק ובערים הגדולות. באיים לפעמים אין נהגים זמינים.',
          bullets: ['מחיר קבוע מראש', 'תשלום מזומן/כרטיס', 'גם משלוחי אוכל (GrabFood)'],
          link: 'https://www.grab.com', linkLabel: 'לאתר' },
        { id: 'bolt', name: 'Bolt', emoji: '🚗', image: '/app-icons/bolt.svg', tag: 'זול', subtitle: 'אלטרנטיבה זולה לגראב',
          description: 'לרוב זול יותר מגראב בבנגקוק. שווה שתהיה לכם גם וגם ולהשוות מחירים לפני שמזמינים.',
          link: 'https://bolt.eu', linkLabel: 'לאתר' },
        { id: 'gmaps', name: 'Google Maps', emoji: '🗺️', image: '/app-icons/gmaps.svg', subtitle: 'הורידו מפות אופליין',
          description: 'לפני שיוצאים לאזור בלי קליטה — הורידו את המפה לאופליין (חיפוש עיר ← הורד). ניווט, זמני אוטובוסים ומיקומים של הכל.',
          bullets: ['הורדת מפות אופליין', 'עובד גם בלי סים'] },
        { id: 'translate', name: 'Google Translate', emoji: '🌐', image: '/app-icons/translate.png', subtitle: 'תרגום תאית + מצלמה',
          description: 'הורידו את חבילת השפה התאית לאופליין. מצב המצלמה מתרגם תפריטים ושלטים בזמן אמת — מציל חיים בדוכני אוכל.' },
        { id: 'klook', name: 'Klook', emoji: '🎟️', image: '/app-icons/klook.svg', tag: 'חוסך כסף', subtitle: 'אטרקציות וכרטיסים בזול',
          description: 'הזמנה מראש של סיורים, אטרקציות, כרטיסי רכבת ומעבורות — לרוב זול יותר מבמקום, וחוסך תורים.',
          link: 'https://www.klook.com', linkLabel: 'לאתר' },
        { id: 'agoda', name: 'Agoda', emoji: '🏨', image: '/app-icons/agoda.png', subtitle: 'הכי חזק להזמנת לינה באסיה',
          description: 'באסיה לאגודה יש הכי הרבה הוסטלים וגסטהאוסים במחירים הכי טובים. שווה להשוות מול Booking.',
          link: 'https://www.agoda.com', linkLabel: 'לאתר' },
        { id: '12go', name: '12Go', emoji: '🚌', image: '/app-icons/12go.svg', subtitle: 'אוטובוסים, רכבות ומעבורות בין ערים',
          description: 'פלטפורמה אחת להזמנת כל התחבורה הבין-עירונית ולאיים. רואים מסלולים, שעות ומחירים, ומזמינים כרטיס דיגיטלי.',
          link: 'https://12go.asia', linkLabel: 'לאתר' },
        { id: 'xe', name: 'XE Currency', emoji: '💱', subtitle: 'המרת מטבע מהירה',
          description: 'ממיר שקל/דולר לבאט לפי השער העדכני, עובד גם אופליין עם השער האחרון.' },
      ],
    },
    {
      id: 'sim', title: 'סים ואינטרנט', emoji: '📶', color: C.sim,
      subtitle: 'להתחבר מהרגע שנוחתים',
      items: [
        { id: 'ais', name: 'AIS', emoji: '📡', tag: 'הכי טוב', subtitle: 'הכיסוי הרחב ביותר',
          description: 'הרשת עם הכי הרבה כיסוי — גם באיים המרוחקים ובצפון. חבילת תייר (Tourist SIM) של 8/15 יום עם גלישה בלתי מוגבלת.',
          bullets: ['כיסוי מעולה גם באיים', 'חבילות תייר 8–15 יום'] },
        { id: 'truemove', name: 'TrueMove H', emoji: '📶', image: '/app-icons/truemove.png', subtitle: 'מצוין בערים',
          description: 'כיסוי חזק בבנגקוק ובערים. דלפקים בכל שדות התעופה, מתקינים לכם במקום.' },
        { id: 'dtac', name: 'dtac', emoji: '📱', image: '/app-icons/dtac.png', tag: 'זול', subtitle: 'הכי משתלם',
          description: 'לרוב הזול מבין השלושה, כיסוי טוב במרכז ובאזורים התיירותיים.' },
        { id: 'airalo', name: 'Airalo eSIM', emoji: '🌍', image: '/app-icons/airalo.png', tag: 'ליום הראשון', subtitle: 'eSIM בלי להחליף כרטיס',
          description: 'מתקינים eSIM עוד מהבית ונוחתים עם אינטרנט מהשנייה הראשונה. מושלם ליום-יומיים עד שקונים סים מקומי זול. דורש טלפון שתומך ב-eSIM.',
          link: 'https://www.airalo.com', linkLabel: 'לאתר' },
        { id: 'tip', name: 'איפה קונים?', emoji: '💡', subtitle: 'טיפ: דלפק בשדה התעופה',
          description: 'הכי פשוט — דלפק של AIS/True בטרמינל בסוואנאבום או דון מואנג. דרכון ביד, בוחרים חבילה, ומתקינים לכם במקום. אפשר גם בסופר 7-Eleven בכל פינה.' },
      ],
    },
    {
      id: 'money', title: 'כסף ומטבע', emoji: '💰', color: C.money,
      subtitle: 'באט, כספומטים ותקציב',
      items: [
        { id: 'currency', name: 'המטבע', emoji: '💵', subtitle: 'באט תאילנדי (THB)',
          description: 'המטבע הוא באט (฿). כדאי להגיע עם קצת מזומן דולרי להחלפה ראשונית, וממשיכים למשוך מכספומטים.',
          bullets: ['1 ₪ ≈ 9–10 באט (בערך)', 'שטרות: 20/50/100/500/1000'] },
        { id: 'atm', name: 'כספומטים', emoji: '🏧', tag: 'שימו לב', subtitle: 'עמלה קבועה על כל משיכה',
          description: 'כמעט כל כספומט גובה עמלה קבועה של ~220 באט למשיכה — לא משנה הסכום. לכן משכו סכומים גדולים בבת אחת במקום הרבה משיכות קטנות.\n\nהשתמשו בכרטיס בלי עמלות המרה (כמו כרטיסי מטבע דיגיטליים) כדי לחסוך עוד.' },
        { id: 'cash', name: 'מזומן מול כרטיס', emoji: '💳', subtitle: 'רוב המקומות = מזומן',
          description: 'שווקים, דוכני אוכל, טוקטוק ובתי הארחה קטנים — מזומן בלבד. כרטיס עובד בקניונים, במלונות ובמסעדות גדולות.' },
        { id: 'haggle', name: 'מיקוח', emoji: '🤝', subtitle: 'בשוק כן, בחנות לא',
          description: 'בשווקים ובטוקטוק מקובל להתמקח — התחילו בכ-50% מהמחיר שנקבו ותתקדמו בחיוך. בחנויות עם מחיר נקוב לא מתמקחים.' },
        { id: 'budget', name: 'תקציב יומי', emoji: '📊', subtitle: 'כמה זה עולה באמת',
          description: 'תרמילאי חסכן: ~120–180 ₪ ליום (לינה בהוסטל, אוכל רחוב, תחבורה מקומית). ברמת נוחות בינונית: 250–350 ₪.',
          bullets: ['מנת אוכל רחוב: 40–60 באט', 'מיטה בהוסטל: 150–350 באט', 'בירה: 60–100 באט'] },
      ],
    },
    {
      id: 'transport', title: 'תחבורה', emoji: '🚕', color: C.transport,
      subtitle: 'איך זזים בין הכל',
      items: [
        { id: 'airport', name: 'משדה התעופה', emoji: '🛬', subtitle: 'רכבת או גראב',
          description: 'מסוואנאבום (BKK): ה-Airport Rail Link מגיע למרכז ב-45 ₪ בערך, מהיר ובלי פקקים. לילה מאוחר — גראב.\nמדון מואנג (DMK): אוטובוס A1/A2 או גראב.' },
        { id: 'intercity', name: 'בין ערים', emoji: '🚌', subtitle: 'אוטובוס לילה, רכבת או טיסה',
          description: 'אוטובוסים ליליים נוחים וזולים, רכבות איטיות אבל חוויתיות. טיסות פנים זולות מאוד (AirAsia, Nok Air, Lion Air) חוסכות שעות. הזמינו ב-12Go או Klook.' },
        { id: 'islands', name: 'לאיים', emoji: '⛴️', subtitle: 'מעבורות מסורת טאני/דונסק',
          description: 'לקופנגן/קוסמוי/קוטאו יוצאים ממעגן סורת טאני; לקופיפי/קראבי מפוקט. שילוב אוטובוס+מעבורת נמכר כחבילה אחת ב-12Go.' },
        { id: 'tuktuk', name: 'טוקטוק', emoji: '🛺', tag: 'סכמו מחיר', subtitle: 'כיף — אבל גראב זול יותר',
          description: 'חוויה שחייבים פעם אחת, אבל לרוב יקר יותר מגראב. סכמו מחיר לפני שעולים, והיזהרו מ"סיבוב תיירים" שמסתיים בחנות תכשיטים.' },
        { id: 'scooter', name: 'השכרת אופנוע', emoji: '🏍️', tag: 'זהירות', subtitle: 'חופש — עם אחריות',
          description: 'הדרך הכי כיפית להסתובב בפאי/קופנגן. חובה קסדה ורישיון נהיגה בינלאומי — משטרה עוצרת תיירים וקונסת. ודאו שהביטוח שלכם מכסה תאונת אופנוע (הרבה לא מכסים!).' },
      ],
    },
    {
      id: 'chabad', title: 'חב"ד ואוכל כשר', emoji: '🕎', color: C.chabad,
      subtitle: 'בית חם ואוכל של הבית',
      items: [
        { id: 'bkk', name: 'בית חב"ד בנגקוק', emoji: '🏠', subtitle: 'רחוב קאוסן',
          description: 'לב הקהילה הישראלית בבנגקוק, ליד רחוב קאוסן. ארוחות שבת, מסעדה כשרה, מניינים ומקום לפגוש מטיילים. חג? כדאי להירשם מראש.' },
        { id: 'islands', name: 'חב"ד באיים', emoji: '🏝️', subtitle: 'קופנגן / קוסמוי',
          description: 'בתי חב"ד פעילים באיים הגדולים, בעיקר בעונת התיירות ובחגים. ארוחות שבת על החוף — חוויה בפני עצמה.' },
        { id: 'north', name: 'חב"ד צ׳אנג מאי', emoji: '⛰️', subtitle: 'בירת הצפון',
          description: 'מרכז לצפון תאילנד — נקודת מפגש לפני טרקים, עם ארוחות ומידע לטיילים.' },
        { id: 'map', name: 'למצוא על המפה', emoji: '🗺️', subtitle: 'טיפ מהיר',
          description: 'כל בתי החב"ד מסומנים במפת האפליקציה עם פין ייעודי. פתחו את המפה וחפשו את הפין של חב"ד באזור שלכם.' },
      ],
    },
    {
      id: 'safety', title: 'בטיחות וחירום', emoji: '🛡️', color: C.safety,
      subtitle: 'מספרים ונוכלויות להכיר',
      items: [
        { id: 'numbers', name: 'מספרי חירום', emoji: '🚨', tag: 'שמרו', subtitle: 'משטרת תיירים 1155',
          description: 'משטרת תיירים (דוברי אנגלית): 1155\nאמבולנס וחירום רפואי: 1669\nמשטרה כללית: 191',
          bullets: ['משטרת תיירים: 1155', 'אמבולנס: 1669'] },
        { id: 'embassy', name: 'שגרירות ישראל', emoji: '🇮🇱', subtitle: 'בבנגקוק',
          description: 'שגרירות ישראל נמצאת בבנגקוק. שמרו את מספר החירום הקונסולרי בטלפון, ובמקרה חירום אמיתי (אובדן דרכון, אשפוז) פנו אליהם.' },
        { id: 'scams', name: 'נוכלויות נפוצות', emoji: '⚠️', subtitle: 'מה לא ליפול עליו',
          description: '• "המקדש/הארמון סגור היום" — כמעט תמיד שקר כדי לגרור אתכם לחנות. בדקו לבד.\n• טוקטוק ב-10 באט — מסלול קניות עם עצירות בחנויות שמשלמות לנהג.\n• השכרת ג׳ט-סקי/אופנוע ו"נזק" שלא גרמתם — צלמו את הרכב מכל הכיוונים לפני שלוקחים.' },
        { id: 'water', name: 'מים ובריאות', emoji: '💧', subtitle: 'רק מים מבקבוק',
          description: 'אל תשתו מי ברז. מים מבקבוק זול ובכל פינה. הצטיידו בביטוח נסיעות תקף — טיפול רפואי פרטי מצוין אך עולה כסף.' },
      ],
    },
    {
      id: 'sights', title: 'חובה לראות ומסיבות', emoji: '🎉', color: C.sights,
      subtitle: 'הבאקט-ליסט',
      items: [
        { id: 'fullmoon', name: 'Full Moon Party', emoji: '🌕', tag: 'אייקוני', subtitle: 'קופנגן, חוף האד רין',
          description: 'המסיבה המיתולוגית על החוף, פעם בחודש בירח מלא. אלפי מטיילים, צבעי ניאון ומוזיקה עד הזריחה. שמרו על החפצים והחברים.' },
        { id: 'bangkok', name: 'מקדשי בנגקוק', emoji: '🛕', subtitle: 'Wat Pho, Wat Arun, הארמון',
          description: 'הארמון המלכותי, וואט פו (הבודהה השוכב) וואט ארון על הנהר. קוד לבוש: כתפיים וברכיים מכוסות, אחרת לא נכנסים.' },
        { id: 'chiangmai', name: 'צ׳אנג מאי והצפון', emoji: '⛰️', subtitle: 'מקדשים, טבע ושווקים',
          description: 'בירת הצפון: מקדשים, שוק לילה מפורסם, מקדש דוי סוטפ שצופה על העיר, וטרקים בטבע. בסיס מצוין להרפתקאות הרים.' },
        { id: 'islands', name: 'האיים', emoji: '🏝️', subtitle: 'קופיפי, קראבי, קוטאו',
          description: 'קופיפי (נופים דרמטיים), קראבי (צוקים וטיפוס), קוטאו (הצלילה הזולה בעולם). כל אחד עולם בפני עצמו — תשאירו זמן.' },
        { id: 'pai', name: 'פאי', emoji: '🌾', subtitle: 'כפר היפי בהרים',
          description: 'כפר קטן ורגוע בהרי הצפון, דרך כביש עם 762 סיבובים. מעיינות חמים, קניונים, שקיעות ואווירה של "עוד יום אחד".' },
      ],
    },
    {
      id: 'season', title: 'מתי כדאי לנסוע', emoji: '🌦️', color: C.season,
      subtitle: 'עונות ומזג אוויר',
      items: [
        { id: 'dry', name: 'עונה יבשה', emoji: '☀️', tag: 'הכי טוב', subtitle: 'נובמבר–פברואר',
          description: 'מזג האוויר הכי נעים — שמש, לחות נמוכה, ים רגוע. גם העונה הכי עמוסה ויקרה, אז הזמינו לינה מראש.' },
        { id: 'hot', name: 'עונה חמה', emoji: '🥵', subtitle: 'מרץ–מאי',
          description: 'חם ולח מאוד, במיוחד באפריל. מעולה לאיים ולים, פחות לטרקים בצפון.' },
        { id: 'monsoon', name: 'עונת הגשמים', emoji: '🌧️', tag: 'זול', subtitle: 'יוני–אוקטובר',
          description: 'גשם — אבל לרוב מקלחות קצרות ועזות, לא כל היום. פחות תיירים, מחירים נמוכים, וטבע ירוק ומרהיב.' },
        { id: 'songkran', name: 'סונגקראן 💦', emoji: '🎊', tag: 'חגיגה', subtitle: 'אמצע אפריל',
          description: 'ראש השנה התאי — מלחמת המים הגדולה בעולם. שלושה ימים שכל המדינה יורדת לרחובות עם דליים ואקדחי מים. תשאירו את הטלפון באטם.' },
      ],
    },
  ],
};

// ─── וייטנאם ────────────────────────────────────────────────────────────────
const VN: CountryGuide = {
  code: 'VN',
  intro: 'מצפון לדרום: אורז ירוק, מפרץ האלונג, קפה חזק ואוכל רחוב אגדי.',
  sections: [
    {
      id: 'apps', title: 'אפליקציות שימושיות', emoji: '📱', color: C.apps,
      items: [
        { id: 'grab', name: 'Grab', emoji: '🚕', image: '/app-icons/grab.svg', tag: 'חובה', subtitle: 'רכב, אופנוע ואוכל',
          description: 'שולט בווייטנאם. GrabBike (טרמפ על אופנוע) הוא הדרך הזולה והמהירה לחתוך את הפקקים בהאנוי ובסייגון.',
          link: 'https://www.grab.com', linkLabel: 'לאתר' },
        { id: 'be', name: 'Be', emoji: '🛵', tag: 'מקומי', subtitle: 'אלטרנטיבה וייטנאמית',
          description: 'אפליקציית הסעות מקומית, לפעמים זולה מגראב. שווה להשוות.' },
        { id: 'gmaps', name: 'Google Maps', emoji: '🗺️', image: '/app-icons/gmaps.svg', subtitle: 'מפות אופליין',
          description: 'הורידו את מפות האזור לאופליין — קליטה לא תמיד יציבה מחוץ לערים.' },
        { id: 'translate', name: 'Google Translate', emoji: '🌐', image: '/app-icons/translate.png', subtitle: 'וייטנאמית + מצלמה',
          description: 'האנגלית מוגבלת מחוץ לאזורי תיירות. תרגום מצלמה לתפריטים הוא חובה.' },
        { id: '12go', name: '12Go', emoji: '🚌', image: '/app-icons/12go.svg', subtitle: 'אוטובוסים ורכבות',
          description: 'הזמנת אוטובוסי שינה (sleeper bus) ורכבות לאורך החוף מצפון לדרום.',
          link: 'https://12go.asia', linkLabel: 'לאתר' },
      ],
    },
    {
      id: 'sim', title: 'סים ואינטרנט', emoji: '📶', color: C.sim,
      items: [
        { id: 'viettel', name: 'Viettel', emoji: '📡', tag: 'הכי טוב', subtitle: 'הכיסוי הרחב',
          description: 'הרשת הגדולה עם הכיסוי הטוב ביותר, גם באזורים כפריים ובהרים. חבילות דאטה זולות במיוחד.' },
        { id: 'mobifone', name: 'Mobifone', emoji: '📶', subtitle: 'טוב בערים',
          description: 'כיסוי מצוין בערים הגדולות, מחירים תחרותיים.' },
        { id: 'airalo', name: 'Airalo eSIM', emoji: '🌍', image: '/app-icons/airalo.png', tag: 'ליום הראשון', subtitle: 'eSIM מהבית',
          description: 'להתחברות מיידית בנחיתה עד שקונים סים מקומי.',
          link: 'https://www.airalo.com', linkLabel: 'לאתר' },
      ],
    },
    {
      id: 'money', title: 'כסף ומטבע', emoji: '💰', color: C.money,
      items: [
        { id: 'currency', name: 'המטבע', emoji: '💵', subtitle: 'דונג וייטנאמי (VND)',
          description: 'הכל במיליונים — 100,000 דונג ≈ 15 ₪. קל להתבלבל עם האפסים, ספרו טוב את העודף.',
          bullets: ['שטר 500,000 = הכי גדול', 'שימו לב לאפסים!'] },
        { id: 'budget', name: 'תקציב יומי', emoji: '📊', subtitle: 'זולה מאוד',
          description: 'מהמדינות הזולות באסיה. תרמילאי חסכן: ~100–150 ₪ ליום כולל לינה, אוכל ותחבורה.' },
      ],
    },
    {
      id: 'sights', title: 'חובה לראות', emoji: '⭐', color: C.sights,
      items: [
        { id: 'halong', name: 'מפרץ האלונג', emoji: '⛵', tag: 'אייקוני', subtitle: 'צוקי גיר בים',
          description: 'אלפי איי גיר מכוסי צמחייה שיוצאים מהמים. שייטו בשייט לילה (junk boat) — אחת התמונות המפורסמות של וייטנאם.' },
        { id: 'hanoi', name: 'העיר העתיקה בהאנוי', emoji: '🏮', subtitle: 'כאוס מקסים',
          description: 'סמטאות צפופות, אופנועים בכל כיוון, בתי קפה ואוכל רחוב בכל פינה. שבו על כיסא פלסטיק ותנו לזה לקרות.' },
        { id: 'hoian', name: 'הוי אן', emoji: '🏮', subtitle: 'עיר הפנסים',
          description: 'עיר עתיקה קסומה עם אלפי פנסי נייר צבעוניים, חייטים שתופרים בגדים ביום, ונהר עם נרות צפים.' },
      ],
    },
  ],
};

// ─── הודו ───────────────────────────────────────────────────────────────────
const IN: CountryGuide = {
  code: 'IN',
  intro: 'טירוף החושים הגדול. מההרים בצפון ועד החופים בדרום — הודו משנה אנשים.',
  sections: [
    {
      id: 'apps', title: 'אפליקציות שימושיות', emoji: '📱', color: C.apps,
      items: [
        { id: 'ola', name: 'Ola / Uber', emoji: '🚕', tag: 'חובה', subtitle: 'מוניות במחיר הוגן',
          description: 'שתי אפליקציות ההסעות הגדולות. מונעות מיקוח וריצ׳ולים — המחיר קבוע מראש. Uber עובד ברוב הערים הגדולות.' },
        { id: 'rapido', name: 'Rapido', emoji: '🛵', tag: 'זול', subtitle: 'טרמפ על אופנוע',
          description: 'הדרך הכי זולה ומהירה לחצות עיר הודית עמוסה — אופנוע עם נהג. מנצח פקקים בקלות.' },
        { id: 'irctc', name: 'IRCTC Rail', emoji: '🚂', subtitle: 'הזמנת רכבות',
          description: 'הרכבות הן חוויית הודו הקלאסית. IRCTC היא האפליקציה הרשמית להזמנת כרטיסים — הזמינו מראש, המקומות נגמרים.' },
        { id: 'gmaps', name: 'Google Maps', emoji: '🗺️', image: '/app-icons/gmaps.svg', subtitle: 'מפות אופליין',
          description: 'חובה להורדה לאופליין — קליטה משתנה מאוד בין אזורים.' },
      ],
    },
    {
      id: 'sim', title: 'סים ואינטרנט', emoji: '📶', color: C.sim,
      items: [
        { id: 'jio', name: 'Jio', emoji: '📡', tag: 'הכי זול', subtitle: 'דאטה בגרושים',
          description: 'מהפכת הדאטה של הודו — גיגות בלי סוף במחיר מגוחך. כיסוי טוב ברוב המדינה.' },
        { id: 'airtel', name: 'Airtel', emoji: '📶', subtitle: 'כיסוי אמין',
          description: 'איכות ואמינות גבוהות, במיוחד בערים. קצת יקר יותר מ-Jio.' },
        { id: 'tip', name: 'טיפ להשגה', emoji: '💡', subtitle: 'צריך צילום דרכון + ויזה',
          description: 'הפעלת סים בהודו דורשת דרכון, ויזה ותמונה, ולוקחת לפעמים כמה שעות עד יום. הכי קל לקנות בחנות רשמית של הרשת, לא בדוכן.' },
      ],
    },
    {
      id: 'safety', title: 'בריאות ובטיחות', emoji: '🛡️', color: C.safety,
      items: [
        { id: 'food', name: 'בטן ואוכל', emoji: '🍛', tag: 'חשוב', subtitle: '"דלהי בֶּלי"',
          description: 'הבטן צריכה זמן להסתגל. אכלו במקומות עמוסים (מחזור גבוה = טרי), הימנעו מסלטים חיים וקרח, ושתו רק מים מבקבוק סגור. קחו תרופות לשלשול מהבית.' },
        { id: 'numbers', name: 'מספרי חירום', emoji: '🚨', subtitle: 'חירום ארצי 112',
          description: 'מספר חירום מאוחד: 112. משטרה 100, אמבולנס 102.' },
      ],
    },
    {
      id: 'sights', title: 'חובה לראות', emoji: '⭐', color: C.sights,
      items: [
        { id: 'taj', name: 'טאג׳ מהאל', emoji: '🕌', tag: 'אייקוני', subtitle: 'אגרה',
          description: 'אחד מפלאי העולם. הגיעו לזריחה — פחות המונים והאור הכי יפה על השיש הלבן.' },
        { id: 'north', name: 'הצפון (הרים)', emoji: '🏔️', subtitle: 'רישיקש, מנאלי, לדאק',
          description: 'רישיקש (יוגה ובירת הטרקים), מנאלי ולדאק בהימלאיה — האזור האהוב על מטיילים ישראלים אחרי צבא.' },
        { id: 'goa', name: 'גואה', emoji: '🏖️', subtitle: 'חופים ומסיבות',
          description: 'חופי הדרום, שווקי לילה ומסיבות טראנס. אווירה רגועה בצפון גואה, מסיבתית יותר בדרום.' },
      ],
    },
  ],
};

export const COUNTRY_GUIDES: Record<string, CountryGuide> = { TH, VN, IN };

/** Country codes that currently have a guide, for the picker grid. */
export const GUIDE_COUNTRY_CODES = Object.keys(COUNTRY_GUIDES);

export function getCountryGuide(code?: string | null): CountryGuide | undefined {
  return code ? COUNTRY_GUIDES[code] : undefined;
}
