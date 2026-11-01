// One-off: re-embed all recipes into Gemini embedding space (gemini-embedding-001, dim 1024).
// Run: deno run --allow-env --allow-net --env-file=.env.local scripts/reembed-recipes.ts
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent";

function normalize(vec: number[]): number[] {
  let s = 0;
  for (const v of vec) s += v * v;
  const n = Math.sqrt(s);
  return n === 0 ? vec : vec.map((v) => v / n);
}

async function embed(text: string): Promise<number[]> {
  const res = await fetch(`${ENDPOINT}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "models/gemini-embedding-001",
      content: { parts: [{ text }] },
      taskType: "RETRIEVAL_DOCUMENT",
      outputDimensionality: 1024,
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const body = await res.json();
  return normalize(body.embedding.values as number[]);
}

const listRes = await fetch(
  `${SUPABASE_URL}/rest/v1/recipes?select=id,title,ingredients,instructions&order=id.asc`,
  { headers: { apikey: SERVICE_ROLE, Authorization: `Bearer ${SERVICE_ROLE}` } },
);
const recipes = await listRes.json() as {
  id: number; title: string; ingredients: string; instructions: string;
}[];

console.log(`Re-embedding ${recipes.length} recipes...`);
let ok = 0, fail = 0;
for (const r of recipes) {
  try {
    const input = [r.title, r.ingredients, r.instructions].filter(Boolean).join("\n\n");
    const vec = await embed(input);
    const upd = await fetch(`${SUPABASE_URL}/rest/v1/recipes?id=eq.${r.id}`, {
      method: "PATCH",
      headers: {
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ embedding: JSON.stringify(vec) }),
    });
    if (!upd.ok) throw new Error(`PATCH ${upd.status}: ${await upd.text()}`);
    ok++;
    console.log(`  ✓ ${r.id} ${r.title}`);
  } catch (err) {
    fail++;
    console.error(`  ✗ ${r.id} ${r.title}:`, err instanceof Error ? err.message : err);
  }
}
console.log(`Done. ok=${ok} fail=${fail}`);
