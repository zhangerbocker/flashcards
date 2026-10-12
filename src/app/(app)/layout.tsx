import { Suspense } from "react";
import { KeyExpiryNoticeLoader } from "@/components/AppLoaders";
import { TabBar, TabBarView } from "@/components/TabBar";

/** The study tabs, with the API-key expiry notice and the tab bar (pages load after syncing; see sync.ts). */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col px-4 pb-24 pt-4">
        <KeyExpiryNoticeLoader />
        {children}
      </main>
      {/* The tab bar reads the URL, which isn't known while prerendering. */}
      <Suspense fallback={<TabBarView pathname="" />}>
        <TabBar />
      </Suspense>
    </>
  );
}
