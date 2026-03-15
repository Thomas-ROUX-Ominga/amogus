import { NextRequest } from "next/server";
import { ERROR_CODES } from "@/lib/constants/error-codes";
import { getGameSnapshot } from "@/lib/redis/actions";
import { GameState } from "@/types/game";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

const STATE_POLL_INTERVAL_MS = 1500;
const HEARTBEAT_INTERVAL_MS = 15000;

interface EventsRouteContext {
    params: Promise<{ id: string }> | { id: string };
}

type GameSseEvent =
    | {
          event: "snapshot" | "state";
          data: {
              gameState: GameState;
              revision: number;
              updatedAt: number;
          };
      }
    | {
          event: "heartbeat";
          data: {
              ts: number;
          };
      }
    | {
          event: "error";
          data: {
              error: string;
              code: string;
              ts: number;
          };
      };

async function resolveParams(params: EventsRouteContext["params"]): Promise<{ id: string }> {
    if (typeof (params as Promise<{ id: string }>).then === "function") {
        return params as Promise<{ id: string }>;
    }
    return params as { id: string };
}

function formatEvent(payload: GameSseEvent): string {
    return `event: ${payload.event}\ndata: ${JSON.stringify(payload.data)}\n\n`;
}

function formatStateEvent(type: "snapshot" | "state", state: GameState): string {
    return `event: ${type}\nid: ${state.revision}\ndata: ${JSON.stringify({
        gameState: state,
        revision: state.revision,
        updatedAt: state.updatedAt,
    })}\n\n`;
}

export async function GET(request: NextRequest, context: EventsRouteContext) {
    const { id } = await resolveParams(context.params);
    const userId = request.nextUrl.searchParams.get("userId")?.trim();

    if (!userId) {
        return new Response(
            formatEvent({
                event: "error",
                data: {
                    error: "Missing userId query parameter.",
                    code: ERROR_CODES.ERR_INVALID_INPUT,
                    ts: Date.now(),
                },
            }),
            {
                status: 400,
                headers: {
                    "Content-Type": "text/event-stream; charset=utf-8",
                    "Cache-Control": "no-cache, no-transform",
                },
            }
        );
    }

    const encoder = new TextEncoder();
    let lastRevision = -1;
    let closed = false;
    let stateTimer: ReturnType<typeof setInterval> | undefined;
    let heartbeatTimer: ReturnType<typeof setInterval> | undefined;

    const stream = new globalThis.ReadableStream<Uint8Array>({
        start(controller) {
            const closeStream = () => {
                if (closed) return;
                closed = true;
                if (stateTimer) clearInterval(stateTimer);
                if (heartbeatTimer) clearInterval(heartbeatTimer);
                controller.close();
            };

            const pushError = (error: string, code: string) => {
                if (closed) return;
                controller.enqueue(
                    encoder.encode(
                        formatEvent({
                            event: "error",
                            data: {
                                error,
                                code,
                                ts: Date.now(),
                            },
                        })
                    )
                );
            };

            const pushState = async (type: "snapshot" | "state") => {
                try {
                    const snapshot = await getGameSnapshot(id, userId);
                    if (closed) return;
                    if (!snapshot.success || !snapshot.data) {
                        pushError(
                            snapshot.error ?? "Failed to fetch game snapshot.",
                            snapshot.code ?? ERROR_CODES.ERR_SIGNAL_LOST
                        );

                        if (
                            snapshot.code === ERROR_CODES.GAME_NOT_FOUND ||
                            snapshot.code === ERROR_CODES.ERR_INVALID_SIGNATURE ||
                            snapshot.code === ERROR_CODES.ERR_INVALID_SESSION
                        ) {
                            closeStream();
                        }
                        return;
                    }

                    const state = snapshot.data;
                    if (type === "state" && state.revision <= lastRevision) {
                        return;
                    }

                    if (state.revision < lastRevision) {
                        return;
                    }

                    lastRevision = state.revision;
                    controller.enqueue(encoder.encode(formatStateEvent(type, state)));
                } catch (error) {
                    if (closed) return;
                    console.error("SSE state push failed:", error);
                    pushError("Failed to stream game state.", ERROR_CODES.ERR_SIGNAL_LOST);
                }
            };

            controller.enqueue(encoder.encode(": connected\n\n"));
            void pushState("snapshot");

            stateTimer = setInterval(() => {
                void pushState("state");
            }, STATE_POLL_INTERVAL_MS);

            heartbeatTimer = setInterval(() => {
                if (closed) return;
                controller.enqueue(
                    encoder.encode(
                        formatEvent({
                            event: "heartbeat",
                            data: { ts: Date.now() },
                        })
                    )
                );
            }, HEARTBEAT_INTERVAL_MS);

            request.signal.addEventListener("abort", closeStream);
        },
        cancel() {
            closed = true;
            if (stateTimer) clearInterval(stateTimer);
            if (heartbeatTimer) clearInterval(heartbeatTimer);
        },
    });

    return new Response(stream, {
        status: 200,
        headers: {
            "Content-Type": "text/event-stream; charset=utf-8",
            "Cache-Control": "no-cache, no-store, must-revalidate, no-transform",
            Connection: "keep-alive",
            "X-Accel-Buffering": "no",
        },
    });
}
