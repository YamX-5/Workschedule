# Yami — Design Spec

*App name: **Yami** (闇, "darkness"). Concept: "The System". Your life is the quest; light vs corruption.*
Date: 2026-11-08 · Status: draft, awaiting review

## 1. Why this exists

One person, one goal: take control back from the phone and put the time into the
things that matter.

- **Sleep (the foundation):** 7+ hours, asleep by 23:00, up for Fajr. Everything else
  (tendon repair, memorising for dentistry, focus, impulse control) depends on it.
- **Phone:** 2 hours a day, maximum.
- **Deen:** pray all 5 salah, ideally on time.
- **Body:** rehab the knees (patellar tendinopathy; doctor's instruction is to
  strengthen the legs, avoided for 4 years) and become athletic again. Basketball
  continues (runs an academy), but playing does not count as rehab.
- **Company:** games, websites, the basketball academy.
- **Study:** dentistry, 3 deep sessions a week (2–3 h) plus a 15-minute daily review.

**Success:** after 66 days, the average phone time is under 2 h/day, there have
been no two missed days in a row on rehab, and the app is still being opened
daily because it costs under 60 seconds a day to use.

## 2. Research that shapes the design

| Finding | Source | Design decision |
|---|---|---|
| A short delay plus an easy "close the app" option cut app opens by 57%. The dismiss option was the strongest part; the motivational message did nothing measurable. | one sec, PNAS 2023 | The Urge screen is a breath delay followed by one big **Close it** button. No quotes, no lectures. |
| Hard lockouts get disabled within about a week. | App reviews 2025–26 | **Escalating friction** (5 s → 15 s → 30 s delay). Hard locks only during blocks the user chose (salah windows, study sessions). |
| Tracking alone barely changes behaviour; a replacement action does. | Practitioner reports | **Earn minutes with rehab:** a 45 s wall sit earns 10 min of phone. |
| Blockers fail silently when permissions are revoked. | Developer reports | Always-visible **Shield** status and a loud alert if a permission is lost. |
| Habits take about 66 days on average; one missed day did not hurt. Streak anxiety drives people away. | Lally et al. 2010 | **Never miss twice** streak and a **66-day arc**. |
| Users take breaks and rebound quickly when they return. | CHI 2024 | A **welcome back** flow with no guilt and no reset shame. |

## 3. Pillars

| Pillar | Daily non-negotiable | Tracked |
|---|---|---|
| **Sleep (foundation)** | Asleep by target, up for Fajr | Bedtime, wake time, hours, quality 1–5, phone use after wind-down |
| Deen | 5 salah | Each prayer: on time / late / missed (qada owed) |
| Body | Knee rehab routine | Sets done, hold time, knee pain 0–10 before/after; basketball sessions logged separately |
| Company | One focus block | Focus minutes |
| Study | Study days: deep session; every day: 15 min review | Focus minutes, review done |

## 4. Features (V1)

1. **North Star.** Vision line, the 4 pillars, and the Don't List. Shown at the top of
   Home and behind the Urge screen.
2. **Day by Salah.** The day is split into blocks between prayers
   (Fajr→Dhuhr, Dhuhr→Asr, Asr→Maghrib, Maghrib→Isha). Each block gets one
   intention. Prayer times are calculated offline from location
   (`adhan` library, method configurable). Each prayer is a phone-free checkpoint.
3. **Morning Lock-in (≤ 30 s).** Choose 3 must-dos, each tied to a pillar.
4. **Urge Screen.** It opens when a watched app is launched (Android) or from a button (PWA).
   The flow is breath delay, then **Close it**, with a small "open anyway" link. The
   delay grows with the budget used. Every urge is logged with its time and app.
5. **Phone Budget (2 h).** On Android the usage is read automatically from
   `UsageStatsManager`. On the PWA it is entered at the Night Check-in.
6. **Earn Minutes.** A rehab set (for example a 45 s isometric hold) adds 10 minutes,
   capped at +30 min/day so it can't become a loophole.
7. **Focus Sessions.** A timer tagged to a pillar. The "Just 10 minutes" mode is for
   study. Watched apps are hard-locked during a session.
8. **Knee Rehab.** A routine the user enters from their physio (sample default:
   isometric wall sit 5×45 s, Spanish squat, slow decline squat). A hold timer, set
   counter and pain score. The screen says: "Plan from your physio. Confirm with your
   doctor." The app gives no medical advice.
9. **Study Review.** A daily 15-minute review reminder. Study days are Mon/Wed/Sat by
   default and editable.
