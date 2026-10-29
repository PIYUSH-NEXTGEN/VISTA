import { useState } from "react";
import { Button } from "@/ui/button";
import { FolderImportIcon, PlusMark } from "@/ui/icons";

const STATS = [
  { label: "Uploads", value: "None, 100% local" },
  { label: "Analysis", value: "In your browser" },
  { label: "Formats", value: "JPG · PNG · WEBP" },
  { label: "Speed", value: "Minutes per 1,000" },
] as const;

const FEATURES = [
  {
    label: "01 — Organize",
    title: "One private library",
    text: "Import by drag-and-drop, browse a fast grid, sort and search, and group shots into albums. Everything is stored on your device, not in an account.",
  },
  {
    label: "02 — Clean up",
    title: "Library health",
    text: "Find duplicates, blurry shots, dark frames and low-resolution images, then keep the best and remove the rest with an undo window.",
  },
  {
    label: "03 — Fix",
    title: "Non-destructive editor",
    text: "Crop, resize, rotate and adjust brightness, contrast and sharpness. Originals are never overwritten — every edit is a reversible stack.",
  },
  {
    label: "04 — Solve",
    title: "Everyday problem solvers",
    text: "Make an image under 200 KB for an upload form, cut a profile picture with a circle mask, or match a social media size. One click, no trivia.",
  },
  {
    label: "05 — Extract",
    title: "Receipts and screenshots to text",
    text: "Run OCR on scans and screenshots, copy the text, and turn receipts into structured rows you can export as CSV or JSON.",
  },
  {
    label: "06 — Take with you",
    title: "Export, back up, share",
    text: "Download single files, stream a selection as a zip, or share through the OS share sheet. Back up the whole library and restore it on any machine.",
  },
] as const;

function Hero() {
  const [notice, setNotice] = useState(false);

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden border-b border-line"
    >
      <PlusMark className="top-4 left-5" />
      <PlusMark className="top-4 right-5" />
      <PlusMark className="bottom-4 left-5" />
      <PlusMark className="bottom-4 right-5" />

      <div className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6 sm:py-24">
        <p className="mx-auto flex max-w-full items-center justify-center gap-2.5 rounded-md border border-line bg-raised px-4 py-2 font-mono text-[11px] tracking-[0.1em] text-ink uppercase sm:text-[12px] sm:tracking-[0.14em]">
          <span aria-hidden="true" className="h-2 w-2 shrink-0 rounded-full bg-accent" />
          <span className="min-w-0 text-balance leading-snug">
            100% local, photos never leave your browser
          </span>
        </p>

        <h1
          id="hero-heading"
          className="mt-9 text-[34px] leading-[1.05] font-bold tracking-tight text-balance sm:text-[56px] lg:text-[64px]"
        >
          The <span className="text-accent">offline workbench</span> for your photos
        </h1>

        <p className="mx-auto mt-7 max-w-xl text-[17px] leading-[1.65] text-muted text-pretty">
          VISTA runs entirely in your browser, on one private photo library: organize
          albums, find duplicates and blurry shots, compress and convert for any form, and
          extract text from receipts. Nothing uploads and nothing tracks you.
        </p>

        <div className="mt-10">
          <Button
            variant="accent"
            onClick={() => setNotice(true)}
            aria-describedby={notice ? "import-notice" : undefined}
          >
            <FolderImportIcon className="h-4 w-4" />
            Import a folder
          </Button>
          {notice && (
            <p
              id="import-notice"
              role="status"
              className="mx-auto mt-4 w-fit rounded-md border border-line bg-raised px-4 py-2 font-mono text-[12px] tracking-[0.08em] text-muted uppercase"
            >
              UI preview — import opens here in Phase 1
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function StatsStrip() {
  return (
    <section aria-label="VISTA facts" className="relative border-b border-line">
      <PlusMark className="top-5 left-5" />
      <PlusMark className="top-5 right-5" />
      <PlusMark className="bottom-5 left-5" />
      <PlusMark className="bottom-5 right-5" />

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="flex flex-col items-start px-6 py-5 bg-raised">
              <span className="font-mono text-[11px] font-medium tracking-[0.16em] text-muted uppercase">
                {s.label}
              </span>
              <span className="mt-2 text-[15px] font-semibold text-ink">{s.value}</span>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center font-mono text-[12px] tracking-[0.12em] text-muted uppercase">
          Chrome or Edge 104+ adds folder re-connection and persistent storage
        </p>
      </div>
    </section>
  );
}

function FeatureGrid() {
  return (
    <section aria-labelledby="features-heading" className="border-b border-line">
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="max-w-2xl">
          <p className="font-mono text-[12px] font-medium tracking-[0.16em] text-accent uppercase">
            What it does
          </p>
          <h2
            id="features-heading"
            className="mt-3 text-[28px] font-bold tracking-tight text-ink sm:text-[32px]"
          >
            The whole job, in one place
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">
            Instead of five online tools that secretly upload your files, VISTA does the
            everyday photo work locally — from cleaning the library to shipping a properly
            sized export.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <article
              key={f.label}
              className="group bg-raised p-6 transition-colors hover:bg-surface"
            >
              <p className="font-mono text-[11px] font-medium tracking-[0.16em] text-muted uppercase">
                {f.label}
              </p>
              <h3 className="mt-3 text-[17px] font-semibold text-ink group-hover:text-accent">
                {f.title}
              </h3>
              <p className="mt-2.5 text-[14px] leading-relaxed text-muted">{f.text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-nav-bg">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 py-6 text-center sm:flex-row sm:px-6 sm:text-left">
        <p className="flex items-center gap-2 font-mono text-[12px] tracking-[0.12em] text-muted uppercase">
          <span aria-hidden="true" className="h-2 w-2 rounded-[2px] bg-accent" />
          VISTA_
        </p>
        <p className="font-mono text-[12px] tracking-[0.12em] text-muted uppercase">
          Runs locally · No signup · No uploads · Your backup is yours
        </p>
      </div>
    </footer>
  );
}

export function HomePage() {
  return (
    <>
      <Hero />
      <StatsStrip />
      <FeatureGrid />
      <Footer />
    </>
  );
}
