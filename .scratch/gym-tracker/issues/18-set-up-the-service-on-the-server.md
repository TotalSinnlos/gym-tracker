# 18: Set up the backup service on the home server

**What to build:** The service from ticket 17 runs on the user's home server, following the existing conventions described in `.scratch/gym-tracker/server-setup.local.md`: a block in the existing Docker Compose file, the token in the `.env` file, data in a folder that the nightly offsite backup already covers, the port published on localhost only, and HTTPS through `tailscale serve`. The user has no Linux background: the agent gives commands one at a time, each explained, for the user to run over SSH, and never asks the user to restart unrelated services. The user stores the token in their password manager and updates their server reference doc.

**Blocked by:** 17

**Status:** done

- [ ] The service runs and starts again by itself after a server reboot
- [x] It is reachable at the server's Tailscale https address and not on the LAN or tailnet directly
- [ ] An upload from the user's phone lands in the data folder, and a file there shows up in the next nightly offsite backup
- [x] The token is only in `.env` and the password manager
- [x] The user has updated their server reference doc

## Comments

**2026-10-31, from ticket 17:** The image doesn't have to be published anywhere: Docker Compose can build it straight from the public repository with `build: https://github.com/totalsinnlos/gym-tracker.git#main:server`, so the server needs no copy of the code. Updating means rebuilding that one service. `tailscale serve` is already set up from ticket 16 and passes https to `127.0.0.1:8095`, so the container's port should be published as `127.0.0.1:8095:8095`. The container runs as Node's built-in `node` user (uid 1000), the same id as the server's user, so the mounted data folder can be owned by the server's normal user.

**2026-10-31, done:** Set up on the server, step by step over SSH:

- Token generated with `openssl rand -base64 24` straight into `.env` as `GYM_BACKUP_TOKEN` (never typed or shown in chat), copied to the password manager.
- The service block from `server/compose-service.yml` was appended to the Compose file with `curl` (pasting a multi-line block into the SSH window garbled it, so downloading is the way to go). `docker compose config -q` passed, and `docker compose up -d --build gym-backup` built it from GitHub in under 10 s.
- Checks: the port listens on `127.0.0.1:8095` only. Through the Tailscale https address, a request without the token gets 401, and a test upload with the token returned 200 and landed in the data folder owned by the server's user. The test file was deleted afterwards.
- To update after changes on GitHub: `docker compose up -d --build gym-backup` in the Compose folder.

**Not verified yet, carried over to ticket 19:** that the service comes back after a server reboot (same `restart: unless-stopped` as every other service; not worth rebooting for), an upload from the phone itself, and that a real backup shows up in the next nightly offsite snapshot.
