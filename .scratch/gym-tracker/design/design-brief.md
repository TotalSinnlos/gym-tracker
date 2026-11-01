# Design brief: CDT Gym Tracker

Please design the look of a small gym-tracking app. The app already exists and works; this brief is about how it looks and feels, not what it does. Please design exactly the screens and actions described below. If you have ideas for new features, list them separately at the end instead of adding them to the screens.

## The app in one paragraph

**CDT Gym Tracker** is a personal app for tracking strength training at the gym. "CDT" is the nickname of the household, which has a black cat. You set up your exercises (machines, free weights, bodyweight) and a routine, and at the gym the app walks you through the routine one exercise at a time. For each exercise it shows the weight to use and what you did last time; you log the reps of each set. After each session it raises the weight automatically when you've earned it (every set at least one rep above the target range). Graphs show progress over time. It's used by one person, on their own Android phone.

## How and where it's used

- At the gym, **between sets**, often **one-handed**, with sweaty or chalky fingers. The phone is mostly **glanced at** from arm's length, then put down.
- The most-used screen by far is the **session screen**: see the weight, do the set, type the reps, tap "Log set", rest, repeat. This must be fast, calm and readable at a glance.
- Everything else (settings, history, graphs) is used occasionally, sitting down, with time to look.

## Constraints

- **Android phone**, **portrait only**. It must work on small (≈360 dp wide) and large phones. No tablet or landscape layouts.
- An **installable web app** (it lives on the home screen like a normal app) that **works fully offline**. It can't load anything from the internet while running: at most **one font**, which will be bundled into the app, otherwise the phone's own font (Roboto).
- **Light theme only.**
- **English** text. Weights are always in **kg**.
- **Large touch targets** (at least 48 dp), nothing important that needs a precise tap. The **main actions sit at the bottom of the screen**, in thumb reach.
- Good contrast: it has to be readable in a dimly lit gym.

## Look and feel

- **Inspired by Google's Material Design 3, in its "Expressive" flavour**, but not a 1:1 copy: it may have its own character. Think of Google's own apps: minimal, simple, very good UX.
- **Ever so slightly playful**, through **shapes, colour and motion** (varied rounded shapes, bolder colour for important moments, springy animations). Toned down a notch: calm overall, and the session screen stays especially clean.
- **Mostly calm and focused, with a touch of "data"**: the key numbers (weight, reps, set number) are big and bold; everything around them is quiet.
- **Colours: black and white with an amber accent** for the important things (the main button, increases, highlights). Derive the rest of the palette from that.
- **Motion: subtle and quick.** Tap feedback, a smooth change to the next exercise, small moments where something good happens. Never anything the user has to wait for.
- **Not wanted:** a loud, aggressive "sports brand" look (bold neon, heavy italics, attitude).
- How to make the end-of-session "your weight goes up" moment feel rewarding, and how to style the charts, is up to you.

## Logo and app icon

- A **black cat silhouette, with no eyes or face details, combined with a gym element** (for example sitting on, or curled around, a dumbbell or weight plate). Flat and simple, so it reads at small sizes.
- It must work as an **Android app icon** (round mask, "adaptive" icon with safe zone). Background colour and style are up to you.
- The cat appears **only as the logo/icon**, not as illustrations elsewhere in the app. Where the logo shows up in the app (for example the home screen header, the start-up splash screen, the welcome screen) is up to you.
- Name: **"CDT Gym Tracker"** inside the app; the shorter **"CDT Gym"** is the label under the home-screen icon.

## How to proceed

1. First, propose **2–3 distinct visual directions**, each shown on three screens: the **session screen**, the **home screen** and the **end-of-session summary**, plus the app icon.
2. The user picks one (or mixes).
3. Then design **every screen and state** below in that direction.

## Sample data to use

**Exercises** (name · type · current weight · weight step · sets × rep range):

| Exercise | Type | Weight | Step | Sets × reps |
|---|---|---|---|---|
| Leg press | Machine | 62.5 kg | +2.5 | 2 × 9–12 |
| Chest press | Machine | 40 kg | +2.5 | 2 × 9–12 |
| Lat pulldown | Machine | 45 kg | +2.5 | 2 × 9–12 |
| Seated row | Machine | 42.5 kg | +2.5 | 2 × 9–12 |
| Leg curl | Machine | 35 kg | +5 | 2 × 9–12 |
| Shoulder press | Free weight | 14 kg | +2 | 2 × 9–12 |
| Bicep curl | Free weight | 12 kg | +2 | 3 × 9–12 |
| Pull-ups | Bodyweight | – | – | 2 × 9–12 |

**Routines:** "Full body" (all eight, in the order above) and "Quick day" (Leg press, Chest press, Pull-ups).

**History:** about 25 past sessions over the last three months, mostly "Full body". Leg press went 50 → 62.5 kg in that time, with an increase roughly every three sessions; a few sessions have an exercise left incomplete or skipped.

