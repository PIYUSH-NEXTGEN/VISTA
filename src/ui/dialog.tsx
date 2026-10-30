import type { ReactElement, ReactNode } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";

/* Base dialog primitive styled with the app's design tokens.
 * Unused by any screen yet — Phase 1 will use it for delete confirmations. */

interface DialogProps {
  trigger?: ReactElement;
  title: string;
  description?: string;
  children?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Dialog({
  trigger,
  title,
  description,
  children,
  open,
  onOpenChange,
}: DialogProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogPrimitive.Trigger asChild>{trigger}</DialogPrimitive.Trigger>}
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in" />
        <DialogPrimitive.Content className="fixed top-1/2 left-1/2 z-50 w-[min(90vw,28rem)] -translate-x-1/2 -translate-y-1/2 rounded-lg border border-line bg-raised p-6 shadow-panel focus:outline-none">
          <DialogPrimitive.Title className="text-[17px] font-semibold text-ink">
            {title}
          </DialogPrimitive.Title>
          {description && (
            <DialogPrimitive.Description className="mt-2 text-[14px] leading-relaxed text-muted">
              {description}
            </DialogPrimitive.Description>
          )}
          {children}
          <DialogPrimitive.Close
            aria-label="Close dialog"
            className="absolute top-3 right-3 flex h-7 w-7 items-center justify-center rounded-md font-mono text-muted transition-colors hover:bg-surface hover:text-ink"
          >
            ×
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
