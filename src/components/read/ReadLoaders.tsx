"use client";

import dynamic from "next/dynamic";
import { whenSynced } from "../sync";

// Reading state (progress, custom stories, read marks) lives in localStorage (synced first), so these render only in the browser.
const loading = () => <p className="m-auto text-stone-400">Loading…</p>;

export const LibraryLoader = dynamic(() => whenSynced().then(() => import("./Library")).then((m) => m.Library), { ssr: false, loading });
export const ReaderLoader = dynamic(() => whenSynced().then(() => import("./Reader")).then((m) => m.Reader), { ssr: false, loading });
