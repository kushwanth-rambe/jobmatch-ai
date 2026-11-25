import { handleAnalyzeRequest } from "@/lib/analysis/handler";
import { createGeminiGenerate, readGeminiConfig } from "@/lib/server/gemini";

/** Two Gemini calls at most (25 s each) fit inside this limit. */
export const maxDuration = 60;

/** POST /api/analyze — runs one JobMatch analysis on the server. */
export async function POST(request: Request) {
  const config = readGeminiConfig();
  return handleAnalyzeRequest(request, {
    apiKey: config.apiKey,
    model: config.model,
    makeGenerate: (apiKey) => createGeminiGenerate({ apiKey, model: config.model, thinkingLevel: config.thinkingLevel }),
    log: (entry) => console.log(JSON.stringify(entry)),
  });
}
