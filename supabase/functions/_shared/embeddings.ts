const HF_API_KEY = Deno.env.get("HF_API_KEY")!;

const BGE_M3_ENDPOINT =
  "https://router.huggingface.co/hf-inference/models/BAAI/bge-m3/pipeline/feature-extraction";

const EMBEDDING_DIM = 1024;

export type EmbeddingKind = "query" | "passage";

function applyPrefix(text: string, kind: EmbeddingKind): string {
  return `${kind}: ${text}`;
}

function flattenEmbedding(payload: unknown): number[] {
  if (Array.isArray(payload) && typeof payload[0] === "number") {
    return payload as number[];
  }
  if (Array.isArray(payload) && Array.isArray(payload[0])) {
    const inner = payload[0] as unknown[];
    if (typeof inner[0] === "number") {
      return inner as number[];
    }
  }
  throw new Error("Unexpected embedding response shape from BGE-M3");
}

const MAX_ATTEMPTS = 3;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchEmbeddingOnce(input: string): Promise<number[]> {
  const res = await fetch(BGE_M3_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${HF_API_KEY}`,
    },
    body: JSON.stringify({ inputs: input }),
  });

  if (!res.ok) {
    throw new Error(
      `BGE-M3 embeddings error: ${res.status} ${await res.text()}`,
    );
  }

  const body = await res.json();
  const embedding = flattenEmbedding(body);

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
  const input = applyPrefix(text, kind);

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await fetchEmbeddingOnce(input);
    } catch (err) {
      lastError = err;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(500 * attempt);
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`BGE-M3 embeddings failed after ${MAX_ATTEMPTS} attempts`);
}
