// Automatic server backup: uploads whenever the core says the server is missing changes, and tries
// again later when that fails. It never interrupts: failures are shown in settings and on the summary.

import { createContext, type ReactNode, useContext, useEffect, useRef, useState } from "react";
import type { Core } from "../core";

/** While the app is open, a waiting backup is tried again this often. */
const RETRY_MS = 5 * 60 * 1000;

interface AutoBackupState {
  /** Whether a server backup is being uploaded right now. */
  running: boolean;
  /** Tries a waiting backup now ("Try again"). */
  tryNow: () => void;
}

const AutoBackupContext = createContext<AutoBackupState>({ running: false, tryNow: () => {} });

export const useAutoBackup = () => useContext(AutoBackupContext);

export function AutoBackup({ core, children }: { core: Core; children: ReactNode }) {
  const [running, setRunning] = useState(false);
  const busy = useRef(false);
  const attemptRef = useRef(() => {});

  useEffect(() => {
    async function attempt() {
      if (busy.current || !core.serverBackup()?.due || document.visibilityState !== "visible") return;
      busy.current = true;
      setRunning(true);
      try {
        await core.backUpToServer();
      } catch {
        // The core remembers the error, and settings and the summary show it.
      } finally {
        busy.current = false;
        setRunning(false);
      }
      // Something changed during the upload: send that too.
      if (core.hasUntriedServerChanges()) attempt();
    }
    attemptRef.current = attempt;

    // A new change (a session saved, history corrected, a backup restored) is sent straight away.
    const unsubscribe = core.subscribe(() => {
      if (core.hasUntriedServerChanges()) attempt();
    });
    // Otherwise a waiting backup is tried again on coming back to the app or back online (Tailscale
    // may be on now), and every few minutes while the app is open.
    const onVisible = () => attempt();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    const timer = setInterval(attempt, RETRY_MS);
    attempt();

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
      clearInterval(timer);
    };
  }, [core]);

  const tryNow = () => attemptRef.current();
  return <AutoBackupContext.Provider value={{ running, tryNow }}>{children}</AutoBackupContext.Provider>;
}
