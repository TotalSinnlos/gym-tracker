import { createContext, useContext, useSyncExternalStore } from "react";
import type { Core } from "../core";

export const CoreContext = createContext<Core | null>(null);

/** The core, re-rendering the calling component whenever its data changes. */
export function useCore(): Core {
  const core = useContext(CoreContext);
  if (!core) throw new Error("useCore must be used inside CoreContext");
  useSyncExternalStore(core.subscribe, core.getData);
  return core;
}
