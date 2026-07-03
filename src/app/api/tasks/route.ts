import { NextResponse } from "next/server";
import { getTasks } from "@/lib/vault/tasks";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getTasks());
  } catch (err) {
    return NextResponse.json(
      { errore: err instanceof Error ? err.message : "Errore tasks" },
      { status: 500 }
    );
  }
}
