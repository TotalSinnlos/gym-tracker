# 16: Test reaching the home server from the app

**What to build:** A quick throwaway test that answers one question before anything real gets built: can the app, served from GitHub Pages, call a service on the user's home server over Tailscale with HTTPS, from Chrome on the user's phone over mobile data? Chrome's Private/Local Network Access rules may allow it, show a permission prompt, or block it unless the server answers with `Access-Control-Allow-Private-Network: true`. The agent writes a minimal test service (answers CORS preflights for `https://totalsinnlos.github.io` and returns a fixed reply) and a small test page served from the same GitHub Pages site. Server details are in `.scratch/gym-tracker/server-setup.local.md` (not committed, never copy them into committed files). The user has no Linux background: the agent gives server commands one at a time, each explained, for the user to run over SSH. The test service and page are removed afterwards.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Tailscale MagicDNS and HTTPS certificates are enabled, and `tailscale serve` gives the server an https address
- [ ] The test page on GitHub Pages successfully calls the test service from Chrome on the user's phone over mobile data (Wi-Fi off)
- [ ] Any permission prompt or extra header that was needed is written down in this ticket's comments
- [ ] Decision recorded: go ahead with tickets 17–20, or a fallback is chosen
- [ ] The test service and test page are removed again
