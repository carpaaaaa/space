import { NextResponse } from "next/server";
import { getProgetti } from "@/lib/vault/progetti";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getProgetti());
  } catch (err) {
    return NextResponse.json(
      { errore: err instanceof Error ? err.message : "Errore progetti" },
      { status: 500 }
    );
  }
}
