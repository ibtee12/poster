import fs from "fs/promises";
import path from "path";
import { TEMPLATES_DIR } from "@/backend/config/constants";
import {
  TemplateConfig,
  isValidTemplateId,
  isValidImageFilename,
} from "@/frontend/types/templates";
import { ValidationError, NotFoundError } from "@/backend/common/errors";

export function getTemplateDirPath(id: string): string {
  if (!isValidTemplateId(id)) {
    throw new ValidationError("Invalid template ID");
  }
  return path.join(TEMPLATES_DIR, id);
}

export async function ensureTemplatesDir(): Promise<void> {
  await fs.mkdir(TEMPLATES_DIR, { recursive: true });
}

export async function readTemplateDirEntries() {
  await ensureTemplatesDir();
  return fs.readdir(TEMPLATES_DIR, { withFileTypes: true });
}

export async function readTemplateConfigRaw(id: string): Promise<any | null> {
  const configPath = path.join(getTemplateDirPath(id), "config.json");
  try {
    const raw = await fs.readFile(configPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function writeTemplateConfigFile(id: string, config: TemplateConfig): Promise<void> {
  const dirPath = getTemplateDirPath(id);
  await fs.mkdir(dirPath, { recursive: true });
  const configPath = path.join(dirPath, "config.json");
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), "utf-8");
}

export async function readTemplateImage(id: string, filename: string): Promise<{ buffer: Buffer; contentType: string }> {
  if (!isValidTemplateId(id)) {
    throw new ValidationError("Invalid template ID");
  }
  if (!isValidImageFilename(filename)) {
    throw new ValidationError("Invalid image filename");
  }

  const filePath = path.join(getTemplateDirPath(id), filename);

  try {
    const buffer = await fs.readFile(filePath);
    let contentType = "image/png";
    if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) {
      contentType = "image/jpeg";
    } else if (filename.endsWith(".webp")) {
      contentType = "image/webp";
    }
    return { buffer, contentType };
  } catch {
    throw new NotFoundError("File not found");
  }
}

export async function saveTemplateFiles(
  config: TemplateConfig,
  fileBuffers?: Record<string, Buffer>
): Promise<void> {
  const dirPath = getTemplateDirPath(config.id);
  await fs.mkdir(dirPath, { recursive: true });

  if (fileBuffers) {
    for (const [filename, buffer] of Object.entries(fileBuffers)) {
      if (isValidImageFilename(filename) && buffer && buffer.length > 0) {
        await fs.writeFile(path.join(dirPath, filename), buffer);
      }
    }
  }

  const blankPath = path.join(dirPath, "blank.png");
  try {
    await fs.access(blankPath);
  } catch {
    try {
      const defaultBlank = await fs.readFile(path.join(process.cwd(), "public", "sample-blank.png"));
      await fs.writeFile(blankPath, defaultBlank);
      const defaultSample = await fs.readFile(path.join(process.cwd(), "public", "sample-sample.png"));
      await fs.writeFile(path.join(dirPath, "sample.png"), defaultSample);
    } catch (fallbackErr) {
      console.warn("Could not copy default template assets:", fallbackErr);
    }
  }

  if (config.layouts && config.layouts.length > 0) {
    const primary = config.layouts[0];
    config.width = primary.width;
    config.height = primary.height;
    config.slots = primary.slots;
    config.overlay = primary.overlay;
    config.overlayZ = primary.overlayZ;
  }

  await writeTemplateConfigFile(config.id, config);
}

export async function copyTemplateDir(sourceId: string, newId: string): Promise<void> {
  const sourceDir = getTemplateDirPath(sourceId);
  const targetDir = getTemplateDirPath(newId);

  await fs.mkdir(targetDir, { recursive: true });
  await fs.cp(sourceDir, targetDir, { recursive: true });
}

export async function removeTemplateDir(id: string): Promise<boolean> {
  if (!isValidTemplateId(id)) return false;
  const dirPath = getTemplateDirPath(id);
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
    return true;
  } catch (err) {
    console.error(`Failed to delete template ${id}`, err);
    return false;
  }
}
