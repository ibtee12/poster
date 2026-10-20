"use client";

import React, { useState, useEffect, useRef } from "react";

interface SloganSuggesterProps {
  currentText: string;
  maxChars?: number;
  category?: string;
  lang?: string;
  onSelect: (selectedText: string) => void;
}

// In-memory cache across keystrokes to ensure instant responses & avoid redundant API calls
const suggestionsCache = new Map<string, string[]>();

export function SloganSuggester({
  currentText,
  maxChars = 60,
  category,
  lang = "bn",
  onSelect,
}: SloganSuggesterProps) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const trimmed = currentText.trim();

    // Reset selected item if user changed the text manually
    if (selectedItem && trimmed !== selectedItem) {
      setSelectedItem(null);
    }

    // Don't trigger for very short inputs or when empty
    if (trimmed.length < 3) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    // Cache key incorporates text, maxChars, and category
    const cacheKey = `${trimmed}::${maxChars}::${category || ""}`;
    if (suggestionsCache.has(cacheKey)) {
      setSuggestions(suggestionsCache.get(cacheKey)!);
      setLoading(false);
      return;
    }

    // Debounce: wait 650ms after user pauses typing
    const timer = setTimeout(async () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      setLoading(true);

      try {
        const res = await fetch("/api/ai/slogans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: abortControllerRef.current.signal,
          body: JSON.stringify({
            text: trimmed,
            maxChars,
            category,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const items: string[] = (data.suggestions || []).filter(
            (s: string) => s && s.trim() !== trimmed
          );

          suggestionsCache.set(cacheKey, items);
          setSuggestions(items);
        }
      } catch (err: any) {
        if (err.name !== "AbortError") {
          // Fail silently without disrupting user typing
          console.debug("Slogan suggestion request failed", err);
        }
      } finally {
        setLoading(false);
      }
    }, 650);

    return () => clearTimeout(timer);
  }, [currentText, maxChars, category, selectedItem]);

  if (!loading && suggestions.length === 0) {
    return null;
  }

  const isBn = lang === "bn";

  return (
    <div
      className="slogan-suggester"
      style={{
        marginTop: "0.75rem",
        marginBottom: "0.5rem",
        padding: "0.75rem",
        borderRadius: "var(--radius-md, 12px)",
        background: "var(--green-50, #E3F2EA)",
        border: "1px solid var(--border, #CFE1D6)",
        transition: "all 0.2s ease",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.5rem",
        }}
      >
        <span
          style={{
            fontSize: "0.82rem",
            fontWeight: 700,
            color: "var(--green-700, #0A5F41)",
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
          }}
        >
          {loading ? (
            <>
              <span
                style={{
                  display: "inline-block",
                  animation: "spin 1s linear infinite",
                }}
              >
                ✨
              </span>
              <span>{isBn ? "সাজেশন তৈরি হচ্ছে..." : "Generating suggestions..."}</span>
            </>
          ) : (
            <>
              <span>✨</span>
              <span>
                {isBn
                  ? "আরও বেছে নিতে পারেন (You can also pick):"
                  : "You can also pick:"}
              </span>
            </>
          )}
        </span>

        {suggestions.length > 0 && !loading && (
          <span
            style={{
              fontSize: "0.72rem",
              color: "var(--text-muted, #4C6357)",
              fontWeight: 500,
            }}
          >
            {isBn ? "ক্লিক করে টেক্সট বসান" : "Click to apply"}
          </span>
        )}
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "0.4rem",
        }}
      >
        {suggestions.map((suggestion, idx) => {
          const isSelected = selectedItem === suggestion || currentText === suggestion;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => {
                setSelectedItem(suggestion);
                onSelect(suggestion);
              }}
              style={{
                width: "100%",
                textAlign: "left",
                padding: "0.55rem 0.75rem",
                borderRadius: "var(--radius-sm, 8px)",
                background: isSelected ? "var(--surface, #FFFFFF)" : "rgba(255, 255, 255, 0.8)",
                border: isSelected
                  ? "1.5px solid var(--green-600, #0E7A53)"
                  : "1px solid rgba(14, 122, 83, 0.2)",
                color: "var(--text, #12261D)",
                fontSize: "0.88rem",
                fontWeight: isSelected ? 600 : 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.5rem",
                boxShadow: isSelected ? "var(--shadow-sm)" : "none",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "#FFFFFF";
                e.currentTarget.style.borderColor = "var(--green-600, #0E7A53)";
                e.currentTarget.style.transform = "translateY(-1px)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isSelected
                  ? "var(--surface, #FFFFFF)"
                  : "rgba(255, 255, 255, 0.8)";
                e.currentTarget.style.borderColor = isSelected
                  ? "var(--green-600, #0E7A53)"
                  : "rgba(14, 122, 83, 0.2)";
                e.currentTarget.style.transform = "translateY(0)";
              }}
            >
              <span>{suggestion}</span>
              {isSelected ? (
                <span
                  style={{
                    color: "var(--green-600, #0E7A53)",
                    fontWeight: 700,
                    fontSize: "0.95rem",
                  }}
                >
                  ✓
                </span>
              ) : (
                <span
                  style={{
                    color: "var(--green-700, #0A5F41)",
                    fontSize: "0.75rem",
                    opacity: 0.6,
                  }}
                >
                  +
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
