# 16: Test reaching the home server from the app

**What to build:** A quick throwaway test that answers one question before anything real gets built: can the app, served from GitHub Pages, call a service on the user's home server over Tailscale with HTTPS, from Chrome on the user's phone over mobile data? Chrome's Private/Local Network Access rules may allow it, show a permission prompt, or block it unless the server answers with `Access-Control-Allow-Private-Network: true`. The agent writes a minimal test service (answers CORS preflights for `https://totalsinnlos.github.io` and returns a fixed reply) and a small test page served from the same GitHub Pages site. Server details are in `.scratch/gym-tracker/server-setup.local.md` (not committed, never copy them into committed files). The user has no Linux background: the agent gives server commands one at a time, each explained, for the user to run over SSH. The test service and page are removed afterwards.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Tailscale MagicDNS and HTTPS certificates are enabled, and `tailscale serve` gives the server an https address
- [x] The test page on GitHub Pages successfully calls the test service from Chrome on the user's phone over mobile data (Wi-Fi off)
- [x] Any permission prompt or extra header that was needed is written down in this ticket's comments
- [x] Decision recorded: go ahead with tickets 17–20, or a fallback is chosen
- [x] The test service and test page are removed again

## Comments

**2026-10-31, test result:** It works. From Chrome on the user's Android phone (Incognito tab, Wi-Fi off, mobile data, Tailscale on), the test page on `https://totalsinnlos.github.io` reached the service through its `tailscale serve` https address:

- A plain GET and a PUT with `Authorization` and `Content-Type` headers (so with a CORS preflight) both returned 200.
- Chrome showed a permission prompt asking whether the page may access devices on the local network (Local Network Access), and the user allowed it. It did not send the older `Access-Control-Request-Private-Network` preflight header. Ticket 17 still answers that header with `Access-Control-Allow-Private-Network: true`, as it costs nothing.
- Consequence for tickets 19 and 20: the app has to get this permission once, on purpose, during setup, and cope with it being refused. Not yet tested: whether the prompt also shows in the installed app (standalone window) rather than a Chrome tab.
- The first request took about 3 s (first secure connection), the next one under 0.1 s.

**Decision:** go ahead with tickets 17–20 as planned.

**Left in place on purpose:** the `tailscale serve` setting (https on port 443, passing to `127.0.0.1:8095`) stays, because ticket 18 uses the same port. Until then it answers with an error, which is harmless. To remove it: `sudo tailscale serve --https=443 off`.
