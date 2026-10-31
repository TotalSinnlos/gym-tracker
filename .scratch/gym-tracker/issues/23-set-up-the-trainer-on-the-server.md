# 23: Set up the trainer on the home server

**What to build:** The home server runs the new version of the service from ticket 22, following the conventions in `.scratch/gym-tracker/server-setup.local.md` and ticket 18: the AI key goes into the `.env` file next to the backup token, and the service is rebuilt and restarted, nothing else. The user has no Linux background: the agent gives commands one at a time, each explained, for the user to run over SSH. Backups keep working throughout.

**Blocked by:** 22

**Status:** ready-for-agent

- [ ] The AI key is in the server's `.env` file and nowhere else on the server
- [ ] The updated service is running, and a test request to `/trainer` from the PC returns a summary
- [ ] Server backup from the phone still works afterwards
- [ ] The user's server reference doc mentions the AI key

## Comments
