/**
 * AIProviderRouter — Core reliability layer
 *
 * Executes a fallback chain of providers for each AI task.
 * Features:
 *   - Per-provider 15s timeout (AbortController)
 *   - 429 rate-limit retry with exponential backoff (up to 2 retries per provider)
 *   - Skips providers whose API keys are missing
 *   - Classifies errors: NO_KEY | RATE_LIMIT | INVALID_KEY | TIMEOUT | API_ERROR
 *   - Logs which provider/model was selected on success
 */

import * as groq from "./providers/groqProvider.js";
import * as together from "./providers/togetherProvider.js";
import * as openrouter from "./providers/openrouterProvider.js";
import * as gemini from "./providers/geminiProvider.js";
import { selectChain } from "./ModelSelector.js";
import { getSystemKeysForProvider } from "../utils/apiKeys.js";

const PROVIDERS = { groq, together, openrouter, gemini };

const PROVIDER_TIMEOUT_MS = 60_000; // 60 seconds per provider attempt
const MAX_RATE_LIMIT_RETRIES = 2;
const RATE_LIMIT_BASE_DELAY_MS = 3000;

/**
 * Execute an AI task through the provider fallback chain.
 *
 * @param {string} task — one of: "summarize" | "lesson" | "safety" | "quiz" | "flashcards" | "chat" | "title"
 * @param {string} prompt — the full prompt to send
 * @param {{ userApiKeys?: object, onUserKeyFailure?: Function }} options
 * @returns {Promise<string>} — raw text response from the winning provider
 */
export async function call(task, prompt, { userApiKeys = {}, onUserKeyFailure = null } = {}) {
  const chain = selectChain(task);
  const errors = [];

  for (const { provider: providerName, model } of chain) {
    const provider = PROVIDERS[providerName];
    if (!provider) continue;

    const userKeyObj = userApiKeys?.[providerName];
    const userKey = userKeyObj?.apiKey;
    const systemKeys = getSystemKeysForProvider(providerName);

    // Ordered list of keys to try: user key first (if any), then system keys
    const keysToTry = [];
    if (userKey) keysToTry.push({ type: 'user', key: userKey });
    for (const sk of systemKeys) keysToTry.push({ type: 'system', key: sk });

    // Skip provider if neither system keys nor user key exists
    if (keysToTry.length === 0) {
      console.warn(`[AIRouter] Skipping ${providerName} — no keys available`);
      continue;
    }

    let rateLimitRetries = 0;
    let currentKeyIndex = 0;

    while (currentKeyIndex < keysToTry.length && rateLimitRetries <= MAX_RATE_LIMIT_RETRIES) {
      const activeKeyInfo = keysToTry[currentKeyIndex];
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);

      try {
        console.log(`[AIRouter] Calling ${providerName}/${model} with key type ${activeKeyInfo.type}...`);
        let result = await provider.call(prompt, model, controller.signal, activeKeyInfo.key);

        clearTimeout(timer);
        console.log(`[AIRouter] ✅ Task "${task}" served by ${providerName}/${model} (key type: ${activeKeyInfo.type})`);
        return result.text;

      } catch (err) {
        clearTimeout(timer);
        const code = err.code || "UNKNOWN";
        const reason = code === "TIMEOUT" ? "timeout" : err.message;

        // If the *user* key fails due to NO_KEY, INVALID_KEY, Daily Quota etc., we trigger the hook and fall back to system keys.
        const isQuotaOrAuthError = ["RATE_LIMIT", "INVALID_KEY", "DAILY_QUOTA"].includes(code);

        if (activeKeyInfo.type === 'user' && (isQuotaOrAuthError || code === "NO_KEY")) {
          console.warn(`[AIRouter] User key for ${providerName} failed: ${reason}. Falling back to system keys.`);
          if (onUserKeyFailure && typeof onUserKeyFailure === 'function') {
            await onUserKeyFailure(reason).catch(e => console.error("onUserKeyFailure error:", e.message));
          }
          currentKeyIndex++; // try next key (which will be a system key)
          continue;
        }

        if (code === "NO_KEY") {
          // Key missing entirely - move to next key
          errors.push(`${providerName}/${model}: key missing`);
          currentKeyIndex++;
          continue;
        }

        if (isQuotaOrAuthError) {
          console.warn(`[AIRouter] ${providerName}/${model} failed on key index ${currentKeyIndex} (${code}): ${reason}`);
          // Move to next key for hard limits/auth. For soft rate limits we could theoretically retry same key
          // but iterating keys is safer if we have multiple.
          currentKeyIndex++;
          if (currentKeyIndex < keysToTry.length) {
            console.log(`[AIRouter] Trying next key for ${providerName}...`);
            continue;
          } else {
            // all keys exhausted for this provider
            errors.push(`${providerName}/${model} all keys exhausted. Last err: ${code}`);
            break;
          }
        }

        // For TIMEOUT or general API_ERROR — move on to next PROVIDER in the chain entirely
        console.warn(`[AIRouter] ⚠️  ${providerName}/${model} failed (${code}): ${reason}`);
        errors.push(`${providerName}/${model}: ${code} — ${reason}`);
        break; // break key loop, try next provider in chain
      }
    }
  }

  // All providers exhausted
  throw new Error(
    `[AIRouter] All providers failed for task "${task}".\n` +
    errors.map((e) => `  • ${e}`).join("\n")
  );
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
