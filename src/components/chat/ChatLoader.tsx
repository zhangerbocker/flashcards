"use client";

import dynamic from "next/dynamic";
import { whenSynced } from "../sync";

// The conversation, progress and mistakes live in localStorage (synced first), so chat renders only in the browser.
export const ChatLoader = dynamic(() => whenSynced().then(() => import("./ChatApp")).then((m) => m.ChatApp), {
  ssr: false,
  loading: () => <p className="m-auto text-stone-400">Loading…</p>,
});
