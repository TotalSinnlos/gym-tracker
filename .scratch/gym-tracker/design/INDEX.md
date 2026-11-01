# CDT Gym Tracker: screens for implementation

Design direction A ("Plate"). Read `README.md` for layout rules, motion and charts, and use `tokens.css` for every value.

- `screens/*.html`: one static HTML mockup per screen/state, 390 dp wide. Inline styles mirror the tokens. Open in a browser, or read the markup for exact sizes, colours and copy.
- `png/*.png`: the same screens as 2x screenshots.
- `fonts/RobotoFlex-wght-latin.woff2`: Roboto Flex, Latin subset, weight axis only (SIL OFL). Bundle this one font.
- `icon/`: app icon SVGs and PNGs (round `any` and `maskable`).

Boards marked full scroll show the whole scroll length. The session sheet, main buttons and bottom nav are fixed to the bottom of the viewport in the app.

| # | File | Screen / state | Size |
|---|---|---|---|
| 1 | `01-splash` | Splash | 390×844 |
| 2 | `02-setup-1` | Setup 1 · Exercises (full scroll) | 390×1240 |
| 3 | `03-setup-1b` | Setup 1 · Bodyweight, nothing added | 390×844 |
| 4 | `04-setup-2` | Setup 2 · Routine (full scroll) | 390×1240 |
| 5 | `05-home-one` | Home · One routine | 390×844 |
| 6 | `06-home-several` | Home · Several routines | 390×844 |
| 7 | `07-home-running` | Home · Session running | 390×844 |
| 8 | `08-home-empty` | Home · No routine | 390×844 |
| 9 | `09-forgotten` | Forgotten session | 390×844 |
| 10 | `10-ses-weighted` | Session · Weighted (full scroll) | 390×1520 |
| 11 | `11-ses-bodyweight` | Session · Bodyweight | 390×844 |
| 12 | `12-ses-first` | Session · First time | 390×844 |
| 13 | `13-ses-last` | Session · Last exercise left | 390×844 |
| 14 | `14-ses-correct` | Session · Correcting a set | 390×844 |
| 15 | `15-ses-error` | Session · Error | 390×844 |
| 16 | `16-ses-alldone` | Session · All done (full scroll) | 390×1060 |
| 17 | `17-ses-endconfirm` | Session · End anyway? | 390×844 |
| 18 | `18-sum-increases` | Summary · Increases (full scroll) | 390×1500 |
| 19 | `19-sum-plain` | Summary · Nothing special | 390×844 |
| 20 | `20-sum-discarded` | Summary · Discarded | 390×844 |
| 21 | `21-progress` | Progress (full scroll) | 390×1040 |
| 22 | `22-progress-empty` | Progress · Empty | 390×844 |
| 23 | `23-ex-weighted` | Exercise · Weighted (full scroll) | 390×1480 |
| 24 | `24-ex-bodyweight` | Exercise · Bodyweight (full scroll) | 390×1160 |
| 25 | `25-ex-new` | Exercise · New (full scroll) | 390×1040 |
| 26 | `26-hist-list` | History (full scroll) | 390×1040 |
| 27 | `27-hist-empty` | History · Empty | 390×844 |
| 28 | `28-hist-detail` | History · Session detail (full scroll) | 390×1620 |
| 29 | `29-hist-correct` | History · Correcting a set | 390×844 |
| 30 | `30-hist-delete` | History · Delete session? | 390×844 |
| 31 | `31-hist-locked` | History · Locked (session running) | 390×1040 |
| 32 | `32-set-main` | Settings (full scroll) | 390×1840 |
| 33 | `33-set-routine` | Settings · Routine editor (full scroll) | 390×1560 |
| 34 | `34-set-routinedelete` | Settings · Delete routine? | 390×844 |
| 35 | `35-set-exercise` | Settings · Edit exercise (full scroll) | 390×1000 |
| 36 | `36-set-archive` | Settings · Archive exercise? | 390×844 |
| 37 | `37-set-restore` | Settings · Restore backup? | 390×844 |
| 38 | `38-set-messages` | Settings · Restore error, export done | 390×844 |
| 39 | `39-components` | Components | 900×1900 |
| 40 | `40-tokens` | Tokens | 900×1400 |
