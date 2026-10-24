# 12: Forgotten sessions and safe updates

**What to build:** If the app opens while a session that started more than 6 hours ago is still active, it asks "Finish your session from <day>?" with the choices **End it** (saved as normal, dated by its start time) or **Continue**. New versions of the app download in the background but only take over when no session is running, so an update never interrupts a workout.

**Blocked by:** 04

**Status:** ready-for-human

- [x] Opening the app with a session older than 6 hours shows the prompt
- [x] "End it" saves the session with its start date, and "Continue" resumes it
- [x] Sessions younger than 6 hours resume without a prompt
- [ ] A new version deployed during an active session doesn't activate until the session has ended, and then applies on the next app open (to confirm on the phone during a real session)
- [x] Core tests cover the stale-session query (using a controllable clock)
