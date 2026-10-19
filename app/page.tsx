"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { TemplateConfig } from "@/lib/templates";
import { Button } from "./components/ui/Button";
import { Chip } from "./components/ui/Chip";
import { TemplateCardSkeleton } from "./components/ui/Skeleton";
import { EmptyState } from "./components/ui/EmptyState";
import { SearchIcon, SparklesIcon, ArrowRightIcon } from "./components/ui/Icons";

export default function HomePage() {
  const [templates, setTemplates] = useState<TemplateConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/templates");
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      } else {
        throw new Error("টেমপ্লেট তালিকা লোড করা সম্ভব হয়নি।");
      }
    } catch (err: any) {
      console.error("Failed to load templates:", err);
      setError(err.message || "টেমপ্লেট লোড করতে সমস্যা হয়েছে।");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  // Compute all unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => {
      if (t.category && t.category.trim()) {
        set.add(t.category.trim());
      }
    });
    return ["All", ...Array.from(set)];
  }, [templates]);

  // Filter templates by category and search query
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

  const scrollToGrid = () => {
    const el = document.getElementById("templates-grid");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "calc(100vh - 60px)" }}>
      {/* 1. HERO SECTION */}
      <section className="hero-section">
        <div className="hero-content">
          <div
            className="text-outlined text-outlined-white-green"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              background: "var(--green-700)",
              color: "#ffffff",
              padding: "0.35rem 0.9rem",
              borderRadius: "var(--radius-pill)",
              fontSize: "0.85rem",
              fontWeight: 700,
              boxShadow: "var(--shadow-sm)",
              marginBottom: "1.25rem",
            }}
          >
            <SparklesIcon size={16} />
            <span>ডিজিটাল পোস্টার তৈরির সহজ মাধ্যম</span>
          </div>

          <h1 className="hero-heading">
            সুন্দর পোস্টার তৈরি করুন{" "}
            <span className="brush-accent-wrapper">
              <span className="text-outlined text-outlined-white-red">মুহূর্তেই</span>
              <span className="brush-stroke" aria-hidden="true" />
            </span>
          </h1>

          <p className="hero-subtext">
            স্বয়ংক্রিয় ব্যাকগ্রাউন্ড রিমুভাল ও নিখুঁত বাংলা টাইপোগ্রাফি সহ যেকোনো বিশেষ দিবসের পোস্টার সাজিয়ে ডাউনলোড করুন বিনামূল্যে।
          </p>

          <div>
            <Button
              onClick={scrollToGrid}
              size="lg"
              variant="primary"
              icon={<ArrowRightIcon size={20} />}
            >
              টেমপ্লেট বেছে নিন (Choose a Template)
            </Button>
          </div>
        </div>
      </section>

      {/* 2. TEMPLATES SECTION */}
      <main id="templates-grid" className="container" style={{ paddingTop: "2.5rem", paddingBottom: "3.5rem" }}>
        {/* Search & Category Filter Controls */}
        <div
          className="card"
          style={{
            marginBottom: "2rem",
            padding: "1.25rem",
            backgroundColor: "var(--surface)",
            boxShadow: "var(--shadow-sm)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {/* Search Input */}
            <div style={{ position: "relative", width: "100%" }}>
              <span
                style={{
                  position: "absolute",
                  left: "1rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--text-muted)",
                  pointerEvents: "none",
                  display: "flex",
                }}
              >
                <SearchIcon size={20} />
              </span>
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: "2.75rem", minHeight: 50, fontSize: "1.05rem" }}
                placeholder="টেমপ্লেটের নাম বা ট্যাগ দিয়ে খুঁজুন (Search templates)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                  style={{
                    position: "absolute",
                    right: "1rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    fontSize: "1.1rem",
                  }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Category Filter Chips */}
            {categories.length > 1 && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.9rem", fontWeight: 700, color: "var(--text)", marginRight: "0.25rem" }}>
                  ক্যাটাগরি:
                </span>
                {categories.map((cat) => (
                  <Chip
                    key={cat}
                    active={selectedCategory === cat}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat === "All" ? "সবগুলো (All)" : cat}
                  </Chip>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Section Heading & Counter */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1.25rem" }}>
          <h2 className="text-outlined text-outlined-green-white">
            উপলব্ধ টেমপ্লেট{" "}
            {!loading && (
              <span style={{ fontSize: "1rem", fontWeight: 500, color: "var(--text-muted)", WebkitTextStroke: "0px", textShadow: "none" }}>
                ({filteredTemplates.length} টি)
              </span>
            )}
          </h2>
        </div>

        {/* Loading State: Skeletons */}
        {loading && (
          <div className="grid-cards">
            {Array.from({ length: 4 }).map((_, i) => (
              <TemplateCardSkeleton key={i} />
            ))}
          </div>
        )}

        {/* Error State with Retry Button */}
        {!loading && error && (
          <EmptyState
            title="টেমপ্লেট লোড করতে সমস্যা হয়েছে"
            description={error}
            actionLabel="আবার চেষ্টা করুন"
            onAction={loadTemplates}
          />
        )}

        {/* Empty Search / Filter State */}
        {!loading && !error && filteredTemplates.length === 0 && (
          <EmptyState
            icon={<SearchIcon size={32} />}
            title="কোনো টেমপ্লেট খুঁজে পাওয়া যায়নি"
            description={`"${searchQuery}" এর সাথে মিলে এমন কোনো টেমপ্লেট পাওয়া যায়নি। ফিল্টার পরিবর্তন করে দেখুন।`}
            actionLabel="সব টেমপ্লেট দেখুন"
            onAction={() => {
              setSearchQuery("");
              setSelectedCategory("All");
            }}
          />
        )}

        {/* Template Grid */}
        {!loading && !error && filteredTemplates.length > 0 && (
          <div className="grid-cards">
            {filteredTemplates.map((tpl) => (
              <Link
                key={tpl.id}
                href={`/make/${tpl.id}`}
                className="template-card"
                aria-label={`Use template ${tpl.name}`}
              >
                <div className="template-card-img-wrapper">
                  <img
                    src={`/api/templates/${tpl.id}/images/sample.png`}
                    alt={tpl.name}
                    className="template-card-img"
                    loading="lazy"
                  />
                  {tpl.category && (
                    <span
                      className="badge badge-primary text-outlined text-outlined-white-green"
                      style={{
                        position: "absolute",
                        top: 12,
                        right: 12,
                        backdropFilter: "blur(4px)",
                        backgroundColor: "var(--green-700)",
                        color: "#ffffff",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
                      }}
                    >
                      {tpl.category}
                    </span>
                  )}
                </div>

                <div className="template-card-body">
                  <h3 className="template-card-title">{tpl.name}</h3>

                  <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    রেজোলিউশন: {tpl.width} × {tpl.height} px
                    {tpl.layouts && tpl.layouts.length > 1 && ` · ${tpl.layouts.length} লেআউট`}
                  </p>

                  {tpl.tags && tpl.tags.length > 0 && (
                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap", margin: "0.25rem 0" }}>
                      {tpl.tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-muted)",
                            backgroundColor: "var(--bg)",
                            padding: "0.15rem 0.5rem",
                            borderRadius: "var(--radius-pill)",
                            border: "1px solid var(--border)",
                          }}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Red Action Button for Single Primary Action */}
                  <div style={{ marginTop: "auto", paddingTop: "0.75rem" }}>
                    <span
                      className="btn-primary"
                      style={{
                        width: "100%",
                        fontSize: "0.95rem",
                        padding: "0.65rem 1rem",
                        minHeight: 44,
                      }}
                    >
                      টেমপ্লেট ব্যবহার করুন &rarr;
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>

      {/* 3. MINIMAL ONE-LINE FOOTER */}
      <footer
        style={{
          marginTop: "auto",
          backgroundColor: "var(--surface)",
          borderTop: "1px solid var(--border)",
          padding: "1.25rem var(--space-4)",
          textAlign: "center",
          fontSize: "0.9rem",
          color: "var(--text-muted)",
        }}
      >
        <p style={{ margin: 0 }}>
          © {new Date().getFullYear()} পোস্টার মেকার · দ্রুত ও সহজ ডিজিটাল পোস্টার তৈরি
        </p>
      </footer>
    </div>
  );
}
