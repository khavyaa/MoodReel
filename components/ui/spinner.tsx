import { cn } from "@/lib/utils";

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block size-5 animate-spin rounded-full border-2 border-ink-700 border-t-ember-400",
        className,
      )}
    />
  );
}
