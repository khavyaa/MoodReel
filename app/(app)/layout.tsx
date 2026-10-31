import { Suspense } from "react";
import { requireOwner } from "@/lib/session";
import { ToastProvider } from "@/components/ui/toast";

/*
 * Everything in this group is yours only. The proxy already turned away
 * requests without a session cookie; OwnerGate checks the session is actually
 * valid. It sits in a boundary so the static shell never waits on it. Undo
 * toasts show over every signed-in page.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <ToastProvider>
      <Suspense fallback={null}>
        <OwnerGate />
      </Suspense>
      {children}
    </ToastProvider>
  );
}

async function OwnerGate() {
  await requireOwner();
  return null;
}
