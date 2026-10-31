# 19: Server backup in the app

**What to build:** Settings gets a "Server backup" section where the user enters the server address and token, with a "Test connection" button. Both are stored only on the phone, never in the code. Once set up, the section offers "Back up now" and "Restore from server". Restore uses the existing restore checks and confirmation, just with the file fetched from the server. The section shows when the last server backup succeeded. Server backup is optional: without it set up, the app works exactly as before. The rules (what's stored, what counts as a successful backup) live in the core; the network call is a thin layer around it so core tests don't need a server.

**Blocked by:** 17

**Status:** ready-for-agent

- [ ] The user can enter, test, change and remove the server address and token
- [ ] "Back up now" uploads the same backup the existing "Back up" button makes
- [ ] "Restore from server" asks for confirmation and replaces all data, like restore from file
- [ ] Clear messages when the server can't be reached or the token is wrong, and data is never changed in that case
- [ ] The last successful server backup time shows in the section
- [ ] Core tests cover the settings and the last-backup time
- [ ] Tested on the user's phone against the real server
