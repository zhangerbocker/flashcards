import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorker } from "@/components/ServiceWorker";
import { THEME_BOOT_SCRIPT } from "@/lib/theme";

export const metadata: Metadata = {
  title: "HSK Study",
  description: "Flashcards, reading and chat for HSK 1–3",
  appleWebApp: { capable: true, title: "学中文", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf9" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0a09" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // The boot script sets the `dark` class before hydration, so the class may differ from the server HTML.
    <html lang="en" className="h-full antialiased" suppressHydrationWarning>
      <head>
        {/* Runs synchronously while the page is parsed, before first paint, so a dark page never flashes light. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT_SCRIPT }} />
      </head>
      <body className="min-h-dvh bg-stone-50 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
