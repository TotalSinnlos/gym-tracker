// Browser helpers for getting a file off the phone. Kept out of the core because they only work in a browser.

export type ShareOutcome = "shared" | "downloaded" | "cancelled";

/**
 * Opens the phone's share menu with a file (so it can go to Google Drive, for example), or downloads
 * the file where sharing files isn't supported. Call it straight from a button tap: browsers only
 * allow sharing in direct response to one.
 */
export async function shareOrDownload(fileName: string, mimeType: string, text: string): Promise<ShareOutcome> {
  const file = new File([text], fileName, { type: mimeType });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return "shared";
    } catch (e) {
      // The user closed the share menu. Any other failure falls back to a download.
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    }
  }
  download(file);
  return "downloaded";
}

function download(file: File) {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before freeing the file.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
