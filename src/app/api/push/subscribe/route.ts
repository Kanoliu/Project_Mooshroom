import { NextResponse } from "next/server";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/server/supabase-admin";
import { getPushEndpointHash } from "@/lib/web-push";

export const runtime = "nodejs";

type SubscribeRequestBody = {
  spaceId?: string | null;
  subscription?: PushSubscriptionJSON;
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

    const body = (await request.json()) as SubscribeRequestBody;
    const subscription = body.subscription;
    const endpoint = subscription?.endpoint?.trim();
    const p256dhKey = subscription?.keys?.p256dh?.trim();
    const authKey = subscription?.keys?.auth?.trim();

    if (!endpoint || !p256dhKey || !authKey) {
      return NextResponse.json({ error: "Push subscription is incomplete." }, { status: 400 });
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
    const { error } = await supabaseAdmin.from("web_push_subscriptions").upsert(
      {
        auth: authKey,
        endpoint,
        endpoint_hash: getPushEndpointHash(endpoint),
        p256dh: p256dhKey,
        space_id: body.spaceId ?? null,
        updated_at: new Date().toISOString(),
        user_agent: request.headers.get("user-agent"),
        user_id: user.id,
      },
      {
        onConflict: "endpoint_hash",
      },
    );

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
