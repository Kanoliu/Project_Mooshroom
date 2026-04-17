import { NextResponse } from "next/server";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/server/supabase-admin";
import { sendWebPushPing } from "@/lib/web-push";

export const runtime = "nodejs";

type SpaceEventRequestBody = {
  body?: string;
  eventType?: "note" | "calendar";
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

function getSpaceEventMessage(body: SpaceEventRequestBody) {
  const isCalendarEvent = body.eventType === "calendar";

  return {
    body:
      body.body?.trim() ||
      (isCalendarEvent
        ? "New plan dropped. The mushroom says you may want to peek."
        : "New note dropped. The mushroom says it is probably important."),
    title: body.title?.trim() || "Project Mooshroom",
    url: body.url?.trim() || "/",
  };
}

export async function POST(request: Request) {
  try {
    const accessToken = getBearerToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: "Missing access token." }, { status: 401 });
    }

    const body = (await request.json()) as SpaceEventRequestBody;
    const spaceId = body.spaceId?.trim();
    if (!spaceId) {
      return NextResponse.json({ error: "Missing space." }, { status: 400 });
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
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from("space_members")
      .select("id")
      .eq("space_id", spaceId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (membershipError) {
      return NextResponse.json({ error: membershipError.message }, { status: 500 });
    }

    if (!membership) {
      return NextResponse.json({ error: "User is not a member of this space." }, { status: 403 });
    }

    const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin
      .from("web_push_subscriptions")
      .select("auth, endpoint, endpoint_hash, p256dh")
      .eq("space_id", spaceId)
      .neq("user_id", user.id);

    if (subscriptionsError) {
      return NextResponse.json({ error: subscriptionsError.message }, { status: 500 });
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ ok: true, notified: 0 });
    }

    const message = getSpaceEventMessage(body);
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

    return NextResponse.json({
      ok: true,
      notified: subscriptions.length - staleEndpointHashes.length,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error." },
      { status: 500 },
    );
  }
}
