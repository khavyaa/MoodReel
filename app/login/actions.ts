"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { getAppUrl } from "@/lib/app-url";

export type AuthState = { error?: string; message?: string };

const credentialsSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  displayName: z.string().max(60).optional(),
  next: z.string().optional(),
});

function safeNext(next: string | undefined) {
  // Only allow same-origin app paths so a crafted ?next= cannot bounce users off-site.
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/app";
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase is not configured on this deployment." };

  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  redirect(safeNext(parsed.data.next));
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  if (!supabase) return { error: "Supabase is not configured on this deployment." };

  const appUrl = getAppUrl();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName || null },
      emailRedirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(safeNext(parsed.data.next))}`,
    },
  });
  if (error) return { error: error.message };

  // With email confirmation on, Supabase returns a user but no session.
  if (!data.session) {
    return { message: "Check your inbox to confirm your email, then sign in." };
  }

  revalidatePath("/", "layout");
  redirect(safeNext(parsed.data.next));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase?.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/");
}
