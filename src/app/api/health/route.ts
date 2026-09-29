import { NextResponse } from "next/server";
import { createPublicClient } from "@/lib/supabase/public";

// Used by Docker's healthcheck and uptime monitors. Confirms the app is up and
// can reach the database, without exposing any detail.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const { error } = await createPublicClient().from("store_settings").select("id").limit(1);
    if (error) throw error;
    return NextResponse.json({ status: "ok" });
  } catch {
    return NextResponse.json({ status: "degraded" }, { status: 503 });
  }
}
