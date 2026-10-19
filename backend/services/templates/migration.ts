import {
  Slot,
  ImageSlot,
  TextSlot,
  TemplateLayout,
  TemplateConfig,
} from "@/frontend/types/templates";

/**
 * Migrates a raw v1 or unversioned template config into the v2 schema.
 */
export function migrateTemplateConfig(raw: any, id: string): TemplateConfig {
  // Check if already v2
  if (raw && raw.schemaVersion === 2 && Array.isArray(raw.layouts) && raw.layouts.length > 0) {
    const activeLayout = raw.layouts[0];
    const config: TemplateConfig = {
      schemaVersion: 2,
      id: raw.id || id,
      name: raw.name || "Untitled Template",
      category: raw.category || "General",
      tags: Array.isArray(raw.tags) ? raw.tags : [],
      styles: Array.isArray(raw.styles) ? raw.styles : [],
      layouts: raw.layouts,
      variants: Array.isArray(raw.variants) ? raw.variants : [],
      colorMatch: raw.colorMatch ?? activeLayout.colorMatch ?? false,
      width: activeLayout.width,
      height: activeLayout.height,
      slots: activeLayout.slots,
      overlay: activeLayout.overlay,
      overlayZ: activeLayout.overlayZ ?? 50,
    };
    return config;
  }

  // Convert from v1 to v2
  const rawSlots: any[] = Array.isArray(raw?.slots) ? raw.slots : [];
  const migratedSlots: Slot[] = rawSlots.map((s, idx) => {
    const baseZ = s.z !== undefined ? Number(s.z) : (idx + 1) * 10;
    if (s.type === "image") {
      const imgSlot: ImageSlot = {
        id: s.id || `photo${idx + 1}`,
        type: "image",
        label: s.label || `Photo ${idx + 1}`,
        x: Number(s.x) || 0,
        y: Number(s.y) || 0,
        w: Number(s.w) || 0.4,
        h: Number(s.h) || 0.4,
        z: baseZ,
        anchor: s.anchor === "center" ? "center" : "bottom",
        allowAdjust: s.allowAdjust !== undefined ? Boolean(s.allowAdjust) : true,
        maxOffset: s.maxOffset !== undefined ? Number(s.maxOffset) : 0.3,
        minZoom: s.minZoom !== undefined ? Number(s.minZoom) : 0.4,
        maxZoom: s.maxZoom !== undefined ? Number(s.maxZoom) : 2.5,
        required: s.required !== undefined ? Boolean(s.required) : true,
        faceHeightRatio: s.faceHeightRatio !== undefined ? Number(s.faceHeightRatio) : undefined,
        shadowBlur: s.shadowBlur !== undefined ? Number(s.shadowBlur) : undefined,
        shadowOffsetX: s.shadowOffsetX !== undefined ? Number(s.shadowOffsetX) : undefined,
        shadowOffsetY: s.shadowOffsetY !== undefined ? Number(s.shadowOffsetY) : undefined,
        shadowOpacity: s.shadowOpacity !== undefined ? Number(s.shadowOpacity) : undefined,
        shadowColor: s.shadowColor || undefined,
        outlineWidth: s.outlineWidth !== undefined ? Number(s.outlineWidth) : undefined,
        outlineColor: s.outlineColor || undefined,
      };
      return imgSlot;
    } else {
      const txtSlot: TextSlot = {
        id: s.id || `text${idx + 1}`,
        type: "text",
        label: s.label || `Text ${idx + 1}`,
        x: Number(s.x) || 0,
        y: Number(s.y) || 0,
        w: Number(s.w) || 0.7,
        h: Number(s.h) || 0.08,
        z: baseZ + 20,
        align: s.align === "left" || s.align === "right" ? s.align : "center",
        color: s.color || "#FFD400",
        font: s.font || "Noto Sans Bengali",
        maxChars: s.maxChars ? Number(s.maxChars) : 60,
        maxLines: s.maxLines ? Number(s.maxLines) : 3,
        minFontSize: s.minFontSize ? Number(s.minFontSize) : 18,
        styleId: s.styleId,
        allowStyling: s.allowStyling !== undefined ? Boolean(s.allowStyling) : true,
        allowedFonts: s.allowedFonts || undefined,
        allowedColors: s.allowedColors || undefined,
        allowCustomColor: s.allowCustomColor !== undefined ? Boolean(s.allowCustomColor) : true,
        allowOutline: s.allowOutline !== undefined ? Boolean(s.allowOutline) : true,
        allowShadow: s.allowShadow !== undefined ? Boolean(s.allowShadow) : true,
        allowSizeAdjust: s.allowSizeAdjust !== undefined ? Boolean(s.allowSizeAdjust) : true,
        defaultStyle: s.defaultStyle || undefined,
        offeredPresets: s.offeredPresets || undefined,
      };
      return txtSlot;
    }
  });

  const width = Number(raw?.width) || 1200;
  const height = Number(raw?.height) || 1600;
  const overlay = raw?.overlay || null;

  const defaultLayout: TemplateLayout = {
    id: "default",
    name: "Default Layout",
    width,
    height,
    blank: "blank.png",
    overlay,
    overlayZ: 50,
    slots: migratedSlots,
  };

  const migratedConfig: TemplateConfig = {
    schemaVersion: 2,
    id: raw?.id || id,
    name: raw?.name || "Untitled Template",
    category: raw?.category || "General",
    tags: Array.isArray(raw?.tags) ? raw.tags : [],
    styles: Array.isArray(raw?.styles) ? raw.styles : [],
    layouts: [defaultLayout],
    variants: Array.isArray(raw?.variants) ? raw.variants : [],
    width,
    height,
    slots: migratedSlots,
    overlay,
    overlayZ: 50,
  };

  return migratedConfig;
}
