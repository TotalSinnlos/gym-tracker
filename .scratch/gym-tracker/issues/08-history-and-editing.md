# 08: History and editing

**What to build:** A history screen lists past sessions with their date and routine. Opening one shows each exercise with its state (done, incomplete or skipped) and every set's weight and reps. The user can correct a set's reps or weight and delete a whole session. Correcting the exercise's most recent completed session recalculates its current weight as if the session had just ended, respecting a "lower weight" choice made from the summary as long as the entry is still below range. Correcting older sessions only fixes the record.

**Blocked by:** 05, 06

**Status:** done

- [x] History lists past sessions, newest first, with their date and routine
- [x] The session detail shows every exercise's state, sets, weights and reps
- [x] Sets in a past session can be corrected
- [x] Correcting the most recent completed session recalculates the exercise's current weight
- [x] A recorded lowering choice is respected on recalculation while the entry is still below range
- [x] Correcting an older session doesn't change current weights
- [x] A session can be deleted after confirmation
- [x] Core tests cover recalculation, non-recalculation for older sessions, the lowering choice and deletion
