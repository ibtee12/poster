import {
  TemplateConfig,
  Slot,
  ImageSlot,
  TextSlot,
  TemplateLayout,
  TemplateVariant,
  TextStyle,
  UserTextSlotStyle,
  OUTLINE_SIZE_MAP,
  SHADOW_STRENGTH_MAP,
} from "@/frontend/types/templates";
import { computeFacePlacement, NormalizedFaceBox } from "@/frontend/ai/faceDetect";
import { matchCutoutColors } from "./colorMatch";
import { drawCanvasWatermark } from "@/backend/services/watermark.service";

export interface RenderPosterParams {
  config: TemplateConfig;
  layout?: TemplateLayout;
  variant?: TemplateVariant;
  activeStyle?: TextStyle | null;
  blankImage: CanvasImageSource;
  // Multiple image cutouts map or single fallback
  cutouts?: Record<string, CanvasImageSource | null>;
  cutoutImage?: CanvasImageSource | null;
  // Multiple texts map or single fallback
  texts?: Record<string, string>;
  text?: string;
  overlayImage?: CanvasImageSource | null;
  // Manual adjustments per image slot: { dx, dy, zoom }
  adjustments?: Record<string, { dx: number; dy: number; zoom: number }>;
  // Face boxes for face-height consistency & containment
  faceBoxes?: Record<string, NormalizedFaceBox>;
  // Active adjusting slot (draws faint dashed slot outline only during edit)
  activeAdjustSlotId?: string | null;
  // Flag to suppress all editing guides in final output
  isExport?: boolean;
  // Resolution scale multiplier (e.g. 1 for native template resolution, 2 for Ultra HD print-ready)
  exportScale?: number;
  // Safety watermark on interactive preview (disabled by default)
  watermark?: boolean;
  watermarkText?: string;
  // User-facing text styling per slot
  userTextStyles?: Record<string, UserTextSlotStyle>;
  // Non-blocking callback notifying if text fit is clamped at minimum font size
  onTextMinWarning?: (slotId: string, isMin: boolean) => void;
}

/**
 * Computes the tight bounding box of non-transparent pixels (alpha > 10).
 */
function getCutoutBoundingBox(image: CanvasImageSource): {
  minX: number;
  minY: number;
  width: number;
  height: number;
} {
  const natW =
    (image as HTMLImageElement).naturalWidth ||
    (image as HTMLCanvasElement).width ||
    (image as ImageBitmap).width ||
    1;
  const natH =
    (image as HTMLImageElement).naturalHeight ||
    (image as HTMLCanvasElement).height ||
    (image as ImageBitmap).height ||
    1;

  const offCanvas = document.createElement("canvas");
  offCanvas.width = natW;
  offCanvas.height = natH;
  const offCtx = offCanvas.getContext("2d", { willReadFrequently: true });

  if (!offCtx) {
    return { minX: 0, minY: 0, width: natW, height: natH };
  }

  offCtx.drawImage(image, 0, 0);
  const imgData = offCtx.getImageData(0, 0, natW, natH);
  const data = imgData.data;

  let minX = natW;
  let minY = natH;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < natH; y++) {
    const rowOffset = y * natW * 4;
    for (let x = 0; x < natW; x++) {
      const alpha = data[rowOffset + x * 4 + 3];
      if (alpha > 10) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX >= minX && maxY >= minY) {
    return {
      minX,
      minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  }

  return { minX: 0, minY: 0, width: natW, height: natH };
}

/**
 * Truncates string until it fits maxWidth at current canvas font.
 */
function truncateToFit(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }
  let cur = text;
  while (cur.length > 0 && ctx.measureText(cur + "…").width > maxWidth) {
    cur = cur.slice(0, -1);
  }
  return cur.length > 0 ? cur + "…" : "";
}

/**
 * Resolves the appropriate font weight based on Next.js Google font definitions.
 */
export function getFontWeight(fontName: string): string {
  if (fontName === "Galada" || fontName === "Tiro Bangla") return "400";
  if (fontName === "Atma") return "700";
  if (fontName === "Anek Bangla") return "800";
  if (fontName === "Baloo Da 2") return "800";
  return "700";
}

