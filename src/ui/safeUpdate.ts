import { useEffect, useSyncExternalStore } from "react";
import { registerSW } from "virtual:pwa-register";

// Service-worker glue for safe updates. A new version downloads in the background and then waits.
// The app lets it take over (which reloads the page) only when `useSafeUpdate` is told it's safe:
// no session running and the user on the home screen, so an update never interrupts a workout
// or wipes a half-filled form.

/** "waiting": a new version is downloaded. "ready": it has taken over and the page needs a reload. */
type UpdateState = "none" | "waiting" | "ready";

let state: UpdateState = "none";
let activate: (() => Promise<void>) | null = null;
const listeners = new Set<() => void>();

function setState(next: UpdateState) {
  state = next;
  listeners.forEach((listener) => listener());
}

/** Registers the service worker. Call once, at startup. */
export function registerServiceWorker() {
  activate = registerSW({
    immediate: true,
    onNeedRefresh: () => setState("waiting"),
    // The new version took over (possibly from another open window): reload only once it's safe.
    onNeedReload: () => setState("ready"),
    onRegisteredSW: (_url, registration) => {
      // A home-screen app often comes back from the background without reloading, so look for
      // a new version each time it's brought back to the front, too.
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") registration?.update().catch(() => {});
      });
    },
  });
}

/** Applies a downloaded update as soon as `safe` is true, and never while it's false. */
export function useSafeUpdate(safe: boolean) {
  const update = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );

  useEffect(() => {
    if (!safe) return;
    if (update === "waiting") activate?.();
    if (update === "ready") window.location.reload();
  }, [safe, update]);
}
