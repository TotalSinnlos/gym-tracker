# 24: Trainer summary in the app

**What to build:** The app side of the trainer, as described in the spec's "AI trainer" section. Settings gets a "Trainer" switch, available once server backup is set up, with a short note saying that sessions, history and earlier summaries are sent to the AI through the home server, and a "Goals and notes" box that can be changed any time and left empty. With the trainer on, ending a session marks a summary as due; the app sends the core's trainer brief to `POST /trainer` and stores the reply on the session. The end-of-session summary shows a trainer card ("Writing your summary…", then the summary, or "Your summary will arrive once you're online" after a failure, with "Try again"). A due summary is retried like the server backup: when the app opens, comes to the foreground or comes back online; a late one simply appears in History. The session's detail view in History shows its summary and a "Write again" button ("Write summary" if it has none). Turning the trainer off or disconnecting the server cancels due summaries and keeps existing ones. Summaries are part of backups and restore, and are deleted with their session. The rules (the brief and its worked-out facts, what an older session's brief leaves out, trimming when too large, when a summary is due, storing and replacing it) live in the core; the network call is a thin layer like `httpBackupServer.ts`.

**Blocked by:** 22 (the phone test also needs 23)

**Status:** ready-for-agent

- [ ] The trainer can be turned on and off in settings, only once server backup is set up, and is off by default
- [ ] The goals and notes can be changed at any time and left empty
- [ ] The trainer brief has the session, all sessions before it (archived exercises marked), the worked-out facts per exercise, the exercises, routines and progression rule, all earlier summaries with dates, and the goals text
- [ ] A brief for an older session leaves out every session and summary after it
- [ ] A brief the server calls too large is sent again without the oldest session lines, keeping the per-exercise facts
- [ ] Ending a session with the trainer on makes a summary due; with it off, nothing is sent
- [ ] The summary shows on the end-of-session screen and in the session's History detail
- [ ] "Write again" replaces a summary, and "Write summary" writes one for a session without, one session at a time
- [ ] Turning the trainer off or disconnecting the server cancels due summaries and keeps existing ones
- [ ] A session ended offline gets its summary once the app is back online, and ending a session is never slowed or blocked
- [ ] Summaries survive backup and restore, and are deleted with their session
- [ ] Core tests cover everything listed for the AI trainer in the spec's testing decisions
- [ ] Tested on the user's phone: a real session gets a summary, and one ended with Tailscale off gets it later
- [ ] The user has read summaries from a few real sessions and says whether the advice is useful (the instructions in ticket 22 get tuned if not)

## Comments

**2026-10-31, notes from ticket 22:** A summary takes 10-40 seconds (the model thinks first), and the server waits up to 90 seconds for the AI, so the app's request needs a longer timeout than that, and the "Writing your summary…" state will really be seen. The summary is plain text with "- " bullet points and line breaks: show it with its line breaks kept. `POST /trainer` answers `{ "summary" }`, or a `reason`: `too-large` (send again with fewer old session lines), `busy` (try again later), `not-set-up` and `failed` (problems on the server: say so rather than retry forever), `invalid` (a bug in the app). Gemini's free tier often answers "busy" on its newest models, so a due summary waiting a while is normal.

**2026-10-31, note from ticket 23:** On the real server, Gemini once left a request hanging until the server's 90-second timeout instead of answering "busy". So "Writing your summary…" can last the full 90 seconds before the app hears `busy`, and the app's own timeout has to be longer than that.
