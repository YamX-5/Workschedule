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
