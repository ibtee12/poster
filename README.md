# Poster Maker MVP

An automated poster generation application: an administrator defines photo and text slots on templates, and users upload photos, automatically have backgrounds removed in their browser, customize text, adjust placement, and download full-resolution finished posters.

---

## Tech Stack & Architecture Highlights

- **Framework**: Next.js (App Router) + TypeScript
- **Styling**: Plain Vanilla CSS (no external component libraries, clean and responsive)
- **Client-Side Face Detection**: MediaPipe Face Detection (`@mediapipe/tasks-vision`) running in-browser via WebAssembly, guaranteeing user face visibility, face-height consistency (`faceHeightRatio`), and containment within slot boundaries.
- **Client-Side Background Removal**: `@imgly/background-removal` running in-browser with WebAssembly/ONNX, backed by a 60-second timeout, automatic retry, and an optional server fallback route (`POST /api/remove-bg`).
- **Edge Cleanup**: Custom alpha erosion, 1px feathering, stray semi-transparent pixel removal, and connected component blob cleaning in `lib/cutoutClean.ts`.
- **Look Matching**: Background tone matching in `lib/colorMatch.ts` subtly shifting warmth and brightness toward template background colors.
- **Manual Adjustment**: Pointer events (mouse + touch) dragging with `touch-action: none`, zoom slider with `+`/`-` buttons, directional D-pad nudge, clamped to `±slot.maxOffset` and `slot.minZoom..maxZoom`, with bottom-edge gap prevention.
- **Poster Rendering**: Pure browser Canvas API in `lib/renderPoster.ts` executing unified layer sorting (`z` order), drop shadows, outlines, and Bangla font conjunct shaping.
- **Bangla Typography**: `Noto Sans Bengali`, `Hind Siliguri`, `Tiro Bangla`, and `Inter` loaded via Google Fonts and `@font-face`, synchronized with `await document.fonts.load(...)` and `document.fonts.ready`.
- **Storage**: File-system based storage in `data/templates/<id>/` (`config.json` Schema v2, `blank.png`, `sample.png`, `overlay.png`).
- **Authentication**: Password-protected Admin Studio (`/admin/*`) using httpOnly session cookie verified by Next.js middleware.

---

## Getting Started

### 1. Prerequisites
- **Node.js**: v18+ (tested on Node v25)
- **npm**: v9+

### 2. Environment Variables
Create a `.env` or `.env.local` file in the root directory:
```env
# Database Connection (PostgreSQL)
DATABASE_URL="postgresql://posteruser:posterpassword@localhost:5432/postermaker?schema=public"

# Admin Studio Password
ADMIN_PASSWORD=admin123

# User Authentication Session Secret
SESSION_SECRET="poster_maker_jwt_session_secret_key_994827163"

# Safety & Moderation Settings
WATERMARK_ENABLED=true
WATERMARK_TEXT="POSTER MAKER PREVIEW"
MODERATION_PROVIDER=none
# MODERATION_URL=https://api.moderation.example.com/check

# Background Removal Fallback
REMOVE_BG_PROVIDER=none
# REMOVE_BG_API_KEY=your_remove_bg_key
# REMBG_URL=http://localhost:5000/api/remove
```

### 3. Database Setup (Docker Compose or Local PostgreSQL)

#### Option A: Run PostgreSQL via Docker Compose
Run the provided `docker-compose.yml` to start an isolated PostgreSQL 16 container:
```bash
docker compose up -d
```

#### Option B: Use Local PostgreSQL Service
If using an existing local PostgreSQL installation (e.g., via Homebrew):
```bash
# Start PostgreSQL service if not already running
brew services start postgresql@16

# Create database
createdb postermaker
```

#### Synchronize Prisma Schema
Push the schema to the database and generate the Prisma Client:
```bash
npx prisma db push
```

### 4. Installation & Local Development
```bash
npm install
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.
Open [http://localhost:3000](http://localhost:3000) in your browser.

To run a production build:
```bash
npm run build
npm run start
```

---

## Photo-Handling Pipeline (`/make/[id]`)

The user photo-handling pipeline executes sequentially:

```
[User Upload]
      │
      ▼
