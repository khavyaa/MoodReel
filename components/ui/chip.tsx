import { cn } from "@/lib/utils";

export function Chip({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-ink-700 bg-ink-850/80 px-2.5 py-1 text-[11px] font-medium tracking-wide text-ink-300",
        className,
      )}
    >
      {children}
    </span>
  );
}
