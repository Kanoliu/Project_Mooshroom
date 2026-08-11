"use client";

import Image from "next/image";
import {
  Fragment,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { getChatBubbleAsset, type SharedChatMessage } from "@/lib/chat";
import { supabase } from "@/lib/supabase";
import styles from "./chat-panel.module.css";

type ChatPanelProps = {
  currentUserId: string | null;
  onClose: () => void;
  open: boolean;
  spaceId: string | null;
  spaceName: string | null;
};

type BubbleStyle = CSSProperties & {
  "--bubble-image": string;
};

type ChatMessagesResponse = {
  error?: string;
  messages?: SharedChatMessage[];
};

type SendMessageResponse = {
  error?: string;
  message?: SharedChatMessage;
  notified?: number;
};

async function getAccessToken() {
  if (!supabase) {
    throw new Error("Chat is not configured yet.");
  }

  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error || !session?.access_token) {
    throw new Error(error?.message ?? "Sign in to use shared chat.");
  }

  return session.access_token;
}

async function fetchMessages(spaceId: string, signal?: AbortSignal) {
  const accessToken = await getAccessToken();
  const response = await fetch(`/api/chat/messages?spaceId=${encodeURIComponent(spaceId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
    signal,
  });
  const payload = (await response.json().catch(() => null)) as ChatMessagesResponse | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Could not load chat messages.");
  }

  return payload?.messages ?? [];
}

function mergeMessage(current: SharedChatMessage[], incoming: SharedChatMessage) {
  if (current.some((message) => message.id === incoming.id)) {
    return current;
  }

  return [...current, incoming].sort(
    (first, second) => Date.parse(first.createdAt) - Date.parse(second.createdAt),
  );
}

function formatMessageTime(createdAt: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(createdAt));
}

function getDayKey(createdAt: string) {
  const date = new Date(createdAt);
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function formatMessageDay(createdAt: string) {
  const date = new Date(createdAt);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  if (getDayKey(createdAt) === getDayKey(today.toISOString())) {
    return "Today";
  }
  if (getDayKey(createdAt) === getDayKey(yesterday.toISOString())) {
    return "Yesterday";
  }

  return new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "short",
    year: date.getFullYear() === today.getFullYear() ? undefined : "numeric",
  }).format(date);
}

export function ChatPanel({ currentUserId, onClose, open, spaceId, spaceName }: ChatPanelProps) {
  const [messages, setMessages] = useState<SharedChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const trimmedDraft = draft.trim();

  useEffect(() => {
    if (!open) {
      return;
    }

    const focusTimeout = window.setTimeout(() => inputRef.current?.focus(), 280);
    return () => window.clearTimeout(focusTimeout);
  }, [open]);

  useEffect(() => {
    if (!open || !spaceId || !currentUserId) {
      setMessages([]);
      setIsLoading(false);
      setStatusMessage(open ? "Sign in and join a shared space to start chatting." : null);
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    const loadMessages = async (showLoading: boolean) => {
      if (showLoading) {
        setIsLoading(true);
      }

      try {
        const nextMessages = await fetchMessages(spaceId, controller.signal);
        if (!isMounted) {
          return;
        }
        setMessages(nextMessages);
        setStatusMessage(null);
      } catch (error) {
        if (!isMounted || controller.signal.aborted) {
          return;
        }
        setStatusMessage(error instanceof Error ? error.message : "Could not load chat messages.");
      } finally {
        if (isMounted && showLoading) {
          setIsLoading(false);
        }
      }
    };

    void loadMessages(true);

    const channel = supabase
      ?.channel(`chat_messages:${spaceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `space_id=eq.${spaceId}`,
        },
        () => {
          void loadMessages(false);
        },
      )
      .subscribe();

    return () => {
      isMounted = false;
      controller.abort();
      if (channel && supabase) {
        void supabase.removeChannel(channel);
      }
    };
  }, [currentUserId, open, spaceId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const scrollFrame = window.requestAnimationFrame(() => {
      messageListRef.current?.scrollTo({
        top: messageListRef.current.scrollHeight,
        behavior: "smooth",
      });
    });
    return () => window.cancelAnimationFrame(scrollFrame);
  }, [isLoading, messages, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key === "Tab") {
        const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        );
        if (!focusable?.length) {
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onClose, open]);

  const sendMessage = async () => {
    if (!trimmedDraft || isSending || !spaceId || !currentUserId) {
      return;
    }

    const outgoingText = trimmedDraft;
    setDraft("");
    setIsSending(true);
    setStatusMessage(null);

    try {
      const accessToken = await getAccessToken();
      const response = await fetch("/api/chat/messages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ spaceId, text: outgoingText }),
      });
      const payload = (await response.json().catch(() => null)) as SendMessageResponse | null;

      if (!response.ok || !payload?.message) {
        throw new Error(payload?.error ?? "Could not send message.");
      }

      setMessages((current) => mergeMessage(current, payload.message as SharedChatMessage));
    } catch (error) {
      setDraft((current) => current || outgoingText);
      setStatusMessage(error instanceof Error ? error.message : "Could not send message.");
    } finally {
      setIsSending(false);
      window.requestAnimationFrame(() => inputRef.current?.focus());
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void sendMessage();
  };

  const handleInputKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      void sendMessage();
    }
  };

  let previousDayKey = "";

  return (
    <>
      <button
        type="button"
        className={`${styles.scrim} ${open ? styles.scrimOpen : ""}`}
        onClick={onClose}
        aria-hidden="true"
        tabIndex={-1}
      />
      <section
        ref={panelRef}
        id="mooshroom-chat"
        role="dialog"
        aria-modal="true"
        aria-labelledby="mooshroom-chat-title"
        aria-hidden={!open}
        inert={!open}
        className={`${styles.panel} ${open ? styles.panelOpen : ""}`}
      >
        <header className={styles.header}>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close chat">
            <span aria-hidden="true">←</span>
          </button>
          <div className={styles.avatar} aria-hidden="true">
            <Image
              src="/art/pets/idle/frame_0001.webp"
              alt=""
              width={64}
              height={64}
              unoptimized
            />
          </div>
          <div className={styles.headerText}>
            <h2 id="mooshroom-chat-title">{spaceName || "Shared chat"}</h2>
            <p><span aria-hidden="true" /> Shared space chat</p>
          </div>
        </header>

        <div
          ref={messageListRef}
          className={styles.messageList}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        >
          {messages.map((message) => {
            const dayKey = getDayKey(message.createdAt);
            const showDayMarker = dayKey !== previousDayKey;
            const isOwnMessage = message.senderUserId === currentUserId;
            previousDayKey = dayKey;

            return (
              <Fragment key={message.id}>
                {showDayMarker ? (
                  <p className={styles.dayMarker}>{formatMessageDay(message.createdAt)}</p>
                ) : null}
                <article
                  className={`${styles.messageRow} ${
                    isOwnMessage ? styles.messageRowUser : styles.messageRowPet
                  }`}
                  aria-label={`${isOwnMessage ? "You" : message.senderName} at ${formatMessageTime(message.createdAt)}`}
                >
                  <div
                    className={`${styles.messageBubble} ${styles[`bubble_${message.bubbleSize.replace("-", "_")}`]} ${
                      isOwnMessage ? styles.messageBubbleUser : styles.messageBubblePet
                    }`}
                    style={{
                      "--bubble-image": `url("${getChatBubbleAsset(
                        message.bubbleSize,
                        message.bubbleVariant,
                        isOwnMessage ? "sender" : "receiver",
                      )}")`,
                    } as BubbleStyle}
                  >
                    {!isOwnMessage ? <strong className={styles.senderName}>{message.senderName}</strong> : null}
                    <p>{message.text}</p>
                    <time dateTime={message.createdAt}>{formatMessageTime(message.createdAt)}</time>
                  </div>
                </article>
              </Fragment>
            );
          })}

          {isLoading ? <p className={styles.chatState}>Loading messages…</p> : null}
          {!isLoading && messages.length === 0 && !statusMessage ? (
            <p className={styles.chatState}>No messages yet. Say hello to your space.</p>
          ) : null}
          {statusMessage ? <p className={styles.chatError} role="status">{statusMessage}</p> : null}
        </div>

        <form className={styles.composer} onSubmit={handleSubmit}>
          <label className={styles.srOnly} htmlFor="mooshroom-chat-input">
            Message shared space
          </label>
          <textarea
            ref={inputRef}
            id="mooshroom-chat-input"
            rows={3}
            maxLength={600}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={handleInputKeyDown}
            placeholder="Message your space..."
            className={styles.composerInput}
            enterKeyHint="send"
            disabled={!spaceId || !currentUserId}
          />
          <button
            type="submit"
            className={styles.sendButton}
            disabled={!trimmedDraft || isSending || !spaceId || !currentUserId}
            aria-label={isSending ? "Sending message" : "Send message"}
          />
          <p className={styles.composerHint}>
            <span>{isSending ? "Sending…" : "Enter to send · Shift + Enter for a new line"}</span>
            <span>{draft.length}/600</span>
          </p>
        </form>
      </section>
    </>
  );
}
