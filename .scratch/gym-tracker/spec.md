# Spec: Gym Tracker

Status: ready-for-agent

## Problem Statement

I train at the gym on a fixed routine, mostly on machines, plus some free-weight and bodyweight exercises. I do two sets per exercise, aiming for 9 to 12 reps. Whenever I manage 13 or more reps on every set, I raise the weight by one increment (usually 2.5 kg, 5 kg on a few machines) the next time. Right now I have to remember, or write down somewhere, which weight each exercise is on, how many reps I did last time, and whether I've earned an increase. I have no easy way to see my progress over time.

Machines and benches are also often busy, so I can't always follow my routine in order. Whatever I use to track my training has to cope with doing exercises out of order, coming back to a skipped one, and sometimes not getting to an exercise at all.

I want my own app on my Android phone that handles all of this, keeps my data safe, and lets me get the data out.

## Solution

A web app I install from Chrome to my phone's home screen. It opens full screen with its own icon, works offline at the gym, and stores all data on the phone. There are no accounts and no server.

- I set up my **Exercises**. Each is a machine, a free-weight exercise or a bodyweight exercise, with a number of sets and a target rep range. Machine and free-weight exercises also have a current weight and a weight increment. I put exercises in order to build one or more **Routines**.
- I start a **Session** by picking a routine. The app shows one exercise at a time, with its weight already filled in and a small chart of my recent progress on that exercise. I enter the reps for each set. If an exercise's equipment is busy, I tap "Skip for now" and the app shows the next exercise, then brings the skipped one straight back. I can also jump to any remaining exercise from an "Up next" list.
- When I end the session, the app saves it and raises the weight on every weighted exercise where I hit 13+ reps on all sets. It marks any exercise I never got to as skipped and then offers a one-tap backup to Google Drive through Android's share menu.
- Each exercise has a page with graphs of weight over time and reps per session. An overview page lists all exercises with their current weight, their last increase and a small trend line.
- I can export my full history as a CSV for spreadsheets, and save or restore a complete backup file.

## User Stories

### Setup and configuration

1. As a lifter, I want to add an exercise with a name, a type (machine, free weight or bodyweight), a number of sets and a target rep range, so that the app knows how I train it.
2. As a lifter, I want machine and free-weight exercises to also have a current weight and a weight increment, so that the app can track and raise the weight.
3. As a lifter, I want bodyweight exercises to have no weight, so that I only enter reps for them.
4. As a lifter, I want new exercises to default to 2 sets and a 9–12 rep range, so that adding one takes as few taps as possible.
5. As a lifter, I want to set each weighted exercise's increment (for example 2.5 kg or 5 kg on machines, or 2 kg for dumbbells), so that the automatic increases match the equipment's actual weight steps.
6. As a lifter, I want to edit an exercise's name, type, weight, increment, sets and rep range at any time, so that I can fix mistakes or change how I train.
7. As a lifter, I want to archive an exercise I no longer do, so that it stops cluttering my lists without losing its history.
8. As a lifter, I want to delete an exercise that has no history, so that I can remove one I added by mistake.
9. As a lifter, I want exercises with history to be archive-only, so that I can never lose workout data by deleting an exercise.
10. As a lifter, I want to unarchive an exercise, so that I can start doing it again with its history intact.
11. As a lifter, I want to create a routine by picking exercises and putting them in order, so that the app can lead me through my workout.
12. As a lifter, I want to reorder the exercises in a routine, so that the routine matches the order I actually train in.
13. As a lifter, I want to add exercises to and remove them from a routine, so that I can adjust my workout as my training changes.
14. As a lifter, I want removing an exercise from a routine to keep its history, so that I never lose data by editing a routine.
15. As a lifter, I want to have several routines (for example "Upper body" and "Legs"), so that I can train different splits on different days.
16. As a lifter, I want an exercise to be usable in several routines and keep one shared history, so that my progress on it is tracked no matter which routine I did it in.
17. As a lifter, I want to rename and delete routines, so that my list of routines stays tidy.
18. As a first-time user, I want the app to guide me through adding my exercises and building my first routine, so that I can get started without figuring out the app first.

