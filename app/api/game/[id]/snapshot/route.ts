import { NextRequest, NextResponse } from "next/server";
import { ERROR_CODES } from "@/lib/constants/error-codes";
import { getGameSnapshot } from "@/lib/redis/actions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

interface SnapshotRouteContext {
    params: Promise<{ id: string }> | { id: string };
}

function getStatusFromCode(code?: string): number {
    if (code === ERROR_CODES.GAME_NOT_FOUND) return 404;
    if (code === ERROR_CODES.ERR_INVALID_SIGNATURE) return 403;
    if (code === ERROR_CODES.ERR_INVALID_INPUT) return 400;
    return 500;
}

async function resolveParams(params: SnapshotRouteContext["params"]): Promise<{ id: string }> {
    if (typeof (params as Promise<{ id: string }>).then === "function") {
        return params as Promise<{ id: string }>;
    }
    return params as { id: string };
}

export async function GET(request: NextRequest, context: SnapshotRouteContext) {
    const { id } = await resolveParams(context.params);
    const userId = request.nextUrl.searchParams.get("userId")?.trim();

    if (!userId) {
        return NextResponse.json(
            {
                success: false,
                error: "Missing userId query parameter.",
                code: ERROR_CODES.ERR_INVALID_INPUT,
            },
            {
                status: 400,
                headers: {
                    "Cache-Control": "no-store, no-cache, must-revalidate",
                },
            }
        );
    }

    const snapshot = await getGameSnapshot(id, userId);
    if (!snapshot.success || !snapshot.data) {
        return NextResponse.json(
            {
                success: false,
                error: snapshot.error ?? "Failed to fetch game snapshot.",
                code: snapshot.code ?? ERROR_CODES.ERR_SIGNAL_LOST,
            },
            {
                status: getStatusFromCode(snapshot.code),
                headers: {
                    "Cache-Control": "no-store, no-cache, must-revalidate",
                },
            }
        );
    }

    return NextResponse.json(
        {
            success: true,
            data: snapshot.data,
        },
        {
            status: 200,
            headers: {
                "Cache-Control": "no-store, no-cache, must-revalidate",
            },
        }
    );
}
