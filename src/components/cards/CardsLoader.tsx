"use client";

import dynamic from "next/dynamic";
import { whenSynced } from "../sync";

// Progress lives in localStorage (synced with the server first), so the cards screen renders only in the browser.
export const CardsLoader = dynamic(() => whenSynced().then(() => import("./CardsApp")).then((m) => m.CardsApp), {
  ssr: false,
  loading: () => <p className="m-auto text-stone-400">Loading…</p>,
});
