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
    const query = typeof body?.query === "string" ? body.query.trim() : "";
    const recipeText = typeof body?.recipe_text === "string"
      ? body.recipe_text.trim()
      : "";

    if (!query || !recipeText) {
      return jsonResponse(
        { error: "query and recipe_text are required" },
        400,
      );
    }

    const embedding = await createEmbedding(`${query}\n\n${recipeText}`);

    const { data: inserted, error: insertError } = await admin
      .from("recipes")
      .insert({
        title: query.slice(0, 256),
        description: recipeText,
        ingredients: "",
        instructions: "",
        embedding: JSON.stringify(embedding),
      })
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
