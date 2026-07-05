/**
 * Avvio del server space (convenzione Next: instrumentation.ts, chiamata
 * una volta per istanza). Qui parte lo scheduler della fucina.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { avviaScheduler } = await import("@/lib/fucina/scheduler");
    avviaScheduler();
  }
}
