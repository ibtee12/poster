export type SlotType = "image" | "text";

export interface ImageSlot {
  id: string;
  type: "image";
  label: string;
  x: number; // 0 to 1 fraction
  y: number; // 0 to 1 fraction
  w: number; // 0 to 1 fraction
  h: number; // 0 to 1 fraction
  z: number; // layer order
  anchor: "bottom" | "center";
  allowAdjust: boolean;
  maxOffset: number; // default 0.30 (30% offset)
  minZoom: number; // default 0.40
  maxZoom: number; // default 2.50
  required: boolean;
  // Photo enhancements:
  faceHeightRatio?: number; // target fraction of slot height for face (default 0.38)
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  shadowOpacity?: number;
  shadowColor?: string;
  outlineWidth?: number;
  outlineColor?: string;
  allowedPoses?: string[];
}

export type OutlineSizeStep = "small" | "medium" | "large";
export type ShadowStrengthStep = "soft" | "medium" | "hard";

export interface UserTextOutlineStyle {
  on: boolean;
  color: string;
  size: OutlineSizeStep; // "small" (0.06) | "medium" (0.10) | "large" (0.15)
}

export interface UserTextShadowStyle {
  on: boolean;
  strength: ShadowStrengthStep; // "soft" | "medium" | "hard"
  color?: string;
}

export interface UserTextSlotStyle {
  font: string;
  fill: string;
  outline: UserTextOutlineStyle;
  shadow: UserTextShadowStyle;
  sizeScale: number; // 0.8 to 1.2, default 1.0
}

export const OUTLINE_SIZE_MAP: Record<OutlineSizeStep, number> = {
  small: 0.06,  // কম
  medium: 0.10, // মাঝারি
  large: 0.15,  // বেশি
};

export interface ShadowTuneParams {
  blur: number;
  offsetX: number;
  offsetY: number;
  opacity: number;
  color: string;
}

export const SHADOW_STRENGTH_MAP: Record<ShadowStrengthStep, ShadowTuneParams> = {
  soft: {
    blur: 6,
    offsetX: 0,
    offsetY: 3,
    opacity: 0.35,
    color: "rgba(0, 0, 0, 0.35)",
  },
  medium: {
    blur: 10,
    offsetX: 0,
    offsetY: 5,
    opacity: 0.55,
    color: "rgba(0, 0, 0, 0.55)",
  },
  hard: {
    blur: 15,
    offsetX: 2,
    offsetY: 7,
    opacity: 0.75,
    color: "rgba(0, 0, 0, 0.75)",
  },
};

export const DEFAULT_ALLOWED_FONTS = [
  "Baloo Da 2",
  "Anek Bangla",
  "Atma",
  "Galada",
  "Tiro Bangla",
  "Hind Siliguri",
  "Noto Sans Bengali",
];

export const DEFAULT_ALLOWED_COLORS = [
  "#FFFFFF",
  "#FFD400",
  "#F2B705",
  "#0E7A53",
  "#D62839",
  "#12261D",
  "#0A5F41",
  "#2563EB",
];

export function parseColorToRgb(color: string): [number, number, number] {
  if (!color) return [0, 0, 0];
  if (color.startsWith("#")) {
    let hex = color.slice(1);
    if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
    if (hex.length === 6) {
      const num = parseInt(hex, 16);
      return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
    }
  }
  const match = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
  }
  return [0, 0, 0];
}

export function getLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function getContrastRatio(color1: string, color2: string): number {
  try {
    const l1 = getLuminance(parseColorToRgb(color1));
    const l2 = getLuminance(parseColorToRgb(color2));
    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);
    return (lighter + 0.05) / (darker + 0.05);
  } catch {
    return 10;
  }
}

export function isLowContrast(color1: string, color2: string, threshold = 2.0): boolean {
  if (!color1 || !color2) return false;
  return getContrastRatio(color1, color2) < threshold;
}

export interface QuickStylePreset {
  id: string;
  nameBn: string;
  nameEn: string;
  style: UserTextSlotStyle;
}

