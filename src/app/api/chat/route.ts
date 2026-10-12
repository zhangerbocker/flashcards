import { chatHandler } from "@/lib/server/chat-handler";
import { createClaudeTutor } from "@/lib/server/tutor";

export const POST = chatHandler(createClaudeTutor());

/** A turn with thinking plus one retry can take a while. */
export const maxDuration = 60;
