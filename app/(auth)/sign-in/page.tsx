import Link from "next/link";
import { PasskeySignIn } from "@/components/auth/passkey-sign-in";

export const metadata = { title: "Sign in" };

export default function SignInPage() {
  return (
    <div className="flex max-w-md flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="label text-muted">Welcome back</span>
        <h2 className="display text-5xl sm:text-6xl">Sign in</h2>
        <p className="text-muted">Use the passkey on this device. Face ID or Touch ID will ask.</p>
      </div>
      <PasskeySignIn />
      <p className="text-sm text-muted">
        First time, or on a device without your passkey?{" "}
        <Link href="/setup" className="font-semibold underline underline-offset-4">
          Set it up with your setup token
        </Link>
        .
      </p>
    </div>
  );
}
