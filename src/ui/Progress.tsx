import type { Session } from "../core";

/**
 * A session's progress as one segment per exercise, in queue order: finished ones dark, the current one
 * wider and amber. `onAmber` draws it for the amber "Session running" card on the home screen.
 */
export function Progress({ session, onAmber = false }: { session: Session; onAmber?: boolean }) {
  return (
    <div className={onAmber ? "seg8 on-amber" : "seg8"} aria-hidden="true">
      {session.entries.map((entry) => (
        <div
          key={entry.id}
          className={entry.state !== "pending" ? "d" : !onAmber && entry.id === session.currentEntryId ? "c" : undefined}
        />
      ))}
    </div>
  );
}
