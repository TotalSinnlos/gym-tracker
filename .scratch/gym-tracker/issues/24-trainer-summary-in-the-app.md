# 24: Trainer summary in the app

**What to build:** The app side of the trainer, as described in the spec's "AI trainer" section. Settings gets a "Trainer" switch, available once server backup is set up, with a short note saying that sessions, history and earlier summaries are sent to the AI through the home server, and a "Goals and notes" box that can be changed any time and left empty. With the trainer on, ending a session marks a summary as due; the app sends the core's trainer brief to `POST /trainer` and stores the reply on the session. The end-of-session summary shows a trainer card ("Writing your summary…", then the summary, or "Your summary will arrive once you're online" after a failure, with "Try again"). A due summary is retried like the server backup: when the app opens, comes to the foreground or comes back online; a late one simply appears in History. The session's detail view in History shows its summary and a "Write again" button ("Write summary" if it has none). Turning the trainer off or disconnecting the server cancels due summaries and keeps existing ones. Summaries are part of backups and restore, and are deleted with their session. The rules (the brief and its worked-out facts, what an older session's brief leaves out, trimming when too large, when a summary is due, storing and replacing it) live in the core; the network call is a thin layer like `httpBackupServer.ts`.

**Blocked by:** 22 (the phone test also needs 23)

**Status:** ready-for-agent

- [x] The trainer can be turned on and off in settings, only once server backup is set up, and is off by default
- [x] The goals and notes can be changed at any time and left empty
- [x] The trainer brief has the session, all sessions before it (archived exercises marked), the worked-out facts per exercise, the exercises, routines and progression rule, all earlier summaries with dates, and the goals text
- [x] A brief for an older session leaves out every session and summary after it
- [x] A brief the server calls too large is sent again without the oldest session lines, keeping the per-exercise facts
- [x] Ending a session with the trainer on makes a summary due; with it off, nothing is sent
- [x] The summary shows on the end-of-session screen and in the session's History detail
- [x] "Write again" replaces a summary, and "Write summary" writes one for a session without, one session at a time
- [x] Turning the trainer off or disconnecting the server cancels due summaries and keeps existing ones
- [ ] A session ended offline gets its summary once the app is back online, and ending a session is never slowed or blocked
- [x] Summaries survive backup and restore, and are deleted with their session
- [x] Core tests cover everything listed for the AI trainer in the spec's testing decisions
- [ ] Tested on the user's phone: a real session gets a summary, and one ended with Tailscale off gets it later
- [ ] The user has read summaries from a few real sessions and says whether the advice is useful (the instructions in ticket 22 get tuned if not)

## Comments

**2026-10-31, notes from ticket 22:** A summary takes 10-40 seconds (the model thinks first), and the server waits up to 90 seconds for the AI, so the app's request needs a longer timeout than that, and the "Writing your summary…" state will really be seen. The summary is plain text with "- " bullet points and line breaks: show it with its line breaks kept. `POST /trainer` answers `{ "summary" }`, or a `reason`: `too-large` (send again with fewer old session lines), `busy` (try again later), `not-set-up` and `failed` (problems on the server: say so rather than retry forever), `invalid` (a bug in the app). Gemini's free tier often answers "busy" on its newest models, so a due summary waiting a while is normal.

**2026-10-31, note from ticket 23:** On the real server, Gemini once left a request hanging until the server's 90-second timeout instead of answering "busy". So "Writing your summary…" can last the full 90 seconds before the app hears `busy`, and the app's own timeout has to be longer than that.

**2026-10-31, built (phone test still open):** The core keeps a summary on its session (`Session.trainerSummary`), the trainer settings in `Settings.trainer` (on/off and the goals, part of backups) and the summaries still to be written in `AppData.trainerDue` (kept out of backup files, like the server details). `src/core/trainer.ts` builds the brief; the commands are in `core.ts` under "AI trainer" (`trainer`, `setTrainerEnabled`, `setTrainerGoals`, `trainerBrief`, `trainerSummaryStatus`, `trainerDue`, `writeTrainerSummary`). A brief the server calls too large is sent again with a quarter of the remaining old sessions left out each time. `httpBackupServer.ts` got `summarize` (waits up to 120 seconds). On screen: `src/ui/autoTrainer.tsx` writes due summaries one at a time (straight after a session, then on opening, coming to the foreground, coming back online and every 15 minutes; after an "offline" or "busy" failure it stops for that round, since the rest would fail the same way), `TrainerCard.tsx` on the summary screen and in History, `TrainerSection.tsx` in settings (switch, goals box, note on what's sent).

Small departures from the spec, now written into it:
- Archived exercises are marked with the date they were **last done**: the app has never recorded when an exercise was archived.
- History shows a session's summary even with the trainer off (it's the user's data); only "Write again" needs the trainer on.
- Failures that won't pass by themselves (no AI key on the server, a wrong key) are shown with their reason and a "Try again" button, and also retried with the others (on opening, foreground, online, every 15 minutes). Those retries don't reach Google or fail straight away, so they cost no free requests.

Checked:
- 21 new core tests (`trainer.test.ts`) and 3 for the HTTP layer; 250 in total, typecheck and build clean. A printed sample brief read correctly, and writing the tests caught one bug (a skipped weighted exercise's facts treated it as bodyweight), now fixed.
- In the built app in Chrome on the PC, phone-sized, with practice data and a stand-in for the server's answers (no real server or AI involved): the settings section and switch, a session ended → "Writing your summary…" → the summary with its parts in bold and points as a list, then the server backup ran again; "Write summary" in History with a server problem (clear error) and then successfully ("Written …", "Write again"); a session ended "offline" → "Your summary will arrive once you're online…" → the summary arrived on its own once the app saw the connection come back.
