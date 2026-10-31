# 20: Automatic server backup

**What to build:** When server backup is set up, the app backs up by itself after each session ends, without the user doing anything. If the upload fails (offline, Tailscale off, server down), it tries again later: when the app is next opened or comes back online. A failed attempt never interrupts the user or blocks ending a session. If uploads fail because Chrome's local network permission was refused (see ticket 19), the app doesn't keep retrying silently: settings points out the problem. The end-of-session summary shows whether the server backup worked. When the last successful server backup gets old, settings says so. The rules for when a backup is due and when to retry live in the core.

**Blocked by:** 19

**Status:** done

- [x] Ending a session uploads a backup automatically
- [x] A failed upload is retried later, and only the latest data is uploaded (no queue of old backups)
- [x] Ending a session works the same with the server unreachable
- [x] The summary shows whether the server backup worked
- [x] Core tests cover when a backup is due and the retry rules
- [x] Tested on the user's phone: a session ended with Tailscale off is backed up once it's back on
- [ ] Carried over from ticket 18: a real backup shows up in the server's nightly offsite snapshot, and the service was running again after the server's next reboot

## Comments

**2026-10-31, done:** The core marks a server backup as due (`ServerBackup.dueSince`) when the server is connected and whenever exercises, routines or past sessions change (see the review comment below; this first said: a session saved, history corrected or deleted, a lowered weight chosen). A success clears it unless something changed during the upload; a failure is kept in `lastError`. `serverBackup()` reports `due`, `overdue` (over 24 hours) and `lastError`. `src/ui/autoBackup.tsx` uploads when there's a change no attempt has tried yet, when the app opens, comes to the foreground or back online, and every 5 minutes while open. With server backup set up, the summary shows a server backup card (with "Try again" after a failure) instead of the backup-file card. Settings shows a warning for a failed or overdue backup. Since the backup is one full copy of the data, retrying always sends the latest data, never a queue.

Checked:
- 9 new core tests (203 in total), including a session saved during an upload.
- In the built app on the PC, against an address that can't answer: the settings warning, the summary card, one new attempt when a session is saved even with an earlier failure waiting, and one more on "Try again". The dev server runs everything twice (React's strict mode) and showed a stale state there; the built app doesn't.
- On the user's phone: a test session ended with Tailscale off, then Tailscale back on and the app reopened; the server got the backup with the test session (12:36), then another one after the test session was deleted from history (12:37, the same size as before the test).

**Still open, carried over from ticket 18:** the nightly offsite snapshot containing the backups (first chance: the next nightly run), and the service running again after the server's next reboot. Both are for the user to check, outside the app.

**2026-10-31, after a code review (standards and spec):**

- The core now marks a backup as due in one place, `commit`, whenever exercises, routines or past sessions change, instead of in each command. This also covers restoring a backup file and editing exercises or routines, which the first version missed. Logging sets in a running session still doesn't count, so nothing uploads mid-workout.
- The rule for trying straight away moved into the core: `hasUntriedServerChanges()` is true when there's a change no attempt has tried to send yet. The app tries whenever it's true, so a session saved while an earlier backup failed is tried at once. A failure alone doesn't loop. The summary card no longer starts uploads itself; it only shows the status.
- Tidied: `ServerBackupCard` in its own file, `ServerBackup` built on `ServerConnection`, no field-by-field copy when a backup succeeds. Server details (the offsite tool, its schedule, a user id, the time zone in `server/compose-service.yml`) are out of the committed files; they remain in the public git history, and none are secrets.
- "Gets old" deliberately means "changes have waited over 24 hours" (`overdue`), not "the last backup is old": with nothing new to send, an old backup is still up to date, and a warning would only be noise.
- 6 new tests (209 in total). Checked again in the built app on the PC: no upload while logging sets, exactly one attempt when a session is saved with an earlier failure waiting, no loop afterwards, one more on "Try again".