### Running a session

19. As a lifter, I want to start a session by choosing a routine, so that the app knows which exercises to give me.
20. As a lifter, I want changes I make to a routine or an exercise's sets and rep range during a session to apply from the next session, so that my running workout doesn't shift under me.
21. As a lifter, I want weight changes I make in settings during a session to apply immediately, so that a correction takes effect right away.
22. As a lifter, I want the session screen to show one exercise at a time, so that I can focus on what I'm doing right now.
23. As a lifter, I want each weighted exercise's weight to be filled in already, so that I usually don't need to type it.
24. As a lifter, I want to see when an exercise's weight went up since last time (for example "60 kg (↑ +2.5 since last time)"), so that I'm not surprised by the heavier weight.
25. As a lifter, I want to change an exercise's weight on the session screen, so that I can drop back if an increase feels too heavy.
26. As a lifter, I want to enter my reps for each set, so that my performance is recorded.
27. As a lifter, I want each set's weight filled in with the exercise's weight and changeable for that set, so that a dropped weight on one set is recorded accurately.
28. As a lifter, I want to add an extra set or remove a set during a session, so that the record matches what I actually did.
29. As a lifter, I want to see my results from last time on this exercise (weight and reps per set), so that I know what to beat.
30. As a lifter, I want a compact chart of the exercise's recent progress on the session screen, so that I can see my trend right when I'm about to lift.
31. As a lifter, I want to tap "Skip for now" when an exercise's equipment is busy and have the exercise come back right after the next one, so that I can do another exercise and then return to it.
32. As a lifter, I want "Skip for now" to be hidden when the current exercise is the only one left, so that I'm never offered a skip that can't do anything.
33. As a lifter, I want an "Up next" list of the remaining exercises, so that I can see what's left in my workout.
34. As a lifter, I want to tap any exercise in the "Up next" list to do it now, so that I can work around several busy machines at once.
35. As a lifter, I want to go back to an exercise I already finished in this session and correct its reps, so that I can fix a typo straight away.
36. As a lifter, I want to end the session at any time with an "End session" button, so that I can leave the gym when I'm done even if I didn't do every exercise.
37. As a lifter, I want "End session" to ask for confirmation when exercises are still left, so that an accidental tap doesn't end my workout.
38. As a lifter, I want exercises I never got to marked as skipped when I end the session, so that the record shows what really happened.
39. As a lifter, I want an exercise where I logged some but not all sets to be saved as incomplete with the sets I did, so that my work isn't thrown away when a machine stays taken.
40. As a lifter, I want skipped and incomplete exercises to keep their weight unchanged, so that missing an exercise doesn't count against my progression.
41. As a lifter, I want a session where I logged no sets to be discarded when I end it, so that accidental sessions don't clutter my history.
42. As a lifter, I want my session in progress restored exactly when I reopen the app after closing it, locking the phone or running out of battery, so that I never lose a workout halfway through.
43. As a lifter, I want the app to ask whether to end or continue a session that has been open for more than 6 hours, so that a session I forgot to end gets saved with the right date.
44. As a lifter, I want app updates to wait until no session is running, so that an update never disrupts a workout.
45. As a lifter, I want the app to work fully offline, so that bad reception at the gym doesn't matter.

### Progression

46. As a lifter, I want a weighted exercise's weight raised by its increment for next time when every set reached at least one rep above the top of the rep range (13+ for a 9–12 range), so that I don't have to remember to raise it myself.
47. As a lifter, I want no increase when any set fell short of that, so that the weight only goes up once I've earned it.
48. As a lifter, I want no increase when I did fewer sets than the exercise's configured number, so that a cut-short exercise doesn't count as earned.
49. As a lifter, I want no increase when any set was done at a lower weight than the session weight, so that a dropped set doesn't count as earned.
50. As a lifter, I want the end of a session to show which exercises go up next time, so that I get a moment of satisfaction and know what's coming.
51. As a lifter, I want the end of a session to show which bodyweight exercises beat the rep range on every set, so that I know when to switch to a harder variation.
52. As a lifter, I want the end of a session to note exercises where any set fell below the rep range minimum, so that I notice when a weight is too heavy.
53. As a lifter, I want a button next to a below-range weighted exercise that lowers its weight by one increment for next time, so that I can drop back in one tap if I choose to.
54. As a lifter, I want the weight never lowered automatically, so that one bad day doesn't undo my progress.

