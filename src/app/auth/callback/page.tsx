"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Signing you in...");

  useEffect(() => {
    const finishSignIn = async () => {
      if (!supabase) {
        setMessage("Supabase is not configured.");
        return;
      }

      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage(error.message);
          return;
        }
      }

      window.location.replace("/");
    };

    void finishSignIn();
  }, []);

  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        background: "#f4efe2",
        color: "#2d2a24",
        textAlign: "center",
        fontFamily: "system-ui, sans-serif",
      }}
    >
      <p>{message}</p>
    </main>
  );
}
