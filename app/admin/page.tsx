"use client";

import { useEffect, useRef, useState, useMemo, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  TemplateConfig,
  Slot,
  ImageSlot,
  TextSlot,
  TemplateLayout,
  TemplateVariant,
  TextStyle,
  AVAILABLE_FONTS,
  TEXT_STYLE_PRESETS,
  DEFAULT_ALLOWED_COLORS,
  USER_TEXT_STYLE_PRESETS,
} from "@/lib/templates";
import { renderPoster, renderSampleTextStyle } from "@/lib/renderPoster";

function TextStylePreviewCanvas({
  style,
  sampleText = "প্রতিশ্রুতি শ্রদ্ধা মোঃ তরিকুল",
}: {
  style: TextStyle;
  sampleText?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [bgDark, setBgDark] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let isCancelled = false;
    renderSampleTextStyle(canvas, style, sampleText, 24).catch((err) => {
      if (!isCancelled) console.warn("Live preview render error:", err);
    });
    return () => {
      isCancelled = true;
    };
  }, [style, sampleText]);

  return (
    <div
      style={{
        marginTop: "0.85rem",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border)",
        background: bgDark
          ? "radial-gradient(circle, #0F172A 0%, #020617 100%)"
          : "radial-gradient(circle, #F8FAFC 0%, #E2E8F0 100%)",
        padding: "0.6rem 0.8rem",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "0.35rem",
          fontSize: "0.75rem",
          color: bgDark ? "#94A3B8" : "var(--text-muted)",
        }}
      >
        <span style={{ fontWeight: 700 }}>লাইভ প্রিভিউ (Live Preview):</span>
        <button
          type="button"
          onClick={() => setBgDark(!bgDark)}
          style={{
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: "4px",
            fontSize: "0.7rem",
            padding: "2px 6px",
            cursor: "pointer",
            color: bgDark ? "#F8FAFC" : "var(--text)",
          }}
        >
          {bgDark ? "☀️ Light BG" : "🌙 Dark BG"}
        </button>
      </div>
      <canvas
        ref={canvasRef}
        width={420}
        height={56}
        style={{
          width: "100%",
          height: "48px",
          display: "block",
        }}
      />
    </div>
  );
}

