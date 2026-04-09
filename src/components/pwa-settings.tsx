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
  const [installHint, setInstallHint] = useState("Checking install status...");
  const [notificationPermission, setNotificationPermission] = useState("default");
  const [subscriptionState, setSubscriptionState] = useState<SubscriptionState>("loading");
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    const installed = isStandaloneDisplayMode();
    const ios = isIosDevice();

    if (installed) {
      setInstallHint("Installed on the Home Screen. It will launch like an app.");
      return;
    }

    if (ios) {
      setInstallHint("On iPhone, open Safari, tap Share, then choose Add to Home Screen.");
      return;
    }

    setInstallHint("Install this app from your browser menu to get the full app-style experience.");
  }, []);

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

        if (!isMounted) {
          return;
        }

        setSubscriptionState(subscription ? "subscribed" : "ready");
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

  const handleEnableNotifications = async () => {
    setActionMessage(null);
    setActionError(null);

    if (!currentUserId) {
      setActionError("Sign in first so the app can store a push subscription for your account.");
      return;
    }

    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim();
    if (!vapidPublicKey) {
      setActionError("Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY in the environment.");
      return;
    }

    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setActionError("This browser does not support web push notifications.");
      return;
    }

    if (isIosDevice() && !isStandaloneDisplayMode()) {
      setActionError("Install the app to your iPhone Home Screen first. iOS only allows web push there.");
      return;
    }

    setIsBusy(true);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Your session has expired. Sign in again and retry.");
      }

      const permission = await Notification.requestPermission();
      setNotificationPermission(permission);
      if (permission !== "granted") {
        throw new Error("Notification permission was not granted.");
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
        throw new Error(payload.error ?? "Could not save push subscription.");
      }

      setSubscriptionState("subscribed");
      setActionMessage("Notifications are enabled for this device.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not enable notifications.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleDisableNotifications = async () => {
    setActionMessage(null);
    setActionError(null);
    setIsBusy(true);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Your session has expired. Sign in again and retry.");
      }

      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (!subscription) {
        setSubscriptionState("ready");
        setActionMessage("This device was already unsubscribed.");
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
        throw new Error(payload.error ?? "Could not remove push subscription.");
      }

      await subscription.unsubscribe();
      setSubscriptionState("ready");
      setActionMessage("Notifications are disabled for this device.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not disable notifications.");
    } finally {
      setIsBusy(false);
    }
  };

  const handleSendTestNotification = async () => {
    setActionMessage(null);
    setActionError(null);
    setIsBusy(true);

    try {
      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Your session has expired. Sign in again and retry.");
      }

      const response = await fetch("/api/push/test", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          body: "Your Home Screen app is ready to receive notifications.",
          spaceId: activeSpaceId,
          title: "Mooshroom test notification",
          url: "/",
        }),
      });
      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Could not send test notification.");
      }

      setActionMessage("Test notification sent. If the app is installed, it should appear shortly.");
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not send test notification.");
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <section className={styles.panel} aria-label="Install and notification settings">
      <p className={styles.title}>Home Screen app</p>
      <p className={styles.status}>{installHint}</p>
      <p className={styles.hint}>
        Push on iPhone only works after the app is added to the Home Screen and opened from there.
      </p>

      <p className={styles.title}>Push notifications</p>
      <p className={styles.status}>
        {subscriptionState === "unsupported"
          ? "This browser does not support web push."
          : subscriptionState === "subscribed"
            ? "This device is subscribed."
            : subscriptionState === "loading"
              ? "Checking notification status..."
              : notificationPermission === "denied"
                ? "Notifications are blocked for this browser."
                : "This device is not subscribed yet."}
      </p>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={handleEnableNotifications}
          disabled={
            isBusy ||
            subscriptionState === "unsupported" ||
            subscriptionState === "subscribed" ||
            !currentUserId
          }
        >
          Enable notifications
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={handleDisableNotifications}
          disabled={isBusy || subscriptionState !== "subscribed"}
        >
          Disable notifications
        </button>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={handleSendTestNotification}
          disabled={isBusy || subscriptionState !== "subscribed"}
        >
          Send test notification
        </button>
      </div>

      {actionMessage ? <p className={styles.message}>{actionMessage}</p> : null}
      {actionError ? <p className={`${styles.message} ${styles.error}`}>{actionError}</p> : null}
    </section>
  );
}
