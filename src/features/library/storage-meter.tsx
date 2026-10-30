import { useCallback, useEffect, useState } from "react";

interface StorageEstimate {
  usage?: number;
  quota?: number;
  persisted?: boolean;
}

export function StorageMeter({ imageCount }: { imageCount: number }) {
  const [estimate, setEstimate] = useState<StorageEstimate | undefined>(undefined);
  const [message, setMessage] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | undefined>(undefined);

  const refresh = useCallback(async () => {
    if (!navigator.storage?.estimate) {
      setError("This browser does not report local storage estimates.");
      return;
    }

    try {
      const [storageEstimate, persisted] = await Promise.all([
        navigator.storage.estimate(),
        navigator.storage.persisted?.(),
      ]);
      setEstimate({
        ...(storageEstimate.usage === undefined ? {} : { usage: storageEstimate.usage }),
        ...(storageEstimate.quota === undefined ? {} : { quota: storageEstimate.quota }),
        ...(persisted === undefined ? {} : { persisted }),
      });
      setError(undefined);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? `Storage information is unavailable: ${caught.message}`
          : "Storage information is unavailable.",
      );
    }
  }, []);

  useEffect(() => {
    let active = true;
    const storage = navigator.storage;
    const estimatePromise = storage?.estimate();

    if (!estimatePromise) {
      void Promise.resolve().then(() => {
        if (active) setError("This browser does not report local storage estimates.");
      });
      return () => {
        active = false;
      };
    }

    void estimatePromise
      .then(async (storageEstimate) => ({
        storageEstimate,
        persisted: await storage.persisted?.(),
      }))
      .then(({ storageEstimate, persisted }) => {
        if (!active) return;
        setEstimate({
          ...(storageEstimate.usage === undefined ? {} : { usage: storageEstimate.usage }),
          ...(storageEstimate.quota === undefined ? {} : { quota: storageEstimate.quota }),
          ...(persisted === undefined ? {} : { persisted }),
        });
        setError(undefined);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(
          caught instanceof Error
            ? `Storage information is unavailable: ${caught.message}`
            : "Storage information is unavailable.",
        );
      });

    return () => {
      active = false;
    };
  }, [refresh, imageCount]);

  async function requestPersistence() {
    if (!navigator.storage?.persist) {
      setMessage("This browser cannot request protected local storage.");
      return;
    }
    try {
      const granted = await navigator.storage.persist();
      setMessage(
        granted
          ? "Your browser agreed to protect this library from automatic cleanup."
          : "Your browser did not grant protected storage. Export a backup regularly.",
      );
      await refresh();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? `Could not request protected storage: ${caught.message}`
          : "Could not request protected storage.",
      );
    }
  }

  const usagePercent =
    estimate?.usage !== undefined && estimate.quota !== undefined && estimate.quota > 0
      ? Math.min(100, (estimate.usage / estimate.quota) * 100)
      : undefined;

  return (
    <section
      aria-label="Browser storage"
      className="rounded-lg border border-line bg-raised p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-mono text-[11px] font-medium tracking-[0.12em] text-muted uppercase">
            Browser storage
          </h2>
          <p className="mt-1 text-[13px] text-ink">
            {estimate?.usage === undefined
              ? "Checking storage…"
              : `${formatBytes(estimate.usage)} used`}
            {estimate?.quota === undefined ? "" : ` of ${formatBytes(estimate.quota)}`}
          </p>
        </div>
        {imageCount > 0 && estimate?.persisted !== true && (
          <button
            type="button"
            onClick={() => void requestPersistence()}
            className="rounded-md border border-line px-3 py-2 font-mono text-[10px] tracking-[0.08em] text-ink uppercase hover:border-line-strong"
          >
            Protect storage
          </button>
        )}
        {estimate?.persisted && (
          <p className="font-mono text-[10px] text-accent">Storage protection granted</p>
        )}
      </div>
      {usagePercent !== undefined && (
        <div
          role="progressbar"
          aria-label="Browser storage used"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(usagePercent)}
          className="mt-3 h-2 overflow-hidden rounded-full bg-surface"
        >
          <div
            className="h-full rounded-full bg-accent transition-[width]"
            style={{ width: `${usagePercent}%` }}
          />
        </div>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[12px] text-accent">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="mt-2 text-[12px] text-muted">
          {message}
        </p>
      )}
      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        Browser storage can still be cleared. Keep an exported backup of important photos.
      </p>
    </section>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}
