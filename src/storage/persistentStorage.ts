/** Asks the browser to keep the app's data even when the phone runs low on storage. Does nothing if already granted. */
export async function requestPersistentStorage() {
  try {
    if (!navigator.storage?.persist || (await navigator.storage.persisted())) return;
    await navigator.storage.persist();
  } catch {
    // Not supported or refused: the app still works, the data is just less protected.
  }
}
