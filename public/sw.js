const CACHE_NAME = "project-mooshroom-v4";
const APP_SHELL = ["/", "/manifest.webmanifest", "/icon.png", "/icon.webp"];

async function getPendingMessage() {
  try {
    const subscription = await self.registration.pushManager.getSubscription();
    if (!subscription?.endpoint) {
      return null;
    }

    const response = await fetch("/api/push/message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        endpoint: subscription.endpoint,
      }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    return payload?.message ?? null;
  } catch {
    return null;
  }
}

async function resolveNotificationPayload(event) {
  if (event.data) {
    try {
      const jsonPayload = event.data.json();
      if (jsonPayload && typeof jsonPayload === "object") {
        return jsonPayload;
      }
    } catch {
      const textPayload = await event.data.text();
      if (textPayload) {
        return {
          body: textPayload,
        };
      }
    }
  }

  return getPendingMessage();
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match("/")));
    return;
  }

  const requestUrl = new URL(request.url);
  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        const responseClone = networkResponse.clone();

        void caches
          .open(CACHE_NAME)
          .then((cache) => cache.put(request, responseClone));

        return networkResponse;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }

        throw new Error(`No cached response for ${request.url}`);
      }),
  );
});

self.addEventListener("push", (event) => {
  event.waitUntil(
    resolveNotificationPayload(event).then((payload) => {
      const title = payload?.title ?? "Project Mooshroom";
      const body = payload?.body ?? "Your pet has a fresh update waiting for you.";
      const url = payload?.url ?? "/";

      return self.registration.showNotification(title, {
        body,
        icon: "/icon.png",
        badge: "/icon.png",
        data: {
          url,
        },
      });
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const targetUrl = new URL(event.notification.data?.url ?? "/", self.location.origin).toString();

      for (const client of clientList) {
        if ("focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }

      return undefined;
    }),
  );
});
