import type { EntryState } from "../core";
import { Icon } from "./icons";

/**
 * How an exercise ended in a session, as a shape (not a colour): a filled circle with a check for done,
 * a half-filled one for incomplete and a dashed outline for skipped.
 */
export function StateMark({ state }: { state: EntryState }) {
  if (state === "incomplete") {
    return (
      <svg className="st-inc" aria-hidden="true" width="28" height="28" viewBox="0 0 28 28">
        <circle cx="14" cy="14" r="12.5" fill="none" stroke="var(--ink)" strokeWidth="2" />
        <path d="M14 1.5 A12.5 12.5 0 0 1 14 26.5 Z" fill="var(--ink)" />
      </svg>
    );
  }
  return (
    <span className={state === "skipped" ? "st skip" : "st"} aria-hidden="true">
      <Icon name={state === "skipped" ? "dash" : "check"} size="s" />
    </span>
  );
}
