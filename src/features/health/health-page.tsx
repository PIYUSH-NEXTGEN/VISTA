import { useEffect, useMemo, useRef, useState } from "react";
import { DexieLibraryStore } from "@/core/storage/dexie-library-store";
import type { ImageRecord } from "@/core/storage/models";
import {
  groupExactDuplicates,
  groupNearDuplicates,
  imageHealthFlags,
  type DuplicateGroup,
} from "@/core/image-ops/health-analysis";
import { ImageProcessorClient } from "@/core/workers/image-processor-client";
import { Button } from "@/ui/button";

const store = new DexieLibraryStore();

export function HealthPage() {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const [error, setError] = useState("");
  const [undo, setUndo] = useState<{ ids: string[]; rows: ImageRecord[] }>();
  const [notice, setNotice] = useState("");
  const processor = useMemo(() => new ImageProcessorClient(), []);
  const controller = useRef<AbortController | undefined>(undefined);
  const exactGroups = useMemo(() => groupExactDuplicates(images), [images]);
  const similarGroups = useMemo(() => groupNearDuplicates(images), [images]);
  const flagged = useMemo(
    () =>
      images
        .map((image) => ({ image, flags: imageHealthFlags(image) }))
        .filter((row) => row.flags.length),
    [images],
  );

  useEffect(() => {
    let active = true;
    void store
      .listImages()
      .then((rows) => {
        if (active) setImages(rows);
      })
      .catch((caught: unknown) =>
        setError(
          caught instanceof Error ? caught.message : "The library could not be opened.",
        ),
      )
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.current?.abort();
      processor.dispose();
    };
  }, [processor]);

  async function analyze(refresh = false) {
    const pending = refresh
      ? images
      : images.filter((image) => !image.perceptualHash || !image.quality);
    if (!pending.length) {
      setNotice("All photos already have cached analysis.");
      return;
    }
    const abort = new AbortController();
    controller.current?.abort();
    controller.current = abort;
    setBusy(true);
    setError("");
    setNotice("");
    let completed = 0;
    const analysisResults = new Map<
      string,
      { perceptualHash: string; quality: ImageRecord["quality"] }
    >();
    for (const image of pending) {
      if (abort.signal.aborted) break;
      setProgress(`Analyzing ${completed + 1} of ${pending.length}: ${image.name}`);
      try {
        const original = await store.getOriginal(image.id);
        if (!original) throw new Error("Original photo is missing.");
        const result = await processor.analyze(
          original,
          image.width,
          image.height,
          abort.signal,
        );
        const quality = {
          brightness: result.brightness,
          focusScore: result.focusScore,
          analyzedAt: Date.now(),
        };
        await store.saveImageAnalysis(image.id, result.perceptualHash, quality);
        analysisResults.set(image.id, { perceptualHash: result.perceptualHash, quality });
        completed += 1;
      } catch (caught) {
        if (abort.signal.aborted) break;
        setError(
          caught instanceof Error
            ? `${image.name}: ${caught.message}`
            : `${image.name}: analysis failed.`,
        );
        break;
      }
    }
    if (analysisResults.size > 0) {
      setImages((current) =>
        current.map((row) => {
          const result = analysisResults.get(row.id);
          return result ? { ...row, ...result } : row;
        }),
      );
    }
    setProgress(
      abort.signal.aborted
        ? `Cancelled after ${completed} photos; completed analyses remain cached.`
        : `Analyzed ${completed} photo${completed === 1 ? "" : "s"}.`,
    );
    setBusy(false);
  }

  async function keepBest(group: DuplicateGroup) {
    const ranked = [...group.images].sort(compareBest);
    const best = ranked[0];
    if (!best) return;
    const remove = ranked.slice(1);
    if (!remove.length) return;
    if (
      !window.confirm(
        `Keep “${best.name}” and move ${remove.length} other photo${remove.length === 1 ? "" : "s"} to Trash? You can undo this.`,
      )
    )
      return;
    try {
      await store.trashImages(remove.map((image) => image.id));
      setImages((current) =>
        current.filter((image) => !remove.some((row) => row.id === image.id)),
      );
      setUndo({ ids: remove.map((image) => image.id), rows: remove });
      setNotice(
        `Moved ${remove.length} photo${remove.length === 1 ? "" : "s"} to Trash; keeping ${best.name}.`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The duplicate photos could not be moved to Trash.",
      );
    }
  }

  async function undoRemoval() {
    if (!undo) return;
    try {
      await store.restoreImages(undo.ids);
      setImages((current) => [...current, ...undo.rows]);
      setNotice("The photos were restored.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "The photos could not be restored.",
      );
    }
    setUndo(undefined);
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-12">
      <header className="mb-6">
        <p className="font-mono text-[11px] tracking-[0.14em] text-accent uppercase">
          Review before cleanup
        </p>
        <h1 className="mt-2 font-display text-[30px] text-ink">Library health</h1>
        <p className="mt-2 text-sm text-muted">
          Analysis stays on this device. Scores are screening hints; review each original
          before removing it.
        </p>
      </header>
      <div className="mb-5 flex flex-wrap gap-2">
        <Button onClick={() => void analyze()} disabled={busy || images.length === 0}>
          Analyze photos
        </Button>
        <Button onClick={() => void analyze(true)} disabled={busy || images.length === 0}>
          Reanalyze all
        </Button>
        {busy && <Button onClick={() => controller.current?.abort()}>Cancel</Button>}
      </div>
      {loading && (
        <p role="status" className="py-6 text-muted">
          Opening library…
        </p>
      )}
      {progress && (
        <p role="status" className="mb-4 text-sm text-muted">
          {progress}
        </p>
      )}
      {notice && (
        <div role="status" className="mb-4 rounded border border-line p-3 text-sm text-ink">
          {notice}
          {undo && (
            <Button onClick={() => void undoRemoval()} className="ml-3">
              Undo
            </Button>
          )}
        </div>
      )}
      {error && (
        <p role="alert" className="mb-4 rounded border border-line p-3 text-sm text-accent">
          {error}
        </p>
      )}
      {!loading && images.length === 0 && (
        <p className="rounded border border-line p-8 text-center text-muted">
          Add photos in Library before checking for problems.
        </p>
      )}
      {!loading && images.length > 0 && (
        <div className="space-y-6">
          <GroupSection
            title="Exact duplicates"
            groups={exactGroups}
            onKeepBest={(group) => void keepBest(group)}
            emptyText="No exact duplicates found."
          />
          <GroupSection
            title="Similar photos"
            groups={similarGroups}
            onKeepBest={(group) => void keepBest(group)}
            emptyText={
              images.some((image) => !image.perceptualHash)
                ? "Analyze photos to look for similar shots."
                : "No similar photos found."
            }
          />
          <section className="rounded-lg border border-line bg-raised p-4">
            <h2 className="font-display text-lg text-ink">
              Quality flags ({flagged.length})
            </h2>
            <p className="mb-3 mt-1 text-xs text-muted">
              Dark: average gray level under 55/255. Possibly blurry: downscaled Laplacian
              variance under 25. Low resolution: below 1280 × 720. These are approximate
              thresholds, not image-quality guarantees.
            </p>
            {flagged.length ? (
              <ul className="divide-y divide-line">
                {flagged.map(({ image, flags }) => (
                  <li
                    key={image.id}
                    className="flex flex-wrap justify-between gap-2 py-2 text-sm"
                  >
                    <span className="truncate text-ink">{image.name}</span>
                    <span className="text-muted">{flags.join(" · ")}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">
                No cached flags. Run analysis to score photos.
              </p>
            )}
          </section>
        </div>
      )}
    </main>
  );
}

function GroupSection({
  title,
  groups,
  onKeepBest,
  emptyText,
}: {
  title: string;
  groups: DuplicateGroup[];
  onKeepBest: (group: DuplicateGroup) => void;
  emptyText: string;
}) {
  const count = groups.reduce((total, group) => total + group.images.length, 0);
  return (
    <section className="rounded-lg border border-line bg-raised p-4">
      <h2 className="mb-3 font-display text-lg text-ink">
        {title} ({groups.length} groups · {count} photos)
      </h2>
      {groups.length === 0 ? (
        <p className="text-sm text-muted">{emptyText}</p>
      ) : (
        <div className="space-y-3">
          {groups.map((group, index) => (
            <article
              key={`${group.kind}-${group.images[0]?.id ?? index}`}
              className="rounded border border-line p-3"
            >
              <ul className="mb-3 space-y-1">
                {group.images.map((image) => (
                  <li
                    key={image.id}
                    className="flex flex-wrap justify-between gap-2 text-sm"
                  >
                    <span className="truncate text-ink">{image.name}</span>
                    <span className="font-mono text-xs text-muted">
                      {image.width} × {image.height} · {formatBytes(image.sizeBytes)}
                    </span>
                  </li>
                ))}
              </ul>
              <Button onClick={() => onKeepBest(group)}>
                Keep best and move rest to Trash
              </Button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function compareBest(a: ImageRecord, b: ImageRecord): number {
  const score = (image: ImageRecord) =>
    (image.quality?.focusScore ?? 0) * 100 +
    (image.width * image.height) / 1_000_000 +
    Math.log2(Math.max(1, image.sizeBytes));
  return score(b) - score(a);
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
