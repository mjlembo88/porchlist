import type { ReactNode } from "react";
import { Drawer } from "vaul";
import { cn } from "@/lib/utils";

export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  nested = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  nested?: boolean;
}) {
  return (
    <Drawer.Root open={open} onOpenChange={onOpenChange} nested={nested} shouldScaleBackground={!nested}>
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-40 bg-ink/40" />
        <Drawer.Content
          className={cn(
            "fixed bottom-0 left-0 right-0 z-50 mx-auto flex max-h-[88dvh] w-full max-w-lg flex-col rounded-t-[28px] bg-paper outline-none",
            "pb-[env(safe-area-inset-bottom)]",
          )}
        >
          <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-border" />
          <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-paper px-4 py-3">
            <div className="min-w-0">
              <Drawer.Title className="font-display text-lg font-semibold leading-tight">{title}</Drawer.Title>
              {description ? (
                <Drawer.Description className="mt-0.5 truncate text-xs text-muted">{description}</Drawer.Description>
              ) : (
                <Drawer.Description className="sr-only">{title}</Drawer.Description>
              )}
            </div>
            <button
              type="button"
              className="grid size-11 shrink-0 place-items-center rounded-full text-sm text-muted"
              onClick={() => onOpenChange(false)}
            >
              Close
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">{children}</div>
          {footer && (
            <div className="shrink-0 border-t border-border bg-paper px-4 py-3">{footer}</div>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
