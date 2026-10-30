import { useEffect, useRef, useState } from "react";
import { registerSW } from "virtual:pwa-register";

type UpdateServiceWorker = (reloadPage?: boolean) => Promise<void>;

export function PwaUpdatePrompt() {
  const updateServiceWorker = useRef<UpdateServiceWorker | undefined>(undefined);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [offlineReady, setOfflineReady] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    let active = true;

    try {
      const update = registerSW({
        immediate: true,
        onNeedRefresh: () => setUpdateAvailable(true),
        onOfflineReady: () => setOfflineReady(true),
        onRegisterError: (cause: unknown) => {
          setError(
            cause instanceof Error
              ? `Offline support could not start: ${cause.message}`
              : "Offline support could not start.",
          );
        },
      });
      updateServiceWorker.current = update;
    } catch (cause) {
      const message =
        cause instanceof Error
          ? `Offline support could not start: ${cause.message}`
          : "Offline support could not start.";
      void Promise.resolve().then(() => {
        if (active) setError(message);
      });
    }

    return () => {
      active = false;
    };
  }, []);

  async function applyUpdate() {
    if (!updateServiceWorker.current) return;
    try {
      await updateServiceWorker.current(true);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? `The update could not be applied: ${cause.message}`
          : "The update could not be applied.",
      );
    }
  }

  if (!updateAvailable && !offlineReady && !error) return null;

  return (
    <aside
      aria-live="polite"
      className="fixed right-4 bottom-4 z-40 w-[min(90vw,26rem)] rounded-lg border border-line bg-raised p-4 shadow-panel"
    >
      {updateAvailable ? (
        <>
          <p className="text-[13px] font-semibold text-ink">A VISTA update is ready</p>
          <p className="mt-1 text-[12px] text-muted">
            Your current library stays on this device. Reload when you are ready to use the
            updated app.
          </p>
          <button
            type="button"
            onClick={() => void applyUpdate()}
            className="mt-3 rounded-md bg-accent px-3 py-2 font-mono text-[10px] tracking-[0.08em] text-accent-ink uppercase"
          >
            Reload to update
          </button>
        </>
      ) : offlineReady ? (
        <p role="status" className="text-[12px] text-ink">
          VISTA is ready for offline use. Your photos remain in browser storage.
        </p>
      ) : (
        <p role="alert" className="text-[12px] text-accent">
          {error}
        </p>
      )}
    </aside>
  );
}
