import { Suspense } from "react";
import { requireOwner } from "@/lib/session";

/*
 * Everything in this group is yours only. The proxy already turned away
 * requests without a session cookie; OwnerGate checks the session is actually
 * valid. It sits in a boundary so the static shell never waits on it.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <Suspense fallback={null}>
        <OwnerGate />
      </Suspense>
      {children}
    </>
  );
}

async function OwnerGate() {
  await requireOwner();
  return null;
}
