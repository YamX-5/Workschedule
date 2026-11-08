# Yami: Session Handoff

Read this first when picking the project back up, on the laptop or in a new session.

## What Yami is
An anime dark-future voxel **"System"** app. Your real life is the quest, and phone time is the Corruption.
- Spec: `docs/superpowers/specs/2026-11-08-yami-design.md`
- Live prototype: `mockups/d-system.html` (published at https://claude.ai/artifact/P8E9e6NGDcUXxD5F3KKUc6)
- Older rejected directions (reference only): `mockups/a-signal.html`, `b-monolith.html`, `c-deepwater.html`

## How we work (the workflow)
1. **Plan before building.** Brainstorm → spec → plan → build. Big changes get written into the spec first.
2. **Search before deciding.** Look up research, competitors and references before designing features.
3. **Design bar = "a studio made it."** No generic AI look, no emojis in the product. Palette: **white, black, dark purple, light blue**.
4. **Check visuals before showing.** Screenshot every screen, critique it like an art director, fix, then share.
5. **Keep it real.** Push back on bad ideas, celebrate wins.

## Skills to use on the laptop
| Area | Skills |
|---|---|
| Process | `superpowers:brainstorming`, `superpowers:writing-plans`, `superpowers:executing-plans`, `superpowers:subagent-driven-development`, `superpowers:test-driven-development`, `superpowers:verification-before-completion` |
| Design | **Impeccable** (`pbakaus/impeccable`: craft-floor, polish, critique, typeset, layout, colorize, animate, delight, android, onboard) |
| Motion | **Emil Kowalski** (`emilkowalski/skills`: emil-design-eng, animate, choreograph, review-animations, animation-performance, **animate-expo** for the React Native build) |
| UI pages | `artifact-design` / `frontend-design`, `design:design-critique`, `design:accessibility-review` |
| 3D | **Blender** → export `.glb` → load in Three.js (web) / expo-gl + three (Android). Replace the voxel avatar, gates and city with real assets. |
| Ship | `engineering:deploy-checklist`, `code-review`, `security-review` |

Install on the laptop (Claude Code CLI):
```
/plugin marketplace add pbakaus/impeccable
```
and add the Emil Kowalski skills from https://github.com/emilkowalski/skills (follow its README).

## Status (2026-11-08)
- [x] Research (one sec PNAS study, never-miss-twice, 66-day habit arc, why blockers fail)
- [x] Spec v1, sleep added, renamed to Yami, System direction
- [x] Prototype v2: studio polish (new avatar, bloom, bottom sheet, radar stats, cinematic cameras)
- [x] Prototype v3: Protocol settings, Judgment (honesty beats perfection), HONOR, level loss, debuffs, reminders, onboarding, Limit→Reserve→Sealed lock, Work apps, FALL, DEMO panel
- [x] Plan 1 written: `docs/superpowers/plans/2026-11-08-yami-core.md` (Expo app, domain, screens, simulate-mode lock)
- [x] Prototype phone fixes (HUD, gates, log out, quest rows at 320–412px)
- [x] Spec §12 Progression v2: rank, Shards + reward shop, Dreams + milestones, records, Path tab
- [x] Plan 1 built in `yami/` (Expo SDK 58): all screens, 74 tests, web build renders at phone size
- [ ] Plan 1 leftovers: PWA install/offline (manifest icons + service worker), run on the Android phone, swipe-to-report, rehab pain score, "report now (late)" on Judgment
- [ ] Plan 2 (Android Shield) · Plan 3 (3D World)
- [ ] Blender assets pass
- [ ] Enemies (Shadows) and summons
- [ ] Paid version: accounts, cloud sync, premium (keep the core detox loop free)

## Known issues
- The avatar body is still boxy. Blender will fix it.
