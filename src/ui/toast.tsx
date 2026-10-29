import * as ToastPrimitive from "@radix-ui/react-toast";
import type { ToastItem } from "@/ui/use-toast-queue";

/* Base toast primitives styled with the app's design tokens.
 * Radix keeps no global toast state, so callers own the list via
 * `useToastQueue` (src/ui/use-toast-queue.ts) and pass the items here. */

interface ToastViewportProps {
  items: ToastItem[];
  onClose: (id: number) => void;
}

export function ToastViewport({ items, onClose }: ToastViewportProps) {
  return (
    <ToastPrimitive.Provider swipeDirection="right" duration={5000}>
      {items.map((item) => (
        <ToastPrimitive.Root
          key={item.id}
          className="relative rounded-lg border border-line bg-raised p-4 shadow-panel data-[state=closed]:opacity-0"
          onOpenChange={(open) => {
            if (!open) onClose(item.id);
          }}
        >
          <ToastPrimitive.Title className="text-[14px] font-semibold text-ink">
            {item.title}
          </ToastPrimitive.Title>
          {item.description && (
            <ToastPrimitive.Description className="mt-1 text-[13px] leading-relaxed text-muted">
              {item.description}
            </ToastPrimitive.Description>
          )}
          <ToastPrimitive.Close
            aria-label="Close notification"
            className="absolute top-2 right-2 h-6 w-6 rounded-md text-muted hover:text-ink [&::before]:content-['×']"
          />
        </ToastPrimitive.Root>
      ))}
      <ToastPrimitive.Viewport className="fixed bottom-4 right-4 z-50 flex w-[min(92vw,22rem)] flex-col gap-2 outline-none" />
    </ToastPrimitive.Provider>
  );
}
