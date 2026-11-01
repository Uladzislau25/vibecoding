// deno-lint-ignore-file no-explicit-any
import { createEmbedding } from "../../_shared/embeddings.ts";
import { sendMessage, sendTyping, recipeKeyboard, clarifyKeyboard } from "../../_shared/api/telegram.ts";
import { stripMarkdown, extractServings } from "../../_shared/lib/text.ts";
import type { ClientSettings, ConversationMessage, GeneratedRecipe, TokenUsage } from "../../_shared/types/index.ts";
import { generateRecipe } from "../api/deepseek.ts";
import type { RecipeSearchMatch } from "../api/recipes.repo.ts";
import { getRecipeContent, insertRecipeWithDedup, searchSimilarRecipes } from "../api/recipes.repo.ts";
import { insertBotMessage } from "../api/messages.repo.ts";
import { markEscalated } from "../api/clients.repo.ts";
import { formatRecipe, withServings } from "../lib/prompt.ts";
import { ESCALATION_MESSAGE, RECIPE_FAILURE_REPLY, RECIPE_SIMILARITY_THRESHOLD } from "../_config.ts";

type ReplyDraft = {
  text: string;
  recipeId: number | null;
  clarifyOptions: string[];
  escalated: boolean;
  usage: TokenUsage;
};

const EMPTY_USAGE: TokenUsage = { prompt_tokens: null, completion_tokens: null, total_tokens: null };

export type ProcessRecipeRequestInput = {
  chatId: number;
  clientId: number;
  userText: string;
  settings: ClientSettings;
  systemPrompt: string;
  history: ConversationMessage[];
  contextQuery: string;
};

export async function processRecipeRequest(
  db: any,
  input: ProcessRecipeRequestInput,
): Promise<void> {
  const servings = extractServings(input.userText);
  const systemPrompt = withServings(input.systemPrompt, servings);

  await sendTyping(input.chatId);

  const draft = await buildReply(db, input, systemPrompt);
  const text = stripMarkdown(draft.text);

  await deliverReply(input.chatId, text, draft);
  await insertBotMessage(db, input.clientId, text, draft.recipeId, draft.usage);

  if (draft.escalated) {
    await markEscalated(db, input.clientId);
  }
}

async function buildReply(
  db: any,
  input: ProcessRecipeRequestInput,
  systemPrompt: string,
): Promise<ReplyDraft> {
  try {
    const best = await findSimilarRecipe(db, input.contextQuery);
    if (best && best.similarity >= RECIPE_SIMILARITY_THRESHOLD) {
      return {
        text: stripMarkdown(formatRecipe(best)),
        recipeId: best.id,
        clarifyOptions: [],
        escalated: false,
        usage: EMPTY_USAGE,
      };
    }

    const generated = await generateRecipe(
      input.settings.model,
      systemPrompt,
      input.history,
      input.userText,
      input.settings.temperature,
      input.settings.max_tokens,
    );

    if (generated.need_clarification) {
      return {
        text: generated.question,
        recipeId: null,
        clarifyOptions: generated.options,
        escalated: false,
        usage: generated.usage,
      };
    }

    if (!generated.can_help) {
      return {
        text: ESCALATION_MESSAGE,
        recipeId: null,
        clarifyOptions: [],
        escalated: true,
        usage: generated.usage,
      };
    }

    const generatedText = formatRecipe({
      title: generated.title,
      ingredients: generated.ingredients,
      instructions: generated.instructions,
      ...generated.nutrition,
    });

    const stored = await storeRecipe(db, generated, generatedText);

    return {
      text: stored.text,
      recipeId: stored.recipeId,
      clarifyOptions: [],
      escalated: false,
      usage: generated.usage,
    };
  } catch (err) {
    console.error("Failed to build reply:", err);
    return {
      text: RECIPE_FAILURE_REPLY,
      recipeId: null,
      clarifyOptions: [],
      escalated: false,
      usage: EMPTY_USAGE,
    };
  }
}

// Semantic search is best-effort: if the embedding provider is down, skip it
// and fall through to generation instead of failing the whole request.
async function findSimilarRecipe(db: any, contextQuery: string): Promise<RecipeSearchMatch | undefined> {
  try {
    const queryEmbedding = await createEmbedding(contextQuery, "query");
    const matches = await searchSimilarRecipes(db, queryEmbedding, contextQuery, 1);
    return matches[0];
  } catch (err) {
    console.error("Semantic search unavailable, generating without it:", err);
    return undefined;
  }
}

// Persisting + dedup is also best-effort: if embedding or the RPC fails, still
// return the freshly generated recipe (just without a stored id / dedup).
async function storeRecipe(
  db: any,
  generated: GeneratedRecipe,
  generatedText: string,
): Promise<{ text: string; recipeId: number | null }> {
  try {
    const passageInput = [generated.title, generated.ingredients, generated.instructions]
      .filter(Boolean)
      .join("\n\n");
    const passageEmbedding = await createEmbedding(passageInput, "passage");

    const dedup = await insertRecipeWithDedup(db, {
      title: generated.title,
      description: generatedText,
      ingredients: generated.ingredients,
      instructions: generated.instructions,
      category: generated.category || null,
      embedding: passageEmbedding,
      nutrition: generated.nutrition,
    });

    if (dedup?.reused && dedup.recipe_id !== null) {
      const existing = await getRecipeContent(db, dedup.recipe_id);
      if (existing) return { text: formatRecipe(existing), recipeId: dedup.recipe_id };
    }

    return { text: generatedText, recipeId: dedup?.recipe_id ?? null };
  } catch (err) {
    console.error("Failed to store recipe, replying without persistence:", err);
    return { text: generatedText, recipeId: null };
  }
}

async function deliverReply(chatId: number, text: string, draft: ReplyDraft): Promise<void> {
  if (draft.clarifyOptions.length > 0) {
    await sendMessage(chatId, text, clarifyKeyboard(draft.clarifyOptions));
  } else if (draft.recipeId !== null) {
    await sendMessage(chatId, text, recipeKeyboard(draft.recipeId));
  } else {
    await sendMessage(chatId, text);
  }
}
