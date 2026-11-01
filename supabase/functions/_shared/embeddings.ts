const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;

const GEMINI_EMBED_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent";

const EMBEDDING_DIM = 1024;

export type EmbeddingKind = "query" | "passage";

// Gemini uses task types instead of BGE-M3's "query:"/"passage:" text prefixes.
const TASK_TYPE: Record<EmbeddingKind, string> = {
  query: "RETRIEVAL_QUERY",
  passage: "RETRIEVAL_DOCUMENT",
};

function extractValues(payload: unknown): number[] {
  const values = (payload as { embedding?: { values?: unknown } })?.embedding?.values;
  if (Array.isArray(values) && typeof values[0] === "number") {
    return values as number[];
  }
  throw new Error("Unexpected embedding response shape from Gemini");
}

// Gemini recommends L2-normalizing when outputDimensionality < 3072.
function normalize(vec: number[]): number[] {
  let sumSq = 0;
  for (const v of vec) sumSq += v * v;
  const norm = Math.sqrt(sumSq);
  if (norm === 0) return vec;
  return vec.map((v) => v / norm);
}

const MAX_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchEmbeddingOnce(text: string, kind: EmbeddingKind): Promise<number[]> {
  const res = await fetch(`${GEMINI_EMBED_ENDPOINT}?key=${GEMINI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "models/gemini-embedding-001",
      content: { parts: [{ text }] },
      taskType: TASK_TYPE[kind],
      outputDimensionality: EMBEDDING_DIM,
    }),
  });

  if (!res.ok) {
    throw new Error(
      `Gemini embeddings error: ${res.status} ${await res.text()}`,
    );
  }

  const body = await res.json();
  const embedding = normalize(extractValues(body));

  if (embedding.length !== EMBEDDING_DIM) {
    throw new Error(
      `Unexpected embedding dimension: got ${embedding.length}, expected ${EMBEDDING_DIM}`,
    );
  }

  return embedding;
}

export async function createEmbedding(
  text: string,
  kind: EmbeddingKind,
): Promise<number[]> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fetchEmbeddingOnce(text, kind);
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(500 * attempt);
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`Gemini embeddings failed after ${MAX_ATTEMPTS} attempts`);
}