### History and editing

55. As a lifter, I want a list of my past sessions with their dates and routines, so that I can look back at my training.
56. As a lifter, I want to open a past session and see every exercise, set, weight and rep count, so that I can review what I did.
57. As a lifter, I want to correct the reps or weight of a set in a past session, so that typos don't spoil my history and graphs.
58. As a lifter, I want the increase to be worked out again when I correct an exercise's most recent session, so that a typo (for example 31 instead of 13) doesn't leave a wrong weight in place.
59. As a lifter, I want to delete a session I logged by mistake, so that it doesn't distort my history.

### Graphs

60. As a lifter, I want each weighted exercise's page to show a graph of its weight over time, with a point for each session, so that I can see my strength increase.
61. As a lifter, I want each exercise's page to show my reps per set for each session, so that I can see my reps climbing toward the next increase.
62. As a lifter, I want incomplete sessions shown as hollow points in the graphs, so that I can tell a partial session apart from a full one.
63. As a lifter, I want an overview page listing all active exercises with their current weight (or "bodyweight"), the date of their last increase and a small trend line, so that I can see at a glance where I'm progressing and where I'm stuck.
64. As a lifter, I want to tap an exercise on the overview page to open its page, so that I can go from summary to detail quickly.

### Backup, restore and export

65. As a lifter, I want a "Back up" button after ending a session that opens Android's share menu with a backup file, so that I can save it to Google Drive in one tap.
66. As a lifter, I want to make a backup at any time from settings, so that I don't have to wait until after a session.
67. As a lifter, I want the backup file to contain everything (exercises, routines, sessions and settings), so that it can fully restore the app.
68. As a lifter, I want to restore from a backup file, so that I can recover my data after clearing Chrome's data or moving to a new phone.
69. As a lifter, I want to be warned and asked to confirm before a restore replaces my current data, so that I don't wipe my data by accident.
70. As a lifter, I want the app to show when I last made a backup, so that I notice when I'm overdue.
71. As a lifter, I want to export my history as a CSV with one row per set (date, routine, exercise, exercise type, set number, weight, reps), so that I can analyse it in Excel or Google Sheets.
72. As a lifter, I want the app to ask Chrome to keep its data permanently, so that Chrome doesn't clear my data automatically when the phone runs low on storage.

### Installation and updates

73. As a lifter, I want to install the app to my home screen from Chrome, so that it opens like a normal app with its own icon.
74. As a lifter, I want new versions of the app to arrive automatically the next time I open it online, so that I get improvements without reinstalling.
75. As a lifter, I want my data kept across app updates, so that improvements never cost me my history.
76. As a lifter, I want to share the app's link with someone else so they can install it with their own separate data, so that my girlfriend can use it too.

## Implementation Decisions

### Platform

- The app is an installable Progressive Web App (PWA): a web manifest plus a service worker that caches all app files, so the app installs to the home screen and runs fully offline.
- All data is stored on the device in the browser's IndexedDB. There is no backend, no login and no data leaves the phone except through user-triggered backup and export.
- On first launch, the app calls the browser's persistent-storage request so Chrome doesn't evict its data when storage runs low.
- Every user installs from the same link and gets their own data on their own device.
- The app is hosted on GitHub Pages from a public GitHub repository named `gym-tracker`, at `https://<github-username>.github.io/gym-tracker/`. The repository holds only code and docs, never workout data.
- The very first build step publishes a bare-bones version to GitHub Pages, so the app can be installed on the phone straight away and every later step can be tried on the real device.
- New app versions are downloaded in the background by the service worker but only activated when no session is running.
- The app is built in TypeScript.
- The user interface is in English.
- Units are kilograms only. Weights can never go below 0 kg.

### Domain vocabulary

