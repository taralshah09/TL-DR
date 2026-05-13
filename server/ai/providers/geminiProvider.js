/**
 * Gemini Provider Adapter
 * Wraps @google/generative-ai SDK with model rotation and retry logic.
 * Ported from the original geminiService.js — acts as last-resort fallback.
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import { proxyDispatcher } from "../../utils/proxy.js";

console.log("[GeminiProvider] Loading module...");
// Ordered list of Gemini models to try (newest, most capable first)
const GEMINI_MODELS = [
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
];
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2000;


export async function call(prompt, _model, signal, apiKey) {
  if (!apiKey) {
    throw Object.assign(new Error("No Gemini API key available"), { code: "NO_KEY" });
  }

  const activeGenAI = new GoogleGenerativeAI(apiKey, {
    requestOptions: {
      dispatcher: proxyDispatcher
    }
  });
  let lastError;

  for (const modelName of GEMINI_MODELS) {
    let currentModel = activeGenAI.getGenerativeModel({ model: modelName });

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      // Respect AbortController timeout from the router
      if (signal?.aborted) {
        throw Object.assign(new Error("[Gemini] Request aborted"), { code: "TIMEOUT" });
      }

      try {
        console.log(`[GeminiProvider] Attempting model ${modelName} (attempt ${attempt + 1})...`);
        const result = await currentModel.generateContent(prompt);
        return { text: result.response.text().trim() };
      } catch (err) {
        lastError = err;
        const errMsg = err?.message || "";
        const status = err?.status || (err?.response ? err.response.status : null);

        const isQuotaExceeded =
          status === 429 ||
          errMsg.includes("429") ||
          errMsg.toLowerCase().includes("quota") ||
          errMsg.toLowerCase().includes("rate limit");

        const isInvalidKey =
          status === 400 ||
          status === 403 ||
          errMsg.toLowerCase().includes("api_key_invalid") ||
          errMsg.toLowerCase().includes("api key not valid");

        const retryMatch = errMsg.match(/Please retry in ([\d.]+)s/);
        const retryDelayMs = retryMatch ? parseFloat(retryMatch[1]) * 1000 : null;

        const isDailyQuota =
          isQuotaExceeded &&
          (errMsg.includes("PerDay") || errMsg.includes("Daily") ||
            (errMsg.includes("limit: 0") && !retryDelayMs));

        if (isInvalidKey) {
            throw Object.assign(new Error(`[Gemini] Invalid API Key`), { code: "INVALID_KEY" });
        }
        
        if (isDailyQuota) {
            throw Object.assign(new Error(`[Gemini] Daily Quota Exceeded`), { code: "DAILY_QUOTA" });
        }

        if (isQuotaExceeded) {
          if (isDailyQuota) break; // try next model

          if (attempt < MAX_RETRIES) {
            const waitMs = retryDelayMs
              ? retryDelayMs + 1000
              : BASE_DELAY_MS * Math.pow(2, attempt) * (0.8 + Math.random() * 0.4);
            console.warn(`[Gemini] ${modelName} rate limited, retrying in ${(waitMs / 1000).toFixed(1)}s…`);
            await new Promise((r) => setTimeout(r, waitMs));
            continue;
          }
        }

        // Non-recoverable or exhausted retries — try next model
        console.error(`[Gemini] ${modelName} failed (attempt ${attempt + 1}): ${errMsg}`);
        break;
      }
    }
  }

  const err = new Error(`[Gemini] All models failed. Last: ${lastError?.message}`);
  err.code = "ALL_MODELS_FAILED";
  throw err;
}
