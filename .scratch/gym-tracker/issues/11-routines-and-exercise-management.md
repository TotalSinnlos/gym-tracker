# 11: Several routines and managing exercises

**What to build:** The user can have several routines: create, rename, delete and reorder exercises within each. Starting a session asks which routine to use when there's more than one. An exercise can be in several routines and keeps one shared history. Exercises can be archived (hidden from lists and pickers, history kept) and unarchived. Exercises with no history can be deleted outright. Exercises with history can only be archived.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Routines can be created, renamed and deleted, and their exercises managed and reordered
- [ ] Starting a session lets the user pick a routine when there's more than one
- [ ] An exercise in several routines has one shared history and current weight
- [ ] Archived exercises are hidden from routine pickers and the overview but appear in an "archived" list in settings, and can be unarchived
- [ ] Deleting an exercise is offered only when it has no history, and the core rejects it otherwise
- [ ] Removing an exercise from a routine or deleting a routine keeps all history
- [ ] Core tests cover routine management, archiving, the delete rule and history being kept
