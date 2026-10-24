// The core module: all app rules live here, independent of the screens.
// Screens call its commands and read its queries; tests do the same.

export * from "./types";
export * from "./store";
export * from "./core";
export type { Backup, BackupInfo } from "./backup";
export { TREND_SESSIONS, type ChartPoint, type ExerciseHistory, type OverviewRow, type RepsPoint } from "./graphs";
export type { LastResult, ProgressionSummary } from "./progression";
export { SPREADSHEET_COLUMNS, type SpreadsheetExport, localDate } from "./spreadsheet";
export { CoreError, DEFAULT_INCREMENT, DEFAULT_REP_MAX, DEFAULT_REP_MIN, DEFAULT_SETS } from "./validation";