/**
 * Ensures that a font is loaded in document.fonts before measuring or drawing to canvas.
 * Waits for document.fonts.load(...) for the exact family, weight and size.
 */
export async function ensureFontLoaded(
  fontFamily: string,
  weight: string | number = "700",
  size: number = 48
): Promise<void> {
  if (typeof document === "undefined" || !("fonts" in document)) {
    return;
  }
  const spec = `${weight} ${size}px "${fontFamily}"`;
  try {
    await document.fonts.load(spec);
    await document.fonts.ready;
  } catch (err) {
    console.warn(`Font load warning for ${spec}:`, err);
  }
}

export interface TextFitResult {
  fontSize: number;
  lines: string[];
  isClampedAtMin: boolean;
}

/**
 * Generalized multi-line text layout:
 * - Word wraps up to maxLines
 * - Automatically fits font size from startFontSize down to minFontSize
 * - Strictly includes stroke padding and shadow offset so text never overflows bounds
 * - Supports user sizeScale (0.8x .. 1.2x of auto-fit size)
 * - Truncates with ellipsis on last line if it exceeds bounds
 * - Returns isClampedAtMin when user text/outline forces the size down to minFontSize
 */
export function wrapAndFitText(
  ctx: CanvasRenderingContext2D,
  rawText: string,
  fontName: string,
  slotW: number,
  slotH: number,
  maxLines: number,
  minFontSize: number,
  startFontSize: number,
  strokeRatio: number = 0,
  fontWeight: string = "700",
  shadowPadX: number = 0,
  shadowPadY: number = 0,
  userScale: number = 1.0
): TextFitResult {
  const paragraphs = rawText.split("\n");
  const nonEmptyCount = paragraphs.filter((p) => p.trim().length > 0).length;
  // If the user entered explicit lines (e.g. 3 lines), ensure effectiveMaxLines accommodates them
  // so the auto-fit algorithm does not fail and drop font size to minFontSize.
  const effectiveMaxLines = Math.max(maxLines, nonEmptyCount);

  // Step 1: Find best auto-fit font size
  let autoFitSize = -1;

  for (let s = startFontSize; s >= minFontSize; s -= 2) {
    const strokePad = Math.ceil(s * strokeRatio);
    const allowedW = Math.max(10, slotW - (strokePad + shadowPadX) * 2);
    const allowedH = Math.max(10, slotH - (strokePad + shadowPadY) * 2);

    ctx.font = `${fontWeight} ${s}px "${fontName}", sans-serif`;
    const lineHeight = Math.round(s * 1.3);
    const wrappedLines: string[] = [];
    let fits = true;

    for (const paragraph of paragraphs) {
      const words = paragraph.trim().split(/\s+/).filter(Boolean);
      if (words.length === 0) {
        wrappedLines.push("");
        continue;
      }

      let currentLine = words[0];
      if (ctx.measureText(currentLine).width > allowedW) {
        fits = false;
        break;
      }

      for (let i = 1; i < words.length; i++) {
        const candidate = currentLine + " " + words[i];
        if (ctx.measureText(candidate).width <= allowedW) {
          currentLine = candidate;
        } else {
          wrappedLines.push(currentLine);
          currentLine = words[i];
          if (ctx.measureText(currentLine).width > allowedW) {
            fits = false;
            break;
          }
        }
      }
      wrappedLines.push(currentLine);
      if (!fits) break;
    }

    const totalH = (wrappedLines.length - 1) * lineHeight + s;
    if (fits && wrappedLines.length <= effectiveMaxLines && totalH <= allowedH) {
      autoFitSize = s;
      break;
    }
  }

  // If text does not comfortably fit even at minFontSize, or was clamped to minFontSize
  const isBelowMin = autoFitSize === -1 || autoFitSize <= minFontSize;
  const baseSize = autoFitSize !== -1 ? autoFitSize : minFontSize;

  const clampedScale = Math.max(0.8, Math.min(1.2, userScale || 1.0));
  let chosenFontSize = Math.round(baseSize * clampedScale);
  let isClampedAtMin = isBelowMin || chosenFontSize <= minFontSize;
  if (chosenFontSize < minFontSize) {
    chosenFontSize = minFontSize;
    isClampedAtMin = true;
  }

  // Step 2: Wrap lines with chosenFontSize
  const strokePad = Math.ceil(chosenFontSize * strokeRatio);
  const allowedW = Math.max(10, slotW - (strokePad + shadowPadX) * 2);
  ctx.font = `${fontWeight} ${chosenFontSize}px "${fontName}", sans-serif`;

  const wrappedLines: string[] = [];
  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      wrappedLines.push("");
      continue;
    }
    let currentLine = words[0];
    for (let i = 1; i < words.length; i++) {
      const candidate = currentLine + " " + words[i];
      if (ctx.measureText(candidate).width <= allowedW) {
        currentLine = candidate;
      } else {
        wrappedLines.push(currentLine);
        currentLine = words[i];
        if (wrappedLines.length === effectiveMaxLines - 1) {
          currentLine = words.slice(i).join(" ");
          break;
        }
      }
    }
    wrappedLines.push(currentLine);
    if (wrappedLines.length >= effectiveMaxLines) break;
  }

  const finalLines = wrappedLines.slice(0, effectiveMaxLines);
  if (finalLines.length > 0) {
    const lastIdx = finalLines.length - 1;
    finalLines[lastIdx] = truncateToFit(ctx, finalLines[lastIdx], allowedW);
  }

  return { fontSize: chosenFontSize, lines: finalLines, isClampedAtMin };
}

