# 07: Backup and restore

**What to build:** The end-of-session summary and the settings screen both have a "Back up" button. It creates a single backup file containing everything (exercises, routines, sessions, settings and a format version) and opens Android's share menu, so the user can save it to Google Drive. If sharing files isn't supported, the file downloads instead. Settings also has "Restore from backup": the user picks a file, the app checks it, warns that current data will be replaced, and restores on confirmation. The app shows when the last backup was made. On first launch, the app asks the browser to store its data persistently.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] "Back up" on the summary and in settings opens the Android share menu with the backup file, and Google Drive works as a target on the user's phone
- [ ] It falls back to a file download when file sharing isn't available
- [ ] Restore asks for confirmation, then replaces all data with the backup's contents
- [ ] Malformed or unsupported backup files are rejected with a clear message, and existing data is untouched
- [ ] The last backup time shows in settings and on the summary
- [ ] The app requests persistent storage on first launch
- [ ] Core tests: data after backup followed by restore is identical to before, and invalid or wrong-version files are rejected without changes
