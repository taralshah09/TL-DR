import { QdrantClient } from "@qdrant/js-client-rest";
import { getEmbedding, getEmbeddings } from "./EmbeddingService.js";
import { call as callAI } from "./AIProviderRouter.js";
import crypto from "crypto";

// Qdrant Configuration
const QDRANT_URL = process.env.QDRANT_URL || "http://localhost:6333";
const QDRANT_API_KEY = process.env.QDRANT_API_KEY;
const COLLECTION_NAME = "tldr_v1";

const client = new QdrantClient({
  url: QDRANT_URL,
  apiKey: QDRANT_API_KEY,
});

/**
 * Ensure the collection exists in Qdrant.
 */
async function ensureCollection() {
  try {
    console.log("[Qdrant] Calling getCollections()...");
    const collections = await client.getCollections();
    const exists = collections.collections.some((c) => c.name === COLLECTION_NAME);

    if (!exists) {
      console.log(`[Qdrant] Creating fresh collection "${COLLECTION_NAME}"…`);
      await client.createCollection(COLLECTION_NAME, {
        vectors: {
          size: 1024,
          distance: "Cosine",
        },
      });
      console.log(`[Qdrant] Collection "${COLLECTION_NAME}" created successfully.`);
    } else {
      console.log(`[Qdrant] Collection "${COLLECTION_NAME}" is ready.`);
    }
  } catch (err) {
    console.error("[Qdrant] ensureCollection failed:", err.message);
    throw err;
  }
}


/**
 * Build and store an embedding index for a course in Qdrant.
 */
export async function buildIndex(courseId, chunks) {
  try {
    await ensureCollection();

    console.log(`[Qdrant] Preparing to index ${chunks.length} chunks for course: ${courseId}`);

    const texts = chunks.map((c) => c.text);
    const embeddings = await getEmbeddings(texts);

    if (!embeddings || embeddings.length === 0) {
      throw new Error("No embeddings generated.");
    }

    console.log(`[Qdrant] Vector dimension: ${embeddings[0].length}`);

    const points = chunks.map((chunk, i) => {
      // Create a deterministic UUID based on courseId and index
      const seed = `${courseId}-${i}`;
      const id = crypto.createHash('md5').update(seed).digest('hex').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");

      return {
        id,
        vector: embeddings[i],
        payload: {
          courseId: courseId.toString(),
          text: chunk.text,
          chunkIndex: i,
        },
      };
    });

    console.log(`[Qdrant] Upserting ${points.length} points (idempotent)…`);
    const result = await client.upsert(COLLECTION_NAME, {
      wait: true,
      points,
    });
    console.log(`[Qdrant] Upsert finished:`, result.status);
  } catch (err) {
    console.error("[Qdrant] buildIndex failed. Points count:", points.length);
    if (points.length > 0) console.error("[Qdrant] Sample point ID:", points[0].id);
    console.error("[Qdrant] Error detail:", err.message, err.response?.data || "");
    throw err;
  }
}

/**
 * Retrieve the top-K most relevant chunks for a query using Qdrant search + LLM Reranking.
 */
export async function retrieve(query, courseId, chunks, topK = 3) {
  try {
    await buildIndex(courseId, chunks);

    console.log(`[Qdrant] Querying for: "${query.slice(0, 30)}..."`);
    const queryEmbedding = await getEmbedding(query);

    // 1. Vector Search
    let searchResults = [];
    try {
      console.log(`[Qdrant] Searching for candidates in ${COLLECTION_NAME}...`);
      searchResults = await client.search(COLLECTION_NAME, {
        vector: queryEmbedding,
        filter: {
          must: [
            {
              key: "courseId",
              match: { value: courseId.toString() }
            }
          ]
        },
        limit: 15,
        with_payload: true,
      });
    } catch (searchErr) {
      console.warn(`[Qdrant] Filtered search failed (${searchErr.message}), trying unfiltered fallback...`);
      // Fallback: Search everything and filter in JS (safety measure)
      const fallbackResults = await client.search(COLLECTION_NAME, {
        vector: queryEmbedding,
        limit: 50,
        with_payload: true,
      });
      searchResults = fallbackResults.filter(r => r.payload?.courseId === courseId.toString());
    }

    console.log(`[Qdrant] Found ${searchResults.length} candidates.`);
    if (searchResults.length === 0) return "";



    // 2. LLM Reranking
    const candidates = searchResults.map((r, i) => ({
      id: i,
      text: r.payload.text,
    }));

    const rerankPrompt = `
You are an expert information retriever. Your task is to rank the following document chunks based on their relevance to the user's query.

User Query: "${query}"

Candidates:
${candidates.map((c) => `[ID: ${c.id}] ${c.text.slice(0, 500)}...`).join("\n\n")}

Instructions:
1. Identify the top ${topK} most relevant chunks that directly answer or provide context for the query.
2. Return ONLY a JSON array of the IDs (e.g., [2, 0, 5]) in descending order of relevance.
3. Do not include any other text or explanation.
`.trim();

    try {
      console.log(`[RAG] Reranking ${candidates.length} candidates using Groq...`);
      const rerankResponse = await callAI("rerank", rerankPrompt);

      // Extract JSON array from response
      const jsonMatch = rerankResponse.match(/\[\s*(\d+\s*,\s*)*\d+\s*\]/);
      const topIds = jsonMatch ? JSON.parse(jsonMatch[0]) : [0, 1, 2];

      const finalChunks = topIds
        .slice(0, topK)
        .map((id) => candidates.find((c) => c.id === id)?.text)
        .filter(Boolean);

      return finalChunks.join("\n\n---\n\n");
    } catch (rerankErr) {
      console.error("[RAG] Reranking failed, falling back to vector scores:", rerankErr.message);
      return searchResults
        .slice(0, topK)
        .map((r) => r.payload.text)
        .join("\n\n---\n\n");
    }
  } catch (err) {
    console.error("[Qdrant] retrieve failed for courseId:", courseId);
    console.error("[Qdrant] Error detail:", err.message, err.response?.data || "");
    throw err;
  }
}
