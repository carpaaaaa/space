import { NextRequest } from "next/server";
import { onVaultEvent, vaultVersion } from "@/lib/vault/watcher";

export const dynamic = "force-dynamic";

/** SSE: notifica il client quando il vault cambia su disco. */
export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  let pulisci: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const invia = (dati: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(dati)}\n\n`));
        } catch {
          // stream chiuso
        }
      };
      invia({ tipo: "hello", versione: vaultVersion() });
      const off = onVaultEvent((e) => invia(e));
      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          // ignora
        }
      }, 25_000);
      pulisci = () => {
        off();
        if (heartbeat) clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          // gia chiuso
        }
      };
      req.signal.addEventListener("abort", () => pulisci?.());
    },
    cancel() {
      pulisci?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
