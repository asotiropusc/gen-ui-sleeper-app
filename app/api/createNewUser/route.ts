import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  initializeUserData,
  //   populatePlayoffMatchupsForUser,
} from "@/lib/services/initializeUserData";
import { createClient } from "@/lib/supabase/server";

interface InitUserDataBody {
  sleeperUsername: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json(
      { success: false, error: "Not authenticated" },
      { status: 401 }
    );
  }
  let body: InitUserDataBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON payload" },
      { status: 400 }
    );
  }

  const { sleeperUsername } = body;
  if (
    typeof sleeperUsername !== "string" ||
    sleeperUsername.trim().length === 0
  ) {
    return NextResponse.json(
      { success: false, error: "Missing or invalid `sleeperUsername`" },
      { status: 400 }
    );
  }

  try {
    // const result = await populatePlayoffMatchupsForUser();
    const result = await initializeUserData(sleeperUsername.trim());

    return NextResponse.json(result);
  } catch (err) {
    console.error("initializeUserData threw:", err);
    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error
            ? err.message
            : "Unknown error during initialization",
      },
      { status: 500 }
    );
  }
}
