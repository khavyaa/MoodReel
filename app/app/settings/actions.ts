"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  displayName: z.string().max(60).nullish(),
  preferredLanguages: z.array(z.enum(["en", "hi", "ta"])).min(1),
});

export type SettingsResult = { ok: boolean; message: string };

export async function updateProfile(input: z.infer<typeof schema>): Promise<SettingsResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "Pick at least one language." };

  const supabase = await createClient();
  if (!supabase) return { ok: false, message: "Supabase is not configured." };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Sign in to save preferences to your account." };

  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: user.id,
        display_name: parsed.data.displayName ?? null,
        preferred_languages: parsed.data.preferredLanguages,
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  if (error) return { ok: false, message: error.message };

  revalidatePath("/app/settings");
  return { ok: true, message: "Preferences saved." };
}
