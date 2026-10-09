import Link from "next/link";
import { Suspense } from "react";
import { SetupForm } from "@/components/auth/setup-form";
import { findOwner } from "@/lib/owner-server";

export const metadata = { title: "Set up" };

export default function SetupPage() {
  return (
    <div className="flex max-w-md flex-col gap-6">
      <Suspense fallback={<SetupHeading isNew={null} />}>
        <SetupHeadingFromDb />
      </Suspense>
      <SetupForm />
      <p className="text-sm text-muted">
        Already have a passkey on this device?{" "}
        <Link href="/sign-in" className="font-semibold underline underline-offset-4">
          Sign in
        </Link>
        .
      </p>
    </div>
  );
}

async function SetupHeadingFromDb() {
  const owner = await findOwner();
  return <SetupHeading isNew={!owner} />;
}

function SetupHeading({ isNew }: { isNew: boolean | null }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="label text-muted">{isNew === false ? "New device" : "One-time setup"}</span>
      <h2 className="display text-5xl sm:text-6xl">
        {isNew === false ? "Add a passkey" : "Create your account"}
      </h2>
      <p className="text-muted">
        {isNew === false
          ? "Enter your setup token, then save a passkey on this device. Your saved lists come with it."
          : "Enter your setup token, then save a passkey. On iPhone and Mac it syncs through iCloud Keychain, so you only do this once."}
      </p>
    </div>
  );
}
