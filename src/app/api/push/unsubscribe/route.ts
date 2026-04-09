import { NextResponse } from "next/server";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/server/supabase-admin";
import { getPushEndpointHash } from "@/lib/web-push";

export const runtime = "nodejs";

type UnsubscribeRequestBody = {
  endpoint?: string;
};

function getBearerToken(request: Request) {
  const authorizationHeader = request.headers.get("authorization");
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.slice("Bearer ".length);
}

export async function POST(request: Request) {
  try {
    const accessToken = getBearerToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: "Missing access token." }, { status: 401 });
    }

    const body = (await request.json()) as UnsubscribeRequestBody;
    const endpoint = body.endpoint?.trim();
    if (!endpoint) {
      return NextResponse.json({ error: "Missing subscription endpoint." }, { status: 400 });
    }

    const supabaseServer = getSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseServer.auth.getUser(accessToken);

    if (authError || !user) {
      return NextResponse.json({ error: authError?.message ?? "Invalid session." }, { status: 401 });
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const { error } = await supabaseAdmin
      .from("web_push_subscriptions")
      .delete()
      .eq("user_id", user.id)
      .eq("endpoint_hash", getPushEndpointHash(endpoint));

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error." },
      { status: 500 },
    );
  }
}
