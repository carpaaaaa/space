import { NextRequest, NextResponse } from "next/server";
import { getLogs } from "@/lib/vault/logs";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const limite = Number(req.nextUrl.searchParams.get("limit") ?? 30);
    const giorni = await getLogs();
    return NextResponse.json(giorni.slice(0, Math.max(1, limite)));
  } catch (err) {
    return NextResponse.json(
      { errore: err instanceof Error ? err.message : "Errore logs" },
      { status: 500 }
    );
  }
}