10. **Night Check-in (3 taps).** Phone time (auto on Android), wins, energy 1–5.
11. **Streak + 66-Day World.** "Never miss twice" logic: one missed day *bends* the
    streak, two in a row break it. The journey is visualised as a voxel world that
    gains a stack each day.
12. **Weekly Mirror.** An explainer-style annotated chart of focus hours per pillar
    against phone hours, plus the urge pattern (when you're weakest).
13. **Shield status.** ON/OFF is always visible. The app alerts if usage access or
    accessibility permission is revoked.

14. **Sleep & Wind-down.** The last block of the day is Isha → Sleep. Wind-down starts
    at a set time (default 22:30); watched apps hard-lock until the Fajr alarm. Sleep
    is logged at the morning open (one tap, prefilled from the last phone use at night
    and the first in the morning on Android). Setup prompts "phone charges outside the
    bedroom". The Weekly Mirror links late-night phone use to lost sleep.

**Out of V1:** accountability buddy, AI coach, cloud sync, iOS.

## 5. Platform & architecture

- **One codebase: Expo (React Native) + TypeScript**, built for Android and exported
  to web as an installable **PWA** (Expo web + service worker via Workbox).
- **Android native module** (Expo config plugin + Kotlin):
  - `UsageStatsManager` for screen time per app (PACKAGE_USAGE_STATS permission).
  - An `AccessibilityService` that detects a watched app coming to the foreground
    and launches the Urge screen (overlay activity).
  - Web build: the module resolves to a no-op stub, and the UI falls back to manual entry.
- **Storage:** local-first (SQLite via `expo-sqlite`; IndexedDB on web). No account is
  needed in V1.
- **Prayer times:** `adhan` (JS, offline) with `expo-location` once at setup.
- **Notifications:** `expo-notifications` for prayer checkpoints, the morning lock-in,
  the night check-in and the study review.
- **Motion:** `react-native-reanimated` (springs) and `react-native-skia` for the
  water/rings/charts. Voxel world: `expo-gl` + `three` (web: plain Three.js).

### Units

| Unit | Job | Depends on |
|---|---|---|
| `domain/` | Pure logic: budget, friction level, sleep window, streak (never miss twice), earn-minutes cap, salah state | nothing (fully unit-tested) |
| `data/` | Repositories over SQLite / IndexedDB | domain types |
| `native/usage` | Screen time and the foreground-app hook, plus a web stub | Android APIs |
| `prayer/` | Prayer times and block computation | `adhan` |
| `features/*` | Screens: home, urge, focus, rehab, salah, checkin, mirror, world | domain, data |
| `ui/` | Design tokens, primitives, motion presets | — |

## 6. Design direction

Black and white plus one accent. Three mockups are in `mockups/`:

- **A — Signal:** mission control, monospace, ice-blue signal light, explainer-style annotated charts.
- **B — Monolith:** huge editorial type, deep dark purple, voxel 66-day world as the hero.
- **C — Deep Water:** the 2 h budget as luminous ice-blue liquid, the day built around salah, small voxel salah pillars.

Rules: no emojis in the product; motion uses springs and ease-out curves, kept short,
respects reduced motion; no generic AI look.
**Decision pending:** the user picks one direction (or a mix).

## 7. Error handling

- Permission revoked: a red Shield badge, a persistent notification, and a one-tap fix screen.
- Location denied: manual city or coordinates entry for prayer times.
- Missed check-in: the next day opens with a quick "yesterday?" back-fill (one tap).
- Clock or timezone change: prayer times are recomputed at midnight and on resume.

## 8. Testing

- Unit tests (Jest) for all of `domain/`: streak bend/break, friction steps,
  earn-minutes cap, budget math, salah block boundaries.
- Component tests for the Urge flow and the Check-in.
- Manual device checklist for the Android native module (permission flows, overlay
  launch, usage accuracy against Android Digital Wellbeing).

## 9. Direction update (after mockup review)

Mockups A–C were rejected as too generic. New direction, **"The System"**:
- Full-screen voxel 3D world (Three.js on web, expo-gl on Android). The user's own voxel avatar stands above a night city.
- Anime dark-future mood. Palette: white, black, dark purple, light blue. Light blue = you / light; dark purple = corruption (phone time).
- Stats: DEEN · BODY · MIND · CRAFT · REST, each with a level and XP. Daily Quests drive the day.
- The Urge screen becomes **Intrusion** (glitch, breath delay, **SEAL IT**). Salah become **Gates**, rehab is the **Body quest**, the night check-in is **Log out**.
- Prototype: `mockups/d-system.html`.

## 10. Player-configurable Protocol + Judgment system (v3)

**Protocol (settings):** the player sets their own phone cap, wind-down, sleep and wake times, renames and toggles stats, edits quests (title, stat, XP, type check/count/timer, schedule, report deadline), picks a judgment preset (Mercy / Balanced / Ruthless), and chooses watched apps and the prayer method.

**Judgment: honesty beats perfection.** Every quest ends the day in one state:

| State | Meaning | Balanced outcome |
|---|---|---|
| CLEARED | reported done | full XP |
| CONFESSED | reported honestly as not done | 0 XP lost, +2 Honor |
| LATE REPORT | done, reported inside the grace window (until Fajr) | 50% XP |
| UNREPORTED | nothing reported | −1.5× reward XP, corruption spike, −5 Honor |

- Levels can drop. Missing the same quest twice in a row applies a debuff.
- Reminders fire before the deadline. A "did you do it?" nudge goes out when activity suggests the quest was done but it wasn't reported.
- **Judgment at Fajr** is the daily results screen.

**Later:** enemies (Corruption spawns Shadows tied to your weak hours), summons (allies unlocked by streaks), Blender-made characters and assets.

**Paid later (design for it now):** keep all player state in one serialisable profile so it can move to an account and cloud sync. Possible premium candidates: custom protocols and presets, extra avatars and summons, deeper analytics, accountability party. The core detox loop stays free.

## 11. Limit → Reserve → Sealed (the app lock)

1. **Cap (default 2h)** on watched apps only. Friction escalates as it fills (5 s → 15 s → 30 s).
2. **Necessity Reserve (default 30 min).** After the cap, watched apps open only by stating a reason (logged). The Reserve drains.
3. **Sealed until Fajr.** When the Reserve is empty, watched apps are locked until the day resets at Fajr. Calls, messages, maps and Quran are never blocked.
4. **The only escape is uninstalling.** Local data is wiped, which loses progress. Android: set `allowBackup=false` so a reinstall can't restore it.

**Platform reality**
- **Android:** a foreground service polls `UsageStatsManager`, plus an overlay (`SYSTEM_ALERT_WINDOW`) or an AccessibilityService to detect and cover watched apps. Google Play requires a prominent disclosure and a declaration for accessibility use. Optional Device Admin adds friction to uninstalling.
- **iOS:** apps cannot draw over other apps. Use the Screen Time API (FamilyControls + ManagedSettings + DeviceActivity) with a custom Shield (ShieldConfiguration extension) for the Yami-branded lock. This needs Apple's Family Controls entitlement approval. Uninstalling removes the shields, which matches the "only escape is uninstall" rule.
- **Anti-cheat:** never trust the device clock alone. Use elapsed time since boot plus network time when online.
- **Decided: FALL.** Uninstalling resets level, streak and stats to Day 1. Scars and the Honor record stay (cloud-held once accounts exist; until then a reinstall starts fresh with a "fallen" marker if one can be detected).

**App categories (decided)**
- **Watched:** counts toward the cap, gets Intrusion, can be Sealed (Instagram, TikTok, YouTube, Snapchat, X).
- **Work:** never Sealed; opens in scheduled work windows (default 13:00–13:20 and 18:00–18:20); tracked separately from Corruption. Example: **Meta Business Suite** for the academy's Instagram DMs, which keeps business replies off the Instagram feed.
- **Always open:** Phone, Messages, Maps, Quran, Banking.
- **Android later:** block only Instagram Reels/Explore while allowing DMs, via accessibility view detection. This is fragile across Instagram updates, so treat it as an optional extra and keep Meta Business Suite as the main solution.

## 12. Progression v2: levels, points, dreams, records (2026-11-08)

**Why:** a detox app that only punishes gets opened for a week. Yami has to show *what you are building*, not only what you avoided. Every rule below is plain math on saved history (no AI).

### 12.1 Player level and rank
- **Player level = sum of enabled stat levels** (the prototype already shows LV 35 = 7+3+9+11+5).
- **Rank** by player level: **E** < 15 · **D** 15–29 · **C** 30–49 · **B** 50–79 · **A** 80–119 · **S** 120+. A rank change gets its own moment on the Judgment screen (rank up and rank down).
- **Titles** unlock from records (12.4) and Dreams achieved (12.3). The player picks one active title in Protocol.

### 12.2 Shards (points you spend)
- XP measures growth; **Shards** are the currency. Each cleared quest pays `floor(xpDelta / 10)` Shards (late reports pay half). Misses cost no Shards: XP and Honor already carry the penalty.
- **Reward Shop:** the player writes their own real-life rewards with a price (examples: "New basketball shoes · 600", "Cinema night · 250"). Claiming one deducts Shards and logs the claim. There is no rule against any reward; the player sets the prices.
- A Dream milestone pays **+20 Shards**; a Dream achieved pays **+100**.

### 12.3 Dreams (long-term goals) and milestones
- A **Dream** = `{ id, title, why, stat, milestones[], questIds[], createdAt, achievedAt? }`. Examples: "Athletic again" (BODY), "Ship 3 games" (CRAFT), "Pass Perio" (MIND), "Pray every salah on time for 40 days" (DEEN).
- A **milestone** = `{ id, title, doneAt? }`. The player ticks it off (with a confirm step); it pays **+100 XP** to the Dream's stat and +20 Shards, and adds an entry to the record log.
- **Dream progress** = done milestones / total. All done → **DREAM ACHIEVED**: +100 Shards, a title unlock ("The one who <title>" or a custom title), and a permanent entry in the Hall.
- Quests can link to a Dream. Linked quests show the Dream name under the quest title, so daily work points at the long goal.
- At most **3 active Dreams**; the rest wait in a "Later" list. Focus beats a long wishlist.

### 12.4 History, streak and records
- At each Judgment, append a **DaySummary** `{ dayKey, usedMin, capMin, cleared, late, confessed, unreported, xpGained, xpLost, shards, salahOnTime, energy?, held }` to `history`.
- A day **holds** when cleared + late ≥ 60% of the judged quests and `usedMin ≤ capMin + reserveMin`.
- **Streak (never miss twice):** each held day adds 1. One failed day **bends** the streak (it stays, marked bent); a second failed day in a row **breaks** it to 0. Best streak is saved.
- **Records** are deterministic and checked after each Judgment; each unlocks once, with its date:

| Record | Rule |
|---|---|
| First Light | first cleared quest |
| Seven Unbroken | streak reaches 7 |
| Under the Cap | 7 judged days in a row with `usedMin ≤ capMin` |
| Five Gates | all 5 salah on time, 7 days in a row |
| Iron Knees | 100 rehab sets total |
| Honest Blade | 10 confessions total |
| Day 66 | the 66-day arc completed |
| Dreamer | first Dream achieved |

### 12.5 Path screen (new tab)
Tabs become **Status · Gates · Path · Quest · Log out**. Path shows, top to bottom:
1. Player level, rank badge, active title, total XP, Shards.
2. Active Dreams with milestone progress (tap to open, tick milestones).
3. **This week:** phone minutes per day against the cap (bar chart), held days, XP gained vs lost, the weakest hour for urges.
4. Streak (current, best, bent marker) and the 66-day grid built from `history`.
5. Records (locked ones show their rule, so the player knows what to chase).
6. Reward Shop entry.

### 12.6 Usefulness bar (why it gets opened every day)
- The daily loop stays under **60 seconds**: report quests (swipe), Log out (3 taps + hold), Judgment (read).
- Something visibly grows every judged day: XP bars, the 66-day grid, Dream progress, Shards.
- A weekly **Mirror** on the first Judgment of each week summarises the 7 days in one screen.
- A missed check-in never resets anything silently; the next open offers a one-tap back-fill for yesterday.

### 12.7 Character forms (2026-11-08)
- The avatar upgrades every **10 player levels**: Dormant → Awakened (10) → Initiate (20) → Seeker (30) → Vanguard (40) → Warden (50) → Ascendant (60) → Sovereign (70) → Paragon (80) → Transcendent (90) → **Supreme Being (100)**. Each form adds one visible upgrade (glowing eyes, chest core, hood, armour, halo, orbiting shards, crown, wings, aura, body of light).
- Form follows the **current** level, so slipping loses the form; `bestLevel` keeps the best form on record ("Win it back").
- **Ranks re-aligned** to steps of 20: E 0 · D 20 · C 40 · B 60 · A 80 · **S 100 = Supreme**. New record: Supreme Being.
- **XP curve retuned** to `xpToNext(L) = 100 + 45 × (L − 1)` so LV 100 takes about **6 months of perfect days** and **7–12 months** clearing 3 days in 4 (pace test in `yami/__tests__/forms.test.ts`).
- Art: SVG placeholder in `yami/src/ui/Avatar.tsx`; Plan 3 replaces it with **Blender renders** (one PNG per form, rendered offline, no 3D engine on the phone).
- Backup: Protocol → Data → Export backup (share sheet) / Restore (paste). Real data is local to the phone until accounts exist.
