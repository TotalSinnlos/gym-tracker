# 19: Server backup in the app

**What to build:** Settings gets a "Server backup" section where the user enters the server address and token, with a "Test connection" button. Both are stored only on the phone, never in the code. Once set up, the section offers "Back up now" and "Restore from server". Restore uses the existing restore checks and confirmation, just with the file fetched from the server. The section shows when the last server backup succeeded. Chrome asks for permission to access the local network the first time the app contacts the server (found in ticket 16), so "Test connection" is where that prompt should appear, with a short note beforehand telling the user to allow it. If the permission is refused, the app says so and explains how to allow it again in Chrome's site settings. Server backup is optional: without it set up, the app works exactly as before. The rules (what's stored, what counts as a successful backup) live in the core; the network call is a thin layer around it so core tests don't need a server.

**Blocked by:** 17

**Status:** ready-for-agent

- [ ] The user can enter, test, change and remove the server address and token
- [ ] "Back up now" uploads the same backup the existing "Back up" button makes
- [ ] "Restore from server" asks for confirmation and replaces all data, like restore from file
- [ ] Clear messages when the server can't be reached or the token is wrong, and data is never changed in that case
- [ ] The last successful server backup time shows in the section
- [ ] Chrome's local network permission prompt appears on "Test connection" in the installed app, and a refused permission gets a clear explanation of how to fix it
- [ ] Core tests cover the settings and the last-backup time
- [ ] Tested on the user's phone against the real server
- [ ] Carried over from ticket 18: the first real backup from the phone shows up in the server's next nightly offsite snapshot, and the service was running again after the server's next reboot
