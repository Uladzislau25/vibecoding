// deno-lint-ignore-file no-explicit-any
import { sendMessage } from "../../_shared/api/telegram.ts";
import { clearPreferences, savePreferences } from "../api/preferences.repo.ts";
import { clearSetupState } from "../api/clients.repo.ts";
import { insertBotMessage } from "../api/messages.repo.ts";

export async function completePreferencesSetup(
  db: any,
  chatId: number,
  clientId: number,
  text: string,
): Promise<void> {
  const reset = text.toLowerCase() === "нет";
  const notes = reset ? null : text;

  await Promise.all([
    notes ? savePreferences(db, clientId, notes) : clearPreferences(db, clientId),
    clearSetupState(db, clientId),
  ]);

  const reply = notes
    ? `✅ Сохранено! Буду учитывать: ${notes}\n\nВсе рецепты будут адаптированы под ваши предпочтения.`
    : "✅ Ограничения сброшены. Буду предлагать любые рецепты.";

  await sendMessage(chatId, reply);
  await insertBotMessage(db, clientId, reply);
}
