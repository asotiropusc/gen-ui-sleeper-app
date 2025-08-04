import { NextResponse } from "next/server";
import { NextRequest } from "next/server";
import { initializeUserData } from "@/lib/services/initializeUserData";
import { requireUser } from "@/lib/supabase/auth";
import { UsernameNotFoundError } from "@/lib/errors";

interface InitUserDataBody {
  sleeperUsername: string;
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await requireUser();

    const body: InitUserDataBody = await request.json().catch(() => {
      throw NextResponse.json(
        {
          success: false,
          error: "Invalid JSON payload",
          code: "INVALID_JSON_PAYLOAD",
        },
        { status: 400 },
      );
    });

    const sleeperUsername = body.sleeperUsername?.trim();
    if (!sleeperUsername) {
      throw NextResponse.json(
        {
          success: false,
          error: "Missing or invalid `sleeperUsername`",
          code: "INVALID_USERNAME",
        },
        { status: 400 },
      );
    }

    const result = await initializeUserData(supabase, user.id, sleeperUsername);

    if (!result.success) {
      console.error("initializeUserData failed:", result.error);
      throw NextResponse.json(
        { success: false, error: result.error, code: "INITIALIZE_FAILED" },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof UsernameNotFoundError) {
      return NextResponse.json(
        { success: false, error: err.message, code: "INVALID_USERNAME" },
        { status: 400 },
      );
    }

    if (err instanceof NextResponse) throw err;

    console.error("Unhandled error in createNewUser:", err);
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown",
        code: "UNEXPECTED_ERROR",
      },
      { status: 500 },
    );
  }
}
