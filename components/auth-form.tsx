"use client";

import { useActionState, useState } from "react";
import { signIn, signUp, type AuthState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const initialState: AuthState = {};

export function AuthForm({ next }: { next: string }) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const action = mode === "signin" ? signIn : signUp;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <div className="space-y-6">
      <div
        role="tablist"
        aria-label="Authentication mode"
        className="grid grid-cols-2 rounded-xl border border-ink-800 bg-ink-900 p-1"
      >
        {(["signin", "signup"] as const).map((value) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={cn(
              "rounded-lg py-2 text-sm font-medium transition-colors",
              mode === value ? "bg-ink-800 text-ink-100" : "text-ink-400 hover:text-ink-100",
            )}
          >
            {value === "signin" ? "Sign in" : "Create account"}
          </button>
        ))}
      </div>

      <form action={formAction} className="space-y-4" key={mode}>
        <input type="hidden" name="next" value={next} />

        {mode === "signup" && (
          <Field
            label="Display name"
            name="displayName"
            type="text"
            autoComplete="nickname"
            required={false}
          />
        )}
        <Field label="Email" name="email" type="email" autoComplete="email" />
        <Field
          label="Password"
          name="password"
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          hint={mode === "signup" ? "At least 8 characters." : undefined}
        />

        {state.error && (
          <p role="alert" className="rounded-lg bg-rose-glow/10 px-3 py-2 text-sm text-rose-glow">
            {state.error}
          </p>
        )}
        {state.message && (
          <p role="status" className="rounded-lg bg-mint-glow/10 px-3 py-2 text-sm text-mint-glow">
            {state.message}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? "Working…" : mode === "signin" ? "Sign in" : "Create account"}
        </Button>
      </form>
    </div>
  );
}

function Field({
  label,
  name,
  type,
  autoComplete,
  hint,
  required = true,
}: {
  label: string;
  name: string;
  type: string;
  autoComplete?: string;
  hint?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink-300">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        autoComplete={autoComplete}
        className="mt-1.5 h-11 w-full rounded-xl border border-ink-700 bg-ink-900 px-3 text-sm text-ink-100 placeholder:text-ink-500 focus:border-ember-400 focus:outline-none"
      />
      {hint && <span className="mt-1 block text-xs text-ink-500">{hint}</span>}
    </label>
  );
}
