import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { publicDb } from "@/lib/supabase/public";
export async function getSiteSettings() {
  "use cache";
  cacheLife("hours");
  cacheTag("site-settings");
  const { data, error } = await publicDb
    .from("settings")
    .select("value")
    .eq("key", "site")
    .maybeSingle();
  if (error) throw error;
  return (data?.value ?? {}) as Record<string, string>;
}
