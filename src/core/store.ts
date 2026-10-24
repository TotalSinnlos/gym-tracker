import type { AppData } from "./types";

/** Where the core keeps its data. The app uses IndexedDB; tests use memory. */
export interface Store {
  load(): Promise<AppData | null>;
  save(data: AppData): Promise<void>;
}

export function createMemoryStore(initial: AppData | null = null): Store {
  let saved = initial === null ? null : structuredClone(initial);
  return {
    async load() {
      return saved === null ? null : structuredClone(saved);
    },
    async save(data) {
      saved = structuredClone(data);
    },
  };
}
