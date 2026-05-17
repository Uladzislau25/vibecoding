// deno-lint-ignore-file no-explicit-any
import { sendMessage } from "../../_shared/api/telegram.ts";
import { countClientMessagesSince } from "../api/messages.repo.ts";
import { RATE_LIMIT_PER_HOUR, RATE_LIMIT_REPLY } from "../_config.ts";

export async function isRateLimited(db: any, chatId: number, clientId: number): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 3_600_000).toISOString();
  const recent = await countClientMessagesSince(db, clientId, oneHourAgo);
  if (recent <= RATE_LIMIT_PER_HOUR) return false;

  await sendMessage(chatId, RATE_LIMIT_REPLY);
  return true;
}
