# 06: Busy equipment

**What to build:** During a session, the user can work around busy equipment. "Skip for now" swaps the current exercise with the next pending one, so it comes back straight after. The button is hidden when the current exercise is the only one left. An "Up next" list shows the remaining exercises in order, and tapping one makes it current. If the user jumps away from an exercise after logging some of its sets, those sets are kept, and it stays in "Up next". When the session ends, an exercise with some sets logged is saved as incomplete instead of skipped. Incomplete exercises never change the weight.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] "Skip for now" swaps the current exercise with the next pending one
- [ ] "Skip for now" is hidden when only one exercise is pending, and the core rejects a skip in that state
- [ ] The "Up next" list shows pending exercises in queue order, and tapping one makes it current while the previous one keeps its place
- [ ] Partly logged exercises keep their sets when jumped away from
- [ ] Ending the session marks partly logged exercises incomplete and untouched ones skipped
- [ ] Incomplete exercises don't change the weight, and they count as "last time" (together with 05)
- [ ] Core tests cover skip, the rejected skip, jump-to, partly logged entries and the incomplete/skipped marking
