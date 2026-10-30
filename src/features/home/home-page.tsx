import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/ui/button";
import { CreateIcon, FolderImportIcon, HealthIcon, PlusMark } from "@/ui/icons";

const STEPS: {
  number: string;
  title: string;
  description: string;
  Icon: LucideIcon;
}[] = [
  {
    number: "01",
    title: "Bring in your photos",
    description:
      "Choose photos or select a folder where your browser supports it. VISTA builds a private library stored on this device.",
    Icon: FolderImportIcon,
  },
  {
    number: "02",
    title: "Organize and improve",
    description:
      "Search and sort your library, group images into albums, find duplicates and quality issues, then make reversible edits.",
    Icon: HealthIcon,
  },
  {
    number: "03",
    title: "Create and take them with you",
    description:
      "Resize, compress, or convert images, make profile pictures and collages, then export files or back up your library.",
    Icon: CreateIcon,
  },
];

function Hero({ onOpenLibrary }: { onOpenLibrary: () => void }) {
  return (
    <section
      id="home"
      aria-labelledby="hero-heading"
      className="relative overflow-hidden border-b border-line"
    >
      <PlusMark className="top-4 left-5" />
      <PlusMark className="top-4 right-5" />
      <PlusMark className="bottom-5 left-5" />
      <PlusMark className="bottom-5 right-5" />

      <div className="mx-auto max-w-5xl px-4 pt-10 pb-6 text-center sm:px-6 sm:pt-10 sm:pb-8">
        <p className="mx-auto inline-flex w-fit items-center gap-2 rounded-full border border-line bg-raised px-3 py-1.5 font-mono text-[10px] tracking-[0.06em] text-ink sm:text-[11px]">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent"
          />
          100% local · Photos never leave your browser
        </p>

        <h1
          id="hero-heading"
          className="mx-auto mt-5 max-w-5xl text-[34px] leading-[1.12] font-bold tracking-tight text-ink text-balance sm:mt-6 sm:text-5xl lg:text-[52px]"
        >
          The <span className="text-accent">offline workbench</span> for photos,
          <br className="hidden sm:block" /> albums and edits
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-[15px] leading-[1.4] text-muted text-pretty sm:mt-6 sm:text-[16px]">
          Keep your photo library private while you organize albums and search, find
          duplicates and quality issues, then make reversible edits or compress, resize, and
          convert images. Create profile pictures, collages, and contact sheets, and export
          or restore backups when you need them. Everything runs in your browser, so your
          photos stay on your device.
        </p>

        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:mt-7 sm:flex-row">
          <Button
            variant="accent"
            shape="soft"
            onClick={onOpenLibrary}
            className="group min-h-9 gap-2 px-4 py-2 text-[11px] tracking-[0.09em] shadow-sm hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none"
          >
            <FolderImportIcon className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 motion-reduce:transition-none" />
            Add photos
          </Button>
          <a
            href="#features-heading"
            className="group inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-line bg-raised px-4 py-2 font-sans text-xs font-semibold text-ink transition-[transform,box-shadow,background-color] duration-200 ease-out hover:-translate-y-0.5 hover:bg-surface hover:shadow-sm active:translate-y-0 motion-reduce:transform-none motion-reduce:transition-none"
          >
            How it works
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </a>
        </div>

        <p className="mt-4 text-[12px] text-muted sm:mt-5">
          No signup <span className="px-1.5 text-line-strong">·</span> Originals stay
          untouched <span className="px-1.5 text-line-strong">·</span> Your files stay on
          your device
        </p>
      </div>
    </section>
  );
}

function ProductGuide() {
  return (
    <section
      id="features-heading"
      aria-labelledby="guide-heading"
      className="relative scroll-mt-20 border-b border-line bg-surface"
    >
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-mono text-[11px] font-medium tracking-[0.16em] text-accent uppercase">
            What it is and how to use it
          </p>
          <h2
            id="how-it-works"
            className="mt-3 text-[28px] leading-tight font-bold tracking-tight text-ink sm:text-[36px]"
          >
            Your photo workflow, all in one private place
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-muted sm:text-[16px]">
            VISTA is a photo library and toolkit that runs in your browser. Organize your
            collection, clean it up, edit images, and prepare them to share or export. Your
            files stay on your device throughout.
          </p>
        </div>

        <div
          className="mt-8 grid gap-4 md:mt-10"
          style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 18rem), 1fr))" }}
        >
          {STEPS.map(({ number, title, description, Icon }) => (
            <article
              key={number}
              className="flex flex-col rounded-lg border border-line bg-raised p-5 sm:p-6"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface text-accent">
                  <Icon aria-hidden="true" className="h-5 w-5" />
                </span>
                <span className="font-mono text-[11px] tracking-[0.12em] text-muted">
                  STEP {number}
                </span>
              </div>
              <h3 className="mt-5 text-[17px] font-semibold text-ink">{title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer({ onOpenLibrary }: { onOpenLibrary: () => void }) {
  return (
    <footer className="bg-nav-bg">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
        <div className="grid gap-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div>
            <p className="font-sans text-[16px] font-extrabold tracking-[0.12em] text-ink">
              VISTA
            </p>
            <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-muted">
              A private photo library and toolkit. Your photos stay on your device.
            </p>
          </div>

          <nav aria-label="Footer" className="flex flex-wrap items-center gap-3 sm:gap-4">
            <a
              href="#features-heading"
              className="rounded-sm px-1.5 py-2 text-[13px] font-medium text-muted transition-colors hover:text-ink"
            >
              How it works
            </a>
            <a
              href="#home"
              className="rounded-sm px-1.5 py-2 text-[13px] font-medium text-muted transition-colors hover:text-ink"
            >
              Back to top
            </a>
            <Button
              variant="accent"
              shape="soft"
              onClick={onOpenLibrary}
              className="px-4 py-2 text-[11px] tracking-[0.08em]"
            >
              Add photos
            </Button>
          </nav>
        </div>

        <div className="mt-7 flex flex-col gap-2 border-t border-line pt-4 text-[11px] text-muted sm:flex-row sm:items-center sm:justify-between">
          <span>Runs locally in your browser</span>
          <span>No signup. No uploads. Your library stays yours.</span>
        </div>
      </div>
    </footer>
  );
}

export function HomePage({ onOpenLibrary }: { onOpenLibrary: () => void }) {
  return (
    <>
      <Hero onOpenLibrary={onOpenLibrary} />
      <ProductGuide />
      <Footer onOpenLibrary={onOpenLibrary} />
    </>
  );
}
