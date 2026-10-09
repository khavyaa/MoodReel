import type { ReactNode } from "react";

export function EmptyState({
  eyebrow,
  title,
  body,
  action,
}: {
  eyebrow: string;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <section className="flex flex-1 flex-col justify-center gap-5 py-10">
      <span className="label text-muted">{eyebrow}</span>
      <h1 className="display max-w-[16ch] text-[clamp(3rem,8vw,7rem)]">{title}</h1>
      <p className="max-w-[52ch] text-lg text-muted">{body}</p>
      {action}
    </section>
  );
}
