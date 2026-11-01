# CDT Gym Tracker: design handoff (direction A, "Plate")

Every screen and state from the brief lives on the design canvas, on the "A · Full set" page. Boards marked "full scroll" show the whole scroll length; in the app the bottom panel or main button sticks to the bottom of the screen.

## Files

- `tokens.css`: colours, type, spacing, sizes, radii, shadows and motion as CSS custom properties.
- `icon/cdt-gym-icon.svg`: round icon (purpose `any`), transparent corners.
- `icon/cdt-gym-icon-maskable.svg`: full-bleed amber square, artwork inside the 80% safe circle (purpose `maskable`).
- `icon/icon-192.png`, `icon/icon-512.png`: round, transparent.
- `icon/icon-maskable-192.png`, `icon/icon-maskable-512.png`: maskable.
- `icon/apple-touch-icon-180.png`: bonus, in case it's ever opened on iOS.

Manifest snippet:

```json
{
  "name": "CDT Gym Tracker",
  "short_name": "CDT Gym",
  "display": "standalone",
  "orientation": "portrait",
  "background_color": "#FBFAF7",
  "theme_color": "#FBFAF7",
  "icons": [
    { "src": "icon/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icon/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icon/icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "icon/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

Android builds the start-up splash from `background_color`, the icon and `name`, so the splash board is what you'll get automatically.

## Font

**Roboto Flex**, variable, one woff2 file (Google Fonts, SIL Open Font License). Weights used: 400, 500, 600, 650, 700, 720, 750, 800. A variable font covers all of them in one file. The full Roboto Flex file is large because of its many axes, so subset it: Latin plus the few symbols used (× → ↑ ↓ ★ ✓ –), keeping only the `wght` axis (and `opsz` if you want it). For example, `pyftsubset` with `--unicodes` and fontTools' `instancer` to drop the other axes. If you'd rather bundle nothing, the system Roboto is a near match. Snap 650 → 600 and 720/750 → 700 in that case.

All numbers use `font-variant-numeric: tabular-nums` so weights and reps don't jitter as they change.

## Layout rules

- 20 dp side gutter. Works from 360 dp wide; at 360 the weight drops to 72 px (the − / + buttons stay 64 dp).
- One amber main action per screen, full width, 64 dp tall, at the bottom. On the session screen it lives in a white sheet with the reps/weight fields, so the whole logging loop is thumb-reachable.
- The bottom nav (Home · Progress · History · Settings) shows on the four main areas only. Session, setup, exercise pages, editors and the forgotten-session prompt hide it.
- Confirmations are bottom-anchored dialogs: safe option on top, committing option below it.
- Done = filled ink circle with a check. Incomplete = half-filled circle. Skipped = dashed outline with muted text. These shapes, not colour, carry the meaning.

## Motion

Quick, never blocking. Nothing waits on an animation; input stays live throughout.

| What | How | Duration | Easing |
|---|---|---|---|
| Button press | Scale to 0.97, amber darkens to `amber-pressed` | 90 ms down, 150 ms back | standard |
| − / + weight | Number rolls one step up or down (old value slides out, new slides in, 12 px), button squishes to 0.92 | 150 ms | spring |
| Log set | New logged row drops in from the sheet and lands with a small overshoot. The set pill ticks to the next number. Reps field clears and keeps focus | 250 ms | spring |
| Next exercise | Current exercise slides out left and fades; next comes in from the right. Progress bar segment fills ink, next segment widens and turns amber | 250 ms | emphasized-out |
| Skip for now | Same as next, but the card visibly drops into the "Up next" list | 250 ms | emphasized-out |
| Remove set (✕) | Row collapses height and fades | 150 ms | standard |
| Sheets / dialogs | Slide up 24 px + fade; scrim fades to 45% | 250 ms in, 150 ms out | emphasized-out / standard |
| Error | Field border turns red with one 4 px horizontal nudge, message fades in | 150 ms | standard |
| **Weight goes up** (summary) | Amber card scales from 0.96 with a spring; the scalloped badge rotates 30° as it settles and the arrow bounces up once. Each increase row then slides in 60 ms after the last. "62.5 → 65" counts up. One short haptic tick (`navigator.vibrate(12)`) | 400 ms total | spring |
| Rep range beaten | Star pops from 0.6 to 1 | 250 ms | spring |
| Lower weight button | Button morphs into the confirmation line ("Lowered to 10 kg for next time.") | 250 ms | standard |
| Charts | Line draws left to right on first view only | 400 ms | standard |
| Snackbar | Slides up, auto-hides after 4 s | 250 ms | emphasized-out |

Respect `prefers-reduced-motion`: swap slides for cross-fades and drop the spring and the count-up. `tokens.css` already shortens the durations.

## Charts

- Ink line, 2.2 px, round joins. Solid dots for full sessions, hollow (white fill, ink stroke) for incomplete ones. The latest point is a larger amber dot.
- Reps per set: set 1 solid ink, set 2 dashed `amber-line`, set 3 (if any) dotted ink-2. The target range is an `amber-soft` band with dashed amber edges. The legend always sits under the chart.
- Sparklines (Progress, session screen): 80 × 32, no axes, latest point amber.
- Light gridlines (`line-soft`) at the min, mid and max only. Axis labels 10 px `ink-2`.

## Wording changes

I kept the meaning everywhere. Small additions:
- Session header "End" (was "End session"), to fit the header. The confirmation and the all-done button still say "End session".
- Setup step 1: helper text under the disabled Next button, "Add at least one exercise to continue."
- First time ever: "First time for this one. Nothing to compare with yet."
- Last exercise: the empty "Up next" says "This is the last one."
- "Nothing special" summary: "Steady session. Same weights next time. Beat every set by a rep and they go up."
- Delete routine, disabled while running: "A session of this routine is running. End it first."
- Broken backup file: "That file isn't a CDT Gym backup, or it's damaged. Nothing was changed."
- New exercise with fewer than 2 sessions: "Charts appear after your second session."

## Feature ideas (not in the designs)

1. **Rest timer**: optional, starts when you tap Log set, shown as a thin amber ring around the set pill, with a single vibration when it's done.
2. **Plate maths**: for barbell or plate-loaded machines, show which plates go on each side for the current weight.
3. **Machine settings note**: one line per exercise ("seat 4, pin 3") shown under the name on the session screen.
4. **Swipe to log**: swipe up on the sheet to log with the last-used reps, for fast repeats.
5. **Backup reminder**: a quiet nudge on the summary screen when the last backup is older than two weeks.
6. **Personal bests**: a small ★ in history and on the exercise page when a session sets a new best volume.
7. **Wear OS / lock-screen glance**: weight and set number on the watch or as a persistent notification during a session.
