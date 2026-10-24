import { useState } from "react";

/** Runs a core command and keeps its error message (if any) for display. */
export function useAction() {
  const [error, setError] = useState<string | null>(null);

  async function run(action: () => Promise<unknown>): Promise<boolean> {
    try {
      await action();
      setError(null);
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    }
  }

  return { error, run };
}
