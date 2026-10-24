# 03: Exercises and a first routine

**What to build:** On first launch, the app guides the user through adding their exercises and then arranging them into a routine. Each exercise has a name, a type (machine, free weight or bodyweight), a number of sets (default 2) and a rep range (default 9–12). Machine and free-weight exercises also have a current weight and an increment. Bodyweight exercises have no weight. Everything is saved on the phone and survives closing the app. Afterwards, a settings screen lets the user edit exercises and the routine's contents and order.

This ticket introduces the **core module** described in the spec: all rules sit behind commands and queries that know nothing about the screens, and data goes through a storage interface with an in-memory version for tests and an IndexedDB version for the app.

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] First launch shows the setup flow: add exercises, then build the routine
- [ ] Exercises can be created and edited, with weight and increment fields only for machine and free-weight types
- [ ] New exercises default to 2 sets and a 9–12 rep range
- [ ] Weights can't be negative
- [ ] A routine can be built by picking exercises, reordering them, adding more and removing some
- [ ] Data survives closing and reopening the app
- [ ] Later launches skip the setup flow and show the home screen
- [ ] Core tests (against the in-memory store) cover creating and editing exercises and building and reordering a routine
