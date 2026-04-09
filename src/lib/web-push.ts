import "server-only";

import { createHash, createPrivateKey, sign as signPayload } from "node:crypto";

type StoredPushSubscription = {
  auth: string;
  endpoint: string;
  p256dh: string;
};

type PushMessage = {
  body: string;
  title: string;
  url: string;
};

function base64UrlToBuffer(value: string) {
  const normalizedValue = value.replace(/-/g, "+").replace(/_/g, "/");
  const paddedValue = normalizedValue.padEnd(
    normalizedValue.length + ((4 - (normalizedValue.length % 4)) % 4),
    "=",
  );

  return Buffer.from(paddedValue, "base64");
}

function bufferToBase64Url(buffer: Buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function getPublicJwkCoordinates(publicKey: string) {
  const rawPublicKey = base64UrlToBuffer(publicKey);
  if (rawPublicKey.length !== 65 || rawPublicKey[0] !== 0x04) {
    throw new Error("VAPID public key must be an uncompressed P-256 key.");
  }

  return {
    x: bufferToBase64Url(rawPublicKey.subarray(1, 33)),
    y: bufferToBase64Url(rawPublicKey.subarray(33, 65)),
  };
}

function createVapidJwt(audience: string) {
  const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;
  const webPushSubject = process.env.WEB_PUSH_SUBJECT;

  if (!vapidPublicKey || !vapidPrivateKey || !webPushSubject) {
    throw new Error(
      "Missing NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, or WEB_PUSH_SUBJECT.",
    );
  }

  const issuedAt = Math.floor(Date.now() / 1000);
  const header = {
    alg: "ES256",
    typ: "JWT",
  };
  const payload = {
    aud: audience,
    exp: issuedAt + 60 * 60 * 12,
    sub: webPushSubject,
  };

  const encodedHeader = bufferToBase64Url(Buffer.from(JSON.stringify(header)));
  const encodedPayload = bufferToBase64Url(Buffer.from(JSON.stringify(payload)));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;
  const { x, y } = getPublicJwkCoordinates(vapidPublicKey);
  const privateKey = createPrivateKey({
    key: {
      crv: "P-256",
      d: vapidPrivateKey,
      ext: true,
      kty: "EC",
      x,
      y,
    },
    format: "jwk",
  });
  const signature = signPayload("sha256", Buffer.from(unsignedToken), {
    dsaEncoding: "ieee-p1363",
    key: privateKey,
  });

  return {
    jwt: `${unsignedToken}.${bufferToBase64Url(signature)}`,
    publicKey: vapidPublicKey,
  };
}

export function getPushEndpointHash(endpoint: string) {
  return createHash("sha256").update(endpoint).digest("hex");
}

export async function sendWebPushPing(subscription: StoredPushSubscription) {
  const endpointUrl = new URL(subscription.endpoint);
  const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;
  const { jwt, publicKey } = createVapidJwt(audience);

  return fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: `vapid t=${jwt}, k=${publicKey}`,
      "Content-Length": "0",
      "Crypto-Key": `p256ecdsa=${publicKey}`,
      TTL: "60",
      Urgency: "normal",
    },
  });
}

export function getDefaultPushMessage(): PushMessage {
  return {
    body: "Your pet has a fresh update waiting for you.",
    title: "Project Mooshroom",
    url: "/",
  };
}