1. Pre-checks (lib/photoChecks.ts)
   ├── Validate MIME (JPG, PNG, WebP)
   ├── Validate File Size (<= 10 MB)
   ├── Validate Min Resolution (Short side >= 600px)
   ├── Variance of Laplacian Blur Check
   └── Mean Brightness (Dark / Overexposed) Check
   └── [Warning Prompt: "Use Anyway" / "Upload Different"]
      │
      ▼
2. Face Check (lib/faceDetect.ts)
   ├── MediaPipe Face Detection
   ├── Rejection if no face detected
   ├── Multiple faces detection (selects largest + warning)
   └── Face box extracted for face-height ratio & slot boundary containment
      │
      ▼
3. Background Removal (lib/removeBg.ts)
   ├── Primary: @imgly/background-removal (in-browser)
   ├── 60s timeout + single retry
   └── Server Fallback: POST /api/remove-bg (REMOVE_BG_PROVIDER)
      │
      ▼
4. Edge Cleanup (lib/cutoutClean.ts)
   ├── Remove stray pixels (alpha < 30)
   ├── 1px Alpha mask erosion (removes halo/fringing)
   ├── 1px Alpha mask feathering (smooth contours)
   └── Island/blob removal (connected components analysis)
      │
      ▼
5. Look Matching (lib/colorMatch.ts)
   └── Subtly harmonizes cutout brightness & warmth with template background (optional)
      │
      ▼
6. Rendering & Placement (lib/renderPoster.ts)
   ├── Face-guided auto placement (faceHeightRatio & containment)
   ├── Optional drop shadow (blur, offset, opacity)
   ├── Optional outline (width, color)
   └── Unified z-layer ordering
      │
      ▼
7. Manual Adjustment
   ├── Canvas direct pointer drag (mouse & touch, touch-action: none)
   ├── Zoom slider & +/- buttons (minZoom .. maxZoom)
   ├── D-pad directional nudge (clamped to ±maxOffset)
   ├── Bottom anchor constraint (prevents gap at bottom)
   └── Faint dashed outline only during edit, hidden on export
```

---

## Admin Studio Features (`/admin`)

1. **Multiple Slots**: Add unlimited photo and text slots with move, 8-point resize, precision arrow nudge (1px, shift 10px), 2% snap grid, and delete.
2. **Slot Settings**:
   - **Photo Slot**: Label, anchor (`bottom`/`center`), `allowAdjust`, `maxOffset` (0.10), `minZoom` (0.85), `maxZoom` (1.30), `required`, `faceHeightRatio`, drop shadow, and outline.
   - **Text Slot**: Label, align (`left`/`center`/`right`), text color, font family (`Noto Sans Bengali`, `Hind Siliguri`, `Tiro Bangla`, `Inter`), `maxChars`, `maxLines`, `minFontSize`.
3. **Layer Ordering (Z-Index)**: Unified visual layer stack for all photo slots, text slots, and the overlay with ▲/▼ up/down reorder buttons and editable numeric `z` inputs.
4. **Export Layouts**: Multiple layout dimensions per template (e.g. Standard 1200×1600, Story 1080×1920) with live switcher.
5. **Color Variants**: Named color variants overriding text slot colors and images while reusing slot geometries.
6. **Text Styles**: Define up to 5 named text styles per template with custom strokes and shadows.
7. **Template Duplication**: Deep-copies template directories and configs under a new ID.
8. **Live Test Preview**: Admin test panel with sample cutouts, quick Bangla presets, variant switching, and live canvas rendering.
9. **Categories & Search**: Tagging, search query filtering, and category chips on both Admin and Public Home pages.
10. **Schema v2**: Versioned schema (`schemaVersion: 2`) with automatic backward-compatible migration on load for v1 templates.

---

## Quality Checks & Verification

The photo processing pipeline covers all edge cases:
1. **Normal Portrait**: Sharp, clear human face. Passes pre-checks, face detected, background removed, auto-placed with face-height consistency.
2. **Close-up Selfie**: Large face filling frame. Face box scaled and kept within slot bounds.
3. **Half-Body Shot**: Full torso portrait. Bottom-anchored with clean contour.
4. **Blurry Photo**: High blur. Pre-checks detect low Laplacian variance, triggers quality warning, allows user to "Use anyway".
5. **No-Face Landscape**: Scenic landscape without human face. MediaPipe face detection rejects with "Please upload a clear photo with your face visible".
6. **Undersized Photo**: Pre-checks enforce minimum resolution requirements as a hard error.