type RenderLayer =
  | { type: "overlay"; z: number }
  | { type: "slot"; slot: Slot; z: number };

/**
 * Pure poster rendering module using browser Canvas API.
 * Takes the template config, layout, variant, blank image, overlay, cutouts and texts,
 * and renders all elements in exact z-order onto a canvas.
 */
export async function renderPoster(
  params: RenderPosterParams,
  targetCanvas?: HTMLCanvasElement
): Promise<HTMLCanvasElement> {
  const { config, blankImage, overlayImage } = params;

  // Resolve active layout
  const layout: TemplateLayout =
    params.layout ||
    (config.layouts && config.layouts[0]) || {
      id: "default",
      name: "Default Layout",
      width: config.width || 1200,
      height: config.height || 1600,
      blank: "blank.png",
      overlay: config.overlay,
      overlayZ: config.overlayZ ?? 50,
      slots: config.slots || [],
    };

  const exportScale = params.exportScale && params.exportScale > 0 ? params.exportScale : 1;
  const width = Math.round(layout.width * exportScale);
  const height = Math.round(layout.height * exportScale);
  const slots = layout.slots || [];

  // Setup Canvas
  const canvas = targetCanvas || document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to obtain 2D canvas context");
  }

  // High-resolution image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  // Clear canvas
  ctx.clearRect(0, 0, width, height);

  // Step 1: Draw base blank image at full dimensions
  ctx.drawImage(blankImage, 0, 0, width, height);

  // Step 2: Build layer order (all slots + overlay sorted by z)
  const layers: RenderLayer[] = [];

  if (overlayImage) {
    layers.push({
      type: "overlay",
      z: layout.overlayZ !== undefined ? Number(layout.overlayZ) : 50,
    });
  }

  for (const slot of slots) {
    layers.push({
      type: "slot",
      slot,
      z: slot.z !== undefined ? Number(slot.z) : 10,
    });
  }

  // Sort ascending by z
  layers.sort((a, b) => a.z - b.z);

  // Preload all fonts used across text slots to guarantee canvas never falls back to a default font
  const fontLoads: Promise<void>[] = [];
  for (const s of slots) {
    if (s.type === "text") {
      let fontName = s.font || "Baloo Da 2";
      if (s.styleId && config.styles) {
        const specific = config.styles.find((st: TextStyle) => st.id === s.styleId);
        if (specific?.font) fontName = specific.font;
      }
      if (params.activeStyle?.font) {
        fontName = params.activeStyle.font;
      }
      const weight = getFontWeight(fontName);
      fontLoads.push(ensureFontLoaded(fontName, weight, 48));
    }
  }
  if (fontLoads.length > 0) {
    try {
      await Promise.all(fontLoads);
    } catch (fontErr) {
      console.warn("Font preloading warning:", fontErr);
    }
  }

  // Step 3: Draw each layer in sorted z order
  for (const layer of layers) {
    if (layer.type === "overlay" && overlayImage) {
      ctx.drawImage(overlayImage, 0, 0, width, height);
      continue;
    }

    if (layer.type === "slot") {
      const slot = layer.slot;

      // --- Image Slot ---
      if (slot.type === "image") {
        let cutout = params.cutouts !== undefined
          ? (params.cutouts[slot.id] || null)
          : (params.cutoutImage || null);

        if (cutout) {
          // Look matching: subtly match template warmth & brightness if enabled
          const shouldColorMatch =
            params.config.colorMatch ?? layout.colorMatch ?? false;
          if (shouldColorMatch) {
            try {
              cutout = matchCutoutColors(cutout, blankImage);
            } catch (cmErr) {
              console.warn("Color match error, using original cutout:", cmErr);
            }
          }

          const box = getCutoutBoundingBox(cutout);

          const slotX = slot.x * width;
          const slotY = slot.y * height;
          const slotW = slot.w * width;
          const slotH = slot.h * height;

          const faceBox = params.faceBoxes?.[slot.id];

          // Compute base auto placement (with face-guided scaling & bounds if available)
          const autoPlace = computeFacePlacement({
            slotX,
            slotY,
            slotW,
            slotH,
            cutoutW: box.width,
            cutoutH: box.height,
            faceBox,
            faceHeightRatio: slot.faceHeightRatio,
            anchor: slot.anchor || "bottom",
          });

          // Apply manual adjustment { dx, dy, zoom }
          const adj = params.adjustments?.[slot.id] || { dx: 0, dy: 0, zoom: 1.0 };
          const minZoom = slot.minZoom ?? 0.40;
          const maxZoom = slot.maxZoom ?? 2.50;
          const zoom = Math.max(minZoom, Math.min(maxZoom, adj.zoom ?? 1.0));

          const maxOffset = slot.maxOffset ?? 0.30;
          const dx = Math.max(-maxOffset, Math.min(maxOffset, adj.dx ?? 0));
          const dy = Math.max(-maxOffset, Math.min(maxOffset, adj.dy ?? 0));

          const finalW = autoPlace.drawW * zoom;
          const finalH = autoPlace.drawH * zoom;

          // Scale relative to anchor, then apply dx, dy offsets (allows 30% movement around selected place)
          let drawX = autoPlace.drawX - (finalW - autoPlace.drawW) / 2 + dx * slotW;
          let drawY =
            slot.anchor === "bottom"
              ? autoPlace.drawY - (finalH - autoPlace.drawH) + dy * slotH
              : autoPlace.drawY - (finalH - autoPlace.drawH) / 2 + dy * slotH;

          // 1. Draw outline behind cutout if configured
          if (slot.outlineWidth && slot.outlineWidth > 0) {
            const outlineWidth = slot.outlineWidth;
            const outlineColor = slot.outlineColor || "#ffffff";
            const offCanvas = document.createElement("canvas");
            offCanvas.width = Math.max(1, Math.round(finalW));
            offCanvas.height = Math.max(1, Math.round(finalH));
            const oCtx = offCanvas.getContext("2d");
            if (oCtx) {
              oCtx.imageSmoothingEnabled = true;
              oCtx.imageSmoothingQuality = "high";
              oCtx.drawImage(
                cutout,
                box.minX,
                box.minY,
                box.width,
                box.height,
                0,
                0,
                finalW,
                finalH
              );
              oCtx.globalCompositeOperation = "source-in";
              oCtx.fillStyle = outlineColor;
              oCtx.fillRect(0, 0, finalW, finalH);

              const steps = Math.max(8, Math.round(outlineWidth * 3));
              for (let i = 0; i < steps; i++) {
                const angle = (i * 2 * Math.PI) / steps;
                const ox = Math.cos(angle) * outlineWidth;
                const oy = Math.sin(angle) * outlineWidth;
                ctx.drawImage(offCanvas, drawX + ox, drawY + oy);
              }
            }
          }

          // 2. Draw soft drop shadow behind cutout if configured
          if (
            slot.shadowBlur ||
            slot.shadowOffsetX ||
            slot.shadowOffsetY ||
            slot.shadowOpacity
          ) {
            ctx.save();
            const opacity = slot.shadowOpacity ?? 0.4;
            ctx.shadowColor = slot.shadowColor || `rgba(0, 0, 0, ${opacity})`;
            ctx.shadowBlur = slot.shadowBlur ?? 15;
            ctx.shadowOffsetX = slot.shadowOffsetX ?? 0;
            ctx.shadowOffsetY = slot.shadowOffsetY ?? 10;

            ctx.drawImage(
              cutout,
              box.minX,
              box.minY,
              box.width,
              box.height,
              drawX,
              drawY,
              finalW,
              finalH
            );
            ctx.restore();
          }

          // 3. Draw cutout
          ctx.drawImage(
            cutout,
            box.minX,
            box.minY,
            box.width,
            box.height,
            drawX,
            drawY,
            finalW,
            finalH
          );

          // 4. Faint dashed slot outline (only while adjusting in editor, never on export)
          if (params.activeAdjustSlotId === slot.id && !params.isExport) {
            ctx.save();
            ctx.setLineDash([8, 6]);
            ctx.strokeStyle = "rgba(59, 130, 246, 0.75)";
            ctx.lineWidth = 3;
            ctx.strokeRect(slotX, slotY, slotW, slotH);
            ctx.restore();
          }
        }
      }

      // --- Text Slot ---
      if (slot.type === "text") {
        const rawText =
          params.texts && params.texts[slot.id] !== undefined
            ? params.texts[slot.id]
            : params.text || "";

        if (rawText && rawText.trim().length > 0) {
          const slotX = slot.x * width;
          const slotY = slot.y * height;
          const slotW = slot.w * width;
          const slotH = slot.h * height;
          const align = slot.align || "center";

          // Look up user style or TextStyle (active global style chip or slot-specific style)
          const userStyle = params.userTextStyles?.[slot.id];

          let textStyle: TextStyle | undefined = params.activeStyle || undefined;
          if (slot.styleId && config.styles) {
            const specific = config.styles.find((s: TextStyle) => s.id === slot.styleId);
            if (specific) textStyle = specific;
          }

          // Font selection & weight
          const fontName = userStyle?.font || textStyle?.font || slot.font || "Baloo Da 2";
          const fontWeight = getFontWeight(fontName);

          // Color & Fill: userStyle.fill > variant override > textStyle fill/color > slot color
          let textColor = slot.color || "#FFFFFF";
          if (userStyle?.fill) {
            textColor = userStyle.fill;
          } else if (params.variant?.textColors && params.variant.textColors[slot.id]) {
            textColor = params.variant.textColors[slot.id];
          } else if (textStyle) {
            textColor = textStyle.fill || textStyle.color || textColor;
          }

          // Outline 1 (Inner stroke)
          let outlineColor: string | null = null;
          let finalOutlineRatio = 0;
          if (userStyle) {
            if (userStyle.outline?.on) {
              outlineColor = userStyle.outline.color || "#0E7A53";
              finalOutlineRatio = OUTLINE_SIZE_MAP[userStyle.outline.size] ?? 0.10;
            }
          } else {
            outlineColor = textStyle?.outlineColor || textStyle?.strokeColor || null;
            let outlineWidthRatio = textStyle?.outlineWidthRatio;
            if (outlineWidthRatio === undefined && textStyle?.strokeWidth && textStyle.strokeWidth > 0) {
              outlineWidthRatio = textStyle.strokeWidth / 48;
            }
            finalOutlineRatio = outlineColor && outlineWidthRatio ? outlineWidthRatio : 0;
          }

          // Outline 2 (Outer stroke)
          let outline2Color: string | null = null;
          let finalOutline2Ratio = 0;
          if (!userStyle) {
            outline2Color = textStyle?.outline2Color || null;
            const outline2WidthRatio = textStyle?.outline2WidthRatio || 0;
            finalOutline2Ratio = outline2Color && outline2WidthRatio > 0 ? outline2WidthRatio : 0;
          }

          // Shadow
          let shadow: { color?: string; blur?: number; offsetX?: number; offsetY?: number } | undefined;
          if (userStyle) {
            if (userStyle.shadow?.on) {
              const tune = SHADOW_STRENGTH_MAP[userStyle.shadow.strength] ?? SHADOW_STRENGTH_MAP.medium;
              shadow = {
                color: tune.color,
                blur: tune.blur,
                offsetX: tune.offsetX,
                offsetY: tune.offsetY,
              };
            }
          } else {
            shadow = textStyle?.shadow || (textStyle?.shadowColor ? {
              color: textStyle.shadowColor,
              blur: textStyle.shadowBlur,
              offsetX: textStyle.shadowOffsetX,
              offsetY: textStyle.shadowOffsetY,
            } : undefined);
          }
          const hasShadow = Boolean(shadow?.color && ((shadow.blur ?? 0) > 0 || (shadow.offsetX ?? 0) !== 0 || (shadow.offsetY ?? 0) !== 0));

          // Ensure specific font is loaded before layout and rendering
          await ensureFontLoaded(fontName, fontWeight, 48);

          const maxLines = Math.max(1, slot.maxLines || 3);
          const minFontSize = Math.round(
            Math.max(
              (slot.minFontSize || 14) * exportScale,
              Math.floor(slotH * 0.12)
            )
          );
          const startFontSize = Math.min(Math.floor(slotH * 0.8), Math.round(180 * exportScale));

          // Compute max stroke ratio for auto-fit sizing so outline never overflows bounds
          const maxStrokeRatio = Math.max(finalOutlineRatio, finalOutline2Ratio);
          const trimmedText = rawText.trim();

          const shadowPadX = hasShadow ? Math.ceil(Math.abs(shadow?.offsetX ?? 0) + (shadow?.blur ?? 0) * 0.4) : 0;
          const shadowPadY = hasShadow ? Math.ceil(Math.abs(shadow?.offsetY ?? 0) + (shadow?.blur ?? 0) * 0.4) : 0;
          const userScale = userStyle?.sizeScale ?? 1.0;

          const { fontSize: chosenFontSize, lines: linesToDraw, isClampedAtMin } = wrapAndFitText(
            ctx,
            trimmedText,
            fontName,
            slotW,
            slotH,
            maxLines,
            minFontSize,
            startFontSize,
            maxStrokeRatio,
            fontWeight,
            shadowPadX,
            shadowPadY,
            userScale
          );

          if (params.onTextMinWarning) {
            params.onTextMinWarning(slot.id, isClampedAtMin);
          }

          // Calculate stroke widths in pixels (scaled with font size)
          // Apparent inner stroke width = chosenFontSize * finalOutlineRatio
          // Apparent outer stroke width = chosenFontSize * finalOutline2Ratio
          // Since canvas centers stroke on path and fill covers inner half:
          const innerStrokeLineWidth = finalOutlineRatio > 0
            ? Math.round(chosenFontSize * finalOutlineRatio * 2)
            : 0;

          let outerStrokeLineWidth = finalOutline2Ratio > 0
            ? Math.round(chosenFontSize * finalOutline2Ratio * 2)
            : 0;

          // Outer stroke must extend beyond inner stroke to be visible
          if (outerStrokeLineWidth > 0 && outerStrokeLineWidth <= innerStrokeLineWidth) {
            outerStrokeLineWidth = innerStrokeLineWidth + Math.max(2, Math.round(chosenFontSize * 0.04 * 2));
          }

          const strokePadding = Math.ceil(chosenFontSize * maxStrokeRatio);

          let anchorX = slotX + strokePadding + shadowPadX;
          if (align === "center") {
            anchorX = slotX + slotW / 2;
          } else if (align === "right") {
            anchorX = slotX + slotW - (strokePadding + shadowPadX);
          }

          const lineHeight = Math.round(chosenFontSize * 1.3);
          const totalTextH = (linesToDraw.length - 1) * lineHeight + chosenFontSize;
          const startY = slotY + (slotH - totalTextH) / 2 + chosenFontSize * 0.5;

          ctx.save();
          ctx.font = `${fontWeight} ${chosenFontSize}px "${fontName}", sans-serif`;
          ctx.textAlign = align as CanvasTextAlign;
          ctx.textBaseline = "middle";
          ctx.lineJoin = "round";
          ctx.miterLimit = 2;

          // Render in exact order: 1. shadow, 2. outer stroke, 3. inner stroke, 4. fill

          // 1. Shadow (drawn using outermost boundary)
          if (hasShadow && shadow?.color) {
            ctx.save();
            ctx.shadowColor = shadow.color;
            ctx.shadowBlur = Math.round((shadow.blur ?? 8) * exportScale);
            ctx.shadowOffsetX = Math.round((shadow.offsetX ?? 0) * exportScale);
            ctx.shadowOffsetY = Math.round((shadow.offsetY ?? 4) * exportScale);

            if (outerStrokeLineWidth > 0 && outline2Color) {
              ctx.strokeStyle = outline2Color;
              ctx.lineWidth = outerStrokeLineWidth;
              for (let i = 0; i < linesToDraw.length; i++) {
                ctx.strokeText(linesToDraw[i], anchorX, startY + i * lineHeight);
              }
            } else if (innerStrokeLineWidth > 0 && outlineColor) {
              ctx.strokeStyle = outlineColor;
              ctx.lineWidth = innerStrokeLineWidth;
              for (let i = 0; i < linesToDraw.length; i++) {
                ctx.strokeText(linesToDraw[i], anchorX, startY + i * lineHeight);
              }
            } else {
              ctx.fillStyle = textColor;
              for (let i = 0; i < linesToDraw.length; i++) {
                ctx.fillText(linesToDraw[i], anchorX, startY + i * lineHeight);
              }
            }
            ctx.restore();
          }

          // 2. Outer stroke (outline2)
          if (outerStrokeLineWidth > 0 && outline2Color) {
            ctx.save();
            ctx.shadowColor = "transparent";
            ctx.shadowBlur = 0;
            ctx.strokeStyle = outline2Color;
            ctx.lineWidth = outerStrokeLineWidth;
            ctx.lineJoin = "round";
            ctx.miterLimit = 2;
            for (let i = 0; i < linesToDraw.length; i++) {
              ctx.strokeText(linesToDraw[i], anchorX, startY + i * lineHeight);
            }
            ctx.restore();
          }

          // 3. Inner stroke (outline)
          if (innerStrokeLineWidth > 0 && outlineColor) {
            ctx.save();
            ctx.shadowColor = "transparent";
            ctx.shadowBlur = 0;
            ctx.strokeStyle = outlineColor;
            ctx.lineWidth = innerStrokeLineWidth;
            ctx.lineJoin = "round";
            ctx.miterLimit = 2;
            for (let i = 0; i < linesToDraw.length; i++) {
              ctx.strokeText(linesToDraw[i], anchorX, startY + i * lineHeight);
            }
            ctx.restore();
          }

          // 4. Fill
          ctx.save();
          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;
          ctx.fillStyle = textColor;
          for (let i = 0; i < linesToDraw.length; i++) {
            ctx.fillText(linesToDraw[i], anchorX, startY + i * lineHeight);
          }
          ctx.restore();

          ctx.restore();
        }
      }
    }
  }

  // Watermark is disabled by default for clean preview and export
  if (params.watermark === true) {
    drawCanvasWatermark(
      ctx,
      width,
      height,
      params.watermarkText || ""
    );
  }

  return canvas;
}

