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

const CHAT_BUBBLE_ASPECT_RATIOS: Record<ChatBubbleSize, Record<string, number>> = {
  small: {
    "speech-bubble-short-v1": 1289 / 525,
    "speech-bubble-short-v2": 1225 / 452,
    "speech-bubble-short-v3": 1289 / 525,
    "speech-bubble-short-v4": 1225 / 452,
    "speech-bubble-short-v5": 1289 / 525,
  },
  medium: {
    "speech-bubble-medium": 1435 / 717,
    "speech-bubble-medium-v2": 1443 / 715,
    "speech-bubble-medium-v3": 1435 / 717,
    "speech-bubble-medium-v4": 1443 / 715,
  },
  large: {
    "speech-bubble-long": 1329 / 745,
    "speech-bubble-long-v2": 1329 / 745,
  },
  "extra-large": {
    "speech-bubble-extra-long": 1269 / 857,
    "speech-bubble-extra-long-v2": 1269 / 857,
  },
};

const WIDE_CHAT_CHARACTER =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Extended_Pictographic}]/u;

export function getChatTextWeight(text: string) {
  return Array.from(text.trim()).reduce((length, character) => {
    if (character === "\n") {
      return length + 20;
    }

    return length + (WIDE_CHAT_CHARACTER.test(character) ? 2 : 1);
  }, 0);
}

export function getChatBubbleSize(text: string): ChatBubbleSize {
  const normalized = text.trim();
  const lineCount = normalized.split("\n").length;
  const weightedLength = getChatTextWeight(normalized);

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

export function getChatBubbleAspectRatio(size: ChatBubbleSize, variant: string) {
  const allowedVariants = CHAT_BUBBLE_VARIANTS[size];
  const safeVariant = allowedVariants.includes(variant) ? variant : allowedVariants[0];
  return CHAT_BUBBLE_ASPECT_RATIOS[size][safeVariant];
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
