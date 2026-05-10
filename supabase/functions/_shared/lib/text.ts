const GREETING_KEYWORDS = [
  "привет", "здравствуй", "здравствуйте", "хай", "хей", "приветствую",
  "добрый день", "добрый вечер", "доброе утро", "добрый", "доброго",
  "hello", "hi", "hey", "good morning", "good evening",
];
const GRATITUDE_KEYWORDS = [
  "спасибо", "спс", "благодарю", "благодарствую", "пасиб", "пасибо",
  "сяб", "thanks", "thank you", "thx",
];
const FAREWELL_KEYWORDS = [
  "пока", "до свидания", "до встречи", "всего доброго", "до скорого",
  "прощай", "прощайте", "бай", "bye", "goodbye", "увидимся", "до завтра",
  "всего хорошего", "счастливо",
];

export function detectCasual(text: string): "greeting" | "gratitude" | "farewell" | null {
  const lower = text.toLowerCase().trim();
  if (GREETING_KEYWORDS.some((kw) => lower.includes(kw))) return "greeting";
  if (GRATITUDE_KEYWORDS.some((kw) => lower.includes(kw))) return "gratitude";
  if (FAREWELL_KEYWORDS.some((kw) => lower.includes(kw))) return "farewell";
  return null;
}

export function pickRandom(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function extractServings(text: string): number | null {
  const match = text.match(/на\s+(\d+)\s*(человек|порци[ий]|персон)/i);
  return match ? parseInt(match[1]) : null;
}

export function stripMarkdown(text: string): string {
  return text.replace(/\*+/g, "").replace(/^#+\s*/gm, "").trim();
}