- **Exercise**: something the user trains, with a name, a type, a configured number of sets, a target rep range (minimum and maximum) and an archived flag. An exercise owns its history.
- **Exercise type**: one of:
  - `machine` or `free weight`: weighted types, which also have a current weight and an increment. They behave identically; the type is a label for display and export.
  - `bodyweight`: has no weight and records reps only.
- **Routine**: a named, ordered list of references to exercises. An exercise can appear in many routines, and more than once in the same routine (each occurrence becomes its own session entry; the last finished one decides the new weight). Routines hold no weights or history.
- **Session**: one workout. It records the routine it was started from, its start and end times, and one **Session entry** per exercise in the routine. A session's date is its start time.
- **Session entry**: an exercise's record within a session. It holds:
  - a session weight (the working weight that day, absent for bodyweight exercises);
  - a snapshot of the exercise's configured sets and rep range at session start;
  - a list of sets;
  - a state: `pending`, `done`, `incomplete` or `skipped`;
  - whether the user chose to lower the weight from the end-of-session summary.
- **Set**: one round of an exercise, with a rep count and, for weighted exercises, a weight.
- **Increment**: how far a weighted exercise's weight goes up when the progression rule is met.
- For free weights, the weight is whatever the user consistently enters (for example per dumbbell). The app doesn't interpret it.

### Core module (the main seam)

- All rules live in one core module that has nothing to do with the screens. The UI only sends commands to it and displays what it returns. Persistence sits behind a storage interface, so the core can run against an in-memory store in tests and against IndexedDB in the app.
- Commands the core exposes, roughly:
  - Exercises: create, update, archive, unarchive and delete (only allowed for exercises with no history).
  - Routines: create, rename, delete, reorder, add an exercise and remove an exercise.
  - Sessions: start a session from a routine, set the session weight, log a set, edit a set, add a set, remove a set, skip the current exercise, jump to an exercise, end the session, lower an exercise's weight from the summary, edit a past session and delete a session.
  - Data: create a backup, restore a backup and export CSV.
