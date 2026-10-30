import { workspaceIcon, WORKSPACES, type WorkspaceId } from "@/app/workspaces";
import { PlusMark } from "@/ui/icons";

/* Honest placeholder for workspaces whose phase has not started yet. */
export function WorkspacePlaceholder({ id }: { id: WorkspaceId }) {
  const ws = WORKSPACES.find((w) => w.id === id);
  if (!ws) return null;

  return (
    <section aria-labelledby="placeholder-heading" className="relative min-h-[70vh]">
      <PlusMark className="top-4 left-5" />
      <PlusMark className="top-4 right-5" />
      <PlusMark className="bottom-4 left-5" />
      <PlusMark className="bottom-4 right-5" />

      <div className="mx-auto flex max-w-md flex-col items-center px-4 py-24 text-center sm:px-6">
        <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-line bg-raised text-muted">
          {workspaceIcon(id, { className: "h-5 w-5" })}
        </span>
        <h1
          id="placeholder-heading"
          className="mt-6 font-display text-[22px] leading-none text-ink uppercase"
        >
          {ws.label}
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          This workspace ships in {ws.phase} of the build plan. The design system and shell
          are in place; the feature follows the phases in the project guide.
        </p>
      </div>
    </section>
  );
}
