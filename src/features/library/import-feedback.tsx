import { Progress } from "@/ui/progress";
import type { ImportFailure, ImportProgress } from "@/features/library/use-image-import";

interface ImportFeedbackProps {
  progress: ImportProgress | undefined;
  failures: ImportFailure[];
  notice: string | undefined;
  onCancel: () => void;
}

export function ImportFeedback({
  progress,
  failures,
  notice,
  onCancel,
}: ImportFeedbackProps) {
  return (
    <>
      {progress && (
        <section
          aria-label="Import progress"
          className="mb-6 rounded-lg border border-line bg-raised p-4"
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="truncate text-[13px] text-ink">
              {progress.stage}: {progress.fileName}
            </p>
            <button
              type="button"
              onClick={onCancel}
              className="font-mono text-[10px] tracking-[0.08em] text-muted uppercase hover:text-ink"
            >
              Cancel
            </button>
          </div>
          <Progress
            value={
              ((progress.completed + progress.percent / 100) /
                Math.max(progress.total, 1)) *
              100
            }
            label={`Importing ${progress.fileName}`}
          />
          <p className="mt-2 font-mono text-[10px] text-muted">
            {progress.completed} of {progress.total} complete
          </p>
        </section>
      )}

      {notice && (
        <p role="status" className="mb-4 text-[13px] text-muted">
          {notice}
        </p>
      )}
      {failures.length > 0 && (
        <ul aria-label="Import errors" className="mb-6 space-y-2">
          {failures.map((failure) => (
            <li
              key={failure.id}
              role="alert"
              className="rounded-md border border-line bg-raised px-3 py-2 text-[12px] text-accent"
            >
              <span className="font-semibold">{failure.name}:</span> {failure.message}
              {failure.message.includes("not enough browser storage") && (
                <span> Remove some images to make room, then retry.</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