function AdminStudio() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Mode: "list" | "editor"
  const [viewMode, setViewMode] = useState<"list" | "editor">("list");

  // Template list state
  const [templates, setTemplates] = useState<TemplateConfig[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  // Editor state
  const [editingTemplate, setEditingTemplate] = useState<TemplateConfig | null>(null);
  const [activeLayoutIndex, setActiveLayoutIndex] = useState(0);
  const [activeSubTab, setActiveSubTab] = useState<"slots" | "variants" | "styles" | "testPreview">("slots");

  // Canvas & slot interaction state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [activeTool, setActiveTool] = useState<"select" | "photo" | "text">("select");
  const [snapToGrid, setSnapToGrid] = useState(false);

  // File buffers for layouts and variants
  // layoutId -> File
  const [blankFiles, setBlankFiles] = useState<Record<string, File>>({});
  const [overlayFiles, setOverlayFiles] = useState<Record<string, File>>({});
  // Cached Image elements for rendering: key -> HTMLImageElement
  const [cachedImages, setCachedImages] = useState<Record<string, HTMLImageElement>>({});

  // Dragging state on editor canvas
  const [dragAction, setDragAction] = useState<
    | { type: "move"; slotId: string; startNormX: number; startNormY: number; origX: number; origY: number }
    | { type: "resize"; slotId: string; handle: string; origX: number; origY: number; origW: number; origH: number }
    | { type: "create"; typeSlot: "image" | "text"; startNormX: number; startNormY: number }
    | null
  >(null);
  const [currentDragCoords, setCurrentDragCoords] = useState<{ x: number; y: number } | null>(null);

  // Test preview state
  const testCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [testCutouts, setTestCutouts] = useState<Record<string, HTMLImageElement | null>>({});
  const [testTexts, setTestTexts] = useState<Record<string, string>>({});
  const [previewVariantIndex, setPreviewVariantIndex] = useState<number>(-1); // -1 is default
  const [sampleCutoutImage, setSampleCutoutImage] = useState<HTMLImageElement | null>(null);

  // Feedback states
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [availablePoses, setAvailablePoses] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    fetch("/api/poses")
      .then((r) => r.json())
      .then((d) => {
        if (d.poses) setAvailablePoses(d.poses);
      })
      .catch(() => {});
  }, []);

  // --- 1. Load Templates List ---
  const loadTemplates = useCallback(async () => {
    try {
      setLoadingList(true);
      const res = await fetch("/api/templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (err) {
      console.error("Error loading templates", err);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Load sample cutout for test preview
  useEffect(() => {
    const img = new Image();
    img.src = "/sample-photo.jpg";
    img.onload = () => setSampleCutoutImage(img);
  }, []);

  // Compute categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => {
      if (t.category && t.category.trim()) set.add(t.category.trim());
    });
    return ["All", ...Array.from(set)];
  }, [templates]);

  // Filter templates
  const filteredTemplates = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return templates.filter((t) => {
      const matchCat =
        selectedCategory === "All" ||
        (t.category && t.category.toLowerCase() === selectedCategory.toLowerCase());
      const matchName = t.name.toLowerCase().includes(q);
      const matchTags = t.tags && t.tags.some((tag) => tag.toLowerCase().includes(q));
      return matchCat && (q === "" || matchName || matchTags);
    });
  }, [templates, selectedCategory, searchQuery]);

  async function handleLogout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  // --- 2. Template Duplication ---
  async function handleDuplicate(templateId: string) {
    try {
      const res = await fetch(`/api/admin/templates/${templateId}/duplicate`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to duplicate");
      setSuccess(`Duplicated template created: "${data.config.name}"`);
      await loadTemplates();
    } catch (err: any) {
      setError(err.message || "Duplicate failed");
    }
  }

  // --- 3. Delete Template ---
  async function handleDelete(templateId: string, name: string) {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;
    try {
      const res = await fetch(`/api/admin/templates/${templateId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== templateId));
        setSuccess(`Template "${name}" deleted.`);
      } else {
        const data = await res.json();
        alert(data.error || "Delete failed");
      }
    } catch (err) {
      console.error("Delete failed", err);
    }
  }

  // --- 4. Start Creating or Editing Template ---
  function startNewTemplate() {
    const newId = `t_template_${Date.now()}`;
    const initialConfig: TemplateConfig = {
      schemaVersion: 2,
      id: newId,
      name: "New Template",
      category: "General",
      tags: [],
      styles: [],
      layouts: [
        {
          id: "default",
          name: "Default (1200x1600)",
          width: 1200,
          height: 1600,
          blank: "blank.png",
          overlay: null,
          overlayZ: 50,
          slots: [
            {
              id: "photo1",
              type: "image",
              label: "Main Photo",
              x: 0.2,
              y: 0.25,
              w: 0.6,
              h: 0.5,
              z: 10,
              anchor: "bottom",
              allowAdjust: true,
              maxOffset: 0.3,
              minZoom: 0.4,
              maxZoom: 2.5,
              required: true,
            },
            {
              id: "text1",
              type: "text",
              label: "Name Label",
              x: 0.15,
              y: 0.82,
              w: 0.7,
              h: 0.08,
              z: 20,
              align: "center",
              color: "#FFD400",
              font: "Noto Sans Bengali",
              maxChars: 60,
              maxLines: 3,
              minFontSize: 14,
            },
          ],
        },
      ],
      variants: [],
      width: 1200,
      height: 1600,
      slots: [],
      overlay: null,
      overlayZ: 50,
    };
    initialConfig.slots = initialConfig.layouts[0].slots;

    setEditingTemplate(initialConfig);
    setActiveLayoutIndex(0);
    setSelectedSlotId("photo1");
    setBlankFiles({});
    setOverlayFiles({});
    const sampleImg = new Image();
    sampleImg.onload = () => {
      setCachedImages({ blank_default: sampleImg });
    };
    sampleImg.src = "/sample-blank.png";
    setViewMode("editor");
    setError(null);
    setSuccess(null);
  }

  function startEditTemplate(tpl: TemplateConfig) {
    setEditingTemplate(JSON.parse(JSON.stringify(tpl)));
    setActiveLayoutIndex(0);
    setSelectedSlotId(tpl.layouts[0]?.slots[0]?.id || null);
    setBlankFiles({});
    setOverlayFiles({});
    setViewMode("editor");
    setError(null);
    setSuccess(null);
  }

  // Handle URL query parameters for direct navigation (?mode=new or ?edit=<id>)
  useEffect(() => {
    const mode = searchParams.get("mode");
    const editId = searchParams.get("edit");
    if (mode === "new" && viewMode !== "editor") {
      startNewTemplate();
    } else if (editId && templates.length > 0 && (!editingTemplate || editingTemplate.id !== editId)) {
      const found = templates.find((t) => t.id === editId);
      if (found) {
        startEditTemplate(found);
      }
    }
  }, [searchParams, templates, viewMode, editingTemplate]);

  // Active Layout
  const activeLayout = editingTemplate?.layouts[activeLayoutIndex] || null;

  // Preload and cache images for the active layout
  useEffect(() => {
    if (!editingTemplate || !activeLayout) return;

    // 1. Blank image
    const layoutKey = `blank_${activeLayout.id}`;
    if (blankFiles[layoutKey]) {
      const url = URL.createObjectURL(blankFiles[layoutKey]);
      const img = new Image();
      img.onload = () => {
        setCachedImages((prev) => ({ ...prev, [layoutKey]: img }));
      };
      img.src = url;
    } else if (!cachedImages[layoutKey]) {
      const img = new Image();
      img.onload = () => {
        setCachedImages((prev) => ({ ...prev, [layoutKey]: img }));
      };
      img.onerror = () => {
        const fallback = new Image();
        fallback.onload = () => {
          setCachedImages((prev) => ({ ...prev, [layoutKey]: fallback }));
        };
        fallback.src = "/sample-blank.png";
      };

      if (editingTemplate.id.startsWith("t_template_")) {
        img.src = "/sample-blank.png";
      } else {
        img.src = `/api/templates/${editingTemplate.id}/images/${activeLayout.blank || "blank.png"}`;
      }
    }

    // 2. Overlay image if specified
    if (activeLayout.overlay) {
      const overlayKey = `overlay_${activeLayout.id}`;
      if (overlayFiles[overlayKey]) {
        const url = URL.createObjectURL(overlayFiles[overlayKey]);
        const img = new Image();
        img.onload = () => {
          setCachedImages((prev) => ({ ...prev, [overlayKey]: img }));
        };
        img.src = url;
      } else if (!cachedImages[overlayKey]) {
        const img = new Image();
        img.onload = () => {
          setCachedImages((prev) => ({ ...prev, [overlayKey]: img }));
        };
        img.src = `/api/templates/${editingTemplate.id}/images/${activeLayout.overlay}`;
      }
    }
  }, [editingTemplate?.id, activeLayout?.id, activeLayout?.blank, activeLayout?.overlay, blankFiles, overlayFiles, cachedImages]);

  // --- 5. Slot Geometry Helpers ---
  function applySnap(val: number): number {
    if (!snapToGrid) return Math.round(val * 10000) / 10000;
    const step = 0.02; // 2% snap grid
    return Math.round(Math.round(val / step) * step * 10000) / 10000;
  }

  function updateActiveLayoutSlots(newSlots: Slot[]) {
    if (!editingTemplate) return;
    const updatedLayouts = [...editingTemplate.layouts];
    updatedLayouts[activeLayoutIndex] = {
      ...updatedLayouts[activeLayoutIndex],
      slots: newSlots,
    };
    setEditingTemplate({
      ...editingTemplate,
      layouts: updatedLayouts,
    });
  }

  function updateSelectedSlot(updater: (slot: Slot) => Slot) {
    if (!activeLayout || !selectedSlotId) return;
    const newSlots = activeLayout.slots.map((s) => (s.id === selectedSlotId ? updater(s) : s));
    updateActiveLayoutSlots(newSlots);
  }

  function deleteSelectedSlot() {
    if (!activeLayout || !selectedSlotId) return;
    const newSlots = activeLayout.slots.filter((s) => s.id !== selectedSlotId);
    updateActiveLayoutSlots(newSlots);
    setSelectedSlotId(newSlots[0]?.id || null);
  }

  // --- 6. Layer Reordering (Z-index) for all slots and overlay ---
  function applyLayerZ(layerId: string, newZ: number) {
    if (!editingTemplate || !activeLayout) return;
    const updatedLayouts = [...editingTemplate.layouts];
    if (layerId === "__overlay__") {
      updatedLayouts[activeLayoutIndex] = {
        ...updatedLayouts[activeLayoutIndex],
        overlayZ: newZ,
      };
    } else {
      updatedLayouts[activeLayoutIndex] = {
        ...updatedLayouts[activeLayoutIndex],
        slots: updatedLayouts[activeLayoutIndex].slots.map((s) =>
          s.id === layerId ? { ...s, z: newZ } : s
        ),
      };
    }
    setEditingTemplate({
      ...editingTemplate,
      layouts: updatedLayouts,
    });
  }

  function moveLayer(layerId: string, direction: "up" | "down") {
    if (!editingTemplate || !activeLayout) return;

    // Build unified layer stack sorted descending (top-most layer first)
    const allLayers = [
      ...activeLayout.slots.map((s) => ({
        id: s.id,
        type: "slot" as const,
        label: s.label,
        z: s.z,
        slot: s,
      })),
      {
        id: "__overlay__",
        type: "overlay" as const,
        label: "Overlay Layer",
        z: activeLayout.overlayZ ?? 50,
      },
    ].sort((a, b) => b.z - a.z);

    const index = allLayers.findIndex((l) => l.id === layerId);
    if (index === -1) return;

    if (direction === "up" && index > 0) {
      const targetLayer = allLayers[index - 1];
      const newZ = targetLayer.z + 1;
      applyLayerZ(layerId, newZ);
    } else if (direction === "down" && index < allLayers.length - 1) {
      const targetLayer = allLayers[index + 1];
      const newZ = Math.max(1, targetLayer.z - 1);
      applyLayerZ(layerId, newZ);
    }
  }

  // --- 7. Precision Keyboard Nudge (1px normal, 10px shift) ---
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (!selectedSlotId || !activeLayout || viewMode !== "editor" || activeSubTab !== "slots") return;

      // Don't nudge if user is typing in an input
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === "input" || targetTag === "textarea" || targetTag === "select") return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        deleteSelectedSlot();
        return;
      }

      const stepPx = e.shiftKey ? 10 : 1;
      const dxNorm = stepPx / (activeLayout.width || 1200);
      const dyNorm = stepPx / (activeLayout.height || 1600);

      let deltaX = 0;
      let deltaY = 0;

      if (e.key === "ArrowLeft") deltaX = -dxNorm;
      else if (e.key === "ArrowRight") deltaX = dxNorm;
      else if (e.key === "ArrowUp") deltaY = -dyNorm;
      else if (e.key === "ArrowDown") deltaY = dyNorm;
      else return;

      e.preventDefault();

      updateSelectedSlot((s) => ({
        ...s,
        x: Math.max(0, Math.min(1 - s.w, Math.round((s.x + deltaX) * 10000) / 10000)),
        y: Math.max(0, Math.min(1 - s.h, Math.round((s.y + deltaY) * 10000) / 10000)),
      }));
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedSlotId, activeLayout, viewMode, activeSubTab]);

  // --- 8. Editor Canvas Mouse Handling (Select, Move, Resize, Create) ---
  function getCanvasCoords(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0, normX: 0, normY: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = Math.max(0, Math.min(canvas.width, (e.clientX - rect.left) * scaleX));
    const y = Math.max(0, Math.min(canvas.height, (e.clientY - rect.top) * scaleY));
    return {
      x,
      y,
      normX: x / canvas.width,
      normY: y / canvas.height,
    };
  }

  // Hit test handles for selected slot
  function getHitHandle(normX: number, normY: number, slot: Slot, canvasW: number, canvasH: number): string | null {
    const handleRadius = 8; // px
    const sx = slot.x * canvasW;
    const sy = slot.y * canvasH;
    const sw = slot.w * canvasW;
    const sh = slot.h * canvasH;
    const cx = normX * canvasW;
    const cy = normY * canvasH;

    const handles = [
      { name: "nw", x: sx, y: sy },
      { name: "ne", x: sx + sw, y: sy },
      { name: "se", x: sx + sw, y: sy + sh },
      { name: "sw", x: sx, y: sy + sh },
      { name: "n", x: sx + sw / 2, y: sy },
      { name: "s", x: sx + sw / 2, y: sy + sh },
      { name: "w", x: sx, y: sy + sh / 2 },
      { name: "e", x: sx + sw, y: sy + sh / 2 },
    ];

    for (const h of handles) {
      if (Math.abs(cx - h.x) <= handleRadius && Math.abs(cy - h.y) <= handleRadius) {
        return h.name;
      }
    }
    return null;
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!activeLayout || !canvasRef.current) return;
    const { x, y, normX, normY } = getCanvasCoords(e);
    const canvasW = canvasRef.current.width;
    const canvasH = canvasRef.current.height;

    // Check hit on active slot resize handle
    const selectedSlot = activeLayout.slots.find((s) => s.id === selectedSlotId);
    if (selectedSlot) {
      const hitHandle = getHitHandle(normX, normY, selectedSlot, canvasW, canvasH);
      if (hitHandle) {
        setDragAction({
          type: "resize",
          slotId: selectedSlot.id,
          handle: hitHandle,
          origX: selectedSlot.x,
          origY: selectedSlot.y,
          origW: selectedSlot.w,
          origH: selectedSlot.h,
        });
        setCurrentDragCoords({ x, y });
        return;
      }
    }

    // Check hit on any slot (from top z down)
    const sortedSlots = [...activeLayout.slots].sort((a, b) => b.z - a.z);
    for (const slot of sortedSlots) {
      if (normX >= slot.x && normX <= slot.x + slot.w && normY >= slot.y && normY <= slot.y + slot.h) {
        setSelectedSlotId(slot.id);
        setDragAction({
          type: "move",
          slotId: slot.id,
          startNormX: normX,
          startNormY: normY,
          origX: slot.x,
          origY: slot.y,
        });
        setCurrentDragCoords({ x, y });
        return;
      }
    }

    // Clicked on empty space: either unselect or create new slot
    if (activeTool === "photo" || activeTool === "text") {
      setDragAction({
        type: "create",
        typeSlot: activeTool === "photo" ? "image" : "text",
        startNormX: normX,
        startNormY: normY,
      });
      setCurrentDragCoords({ x, y });
    } else {
      setSelectedSlotId(null);
    }
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!dragAction || !canvasRef.current) return;
    const { x, y, normX, normY } = getCanvasCoords(e);
    setCurrentDragCoords({ x, y });

    if (dragAction.type === "move") {
      const dx = normX - dragAction.startNormX;
      const dy = normY - dragAction.startNormY;
      const newX = applySnap(Math.max(0, Math.min(1, dragAction.origX + dx)));
      const newY = applySnap(Math.max(0, Math.min(1, dragAction.origY + dy)));
      updateSelectedSlot((s) => ({
        ...s,
        x: Math.min(newX, 1 - s.w),
        y: Math.min(newY, 1 - s.h),
      }));
    } else if (dragAction.type === "resize") {
      const { handle, origX, origY, origW, origH } = dragAction;
      let newX = origX;
      let newY = origY;
      let newW = origW;
      let newH = origH;

      if (handle.includes("e")) {
        newW = Math.max(0.04, normX - origX);
      }
      if (handle.includes("s")) {
        newH = Math.max(0.04, normY - origY);
      }
      if (handle.includes("w")) {
        const right = origX + origW;
        newX = Math.min(right - 0.04, normX);
        newW = right - newX;
      }
      if (handle.includes("n")) {
        const bottom = origY + origH;
        newY = Math.min(bottom - 0.04, normY);
        newH = bottom - newY;
      }

      updateSelectedSlot((s) => ({
        ...s,
        x: applySnap(newX),
        y: applySnap(newY),
        w: applySnap(newW),
        h: applySnap(newH),
      }));
    }
  }

  function handleMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!dragAction || !activeLayout) return;
    const { normX, normY } = getCanvasCoords(e);

    if (dragAction.type === "create") {
      const minX = Math.min(dragAction.startNormX, normX);
      const minY = Math.min(dragAction.startNormY, normY);
      const width = Math.abs(normX - dragAction.startNormX);
      const height = Math.abs(normY - dragAction.startNormY);

      if (width >= 0.03 && height >= 0.03) {
        const count = activeLayout.slots.length + 1;
        const maxZ = activeLayout.slots.reduce((acc, s) => Math.max(acc, s.z), 10);
        const newId = `${dragAction.typeSlot}${Date.now().toString().slice(-4)}`;

        if (dragAction.typeSlot === "image") {
          const newSlot: ImageSlot = {
            id: newId,
            type: "image",
            label: `Photo Slot ${count}`,
            x: applySnap(minX),
            y: applySnap(minY),
            w: applySnap(width),
            h: applySnap(height),
            z: maxZ + 10,
            anchor: "bottom",
            allowAdjust: true,
            maxOffset: 0.3,
            minZoom: 0.4,
            maxZoom: 2.5,
            required: true,
          };
          updateActiveLayoutSlots([...activeLayout.slots, newSlot]);
          setSelectedSlotId(newId);
        } else {
          const newSlot: TextSlot = {
            id: newId,
            type: "text",
            label: `Text Slot ${count}`,
            x: applySnap(minX),
            y: applySnap(minY),
            w: applySnap(width),
            h: applySnap(height),
            z: maxZ + 10,
            align: "center",
            color: "#FFD400",
            font: "Noto Sans Bengali",
            maxChars: 60,
            maxLines: 3,
            minFontSize: 14,
          };
          updateActiveLayoutSlots([...activeLayout.slots, newSlot]);
          setSelectedSlotId(newId);
        }
      }
      setActiveTool("select");
    }

    setDragAction(null);
    setCurrentDragCoords(null);
  }

  // --- 9. Draw Canvas in Slot Editor ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !activeLayout || viewMode !== "editor" || activeSubTab !== "slots") return;

    canvas.width = activeLayout.width;
    canvas.height = activeLayout.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Draw Blank Template background
    const layoutKey = `blank_${activeLayout.id}`;
    const blankImg = cachedImages[layoutKey];
    if (blankImg) {
      ctx.drawImage(blankImg, 0, 0, canvas.width, canvas.height);
    } else {
      // Checkerboard placeholder if blank is not loaded yet
      ctx.fillStyle = "#e2e8f0";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#64748b";
      ctx.font = "bold 32px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(`Upload blank template for ${activeLayout.name}`, canvas.width / 2, canvas.height / 2);
    }

    // 2. Draw slots in order
    const slots = activeLayout.slots;
    for (const slot of slots) {
      const isSelected = slot.id === selectedSlotId;
      const px = slot.x * canvas.width;
      const py = slot.y * canvas.height;
      const pw = slot.w * canvas.width;
      const ph = slot.h * canvas.height;

      // Color scheme: Blue for image slot, Green for text slot
      const isImage = slot.type === "image";
      ctx.fillStyle = isImage
        ? isSelected
          ? "rgba(37, 99, 235, 0.35)"
          : "rgba(37, 99, 235, 0.2)"
        : isSelected
        ? "rgba(22, 163, 74, 0.35)"
        : "rgba(22, 163, 74, 0.2)";
      ctx.fillRect(px, py, pw, ph);

      ctx.lineWidth = isSelected ? Math.max(3, Math.round(canvas.width * 0.003)) : Math.max(2, Math.round(canvas.width * 0.002));
      ctx.strokeStyle = isImage ? "#2563eb" : "#16a34a";
      ctx.strokeRect(px, py, pw, ph);

      // Label badge
      const fontSize = Math.max(14, Math.round(canvas.width * 0.016));
      ctx.font = `bold ${fontSize}px sans-serif`;
      ctx.fillStyle = isImage ? "#1d4ed8" : "#15803d";
      const labelText = ` ${slot.label || slot.id} (z:${slot.z})`;
      const textMetrics = ctx.measureText(labelText);
      ctx.fillRect(px, py, Math.min(pw, textMetrics.width + 12), fontSize * 1.5);

      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(labelText, px + 4, py + fontSize * 0.75);

      // If selected, draw resize handles
      if (isSelected) {
        const handleRadius = Math.max(6, Math.round(canvas.width * 0.006));
        ctx.fillStyle = "#ffffff";
        ctx.strokeStyle = "#1e293b";
        ctx.lineWidth = 2;

        const handles = [
          [px, py],
          [px + pw, py],
          [px + pw, py + ph],
          [px, py + ph],
          [px + pw / 2, py],
          [px + pw / 2, py + ph],
          [px, py + ph / 2],
          [px + pw, py + ph / 2],
        ];

        for (const [hx, hy] of handles) {
          ctx.beginPath();
          ctx.arc(hx, hy, handleRadius, 0, Math.PI * 2);
          ctx.fill();
          ctx.stroke();
        }
      }
    }

    // 3. Draw active creating drag rectangle
    if (dragAction?.type === "create" && currentDragCoords) {
      const startX = dragAction.startNormX * canvas.width;
      const startY = dragAction.startNormY * canvas.height;
      const rx = Math.min(startX, currentDragCoords.x);
      const ry = Math.min(startY, currentDragCoords.y);
      const rw = Math.abs(currentDragCoords.x - startX);
      const rh = Math.abs(currentDragCoords.y - startY);

      ctx.setLineDash([8, 4]);
      ctx.lineWidth = 2;
      ctx.strokeStyle = dragAction.typeSlot === "image" ? "#2563eb" : "#16a34a";
      ctx.strokeRect(rx, ry, rw, rh);
      ctx.setLineDash([]);
    }
  }, [
    activeLayout,
    selectedSlotId,
    dragAction,
    currentDragCoords,
    cachedImages,
    viewMode,
    activeSubTab,
  ]);

  // --- 10. Live Test Preview Rendering ---
  useEffect(() => {
    if (viewMode !== "editor" || activeSubTab !== "testPreview" || !editingTemplate || !activeLayout) return;

    const layoutKey = `blank_${activeLayout.id}`;
    let blankImg = cachedImages[layoutKey];
    if (!blankImg && cachedImages["blank_default"]) {
      blankImg = cachedImages["blank_default"];
    }
    if (!blankImg || !testCanvasRef.current) return;

    // Active variant if selected
    const activeVariant =
      previewVariantIndex >= 0 && editingTemplate.variants[previewVariantIndex]
        ? editingTemplate.variants[previewVariantIndex]
        : undefined;

    // Active overlay
    const overlayImg =
      (activeLayout.overlay && cachedImages[`overlay_${activeLayout.id}`]) || null;

    renderPoster(
      {
        config: editingTemplate,
        layout: activeLayout,
        variant: activeVariant,
        blankImage: blankImg,
        overlayImage: overlayImg,
        cutouts: testCutouts,
        cutoutImage: sampleCutoutImage,
        texts: testTexts,
      },
      testCanvasRef.current
    ).catch((err) => console.error("Test preview render error:", err));
  }, [
    viewMode,
    activeSubTab,
    editingTemplate,
    activeLayout,
    previewVariantIndex,
    testCutouts,
    testTexts,
    cachedImages,
    sampleCutoutImage,
  ]);

  // --- 11. Quick Load Template Assets ---
  async function handleQuickLoadBlank() {
    if (!activeLayout) return;
    try {
      const res = await fetch("/sample-blank.png");
      const blob = await res.blob();
      const file = new File([blob], "blank.png", { type: "image/png" });
      const layoutKey = `blank_${activeLayout.id}`;
      setBlankFiles((prev) => ({ ...prev, [layoutKey]: file }));

      const img = new Image();
      img.onload = () => {
        setCachedImages((prev) => ({ ...prev, [layoutKey]: img }));
      };
      img.src = URL.createObjectURL(file);
    } catch (err) {
      console.error("Failed to quick load blank", err);
    }
  }

  // --- 12. Save Template (Schema v2) ---
  async function handleSaveTemplate() {
    if (!editingTemplate || !activeLayout) return;
    setError(null);
    setSuccess(null);
    setSaving(true);

    try {
      const formData = new FormData();
      formData.append("config", JSON.stringify(editingTemplate));

      // Append blank and overlay files
      for (const [key, file] of Object.entries(blankFiles)) {
        formData.append(key, file);
      }
      for (const [key, file] of Object.entries(overlayFiles)) {
        formData.append(key, file);
      }

      // Also ensure standard blank.png is present if first layout has one
      if (blankFiles[`blank_${editingTemplate.layouts[0]?.id}`]) {
        formData.append("blank", blankFiles[`blank_${editingTemplate.layouts[0]?.id}`]);
      }

      const res = await fetch("/api/admin/templates", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      setSuccess(`Template "${editingTemplate.name}" saved successfully!`);
      await loadTemplates();
    } catch (err: any) {
      setError(err.message || "Failed to save template");
    } finally {
      setSaving(false);
    }
  }

  const selectedSlot = activeLayout?.slots.find((s) => s.id === selectedSlotId);

  return (
    <div className="container" style={{ maxWidth: "1350px" }}>
      {/* Top Navigation */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.25rem",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h1>Admin Studio &amp; Template Manager</h1>
          <p>Create &amp; configure multiple slots, layers, layouts, variants, and text styles.</p>
        </div>

        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <Link href="/admin/settings" className="btn btn-secondary btn-sm" id="btn-admin-settings">
            ⚙️ Settings &amp; Credits
          </Link>
          <Link href="/admin/poses" className="btn btn-secondary btn-sm" id="btn-admin-poses">
            🎭 AI Poses
          </Link>
          <Link href="/admin/payments" className="btn btn-secondary btn-sm" id="btn-admin-payments">
            💳 Payments
          </Link>
          <Link href="/admin/analytics" className="btn btn-secondary btn-sm">
            📊 Analytics
          </Link>
          <Link href="/admin/reports" className="btn btn-secondary btn-sm">
            🚩 Reports
          </Link>
          <Link href="/admin/blocklist" className="btn btn-secondary btn-sm">
            🛡️ Blocklist
          </Link>
          {viewMode === "editor" ? (
            <button
              onClick={() => {
                setViewMode("list");
                window.history.pushState(null, "", "/admin");
              }}
              className="btn btn-secondary btn-sm"
            >
              &larr; Back to Templates List
            </button>
          ) : (
            <button
              onClick={() => {
                startNewTemplate();
                window.history.pushState(null, "", "/admin?mode=new");
              }}
              className="btn btn-primary btn-sm"
              id="btn-create-template"
            >
              + Create New Template
            </button>
          )}
          <button onClick={handleLogout} className="btn btn-secondary btn-sm">
            Logout
          </button>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      {/* ========================================================================= */}
      {/* VIEW MODE: TEMPLATES LIST                                                 */}
      {/* ========================================================================= */}
      {viewMode === "list" && (
        <div>
          {/* Search and Category Filter Bar */}
          <div className="card" style={{ marginBottom: "1.5rem", padding: "1rem" }}>
            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ flex: 1, minWidth: "250px" }}>
                <input
                  type="text"
                  className="form-input"
                  placeholder="🔍 Search templates by name or tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              {/* Category Filter Chips */}
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#64748b" }}>Category:</span>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    className={`filter-chip ${selectedCategory === cat ? "active" : ""}`}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {loadingList ? (
            <div className="card" style={{ textAlign: "center", padding: "2rem" }}>
              <p>Loading templates...</p>
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="card" style={{ textAlign: "center", padding: "3rem" }}>
              <h3>No templates found</h3>
              <p style={{ marginTop: "0.5rem", marginBottom: "1rem" }}>
                {searchQuery || selectedCategory !== "All"
                  ? "Try adjusting your search query or category filter."
                  : "No templates exist yet. Create your first one to get started."}
              </p>
              <button
                onClick={() => {
                  startNewTemplate();
                  window.history.pushState(null, "", "/admin?mode=new");
                }}
                className="btn btn-primary"
              >
                + Create New Template
              </button>
            </div>
          ) : (
            <div className="grid-cards">
              {filteredTemplates.map((tpl) => (
                <div key={tpl.id} className="template-card">
                  <img
                    src={`/api/templates/${tpl.id}/images/sample.png`}
                    alt={tpl.name}
                    className="template-card-img"
                    loading="lazy"
                  />
                  <div className="template-card-body">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <h3 style={{ fontSize: "1.15rem" }}>{tpl.name}</h3>
                      {tpl.category && <span className="badge badge-primary">{tpl.category}</span>}
                    </div>

                    <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
                      Layouts: {tpl.layouts?.length || 1} &middot; Slots: {tpl.layouts?.[0]?.slots?.length ?? tpl.slots?.length ?? 0}
                      {tpl.variants && tpl.variants.length > 0 && <> &middot; Variants: {tpl.variants.length}</>}
                    </div>

                    {tpl.tags && tpl.tags.length > 0 && (
                      <div style={{ display: "flex", gap: "0.25rem", flexWrap: "wrap", marginTop: "0.25rem" }}>
                        {tpl.tags.map((t) => (
                          <span key={t} className="badge" style={{ fontSize: "0.7rem" }}>
                            #{t}
                          </span>
                        ))}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: "0.4rem", marginTop: "auto", paddingTop: "0.5rem", flexWrap: "wrap" }}>
                      <button
                        onClick={() => {
                          startEditTemplate(tpl);
                          window.history.pushState(null, "", `/admin?edit=${tpl.id}`);
                        }}
                        className="btn btn-primary btn-sm"
                        style={{ flex: 1 }}
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleDuplicate(tpl.id)}
                        className="btn btn-secondary btn-sm"
                        title="Duplicate template"
                      >
                        📋 Copy
                      </button>
                      <button
                        onClick={() => handleDelete(tpl.id, tpl.name)}
                        className="btn btn-danger btn-sm"
                      >
                        🗑️
                      </button>
                      <Link
                        href={`/make/${tpl.id}`}
                        className="btn btn-secondary btn-sm"
                        title="Open in user make flow"
                      >
                        👁️
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW MODE: TEMPLATE EDITOR                                                */}
      {/* ========================================================================= */}
      {viewMode === "editor" && editingTemplate && (
        <div>
          {/* Top Metadata Bar */}
          <div className="card" style={{ marginBottom: "1rem", padding: "1rem" }}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 2fr auto", gap: "1rem", alignItems: "end" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Template Name *</label>
                <input
                  type="text"
                  className="form-input"
                  value={editingTemplate.name}
                  onChange={(e) =>
                    setEditingTemplate({ ...editingTemplate, name: e.target.value })
                  }
                  placeholder="e.g. Victory Day Poster"
                  required
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Category</label>
                <input
                  type="text"
                  list="categories-list"
                  className="form-input"
                  value={editingTemplate.category}
                  onChange={(e) =>
                    setEditingTemplate({ ...editingTemplate, category: e.target.value })
                  }
                  placeholder="e.g. National Day"
                />
                <datalist id="categories-list">
                  {categories.filter((c) => c !== "All").map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Tags (comma separated)</label>
                <input
                  type="text"
                  className="form-input"
                  value={editingTemplate.tags?.join(", ") || ""}
                  onChange={(e) =>
                    setEditingTemplate({
                      ...editingTemplate,
                      tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  placeholder="e.g. victory, celebration, red-green"
                />
              </div>

              <div>
                <button
                  type="button"
                  onClick={handleSaveTemplate}
                  className="btn btn-primary"
                  disabled={saving}
                  id="btn-save-template"
                >
                  {saving ? "Saving..." : "💾 Save Template"}
                </button>
              </div>
            </div>
          </div>

          {/* Layout Switcher Tabs */}
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1rem", flexWrap: "wrap" }}>
            <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "#475569" }}>Layouts:</span>
            {editingTemplate.layouts.map((layout, idx) => (
              <button
                key={layout.id}
                type="button"
                className={`filter-chip ${activeLayoutIndex === idx ? "active" : ""}`}
                onClick={() => {
                  setActiveLayoutIndex(idx);
                  setSelectedSlotId(editingTemplate.layouts[idx].slots[0]?.id || null);
                }}
              >
                📐 {layout.name} ({layout.width}×{layout.height})
              </button>
            ))}

            {/* Add Layout Button */}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                const count = editingTemplate.layouts.length + 1;
                const newLayout: TemplateLayout = {
                  id: `layout_${Date.now().toString().slice(-4)}`,
                  name: `Story (${count})`,
                  width: 1080,
                  height: 1920,
                  blank: "blank.png",
                  overlay: null,
                  overlayZ: 50,
                  slots: [],
                };
                setEditingTemplate({
                  ...editingTemplate,
                  layouts: [...editingTemplate.layouts, newLayout],
                });
                setActiveLayoutIndex(editingTemplate.layouts.length);
              }}
            >
              + Add Layout
            </button>
          </div>

          {/* Sub Tabs: Slots | Variants | Text Styles | Test Preview */}
          <div className="tabs-header">
            <button
              type="button"
              className={`tab-btn ${activeSubTab === "slots" ? "active" : ""}`}
              onClick={() => setActiveSubTab("slots")}
            >
              📐 Slot Geometry &amp; Canvas
            </button>
            <button
              type="button"
              className={`tab-btn ${activeSubTab === "variants" ? "active" : ""}`}
              onClick={() => setActiveSubTab("variants")}
            >
              🎨 Color Variants ({editingTemplate.variants?.length || 0})
            </button>
            <button
              type="button"
              className={`tab-btn ${activeSubTab === "styles" ? "active" : ""}`}
              onClick={() => setActiveSubTab("styles")}
            >
              🔤 Text Styles ({editingTemplate.styles?.length || 0}/5)
            </button>
            <button
              type="button"
              className={`tab-btn ${activeSubTab === "testPreview" ? "active" : ""}`}
              onClick={() => setActiveSubTab("testPreview")}
              id="tab-test-preview"
            >
              🧪 Test Live Preview
            </button>
          </div>

          {/* =================================================================== */}
          {/* SUB-TAB 1: SLOTS & CANVAS                                           */}
          {/* =================================================================== */}
          {activeSubTab === "slots" && activeLayout && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "1.5rem" }}>
              {/* Left Column: Canvas & Toolbar */}
              <div>
                {/* Toolbar */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.6rem 0.85rem",
                    backgroundColor: "#f1f5f9",
                    borderRadius: "6px",
                    marginBottom: "0.75rem",
                    flexWrap: "wrap",
                    gap: "0.5rem",
                  }}
                >
                  <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                    <button
                      type="button"
                      className={`btn btn-sm ${activeTool === "select" ? "btn-primary" : "btn-secondary"}`}
                      onClick={() => setActiveTool("select")}
                      title="Select and drag existing slots"
                    >
                      👆 Select / Move
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${activeTool === "photo" ? "btn-primary" : "btn-secondary"}`}
                      onClick={() => setActiveTool("photo")}
                      id="btn-add-photo-slot"
                      title="Draw a new photo slot on canvas"
                    >
                      📷 + Photo Slot
                    </button>
                    <button
                      type="button"
                      className={`btn btn-sm ${activeTool === "text" ? "btn-primary" : "btn-secondary"}`}
                      onClick={() => setActiveTool("text")}
                      id="btn-add-text-slot"
                      title="Draw a new text slot on canvas"
                    >
                      ✏️ + Text Slot
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.85rem", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={snapToGrid}
                        onChange={(e) => setSnapToGrid(e.target.checked)}
                      />
                      🧲 Snap to 2% Grid
                    </label>

                    {selectedSlotId && (
                      <button
                        type="button"
                        onClick={deleteSelectedSlot}
                        className="btn btn-danger btn-sm"
                        title="Delete selected slot (or press Delete key)"
                      >
                        🗑️ Delete Slot
                      </button>
                    )}
                  </div>
                </div>

                {/* Canvas Container */}
                <div
                  style={{
                    backgroundColor: "#334155",
                    padding: "1rem",
                    borderRadius: "8px",
                    textAlign: "center",
                    position: "relative",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", color: "#cbd5e1", fontSize: "0.8rem", marginBottom: "0.5rem" }}>
                    <span>
                      {selectedSlotId
                        ? `Selected: ${selectedSlot?.label} · Arrow keys: nudge 1px (Shift: 10px)`
                        : activeTool === "select"
                        ? "Click a slot to select, drag to move, drag white handles to resize"
                        : `Click and drag to draw a new ${activeTool.toUpperCase()} slot`}
                    </span>
                    <span>
                      {activeLayout.width} × {activeLayout.height} px
                    </span>
                  </div>

                  <div className="admin-canvas-wrapper">
                    <canvas
                      ref={canvasRef}
                      className="admin-canvas"
                      onMouseDown={handleMouseDown}
                      onMouseMove={handleMouseMove}
                      onMouseUp={handleMouseUp}
                    />
                  </div>
                </div>

                {/* Layout Assets Upload Bar */}
                <div className="card" style={{ marginTop: "1rem", padding: "0.85rem" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "1rem", alignItems: "end" }}>
                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: "0.85rem" }}>
                        Blank Template Image ({activeLayout.name})
                      </label>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="form-input"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const key = `blank_${activeLayout.id}`;
                          setBlankFiles((prev) => ({ ...prev, [key]: file }));
                          const img = new Image();
                          img.onload = () => setCachedImages((prev) => ({ ...prev, [key]: img }));
                          img.src = URL.createObjectURL(file);
                        }}
                      />
                    </div>

                    <div className="form-group" style={{ margin: 0 }}>
                      <label className="form-label" style={{ fontSize: "0.85rem" }}>
                        Overlay Image (Optional PNG)
                      </label>
                      <input
                        type="file"
                        accept="image/png,image/webp"
                        className="form-input"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const key = `overlay_${activeLayout.id}`;
                          setOverlayFiles((prev) => ({ ...prev, [key]: file }));
                          const img = new Image();
                          img.onload = () => setCachedImages((prev) => ({ ...prev, [key]: img }));
                          img.src = URL.createObjectURL(file);
                        }}
                      />
                    </div>

                    <button
                      type="button"
                      onClick={handleQuickLoadBlank}
                      className="btn btn-secondary btn-sm"
                      title="Load sample template blank"
                    >
                      🖼️ Quick Sample
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Column: Slot Inspector & Layer Manager */}
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {/* Slot Inspector */}
                <div className="card" style={{ padding: "1rem" }}>
                  <h3 style={{ fontSize: "1rem", marginBottom: "0.75rem", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.4rem" }}>
                    {selectedSlot ? `⚙️ Settings: ${selectedSlot.label}` : "⚙️ Slot Inspector"}
                  </h3>

                  {selectedSlot ? (
                    <div>
                      {/* Common fields */}
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: "0.8rem" }}>Slot Label</label>
                        <input
                          type="text"
                          className="form-input"
                          value={selectedSlot.label}
                          onChange={(e) => updateSelectedSlot((s) => ({ ...s, label: e.target.value }))}
                        />
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.75rem", fontSize: "0.8rem", color: "#64748b" }}>
                        <div>X: {selectedSlot.x}</div>
                        <div>Y: {selectedSlot.y}</div>
                        <div>W: {selectedSlot.w}</div>
                        <div>H: {selectedSlot.h}</div>
                      </div>

                      {/* Image Slot Settings */}
                      {selectedSlot.type === "image" && (
                        <div>
                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: "0.8rem" }}>Anchor</label>
                            <select
                              className="form-select"
                              value={selectedSlot.anchor}
                              onChange={(e) =>
                                updateSelectedSlot((s) => ({
                                  ...s,
                                  anchor: e.target.value as "bottom" | "center",
                                }))
                              }
                            >
                              <option value="bottom">Bottom (Default)</option>
                              <option value="center">Center</option>
                            </select>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: "0.8rem" }}>Min Zoom</label>
                              <input
                                type="number"
                                step="0.05"
                                className="form-input"
                                value={selectedSlot.minZoom}
                                onChange={(e) =>
                                  updateSelectedSlot((s) => ({ ...s, minZoom: Number(e.target.value) }))
                                }
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: "0.8rem" }}>Max Zoom</label>
                              <input
                                type="number"
                                step="0.05"
                                className="form-input"
                                value={selectedSlot.maxZoom}
                                onChange={(e) =>
                                  updateSelectedSlot((s) => ({ ...s, maxZoom: Number(e.target.value) }))
                                }
                              />
                            </div>
                          </div>

                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: "0.8rem" }}>Max Offset (e.g. 0.30 for 30%)</label>
                            <input
                              type="number"
                              step="0.05"
                              min="0.05"
                              max="1.0"
                              className="form-input"
                              value={selectedSlot.maxOffset ?? 0.3}
                              onChange={(e) =>
                                updateSelectedSlot((s) => ({ ...s, maxOffset: Number(e.target.value) }))
                              }
                            />
                          </div>

                          <div style={{ display: "flex", gap: "1rem", marginTop: "0.5rem" }}>
                            <label style={{ fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                              <input
                                type="checkbox"
                                checked={selectedSlot.allowAdjust}
                                onChange={(e) =>
                                  updateSelectedSlot((s) => ({ ...s, allowAdjust: e.target.checked }))
                                }
                              />
                              Allow Adjust
                            </label>
                            <label style={{ fontSize: "0.8rem", display: "flex", alignItems: "center", gap: "0.3rem" }}>
                              <input
                                type="checkbox"
                                checked={selectedSlot.required}
                                onChange={(e) =>
                                  updateSelectedSlot((s) => ({ ...s, required: e.target.checked }))
                                }
                              />
                              Required
                            </label>
                          </div>

                          {/* Allowed AI Poses */}
                          <div style={{ marginTop: "0.8rem", borderTop: "1px solid #eee", paddingTop: "0.6rem" }}>
                            <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                              Allowed AI Poses (Leave empty to allow all active poses)
                            </label>
                            {availablePoses.length === 0 ? (
                              <p style={{ fontSize: "0.75rem", color: "#888", margin: 0 }}>
                                No poses created yet. Add poses in AI Poses admin.
                              </p>
                            ) : (
                              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem", marginTop: "0.3rem" }}>
                                {availablePoses.map((p) => {
                                  const isAllowed = selectedSlot.allowedPoses?.includes(p.id) || false;
                                  return (
                                    <label
                                      key={p.id}
                                      style={{
                                        fontSize: "0.75rem",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "0.25rem",
                                        background: isAllowed ? "#e8f0fe" : "#f8f9fa",
                                        padding: "3px 6px",
                                        borderRadius: 4,
                                        border: `1px solid ${isAllowed ? "#1a73e8" : "#ddd"}`,
                                        cursor: "pointer",
                                      }}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isAllowed}
                                        onChange={(e) => {
                                          const current = selectedSlot.allowedPoses || [];
                                          const updated = e.target.checked
                                            ? [...current, p.id]
                                            : current.filter((id) => id !== p.id);
                                          updateSelectedSlot((s) => ({ ...s, allowedPoses: updated }));
                                        }}
                                      />
                                      {p.name}
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Text Slot Settings */}
                      {selectedSlot.type === "text" && (
                        <div>
                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: "0.8rem" }}>Font</label>
                            <select
                              className="form-select"
                              value={selectedSlot.font}
                              onChange={(e) =>
                                updateSelectedSlot((s) => ({ ...s, font: e.target.value }))
                              }
                            >
                              {AVAILABLE_FONTS.map((font) => (
                                <option key={font} value={font}>
                                  {font}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "0.75rem" }}>
                            <div style={{ flex: 1 }}>
                              <label className="form-label" style={{ fontSize: "0.8rem" }}>Text Color</label>
                              <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                                <input
                                  type="color"
                                  value={selectedSlot.color}
                                  onChange={(e) =>
                                    updateSelectedSlot((s) => ({ ...s, color: e.target.value }))
                                  }
                                  style={{ width: "32px", height: "32px", border: "none", cursor: "pointer" }}
                                />
                                <input
                                  type="text"
                                  className="form-input"
                                  value={selectedSlot.color}
                                  onChange={(e) =>
                                    updateSelectedSlot((s) => ({ ...s, color: e.target.value }))
                                  }
                                />
                              </div>
                            </div>

                            <div>
                              <label className="form-label" style={{ fontSize: "0.8rem" }}>Align</label>
                              <select
                                className="form-select"
                                value={selectedSlot.align}
                                onChange={(e) =>
                                  updateSelectedSlot((s) => ({
                                    ...s,
                                    align: e.target.value as "left" | "center" | "right",
                                  }))
                                }
                              >
                                <option value="left">Left</option>
                                <option value="center">Center</option>
                                <option value="right">Right</option>
                              </select>
                            </div>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: "0.8rem" }}>Max Chars</label>
                              <input
                                type="number"
                                className="form-input"
                                value={selectedSlot.maxChars}
                                onChange={(e) =>
                                  updateSelectedSlot((s) => ({ ...s, maxChars: Number(e.target.value) }))
                                }
                              />
                            </div>
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: "0.8rem" }}>Max Lines</label>
                              <input
                                type="number"
                                min={1}
                                max={4}
                                className="form-input"
                                value={selectedSlot.maxLines}
                                onChange={(e) =>
                                  updateSelectedSlot((s) => ({ ...s, maxLines: Number(e.target.value) }))
                                }
                              />
                            </div>
                          </div>

                          <div className="form-group">
                            <label className="form-label" style={{ fontSize: "0.8rem" }}>Min Font Size (px)</label>
                            <input
                              type="number"
                              className="form-input"
                              value={selectedSlot.minFontSize}
                              onChange={(e) =>
                                updateSelectedSlot((s) => ({ ...s, minFontSize: Number(e.target.value) }))
                              }
                            />
                          </div>

                          {/* Text Style dropdown */}
                          {editingTemplate.styles?.length > 0 && (
                            <div className="form-group">
                              <label className="form-label" style={{ fontSize: "0.8rem" }}>Text Style</label>
                              <select
                                className="form-select"
                                value={selectedSlot.styleId || ""}
                                onChange={(e) =>
                                  updateSelectedSlot((s) => ({ ...s, styleId: e.target.value || undefined }))
                                }
                              >
                                <option value="">None (Custom)</option>
                                {editingTemplate.styles.map((st) => (
                                  <option key={st.id} value={st.id}>
                                    {st.name} ({st.font})
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}

                          {/* User Text Styling Permissions & Controls */}
                          <div style={{ marginTop: "1rem", paddingTop: "0.75rem", borderTop: "1px solid #e2e8f0" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                              <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1e293b", margin: 0 }}>
                                🎨 User Text Styling
                              </label>
                              <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", cursor: "pointer" }}>
                                <input
                                  type="checkbox"
                                  checked={selectedSlot.allowStyling !== false}
                                  onChange={(e) =>
                                    updateSelectedSlot((s) => ({ ...s, allowStyling: e.target.checked }))
                                  }
                                />
                                Allow User Styling
                              </label>
                            </div>

                            {selectedSlot.allowStyling !== false && (
                              <div style={{ background: "#f8fafc", padding: "0.75rem", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                                {/* Boolean feature permissions */}
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", marginBottom: "0.75rem" }}>
                                  <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8rem", cursor: "pointer" }}>
                                    <input
                                      type="checkbox"
                                      checked={selectedSlot.allowOutline !== false}
                                      onChange={(e) =>
                                        updateSelectedSlot((s) => ({ ...s, allowOutline: e.target.checked }))
                                      }
                                    />
                                    Allow Outline
                                  </label>

                                  <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8rem", cursor: "pointer" }}>
                                    <input
                                      type="checkbox"
                                      checked={selectedSlot.allowShadow !== false}
                                      onChange={(e) =>
                                        updateSelectedSlot((s) => ({ ...s, allowShadow: e.target.checked }))
                                      }
                                    />
                                    Allow Shadow
                                  </label>

                                  <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8rem", cursor: "pointer" }}>
                                    <input
                                      type="checkbox"
                                      checked={selectedSlot.allowSizeAdjust !== false}
                                      onChange={(e) =>
                                        updateSelectedSlot((s) => ({ ...s, allowSizeAdjust: e.target.checked }))
                                      }
                                    />
                                    Allow Size Adjust
                                  </label>

                                  <label style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.8rem", cursor: "pointer" }}>
                                    <input
                                      type="checkbox"
                                      checked={selectedSlot.allowCustomColor !== false}
                                      onChange={(e) =>
                                        updateSelectedSlot((s) => ({ ...s, allowCustomColor: e.target.checked }))
                                      }
                                    />
                                    Allow Custom Color
                                  </label>
                                </div>

                                {/* Allowed Fonts (Multi-select) */}
                                <div style={{ marginBottom: "0.75rem" }}>
                                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#475569", marginBottom: "0.3rem" }}>
                                    Allowed Fonts ({((selectedSlot.allowedFonts || AVAILABLE_FONTS) as string[]).length}/{AVAILABLE_FONTS.length})
                                  </label>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                                    {AVAILABLE_FONTS.map((font) => {
                                      const curFonts = (selectedSlot.allowedFonts || AVAILABLE_FONTS) as string[];
                                      const isAllowed = curFonts.includes(font);
                                      return (
                                        <button
                                          key={font}
                                          type="button"
                                          onClick={() => {
                                            const nextFonts = isAllowed
                                              ? curFonts.filter((f) => f !== font)
                                              : [...curFonts, font];
                                            updateSelectedSlot((s) => ({
                                              ...s,
                                              allowedFonts: nextFonts.length > 0 ? nextFonts : [font],
                                            }));
                                          }}
                                          style={{
                                            fontSize: "0.75rem",
                                            padding: "0.2rem 0.5rem",
                                            borderRadius: "4px",
                                            border: isAllowed ? "1px solid #10b981" : "1px solid #cbd5e1",
                                            background: isAllowed ? "#ecfdf5" : "#ffffff",
                                            color: isAllowed ? "#047857" : "#64748b",
                                            cursor: "pointer",
                                            fontWeight: isAllowed ? 700 : 400,
                                          }}
                                        >
                                          {isAllowed ? "✓ " : ""}{font}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Allowed Colors (Editable list) */}
                                <div style={{ marginBottom: "0.75rem" }}>
                                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#475569", marginBottom: "0.3rem" }}>
                                    Allowed Colors ({(selectedSlot.allowedColors || DEFAULT_ALLOWED_COLORS).length})
                                  </label>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center", marginBottom: "0.4rem" }}>
                                    {(selectedSlot.allowedColors || DEFAULT_ALLOWED_COLORS).map((color, cIdx) => (
                                      <div
                                        key={cIdx}
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "0.25rem",
                                          background: "#ffffff",
                                          border: "1px solid #cbd5e1",
                                          borderRadius: "4px",
                                          padding: "0.15rem 0.35rem",
                                          fontSize: "0.75rem",
                                        }}
                                      >
                                        <span
                                          style={{
                                            width: 12,
                                            height: 12,
                                            borderRadius: "50%",
                                            background: color,
                                            border: "1px solid rgba(0,0,0,0.2)",
                                          }}
                                        />
                                        <span>{color}</span>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const curColors = selectedSlot.allowedColors || DEFAULT_ALLOWED_COLORS;
                                            if (curColors.length > 1) {
                                              updateSelectedSlot((s) => ({
                                                ...s,
                                                allowedColors: curColors.filter((_, idx) => idx !== cIdx),
                                              }));
                                            }
                                          }}
                                          style={{
                                            border: "none",
                                            background: "none",
                                            color: "#94a3b8",
                                            cursor: "pointer",
                                            padding: 0,
                                            fontSize: "0.8rem",
                                            lineHeight: 1,
                                          }}
                                          title="Remove color"
                                        >
                                          ×
                                        </button>
                                      </div>
                                    ))}
                                  </div>
                                  <div style={{ display: "flex", gap: "0.35rem", alignItems: "center" }}>
                                    <input
                                      type="color"
                                      defaultValue="#FF0000"
                                      id={`new_color_${selectedSlot.id}`}
                                      style={{ width: "26px", height: "26px", border: "none", cursor: "pointer" }}
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const picker = document.getElementById(`new_color_${selectedSlot.id}`) as HTMLInputElement | null;
                                        if (picker && picker.value) {
                                          const curColors = selectedSlot.allowedColors || DEFAULT_ALLOWED_COLORS;
                                          if (!curColors.includes(picker.value.toUpperCase())) {
                                            updateSelectedSlot((s) => ({
                                              ...s,
                                              allowedColors: [...curColors, picker.value.toUpperCase()],
                                            }));
                                          }
                                        }
                                      }}
                                      style={{
                                        fontSize: "0.75rem",
                                        padding: "0.2rem 0.5rem",
                                        background: "#e2e8f0",
                                        border: "none",
                                        borderRadius: "4px",
                                        cursor: "pointer",
                                      }}
                                    >
                                      + Add Color
                                    </button>
                                  </div>
                                </div>

                                {/* Offered Quick Style Presets */}
                                <div>
                                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#475569", marginBottom: "0.3rem" }}>
                                    Offered Quick Presets
                                  </label>
                                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                                    {USER_TEXT_STYLE_PRESETS.map((preset) => {
                                      const curOffered = selectedSlot.offeredPresets || USER_TEXT_STYLE_PRESETS.map((p) => p.id);
                                      const isOffered = curOffered.includes(preset.id);
                                      return (
                                        <button
                                          key={preset.id}
                                          type="button"
                                          onClick={() => {
                                            const nextOffered = isOffered
                                              ? curOffered.filter((id) => id !== preset.id)
                                              : [...curOffered, preset.id];
                                            updateSelectedSlot((s) => ({
                                              ...s,
                                              offeredPresets: nextOffered,
                                            }));
                                          }}
                                          style={{
                                            fontSize: "0.72rem",
                                            padding: "0.2rem 0.45rem",
                                            borderRadius: "4px",
                                            border: isOffered ? "1px solid #3b82f6" : "1px solid #cbd5e1",
                                            background: isOffered ? "#eff6ff" : "#ffffff",
                                            color: isOffered ? "#1d4ed8" : "#64748b",
                                            cursor: "pointer",
                                            fontWeight: isOffered ? 700 : 400,
                                          }}
                                        >
                                          {isOffered ? "✓ " : ""}{preset.nameEn}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p style={{ fontSize: "0.85rem", color: "#64748b" }}>
                      Select a slot on the canvas to configure its settings.
                    </p>
                  )}
                </div>

                {/* Layer Order (Z-order) */}
                <div className="card" style={{ padding: "1rem" }}>
                  <h3 style={{ fontSize: "1rem", marginBottom: "0.75rem", borderBottom: "1px solid #e2e8f0", paddingBottom: "0.4rem" }}>
                    📚 Layer Order (Z-Index)
                  </h3>

                  {activeLayout.slots.length === 0 ? (
                    <p style={{ fontSize: "0.85rem", color: "#64748b" }}>No slots added yet.</p>
                  ) : (
                    <div>
                      {(() => {
                        const unifiedLayers = [
                          ...activeLayout.slots.map((s) => ({
                            id: s.id,
                            type: "slot" as const,
                            label: s.label,
                            z: s.z,
                            slot: s,
                          })),
                          {
                            id: "__overlay__",
                            type: "overlay" as const,
                            label: "Overlay Layer",
                            z: activeLayout.overlayZ ?? 50,
                          },
                        ].sort((a, b) => b.z - a.z);

                        return unifiedLayers.map((layer, idx) => {
                          const isSelected = layer.type === "slot" && layer.id === selectedSlotId;
                          const isOverlay = layer.type === "overlay";

                          return (
                            <div
                              key={layer.id}
                              className={`layer-row ${isSelected ? "selected" : ""}`}
                              style={isOverlay ? { borderStyle: "dashed", backgroundColor: "#f8fafc" } : undefined}
                              onClick={() => {
                                if (!isOverlay) setSelectedSlotId(layer.id);
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                                <span>{isOverlay ? "🖼️" : (layer.slot?.type === "image" ? "📷" : "✏️")}</span>
                                <span style={{ fontSize: "0.85rem", fontWeight: isSelected ? 600 : 400 }}>{layer.label}</span>
                              </div>

                              <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                                <input
                                  type="number"
                                  style={{ width: "50px", padding: "0.15rem 0.25rem", fontSize: "0.75rem", textAlign: "center" }}
                                  value={layer.z}
                                  onChange={(e) => {
                                    const val = Number(e.target.value);
                                    applyLayerZ(layer.id, val);
                                  }}
                                  title="Numeric z-index"
                                />
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: "0.15rem 0.4rem" }}
                                  disabled={idx === 0}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    moveLayer(layer.id, "up");
                                  }}
                                  title="Bring forward (increase z)"
                                >
                                  ▲
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  style={{ padding: "0.15rem 0.4rem" }}
                                  disabled={idx === unifiedLayers.length - 1}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    moveLayer(layer.id, "down");
                                  }}
                                  title="Send backward (decrease z)"
                                >
                                  ▼
                                </button>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* =================================================================== */}
          {/* SUB-TAB 2: COLOR VARIANTS                                           */}
          {/* =================================================================== */}
          {activeSubTab === "variants" && (
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
                <div>
                  <h3>Color Variants</h3>
                  <p style={{ fontSize: "0.85rem" }}>
                    Variants reuse the same slot geometries, but let you swap blank/overlay images and override text slot colors.
                  </p>
                </div>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    const count = (editingTemplate.variants?.length || 0) + 1;
                    const newVariant: TemplateVariant = {
                      id: `variant_${Date.now().toString().slice(-4)}`,
                      name: `Variant ${count} (Gold)`,
                      textColors: {},
                    };
                    setEditingTemplate({
                      ...editingTemplate,
                      variants: [...(editingTemplate.variants || []), newVariant],
                    });
                  }}
                >
                  + Add Color Variant
                </button>
              </div>

              {(!editingTemplate.variants || editingTemplate.variants.length === 0) ? (
                <div style={{ textAlign: "center", padding: "2rem", color: "#64748b" }}>
                  <p>No color variants added yet. Click &quot;+ Add Color Variant&quot; to create one.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                  {editingTemplate.variants.map((variant, vIdx) => (
                    <div
                      key={variant.id}
                      style={{
                        padding: "1rem",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        backgroundColor: "#f8fafc",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                          <span style={{ fontWeight: 600 }}>Variant Name:</span>
                          <input
                            type="text"
                            className="form-input"
                            style={{ width: "220px", padding: "0.3rem 0.5rem" }}
                            value={variant.name}
                            onChange={(e) => {
                              const updated = [...editingTemplate.variants];
                              updated[vIdx].name = e.target.value;
                              setEditingTemplate({ ...editingTemplate, variants: updated });
                            }}
                          />
                        </div>

                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => {
                            const updated = editingTemplate.variants.filter((_, idx) => idx !== vIdx);
                            setEditingTemplate({ ...editingTemplate, variants: updated });
                          }}
                        >
                          Delete Variant
                        </button>
                      </div>

                      {/* Text Colors overrides for this variant */}
                      <h4 style={{ fontSize: "0.85rem", color: "#475569", marginBottom: "0.5rem" }}>
                        Text Slot Color Overrides:
                      </h4>
                      <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap" }}>
                        {activeLayout?.slots
                          .filter((s) => s.type === "text")
                          .map((ts) => {
                            const currentColor = variant.textColors[ts.id] || (ts as TextSlot).color;
                            return (
                              <div key={ts.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <span style={{ fontSize: "0.85rem" }}>{ts.label}:</span>
                                <input
                                  type="color"
                                  value={currentColor}
                                  onChange={(e) => {
                                    const updated = [...editingTemplate.variants];
                                    updated[vIdx].textColors = {
                                      ...updated[vIdx].textColors,
                                      [ts.id]: e.target.value,
                                    };
                                    setEditingTemplate({ ...editingTemplate, variants: updated });
                                  }}
                                  style={{ width: "28px", height: "28px", border: "none", cursor: "pointer" }}
                                />
                                <span style={{ fontSize: "0.8rem", color: "#64748b" }}>{currentColor}</span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* =================================================================== */}
          {/* SUB-TAB 3: TEXT STYLES (UP TO 5)                                    */}
          {/* =================================================================== */}
          {activeSubTab === "styles" && (
            <div className="card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem", flexWrap: "wrap", gap: "1rem" }}>
                <div>
                  <h3 style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span>টেক্সট স্টাইল ও আউটলাইন এডিটর</span>
                    <span style={{ fontSize: "0.85rem", fontWeight: 500, color: "var(--text-muted)" }}>
                      ({editingTemplate.styles?.length || 0}/5)
                    </span>
                  </h3>
                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                    ফন্ট, ফিল কালার, ইনার আউটলাইন, অপশনাল আউটার আউটলাইন ও শ্যাডো কাস্টমাইজ করুন।
                  </p>
                </div>

                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    disabled={(editingTemplate.styles?.length || 0) >= 5}
                    onClick={() => {
                      const count = (editingTemplate.styles?.length || 0) + 1;
                      const newStyle: TextStyle = {
                        id: `style_${Date.now().toString().slice(-4)}_${count}`,
                        name: `Style ${count}`,
                        font: "Baloo Da 2",
                        fill: "#FFFFFF",
                        color: "#FFFFFF",
                        outlineColor: "#D62839",
                        outlineWidthRatio: 0.08,
                        shadow: {
                          color: "rgba(0,0,0,0.35)",
                          blur: 8,
                          offsetX: 0,
                          offsetY: 4,
                        },
                      };
                      setEditingTemplate({
                        ...editingTemplate,
                        styles: [...(editingTemplate.styles || []), newStyle],
                      });
                    }}
                  >
                    + Add New Style
                  </button>
                </div>
              </div>

              {/* Ready-Made Presets Bar */}
              <div
                style={{
                  background: "var(--bg)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  padding: "0.85rem 1rem",
                  marginBottom: "1.5rem",
                }}
              >
                <div style={{ fontSize: "0.85rem", fontWeight: 700, marginBottom: "0.5rem", color: "var(--text)" }}>
                  ⚡ রেডিমেড ৪টি প্রিসেট (4 Ready-Made Presets — ক্লিক করে নতুন স্টাইল যোগ করুন):
                </div>
                <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                  {TEXT_STYLE_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      className="btn btn-outline btn-sm"
                      disabled={(editingTemplate.styles?.length || 0) >= 5}
                      style={{
                        fontSize: "0.8rem",
                        padding: "0.35rem 0.75rem",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.4rem",
                      }}
                      onClick={() => {
                        if ((editingTemplate.styles?.length || 0) >= 5) return;
                        const count = (editingTemplate.styles?.length || 0) + 1;
                        const newStyle: TextStyle = {
                          id: `style_${Date.now().toString().slice(-4)}_${count}`,
                          name: preset.name,
                          ...preset.style,
                        };
                        setEditingTemplate({
                          ...editingTemplate,
                          styles: [...(editingTemplate.styles || []), newStyle],
                        });
                      }}
                    >
                      <span
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          background: preset.style.fill || "#FFFFFF",
                          border: `2px solid ${preset.style.outlineColor || "#000000"}`,
                          display: "inline-block",
                        }}
                      />
                      <span>+ {preset.name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {(!editingTemplate.styles || editingTemplate.styles.length === 0) ? (
                <div style={{ textAlign: "center", padding: "2.5rem 1rem", color: "var(--text-muted)", background: "var(--bg)", borderRadius: "var(--radius-md)" }}>
                  <p style={{ fontWeight: 600, fontSize: "1rem", marginBottom: "0.5rem" }}>কোনো টেক্সট স্টাইল তৈরি করা হয়নি।</p>
                  <p style={{ fontSize: "0.85rem" }}>উপরে দেওয়া রেডিমেড প্রিসেটে ক্লিক করুন বা &quot;+ Add New Style&quot; বাটনে চাপুন।</p>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))", gap: "1.25rem" }}>
                  {editingTemplate.styles.map((st, sIdx) => {
                    const currentFill = st.fill || st.color || "#FFFFFF";
                    const currentOutline = st.outlineColor || st.strokeColor || "#D62839";
                    const currentRatio = st.outlineWidthRatio ?? (st.strokeWidth ? st.strokeWidth / 48 : 0.08);
                    const hasOutline2 = Boolean(st.outline2Color && (st.outline2WidthRatio ?? 0) > 0);
                    const currentOutline2 = st.outline2Color || "#0A5F41";
                    const currentRatio2 = st.outline2WidthRatio ?? 0.14;
                    const shadowObj = st.shadow || (st.shadowColor ? {
                      color: st.shadowColor,
                      blur: st.shadowBlur ?? 8,
                      offsetX: st.shadowOffsetX ?? 0,
                      offsetY: st.shadowOffsetY ?? 4,
                    } : undefined);
                    const hasShadow = Boolean(shadowObj?.color && ((shadowObj.blur ?? 0) > 0 || (shadowObj.offsetX ?? 0) !== 0 || (shadowObj.offsetY ?? 0) !== 0));

                    const updateCurrentStyle = (patch: Partial<TextStyle>) => {
                      const updated = [...editingTemplate.styles];
                      const cur = updated[sIdx];
                      const newFill = patch.fill !== undefined ? patch.fill : (patch.color !== undefined ? patch.color : cur.fill || cur.color);
                      updated[sIdx] = {
                        ...cur,
                        ...patch,
                        fill: newFill,
                        color: newFill,
                      };
                      setEditingTemplate({ ...editingTemplate, styles: updated });
                    };

                    return (
                      <div
                        key={st.id}
                        style={{
                          padding: "1.25rem",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-lg)",
                          backgroundColor: "var(--surface)",
                          boxShadow: "var(--shadow-sm)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.85rem",
                        }}
                      >
                        {/* Header: Name & Delete */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                          <input
                            type="text"
                            className="form-input"
                            style={{ fontWeight: 700, fontSize: "0.95rem" }}
                            value={st.name}
                            onChange={(e) => updateCurrentStyle({ name: e.target.value })}
                          />
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            title="Delete style"
                            onClick={() => {
                              const updated = editingTemplate.styles.filter((_, idx) => idx !== sIdx);
                              setEditingTemplate({ ...editingTemplate, styles: updated });
                            }}
                          >
                            ✕
                          </button>
                        </div>

                        {/* Apply Preset Quick Chips */}
                        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap", fontSize: "0.75rem" }}>
                          <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>প্রিসেট প্রয়োগ:</span>
                          {TEXT_STYLE_PRESETS.map((p) => (
                            <button
                              key={p.name}
                              type="button"
                              onClick={() => updateCurrentStyle({ ...p.style })}
                              style={{
                                background: "var(--bg)",
                                border: "1px solid var(--border)",
                                borderRadius: "var(--radius-sm)",
                                padding: "2px 6px",
                                fontSize: "0.7rem",
                                cursor: "pointer",
                                color: "var(--text)",
                              }}
                            >
                              {p.name.split(" ")[0]}
                            </button>
                          ))}
                        </div>

                        {/* 1. Font Picker */}
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600 }}>ফন্ট (Font)</label>
                          <select
                            className="form-select"
                            value={st.font || "Baloo Da 2"}
                            onChange={(e) => updateCurrentStyle({ font: e.target.value })}
                          >
                            {AVAILABLE_FONTS.map((f) => (
                              <option key={f} value={f}>{f}</option>
                            ))}
                          </select>
                        </div>

                        {/* 2. Fill Color */}
                        <div className="form-group" style={{ marginBottom: 0 }}>
                          <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 600 }}>ফিল কালার (Fill Color)</label>
                          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                            <input
                              type="color"
                              value={currentFill}
                              onChange={(e) => updateCurrentStyle({ fill: e.target.value, color: e.target.value })}
                              style={{ width: "36px", height: "36px", borderRadius: "6px", border: "1px solid var(--border)", cursor: "pointer" }}
                            />
                            <input
                              type="text"
                              className="form-input"
                              style={{ flex: 1, fontFamily: "monospace" }}
                              value={currentFill}
                              onChange={(e) => updateCurrentStyle({ fill: e.target.value, color: e.target.value })}
                            />
                          </div>
                        </div>

                        {/* 3. Primary Outline (Inner Stroke) */}
                        <div style={{ background: "var(--bg)", padding: "0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                          <label className="form-label" style={{ fontSize: "0.8rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                            ১ম আউটলাইন / ইনার স্ট্রোক (Outline 1)
                          </label>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
                            <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                              <input
                                type="color"
                                value={currentOutline}
                                onChange={(e) => updateCurrentStyle({ outlineColor: e.target.value, strokeColor: e.target.value })}
                                style={{ width: "32px", height: "32px", borderRadius: "4px", border: "1px solid var(--border)", cursor: "pointer" }}
                              />
                              <input
                                type="text"
                                className="form-input"
                                style={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                                value={currentOutline}
                                onChange={(e) => updateCurrentStyle({ outlineColor: e.target.value, strokeColor: e.target.value })}
                              />
                            </div>
                            <div style={{ fontSize: "0.8rem", textAlign: "right", color: "var(--text-muted)" }}>
                              প্রস্থ: <strong>{Math.round(currentRatio * 100)}%</strong> of font
                            </div>
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="0.20"
                            step="0.01"
                            value={currentRatio}
                            onChange={(e) => updateCurrentStyle({ outlineWidthRatio: Number(e.target.value) })}
                            style={{ width: "100%" }}
                          />
                        </div>

                        {/* 4. Secondary Outline (Outer Stroke) */}
                        <div style={{ background: "var(--bg)", padding: "0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                            <label style={{ fontSize: "0.8rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                              <input
                                type="checkbox"
                                checked={hasOutline2}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    updateCurrentStyle({
                                      outline2Color: currentOutline2,
                                      outline2WidthRatio: 0.14,
                                    });
                                  } else {
                                    updateCurrentStyle({
                                      outline2Color: undefined,
                                      outline2WidthRatio: 0,
                                    });
                                  }
                                }}
                              />
                              <span>২য় আউটলাইন / আউটার স্ট্রোক (2nd Outline)</span>
                            </label>
                          </div>

                          {hasOutline2 && (
                            <div>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem", alignItems: "center", marginBottom: "0.5rem" }}>
                                <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                                  <input
                                    type="color"
                                    value={currentOutline2}
                                    onChange={(e) => updateCurrentStyle({ outline2Color: e.target.value })}
                                    style={{ width: "32px", height: "32px", borderRadius: "4px", border: "1px solid var(--border)", cursor: "pointer" }}
                                  />
                                  <input
                                    type="text"
                                    className="form-input"
                                    style={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                                    value={currentOutline2}
                                    onChange={(e) => updateCurrentStyle({ outline2Color: e.target.value })}
                                  />
                                </div>
                                <div style={{ fontSize: "0.8rem", textAlign: "right", color: "var(--text-muted)" }}>
                                  প্রস্থ: <strong>{Math.round(currentRatio2 * 100)}%</strong> of font
                                </div>
                              </div>
                              <input
                                type="range"
                                min="0.02"
                                max="0.30"
                                step="0.01"
                                value={currentRatio2}
                                onChange={(e) => updateCurrentStyle({ outline2WidthRatio: Number(e.target.value) })}
                                style={{ width: "100%" }}
                              />
                            </div>
                          )}
                        </div>

                        {/* 5. Shadow */}
                        <div style={{ background: "var(--bg)", padding: "0.75rem", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                            <label style={{ fontSize: "0.8rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
                              <input
                                type="checkbox"
                                checked={hasShadow}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    updateCurrentStyle({
                                      shadow: {
                                        color: "rgba(0,0,0,0.4)",
                                        blur: 8,
                                        offsetX: 0,
                                        offsetY: 4,
                                      },
                                    });
                                  } else {
                                    updateCurrentStyle({
                                      shadow: undefined,
                                      shadowColor: undefined,
                                      shadowBlur: 0,
                                    });
                                  }
                                }}
                              />
                              <span>ড্রপ শ্যাডো (Drop Shadow)</span>
                            </label>
                          </div>

                          {hasShadow && (
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: "0.75rem" }}>Color</label>
                                <input
                                  type="text"
                                  className="form-input"
                                  style={{ fontFamily: "monospace", fontSize: "0.8rem" }}
                                  value={shadowObj?.color || "rgba(0,0,0,0.4)"}
                                  onChange={(e) =>
                                    updateCurrentStyle({
                                      shadow: {
                                        color: e.target.value,
                                        blur: shadowObj?.blur ?? 8,
                                        offsetX: shadowObj?.offsetX ?? 0,
                                        offsetY: shadowObj?.offsetY ?? 4,
                                      },
                                    })
                                  }
                                />
                              </div>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: "0.75rem" }}>Blur ({shadowObj?.blur ?? 8}px)</label>
                                <input
                                  type="range"
                                  min="0"
                                  max="30"
                                  value={shadowObj?.blur ?? 8}
                                  onChange={(e) =>
                                    updateCurrentStyle({
                                      shadow: {
                                        color: shadowObj?.color || "rgba(0,0,0,0.4)",
                                        blur: Number(e.target.value),
                                        offsetX: shadowObj?.offsetX ?? 0,
                                        offsetY: shadowObj?.offsetY ?? 4,
                                      },
                                    })
                                  }
                                  style={{ width: "100%" }}
                                />
                              </div>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: "0.75rem" }}>Offset X ({shadowObj?.offsetX ?? 0}px)</label>
                                <input
                                  type="range"
                                  min="-20"
                                  max="20"
                                  value={shadowObj?.offsetX ?? 0}
                                  onChange={(e) =>
                                    updateCurrentStyle({
                                      shadow: {
                                        color: shadowObj?.color || "rgba(0,0,0,0.4)",
                                        blur: shadowObj?.blur ?? 8,
                                        offsetX: Number(e.target.value),
                                        offsetY: shadowObj?.offsetY ?? 4,
                                      },
                                    })
                                  }
                                  style={{ width: "100%" }}
                                />
                              </div>
                              <div className="form-group" style={{ marginBottom: 0 }}>
                                <label className="form-label" style={{ fontSize: "0.75rem" }}>Offset Y ({shadowObj?.offsetY ?? 4}px)</label>
                                <input
                                  type="range"
                                  min="-20"
                                  max="20"
                                  value={shadowObj?.offsetY ?? 4}
                                  onChange={(e) =>
                                    updateCurrentStyle({
                                      shadow: {
                                        color: shadowObj?.color || "rgba(0,0,0,0.4)",
                                        blur: shadowObj?.blur ?? 8,
                                        offsetX: shadowObj?.offsetX ?? 0,
                                        offsetY: Number(e.target.value),
                                      },
                                    })
                                  }
                                  style={{ width: "100%" }}
                                />
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 6. LIVE PREVIEW WITH BANGLA CONJUNCT SAMPLE TEXT */}
                        <TextStylePreviewCanvas style={st} sampleText="প্রতিশ্রুতি শ্রদ্ধা মোঃ তরিকুল" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* =================================================================== */}
          {/* SUB-TAB 4: TEST LIVE PREVIEW (WITH TEST DATA)                       */}
          {/* =================================================================== */}
          {activeSubTab === "testPreview" && activeLayout && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2rem" }}>
              {/* Left Column: Test inputs for slots & variant switcher */}
              <div>
                <div className="card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
                    <h3>🧪 Test Controls</h3>
                    {editingTemplate.variants?.length > 0 && (
                      <div style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
                        <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>Variant:</span>
                        <select
                          className="form-select"
                          style={{ width: "auto" }}
                          value={previewVariantIndex}
                          onChange={(e) => setPreviewVariantIndex(Number(e.target.value))}
                        >
                          <option value={-1}>Default</option>
                          {editingTemplate.variants.map((v, i) => (
                            <option key={v.id} value={i}>{v.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Inputs for each Image Slot */}
                  <h4 style={{ fontSize: "0.95rem", color: "#1e40af", marginBottom: "0.5rem" }}>
                    📷 Image Slots ({activeLayout.slots.filter((s) => s.type === "image").length})
                  </h4>
                  {activeLayout.slots
                    .filter((s) => s.type === "image")
                    .map((slot) => (
                      <div key={slot.id} style={{ marginBottom: "0.75rem", padding: "0.6rem", border: "1px solid #bfdbfe", borderRadius: "6px", backgroundColor: "#eff6ff" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                          <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{slot.label}:</span>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => {
                              if (sampleCutoutImage) {
                                setTestCutouts((prev) => ({ ...prev, [slot.id]: sampleCutoutImage }));
                              }
                            }}
                          >
                            Use Sample Cutout
                          </button>
                        </div>

                        <input
                          type="file"
                          accept="image/png,image/webp,image/jpeg"
                          className="form-input"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            const img = new Image();
                            img.onload = () => {
                              setTestCutouts((prev) => ({ ...prev, [slot.id]: img }));
                            };
                            img.src = URL.createObjectURL(file);
                          }}
                        />
                      </div>
                    ))}

                  {/* Inputs for each Text Slot */}
                  <h4 style={{ fontSize: "0.95rem", color: "#15803d", marginTop: "1rem", marginBottom: "0.5rem" }}>
                    ✏️ Text Slots ({activeLayout.slots.filter((s) => s.type === "text").length})
                  </h4>
                  {activeLayout.slots
                    .filter((s) => s.type === "text")
                    .map((slot) => {
                      const textVal = testTexts[slot.id] || "";
                      return (
                        <div key={slot.id} style={{ marginBottom: "0.75rem", padding: "0.6rem", border: "1px solid #bbf7d0", borderRadius: "6px", backgroundColor: "#f0fdf4" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                            <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{slot.label} (Font: {(slot as TextSlot).font}):</span>
                            <div style={{ display: "flex", gap: "0.25rem" }}>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: "0.75rem", padding: "0.15rem 0.35rem" }}
                                onClick={() => setTestTexts((prev) => ({ ...prev, [slot.id]: "মোঃ তরিকুল ইসলাম" }))}
                              >
                                🇧🇩 Bangla
                              </button>
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                style={{ fontSize: "0.75rem", padding: "0.15rem 0.35rem" }}
                                onClick={() => setTestTexts((prev) => ({ ...prev, [slot.id]: "মোঃ তরিকুল ইসলাম চৌধুরী আল-মনসুর শাকিল" }))}
                              >
                                📝 Long
                              </button>
                            </div>
                          </div>

                          <input
                            type="text"
                            className="form-input"
                            value={textVal}
                            placeholder="Type test text here..."
                            onChange={(e) => setTestTexts((prev) => ({ ...prev, [slot.id]: e.target.value }))}
                          />
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Right Column: Live Rendered Output */}
              <div>
                <div className="canvas-preview-container">
                  <div style={{ width: "100%", display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                    <h3 style={{ fontSize: "1rem", margin: 0 }}>Live Canvas Output (renderPoster.ts)</h3>
                    <span style={{ fontSize: "0.8rem", color: "#64748b" }}>
                      {activeLayout.width} × {activeLayout.height} px
                    </span>
                  </div>

                  <canvas ref={testCanvasRef} className="canvas-preview" />
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div className="container" style={{ padding: "3rem", textAlign: "center" }}>
          <p>Loading Admin Studio...</p>
        </div>
      }
    >
      <AdminStudio />
    </Suspense>
  );
}
