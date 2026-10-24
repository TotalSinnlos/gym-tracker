// The CSV export for Excel and Google Sheets.

import { EXERCISE_TYPE_LABELS, type Session } from "./types";

/** The CSV export's columns, in order. */
export const SPREADSHEET_COLUMNS = ["Date", "Routine", "Exercise", "Exercise type", "Set", "Weight (kg)", "Reps"] as const;

/** A spreadsheet (CSV) file of the history, made by `exportSpreadsheet`. */
export interface SpreadsheetExport {
  /** The CSV file's contents. */
  text: string;
  /** ISO time the export was made. */
  createdAt: string;
  /** How many sets (rows below the header) it holds. */
  sets: number;
}

/**
 * The sessions as CSV text, one row per logged set (see `SPREADSHEET_COLUMNS`), oldest session first, with
 * how many sets it holds. Names are as recorded in each session. Skipped exercises have no rows. Null when
 * there are no sets.
 */
export function spreadsheetCsv(sessions: Session[]): { text: string; sets: number } | null {
  const rows = spreadsheetRows(sessions);
  if (rows.length === 0) return null;
  return { text: toCsv([[...SPREADSHEET_COLUMNS], ...rows]), sets: rows.length };
}

/** `YYYY-MM-DD` in the phone's time zone, which spreadsheets recognise as a date. Also used in file names. */
export function localDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function spreadsheetRows(sessions: Session[]): string[][] {
  // Saved sessions are already oldest first; sorting (stably) keeps that true for edited or restored data too.
  const chronological = [...sessions].sort((a, b) => Date.parse(a.startedAt) - Date.parse(b.startedAt));
  return chronological.flatMap((session) =>
    session.entries
      .filter((entry) => entry.state !== "skipped")
      .flatMap((entry) =>
        entry.loggedSets.map((set, i) => [
          localDate(session.startedAt),
          session.routineName,
          entry.exerciseName,
          EXERCISE_TYPE_LABELS[entry.type],
          String(i + 1),
          set.weight === undefined ? "" : formatCsvNumber(set.weight),
          String(set.reps),
        ]),
      ),
  );
}

/** A dot for decimals and no thousands separator; rounded so sums like 0.1 + 0.2 don't show long tails. */
const formatCsvNumber = (n: number) => String(Math.round(n * 1000) / 1000);

/**
 * Joins rows into CSV text. Fields with commas, quotes or line breaks are put in quotes, with quotes
 * doubled. It starts with a byte order mark so Excel reads accents and other non-English letters
 * correctly, and uses Windows line endings, which Excel and Google Sheets both expect.
 */
function toCsv(rows: string[][]): string {
  const field = (value: string) => (/[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);
  return "﻿" + rows.map((row) => row.map(field).join(",") + "\r\n").join("");
}
