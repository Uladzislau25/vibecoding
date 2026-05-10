import { createAdminClient } from "../_shared/api/supabase.ts";
import { createEmbedding } from "../_shared/embeddings.ts";
import { corsHeaders, jsonResponse } from "../_shared/lib/http.ts";

const admin = createAdminClient();

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  try {
    const body = await req.json().catch(() => null);
    const id = typeof body?.id === "number" ? body.id : null;
    const title = typeof body?.title === "string" ? body.title.trim() : "";
    const description = typeof body?.description === "string" ? body.description.trim() : "";
    const ingredients = typeof body?.ingredients === "string" ? body.ingredients.trim() : "";
    const instructions = typeof body?.instructions === "string" ? body.instructions.trim() : "";

    if (!title || !ingredients || !instructions) {
      return jsonResponse({ error: "title, ingredients and instructions are required" }, 400);
    }

    const embeddingInput = [title, description, ingredients, instructions].filter(Boolean).join("\n\n");
    const embedding = await createEmbedding(embeddingInput, "passage");

    const payload = {
      title: title.slice(0, 256),
      description: description || null,
      ingredients,
      instructions,
      embedding: JSON.stringify(embedding),
    };

    if (id !== null) {
      const { data: updated, error: updateError } = await admin
        .from("recipes")
        .update(payload)
        .eq("id", id)
        .select("id")
        .maybeSingle();

      if (updateError) {
        console.error("Failed to update recipe:", updateError);
        return jsonResponse({ error: "Failed to update recipe" }, 500);
      }
      if (!updated) return jsonResponse({ error: "Recipe not found" }, 404);
      return jsonResponse({ success: true, id: updated.id });
    }

    const { data: inserted, error: insertError } = await admin
      .from("recipes")
      .insert(payload)
      .select("id")
      .single();

    if (insertError || !inserted) {
      if (insertError?.code === "23505") {
        return jsonResponse({ error: "Рецепт с таким названием уже существует" }, 409);
      }
      console.error("Failed to insert recipe:", insertError);
      return jsonResponse({ error: "Failed to save recipe" }, 500);
    }

    return jsonResponse({ success: true, id: inserted.id });
  } catch (err) {
    console.error("add-recipe error:", err);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
