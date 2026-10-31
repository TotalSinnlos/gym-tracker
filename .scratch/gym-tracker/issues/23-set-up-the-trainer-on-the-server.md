# 23: Set up the trainer on the home server

**What to build:** The home server runs the new version of the service from ticket 22, following the conventions in `.scratch/gym-tracker/server-setup.local.md` and ticket 18: the AI key goes into the `.env` file next to the backup token, and the service is rebuilt and restarted, nothing else. The user has no Linux background: the agent gives commands one at a time, each explained, for the user to run over SSH. Backups keep working throughout.

**Blocked by:** 22

**Status:** done

- [x] The AI key is in the server's `.env` file and nowhere else on the server
- [x] The updated service is running, and a test request to `/trainer` returns a summary (sent on the server itself, see below)
- [x] Server backup from the phone still works afterwards
- [ ] The user's server reference doc mentions the AI key

## Comments

**2026-10-31, done:** Set up step by step over SSH:

- The key went into `.env` as `GYM_AI_API_KEY` with `read -rsp` (never shown on screen, typed in the chat or kept in the shell history); `grep -c` confirmed exactly one line.
- After a safety copy, `sed` added `- AI_API_KEY=${GYM_AI_API_KEY:-}` under the `BACKUP_TOKEN` line of the gym-backup block, matching `server/compose-service.yml`. `docker compose config -q` passed.
- Ticket 22 was pushed first, since Compose builds the image from GitHub. `docker compose up -d --build gym-backup` built it in under 3 s; the log said "Trainer on, using gemini model gemini-3.6-flash".
- The test request was sent with `curl` on the server to `127.0.0.1:8095/trainer`, with the backup token read from `.env`, instead of from the PC: it checks the same running service without handling the token on the PC. The https route through Tailscale gets checked by the app in ticket 24.
- The first request timed out after 90 seconds. A `fetch` from inside the container reached Google in 122 ms, so the connection was fine: Gemini sometimes leaves a request hanging when overloaded instead of answering 503. The service correctly answered `busy`. The retry returned a proper summary.
- "Back up now" on the phone still worked afterwards.
- The agent drafted a note for the key's password-manager entry, including how to replace the key. Updating the server reference doc is the user's (last box).
