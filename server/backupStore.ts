// Backup files on disk: one file per upload, named by time, keeping only the newest few.

import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface BackupStore {
  /** Saves a backup and removes the oldest beyond the limit. Returns the new file's name. */
  save(text: string): Promise<string>;
  /** The newest backup's contents, or null if there are none. */
  latest(): Promise<string | null>;
  /** File names of all kept backups, oldest first. */
  list(): Promise<string[]>;
}

export function createBackupStore(folder: string, keep: number, now: () => Date = () => new Date()): BackupStore {
  async function list() {
    await mkdir(folder, { recursive: true });
    const names = await readdir(folder);
    // The names hold the time with fixed-width digits, so sorting them sorts by time.
    return names.filter((name) => /^backup-\d{8}T\d{9}Z\.json$/.test(name)).sort();
  }

  return {
    async save(text) {
      const name = `backup-${now().toISOString().replace(/[-:.]/g, "")}.json`;
      // Written under a temporary name first, so a half-written file never counts as the latest.
      const temporary = join(folder, `${name}.tmp`);
      await mkdir(folder, { recursive: true });
      await writeFile(temporary, text, "utf8");
      await rename(temporary, join(folder, name));
      const all = await list();
      for (const old of all.slice(0, Math.max(0, all.length - keep))) await rm(join(folder, old));
      return name;
    },

    async latest() {
      const all = await list();
      return all.length === 0 ? null : readFile(join(folder, all[all.length - 1]), "utf8");
    },

    list,
  };
}