export const USER_TEXT_STYLE_PRESETS: QuickStylePreset[] = [
  {
    id: "white-green",
    nameBn: "সাদা + সবুজ আউটলাইন",
    nameEn: "White + green outline",
    style: {
      font: "Baloo Da 2",
      fill: "#FFFFFF",
      outline: { on: true, color: "#0E7A53", size: "medium" },
      shadow: { on: true, strength: "medium" },
      sizeScale: 1.0,
    },
  },
  {
    id: "white-red",
    nameBn: "সাদা + লাল আউটলাইন",
    nameEn: "White + red outline",
    style: {
      font: "Baloo Da 2",
      fill: "#FFFFFF",
      outline: { on: true, color: "#D62839", size: "medium" },
      shadow: { on: true, strength: "medium" },
      sizeScale: 1.0,
    },
  },
  {
    id: "gold-darkgreen",
    nameBn: "সোনালী + গাঢ় সবুজ",
    nameEn: "Gold + dark green outline",
    style: {
      font: "Baloo Da 2",
      fill: "#FFD400",
      outline: { on: true, color: "#0A5F41", size: "large" },
      shadow: { on: true, strength: "hard" },
      sizeScale: 1.0,
    },
  },
  {
    id: "red-white",
    nameBn: "লাল + সাদা আউটলাইন",
    nameEn: "Red + white outline",
    style: {
      font: "Baloo Da 2",
      fill: "#D62839",
      outline: { on: true, color: "#FFFFFF", size: "medium" },
      shadow: { on: true, strength: "medium" },
      sizeScale: 1.0,
    },
  },
  {
    id: "green-white",
    nameBn: "সবুজ + সাদা আউটলাইন",
    nameEn: "Green + white outline",
    style: {
      font: "Baloo Da 2",
      fill: "#0E7A53",
      outline: { on: true, color: "#FFFFFF", size: "medium" },
      shadow: { on: true, strength: "medium" },
      sizeScale: 1.0,
    },
  },
  {
    id: "clean-white",
    nameBn: "সাদা + নরম ছায়া",
    nameEn: "White + soft shadow",
    style: {
      font: "Baloo Da 2",
      fill: "#FFFFFF",
      outline: { on: false, color: "#0E7A53", size: "small" },
      shadow: { on: true, strength: "soft" },
      sizeScale: 1.0,
    },
  },
];

export function getDefaultSlotStyle(slot: TextSlot): UserTextSlotStyle {
  return {
    font: slot.defaultStyle?.font || slot.font || "Baloo Da 2",
    fill: slot.defaultStyle?.fill || slot.color || "#FFFFFF",
    outline: {
      on: slot.defaultStyle?.outline?.on ?? true,
      color: slot.defaultStyle?.outline?.color || "#0E7A53",
      size: slot.defaultStyle?.outline?.size || "medium",
    },
    shadow: {
      on: slot.defaultStyle?.shadow?.on ?? true,
      strength: slot.defaultStyle?.shadow?.strength || "medium",
    },
    sizeScale: slot.defaultStyle?.sizeScale || 1.0,
  };
}

export interface TextSlot {
  id: string;
  type: "text";
  label: string;
  x: number; // 0 to 1 fraction
  y: number; // 0 to 1 fraction
  w: number; // 0 to 1 fraction
  h: number; // 0 to 1 fraction
  z: number; // layer order
  align: "left" | "center" | "right";
  color: string;
  font: string; // "Baloo Da 2" | "Anek Bangla" | "Atma" | "Galada" | "Tiro Bangla" | "Hind Siliguri" | "Noto Sans Bengali"
  maxChars: number;
  maxLines: number;
  minFontSize?: number;
  styleId?: string;
  required?: boolean;
  // Admin-configurable styling permissions and options:
  allowStyling?: boolean; // default true
  allowedFonts?: string[]; // default all AVAILABLE_FONTS
  allowedColors?: string[]; // default DEFAULT_ALLOWED_COLORS
  allowCustomColor?: boolean; // default true
  allowOutline?: boolean; // default true
  allowShadow?: boolean; // default true
  allowSizeAdjust?: boolean; // default true
  defaultStyle?: Partial<UserTextSlotStyle>;
  offeredPresets?: string[]; // list of offered preset names
}

export type Slot = ImageSlot | TextSlot;

export interface TextShadowStyle {
  color?: string;
  blur?: number;
  offsetX?: number;
  offsetY?: number;
}

