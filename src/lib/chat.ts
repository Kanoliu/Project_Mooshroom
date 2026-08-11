export type ChatBubbleSize = "small" | "medium" | "large" | "extra-large";
export type ChatBubbleDirection = "receiver" | "sender";

export type SharedChatMessage = {
  id: string;
  spaceId: string;
  senderUserId: string;
  senderName: string;
  text: string;
  createdAt: string;
  bubbleSize: ChatBubbleSize;
  bubbleVariant: string;
};

export const CHAT_BUBBLE_VARIANTS: Record<ChatBubbleSize, readonly string[]> = {
  small: [
    "speech-bubble-short-v1",
    "speech-bubble-short-v2",
    "speech-bubble-short-v3",
    "speech-bubble-short-v4",
    "speech-bubble-short-v5",
  ],
  medium: [
    "speech-bubble-medium",
    "speech-bubble-medium-v2",
    "speech-bubble-medium-v3",
    "speech-bubble-medium-v4",
  ],
  large: [
    "speech-bubble-long",
    "speech-bubble-long-v2",
  ],
  "extra-large": [
    "speech-bubble-extra-long",
    "speech-bubble-extra-long-v2",
  ],
};

export function getChatBubbleSize(text: string): ChatBubbleSize {
  const normalized = text.trim();
  const lineCount = normalized.split("\n").length;
  const weightedLength = Array.from(normalized).reduce(
    (length, character) => length + (character === "\n" ? 20 : 1),
    0,
  );

  if (weightedLength <= 52 && lineCount <= 2) {
    return "small";
  }
  if (weightedLength <= 130 && lineCount <= 4) {
    return "medium";
  }
  if (weightedLength <= 260 && lineCount <= 7) {
    return "large";
  }
  return "extra-large";
}

export function pickChatBubbleVariant(size: ChatBubbleSize) {
  const variants = CHAT_BUBBLE_VARIANTS[size];
  return variants[Math.floor(Math.random() * variants.length)];
}

export function getChatBubbleAsset(
  size: ChatBubbleSize,
  variant: string,
  direction: ChatBubbleDirection,
) {
  const allowedVariants = CHAT_BUBBLE_VARIANTS[size];
  const safeVariant = allowedVariants.includes(variant) ? variant : allowedVariants[0];
  return `/art/ui/chat/${size}/${safeVariant}-${direction}.png`;
}
