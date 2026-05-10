// deno-lint-ignore-file no-explicit-any
import { sendMessage, sendTyping, recipeKeyboard } from "../../_shared/api/telegram.ts";
import { generateWeekPlan } from "../_lib/deepseek.ts";
import { saveBotReply } from "../_lib/recipe-flow.ts";

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
  await db.from("clients").update({ setup_state: "awaiting_preferences" }).eq("id", clientId);
  const reply =
    "✏️ Напишите ваши пищевые ограничения, аллергии или предпочтения.\n\n" +
    "Например: вегетарианец, без лактозы, не люблю острое\n\n" +
    "Или напишите «нет» чтобы сбросить.";
  await sendMessage(chatId, reply);
  await saveBotReply(db, clientId, reply);
}

export async function handleSave(db: any, chatId: number, clientId: number): Promise<void> {
  const { data: lastMsg } = await db
    .from("messages")
    .select("recipe_id")
    .eq("client_id", clientId)
    .eq("sender_type", "bot")
    .not("recipe_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let reply: string;
  if (!lastMsg?.recipe_id) {
    reply = "Сначала попросите рецепт, потом сохраните его 🍽️";
  } else {
    const { data: recipe } = await db.from("recipes").select("title").eq("id", lastMsg.recipe_id).maybeSingle();
    const { error: saveErr } = await db.from("client_favorite_recipes").insert({
      client_id: clientId,
      recipe_id: lastMsg.recipe_id,
      title: recipe?.title ?? "Рецепт",
    });
    reply = saveErr?.code === "23505"
      ? "Этот рецепт уже в вашем избранном ⭐"
      : `⭐ Рецепт «${recipe?.title ?? ""}» сохранён!`;
  }
  await sendMessage(chatId, reply);
  await saveBotReply(db, clientId, reply);
}

export async function handleSaved(db: any, chatId: number, clientId: number): Promise<void> {
  const { data: favorites } = await db
    .from("client_favorite_recipes")
    .select("title")
    .eq("client_id", clientId)
    .order("saved_at", { ascending: false })
    .limit(20);

  let reply: string;
  if (!favorites?.length) {
    reply = "У вас пока нет сохранённых рецептов.\n\nНажмите ⭐ под рецептом или используйте /save.";
  } else {
    const list = (favorites as { title: string }[]).map((f, i) => `${i + 1}. ${f.title}`).join("\n");
    reply = `⭐ Ваши сохранённые рецепты:\n\n${list}\n\nНапишите название любого блюда, чтобы получить его снова.`;
  }
  await sendMessage(chatId, reply);
  await saveBotReply(db, clientId, reply);
}

export async function handleList(db: any, chatId: number, clientId: number): Promise<void> {
  const { data: lastMsg } = await db
    .from("messages")
    .select("recipe_id")
    .eq("client_id", clientId)
    .eq("sender_type", "bot")
    .not("recipe_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let reply: string;
  if (!lastMsg?.recipe_id) {
    reply = "Сначала попросите рецепт, потом я составлю список покупок 🛒";
  } else {
    const { data: recipe } = await db
      .from("recipes")
      .select("title, ingredients")
      .eq("id", lastMsg.recipe_id)
      .maybeSingle();
    reply = recipe
      ? `🛒 Список покупок для «${recipe.title}»:\n\n${recipe.ingredients}`
      : "Не удалось найти рецепт. Попробуйте снова.";
  }
  await sendMessage(chatId, reply);
  await saveBotReply(db, clientId, reply);
}

export async function handleRandom(db: any, chatId: number, clientId: number): Promise<void> {
  await sendTyping(chatId);
  const { data: randomRecipe } = await db
    .from("recipes")
    .select("id, title, description")
    .order("id", { ascending: false })
    .limit(100)
    .then(({ data }: { data: { id: number; title: string; description: string | null }[] | null }) => {
      if (!data || data.length === 0) return { data: null };
      const pick = data[Math.floor(Math.random() * data.length)];
      return { data: pick };
    });

  if (!randomRecipe) {
    const reply = "Рецептов пока нет в базе. Попросите приготовить что-нибудь!";
    await sendMessage(chatId, reply);
    await saveBotReply(db, clientId, reply);
  } else {
    const reply = randomRecipe.description ?? randomRecipe.title;
    await sendMessage(chatId, reply, recipeKeyboard(randomRecipe.id));
    await saveBotReply(db, clientId, reply, randomRecipe.id);
  }
}

export async function handleWeek(db: any, chatId: number, clientId: number): Promise<void> {
  await sendTyping(chatId);
  const { data: prefs } = await db
    .from("client_preferences")
    .select("dietary_notes")
    .eq("client_id", clientId)
    .maybeSingle();
  try {
    const plan = await generateWeekPlan(prefs?.dietary_notes);
    await sendMessage(chatId, plan);
    await saveBotReply(db, clientId, plan);
  } catch (err) {
    console.error("Week plan error:", err);
    const reply = "Не удалось составить план питания. Попробуйте позже.";
    await sendMessage(chatId, reply);
    await saveBotReply(db, clientId, reply);
  }
}
