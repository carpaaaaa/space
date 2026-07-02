import { NextResponse } from "next/server";
import { getGalaxy } from "@/lib/vault/graph";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const payload = await getGalaxy();
    return NextResponse.json(payload);
  } catch (err) {
    return NextResponse.json(
      { errore: err instanceof Error ? err.message : "Errore galassia" },
      { status: 500 }
    );
  }
}
