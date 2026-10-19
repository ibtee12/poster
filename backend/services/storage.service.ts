/**
 * lib/storage.ts
 * IndexedDB storage for saving and reopening user progress per template.
 * - Stores text values, chosen style and variant, adjustments, face boxes, and cutout image Blobs.
 * - Restores state when user returns with "Continue where you left off".
 * - Enforces a storage cap (limits to 5 most recent templates) to prevent excessive disk/memory usage.
 */

import { NormalizedFaceBox } from "@/frontend/ai/faceDetect";
import { UserTextSlotStyle } from "@/frontend/types/templates";

export interface TemplateProgress {
  templateId: string;
  updatedAt: number;
  currentStepIndex: number;
  layoutId?: string;
  variantId?: string;
  styleId?: string;
  texts: Record<string, string>;
  textStyles?: Record<string, UserTextSlotStyle>;
  adjustments: Record<string, { dx: number; dy: number; zoom: number }>;
  faceBoxes: Record<string, NormalizedFaceBox>;
  cutoutBlobs: Record<string, Blob>;
}

const DB_NAME = "poster_maker_db";
const DB_VERSION = 1;
const STORE_NAME = "template_progress";
const MAX_SAVED_TEMPLATES = 5;

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    const req = window.indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "templateId" });
        store.createIndex("updatedAt", "updatedAt", { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * Saves the user's progress for a template. Automatically caps total entries to MAX_SAVED_TEMPLATES.
 */
export async function saveProgress(progress: TemplateProgress): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);

    // Save current entry
    const entry = {
      ...progress,
      updatedAt: Date.now(),
    };
    store.put(entry);

    // Enforce storage cap: keep only the most recent N templates
    const index = store.index("updatedAt");
    const allEntriesReq = index.getAll();

    allEntriesReq.onsuccess = () => {
      const all = allEntriesReq.result as TemplateProgress[];
      if (all && all.length > MAX_SAVED_TEMPLATES) {
        // Sort ascending (oldest first)
        all.sort((a, b) => a.updatedAt - b.updatedAt);
        const toRemove = all.slice(0, all.length - MAX_SAVED_TEMPLATES);
        for (const item of toRemove) {
          if (item.templateId !== progress.templateId) {
            store.delete(item.templateId);
          }
        }
      }
    };

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Failed to save progress to IndexedDB:", err);
  }
}

/**
 * Retrieves saved progress for a template. Returns null if none exists.
 */
export async function getProgress(templateId: string): Promise<TemplateProgress | null> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(templateId);

    return await new Promise<TemplateProgress | null>((resolve, reject) => {
      req.onsuccess = () => {
        const result = req.result;
        resolve(result || null);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("Failed to read progress from IndexedDB:", err);
    return null;
  }
}

/**
 * Clears saved progress for a given template (used by "Start over").
 */
export async function clearProgress(templateId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.delete(templateId);

    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Failed to clear progress from IndexedDB:", err);
  }
}
