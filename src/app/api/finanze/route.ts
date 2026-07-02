import { NextResponse } from "next/server";
import { getFinanze } from "@/lib/vault/finanze";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getFinanze());
  } catch (err) {
    return NextResponse.json(
      { errore: err instanceof Error ? err.message : "Errore finanze" },
      { status: 500 }
    );
  }
}
