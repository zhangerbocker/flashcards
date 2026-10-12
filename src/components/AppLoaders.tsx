"use client";

import dynamic from "next/dynamic";

// Uses today's date, so it renders only in the browser.
export const KeyExpiryNoticeLoader = dynamic(() => import("./KeyExpiryNotice").then((m) => m.KeyExpiryNotice), { ssr: false });
