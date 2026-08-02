/*
  # Seed-events infrastructure

  Adds the plumbing for the "seed events" engine (fake but believable events that keep the app feeling
  alive until real users start creating events). See the seed-events Edge Function.

  1. Columns
     - events.is_seed  — marks an event as generated content (exclude from analytics, wipe in one query).
     - events.seed_key — which template produced it, so the generator can avoid repeating a template per hub.
     - users.is_seed   — marks the fake Israeli host / attendee-filler profiles.

  2. Seed host users (~25)
     The FK users.id → auth.users(id) was dropped back in 20251023173258, so we can insert profile rows
     directly (no auth account needed). These profiles are BOTH the event hosts AND the pool we drop into
     events.attendees for social proof. Guarded so re-running is a no-op.

  3. Cleanup (when real content is enough)
     delete from events where is_seed;  delete from users where is_seed;

  Run this in the Supabase SQL Editor (runs as service role → bypasses RLS).
*/

-- 1. Columns ---------------------------------------------------------------
alter table events add column if not exists is_seed  boolean not null default false;
alter table events add column if not exists seed_key text;
alter table users  add column if not exists is_seed  boolean not null default false;

create index if not exists events_is_seed_idx on events (is_seed) where is_seed;
create index if not exists users_is_seed_idx  on users  (is_seed) where is_seed;

-- 2. ~25 Israeli seed host / attendee profiles -----------------------------
insert into users (id, email, display_name, avatar_url, bio, current_country, selected_countries, profile_completed, is_seed)
select gen_random_uuid(), v.email, v.name, null, v.bio, v.country,
       array['TH','PH','IN','VN','LA','KH','ID','NP','LK'], true, true
from (values
  ('seed01@fomo.local','נועה לוי',      'אחרי צבא, שנה באסיה 🌏','TH'),
  ('seed02@fomo.local','איתי כהן',      'מחפש את השקיעה הבאה 🌅','TH'),
  ('seed03@fomo.local','שיר מזרחי',     'יוגה, ים וחברים טובים 🧘‍♀️','TH'),
  ('seed04@fomo.local','יהב פרץ',       'DJ בלב, תרמילאי בנשמה 🎧','TH'),
  ('seed05@fomo.local','רוני ביטון',    'קופה, קוסמואי, קופנגן 🏝️','TH'),
  ('seed06@fomo.local','עומר דהן',      'סנפלינג בבוקר, טראנס בלילה','PH'),
  ('seed07@fomo.local','טל אברהם',      'גלים בסיארגאו 🏄','PH'),
  ('seed08@fomo.local','ליאור חדד',     'צולל, מטייל, נהנה','PH'),
  ('seed09@fomo.local','מאיה גבאי',     'נשימות ומדיטציה על החוף','PH'),
  ('seed10@fomo.local','אריאל שרעבי',   'בדרך להימלאיה 🏔️','IN'),
  ('seed11@fomo.local','גל אזולאי',     'כסול זה בית','IN'),
  ('seed12@fomo.local','דנה מלכה',      'גואה, טראנס, חופש','IN'),
  ('seed13@fomo.local','אור בן דוד',    'רישיקש — יוגה קפיטל','IN'),
  ('seed14@fomo.local','נועם קדוש',     'תה צ׳אי ופסקול טוב','IN'),
  ('seed15@fomo.local','שחר וקנין',     'מסיבות בריכה זה שלי 🏊','TH'),
  ('seed16@fomo.local','הילה נחום',     'סדנאות והרבה אהבה','TH'),
  ('seed17@fomo.local','יונתן אוחיון',  'לוקח את זה יום-יום','ID'),
  ('seed18@fomo.local','עדן סבן',       'באלי בלב 🌸','ID'),
  ('seed19@fomo.local','רותם אלבז',     'מפלים, ג׳ונגל, וויב','LA'),
  ('seed20@fomo.local','נטע שמעוני',    'הכי טוב זה עכשיו','VN'),
  ('seed21@fomo.local','בר יוסף',       'קפה שחור וזריחות','KH'),
  ('seed22@fomo.local','אלמוג טל',      'תרמיל, גיטרה, חיוך','TH'),
  ('seed23@fomo.local','ספיר גל',       'חוף, אש, תופים','PH'),
  ('seed24@fomo.local','ניר חזן',       'טבע ואנשים טובים','NP'),
  ('seed25@fomo.local','מור לוגסי',     'מחפשת את החבר׳ה 💫','LK')
) as v(email, name, bio, country)
where not exists (select 1 from users where is_seed);