- Queries the core exposes, roughly: the active session (the current exercise, the "Up next" list in order, whether skipping is available, how many exercises are left, whether the session is stale, and last time's results for the current exercise), session history, an exercise's history series for graphs, the overview summary and the date of the last backup.

### Routine and exercise management

- A routine can be deleted, except the routine of the running session and the last remaining routine (so there's always one to start from). Past sessions keep the deleted routine's name.
- Starting a session offers only routines with at least one exercise. With one such routine, "Start session" starts it; with several, the home screen asks which one.
- Archiving an exercise hides it from exercise lists and "add to routine" pickers, keeps its history and current weight, and takes it out of every routine (the user is told which ones before confirming). So no routine, and no new session, ever contains an archived exercise; starting a session from a routine that somehow does is rejected. Archived exercises can't be added to routines. A running session keeps an exercise archived mid-session, and its result still counts. Unarchiving brings it back with its history but doesn't put it back into any routine.
- An exercise has history when any saved session or the running session has an entry for it, even a skipped one. Only an exercise without history can be deleted; deleting also takes it out of every routine.

### Session queue behaviour

- When a session starts, the queue holds the routine's exercises in routine order, and the first one is current. The session keeps this snapshot of the routine and of each exercise's sets and rep range. Changes to them in settings apply from the next session. Changes to an exercise's current weight in settings update the session weight of its pending entries immediately; if the exercise was already done in this session, the weight set in settings wins at the end instead of the session's result. An exercise switched to bodyweight during a session gets no weight written back.
- Only one session can be active at a time.
- "Skip for now" swaps the current exercise with the next pending exercise, so the skipped exercise comes back immediately after it.
- Skipping is only available while at least one other exercise is pending. When the current exercise is the only one left, the UI hides "Skip for now", and the user either does it or taps "End session" (which marks it skipped). The core rejects a skip command in that state.
- "Jump to" makes any pending exercise current. The exercise that was current stays in the queue, keeping its position, and is remembered as the one to go back to (as is an exercise skipped with "Skip for now").
- When an exercise's last configured set is logged, the entry becomes `done` and the exercise the user jumped or skipped away from becomes current again; otherwise the first pending exercise in queue order does. "Up next" lists pending exercises in that same order. The user can still go back and edit a done entry during the session.
- An exercise jumped away from after logging some of its sets stays pending, keeps its logged sets, and remains in the "Up next" list.
- "End session" asks for confirmation when any entry is still pending.
- Ending the session marks each remaining `pending` entry as `incomplete` if it has at least one set, and as `skipped` if it has none.
- A session that ends with no sets logged at all is discarded instead of saved.
- The active session is saved after every command, so reopening the app always resumes it exactly.
- A session is stale when it started more than 6 hours ago. When the app opens on a stale session, it asks whether to end it (saved as normal, dated by its start time) or continue it.

### Progression rule

- When a session ends, the core evaluates each `done` entry of a weighted exercise. The exercise's current weight is set to the entry's session weight, plus the increment if the entry qualifies.
- An entry qualifies when:
  - it has at least the configured number of sets in its snapshot,
  - every set is at the session weight or higher, and
  - every set's reps are at least the rep range maximum plus one.
- Skipped and incomplete entries leave the exercise's weight unchanged and never qualify.
- **Below range**: an entry is below range when any of its sets has fewer reps than the rep range minimum. The end-of-session summary notes it. For weighted exercises, the summary offers a "Lower to X kg next time?" button. Tapping it sets the exercise's current weight to the session weight minus one increment, and records the choice on the entry. The weight is never lowered automatically.
- Weights are clamped at 0 kg.
- If the user changes the session weight on the session screen, that becomes the basis for the exercise's new current weight. Lowering the weight for a single set only affects that set's record, and it disqualifies the increase.
- Bodyweight exercises have no automatic progression. When a done bodyweight entry has at least the configured number of sets and every set reaches at least the rep range maximum plus one, the end-of-session summary flags it as "rep range beaten". Nothing is changed automatically.
- Editing a past session works out the progression again only when that session is the exercise's most recent completed session. Editing an older session only corrects the record. The exercise's current weight is derived again from the corrected session entry, as if the session had just ended. A recorded choice to lower the weight is respected, as long as the corrected entry is still below range.
  - A history edit changes only a set's reps and weight (checked like a set logged during a session); entry states stay as they are.
  - Only an edit to the entry that counts recalculates: the one that decided the weight when the session ended, or the latest result the lowering is recorded on. Correcting another occurrence of the same exercise only fixes the record.
  - Recalculating replaces any weight set in settings since that session. In order, the new weight is: the lowered weight, if a lowering was chosen and the entry is still below range (no longer below range, the lowering no longer applies); else a weight set in settings during that session, which still wins; else the done entry's progression. An exercise that was only incomplete keeps its weight, unless a lowering on it no longer applies (then it goes back to that session weight).
  - Bodyweight exercises, and exercises switched to or from bodyweight since, never get a weight from a recalculation. Archived exercises are recalculated like any other and keep the weight for when they're unarchived.
  - Deleting a session never changes current weights; it only removes the record.
  - Corrections and deletions wait until no session is running, so a running session's weights never shift under it. History can still be viewed.
- To show "↑ +2.5 since last time", the core compares the exercise's current weight with the session weight of its most recent completed entry.
- "Last time" on the session screen and the "most recent completed entry" mean the latest `done` or `incomplete` entry for that exercise, from any routine.

### Backup and export

- The backup is a single JSON file containing all exercises, routines, sessions and the app's settings, plus a format-version number so future versions of the app can still read old backups.
- "Back up" uses the browser's Web Share API with a file, which opens Android's share menu so the user can pick Google Drive. Where file sharing isn't available, the app falls back to downloading the file.
- Restore reads a backup file chosen by the user, checks it, asks for confirmation, then replaces all existing data.
- The app records the time of the last backup and shows it in settings and on the end-of-session screen.
- The CSV export has one row per set, with columns: date, routine, exercise, exercise type, set number, weight in kg (empty for bodyweight), reps. Skipped entries produce no rows.

### Screens

- **Home**: start a session (pick a routine), or resume an active one. Links to the overview, history and settings.
- **Session screen**: the current exercise, its weight (editable, hidden for bodyweight), last time's results, a compact progress chart, set inputs, "Skip for now" (hidden when only one exercise is left), the "Up next" list and "End session".
- **End-of-session summary**: exercises done, incomplete and skipped, upcoming weight increases, bodyweight exercises that beat the rep range, below-range exercises (with a "lower weight" button for weighted ones), and the "Back up" button.
- **Overview**: all active exercises with their current weight (or "bodyweight"), the date of the last increase and a small trend line.
- **Exercise page**: a weight-over-time graph (weighted exercises only), a reps-per-session graph (incomplete sessions shown as hollow points) and the exercise's settings.
- **History**: a list of past sessions. Each opens a detail view where sets can be edited and the session deleted.
- **Settings**: manage exercises (including archived ones), manage routines, back up, restore and export CSV.
- **First-run setup**: add exercises, then build the first routine.
- The visual design will be done separately in Claude Design. A design brief describing these screens will be written when the build reaches that point, and the result will be built into the app.

## Testing Decisions

- A good test checks behaviour the user would notice, through the core module's commands and queries. Tests don't depend on internal details such as how data is laid out in storage, so the inside of the core can be reorganised freely without breaking tests.
- The core module is the single test seam. Tests run it against an in-memory store and cover:
  - the session queue: starting, skip, skip being unavailable (and rejected) when only one exercise is left, jump to (including away from a partly logged exercise), completing entries, going back to edit a done entry, ending with pending entries becoming incomplete or skipped, and discarding an empty session;
  - session snapshots: routine and sets/rep-range edits during a session don't affect it, and weight edits do;
  - the progression rule: qualifying, one set short of the threshold, fewer sets than configured, a dropped weight on one set, a changed session weight, skipped and incomplete entries, and bodyweight exercises being flagged but never changed;
  - below range: detection, lowering by one increment only when chosen, clamping at 0 kg, and no lowering offered for bodyweight;
  - editing past sessions: recalculation for the most recent session (respecting a recorded lowering choice), no recalculation for older ones, and deleting a session;
  - deleting exercises: allowed without history, rejected with history;
  - routines and archiving: several routines sharing an exercise's history, deleting routines (not the running session's or the last one), archiving taking an exercise out of routines while keeping its history, and unarchiving;
  - resuming: a session interrupted after any command continues exactly where it left off when the core is reloaded from the same store, and a session older than 6 hours is reported as stale;
  - backup and restore: the data after a backup followed by a restore is identical to the data before, and a malformed or wrong-version file is rejected without touching existing data;
  - CSV export: the correct columns, one row per set, an empty weight for bodyweight, and no rows for skipped entries.
- Screens, charts, installing to the home screen, sharing to Drive, offline behaviour and update timing are checked by hand on the phone.
- There's no prior art: the repo is empty, so this spec sets up the test conventions.

## Out of Scope

- Automatic backup to Google Drive through the Drive API (a possible later upgrade if the share-menu backup gets tedious).
- A rest timer, since the user times rest on a Garmin watch.
- A total-volume graph (weight × reps × sets).
- Accounts, logins, servers, syncing between devices, and shared or social features such as seeing another user's progress.
- Importing workouts from before the app existed.
- Units other than kilograms.
- Cardio and timed exercises (for example running, cycling, planks).
- Added weight on bodyweight exercises (for example weighted dips or pull-ups).
- Publishing to the Google Play Store.

## Further Notes

- The first version is for the user alone, as a trial over a few sessions. Changes based on real use are expected afterwards, which is why the core rules are fully covered by automated tests.
- Sharing with a second user later needs no changes: they install from the same link and get their own separate data.
- The development PC doesn't have Node.js or GitHub CLI installed yet. Installing them, and logging in to GitHub CLI, is the first step of the build. It's a `ready-for-human` task that the user does with step-by-step guidance.
- The visual design will come from Claude Design, using a brief written at the right point in the build. A link or exported code is the preferred thing to bring back.
