# 18: Set up the backup service on the home server

**What to build:** The service from ticket 17 runs on the user's home server, following the existing conventions described in `.scratch/gym-tracker/server-setup.local.md`: a block in the existing Docker Compose file, the token in the `.env` file, data in a folder that the nightly offsite backup already covers, the port published on localhost only, and HTTPS through `tailscale serve`. The user has no Linux background: the agent gives commands one at a time, each explained, for the user to run over SSH, and never asks the user to restart unrelated services. The user stores the token in their password manager and updates their server reference doc.

**Blocked by:** 17

**Status:** ready-for-agent

- [ ] The service runs and starts again by itself after a server reboot
- [ ] It is reachable at the server's Tailscale https address and not on the LAN or tailnet directly
- [ ] An upload from the user's phone lands in the data folder, and a file there shows up in the next nightly offsite backup
- [ ] The token is only in `.env` and the password manager
- [ ] The user has updated their server reference doc
