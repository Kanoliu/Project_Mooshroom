import { NextResponse } from "next/server";
import { getSupabaseAdminClient } from "@/lib/server/supabase-admin";
import { getDefaultPushMessage, getPushEndpointHash } from "@/lib/web-push";

export const runtime = "nodejs";

type MessageRequestBody = {
  endpoint?: string;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as MessageRequestBody;
    const endpoint = body.endpoint?.trim();
    if (!endpoint) {
      return NextResponse.json({ message: getDefaultPushMessage() });
    }

    const endpointHash = getPushEndpointHash(endpoint);
    const supabaseAdmin = getSupabaseAdminClient();
    const { data, error } = await supabaseAdmin
      .from("web_push_subscriptions")
      .select("pending_body, pending_created_at, pending_title, pending_url")
      .eq("endpoint_hash", endpointHash)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ message: getDefaultPushMessage() });
    }

    const fallbackMessage = getDefaultPushMessage();
    const message = {
      body: data?.pending_body ?? fallbackMessage.body,
      title: data?.pending_title ?? fallbackMessage.title,
      url: data?.pending_url ?? fallbackMessage.url,
    };

    if (data?.pending_created_at) {
      await supabaseAdmin
        .from("web_push_subscriptions")
        .update({
          pending_body: null,
          pending_created_at: null,
          pending_title: null,
          pending_url: null,
          updated_at: new Date().toISOString(),
        })
        .eq("endpoint_hash", endpointHash);
    }

    return NextResponse.json({ message });
  } catch {
    return NextResponse.json({ message: getDefaultPushMessage() });
  }
}
