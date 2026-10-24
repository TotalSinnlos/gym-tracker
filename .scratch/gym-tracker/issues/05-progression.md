# 05: Progression

**What to build:** Ending a session applies the progression rule from the spec. A weighted exercise goes up by its increment when every configured set reached the rep range maximum plus one at the session weight or higher. After ending, an end-of-session summary shows:

- which exercises go up next time;
- which bodyweight exercises beat the rep range;
- which exercises were below range (any set under the rep minimum), with a "Lower to X kg next time?" button for weighted ones.

The weight is never lowered unless the user taps the button. On the session screen, each exercise shows last time's weight and reps and an "↑ +2.5 since last time" note when its weight went up.

**Blocked by:** 04

**Status:** done

- [x] Qualifying weighted exercises increase by their increment when the session ends
- [x] No increase when any set is short of the threshold, when there are fewer sets than configured, or when any set was at a lower weight
- [x] A changed session weight becomes the basis for the new current weight
- [x] Skipped exercises are unchanged
- [x] The summary lists increases, bodyweight "rep range beaten" and below-range exercises
- [x] The "lower weight" button lowers by one increment (clamped at 0 kg) and records the choice on the entry, and it's not offered for bodyweight exercises
- [x] The session screen shows last time's results (latest completed entry from any routine) and the "↑ since last time" note
- [x] Core tests cover each progression case, below-range detection, lowering and clamping