## Screens and states

The app's own wording is given in quotes where it matters; feel free to improve wording, but keep the meaning.

### 1. First-run setup (shown once, before anything else)

Two steps:
- **Step 1, "Welcome!": add your exercises.** A form: name, type (Machine / Free weight / Bodyweight, as a 3-way choice), weight (kg) and weight step (kg) (both hidden for bodyweight), sets, min reps, max reps (with defaults 2 and 9–12 filled in). "Add exercise" adds it to a list below; tap an exercise in the list to edit it. A primary "Next" continues (disabled until at least one exercise exists).
- **Step 2, "Your routine": put exercises in order.** "Step 2 of 2: add your exercises in the order you usually do them." The routine as an ordered list (each item: number, name, short description like "Machine · 62.5 kg (+2.5) · 2 × 9–12", with move up / move down / remove). Below: the exercises to add (tap to add; the same exercise may be added twice, then it's marked "already in routine, adds it again"). Buttons "Back" and "Done" (finishes setup).
- A good place to welcome the user with the logo.

### 2. Home

- App name/logo, and the way to the other areas: **Progress** (overview), **History**, **Settings**. A bottom navigation bar (e.g. Home · Progress · History · Settings) is welcome if it suits the design. Every area must stay reachable.
- States:
  - **One routine:** a big "Start session" button, with the routine's exercises listed below ("Full body": 1. Leg press, 2. Chest press, …).
  - **Several routines:** "Start a session: pick a routine", with each routine as a tappable card showing its exercises ("Leg press · Chest press · Pull-ups").
  - **Session running:** a prominent "Resume session" instead (routine name and progress, e.g. "Full body · 3 of 8 done").
  - **No routine with exercises:** "Add exercises to a routine in settings to start a session."

### 3. Session screen (the most important one)

Shown while a session runs. It replaces the normal navigation: focused, nothing distracting.

- **Header:** a way back home (the session keeps running), and progress: "Full body · 3 of 8 done".
- **Current exercise**, in order of importance:
  1. **Exercise name** and the **weight** to use: very large. The weight can be changed with **− / +** buttons (by the exercise's step, e.g. 2.5 kg) or by typing. Bodyweight exercises have no weight.
  2. **Which set** is next: "Set 2 of 2" and the target: "Target: 2 × 9–12 reps". After the configured sets, further sets are "Extra set".
  3. **Last time:** "Last time: 12 × 42.5 kg, 13 × 42.5 kg", plus, when the weight went up since, a highlighted "↑ +2.5 kg since last time".
  4. A **small chart** of the exercise's recent weight (last 10 sessions); for bodyweight exercises, total reps.
- **Logging a set:** a reps field (numeric keyboard) and a weight field pre-filled with the session weight (can differ for a single set, e.g. a drop), then the main button **"Log set"**, in thumb reach.
- **Logged sets** of the current exercise: "Set 1: 11 × 45 kg". Tap one to correct it (same reps/weight form with "Save" / "Cancel"), or remove it (✕).
- **"Skip for now"**: moves the current exercise one place back (when the machine is busy). Not shown when only one exercise is left.
- **"Up next"**: the remaining exercises in order, each tappable to jump to it; a partly done one says "1 of 2 sets logged · tap to continue", others "Tap to do this now".
- **"Finished"**: done exercises ("✓ Leg press · 13 / 13 reps · tap to correct"), tappable to reopen and correct.
- **"End session"**: always available. If exercises aren't done, it asks first: "2 exercises not done. End anyway?" with "Keep going" / "End session".
- States to show:
  - **Weighted exercise** mid-way (Lat pulldown, set 2 of 2, set 1 logged as 11 × 45 kg, last time 12 × 42.5 and 13 × 42.5 kg, "↑ +2.5 kg since last time").
  - **Bodyweight exercise** (Pull-ups: no weight controls, last time "8 reps, 7 reps").
  - **First time ever** for an exercise (no "last time", no chart).
  - **Last exercise left** (no "Skip for now", empty "Up next").
  - **Correcting a logged set.**
  - **All exercises done:** "All exercises done! Correct anything below, or end the session." with "End session" as the main action.
  - The **"End anyway?"** confirmation.
  - An **error message** (e.g. "Reps must be a whole number of at least 0").

### 4. Forgotten session prompt

When the app opens and a session started more than 6 hours ago is still running: "Finish your session from Saturday 24 October?" ("Full body is still running. End it to save it under that day.") with **"End it"** (main) and **"Continue"**. Shown on its own, before anything else.

### 5. End-of-session summary

- Title "Session saved".
- Every exercise with its result: "✓ Done · 62.5 kg · 13 / 13 reps", "◐ Incomplete · 14 kg · 10 reps", "– Skipped".
- **Progression results** (this is the rewarding moment):
  - **Weight increases:** "↑ Leg press: 62.5 → 65 kg next time". Make this feel like an achievement.
  - **Rep range beaten** (bodyweight): "★ Pull-ups: rep range beaten. Time for a harder variation?"
  - **Below range:** "↓ Bicep curl: a set was below the rep range." with an optional button **"Lower to 10 kg next time?"**; after tapping, it reads "Lowered to 10 kg for next time." Never automatic, so it shouldn't feel like a failure or a warning.
- **Backup:** "Last backup: 20 Oct 2026, 19:05" and a "Back up" button (opens Android's share menu to save a file to Google Drive).
- **"Done"** returns home.
- States: a session with increases, a session with nothing special, and **"Session discarded"** ("Nothing was logged, so there was nothing to save.").

### 6. Progress (overview)

- Every exercise as a row: name, current weight ("62.5 kg", or "Bodyweight"), "Last increase: 3 Oct" (or "No increase yet"; nothing for bodyweight), and a **small trend line** of the last 10 sessions. Tap to open the exercise page.
- A short note on what the trend lines show.
- Empty state: "No exercises yet."

### 7. Exercise page

- Name, current weight, last increase, and a short description ("Machine · 62.5 kg (+2.5) · 2 × 9–12").
- **Weight over time** chart (weighted exercises only): one point per session. Sessions where the exercise was left **incomplete are hollow points**.
- **Reps per set** chart: one line per set number (set 1, set 2, …) across sessions, with the **target rep range shown as a band**, and a legend.
- A note when hollow points appear: "Hollow points are sessions where the exercise was left incomplete."
- **Settings** for the exercise: "Edit Leg press" opens the same form as in setup, plus **Archive** (hides it, keeps history) and, only for never-used exercises, **Delete**, each with a confirmation. Exercises with history show "This exercise has history, so it can be archived but not deleted."
- States: weighted exercise with 25 sessions; bodyweight exercise (no weight chart); a new exercise with 0–1 sessions.

### 8. History

- **List** of past sessions, newest first: "Sat 24 Oct 2026", "Full body · 7 of 8 done". Empty state: "No sessions yet. They'll appear here once you end one."
- **Session detail:** date and routine, then each exercise with its state, weight and every set ("Set 1: 13 × 62.5 kg"). Tap a set to correct it (same set form). If the correction affects the current weight, a note says so: "This is Leg press's latest result, so saving works out its current weight (now 65 kg) again."
- **"Delete session"** with a confirmation: "Delete this session? Its sets are removed from your history. Exercises whose latest result was in it go back to the weight they had before." with "Keep it" / "Delete session".
- State: **locked while a session is running**: viewable, but sets can't be tapped and deleting is hidden: "A session is running. You can correct or delete past sessions once it has ended."

### 9. Settings

- **Routines:** each routine as a card (name and its exercises); tap to open its editor: rename, put exercises in order (up/down), remove, add (from all exercises), and "Delete" with confirmation ("Delete this routine? Your exercises and past sessions are kept."). Delete is disabled with a reason when it's the only routine ("You need at least one routine, so it can't be deleted.") or its session is running. A field and button to create a "New routine". Routine changes apply from the next session.
- **Exercises:** all exercises; tap one to edit it (same form as setup) with Archive / Delete as on the exercise page. Archiving asks first and names the routines it will be taken out of. Below: "Add an exercise" with the empty form.
- **Archived exercises:** each with "Unarchive" ("Unarchived exercises come back without a routine; add them to one above."). Empty: "No archived exercises."
- **Backup:** last backup time, "Back up", and "Restore from backup" (pick a file). Restoring first shows what's in the file and asks: "Replace all your data with this backup from 20 Oct 2026, 19:05 (8 exercises, 24 sessions)?". A broken file gives a clear error.
- **Export:** "Export to spreadsheet": "All finished sessions as a CSV file, one row per set, for Excel or Google Sheets." After exporting: "Shared a spreadsheet with 412 sets."

### General elements to define

- Buttons: main (one per screen, in thumb reach), secondary, destructive, disabled, icon buttons (− / + / ✕ / ↑ / ↓).
- Text fields, including the numeric reps/weight fields (with "42,5" or "42.5" both accepted).
- Cards and list items, tappable and not.
- Confirmations (inline or as dialogs, your choice), error messages and short success messages.
- Exercise states: done, incomplete, skipped.

## What to hand back

In order of preference:
1. A **link to the design**, or **exported code** (HTML/CSS or React), including the colours, type sizes, spacing and corner radii as named values (design tokens).
2. Otherwise, **screenshots of every screen and state** above, plus a list of colours, font, type sizes, spacing and corner radii.

In both cases also:
- The **app icon** as **SVG**, plus PNGs at 192×192 and 512×512, and a "maskable" version with the safe zone respected.
- The **font**, if you chose one (name and weights used).
- Notes on **motion** (what animates, roughly how long, what kind of easing).
- Your separate list of **feature ideas**, if any.
