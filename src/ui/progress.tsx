import * as ProgressPrimitive from "@radix-ui/react-progress";

/* Base progress bar styled with the app's design tokens.
 * Unused yet — Phase 1 uses it for imports and model downloads. */

export function Progress({
  value,
  label,
}: {
  /** Completion percentage, 0 through 100. */
  value: number;
  /** Accessible name; required because a bare meter is ambiguous. */
  label: string;
}) {
  const clamped = Math.min(Math.max(value, 0), 100);
  return (
    <ProgressPrimitive.Root
      value={clamped}
      aria-label={label}
      className="relative h-2 w-full overflow-hidden rounded-full border border-line bg-surface"
    >
      <ProgressPrimitive.Indicator
        className="h-full bg-accent transition-[width] duration-150"
        style={{ width: `${clamped}%` }}
      />
    </ProgressPrimitive.Root>
  );
}
