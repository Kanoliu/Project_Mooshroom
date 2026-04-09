import { NextResponse } from "next/server";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/server/supabase-admin";
import { getDefaultPushMessage, sendWebPushPing } from "@/lib/web-push";

export const runtime = "nodejs";

type TestPushRequestBody = {
  body?: string;
  spaceId?: string | null;
  title?: string;
  url?: string;
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

    const body = (await request.json()) as TestPushRequestBody;
    const supabaseServer = getSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabaseServer.auth.getUser(accessToken);

    if (authError || !user) {
      return NextResponse.json({ error: authError?.message ?? "Invalid session." }, { status: 401 });
    }

    const defaultMessage = getDefaultPushMessage();
    const message = {
      body: body.body?.trim() || defaultMessage.body,
      title: body.title?.trim() || defaultMessage.title,
      url: body.url?.trim() || defaultMessage.url,
    };

    const supabaseAdmin = getSupabaseAdminClient();
    let query = supabaseAdmin
      .from("web_push_subscriptions")
      .select("auth, endpoint, endpoint_hash, p256dh")
      .eq("user_id", user.id);

    if (body.spaceId) {
      query = query.eq("space_id", body.spaceId);
    }

    const { data: subscriptions, error: subscriptionsError } = await query;
    if (subscriptionsError) {
      return NextResponse.json({ error: subscriptionsError.message }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json(
        { error: "No push subscription found for this user yet." },
        { status: 404 },
      );
    }

    await supabaseAdmin
      .from("web_push_subscriptions")
      .update({
        pending_body: message.body,
        pending_created_at: new Date().toISOString(),
        pending_title: message.title,
        pending_url: message.url,
        updated_at: new Date().toISOString(),
      })
      .in(
        "endpoint_hash",
        subscriptions.map((subscription) => subscription.endpoint_hash),
      );

    const staleEndpointHashes: string[] = [];

    await Promise.all(
      subscriptions.map(async (subscription) => {
        const response = await sendWebPushPing(subscription);
        if (response.status === 404 || response.status === 410) {
          staleEndpointHashes.push(subscription.endpoint_hash);
        }
      }),
    );

    if (staleEndpointHashes.length > 0) {
      await supabaseAdmin
        .from("web_push_subscriptions")
        .delete()
        .in("endpoint_hash", staleEndpointHashes);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error." },
      { status: 500 },
    );
  }
}
