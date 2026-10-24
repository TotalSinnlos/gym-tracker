# 04: A basic session

**What to build:** From the home screen, the user starts a session from their routine. The session screen shows one exercise at a time, with its weight pre-filled (editable) and an input per set. Each set's weight is pre-filled with the session weight and can be changed, and sets can be added or removed. Logging the last configured set moves on to the next exercise automatically, and the user can go back and correct a finished exercise. "End session" asks for confirmation if exercises are left, saves the session, and marks exercises with no sets as skipped. A session with no sets at all is discarded. If the app is closed mid-session, reopening it resumes exactly where the user was.

The session keeps a snapshot of the routine and of each exercise's sets and rep range from when it started. Editing those in settings during a session doesn't affect it, but editing an exercise's weight does.

**Blocked by:** 03

**Status:** done

- [x] Home screen offers "Start session" (or "Resume session" if one is active), and only one session can be active
- [x] The session screen shows the current exercise, its editable weight (hidden for bodyweight) and set inputs
- [x] Logging the configured number of sets marks the exercise done and advances to the next one
- [x] Sets can be added and removed, and a set's weight can differ from the session weight
- [x] A done exercise can be reopened and corrected during the session
- [x] "End session" asks for confirmation when exercises are still pending, then saves with untouched exercises marked skipped
- [x] Ending a session with no sets logged discards it
- [x] Closing and reopening the app mid-session restores the exact state
- [x] Routine and sets/rep-range edits during a session don't change it, but weight edits do
- [x] Core tests cover starting, logging, advancing, editing a done entry, ending, discarding empty sessions, resuming from the same store, and the snapshot rules
