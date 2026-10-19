"use client";

import { useEffect, useRef, useState, use, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import {
  TemplateConfig,
  TemplateLayout,
  TemplateVariant,
  TextStyle,
  ImageSlot,
  TextSlot,
  Slot,
  UserTextSlotStyle,
  getDefaultSlotStyle,
} from "@/lib/templates";
import { TextSlotStylePanel } from "@/app/components/TextSlotStylePanel";
import { renderPoster } from "@/lib/renderPoster";
import { checkPhoto, PhotoCheckResult, loadImageElement } from "@/lib/photoChecks";
import { detectFacesInImage, computeFacePlacement, NormalizedFaceBox } from "@/lib/faceDetect";
import { removeBackground } from "@/lib/removeBg";
import { cleanCutout } from "@/lib/cutoutClean";
import { Language, getSavedLanguage, saveLanguage, translate } from "@/lib/i18n";
import { saveProgress, getProgress, clearProgress, TemplateProgress } from "@/lib/storage";
import { Button } from "@/app/components/ui/Button";
import { Stepper, StepItem } from "@/app/components/ui/Stepper";
import { ProgressBar } from "@/app/components/ui/ProgressBar";
import {
  UploadIcon,
  PhotoIcon,
  TextIcon,
  DownloadIcon,
  RefreshIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from "@/app/components/ui/Icons";

function MakePosterContent({ templateId }: { templateId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const posterIdParam = searchParams.get("posterId");

  // Language state (default Bangla, persisted in storage)
  const [lang, setLang] = useState<Language>("bn");

  // User auth & credits state
  const [currentUser, setCurrentUser] = useState<{ id: string; email: string } | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [userCredits, setUserCredits] = useState<number | null>(null);

  // Pricing rules & packages
  const [pricingSettings, setPricingSettings] = useState<{
    cleanDownloadCreditCost: number;
    poseGenerationCreditCost: number;
    aiKillSwitch: boolean;
  }>({
    cleanDownloadCreditCost: 0,
    poseGenerationCreditCost: 10,
    aiKillSwitch: false,
  });
  const [packages, setPackages] = useState<any[]>([]);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseModalReason, setPurchaseModalReason] = useState<string | null>(null);

  // AI Pose Flow states
  const [posesList, setPosesList] = useState<any[]>([]);
  const [selectedPoseId, setSelectedPoseId] = useState<string | null>(null);
  const [selectedPhotoForPose, setSelectedPhotoForPose] = useState<File | null>(null);
  const [isGeneratingPose, setIsGeneratingPose] = useState(false);
  const [poseGenStepText, setPoseGenStepText] = useState<string | null>(null);
  const [generatedPoseResult, setGeneratedPoseResult] = useState<{
    jobId: string;
    outputImagePath: string;
    poseName: string;
  } | null>(null);
  const [poseGenError, setPoseGenError] = useState<string | null>(null);

  // Safety: Terms notice on first use
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Safety: Blocklist words
  const [blocklistWords, setBlocklistWords] = useState<string[]>([]);
  const [blocklistError, setBlocklistError] = useState<string | null>(null);

  // Analytics session tracking
  const [sessionId, setSessionId] = useState<string>("anon_session");

  // Template & Preloaded Assets
  const [template, setTemplate] = useState<TemplateConfig | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(true);
  const [templateError, setTemplateError] = useState<string | null>(null);

  // Layout, Variant, and Style choices
  const [activeLayoutId, setActiveLayoutId] = useState<string>("default");
  const [activeVariantId, setActiveVariantId] = useState<string | null>(null);
  const [activeStyleId, setActiveStyleId] = useState<string | null>(null);

  // Preloaded template base images
  const [blankImage, setBlankImage] = useState<HTMLImageElement | null>(null);
  const [overlayImage, setOverlayImage] = useState<HTMLImageElement | null>(null);

  // Multi-slot user progress states
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [textStyles, setTextStyles] = useState<Record<string, UserTextSlotStyle>>({});
  const [debouncedTexts, setDebouncedTexts] = useState<Record<string, string>>({});
  const [minFontWarnings, setMinFontWarnings] = useState<Record<string, boolean>>({});
  const [cutoutCanvases, setCutoutCanvases] = useState<Record<string, HTMLCanvasElement | HTMLImageElement>>({});
  const [cutoutBlobs, setCutoutBlobs] = useState<Record<string, Blob>>({});
  const [adjustments, setAdjustments] = useState<Record<string, { dx: number; dy: number; zoom: number }>>({});
  const [faceBoxes, setFaceBoxes] = useState<Record<string, NormalizedFaceBox>>({});

  // Debounce typing at ~100ms so real-time canvas preview is smooth and responsive
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedTexts(texts);
    }, 100);
    return () => clearTimeout(timer);
  }, [texts]);

  // Step tracking (0 to slots.length; slots.length is Final Review & Export)
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Photo processing state for current image slot
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [preCheckWarnings, setPreCheckWarnings] = useState<string[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [faceWarnings, setFaceWarnings] = useState<string[]>([]);
  const [isRemovingBg, setIsRemovingBg] = useState(false);
  const [bgRemovalProgress, setBgRemovalProgress] = useState<string | null>(null);

  // Saved progress prompt (IndexedDB)
  const [savedPrompt, setSavedPrompt] = useState<TemplateProgress | null>(null);

  // Save poster to account state
  const [isSavingPoster, setIsSavingPoster] = useState(false);
  const [savePosterSuccess, setSavePosterSuccess] = useState<string | null>(null);

  // Interactive adjustment dragging
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{
    clientX: number;
    clientY: number;
    origDx: number;
    origDy: number;
    slotDisplayW: number;
    slotDisplayH: number;
  } | null>(null);

  // Canvas preview ref and export state
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isRendering, setIsRendering] = useState(false);
  const [exportFormat, setExportFormat] = useState<"png" | "jpg">("png");
  const [jpgQuality, setJpgQuality] = useState<number>(0.95);
  const [exportScale, setExportScale] = useState<number>(1);
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  // Helper for i18n translation
  const t = useCallback(
    (key: string, p?: Record<string, string | number>) => translate(lang, key, p),
    [lang]
  );

  // Helper to log analytics events
  const trackAnalytics = useCallback(
    (eventType: string, extra?: Record<string, any>) => {
      try {
        fetch("/api/analytics", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId,
            eventType,
            templateId,
            layoutId: activeLayoutId,
            format: exportFormat,
            ...extra,
          }),
        }).catch(() => {});
      } catch {}
    },
    [sessionId, templateId, activeLayoutId, exportFormat]
  );

  // 1. Initialize session ID, language, user auth, terms notice, and blocklist
  useEffect(() => {
    setLang(getSavedLanguage());

    // Session ID
    let sid = sessionStorage.getItem("poster_session_id");
    if (!sid) {
      sid = "sess_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      sessionStorage.setItem("poster_session_id", sid);
    }
    setSessionId(sid);

    // Terms check
    const accepted = localStorage.getItem("terms_accepted_v1");
    if (!accepted) {
      setShowTermsModal(true);
    }

    // Current user & credits check
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (d.user) {
          setCurrentUser(d.user);
          fetch("/api/credits/balance")
            .then((res) => res.json())
            .then((cd) => {
              if (cd.balance !== undefined) setUserCredits(cd.balance);
            })
            .catch(() => {});
        } else {
          setCurrentUser(null);
        }
      })
      .catch(() => setCurrentUser(null));

    // System pricing settings
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d) => {
        if (d.settings) setPricingSettings(d.settings);
      })
      .catch(() => {});

    // Active AI poses
    fetch("/api/poses")
      .then((r) => r.json())
      .then((d) => {
        if (d.poses) setPosesList(d.poses);
      })
      .catch(() => {});

    // Active packages
    fetch("/api/packages")
      .then((r) => r.json())
      .then((d) => {
        if (d.packages) setPackages(d.packages);
      })
      .catch(() => {});

    // Blocklist words fetch
    fetch("/api/safety/blocklist")
      .then((r) => r.json())
      .then((d) => setBlocklistWords(d.words || []))
      .catch(() => {});
  }, []);

  const refreshCredits = useCallback(async () => {
    try {
      const res = await fetch("/api/credits/balance");
      if (res.ok) {
        const data = await res.json();
        if (data.balance !== undefined) setUserCredits(data.balance);
      }
    } catch {}
  }, []);

  const handleLanguageToggle = () => {
    const nextLang: Language = lang === "bn" ? "en" : "bn";
    setLang(nextLang);
    saveLanguage(nextLang);
  };

  const handleAcceptTerms = () => {
    localStorage.setItem("terms_accepted_v1", "true");
    setShowTermsModal(false);
  };

  // 2. Fetch template config & check for saved IndexedDB progress or reopening posterId
  useEffect(() => {
    async function init() {
      try {
        setLoadingTemplate(true);
        setTemplateError(null);

        const res = await fetch(`/api/templates/${templateId}`);
        if (!res.ok) throw new Error("Template not found");
        const data: TemplateConfig = await res.json();
        setTemplate(data);

        // Track template_opened
        trackAnalytics("template_opened");

        const defLayout = data.layouts?.[0];
        if (defLayout) setActiveLayoutId(defLayout.id);

        // If reopening from a saved poster ID in URL
        if (posterIdParam) {
          try {
            const pRes = await fetch(`/api/posters/${posterIdParam}`);
            if (pRes.ok) {
              const pData = await pRes.json();
              if (pData.poster) {
                if (pData.poster.layoutId) setActiveLayoutId(pData.poster.layoutId);
                if (pData.poster.variantId) setActiveVariantId(pData.poster.variantId);
                if (pData.poster.textValues) {
                  const { __textStyles, ...pureTexts } = pData.poster.textValues;
                  setTexts(pureTexts);
                  if (__textStyles) setTextStyles(__textStyles);
                }
                if (pData.poster.adjustments) setAdjustments(pData.poster.adjustments);
                return;
              }
            }
          } catch (e) {
            console.warn("Could not reload poster from posterId:", e);
          }
        }

        // Otherwise check IndexedDB for existing local progress
        const saved = await getProgress(templateId);
        if (saved && (Object.keys(saved.texts || {}).length > 0 || Object.keys(saved.cutoutBlobs || {}).length > 0)) {
          setSavedPrompt(saved);
        }
      } catch (err: any) {
        setTemplateError(err.message || "Failed to load template");
      } finally {
        setLoadingTemplate(false);
      }
    }
    init();
  }, [templateId, posterIdParam, trackAnalytics]);

  // Active Layout, Variant, and Style references
  const activeLayout: TemplateLayout | null =
    template?.layouts?.find((l) => l.id === activeLayoutId) ||
    template?.layouts?.[0] ||
    null;

  const activeVariant: TemplateVariant | null =
    template?.variants?.find((v) => v.id === activeVariantId) || null;

  const activeStyle: TextStyle | null =
    template?.styles?.find((s) => s.id === activeStyleId) || null;

  const slots: Slot[] = activeLayout?.slots || template?.slots || [];
  const totalSteps = slots.length + 1; // slots + export step
  const isExportStep = currentStepIndex === slots.length;
  const currentSlot: Slot | null = !isExportStep ? slots[currentStepIndex] || null : null;

  const [isDragOver, setIsDragOver] = useState(false);
  const [cutoutImgUrl, setCutoutImgUrl] = useState<string | null>(null);

  const cutoutBlob = currentSlot ? cutoutBlobs[currentSlot.id] : null;

  useEffect(() => {
    if (cutoutBlob) {
      const url = URL.createObjectURL(cutoutBlob);
      setCutoutImgUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      setCutoutImgUrl(null);
    }
  }, [cutoutBlob]);

  // 3. Load blank and overlay images whenever activeLayout or activeVariant changes
  useEffect(() => {
    if (!template || !activeLayout) return;
    const layout = activeLayout;
    const variant = activeVariant;

    let isCancelled = false;

    async function loadTemplateImages() {
      try {
        let blankFilename = layout.blank || "blank.png";
        if (variant?.blankOverrides?.[layout.id]) {
          blankFilename = variant.blankOverrides[layout.id];
        }

        const blank = new Image();
        blank.crossOrigin = "anonymous";
        await new Promise((resolve, reject) => {
          blank.onload = resolve;
          blank.onerror = () => reject(new Error("Failed to load template base image"));
          blank.src = `/api/templates/${templateId}/images/${blankFilename}`;
        });

        if (!isCancelled) setBlankImage(blank);

        let overlayFilename = layout.overlay || null;
        if (variant?.overlayOverrides?.[layout.id]) {
          overlayFilename = variant.overlayOverrides[layout.id];
        }

        if (overlayFilename) {
          const overlay = new Image();
          overlay.crossOrigin = "anonymous";
          await new Promise((resolve) => {
            overlay.onload = resolve;
            overlay.onerror = () => {
              console.warn("Overlay image could not be loaded");
              resolve(null);
            };
            overlay.src = `/api/templates/${templateId}/images/${overlayFilename}`;
          });
          if (!isCancelled) setOverlayImage(overlay);
        } else {
          if (!isCancelled) setOverlayImage(null);
        }
      } catch (err) {
        console.error("Error preloading template assets:", err);
      }
    }

    loadTemplateImages();

    return () => {
      isCancelled = true;
    };
  }, [template, activeLayout, activeVariant, templateId]);

  // 4. Reconstruct cutout canvas from Blobs
  const restoreBlobsToCanvases = useCallback(async (blobs: Record<string, Blob>) => {
    const newCanvases: Record<string, HTMLCanvasElement | HTMLImageElement> = {};
    for (const [slotId, blob] of Object.entries(blobs)) {
      try {
        const img = await loadImageElement(blob);
        newCanvases[slotId] = img;
      } catch (e) {
        console.warn(`Failed to restore blob for slot ${slotId}:`, e);
      }
    }
    setCutoutCanvases((prev) => ({ ...prev, ...newCanvases }));
  }, []);

  // 5. Save progress to IndexedDB (debounced)
  useEffect(() => {
    if (!template) return;
    const timer = setTimeout(() => {
      saveProgress({
        templateId,
        updatedAt: Date.now(),
        currentStepIndex,
        layoutId: activeLayoutId,
        variantId: activeVariantId || undefined,
        styleId: activeStyleId || undefined,
        texts,
        textStyles,
        adjustments,
        faceBoxes,
        cutoutBlobs,
      });
    }, 800);

    return () => clearTimeout(timer);
  }, [
    template,
    templateId,
    currentStepIndex,
    activeLayoutId,
    activeVariantId,
    activeStyleId,
    texts,
    textStyles,
    adjustments,
    faceBoxes,
    cutoutBlobs,
  ]);

  // 6. Handle Restore vs Discard saved progress
  const handleRestoreSaved = async () => {
    if (!savedPrompt) return;
    setTexts(savedPrompt.texts || {});
    if (savedPrompt.textStyles) {
      setTextStyles(savedPrompt.textStyles);
    }
    setAdjustments(savedPrompt.adjustments || {});
    setFaceBoxes(savedPrompt.faceBoxes || {});
    setCutoutBlobs(savedPrompt.cutoutBlobs || {});
    if (savedPrompt.layoutId) setActiveLayoutId(savedPrompt.layoutId);
    if (savedPrompt.variantId) setActiveVariantId(savedPrompt.variantId);
    if (savedPrompt.styleId) setActiveStyleId(savedPrompt.styleId);
    if (savedPrompt.currentStepIndex !== undefined) {
      setCurrentStepIndex(savedPrompt.currentStepIndex);
    }
    if (savedPrompt.cutoutBlobs) {
      await restoreBlobsToCanvases(savedPrompt.cutoutBlobs);
    }
    setSavedPrompt(null);
  };

  const handleDiscardSaved = async () => {
    await clearProgress(templateId);
    setSavedPrompt(null);
  };

  // 7. Trigger Live Canvas Rendering (with Watermark enabled for interactive previews)
  useEffect(() => {
    if (!template || !blankImage || !canvasRef.current) return;

    let isMounted = true;
    async function draw() {
      setIsRendering(true);
      try {
        await renderPoster(
          {
            config: template!,
            layout: activeLayout || undefined,
            variant: activeVariant || undefined,
            activeStyle,
            blankImage: blankImage!,
            overlayImage,
            cutouts: cutoutCanvases,
            texts: debouncedTexts,
            adjustments,
            faceBoxes,
            activeAdjustSlotId: !isExportStep && currentSlot?.type === "image" ? currentSlot.id : null,
            isExport: false,
            watermark: false, // Clean high-resolution preview without watermark
            userTextStyles: textStyles,
            onTextMinWarning: (slotId, isMin) => {
              setMinFontWarnings((prev) => (prev[slotId] === isMin ? prev : { ...prev, [slotId]: isMin }));
            },
          },
          canvasRef.current!
        );
      } catch (err) {
        console.error("Rendering error:", err);
      } finally {
        if (isMounted) setIsRendering(false);
      }
    }

    draw();

    return () => {
      isMounted = false;
    };
  }, [
    template,
    activeLayout,
    activeVariant,
    activeStyle,
    blankImage,
    overlayImage,
    cutoutCanvases,
    debouncedTexts,
    textStyles,
    adjustments,
    faceBoxes,
    currentStepIndex,
    isExportStep,
    currentSlot,
  ]);

  // 8. Photo Upload & Processing Pipeline for currentSlot (Pre-checks + Moderation + Face + BgRemoval + Clean)
  const processPhotoFile = async (file: File) => {
    if (!currentSlot || currentSlot.type !== "image") return;

    setPhotoError(null);
    setPreCheckWarnings([]);
    setFaceWarnings([]);
    setPendingFile(null);

    // Step A: Client Pre-checks (format, size, resolution, blur, brightness)
    const check: PhotoCheckResult = await checkPhoto(file);

    // Hard errors
    if (!check.valid) {
      setPhotoError(check.error || t("err_upload_failed"));
      trackAnalytics("error", { errorType: "precheck_failed", reason: check.error });
      return;
    }

    // Soft warnings: pause for user confirmation ("Use anyway")
    if (check.warnings.length > 0) {
      setPreCheckWarnings(check.warnings);
      setPendingFile(file);
      return;
    }

    await executePipelineForSlot(file, currentSlot);
  };

  const handleUseAnyway = async () => {
    if (!pendingFile || !currentSlot || currentSlot.type !== "image") return;
    const file = pendingFile;
    setPreCheckWarnings([]);
    setPendingFile(null);
    await executePipelineForSlot(file, currentSlot);
  };

  const executePipelineForSlot = async (file: File, slot: ImageSlot) => {
    try {
      setPhotoError(null);
      setIsRemovingBg(true);
      setBgRemovalProgress("Checking image safety and moderation...");

      // Step B: Server Upload Moderation
      const modForm = new FormData();
      modForm.append("file", file);
      modForm.append("sessionId", sessionId);
      modForm.append("templateId", templateId);

      const modRes = await fetch("/api/moderate-image", {
        method: "POST",
        body: modForm,
      });

      if (!modRes.ok) {
        const modData = await modRes.json();
        setPhotoError(modData.error || "The image was flagged by content moderation. Please upload an appropriate photo.");
        setIsRemovingBg(false);
        setBgRemovalProgress(null);
        trackAnalytics("error", { errorType: "moderation_rejected" });
        return;
      }

      // Step C: Face Detection in browser
      setBgRemovalProgress("Detecting face with MediaPipe AI...");
      const img = await loadImageElement(file);
      const faceResult = await detectFacesInImage(img);

      if (!faceResult.hasFace) {
        setPhotoError(faceResult.error || t("err_no_face"));
        setIsRemovingBg(false);
        setBgRemovalProgress(null);
        trackAnalytics("error", { errorType: "no_face_detected" });
        return;
      }

      if (faceResult.warnings.length > 0) {
        setFaceWarnings(faceResult.warnings);
      }

      const mainFace = faceResult.mainFace;
      if (mainFace) {
        setFaceBoxes((prev) => ({ ...prev, [slot.id]: mainFace }));
      }

      // Step D: Background Removal
      const rawCutoutBlob = await removeBackground(file, {
        onProgress: (msg) => setBgRemovalProgress(msg),
      });

      trackAnalytics("bg_removed", { slotId: slot.id });

      // Step E: Edge Cleanup
      setBgRemovalProgress("Cleaning edges and optimizing cutout...");
      const rawCutoutImg = await loadImageElement(rawCutoutBlob);
      const cleanedCanvas = cleanCutout(rawCutoutImg);

      const cleanedBlob: Blob = await new Promise((resolve) => {
        cleanedCanvas.toBlob((b) => resolve(b || rawCutoutBlob), "image/png");
      });

      setCutoutBlobs((prev) => ({ ...prev, [slot.id]: cleanedBlob }));
      setCutoutCanvases((prev) => ({ ...prev, [slot.id]: cleanedCanvas }));

      setAdjustments((prev) => ({
        ...prev,
        [slot.id]: { dx: 0, dy: 0, zoom: 1.0 },
      }));

      setBgRemovalProgress(null);
    } catch (err: any) {
      console.error("Pipeline failure:", err);
      setPhotoError(err.message || t("err_upload_failed"));
      trackAnalytics("error", { errorType: "pipeline_failure", message: err.message });
    } finally {
      setIsRemovingBg(false);
      setBgRemovalProgress(null);
    }
  };

    // 8.1 AI Pose Generation Handlers
  const handleGeneratePose = async (overridePhoto?: File) => {
    const photoToUse = overridePhoto || selectedPhotoForPose;
    if (!photoToUse || !selectedPoseId || !currentSlot || currentSlot.type !== "image") return;

    if (pricingSettings.aiKillSwitch) {
      alert("AI pose generation is temporarily disabled by administrator.");
      return;
    }

    const cost = pricingSettings.poseGenerationCreditCost;
    if ((userCredits ?? 0) < cost) {
      setPurchaseModalReason(
        `AI Pose Generation costs ${cost} credits, but you currently have ${userCredits ?? 0} credits.`
      );
      setShowPurchaseModal(true);
      return;
    }

    try {
      setIsGeneratingPose(true);
      setPoseGenError(null);
      setPoseGenStepText("Checking photo moderation & starting AI job...");

      const formData = new FormData();
      formData.append("poseId", selectedPoseId);
      formData.append("photo", photoToUse);

      const res = await fetch("/api/poses/generate", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        if (res.status === 402) {
          setPurchaseModalReason(data.error || `Insufficient credits. Need ${cost} credits.`);
          setShowPurchaseModal(true);
          setIsGeneratingPose(false);
          return;
        }
        throw new Error(data.error || "Failed to start AI pose generation");
      }

      if (data.newBalance !== undefined) {
        setUserCredits(data.newBalance);
      }

      const jobId = data.jobId;
      setPoseGenStepText("AI model is synthesizing portrait in requested pose...");

      // Poll job status
      let attempts = 0;
      const maxAttempts = 60;
      const pollInterval = setInterval(async () => {
        attempts++;
        try {
          const pollRes = await fetch(`/api/poses/jobs/${jobId}`);
          if (!pollRes.ok) return;

          const jobData = await pollRes.json();
          if (jobData.status === "succeeded" && jobData.outputImagePath) {
            clearInterval(pollInterval);
            setIsGeneratingPose(false);
            setPoseGenStepText(null);
            setGeneratedPoseResult({
              jobId: jobData.id,
              outputImagePath: jobData.outputImagePath,
              poseName: jobData.poseName || "AI Pose",
            });
            refreshCredits();
          } else if (jobData.status === "failed") {
            clearInterval(pollInterval);
            setIsGeneratingPose(false);
            setPoseGenStepText(null);
            setPoseGenError(
              `${jobData.error || "Generation failed."} (Your ${cost} credits were automatically refunded)`
            );
            refreshCredits();
          } else {
            if (attempts > 2) {
              setPoseGenStepText("Rendering studio lighting and aligning face details...");
            }
          }

          if (attempts >= maxAttempts) {
            clearInterval(pollInterval);
            setIsGeneratingPose(false);
            setPoseGenError("Generation timed out. Please try again.");
            refreshCredits();
          }
        } catch (pollErr) {
          console.error("Polling error", pollErr);
        }
      }, 1500);
    } catch (err: any) {
      setIsGeneratingPose(false);
      setPoseGenStepText(null);
      setPoseGenError(err.message || "Failed to generate AI pose");
      refreshCredits();
    }
  };

  const handleApplyGeneratedPose = async () => {
    if (!generatedPoseResult || !currentSlot || currentSlot.type !== "image") return;

    try {
      setIsRemovingBg(true);
      setBgRemovalProgress("Loading generated pose photo...");

      const res = await fetch(generatedPoseResult.outputImagePath);
      const blob = await res.blob();
      const file = new File([blob], `ai_pose_${Date.now()}.png`, { type: "image/png" });

      setGeneratedPoseResult(null);
      await executePipelineForSlot(file, currentSlot);
    } catch (err: any) {
      setPhotoError("Failed to apply generated photo: " + (err.message || "Error"));
      setIsRemovingBg(false);
      setBgRemovalProgress(null);
    }
  };

  const handleRetryGeneratedPose = () => {
    setGeneratedPoseResult(null);
    handleGeneratePose();
  };

  const handleBuyPackage = async (packageId: string) => {
    try {
      if (!currentUser) {
        setShowAuthModal(true);
        return;
      }

      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to initialize payment");

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
      }
    } catch (err: any) {
      alert(err.message || "Payment initiation failed");
    }
  };

  // 9. Manual Adjustment Pointer & Touch Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isExportStep || !currentSlot || currentSlot.type !== "image" || !currentSlot.allowAdjust) {
      return;
    }
    const currentCutout = cutoutCanvases[currentSlot.id];
    if (!currentCutout) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(e.pointerId);
    setIsDragging(true);

    const rect = canvas.getBoundingClientRect();
    const curAdj = adjustments[currentSlot.id] || { dx: 0, dy: 0, zoom: 1.0 };
    const slotDisplayW = currentSlot.w * rect.width;
    const slotDisplayH = currentSlot.h * rect.height;

    setDragStart({
      clientX: e.clientX,
      clientY: e.clientY,
      origDx: curAdj.dx,
      origDy: curAdj.dy,
      slotDisplayW: Math.max(slotDisplayW, 50),
      slotDisplayH: Math.max(slotDisplayH, 50),
    });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDragging || !dragStart || !currentSlot || currentSlot.type !== "image") return;

    const deltaX = e.clientX - dragStart.clientX;
    const deltaY = e.clientY - dragStart.clientY;

    const fracDx = deltaX / dragStart.slotDisplayW;
    const fracDy = deltaY / dragStart.slotDisplayH;

    const maxOffset = currentSlot.maxOffset ?? 0.3;
    let newDx = Math.max(-maxOffset, Math.min(maxOffset, dragStart.origDx + fracDx));
    let newDy = Math.max(-maxOffset, Math.min(maxOffset, dragStart.origDy + fracDy));

    setAdjustments((prev) => {
      const cur = prev[currentSlot.id] || { dx: 0, dy: 0, zoom: 1.0 };
      return {
        ...prev,
        [currentSlot.id]: { ...cur, dx: newDx, dy: newDy },
      };
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDragging) {
      setIsDragging(false);
      setDragStart(null);
      try {
        canvasRef.current?.releasePointerCapture(e.pointerId);
      } catch (err) {}
    }
  };

  const handleNudge = (deltaXFrac: number, deltaYFrac: number) => {
    if (!currentSlot || currentSlot.type !== "image") return;
    const maxOffset = currentSlot.maxOffset ?? 0.3;

    setAdjustments((prev) => {
      const cur = prev[currentSlot.id] || { dx: 0, dy: 0, zoom: 1.0 };
      let newDx = Math.max(-maxOffset, Math.min(maxOffset, cur.dx + deltaXFrac));
      let newDy = Math.max(-maxOffset, Math.min(maxOffset, cur.dy + deltaYFrac));
      return {
        ...prev,
        [currentSlot.id]: { ...cur, dx: newDx, dy: newDy },
      };
    });
  };

  const handleZoomChange = (newZoom: number) => {
    if (!currentSlot || currentSlot.type !== "image") return;
    const minZoom = currentSlot.minZoom ?? 0.4;
    const maxZoom = currentSlot.maxZoom ?? 2.5;
    const clampedZoom = Math.max(minZoom, Math.min(maxZoom, newZoom));

    setAdjustments((prev) => {
      const cur = prev[currentSlot.id] || { dx: 0, dy: 0, zoom: 1.0 };
      return {
        ...prev,
        [currentSlot.id]: { ...cur, zoom: clampedZoom },
      };
    });
  };

  const handleResetAdjustment = () => {
    if (!currentSlot || currentSlot.type !== "image") return;
    setAdjustments((prev) => ({
      ...prev,
      [currentSlot.id]: { dx: 0, dy: 0, zoom: 1.0 },
    }));
  };

  // Blocklist check helper
  const checkBlocklist = (text: string): string | null => {
    const lower = text.toLowerCase();
    for (const item of blocklistWords) {
      if (item && lower.includes(item.toLowerCase())) {
        return item;
      }
    }
    return null;
  };

  // 10. Navigation controls (Next / Back / Skip)
  const isSlotRequired = (slot: Slot): boolean => Boolean(slot.required);

  const canProceed = () => {
    if (isExportStep) return true;
    if (!currentSlot) return true;

    if (currentSlot.type === "image") {
      if (isSlotRequired(currentSlot)) {
        return Boolean(cutoutCanvases[currentSlot.id]);
      }
      return true;
    }

    if (currentSlot.type === "text") {
      if (blocklistError) return false;
      if (isSlotRequired(currentSlot)) {
        return Boolean(texts[currentSlot.id]?.trim());
      }
      return true;
    }

    return true;
  };

  const getValidationHint = () => {
    if (isExportStep || !currentSlot) return null;
    if (currentSlot.type === "image" && isSlotRequired(currentSlot) && !cutoutCanvases[currentSlot.id]) {
      return lang === "bn"
        ? "পরবর্তী ধাপে যেতে অনুগ্রহ করে একটি ছবি আপলোড করুন"
        : "Please upload a photo to proceed";
    }
    if (currentSlot.type === "text") {
      if (blocklistError) {
        return lang === "bn"
          ? "সতর্কবার্তা অনুযায়ী নিষিদ্ধ শব্দটি পরিবর্তন করুন"
          : "Please remove the blocked word to proceed";
      }
      if (isSlotRequired(currentSlot) && !texts[currentSlot.id]?.trim()) {
        return lang === "bn"
          ? "পরবর্তী ধাপে যেতে প্রয়োজনীয় লেখাটি পূরণ করুন"
          : "Please enter the required text to proceed";
      }
    }
    return null;
  };

  const handleNextStep = () => {
    if (currentStepIndex < slots.length) {
      if (currentSlot?.type === "text" && texts[currentSlot.id]?.trim()) {
        trackAnalytics("text_entered", { slotId: currentSlot.id });
      }
      setCurrentStepIndex((prev) => prev + 1);
      setPhotoError(null);
      setPreCheckWarnings([]);
      setFaceWarnings([]);
    }
  };

  const handlePrevStep = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
      setPhotoError(null);
      setPreCheckWarnings([]);
      setFaceWarnings([]);
    }
  };

  const handleSkipStep = () => {
    if (!isExportStep && currentSlot && !isSlotRequired(currentSlot)) {
      handleNextStep();
    }
  };

  // 11. Final Clean High-Resolution Export (Download is CLEAN without watermark and requires NO login)
  const handleExportDownload = async () => {
    if (!template || !blankImage || !activeLayout) return;

    try {
      setIsExporting(true);
      setExportSuccess(false);

      const offscreenCanvas = document.createElement("canvas");
      await renderPoster(
        {
          config: template,
          layout: activeLayout,
          variant: activeVariant || undefined,
          activeStyle,
          blankImage,
          overlayImage,
          cutouts: cutoutCanvases,
          texts,
          adjustments,
          faceBoxes,
          activeAdjustSlotId: null,
          isExport: true, // Guarantees clean download with no watermark & no editing lines
          exportScale, // 1x or 2x Ultra HD print-ready resolution
          watermark: false,
          userTextStyles: textStyles,
        },
        offscreenCanvas
      );

      const mimeType = exportFormat === "png" ? "image/png" : "image/jpeg";
      const quality = exportFormat === "png" ? undefined : jpgQuality;

      const blob: Blob = await new Promise((resolve, reject) => {
        offscreenCanvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error("Canvas export failed"));
          },
          mimeType,
          quality
        );
      });

      const cleanName = (template.name || "poster")
        .toLowerCase()
        .replace(/[^a-z0-9_-]/g, "-")
        .replace(/-+/g, "-");
      const scaleSuffix = exportScale > 1 ? `_${exportScale}x_ultrahd` : "";
      const filename = `${cleanName}_${activeLayout.id}${scaleSuffix}.${exportFormat}`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setExportSuccess(true);
      trackAnalytics("poster_exported", { layoutId: activeLayout.id, format: exportFormat, scale: exportScale });
    } catch (err) {
      console.error("Export download failed:", err);
      alert(t("err_upload_failed"));
    } finally {
      setIsExporting(false);
    }
  };

  // 12. Save Poster to User's Account or Local Storage (No forced login)
  const handleSavePoster = async () => {
    if (!template || !blankImage || !activeLayout) return;

    setIsSavingPoster(true);
    setSavePosterSuccess(null);

    try {
      // Generate clean thumbnail for saved posters list
      const offscreen = document.createElement("canvas");
      await renderPoster(
        {
          config: template,
          layout: activeLayout,
          variant: activeVariant || undefined,
          activeStyle,
          blankImage,
          overlayImage,
          cutouts: cutoutCanvases,
          texts,
          adjustments,
          faceBoxes,
          activeAdjustSlotId: null,
          isExport: true,
          watermark: false,
          userTextStyles: textStyles,
        },
        offscreen
      );

      const previewImageBase64 = offscreen.toDataURL("image/png");

      if (currentUser) {
        const res = await fetch("/api/posters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId,
            layoutId: activeLayoutId,
            variantId: activeVariantId || undefined,
            textValues: {
              ...texts,
              __textStyles: textStyles,
            },
            adjustments,
            previewImageBase64,
            title: `${template.name} (${new Date().toLocaleDateString()})`,
            sessionId,
          }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || "Failed to save poster");
        }
      } else {
        try {
          const localItem = {
            id: `local_${Date.now()}`,
            templateId,
            layoutId: activeLayoutId,
            title: `${template.name} (${new Date().toLocaleDateString()})`,
            previewImagePath: previewImageBase64,
            createdAt: new Date().toISOString(),
            textValues: {
              ...texts,
              __textStyles: textStyles,
            },
          };
          const existing = JSON.parse(localStorage.getItem("local_saved_posters") || "[]");
          existing.unshift(localItem);
          localStorage.setItem("local_saved_posters", JSON.stringify(existing.slice(0, 20)));
        } catch (e) {
          console.warn("Local storage save error:", e);
        }
      }

      setSavePosterSuccess(t("save_poster_success"));
    } catch (err: any) {
      alert(err.message || "Failed to save poster");
    } finally {
      setIsSavingPoster(false);
    }
  };


  if (loadingTemplate) {
    return (
      <div className="container" style={{ textAlign: "center", padding: "4rem 1rem" }}>
        <div className="loading-spinner" style={{ margin: "0 auto 1.5rem" }} />
        <h2 style={{ fontSize: "1.3rem", color: "#1e293b" }}>{t("loading_template")}</h2>
      </div>
    );
  }

  if (templateError || !template) {
    return (
      <div className="container" style={{ maxWidth: 600, padding: "3rem 1rem", textAlign: "center" }}>
        <div className="alert alert-danger" style={{ marginBottom: "1.5rem", textAlign: "left" }}>
          <strong>{t("error_occurred")}</strong> {templateError || t("error_template_load")}
        </div>
        <button
          onClick={() => window.location.reload()}
          className="btn-large btn-large-primary"
        >
          {t("btn_retry")}
        </button>
        <div style={{ marginTop: "1rem" }}>
          <Link href="/" className="btn-large btn-large-secondary">
            {t("btn_start_over")}
          </Link>
        </div>
      </div>
    );
  }

  const currentCutout = currentSlot?.type === "image" ? cutoutCanvases[currentSlot.id] : null;
  const currentAdjustment = (currentSlot && adjustments[currentSlot.id]) || { dx: 0, dy: 0, zoom: 1.0 };
  const currentTextVal = currentSlot?.type === "text" ? texts[currentSlot.id] || "" : "";

  const stepItems: StepItem[] = [
    ...slots.map((s) => ({
      id: s.id,
      label: s.label,
      type: s.type as "image" | "text",
      completed: s.type === "image" ? Boolean(cutoutCanvases[s.id]) : Boolean(texts[s.id]?.trim()),
    })),
    {
      id: "export",
      label: t("step_export") || (lang === "bn" ? "ডাউনলোড" : "Download"),
      type: "export",
      completed: Boolean(exportSuccess),
    },
  ];

  return (
    <div className="container" style={{ maxWidth: 1200, padding: "var(--space-4) var(--space-4) var(--space-12)" }}>
      {/* Top Header Breadcrumb & Title */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-3)",
          marginBottom: "var(--space-6)",
          paddingBottom: "var(--space-3)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div>
          <Link
            href="/"
            style={{
              color: "var(--green-700)",
              fontWeight: 600,
              fontSize: "0.95rem",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            ← {lang === "bn" ? "পোস্টার গ্যালারিতে ফিরে যান" : "Back to Posters"}
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginTop: "0.25rem" }}>
            <h1 style={{ fontSize: "1.45rem", margin: 0, color: "var(--text)" }}>
              {template.name}
            </h1>
            {template.category && (
              <span className="badge badge-primary">{template.category}</span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "center" }}>
          <button
            onClick={handleLanguageToggle}
            className="btn-secondary"
            style={{ minHeight: 40, padding: "0.35rem 0.85rem", fontSize: "0.9rem" }}
            title="Toggle Bangla / English"
          >
            🌐 {t("language_switch")}
          </button>
        </div>
      </div>

      {/* Save Success Alert */}
      {savePosterSuccess && (
        <div className="alert alert-success" style={{ marginBottom: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span>✓ {savePosterSuccess}</span>
          <Link href="/my-posters" style={{ color: "#166534", fontWeight: 700, textDecoration: "underline" }}>
            View in My Posters →
          </Link>
        </div>
      )}

      {/* Terms Notice Modal (First use) */}
      {showTermsModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            zIndex: 200,
          }}
        >
          <div
            className="card"
            style={{
              background: "#ffffff",
              padding: "2rem",
              borderRadius: 12,
              maxWidth: 480,
              width: "100%",
              boxShadow: "0 10px 25px rgba(0,0,0,0.2)",
            }}
          >
            <div style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🛡️</div>
            <h2 style={{ fontSize: "1.3rem", color: "#0f172a", marginBottom: "0.5rem" }}>
              {t("terms_notice_title")}
            </h2>
            <p style={{ color: "#475569", fontSize: "0.95rem", lineHeight: 1.5, marginBottom: "1.5rem" }}>
              {t("terms_notice_body")}
            </p>
            <button
              onClick={handleAcceptTerms}
              className="btn-large btn-large-primary"
              style={{ width: "100%" }}
            >
              ✓ {t("terms_notice_btn")}
            </button>
          </div>
        </div>
      )}

      {/* Auth Required Prompt Modal (Guest clicks Save poster) */}
      {showAuthModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            zIndex: 200,
          }}
        >
          <div
            className="card"
            style={{
              background: "#ffffff",
              padding: "2rem",
              borderRadius: 12,
              maxWidth: 440,
              width: "100%",
            }}
          >
            <h2 style={{ fontSize: "1.3rem", marginBottom: "0.5rem" }}>
              {t("auth_required_title")}
            </h2>
            <p style={{ color: "#64748b", fontSize: "0.95rem", marginBottom: "1.5rem" }}>
              {t("auth_required_body")}
            </p>
            <div style={{ display: "flex", gap: "0.75rem", marginBottom: "0.75rem" }}>
              <Link href={`/login?returnUrl=/make/${templateId}`} className="btn-large btn-large-primary" style={{ flex: 1 }}>
                Log In
              </Link>
              <Link href={`/signup?returnUrl=/make/${templateId}`} className="btn-large btn-large-secondary" style={{ flex: 1 }}>
                Sign Up
              </Link>
            </div>
            <button
              onClick={() => setShowAuthModal(false)}
              className="btn-large btn-large-secondary"
              style={{ width: "100%" }}
            >
              Continue as Guest
            </button>
          </div>
        </div>
      )}

      {/* 1. Generating AI Pose Progress Modal */}
      {isGeneratingPose && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            zIndex: 220,
          }}
        >
          <div
            className="card"
            style={{
              background: "#ffffff",
              padding: "2.5rem 2rem",
              borderRadius: 16,
              maxWidth: 440,
              width: "100%",
              textAlign: "center",
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
            }}
          >
            <div className="loading-spinner" style={{ margin: "0 auto 1.5rem", width: 50, height: 50 }} />
            <h3 style={{ fontSize: "1.25rem", color: "#1e293b", margin: "0 0 0.5rem 0" }}>
              Generating AI Pose...
            </h3>
            <p style={{ color: "#4f46e5", fontWeight: 600, fontSize: "0.95rem", margin: "0 0 1rem 0" }}>
              {poseGenStepText || "Synthesizing portrait with selected pose reference..."}
            </p>
            <p style={{ color: "#64748b", fontSize: "0.85rem", margin: 0 }}>
              AI generation is running in the background. If generation fails, credits are automatically refunded.
            </p>
          </div>
        </div>
      )}

      {/* 2. AI Pose Result Preview Modal ("Try again" vs "Use this photo") */}
      {generatedPoseResult && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            zIndex: 220,
          }}
        >
          <div
            className="card"
            style={{
              background: "#ffffff",
              padding: "1.5rem",
              borderRadius: 16,
              maxWidth: 460,
              width: "100%",
              textAlign: "center",
              boxShadow: "0 20px 40px rgba(0,0,0,0.3)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <h3 style={{ fontSize: "1.2rem", color: "#0f172a", margin: 0, fontWeight: 700 }}>
                ✨ AI Pose Preview: {generatedPoseResult.poseName}
              </h3>
              <button
                onClick={() => setGeneratedPoseResult(null)}
                style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "#64748b" }}
              >
                ✕
              </button>
            </div>

            <div
              style={{
                background: "#f8fafc",
                borderRadius: 12,
                padding: "0.5rem",
                marginBottom: "1.25rem",
                maxHeight: 380,
                overflow: "hidden",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <img
                src={generatedPoseResult.outputImagePath}
                alt="AI Pose Result"
                style={{ maxHeight: 360, maxWidth: "100%", objectFit: "contain", borderRadius: 8 }}
              />
            </div>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <button
                type="button"
                onClick={handleRetryGeneratedPose}
                className="btn-large btn-large-secondary"
                style={{ flex: 1, minHeight: 46, fontSize: "0.95rem" }}
              >
                🔄 Try Again ({pricingSettings.poseGenerationCreditCost} credits)
              </button>
              <button
                type="button"
                onClick={handleApplyGeneratedPose}
                className="btn-large btn-large-primary"
                style={{ flex: 1, minHeight: 46, fontSize: "0.95rem", background: "#16a34a", borderColor: "#15803d" }}
                id="btn-use-this-photo"
              >
                ✓ Use this photo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. Package Purchase / Top-up Modal */}
      {showPurchaseModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.75)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            zIndex: 220,
          }}
        >
          <div
            className="card"
            style={{
              background: "#ffffff",
              padding: "1.75rem",
              borderRadius: 16,
              maxWidth: 520,
              width: "100%",
              boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "1.5rem" }}>🪙</span>
                <h3 style={{ fontSize: "1.3rem", color: "#0f172a", margin: 0, fontWeight: 800 }}>
                  Credit Packages
                </h3>
              </div>
              <button
                onClick={() => setShowPurchaseModal(false)}
                style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer", color: "#64748b" }}
              >
                ✕
              </button>
            </div>

            {purchaseModalReason && (
              <div
                style={{
                  background: "#fffbeb",
                  border: "1px solid #fef3c7",
                  color: "#b45309",
                  padding: "0.75rem 1rem",
                  borderRadius: 8,
                  fontSize: "0.9rem",
                  marginBottom: "1rem",
                }}
              >
                ⚠️ {purchaseModalReason}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", padding: "0.75rem 1rem", borderRadius: 8, marginBottom: "1.25rem" }}>
              <span style={{ fontSize: "0.9rem", color: "#475569" }}>Your Current Balance:</span>
              <span style={{ fontSize: "1.1rem", fontWeight: 800, color: "#166534" }}>
                {userCredits !== null ? `${userCredits} Credits` : "0 Credits"}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  style={{
                    border: "1px solid #e2e8f0",
                    borderRadius: 10,
                    padding: "1rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    transition: "border 0.2s",
                  }}
                >
                  <div>
                    <h4 style={{ margin: "0 0 0.25rem 0", fontSize: "1.05rem", fontWeight: 700, color: "#1e293b" }}>
                      {pkg.name}
                    </h4>
                    <span style={{ color: "#4f46e5", fontWeight: 700, fontSize: "0.9rem" }}>
                      +{pkg.credits} Credits
                    </span>
                  </div>
                  <button
                    onClick={() => handleBuyPackage(pkg.id)}
                    className="btn-large btn-large-primary"
                    style={{ minHeight: 40, padding: "0.4rem 1.25rem", fontSize: "0.95rem" }}
                  >
                    Buy for {pkg.price} {pkg.currency}
                  </button>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowPurchaseModal(false)}
              className="btn-large btn-large-secondary"
              style={{ width: "100%" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Saved Progress Resume Banner */}
      {savedPrompt && (
        <div className="resume-banner">
          <div>
            <h3>💾 {t("saved_title")}</h3>
            <p>{t("saved_desc")}</p>
          </div>
          <div className="actions">
            <button onClick={handleRestoreSaved} className="btn-large btn-large-primary">
              {t("btn_restore_saved")}
            </button>
            <button onClick={handleDiscardSaved} className="btn-large btn-large-secondary">
              {t("btn_discard_saved")}
            </button>
          </div>
        </div>
      )}

      {/* Step Indicator Navigation Bar */}
      <Stepper
        steps={stepItems}
        currentIndex={currentStepIndex}
        onSelectStep={(idx) => setCurrentStepIndex(idx)}
      />

      {/* Main 2-Column Responsive Layout */}
      <div className="make-layout">
        {/* LEFT COLUMN: Slot Step Controls & Actions */}
        <div className="make-controls-col" style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
          {/* Styles & Variants Bar (if template provides them) */}
          {(template.styles?.length > 0 || template.variants?.length > 0) && (
            <div className="card" style={{ padding: "var(--space-4)" }}>
              {template.variants?.length > 0 && (
                <div style={{ marginBottom: template.styles?.length > 0 ? "var(--space-3)" : 0 }}>
                  <label className="form-label" style={{ fontSize: "0.85rem" }}>
                    {t("variants_title")}:
                  </label>
                  <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                    {template.variants.map((v) => {
                      const isSelected = activeVariantId === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setActiveVariantId(v.id)}
                          className={`filter-chip ${isSelected ? "active" : ""}`}
                          style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem" }}
                        >
                          <span
                            style={{
                              width: 14,
                              height: 14,
                              borderRadius: "50%",
                              backgroundColor: v.textColors?.text1 || "#0E7A53",
                              display: "inline-block",
                              border: "1px solid rgba(0,0,0,0.15)",
                            }}
                          />
                          <span>{v.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {template.styles?.length > 0 && (
                <div>
                  <label className="form-label" style={{ fontSize: "0.85rem" }}>
                    {t("styles_title")}:
                  </label>
                  <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
                    {template.styles.map((st) => {
                      const isSelected = activeStyleId === st.id;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => setActiveStyleId(st.id)}
                          className={`filter-chip ${isSelected ? "active" : ""}`}
                          style={{
                            color: isSelected ? "#ffffff" : st.color || "var(--text)",
                          }}
                        >
                          {st.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ACTIVE STEP CARD */}
          <div className="card" style={{ padding: "var(--space-6)" }}>
            {/* Step Header */}
            <div style={{ marginBottom: "var(--space-4)" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "var(--space-2)",
                }}
              >
                <span
                  style={{
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    color: "var(--green-700)",
                    letterSpacing: "0.05em",
                  }}
                >
                  {t("step_indicator", {
                    current: currentStepIndex + 1,
                    total: totalSteps,
                    label: isExportStep ? t("step_export") : currentSlot?.label || "",
                  })}
                </span>
                {!isExportStep && currentSlot && (
                  <span
                    className={`badge ${isSlotRequired(currentSlot) ? "badge-primary" : "badge-gold"}`}
                  >
                    {isSlotRequired(currentSlot) ? t("required") : t("optional")}
                  </span>
                )}
              </div>

              <h2 style={{ fontSize: "1.35rem", color: "var(--text)", margin: "0.25rem 0" }}>
                {isExportStep
                  ? t("export_title")
                  : currentSlot?.type === "image"
                  ? t("photo_slot_title", { label: currentSlot.label })
                  : t("text_slot_title", { label: currentSlot?.label || "" })}
              </h2>
              <p style={{ fontSize: "0.95rem", color: "var(--text-muted)", margin: 0 }}>
                {isExportStep
                  ? t("export_desc")
                  : currentSlot?.type === "image"
                  ? t("photo_slot_help")
                  : t("text_slot_help")}
              </p>
            </div>

            {/* --- CASE A: IMAGE SLOT STEP --- */}
            {!isExportStep && currentSlot?.type === "image" && (
              <div>
                {/* AI Pose Generation Error Alert */}
                {poseGenError && (
                  <div className="alert alert-warning">
                    <span style={{ fontWeight: 600 }}>⚠️ {poseGenError}</span>
                  </div>
                )}

                {/* Hard Errors Alert with Retry */}
                {photoError && (
                  <div className="alert alert-error" style={{ flexDirection: "column", gap: "var(--space-2)" }}>
                    <div style={{ fontWeight: 600 }}>⚠️ {photoError}</div>
                    <label
                      htmlFor={`photo-upload-${currentSlot.id}`}
                      className="btn-secondary"
                      style={{ alignSelf: "flex-start", cursor: "pointer", minHeight: 38, padding: "0.35rem 0.85rem", fontSize: "0.85rem" }}
                    >
                      {t("btn_retry")}
                    </label>
                  </div>
                )}

                {/* Soft Warnings Alert with "Use Anyway" */}
                {preCheckWarnings.length > 0 && (
                  <div className="alert alert-warning" style={{ flexDirection: "column", gap: "var(--space-2)" }}>
                    <div style={{ fontWeight: 600 }}>
                      ⚠️ {preCheckWarnings.join(" ")}
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleUseAnyway}
                      style={{ alignSelf: "flex-start" }}
                    >
                      {t("btn_use_anyway")}
                    </Button>
                  </div>
                )}

                {/* Face Warnings */}
                {faceWarnings.length > 0 && (
                  <div className="alert alert-warning">
                    ⚠️ {faceWarnings.join(" ")}
                  </div>
                )}

                {/* Loading / Progress Indicator while removing background */}
                {isRemovingBg && (
                  <div
                    style={{
                      padding: "var(--space-6)",
                      background: "var(--green-50)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-card)",
                      textAlign: "center",
                      marginBottom: "var(--space-4)",
                    }}
                  >
                    <ProgressBar
                      message={bgRemovalProgress || (lang === "bn" ? "কৃত্রিম বুদ্ধিমত্তা ব্যাকগ্রাউন্ড সরিয়ে নিচ্ছে..." : t("bg_processing"))}
                    />
                    <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "var(--space-2) 0 0 0" }}>
                      {lang === "bn" ? "অনুগ্রহ করে কয়েক মুহূর্ত অপেক্ষা করুন..." : "Please wait a few moments..."}
                    </p>
                  </div>
                )}

                {/* Photo Display on Checkerboard when done */}
                {currentCutout && !isRemovingBg && (
                  <div style={{ marginBottom: "var(--space-4)" }}>
                    <div
                      className="checkerboard"
                      style={{
                        height: 240,
                        position: "relative",
                        marginBottom: "var(--space-3)",
                        padding: "var(--space-3)",
                      }}
                    >
                      {cutoutImgUrl ? (
                        <img
                          src={cutoutImgUrl}
                          alt="Cutout Preview"
                          style={{ maxHeight: "100%", maxWidth: "100%", objectFit: "contain" }}
                        />
                      ) : (
                        <span style={{ color: "var(--green-700)", fontWeight: 600 }}>✓ Cutout ready</span>
                      )}
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.9rem", color: "var(--green-700)", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                        <span>✓</span> {lang === "bn" ? "ছবি সফলভাবে প্রস্তুত" : "Photo successfully cut out"}
                      </span>
                      <label
                        htmlFor={`photo-upload-${currentSlot.id}`}
                        className="btn-secondary"
                        style={{
                          cursor: "pointer",
                          minHeight: 38,
                          padding: "0.35rem 0.9rem",
                          fontSize: "0.85rem",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <RefreshIcon size={14} />
                        {t("btn_change_photo")}
                      </label>
                      <input
                        id={`photo-upload-${currentSlot.id}`}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (selectedPoseId) setSelectedPhotoForPose(file);
                          else processPhotoFile(file);
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Upload Dropzone when no cutout yet */}
                {!currentCutout && !isRemovingBg && (
                  <div>
                    {/* AI Pose Style Selector (if available) */}
                    {posesList.length > 0 && (
                      <div
                        style={{
                          marginBottom: "var(--space-4)",
                          background: "var(--surface)",
                          padding: "var(--space-4)",
                          borderRadius: "var(--radius-card)",
                          border: "1px solid var(--border)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
                          <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text)" }}>
                            🎭 {lang === "bn" ? "এআই পোজ স্টাইল (ঐচ্ছিক)" : "Choose an AI Pose Style (Optional)"}
                          </span>
                          {selectedPoseId && (
                            <span className="badge badge-primary">
                              {pricingSettings.poseGenerationCreditCost} Credits
                            </span>
                          )}
                        </div>
                        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "0 0 0.75rem 0" }}>
                          {lang === "bn"
                            ? "একটি পোজ বেছে নিন। এআই স্বয়ংক্রিয়ভাবে আপনাকে সেই পোজে বসিয়ে দেবে।"
                            : "Pick a pose. AI synthesizes you in that pose before placing into the template."}
                        </p>

                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "0.5rem" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPoseId(null);
                              setSelectedPhotoForPose(null);
                            }}
                            className={`filter-chip ${selectedPoseId === null ? "active" : ""}`}
                            style={{
                              padding: "0.6rem 0.4rem",
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              minHeight: 75,
                              whiteSpace: "normal",
                              lineHeight: 1.2,
                            }}
                          >
                            <span style={{ fontSize: "1.3rem", marginBottom: 2 }}>📸</span>
                            <span style={{ fontSize: "0.75rem" }}>Normal (No AI)</span>
                          </button>

                          {(currentSlot.allowedPoses && currentSlot.allowedPoses.length > 0
                            ? posesList.filter((p) => currentSlot.allowedPoses?.includes(p.id))
                            : posesList
                          ).map((pose) => {
                            const isSelected = selectedPoseId === pose.id;
                            return (
                              <button
                                key={pose.id}
                                type="button"
                                onClick={() => setSelectedPoseId(pose.id)}
                                className={`filter-chip ${isSelected ? "active" : ""}`}
                                style={{
                                  padding: "0.4rem",
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  minHeight: 75,
                                  whiteSpace: "normal",
                                  lineHeight: 1.2,
                                }}
                              >
                                {pose.previewImagePath ? (
                                  <img
                                    src={pose.previewImagePath}
                                    alt={pose.name}
                                    style={{ width: "100%", height: 40, objectFit: "cover", borderRadius: 4 }}
                                  />
                                ) : (
                                  <span style={{ fontSize: "1.1rem" }}>🎭</span>
                                )}
                                <span style={{ fontSize: "0.75rem", marginTop: 4 }}>{pose.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Large Drag-and-Drop Upload Area */}
                    <div
                      className={`upload-dropzone ${isDragOver ? "dragover" : ""}`}
                      onDragOver={(e) => {
                        e.preventDefault();
                        setIsDragOver(true);
                      }}
                      onDragLeave={() => setIsDragOver(false)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setIsDragOver(false);
                        const file = e.dataTransfer.files?.[0];
                        if (!file) return;
                        if (selectedPoseId) setSelectedPhotoForPose(file);
                        else processPhotoFile(file);
                      }}
                      onClick={() => {
                        document.getElementById(`photo-upload-${currentSlot.id}`)?.click();
                      }}
                    >
                      <UploadIcon className="upload-icon" />
                      <div>
                        <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text)", margin: "0 0 0.25rem 0" }}>
                          {lang === "bn" ? "ছবি আপলোড করতে ক্লিক করুন বা টেনে এনে ফেলুন" : "Click or drag & drop photo here"}
                        </h3>
                        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: 0 }}>
                          💡 {lang === "bn" ? "পরিষ্কার এবং সরাসরি ক্যামেরার দিকে তাকানো ছবি ব্যবহার করুন" : "Use a clear, front-facing photo"}
                        </p>
                      </div>

                      <Button
                        type="button"
                        variant="secondary"
                        size="md"
                        onClick={(e) => {
                          e.stopPropagation();
                          document.getElementById(`photo-upload-${currentSlot.id}`)?.click();
                        }}
                      >
                        {selectedPoseId ? (lang === "bn" ? "এআই পোসের জন্য ছবি দিন" : "Upload Photo for AI Pose") : t("btn_choose_photo")}
                      </Button>

                      <input
                        id={`photo-upload-${currentSlot.id}`}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        style={{ display: "none" }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          if (selectedPoseId) setSelectedPhotoForPose(file);
                          else processPhotoFile(file);
                        }}
                      />
                    </div>

                    {/* If Pose selected and photo selected */}
                    {selectedPoseId && selectedPhotoForPose && (
                      <div
                        style={{
                          marginTop: "var(--space-3)",
                          background: "var(--green-50)",
                          border: "1.5px solid var(--green-600)",
                          borderRadius: "var(--radius-card)",
                          padding: "var(--space-4)",
                          textAlign: "center",
                        }}
                      >
                        <div style={{ fontSize: "0.95rem", color: "var(--green-700)", fontWeight: 700, marginBottom: "0.25rem" }}>
                          📸 {lang === "bn" ? "এআই পোজ তৈরির জন্য ছবি প্রস্তুত!" : "Ready to synthesize photo with pose!"}
                        </div>
                        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", margin: "0 0 0.75rem 0" }}>
                          {selectedPhotoForPose.name} ({Math.round(selectedPhotoForPose.size / 1024)} KB)
                        </p>
                        <Button
                          type="button"
                          variant="primary"
                          size="md"
                          onClick={() => handleGeneratePose()}
                          disabled={isGeneratingPose}
                          loading={isGeneratingPose}
                          style={{ width: "100%" }}
                          id="btn-generate-ai-pose"
                        >
                          ✨ Generate in Selected Pose ({pricingSettings.poseGenerationCreditCost} Credits)
                        </Button>
                      </div>
                    )}

                  </div>
                )}
              </div>
            )}

            {/* --- CASE B: TEXT SLOT STEP --- */}
            {!isExportStep && currentSlot?.type === "text" && (
              <div>
                <label className="form-label">
                  {currentSlot.label}
                </label>
                <textarea
                  className="text-slot-input"
                  rows={3}
                  placeholder={t("text_placeholder")}
                  value={currentTextVal}
                  maxLength={currentSlot.maxChars || 50}
                  onChange={(e) => {
                    const val = e.target.value;
                    setTexts((prev) => ({
                      ...prev,
                      [currentSlot.id]: val,
                    }));
                    const matched = checkBlocklist(val);
                    if (matched) {
                      setBlocklistError(t("blocklist_warn", { word: matched }));
                    } else {
                      setBlocklistError(null);
                    }
                  }}
                />

                {blocklistError && (
                  <div className="alert alert-error" style={{ marginTop: "0.5rem" }}>
                    ⚠️ {blocklistError}
                  </div>
                )}

                <div className="char-counter">
                  <span>{t("lines_allowed", { lines: currentSlot.maxLines || 2 })}</span>
                  <span
                    style={{
                      color: currentTextVal.length >= (currentSlot.maxChars || 50) ? "var(--red-600)" : "var(--text-muted)",
                      fontWeight: 700,
                    }}
                  >
                    {t("char_count", {
                      current: currentTextVal.length,
                      max: currentSlot.maxChars || 50,
                    })}
                  </span>
                </div>

                {/* Text Slot Styling Panel */}
                {currentSlot.allowStyling !== false && (
                  <TextSlotStylePanel
                    slot={currentSlot}
                    currentText={currentTextVal}
                    style={textStyles[currentSlot.id] || getDefaultSlotStyle(currentSlot)}
                    onChange={(newStyle) => {
                      setTextStyles((prev) => ({
                        ...prev,
                        [currentSlot.id]: newStyle,
                      }));
                    }}
                    lang={lang}
                    isMinFontSize={Boolean(minFontWarnings[currentSlot.id])}
                  />
                )}
              </div>
            )}

            {/* --- CASE C: REVIEW & EXPORT STEP --- */}
            {isExportStep && (
              <div>
                {/* Layout choice */}
                {template.layouts?.length > 1 && (
                  <div style={{ marginBottom: "var(--space-4)" }}>
                    <label className="form-label">{t("layout_label")}</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)" }}>
                      {template.layouts.map((ly) => (
                        <button
                          key={ly.id}
                          type="button"
                          onClick={() => setActiveLayoutId(ly.id)}
                          className={`filter-chip ${activeLayoutId === ly.id ? "active" : ""}`}
                          style={{ minHeight: 48, textAlign: "center" }}
                        >
                          <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>{ly.name}</div>
                          <div style={{ fontSize: "0.75rem", opacity: 0.8 }}>{ly.width} × {ly.height}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Resolution Choice: HD 1x vs Ultra HD 2x */}
                <div style={{ marginBottom: "var(--space-4)" }}>
                  <label className="form-label">{lang === "bn" ? "রেজোলিউশন" : "Resolution"}</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)" }}>
                    <button
                      type="button"
                      onClick={() => setExportScale(1)}
                      className={`filter-chip ${exportScale === 1 ? "active" : ""}`}
                    >
                      HD (স্ট্যান্ডার্ড)
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportScale(2)}
                      className={`filter-chip ${exportScale === 2 ? "active" : ""}`}
                    >
                      Ultra HD (প্রিন্ট 4K)
                    </button>
                  </div>
                </div>

                {/* Format choice: PNG vs JPG */}
                <div style={{ marginBottom: "var(--space-4)" }}>
                  <label className="form-label">{t("format_label")}</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-2)" }}>
                    <button
                      type="button"
                      onClick={() => setExportFormat("png")}
                      className={`filter-chip ${exportFormat === "png" ? "active" : ""}`}
                    >
                      PNG (Crisp & Lossless)
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportFormat("jpg")}
                      className={`filter-chip ${exportFormat === "jpg" ? "active" : ""}`}
                    >
                      JPG (Photo)
                    </button>
                  </div>
                </div>

                {/* JPG quality (if JPG) */}
                {exportFormat === "jpg" && (
                  <div style={{ marginBottom: "var(--space-4)" }}>
                    <label className="form-label">{t("quality_label")}</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-2)" }}>
                      <button
                        type="button"
                        onClick={() => setJpgQuality(1.0)}
                        className={`filter-chip ${jpgQuality === 1.0 ? "active" : ""}`}
                      >
                        100%
                      </button>
                      <button
                        type="button"
                        onClick={() => setJpgQuality(0.95)}
                        className={`filter-chip ${jpgQuality === 0.95 ? "active" : ""}`}
                      >
                        95%
                      </button>
                      <button
                        type="button"
                        onClick={() => setJpgQuality(0.85)}
                        className={`filter-chip ${jpgQuality === 0.85 ? "active" : ""}`}
                      >
                        85%
                      </button>
                    </div>
                  </div>
                )}

                {/* Single Primary Action: Large Red Download Button */}
                <Button
                  type="button"
                  variant="primary"
                  size="lg"
                  disabled={isExporting}
                  loading={isExporting}
                  onClick={handleExportDownload}
                  style={{ width: "100%", fontSize: "1.1rem", marginBottom: "var(--space-3)" }}
                  icon={<DownloadIcon size={20} />}
                >
                  {isExporting ? t("btn_downloading") : `${t("btn_download")} (High Resolution)`}
                </Button>

                {/* Save Poster button */}
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  disabled={isSavingPoster}
                  loading={isSavingPoster}
                  onClick={handleSavePoster}
                  style={{ width: "100%" }}
                >
                  {isSavingPoster ? t("btn_saving_poster") : t("btn_save_poster")}
                </Button>

                {/* Success state after download */}
                {exportSuccess && (
                  <div className="alert alert-success" style={{ marginTop: "var(--space-4)", flexDirection: "column", gap: "var(--space-3)", textAlign: "center", alignItems: "center" }}>
                    <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>
                      ✓ {t("export_success")}
                    </div>
                    <p style={{ margin: 0, fontSize: "0.9rem", color: "var(--green-700)" }}>
                      {lang === "bn" ? "আপনার পোস্টার সফলভাবে ডাউনলোড হয়েছে!" : "Your poster was downloaded successfully!"}
                    </p>
                    <Link
                      href="/"
                      className="btn-secondary"
                      style={{ textDecoration: "none", width: "100%", maxWidth: 280, textAlign: "center" }}
                    >
                      {lang === "bn" ? "আরেকটি পোস্টার তৈরি করুন" : "Make another poster"} →
                    </Link>
                  </div>
                )}
              </div>
            )}

            {/* Navigation Buttons: Next / Back / Skip */}
            <div
              style={{
                display: "flex",
                gap: "var(--space-3)",
                marginTop: "var(--space-6)",
                paddingTop: "var(--space-4)",
                borderTop: "1px solid var(--border)",
              }}
            >
              {currentStepIndex > 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handlePrevStep}
                  style={{ flex: 1 }}
                >
                  ← {t("btn_back")}
                </Button>
              )}

              {!isExportStep && currentSlot && !isSlotRequired(currentSlot) && !cutoutCanvases[currentSlot.id] && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleSkipStep}
                  style={{ flex: 1 }}
                >
                  {t("btn_skip")}
                </Button>
              )}

              {!isExportStep && (
                <Button
                  type="button"
                  variant="primary"
                  disabled={!canProceed()}
                  onClick={handleNextStep}
                  style={{ flex: 2 }}
                >
                  {t("btn_next")} →
                </Button>
              )}

              {isExportStep && (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setCurrentStepIndex(0)}
                  style={{ flex: 1 }}
                >
                  {t("btn_back_to_edit")}
                </Button>
              )}
            </div>

            {/* Validation Hint */}
            {getValidationHint() && (
              <div
                style={{
                  marginTop: "var(--space-3)",
                  fontSize: "0.85rem",
                  color: "var(--text-muted)",
                  textAlign: "center",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <span>ℹ️</span> {getValidationHint()}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Live Poster Preview & Tidy Adjustment Card */}
        <div className="make-preview-col" style={{ position: "sticky", top: "80px" }}>
          <div className="preview-card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                width: "100%",
                marginBottom: "var(--space-2)",
                fontSize: "0.85rem",
                color: "var(--text-muted)",
                fontWeight: 600,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                🖥️ {t("live_preview")}
              </span>
              {isRendering && (
                <span className="badge badge-primary">
                  {t("rendering")}
                </span>
              )}
            </div>

            <div className="canvas-wrapper">
              <canvas
                ref={canvasRef}
                style={{
                  maxWidth: "100%",
                  maxHeight: "68vh",
                  height: "auto",
                  display: "block",
                  touchAction: "none",
                  cursor: !isExportStep && currentSlot?.type === "image" && currentSlot.allowAdjust && currentCutout ? "grab" : "default",
                }}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerCancel={handlePointerUp}
              />
            </div>

            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "var(--space-2)", marginBottom: 0 }}>
              {lang === "bn" ? "উচ্চ রেজোলিউশন ও ওয়াটারমার্কমুক্ত প্রিভিউ" : "High-resolution, watermark-free preview"}
            </p>
          </div>

          {/* Tidy manual adjustment card under preview */}
          {!isExportStep && currentSlot?.type === "image" && currentCutout && (
            <div className="card" style={{ marginTop: "var(--space-4)", padding: "var(--space-4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-3)" }}>
                <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text)" }}>
                  {t("btn_adjust_photo")}
                </span>
                <button
                  type="button"
                  onClick={handleResetAdjustment}
                  className="btn-secondary"
                  style={{ minHeight: 34, padding: "0.2rem 0.65rem", fontSize: "0.8rem", display: "inline-flex", alignItems: "center", gap: 4 }}
                >
                  <RefreshIcon size={12} />
                  {t("btn_reset")}
                </button>
              </div>

              <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginBottom: "var(--space-3)" }}>
                {t("photo_drag_hint")}
              </p>

              {/* Zoom Slider */}
              <div style={{ marginBottom: "var(--space-3)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.25rem", color: "var(--text)" }}>
                  <span>{t("photo_zoom")}</span>
                  <span style={{ color: "var(--green-700)", fontWeight: 700 }}>
                    {Math.round(currentAdjustment.zoom * 100)}%
                  </span>
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <button
                    type="button"
                    onClick={() => handleZoomChange(currentAdjustment.zoom - 0.05)}
                    className="btn-secondary"
                    style={{ minHeight: 38, width: 40, padding: 0 }}
                    aria-label="Zoom out"
                  >
                    <ZoomOutIcon size={16} />
                  </button>
                  <input
                    type="range"
                    min={currentSlot.minZoom ?? 0.4}
                    max={currentSlot.maxZoom ?? 2.5}
                    step={0.01}
                    value={currentAdjustment.zoom}
                    onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
                    style={{ flex: 1, accentColor: "var(--green-600)" }}
                  />
                  <button
                    type="button"
                    onClick={() => handleZoomChange(currentAdjustment.zoom + 0.05)}
                    className="btn-secondary"
                    style={{ minHeight: 38, width: 40, padding: 0 }}
                    aria-label="Zoom in"
                  >
                    <ZoomInIcon size={16} />
                  </button>
                </div>
              </div>

              {/* D-Pad Arrows */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)" }}>
                  {t("photo_nudge")}
                </span>
                <div className="dpad-container">
                  <button type="button" className="dpad-btn dpad-up" onClick={() => handleNudge(0, -0.02)} aria-label={t("nudge_up")}>▲</button>
                  <button type="button" className="dpad-btn dpad-left" onClick={() => handleNudge(-0.02, 0)} aria-label={t("nudge_left")}>◀</button>
                  <button type="button" className="dpad-btn dpad-center" onClick={handleResetAdjustment} aria-label={t("btn_reset")}>•</button>
                  <button type="button" className="dpad-btn dpad-right" onClick={() => handleNudge(0.02, 0)} aria-label={t("nudge_right")}>▶</button>
                  <button type="button" className="dpad-btn dpad-down" onClick={() => handleNudge(0, 0.02)} aria-label={t("nudge_down")}>▼</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Mobile Action Bar */}
      <div className="mobile-action-bar">
        {currentStepIndex > 0 && (
          <button
            type="button"
            onClick={handlePrevStep}
            className="btn-secondary"
            style={{ flex: 1, minHeight: 48 }}
          >
            ← {t("btn_back")}
          </button>
        )}
        {isExportStep ? (
          <Button
            variant="primary"
            size="lg"
            disabled={isExporting}
            loading={isExporting}
            onClick={handleExportDownload}
            style={{ flex: 2, minHeight: 48 }}
            icon={<DownloadIcon size={18} />}
          >
            {isExporting ? t("btn_downloading") : t("btn_download")}
          </Button>
        ) : (
          <Button
            variant="primary"
            size="lg"
            disabled={!canProceed()}
            onClick={handleNextStep}
            style={{ flex: 2, minHeight: 48 }}
          >
            {t("btn_next")} →
          </Button>
        )}
      </div>
    </div>
  );
}

export default function MakePosterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: templateId } = use(params);

  return (
    <Suspense
      fallback={
        <div className="container" style={{ textAlign: "center", padding: "4rem 1rem" }}>
          <div className="loading-spinner" style={{ margin: "0 auto 1.5rem" }} />
          <p>Loading editor...</p>
        </div>
      }
    >
      <MakePosterContent templateId={templateId} />
    </Suspense>
  );
}
