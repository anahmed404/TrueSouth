/**
 * Module worker for the slip sweep (docs/science.md §11).
 *
 * Series stay here after the first request for a token, up to
 * `SWEEP_SERIES_LIMIT` (least recently used). The main thread still owns
 * the data-store copies; only the transferred copies live here. When a
 * token has been dropped, the handler says so and the client sends the
 * columns again.
 */

import { handleSweepRequest, sweepTransferables, type SweepReply, type SweepRequest, type SweepSeries } from "./sweep-protocol.ts";

const seriesByToken = new Map<number, SweepSeries>();

const scope = globalThis as unknown as {
  onmessage: ((event: MessageEvent<SweepRequest>) => void) | null;
  postMessage(message: SweepReply, options?: { transfer?: Transferable[] }): void;
};

scope.onmessage = (event) => {
  const request = event.data;
  const reply = handleSweepRequest(request, seriesByToken);
  try {
    scope.postMessage(reply, {
      transfer: reply.type === "sweep" ? sweepTransferables(reply.sweep) : [],
    });
  } catch (error) {
    scope.postMessage({
      type: "error",
      requestId: request?.requestId ?? 0,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
