"use client";

import { useEffect, type ReactNode } from "react";

/** A dismissible panel anchored above the tab bar; Escape or tapping the backdrop closes it. */
export function BottomSheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-20 flex items-end justify-center bg-black/30" onClick={onClose}>
      <div
        role="dialog"
        onClick={(e) => e.stopPropagation()}
        className="mb-[calc(4rem+env(safe-area-inset-bottom))] w-full max-w-xl rounded-t-3xl bg-white p-5 shadow-xl dark:bg-stone-900"
      >
        {children}
      </div>
    </div>
  );
}
