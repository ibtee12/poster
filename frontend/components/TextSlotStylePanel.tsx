"use client";

import React, { useRef } from "react";
import {
  TextSlot,
  UserTextSlotStyle,
  OutlineSizeStep,
  ShadowStrengthStep,
  USER_TEXT_STYLE_PRESETS,
  DEFAULT_ALLOWED_FONTS,
  DEFAULT_ALLOWED_COLORS,
  getDefaultSlotStyle,
  isLowContrast,
} from "@/lib/templates";

interface TextSlotStylePanelProps {
  slot: TextSlot;
  currentText: string;
  style: UserTextSlotStyle;
  onChange: (newStyle: UserTextSlotStyle) => void;
  lang: "bn" | "en";
  isMinFontSize?: boolean;
}

export function TextSlotStylePanel({
  slot,
  currentText,
  style,
  onChange,
  lang,
  isMinFontSize,
}: TextSlotStylePanelProps) {
  const customColorInputRef = useRef<HTMLInputElement | null>(null);
  const customOutlineColorInputRef = useRef<HTMLInputElement | null>(null);

  const isBn = lang === "bn";

  // Allowed fonts & colors from slot or defaults
  const fonts = slot.allowedFonts && slot.allowedFonts.length > 0
    ? slot.allowedFonts
    : DEFAULT_ALLOWED_FONTS;

  const colors = slot.allowedColors && slot.allowedColors.length > 0
    ? slot.allowedColors
    : DEFAULT_ALLOWED_COLORS;

  const allowCustomColor = slot.allowCustomColor !== false;
  const allowOutline = slot.allowOutline !== false;
  const allowShadow = slot.allowShadow !== false;
  const allowSizeAdjust = slot.allowSizeAdjust !== false;

  // Filter presets if slot restricts them
  const offeredPresets = slot.offeredPresets && slot.offeredPresets.length > 0
    ? USER_TEXT_STYLE_PRESETS.filter(
        (p) => slot.offeredPresets!.includes(p.id) || slot.offeredPresets!.includes(p.nameEn)
      )
    : USER_TEXT_STYLE_PRESETS;

  // Sample slogan for font preview if user hasn't typed anything yet
  const sampleDisplay = currentText.trim().length > 0
    ? (currentText.length > 20 ? currentText.slice(0, 20) + "…" : currentText)
    : (isBn ? "আমার সোনার বাংলা" : "Bangladesh Victory");

  // Contrast check: only active if outline is ON
  const lowContrast = style.outline.on && isLowContrast(style.fill, style.outline.color);

  // Update helpers
  const updateStyle = (patch: Partial<UserTextSlotStyle>) => {
    onChange({
      ...style,
      ...patch,
    });
  };

  const updateOutline = (patch: Partial<UserTextSlotStyle["outline"]>) => {
    onChange({
      ...style,
      outline: {
        ...style.outline,
        ...patch,
      },
    });
  };

  const updateShadow = (patch: Partial<UserTextSlotStyle["shadow"]>) => {
    onChange({
      ...style,
      shadow: {
        ...style.shadow,
        ...patch,
      },
    });
  };

  return (
    <div
      style={{
        marginTop: "1.25rem",
        padding: "1.25rem",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      }}
    >
      {/* Header with Title and Reset Button */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
          paddingBottom: "0.75rem",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontSize: "1.25rem" }}>✨</span>
          <h4
            style={{
              margin: 0,
              fontSize: "1.05rem",
              fontWeight: 700,
              color: "var(--text)",
            }}
          >
            {isBn ? "লেখার স্টাইল (Text Style)" : "Text Style"}
          </h4>
        </div>
        <button
          type="button"
          onClick={() => onChange(getDefaultSlotStyle(slot))}
          style={{
            minHeight: "48px",
            padding: "0.5rem 1rem",
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            fontSize: "0.85rem",
            fontWeight: 600,
            color: "var(--text-muted)",
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "0.35rem",
            transition: "all 0.15s ease",
          }}
          title={isBn ? "ডিফল্ট স্টাইলে ফিরুন" : "Reset to default style"}
        >
          <span>↺</span>
          <span>{isBn ? "রিসেট" : "Reset"}</span>
        </button>
      </div>

      {/* Non-blocking Warnings */}
      {lowContrast && (
        <div
          role="alert"
          style={{
            padding: "0.75rem 1rem",
            marginBottom: "1rem",
            background: "#FFFBEB",
            border: "1px solid #FCD34D",
            borderRadius: "var(--radius-md)",
            color: "#92400E",
            fontSize: "0.88rem",
            lineHeight: 1.4,
            display: "flex",
            alignItems: "flex-start",
            gap: "0.5rem",
          }}
        >
          <span style={{ fontSize: "1.1rem" }}>⚠️</span>
          <div>
            <strong>{isBn ? "সতর্কতা: " : "Warning: "}</strong>
            {isBn
              ? "টেক্সট এবং আউটলাইনের রঙ কাছাকাছি হওয়ায় লেখা পড়তে সমস্যা হতে পারে। ভিন্ন রঙের আউটলাইন বেছে নিন।"
              : "Text color and outline color have low contrast and may be hard to read. Choose contrasting colors."}
          </div>
        </div>
      )}

      {isMinFontSize && (
        <div
          role="status"
          style={{
            padding: "0.75rem 1rem",
            marginBottom: "1rem",
            background: "#EFF6FF",
            border: "1px solid #93C5FD",
            borderRadius: "var(--radius-md)",
            color: "#1E40AF",
            fontSize: "0.88rem",
            lineHeight: 1.4,
            display: "flex",
            alignItems: "flex-start",
            gap: "0.5rem",
          }}
        >
          <span style={{ fontSize: "1.1rem" }}>💡</span>
          <div>
            <strong>{isBn ? "পরামর্শ: " : "Hint: "}</strong>
            {isBn
              ? "লেখাটি ছোট করুন অথবা চিকন আউটলাইন নির্বাচন করুন"
              : "Shorten the text or choose a thinner outline"}
          </div>
        </div>
      )}

      {/* 1. Quick Styles Presets */}
      {offeredPresets.length > 0 && (
        <div style={{ marginBottom: "1.25rem" }}>
          <label
            style={{
              display: "block",
              fontSize: "0.88rem",
              fontWeight: 700,
              color: "var(--text-muted)",
              marginBottom: "0.5rem",
            }}
          >
            {isBn ? "কুইক স্টাইল প্রিসেট (Quick Styles)" : "Quick Styles"}
          </label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: "0.5rem",
            }}
          >
            {offeredPresets.map((preset) => {
              const isSelected =
                style.fill.toLowerCase() === preset.style.fill.toLowerCase() &&
                style.outline.on === preset.style.outline.on &&
                (!preset.style.outline.on ||
                  style.outline.color.toLowerCase() === preset.style.outline.color.toLowerCase());

              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => onChange({ ...preset.style })}
                  style={{
                    minHeight: "48px",
                    padding: "0.5rem 0.75rem",
                    background: isSelected ? "var(--green-50)" : "var(--bg)",
                    border: isSelected
                      ? "2px solid var(--green-600)"
                      : "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    textAlign: "center",
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "0.25rem",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.82rem",
                      fontWeight: isSelected ? 700 : 600,
                      color: isSelected ? "var(--green-700)" : "var(--text)",
                      lineHeight: 1.2,
                    }}
                  >
                    {isBn ? preset.nameBn : preset.nameEn}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. Font Selection Buttons */}
      <div style={{ marginBottom: "1.25rem" }}>
        <label
          style={{
            display: "block",
            fontSize: "0.88rem",
            fontWeight: 700,
            color: "var(--text-muted)",
            marginBottom: "0.5rem",
          }}
        >
          {isBn ? "ফন্ট নির্বাচন করুন (Font)" : "Choose Font"}
        </label>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
            gap: "0.5rem",
          }}
        >
          {fonts.map((f) => {
            const isSelected = style.font === f;
            return (
              <button
                key={f}
                type="button"
                onClick={() => updateStyle({ font: f })}
                style={{
                  minHeight: "52px",
                  padding: "0.5rem 0.75rem",
                  background: isSelected ? "var(--green-50)" : "var(--bg)",
                  border: isSelected
                    ? "2px solid var(--green-600)"
                    : "1px solid var(--border)",
                  borderRadius: "var(--radius-md)",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.2rem",
                  transition: "all 0.15s ease",
                }}
              >
                <span
                  style={{
                    fontFamily: `"${f}", sans-serif`,
                    fontSize: "1.05rem",
                    fontWeight: 700,
                    color: isSelected ? "var(--green-700)" : "var(--text)",
                    lineHeight: 1.2,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: "100%",
                  }}
                >
                  {sampleDisplay}
                </span>
                <span
                  style={{
                    fontSize: "0.7rem",
                    color: isSelected ? "var(--green-600)" : "var(--text-muted)",
                    fontWeight: 600,
                  }}
                >
                  {f} {isSelected && "✓"}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Text Color Selection Circles */}
      <div style={{ marginBottom: "1.25rem" }}>
        <label
          style={{
            display: "block",
            fontSize: "0.88rem",
            fontWeight: 700,
            color: "var(--text-muted)",
            marginBottom: "0.5rem",
          }}
        >
          {isBn ? "লেখার রঙ (Text Color)" : "Text Color"}
        </label>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            flexWrap: "wrap",
          }}
        >
          {colors.map((c) => {
            const isSelected = style.fill.toLowerCase() === c.toLowerCase();
            return (
              <button
                key={c}
                type="button"
                onClick={() => updateStyle({ fill: c })}
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: c,
                  border: isSelected ? "3px solid var(--green-600)" : "2px solid rgba(0,0,0,0.15)",
                  boxShadow: isSelected
                    ? "0 0 0 3px var(--green-50), 0 2px 8px rgba(0,0,0,0.2)"
                    : "0 1px 3px rgba(0,0,0,0.1)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  transform: isSelected ? "scale(1.08)" : "scale(1)",
                }}
                title={c}
              >
                {isSelected && (
                  <span
                    style={{
                      fontSize: "1.1rem",
                      fontWeight: 900,
                      color: c.toLowerCase() === "#ffffff" ? "#12261D" : "#FFFFFF",
                      textShadow: c.toLowerCase() === "#ffffff" ? "none" : "0 1px 2px rgba(0,0,0,0.6)",
                    }}
                  >
                    ✓
                  </span>
                )}
              </button>
            );
          })}

          {/* Custom Color Circle */}
          {allowCustomColor && (
            <div style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => customColorInputRef.current?.click()}
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background:
                    "conic-gradient(from 180deg at 50% 50%, #FF0000 0deg, #FFD400 60deg, #00FF00 120deg, #00FFFF 180deg, #0000FF 240deg, #FF00FF 300deg, #FF0000 360deg)",
                  border: !colors.map((x) => x.toLowerCase()).includes(style.fill.toLowerCase())
                    ? "3px solid var(--green-600)"
                    : "2px solid rgba(0,0,0,0.2)",
                  boxShadow: !colors.map((x) => x.toLowerCase()).includes(style.fill.toLowerCase())
                    ? "0 0 0 3px var(--green-50), 0 2px 8px rgba(0,0,0,0.2)"
                    : "0 1px 3px rgba(0,0,0,0.1)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: 0,
                  transition: "transform 0.15s ease",
                  transform: !colors.map((x) => x.toLowerCase()).includes(style.fill.toLowerCase())
                    ? "scale(1.08)"
                    : "scale(1)",
                }}
                title={isBn ? "পছন্দমতো রঙ নির্বাচন করুন" : "Custom color"}
              >
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    background: "rgba(255,255,255,0.9)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    color: "#1e293b",
                  }}
                >
                  +
                </div>
              </button>
              <input
                ref={customColorInputRef}
                type="color"
                value={style.fill}
                onChange={(e) => updateStyle({ fill: e.target.value })}
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  width: 1,
                  height: 1,
                  opacity: 0,
                  pointerEvents: "none",
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* 4. Outline Section */}
      {allowOutline && (
        <div
          style={{
            marginBottom: "1.25rem",
            padding: "0.85rem",
            background: "var(--bg)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border)",
          }}
        >
          {/* Outline Toggle Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: style.outline.on ? "0.85rem" : 0,
            }}
          >
            <div>
              <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text)" }}>
                {isBn ? "আউটলাইন বর্ডার (Outline)" : "Outline Border"}
              </span>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                {isBn ? "লেখার চারপাশের বর্ডার লাইন" : "Stroke outline around letters"}
              </div>
            </div>

            <button
              type="button"
              onClick={() => updateOutline({ on: !style.outline.on })}
              style={{
                minHeight: "48px",
                minWidth: "80px",
                padding: "0.5rem 1rem",
                borderRadius: "var(--radius-full)",
                border: style.outline.on
                  ? "2px solid var(--green-600)"
                  : "1px solid var(--border)",
                background: style.outline.on ? "var(--green-600)" : "var(--surface)",
                color: style.outline.on ? "#ffffff" : "var(--text-muted)",
                fontSize: "0.9rem",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {style.outline.on
                ? isBn ? "চালু ✓" : "ON ✓"
                : isBn ? "বন্ধ" : "OFF"}
            </button>
          </div>

          {/* When Outline is ON: Sizing & Colors */}
          {style.outline.on && (
            <div style={{ paddingTop: "0.5rem", borderTop: "1px solid var(--border)" }}>
              {/* Size choice (3 steps: কম / মাঝারি / বেশি) */}
              <div style={{ marginBottom: "0.85rem" }}>
                <span
                  style={{
                    display: "block",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    marginBottom: "0.4rem",
                  }}
                >
                  {isBn ? "আউটলাইনের পুরুত্ব (Size)" : "Outline Size"}
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                  {(
                    [
                      { key: "small", labelBn: "কম", labelEn: "Thin" },
                      { key: "medium", labelBn: "মাঝারি", labelEn: "Medium" },
                      { key: "large", labelBn: "বেশি", labelEn: "Thick" },
                    ] as const
                  ).map((step) => {
                    const isSelected = style.outline.size === step.key;
                    return (
                      <button
                        key={step.key}
                        type="button"
                        onClick={() => updateOutline({ size: step.key })}
                        style={{
                          minHeight: "48px",
                          padding: "0.5rem",
                          background: isSelected ? "var(--green-50)" : "var(--surface)",
                          border: isSelected
                            ? "2px solid var(--green-600)"
                            : "1px solid var(--border)",
                          borderRadius: "var(--radius-md)",
                          color: isSelected ? "var(--green-700)" : "var(--text)",
                          fontWeight: isSelected ? 700 : 500,
                          fontSize: "0.88rem",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {isBn ? step.labelBn : step.labelEn}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Outline Color Circle Row */}
              <div>
                <span
                  style={{
                    display: "block",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    marginBottom: "0.4rem",
                  }}
                >
                  {isBn ? "আউটলাইনের রঙ" : "Outline Color"}
                </span>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    flexWrap: "wrap",
                  }}
                >
                  {colors.map((c) => {
                    const isSelected = style.outline.color.toLowerCase() === c.toLowerCase();
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => updateOutline({ color: c })}
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "50%",
                          background: c,
                          border: isSelected
                            ? "3px solid var(--green-600)"
                            : "2px solid rgba(0,0,0,0.15)",
                          boxShadow: isSelected
                            ? "0 0 0 3px var(--green-50), 0 2px 8px rgba(0,0,0,0.2)"
                            : "0 1px 3px rgba(0,0,0,0.1)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 0,
                          transition: "transform 0.15s ease",
                          transform: isSelected ? "scale(1.08)" : "scale(1)",
                        }}
                        title={c}
                      >
                        {isSelected && (
                          <span
                            style={{
                              fontSize: "1.1rem",
                              fontWeight: 900,
                              color: c.toLowerCase() === "#ffffff" ? "#12261D" : "#FFFFFF",
                              textShadow:
                                c.toLowerCase() === "#ffffff" ? "none" : "0 1px 2px rgba(0,0,0,0.6)",
                            }}
                          >
                            ✓
                          </span>
                        )}
                      </button>
                    );
                  })}

                  {/* Custom Outline Color */}
                  {allowCustomColor && (
                    <div style={{ position: "relative" }}>
                      <button
                        type="button"
                        onClick={() => customOutlineColorInputRef.current?.click()}
                        style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "50%",
                          background:
                            "conic-gradient(from 180deg at 50% 50%, #FF0000 0deg, #FFD400 60deg, #00FF00 120deg, #00FFFF 180deg, #0000FF 240deg, #FF00FF 300deg, #FF0000 360deg)",
                          border: !colors.map((x) => x.toLowerCase()).includes(style.outline.color.toLowerCase())
                            ? "3px solid var(--green-600)"
                            : "2px solid rgba(0,0,0,0.2)",
                          boxShadow: !colors.map((x) => x.toLowerCase()).includes(style.outline.color.toLowerCase())
                            ? "0 0 0 3px var(--green-50), 0 2px 8px rgba(0,0,0,0.2)"
                            : "0 1px 3px rgba(0,0,0,0.1)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: 0,
                        }}
                        title={isBn ? "পছন্দমতো আউটলাইন রঙ" : "Custom outline color"}
                      >
                        <div
                          style={{
                            width: "20px",
                            height: "20px",
                            borderRadius: "50%",
                            background: "rgba(255,255,255,0.9)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: "0.85rem",
                            fontWeight: 700,
                            color: "#1e293b",
                          }}
                        >
                          +
                        </div>
                      </button>
                      <input
                        ref={customOutlineColorInputRef}
                        type="color"
                        value={style.outline.color}
                        onChange={(e) => updateOutline({ color: e.target.value })}
                        style={{
                          position: "absolute",
                          top: 0,
                          left: 0,
                          width: 1,
                          height: 1,
                          opacity: 0,
                          pointerEvents: "none",
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5. Shadow Section */}
      {allowShadow && (
        <div
          style={{
            marginBottom: "1.25rem",
            padding: "0.85rem",
            background: "var(--bg)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border)",
          }}
        >
          {/* Shadow Toggle Header */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: style.shadow.on ? "0.85rem" : 0,
            }}
          >
            <div>
              <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text)" }}>
                {isBn ? "ছায়া (Drop Shadow)" : "Drop Shadow"}
              </span>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                {isBn ? "লেখার পেছনে গভীরতা এবং স্পষ্টতা বৃদ্ধি" : "Background depth behind letters"}
              </div>
            </div>

            <button
              type="button"
              onClick={() => updateShadow({ on: !style.shadow.on })}
              style={{
                minHeight: "48px",
                minWidth: "80px",
                padding: "0.5rem 1rem",
                borderRadius: "var(--radius-full)",
                border: style.shadow.on
                  ? "2px solid var(--green-600)"
                  : "1px solid var(--border)",
                background: style.shadow.on ? "var(--green-600)" : "var(--surface)",
                color: style.shadow.on ? "#ffffff" : "var(--text-muted)",
                fontSize: "0.9rem",
                fontWeight: 700,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              {style.shadow.on
                ? isBn ? "চালু ✓" : "ON ✓"
                : isBn ? "বন্ধ" : "OFF"}
            </button>
          </div>

          {/* When Shadow is ON: 3-step strength choice (নরম / মাঝারি / শক্ত) */}
          {style.shadow.on && (
            <div style={{ paddingTop: "0.5rem", borderTop: "1px solid var(--border)" }}>
              <span
                style={{
                  display: "block",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                  marginBottom: "0.4rem",
                }}
              >
                {isBn ? "ছায়ার তীব্রতা (Strength)" : "Shadow Strength"}
              </span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.5rem" }}>
                {(
                  [
                    { key: "soft", labelBn: "নরম", labelEn: "Soft" },
                    { key: "medium", labelBn: "মাঝারি", labelEn: "Medium" },
                    { key: "hard", labelBn: "শক্ত", labelEn: "Strong" },
                  ] as const
                ).map((step) => {
                  const isSelected = style.shadow.strength === step.key;
                  return (
                    <button
                      key={step.key}
                      type="button"
                      onClick={() => updateShadow({ strength: step.key })}
                      style={{
                        minHeight: "48px",
                        padding: "0.5rem",
                        background: isSelected ? "var(--green-50)" : "var(--surface)",
                        border: isSelected
                          ? "2px solid var(--green-600)"
                          : "1px solid var(--border)",
                        borderRadius: "var(--radius-md)",
                        color: isSelected ? "var(--green-700)" : "var(--text)",
                        fontWeight: isSelected ? 700 : 500,
                        fontSize: "0.88rem",
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {isBn ? step.labelBn : step.labelEn}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. Size Adjustment (Auto-fit by default, with 0.8x..1.2x adjustment buttons) */}
      {allowSizeAdjust && (
        <div
          style={{
            padding: "0.85rem",
            background: "var(--bg)",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.5rem",
            }}
          >
            <div>
              <span style={{ fontWeight: 700, fontSize: "0.95rem", color: "var(--text)" }}>
                {isBn ? "লেখার সাইজ (Size)" : "Text Size"}
              </span>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                {isBn ? "স্বয়ংক্রিয় ফিট + প্রয়োজনমতো বড় বা ছোট" : "Automatic fit + fine scaling"}
              </div>
            </div>
            <span
              style={{
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "var(--green-700)",
                background: "var(--green-50)",
                padding: "0.2rem 0.6rem",
                borderRadius: "var(--radius-full)",
              }}
            >
              {style.sizeScale === 1.0
                ? isBn ? "স্বয়ংক্রিয় (১০০%)" : "Auto (100%)"
                : `${Math.round(style.sizeScale * 100)}%`}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            {/* Decrease button */}
            <button
              type="button"
              disabled={style.sizeScale <= 0.81}
              onClick={() =>
                updateStyle({
                  sizeScale: Math.max(0.8, Number((style.sizeScale - 0.05).toFixed(2))),
                })
              }
              style={{
                flex: 1,
                minHeight: "48px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                fontSize: "1.1rem",
                fontWeight: 700,
                color: style.sizeScale <= 0.81 ? "var(--text-muted)" : "var(--text)",
                cursor: style.sizeScale <= 0.81 ? "not-allowed" : "pointer",
                opacity: style.sizeScale <= 0.81 ? 0.5 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.25rem",
              }}
            >
              <span>–</span>
              <span style={{ fontSize: "0.85rem" }}>{isBn ? "ছোট" : "Smaller"}</span>
            </button>

            {/* Auto fit reset button */}
            <button
              type="button"
              onClick={() => updateStyle({ sizeScale: 1.0 })}
              style={{
                minHeight: "48px",
                padding: "0.5rem 1rem",
                background: style.sizeScale === 1.0 ? "var(--green-600)" : "var(--surface)",
                border: style.sizeScale === 1.0 ? "2px solid var(--green-600)" : "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                color: style.sizeScale === 1.0 ? "#ffffff" : "var(--text)",
                fontSize: "0.85rem",
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {isBn ? "স্বয়ংক্রিয়" : "Auto"}
            </button>

            {/* Increase button */}
            <button
              type="button"
              disabled={style.sizeScale >= 1.19}
              onClick={() =>
                updateStyle({
                  sizeScale: Math.min(1.2, Number((style.sizeScale + 0.05).toFixed(2))),
                })
              }
              style={{
                flex: 1,
                minHeight: "48px",
                background: "var(--surface)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                fontSize: "1.1rem",
                fontWeight: 700,
                color: style.sizeScale >= 1.19 ? "var(--text-muted)" : "var(--text)",
                cursor: style.sizeScale >= 1.19 ? "not-allowed" : "pointer",
                opacity: style.sizeScale >= 1.19 ? 0.5 : 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.25rem",
              }}
            >
              <span>+</span>
              <span style={{ fontSize: "0.85rem" }}>{isBn ? "বড়" : "Bigger"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
