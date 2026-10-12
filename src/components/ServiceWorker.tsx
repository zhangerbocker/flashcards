"use client";

import { useEffect } from "react";

/** Registers the offline service worker (production only: in development it would cache stale code). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch((err: unknown) => {
      console.error("service worker registration failed:", err instanceof Error ? err.message : err);
    });
  }, []);
  return null;
}
