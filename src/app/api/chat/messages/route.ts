import { NextResponse } from "next/server";
import {
  getChatBubbleSize,
  pickChatBubbleVariant,
  type ChatBubbleSize,
  type SharedChatMessage,
} from "@/lib/chat";
import { getSupabaseAdminClient, getSupabaseServerClient } from "@/lib/server/supabase-admin";
import { sendWebPushPing } from "@/lib/web-push";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatMessageRow = {
  id: string;
  space_id: string;
  sender_user_id: string;
  sender_name: string;
  body: string;
  bubble_size: ChatBubbleSize;
  bubble_variant: string;
  created_at: string;
};

type SendMessageRequestBody = {
  spaceId?: string | null;
  text?: string;
};

function getChatDatabaseError(error: { code?: string; message: string }) {
  if (error.code === "PGRST205" || /chat_messages/i.test(error.message) && /could not find/i.test(error.message)) {
    return "Chat storage has not been installed. Apply the latest Supabase migrations and try again.";
  }

  return error.message;
}

function getBearerToken(request: Request) {
  const authorizationHeader = request.headers.get("authorization");
  if (!authorizationHeader?.startsWith("Bearer ")) {
    return null;
  }

  return authorizationHeader.slice("Bearer ".length);
}

function toChatMessage(row: ChatMessageRow): SharedChatMessage {
  return {
    id: row.id,
    spaceId: row.space_id,
    senderUserId: row.sender_user_id,
    senderName: row.sender_name,
    text: row.body,
    createdAt: row.created_at,
    bubbleSize: row.bubble_size,
    bubbleVariant: row.bubble_variant,
  };
}

function getSenderName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}) {
  const metadataName = [
    user.user_metadata?.display_name,
    user.user_metadata?.full_name,
    user.user_metadata?.name,
  ].find((value): value is string => typeof value === "string" && value.trim().length > 0);

  return (metadataName?.trim() || user.email?.split("@")[0] || "Someone").slice(0, 80);
}

async function authenticateSpaceMember(request: Request, spaceId: string) {
  const accessToken = getBearerToken(request);
  if (!accessToken) {
    return { error: "Missing access token.", status: 401 as const, user: null };
  }

  const supabaseServer = getSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabaseServer.auth.getUser(accessToken);

  if (authError || !user) {
    return {
      error: authError?.message ?? "Invalid session.",
      status: 401 as const,
      user: null,
    };
  }

  const supabaseAdmin = getSupabaseAdminClient();
  const { data: membership, error: membershipError } = await supabaseAdmin
    .from("space_members")
    .select("id")
    .eq("space_id", spaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membershipError) {
    return { error: membershipError.message, status: 500 as const, user: null };
  }

  if (!membership) {
    return { error: "User is not a member of this space.", status: 403 as const, user: null };
  }

  return { error: null, status: 200 as const, user };
}

async function notifyOtherSpaceMembers(
  spaceId: string,
  senderUserId: string,
) {
  const supabaseAdmin = getSupabaseAdminClient();
  const { data: subscriptions } = await supabaseAdmin
    .from("web_push_subscriptions")
    .select("auth, endpoint, endpoint_hash, p256dh")
    .eq("space_id", spaceId)
    .neq("user_id", senderUserId);

  if (!subscriptions?.length) {
    return 0;
  }

  const now = new Date().toISOString();
  const notification = {
    title: "Mori's Cabin",
    body: "Psst… Mori brought you a new message.",
    url: `/?space=${encodeURIComponent(spaceId)}&chat=1`,
  };
  const endpointHashes = subscriptions.map((subscription) => subscription.endpoint_hash);

  await supabaseAdmin
    .from("web_push_subscriptions")
    .update({
      pending_body: notification.body,
      pending_created_at: now,
      pending_title: notification.title,
      pending_url: notification.url,
      updated_at: now,
    })
    .in("endpoint_hash", endpointHashes);

  const staleEndpointHashes: string[] = [];
  let notified = 0;

  await Promise.all(
    subscriptions.map(async (subscription) => {
      try {
        const response = await sendWebPushPing(subscription);
        if (response.status === 404 || response.status === 410) {
          staleEndpointHashes.push(subscription.endpoint_hash);
          return;
        }
        if (response.ok) {
          notified += 1;
        }
      } catch (error) {
        console.error("Could not send chat push notification.", error);
      }
    }),
  );

  if (staleEndpointHashes.length > 0) {
    await supabaseAdmin
      .from("web_push_subscriptions")
      .delete()
      .in("endpoint_hash", staleEndpointHashes);
  }

  return notified;
}

export async function GET(request: Request) {
  try {
    const spaceId = new URL(request.url).searchParams.get("spaceId")?.trim();
    if (!spaceId) {
      return NextResponse.json({ error: "Missing space." }, { status: 400 });
    }

    const authentication = await authenticateSpaceMember(request, spaceId);
    if (authentication.error) {
      return NextResponse.json(
        { error: authentication.error },
        { status: authentication.status },
      );
    }

    const supabaseAdmin = getSupabaseAdminClient();
    const { data, error } = await supabaseAdmin
      .from("chat_messages")
      .select("id, space_id, sender_user_id, sender_name, body, bubble_size, bubble_variant, created_at")
      .eq("space_id", spaceId)
      .order("created_at", { ascending: false })
      .limit(100);

    if (error) {
      return NextResponse.json({ error: getChatDatabaseError(error) }, { status: 500 });
    }

    const messages = ((data ?? []) as ChatMessageRow[]).reverse().map(toChatMessage);
    return NextResponse.json(
      { messages },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SendMessageRequestBody;
    const spaceId = body.spaceId?.trim();
    const text = body.text?.trim();

    if (!spaceId) {
      return NextResponse.json({ error: "Missing space." }, { status: 400 });
    }
    if (!text) {
      return NextResponse.json({ error: "Message cannot be empty." }, { status: 400 });
    }
    if (text.length > 600) {
      return NextResponse.json({ error: "Message is longer than 600 characters." }, { status: 400 });
    }

    const authentication = await authenticateSpaceMember(request, spaceId);
    if (authentication.error || !authentication.user) {
      return NextResponse.json(
        { error: authentication.error ?? "Invalid session." },
        { status: authentication.status },
      );
    }

    const senderName = getSenderName(authentication.user);
    const bubbleSize = getChatBubbleSize(text);
    const bubbleVariant = pickChatBubbleVariant(bubbleSize);
    const supabaseAdmin = getSupabaseAdminClient();
    const { data, error } = await supabaseAdmin
      .from("chat_messages")
      .insert({
        body: text,
        bubble_variant: bubbleVariant,
        bubble_size: bubbleSize,
        sender_name: senderName,
        sender_user_id: authentication.user.id,
        space_id: spaceId,
      })
      .select("id, space_id, sender_user_id, sender_name, body, bubble_size, bubble_variant, created_at")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error ? getChatDatabaseError(error) : "Could not save message." },
        { status: 500 },
      );
    }

    const notified = await notifyOtherSpaceMembers(
      spaceId,
      authentication.user.id,
    );

    return NextResponse.json(
      { message: toChatMessage(data as ChatMessageRow), notified },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error." },
      { status: 500 },
    );
  }
}
