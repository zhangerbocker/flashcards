import { Suspense } from "react";
import { ReaderLoader } from "@/components/read/ReadLoaders";

type Params = Promise<{ id: string }>;

async function Story({ params }: { params: Params }) {
  const { id } = await params;
  return <ReaderLoader id={id} />;
}

export default function StoryPage({ params }: { params: Params }) {
  // The story id is only known at request time, so read it inside a Suspense boundary.
  return (
    <Suspense fallback={<p className="m-auto text-stone-400">Loading…</p>}>
      <Story params={params} />
    </Suspense>
  );
}
