import {
  TemplateConfig,
  isValidTemplateId,
} from "@/frontend/types/templates";
import {
  ensureTemplatesDir,
  readTemplateDirEntries,
  readTemplateConfigRaw,
  writeTemplateConfigFile,
  readTemplateImage,
  saveTemplateFiles,
  copyTemplateDir,
  removeTemplateDir,
  getTemplateDirPath,
} from "./templates/storage";
import { migrateTemplateConfig } from "./templates/migration";
import { NotFoundError } from "@/backend/common/errors";

export * from "@/frontend/types/templates";
export { getTemplateDirPath, ensureTemplatesDir } from "./templates/storage";

export async function getAllTemplates(): Promise<TemplateConfig[]> {
  await ensureTemplatesDir();
  try {
    const entries = await readTemplateDirEntries();
    const templates: TemplateConfig[] = [];

    for (const entry of entries) {
      if (entry.isDirectory() && isValidTemplateId(entry.name)) {
        const raw = await readTemplateConfigRaw(entry.name);
        if (raw) {
          const config = migrateTemplateConfig(raw, entry.name);
          templates.push(config);
        }
      }
    }
    return templates;
  } catch (err) {
    console.error("Failed to read templates directory", err);
    return [];
  }
}

export async function getTemplateById(id: string): Promise<TemplateConfig> {
  const raw = await readTemplateConfigRaw(id);
  if (!raw) {
    throw new NotFoundError("Template not found");
  }
  return migrateTemplateConfig(raw, id);
}

export async function getTemplateImage(id: string, filename: string): Promise<{ buffer: Buffer; contentType: string }> {
  return readTemplateImage(id, filename);
}

export async function saveTemplateV2(
  config: TemplateConfig,
  fileBuffers?: Record<string, Buffer>
): Promise<void> {
  return saveTemplateFiles(config, fileBuffers);
}

export async function duplicateTemplate(sourceId: string): Promise<TemplateConfig> {
  const source = await getTemplateById(sourceId);

  const sanitized = source.name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "-")
    .slice(0, 15);
  const newId = `t_${sanitized || "template"}_copy_${Date.now()}`;

  await copyTemplateDir(sourceId, newId);

  const duplicatedConfig: TemplateConfig = {
    ...source,
    id: newId,
    name: `${source.name} (Copy)`,
  };

  await writeTemplateConfigFile(newId, duplicatedConfig);
  return duplicatedConfig;
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const success = await removeTemplateDir(id);
  if (!success) {
    throw new NotFoundError("Failed to delete template");
  }
  return true;
}
