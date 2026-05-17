// deno-lint-ignore-file no-explicit-any
import { sendMessage } from "../../_shared/api/telegram.ts";
import { detectCasual, pickRandom } from "../../_shared/lib/text.ts";
import { insertBotMessage } from "../api/messages.repo.ts";
import { clearSetupState } from "../api/clients.repo.ts";
import { FAREWELL_REPLIES, GRATITUDE_REPLIES, GREETING_REPLIES } from "../_config.ts";

export async function tryHandleCasualReply(
  db: any,
  chatId: number,
  clientId: number,
  text: string,
  hadSetupState: boolean,
): Promise<boolean> {
  const type = detectCasual(text);
  if (!type) return false;

  if (hadSetupState) {
    await clearSetupState(db, clientId);
  }

  const reply =
    type === "greeting" ? pickRandom(GREETING_REPLIES) :
    type === "gratitude" ? pickRandom(GRATITUDE_REPLIES) :
    pickRandom(FAREWELL_REPLIES);

  await sendMessage(chatId, reply);
  await insertBotMessage(db, clientId, reply);
  return true;
}
