// deno-lint-ignore-file no-explicit-any
import { sendMessage, sendTyping, recipeKeyboard } from "../../_shared/api/telegram.ts";
import { generateWeekPlan } from "../api/deepseek.ts";
import { insertBotMessage, getLastBotRecipeId } from "../api/messages.repo.ts";
import { setSetupState } from "../api/clients.repo.ts";
import { getDietaryNotes } from "../api/preferences.repo.ts";
import {
  addFavorite,
  listFavoriteTitles,
} from "../api/favorites.repo.ts";
import {
  getRecipeForShopping,
  getRecipeTitle,
  pickRandomRecipe,
} from "../api/recipes.repo.ts";
import { formatRecipe } from "../lib/prompt.ts";

export async function handleStart(chatId: number): Promise<void> {
  await sendMessage(
    chatId,
    "Привет! Я Шеф — ваш кулинарный помощник 👨‍🍳\n\n" +
      "Расскажите, что хотите приготовить, или просто назовите блюдо — пришлю рецепт с ингредиентами, пошаговыми инструкциями, временем готовки и КБЖУ.\n\n" +
      "🥗 Есть диетические ограничения или аллергии? Настройте через кнопку ⚙️ Предпочтения.\n\n" +
      "Команды:\n" +
      "/random — случайный рецепт 🎲\n" +
      "/week — план питания на 7 дней 📅\n" +
      "/save — сохранить последний рецепт ⭐\n" +
      "/saved — мои сохранённые рецепты\n" +
      "/list — список покупок для последнего рецепта 🛒\n" +
      "/preferences — мои пищевые предпочтения",
  );
}

export async function handlePreferences(db: any, chatId: number, clientId: number): Promise<void> {
  await setSetupState(db, clientId, "awaiting_preferences");
  const reply =
    "✏️ Напишите ваши пищевые ограничения, аллергии или предпочтения.\n\n" +
    "Например: вегетарианец, без лактозы, не люблю острое\n\n" +
    "Или напишите «нет» чтобы сбросить.";
  await sendMessage(chatId, reply);
  await insertBotMessage(db, clientId, reply);
}

export async function handleSave(db: any, chatId: number, clientId: number): Promise<void> {
  const recipeId = await getLastBotRecipeId(db, clientId);

  let reply: string;
  if (!recipeId) {
    reply = "Сначала попросите рецепт, потом сохраните его 🍽️";
  } else {
    const title = (await getRecipeTitle(db, recipeId)) ?? "Рецепт";
    const result = await addFavorite(db, clientId, recipeId, title);
    reply = result === "duplicate"
      ? "Этот рецепт уже в вашем избранном ⭐"
      : `⭐ Рецепт «${title}» сохранён!`;
  }

  await sendMessage(chatId, reply);
  await insertBotMessage(db, clientId, reply);
}

export async function handleSaved(db: any, chatId: number, clientId: number): Promise<void> {
  const titles = await listFavoriteTitles(db, clientId, 20);

  const reply = titles.length === 0
    ? "У вас пока нет сохранённых рецептов.\n\nНажмите ⭐ под рецептом или используйте /save."
    : `⭐ Ваши сохранённые рецепты:\n\n${titles.map((t, i) => `${i + 1}. ${t}`).join("\n")}\n\nНапишите название любого блюда, чтобы получить его снова.`;

  await sendMessage(chatId, reply);
  await insertBotMessage(db, clientId, reply);
}

export async function handleList(db: any, chatId: number, clientId: number): Promise<void> {
  const recipeId = await getLastBotRecipeId(db, clientId);

  let reply: string;
  if (!recipeId) {
    reply = "Сначала попросите рецепт, потом я составлю список покупок 🛒";
  } else {
    const recipe = await getRecipeForShopping(db, recipeId);
    reply = recipe
      ? `🛒 Список покупок для «${recipe.title}»:\n\n${recipe.ingredients}`
      : "Не удалось найти рецепт. Попробуйте снова.";
  }

  await sendMessage(chatId, reply);
  await insertBotMessage(db, clientId, reply);
}

export async function handleRandom(db: any, chatId: number, clientId: number): Promise<void> {
  await sendTyping(chatId);
  const recipe = await pickRandomRecipe(db);

  if (!recipe) {
    const reply = "Рецептов пока нет в базе. Попросите приготовить что-нибудь!";
    await sendMessage(chatId, reply);
    await insertBotMessage(db, clientId, reply);
    return;
  }

  const reply = formatRecipe(recipe);
  await sendMessage(chatId, reply, recipeKeyboard(recipe.id));
  await insertBotMessage(db, clientId, reply, recipe.id);
}

export async function handleWeek(db: any, chatId: number, clientId: number): Promise<void> {
  await sendTyping(chatId);
  const dietaryNotes = await getDietaryNotes(db, clientId);

  try {
    const plan = await generateWeekPlan(dietaryNotes);
    await sendMessage(chatId, plan);
    await insertBotMessage(db, clientId, plan);
  } catch (err) {
    console.error("Week plan error:", err);
    const reply = "Не удалось составить план питания. Попробуйте позже.";
    await sendMessage(chatId, reply);
    await insertBotMessage(db, clientId, reply);
  }
}
