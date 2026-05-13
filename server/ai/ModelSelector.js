/**
 * ModelSelector — Maps task types to ordered provider/model chains
 *
 * Task types:
 *   "summarize" | "lesson" | "safety" | "quiz" | "flashcards" | "chat" | "title"
 *
 * Each chain is ordered by priority. AIProviderRouter will try them left-to-right.
 * Gemini is always last since it's quota-limited and key-dependent.
 */

// Provider ids must match the keys used in AIProviderRouter.PROVIDERS
export const MODEL_CHAINS = {
  /** Summarization, lesson content, content safety, course title */
  summarize: [
    { provider: "groq", model: "llama-3.3-70b-versatile" },
    { provider: "together", model: "mistralai/Mixtral-8x7B-Instruct-v0.1" },
    { provider: "openrouter", model: "meta-llama/llama-3.3-70b-instruct:free" },
    { provider: "openrouter", model: "meta-llama/llama-3.1-8b-instruct:free" },
    { provider: "gemini", model: "gemini-2.0-flash" },
  ],

  lesson: [
    { provider: "groq", model: "llama-3.3-70b-versatile" },
    { provider: "together", model: "mistralai/Mixtral-8x7B-Instruct-v0.1" },
    { provider: "openrouter", model: "meta-llama/llama-3.3-70b-instruct:free" },
    { provider: "openrouter", model: "meta-llama/llama-3.1-8b-instruct:free" },
    { provider: "gemini", model: "gemini-2.0-flash" },
  ],

  safety: [
    { provider: "groq", model: "llama-3.3-70b-versatile" },
    { provider: "together", model: "mistralai/Mixtral-8x7B-Instruct-v0.1" },
    { provider: "openrouter", model: "meta-llama/llama-3.3-70b-instruct:free" },
    { provider: "openrouter", model: "meta-llama/llama-3.1-8b-instruct:free" },
    { provider: "gemini", model: "gemini-2.0-flash" },
  ],

  title: [
    { provider: "groq", model: "llama-3.3-70b-versatile" },
    { provider: "together", model: "mistralai/Mixtral-8x7B-Instruct-v0.1" },
    { provider: "openrouter", model: "meta-llama/llama-3.1-8b-instruct:free" },
    { provider: "gemini", model: "gemini-2.0-flash" },
  ],

  /** Quiz generation — Mixtral is excellent at structured MCQ */
  quiz: [
    { provider: "together", model: "mistralai/Mixtral-8x7B-Instruct-v0.1" },
    { provider: "groq", model: "llama-3.3-70b-versatile" },
    { provider: "openrouter", model: "mistralai/mistral-7b-instruct:free" },
    { provider: "openrouter", model: "meta-llama/llama-3.1-8b-instruct:free" },
    { provider: "gemini", model: "gemini-2.0-flash" },
  ],

  /** Flashcard + course module generation */
  flashcards: [
    { provider: "groq", model: "llama-3.3-70b-versatile" },
    { provider: "together", model: "mistralai/Mixtral-8x7B-Instruct-v0.1" },
    { provider: "openrouter", model: "meta-llama/llama-3.3-70b-instruct:free" },
    { provider: "openrouter", model: "meta-llama/llama-3.1-8b-instruct:free" },
    { provider: "gemini", model: "gemini-2.0-flash" },
  ],

  /** Chat / Q&A — Llama-3-70B is best for conversational quality */
  chat: [
    { provider: "groq", model: "llama-3.3-70b-versatile" },
    { provider: "together", model: "mistralai/Mixtral-8x7B-Instruct-v0.1" },
    { provider: "openrouter", model: "meta-llama/llama-3.3-70b-instruct:free" },
    { provider: "openrouter", model: "meta-llama/llama-3.1-8b-instruct:free" },
    { provider: "gemini", model: "gemini-2.0-flash" },
  ],
  
  /** Reranking — fast model for ranking chunks */
  rerank: [
    { provider: "groq", model: "llama-3.1-8b-instant" },
    { provider: "openrouter", model: "openai/gpt-4o-mini" },
    { provider: "openrouter", model: "meta-llama/llama-3.1-8b-instruct:free" },
  ],
};

/**
 * Returns the ordered provider/model chain for a given task.
 * @param {keyof typeof MODEL_CHAINS} task
 * @returns {{ provider: string, model: string }[]}
 */
export function selectChain(task) {
  const chain = MODEL_CHAINS[task];
  if (!chain) throw new Error(`Unknown task type: "${task}". Valid: ${Object.keys(MODEL_CHAINS).join(", ")}`);
  return chain;
}
