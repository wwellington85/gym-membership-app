import "server-only";
import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!url) throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL");
  if (!key) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

  // Supabase secret keys are typically:
  // - New: sb_secret_...
  // - Legacy service_role: JWT often starting with eyJ...
  const looksPrivileged =
    key.startsWith("sb_secret_") || key.startsWith("eyJ");

  if (!looksPrivileged) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY must be a Supabase SECRET key (sb_secret_...) or legacy service_role JWT (eyJ...). " +
        "Publishable/Data API keys will return empty results due to RLS."
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false },
  });
}
