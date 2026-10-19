/**
 * lib/removeBg.ts
 * Background removal pipeline:
 * 1. Primary: @imgly/background-removal in the browser with progress callbacks.
 * 2. Timeout (60 seconds) & single retry on failure or timeout.
 * 3. Server fallback route: POST /api/remove-bg using REMOVE_BG_PROVIDER.
 * 4. Clear error handling if server fallback is "none" or unavailable.
 */

import { removeBackground as imglyRemoveBackground } from "@imgly/background-removal";

const TIMEOUT_MS = 60000; // 60 seconds

export interface RemoveBgOptions {
  onProgress?: (message: string) => void;
  timeoutMs?: number;
}

/**
 * Executes a promise with an enforced timeout.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, timeoutMsg: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(timeoutMsg));
    }, ms);

    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

/**
 * Calls browser @imgly/background-removal with timeout and progress updates.
 */
async function runImgly(
  file: File | Blob,
  onProgress?: (msg: string) => void,
  timeoutMs = TIMEOUT_MS
): Promise<Blob> {
  const removalPromise = imglyRemoveBackground(file, {
    model: "isnet_quint8",
    progress: (key: string, current: number, total: number) => {
      if (total > 0) {
        const pct = Math.round((current / total) * 100);
        const action = key.includes("fetch") ? "Downloading AI model" : "Removing background";
        onProgress?.(`${action} (${pct}%)...`);
      } else {
        onProgress?.(`Processing image (${key})...`);
      }
    },
  });

  return withTimeout(
    removalPromise,
    timeoutMs,
    `Background removal timed out after ${Math.round(timeoutMs / 1000)} seconds.`
  );
}

/**
 * Calls the server fallback API: POST /api/remove-bg
 */
async function callServerFallback(file: File | Blob): Promise<Blob> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch("/api/remove-bg", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    let errMessage = "Server fallback failed";
    try {
      const errData = await res.json();
      errMessage = errData.error || errMessage;
    } catch {
      errMessage = `Server fallback error (status ${res.status})`;
    }
    throw new Error(errMessage);
  }

  return await res.blob();
}

/**
 * Main public background removal function conforming to:
 * removeBackground(file): Promise<Blob>
 */
export async function removeBackground(
  file: File | Blob,
  onProgressOrOptions?: ((message: string) => void) | RemoveBgOptions
): Promise<Blob> {
  const onProgress =
    typeof onProgressOrOptions === "function"
      ? onProgressOrOptions
      : onProgressOrOptions?.onProgress;
  const timeoutMs =
    typeof onProgressOrOptions === "object" && onProgressOrOptions.timeoutMs
      ? onProgressOrOptions.timeoutMs
      : TIMEOUT_MS;

  // Attempt 1: Local @imgly/background-removal
  try {
    onProgress?.("Initializing AI background removal in browser...");
    return await runImgly(file, onProgress, timeoutMs);
  } catch (err1: any) {
    console.warn("Background removal attempt 1 failed or timed out:", err1);

    // Attempt 2: Local retry
    try {
      onProgress?.("Retrying local background removal (attempt 2)...");
      return await runImgly(file, onProgress, timeoutMs);
    } catch (err2: any) {
      console.warn("Background removal attempt 2 failed:", err2);

      // Attempt 3: Server fallback route
      onProgress?.("Local background removal unavailable. Connecting to server fallback...");
      try {
        const fallbackBlob = await callServerFallback(file);
        onProgress?.("Background removed via server provider.");
        return fallbackBlob;
      } catch (serverErr: any) {
        console.error("Server fallback also failed:", serverErr);
        throw new Error(
          serverErr.message ||
            "Unable to remove background. Please try another photo or configure a server provider."
        );
      }
    }
  }
}
