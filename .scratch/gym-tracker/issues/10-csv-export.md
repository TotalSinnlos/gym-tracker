# 10: CSV export

**What to build:** Settings has "Export to spreadsheet", which produces a CSV file with one row per set: date, routine, exercise, exercise type, set number, weight in kg (empty for bodyweight) and reps. Skipped entries produce no rows. The file opens correctly in Excel and Google Sheets. It's shared or downloaded the same way as backups.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] "Export to spreadsheet" in settings produces the CSV through the share menu or as a download
- [ ] The columns are exactly as specified, with one row per set
- [ ] Bodyweight sets have an empty weight, and skipped entries have no rows
- [ ] Names containing commas or quotes are escaped correctly
- [ ] The file opens correctly in Google Sheets
- [ ] Core tests cover columns, rows, bodyweight, skipped entries and escaping
