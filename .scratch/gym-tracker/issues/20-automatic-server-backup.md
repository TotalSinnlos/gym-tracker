# 20: Automatic server backup

**What to build:** When server backup is set up, the app backs up by itself after each session ends, without the user doing anything. If the upload fails (offline, Tailscale off, server down), it tries again later: when the app is next opened or comes back online. A failed attempt never interrupts the user or blocks ending a session. If uploads fail because Chrome's local network permission was refused (see ticket 19), the app doesn't keep retrying silently: settings points out the problem. The end-of-session summary shows whether the server backup worked. When the last successful server backup gets old, settings says so. The rules for when a backup is due and when to retry live in the core.

**Blocked by:** 19

**Status:** ready-for-agent

- [ ] Ending a session uploads a backup automatically
- [ ] A failed upload is retried later, and only the latest data is uploaded (no queue of old backups)
- [ ] Ending a session works the same with the server unreachable
- [ ] The summary shows whether the server backup worked
- [ ] Core tests cover when a backup is due and the retry rules
- [ ] Tested on the user's phone: a session ended with Tailscale off is backed up once it's back on
