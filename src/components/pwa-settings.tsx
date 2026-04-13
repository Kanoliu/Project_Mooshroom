"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import styles from "./pwa-settings.module.css";

type PwaSettingsProps = {
  activeSpaceId: string | null;
  currentUserId: string | null;
};

type SubscriptionState = "unsupported" | "ready" | "subscribed" | "loading";

function isIosDevice() {
  if (typeof navigator === "undefined") {
    return false;
  }

  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isStandaloneDisplayMode() {
  if (typeof window === "undefined") {
    return false;
  }

  const navigatorWithStandalone = navigator as Navigator & {
    standalone?: boolean;
  };

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    navigatorWithStandalone.standalone === true
  );
}

function urlBase64ToUint8Array(value: string) {
  const normalizedValue = value.replace(/-/g, "+").replace(/_/g, "/");
  const paddedValue = normalizedValue.padEnd(
    normalizedValue.length + ((4 - (normalizedValue.length % 4)) % 4),
    "=",
  );
  const rawValue = window.atob(paddedValue);

  return Uint8Array.from(rawValue, (character) => character.charCodeAt(0));
}

async function getAccessToken() {
  if (!supabase) {
    return null;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
}

export function PwaSettings({ activeSpaceId, currentUserId }: PwaSettingsProps) {
  const [notificationPermission, setNotificationPermission] = useState("default");
  const [subscriptionState, setSubscriptionState] = useState<SubscriptionState>("loading");
  const [message, setMessage] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setSubscriptionState("unsupported");
      return;
    }

    setNotificationPermission(Notification.permission);

    let isMounted = true;

    const syncSubscriptionState = async () => {
      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (isMounted) {
          setSubscriptionState(subscription ? "subscribed" : "ready");
        }
      } catch {
        if (isMounted) {
          setSubscriptionState("ready");
        }
      }
    };

    void syncSubscriptionState();

    return () => {
      isMounted = false;
    };
  }, []);

  const enableNotifications = async () => {
    setMessage(null);

    if (!currentUserId) {
      setMessage("Sign in first.");
      return;
    }

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
    if (!vapidPublicKey) {
      setMessage("Push keys are not configured.");
      return;
    }

    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setMessage("Push is not supported here.");
      return;
    }

    if (isIosDevice() && !isStandaloneDisplayMode()) {
      setMessage("Add to Home Screen first.");
      return;
    }

    setIsBusy(true);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Sign in again.");
      }

      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission !== "granted") {
        throw new Error("Notifications blocked.");
      }

      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();
      const subscription =
        existingSubscription ??
        (await registration.pushManager.subscribe({
          applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          userVisibleOnly: true,
        }));

      const response = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          spaceId: activeSpaceId,
          subscription: subscription.toJSON(),
        }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not save.");
      }

      setSubscriptionState("subscribed");
      setMessage("Notifications on.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not enable.");
    } finally {
      setIsBusy(false);
    }
  };

  const disableNotifications = async () => {
    setMessage(null);
    setIsBusy(true);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Sign in again.");
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setSubscriptionState("ready");
        setMessage("Notifications already off.");
        return;
      }

      const response = await fetch("/api/push/unsubscribe", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          endpoint: subscription.endpoint,
        }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not remove.");
      }

      await subscription.unsubscribe();
      setSubscriptionState("ready");
      setMessage("Notifications off.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not disable.");
    } finally {
      setIsBusy(false);
    }
  };

  const status =
    subscriptionState === "unsupported"
      ? "Unsupported"
      : subscriptionState === "subscribed"
        ? "On"
        : subscriptionState === "loading"
          ? "Checking..."
          : notificationPermission === "denied"
            ? "Blocked"
            : "Off";

  return (
    <section className={styles.panel} aria-label="Notification settings">
      <div className={styles.row}>
        <span className={styles.label}>Notifications</span>
        <span className={styles.status}>{status}</span>
      </div>
      <div className={styles.actions}>
        {subscriptionState === "subscribed" ? (
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={disableNotifications}
            disabled={isBusy}
          >
            Turn off
          </button>
        ) : (
          <button
            type="button"
            className={styles.primaryButton}
            onClick={enableNotifications}
            disabled={isBusy || subscriptionState === "unsupported" || !currentUserId}
          >
            Turn on
          </button>
        )}
      </div>
      {message ? <p className={styles.message}>{message}</p> : null}
    </section>
  );
}
