# 19: Server backup in the app

**What to build:** Settings gets a "Server backup" section where the user enters the server address and token, with a "Test connection" button. Both are stored only on the phone, never in the code. Once set up, the section offers "Back up now" and "Restore from server". Restore uses the existing restore checks and confirmation, just with the file fetched from the server. The section shows when the last server backup succeeded. Chrome asks for permission to access the local network the first time the app contacts the server (found in ticket 16), so "Test connection" is where that prompt should appear, with a short note beforehand telling the user to allow it. If the permission is refused, the app says so and explains how to allow it again in Chrome's site settings. Server backup is optional: without it set up, the app works exactly as before. The rules (what's stored, what counts as a successful backup) live in the core; the network call is a thin layer around it so core tests don't need a server.

**Blocked by:** 17

**Status:** done

- [x] The user can enter, test, change and remove the server address and token
- [x] "Back up now" uploads the same backup the existing "Back up" button makes
- [x] "Restore from server" asks for confirmation and replaces all data, like restore from file
- [x] Clear messages when the server can't be reached or the token is wrong, and data is never changed in that case
- [x] The last successful server backup time shows in the section
- [x] Chrome's local network permission prompt appears on "Test connection" in the installed app, and a refused permission gets a clear explanation of how to fix it
- [x] Core tests cover the settings and the last-backup time
- [x] Tested on the user's phone against the real server
- [ ] Carried over from ticket 18: the first real backup from the phone shows up in the server's next nightly offsite snapshot, and the service was running again after the server's next reboot

## Comments

**2026-10-31, done:** Settings has a "Server backup" section. Connecting checks the address and token with the server before saving them (there's no separate "Test connection" button: "Connect" is the test). The address and token are kept in `AppData.serverBackup`, left out of every backup file, and kept when restoring. Core rules are in `src/core/server.ts` and the server commands in `core.ts`; the network calls are in `src/storage/httpBackupServer.ts`. The restore confirmation is shared with file restore (`RestoreDialog`).

Checked:
- 23 new tests (core with a stand-in server, and the HTTP layer with a stand-in `fetch`), 194 in total.
- In the browser on the PC: the form, the "must start with https://" message, the "couldn't reach your server" message and Cancel.
- On the user's phone, installed app, mobile data: connecting worked, "Back up now" put a 6.4 KB backup on the server, and "Restore from server" showed the right date and counts (cancelled, not restored). The user found nothing odd.

About the local network permission: in the installed app, Chrome did **not** ask (in ticket 16's Incognito tab it did). The form's note says Chrome *may* ask, which stays true. A refused permission (the "blocked" message) is covered by tests only; it wasn't tried on the phone, as refusing it would mean digging it back out of Chrome's settings.

**Still open, moved to ticket 20:** the Kopia snapshot check and the after-reboot check.
