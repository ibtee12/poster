/**
 * frontend/storage/templateProgress.ts
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
      reject(new Error("IndexedDB not available"));
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "templateId" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function saveProgress(progress: TemplateProgress): Promise<void> {
  try {
    const db = await openDB();
    await pruneOldEntries(db);
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(progress);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("Could not save template progress to IndexedDB:", e);
  }
}

export async function getProgress(templateId: string): Promise<TemplateProgress | null> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(templateId);
      req.onsuccess = () => resolve((req.result as TemplateProgress) || null);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("Could not retrieve template progress from IndexedDB:", e);
    return null;
  }
}

export async function clearProgress(templateId: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(templateId);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("Could not clear template progress in IndexedDB:", e);
  }
}

async function pruneOldEntries(db: IDBDatabase): Promise<void> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const records = (req.result as TemplateProgress[]) || [];
        if (records.length >= MAX_SAVED_TEMPLATES) {
          records.sort((a, b) => a.updatedAt - b.updatedAt);
          const toDelete = records.slice(0, records.length - MAX_SAVED_TEMPLATES + 1);
          for (const item of toDelete) {
            store.delete(item.templateId);
          }
        }
        resolve();
      };
      req.onerror = () => resolve();
    } catch {
      resolve();
    }
  });
}