export interface TextStyle {
  id: string;
  name: string;
  font: string;
  fill?: string;
  color: string; // backwards compatibility with fill
  outlineColor?: string;
  outlineWidthRatio?: number; // stroke width as fraction of font size (e.g. 0.08)
  outline2Color?: string;
  outline2WidthRatio?: number; // outer stroke width as fraction of font size (e.g. 0.14)
  shadow?: TextShadowStyle;
  // Legacy fields preserved for backward compatibility
  strokeColor?: string;
  strokeWidth?: number;
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
}

export const AVAILABLE_FONTS = [
  "Baloo Da 2",
  "Anek Bangla",
  "Atma",
  "Galada",
  "Tiro Bangla",
  "Hind Siliguri",
  "Noto Sans Bengali",
] as const;

export type AvailableFont = (typeof AVAILABLE_FONTS)[number];

export interface TextStylePreset {
  name: string;
  style: Omit<TextStyle, "id" | "name">;
}

export const TEXT_STYLE_PRESETS: TextStylePreset[] = [
  {
    name: "White + red outline",
    style: {
      font: "Baloo Da 2",
      fill: "#FFFFFF",
      color: "#FFFFFF",
      outlineColor: "#D62839",
      outlineWidthRatio: 0.08,
      shadow: {
        color: "rgba(0, 0, 0, 0.35)",
        blur: 8,
        offsetX: 0,
        offsetY: 4,
      },
    },
  },
  {
    name: "White + green outline",
    style: {
      font: "Baloo Da 2",
      fill: "#FFFFFF",
      color: "#FFFFFF",
      outlineColor: "#0E7A53",
      outlineWidthRatio: 0.08,
      shadow: {
        color: "rgba(0, 0, 0, 0.35)",
        blur: 8,
        offsetX: 0,
        offsetY: 4,
      },
    },
  },
  {
    name: "Gold + dark green outline",
    style: {
      font: "Baloo Da 2",
      fill: "#F2B705",
      color: "#F2B705",
      outlineColor: "#0A5F41",
      outlineWidthRatio: 0.09,
      shadow: {
        color: "rgba(0, 0, 0, 0.40)",
        blur: 10,
        offsetX: 0,
        offsetY: 4,
      },
    },
  },
  {
    name: "Red + white outline",
    style: {
      font: "Baloo Da 2",
      fill: "#D62839",
      color: "#D62839",
      outlineColor: "#FFFFFF",
      outlineWidthRatio: 0.08,
      outline2Color: "#0A5F41",
      outline2WidthRatio: 0.14,
      shadow: {
        color: "rgba(0, 0, 0, 0.40)",
        blur: 10,
        offsetX: 0,
        offsetY: 4,
      },
    },
  },
];

export interface TemplateLayout {
  id: string; // e.g. "default", "story", "facebook"
  name: string; // e.g. "Standard 1200x1600", "Story 1080x1920"
  width: number;
  height: number;
  blank: string; // filename e.g. "blank.png" or "blank_story.png"
  overlay: string | null; // filename e.g. "overlay.png" or null
  overlayZ: number; // default 50
  colorMatch?: boolean; // look matching on/off setting
  slots: Slot[];
}

export interface TemplateVariant {
  id: string; // e.g. "gold", "navy"
  name: string; // e.g. "Gold Edition"
  blankOverrides?: Record<string, string>; // layoutId -> filename
  overlayOverrides?: Record<string, string>; // layoutId -> filename
  textColors: Record<string, string>; // slotId -> hex color
}

export interface TemplateConfig {
  schemaVersion: 2;
  id: string;
  name: string;
  category: string;
  tags: string[];
  styles: TextStyle[];
  layouts: TemplateLayout[];
  variants: TemplateVariant[];
  colorMatch?: boolean; // look matching on/off setting

  // Backwards compatibility with v1 consumers:
  width: number;
  height: number;
  slots: Slot[];
  overlay: string | null;
  overlayZ?: number;
}

export function isValidTemplateId(id: string): boolean {
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

export function isValidImageFilename(filename: string): boolean {
  return /^[a-zA-Z0-9_-]+\.(png|jpg|jpeg|webp)$/.test(filename);
}
