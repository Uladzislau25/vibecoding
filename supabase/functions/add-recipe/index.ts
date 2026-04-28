import { createClient } from "@supabase/supabase-js";
import { Database } from "../_shared/database.types.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const admin = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function createEmbedding(text: string): Promise<number[]> {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text,
      dimensions: 1536,
    }),
  });
  if (!res.ok) {
    throw new Error(`OpenAI embeddings error: ${res.status} ${await res.text()}`);
  }
  const body = await res.json();
  return body.data[0].embedding;
}

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
    const description = typeof body?.description === "string"
      ? body.description.trim()
      : "";
    const ingredients = typeof body?.ingredients === "string"
      ? body.ingredients.trim()
      : "";
    const instructions = typeof body?.instructions === "string"
      ? body.instructions.trim()
      : "";

    if (!title || !ingredients || !instructions) {
      return jsonResponse(
        { error: "title, ingredients and instructions are required" },
        400,
      );
    }

    const embeddingInput = [title, description, ingredients, instructions]
      .filter(Boolean)
      .join("\n\n");
    const embedding = await createEmbedding(embeddingInput);

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
      if (!updated) {
        return jsonResponse({ error: "Recipe not found" }, 404);
      }

      return jsonResponse({ success: true, id: updated.id });
    }

    const { data: inserted, error: insertError } = await admin
      .from("recipes")
      .insert(payload)
      .select("id")
      .single();

    if (insertError || !inserted) {
      console.error("Failed to insert recipe:", insertError);
      return jsonResponse({ error: "Failed to save recipe" }, 500);
    }

    return jsonResponse({ success: true, id: inserted.id });
  } catch (err) {
    console.error("add-recipe error:", err);
    return jsonResponse({ error: "Internal error" }, 500);
  }
});
