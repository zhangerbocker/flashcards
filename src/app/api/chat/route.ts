import { chatHandler } from "@/lib/server/chat-handler";
import { getDb } from "@/lib/server/db";
import { requestIdentity } from "@/lib/server/request-identity";
import { createClaudeTutor } from "@/lib/server/tutor";

export const POST = chatHandler(createClaudeTutor(), { getDb, identify: requestIdentity });

/** A turn with thinking plus one retry can take a while. */
export const maxDuration = 60;
