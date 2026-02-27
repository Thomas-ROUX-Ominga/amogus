import { NextRequest, NextResponse } from "next/server";
import { verifySession } from "@/lib/redis/auth-utils";

export async function GET(request: NextRequest) {
  try {
    const sessionResult = await verifySession();
    
    if (sessionResult.success && sessionResult.data) {
      return NextResponse.json({
        success: true,
        data: sessionResult.data,
      });
    }
    
    return NextResponse.json({
      success: false,
      error: sessionResult.error || "Authentication failed",
      code: sessionResult.code || "AUTH_FAILED",
    }, { status: 401 });
    
  } catch (error) {
    console.error("Auth verification error:", error);
    return NextResponse.json({
      success: false,
      error: "Internal server error",
      code: "INTERNAL_ERROR",
    }, { status: 500 });
  }
}
