import type { AppData, Store } from "../core";

const DB_NAME = "gym-tracker";
const OBJECT_STORE = "app";
const KEY = "data";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(OBJECT_STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function run<T>(db: IDBDatabase, mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    const transaction = db.transaction(OBJECT_STORE, mode);
    const request = action(transaction.objectStore(OBJECT_STORE));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

/** Keeps the whole app state as a single record in the browser's IndexedDB. */
export function createIndexedDbStore(): Store {
  const db = openDb();
  return {
    async load() {
      const data = await run(await db, "readonly", (store) => store.get(KEY));
      return (data as AppData | undefined) ?? null;
    },
    async save(data) {
      await run(await db, "readwrite", (store) => store.put(data, KEY));
    },
  };
}