/**
 * Renders sample text using a given TextStyle onto a preview canvas.
 * Follows the exact same order: shadow, outer stroke, inner stroke, fill,
 * with round lineJoin and miterLimit = 2.
 */
export async function renderSampleTextStyle(
  canvas: HTMLCanvasElement,
  style: Partial<TextStyle>,
  sampleText: string = "প্রতিশ্রুতি শ্রদ্ধা মোঃ তরিকুল",
  fontSize: number = 32
): Promise<void> {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const fontName = style.font || "Baloo Da 2";
  const fontWeight = getFontWeight(fontName);

  await ensureFontLoaded(fontName, fontWeight, fontSize);

  const width = canvas.width;
  const height = canvas.height;

  ctx.clearRect(0, 0, width, height);

  const fill = style.fill || style.color || "#FFFFFF";
  const outlineColor = style.outlineColor || style.strokeColor || null;
  const outlineWidthRatio = style.outlineWidthRatio ?? (style.strokeWidth ? style.strokeWidth / 48 : 0);

  const outline2Color = style.outline2Color || null;
  const outline2WidthRatio = style.outline2WidthRatio ?? 0;

  const shadow = style.shadow || (style.shadowColor ? {
    color: style.shadowColor,
    blur: style.shadowBlur,
    offsetX: style.shadowOffsetX,
    offsetY: style.shadowOffsetY,
  } : undefined);
  const hasShadow = Boolean(shadow?.color && ((shadow.blur ?? 0) > 0 || (shadow.offsetX ?? 0) !== 0 || (shadow.offsetY ?? 0) !== 0));

  const innerStrokeWidth = outlineColor && outlineWidthRatio > 0
    ? Math.round(fontSize * outlineWidthRatio * 2)
    : 0;

  let outerStrokeWidth = outline2Color && outline2WidthRatio > 0
    ? Math.round(fontSize * outline2WidthRatio * 2)
    : 0;

  if (outerStrokeWidth > 0 && outerStrokeWidth <= innerStrokeWidth) {
    outerStrokeWidth = innerStrokeWidth + Math.max(2, Math.round(fontSize * 0.04 * 2));
  }

  const anchorX = width / 2;
  const anchorY = height / 2;

  ctx.save();
  ctx.font = `${fontWeight} ${fontSize}px "${fontName}", sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;

  // 1. Shadow
  if (hasShadow && shadow?.color) {
    ctx.save();
    ctx.shadowColor = shadow.color;
    ctx.shadowBlur = shadow.blur ?? 8;
    ctx.shadowOffsetX = shadow.offsetX ?? 0;
    ctx.shadowOffsetY = shadow.offsetY ?? 4;

    if (outerStrokeWidth > 0 && outline2Color) {
      ctx.strokeStyle = outline2Color;
      ctx.lineWidth = outerStrokeWidth;
      ctx.strokeText(sampleText, anchorX, anchorY);
    } else if (innerStrokeWidth > 0 && outlineColor) {
      ctx.strokeStyle = outlineColor;
      ctx.lineWidth = innerStrokeWidth;
      ctx.strokeText(sampleText, anchorX, anchorY);
    } else {
      ctx.fillStyle = fill;
      ctx.fillText(sampleText, anchorX, anchorY);
    }
    ctx.restore();
  }

  // 2. Outer stroke
  if (outerStrokeWidth > 0 && outline2Color) {
    ctx.save();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.strokeStyle = outline2Color;
    ctx.lineWidth = outerStrokeWidth;
    ctx.strokeText(sampleText, anchorX, anchorY);
    ctx.restore();
  }

  // 3. Inner stroke
  if (innerStrokeWidth > 0 && outlineColor) {
    ctx.save();
    ctx.shadowColor = "transparent";
    ctx.shadowBlur = 0;
    ctx.strokeStyle = outlineColor;
    ctx.lineWidth = innerStrokeWidth;
    ctx.strokeText(sampleText, anchorX, anchorY);
    ctx.restore();
  }

  // 4. Fill
  ctx.save();
  ctx.shadowColor = "transparent";
  ctx.shadowBlur = 0;
  ctx.fillStyle = fill;
  ctx.fillText(sampleText, anchorX, anchorY);
  ctx.restore();

  ctx.restore();
}
