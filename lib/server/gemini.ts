/**
 * The real Gemini client. SERVER ONLY: the `server-only` import makes the
 * build fail if this file is ever imported by browser code, so the API key
 * can never reach the frontend.
 */
import "server-only";
import { ApiError, GoogleGenAI, ThinkingLevel } from "@google/genai";
import { AnalysisError, type GenerateFn } from "@/lib/analysis/run";

/** Default model (verified as a stable model ID in Google's model list on 25 Nov 2026). */
export const DEFAULT_MODEL = "gemini-3.1-flash-lite";
/** Hard cap on output (including thinking) per call — limits the worst-case cost. */
export const MAX_OUTPUT_TOKENS = 4096;
/** Per-call timeout. With at most 2 calls the route stays inside its 60 s limit. */
export const CALL_TIMEOUT_MS = 25_000;

const THINKING_LEVELS: Record<string, ThinkingLevel> = {
  minimal: ThinkingLevel.MINIMAL,
  low: ThinkingLevel.LOW,
  medium: ThinkingLevel.MEDIUM,
  high: ThinkingLevel.HIGH,
};

export type GeminiConfig = { apiKey: string | null; model: string; thinkingLevel: string };

/** Reads server-side environment variables. Nothing here is ever sent to the browser. */
export function readGeminiConfig(): GeminiConfig {
  const level = (process.env.GEMINI_THINKING_LEVEL ?? "").trim().toLowerCase();
  return {
    apiKey: process.env.GEMINI_API_KEY?.trim() || null,
    model: process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL,
    thinkingLevel: level in THINKING_LEVELS ? level : "low",
  };
}

/** Converts SDK/network errors into a small set of safe error codes (no message content is passed on). */
export function toAnalysisError(error: unknown): AnalysisError {
  if (error instanceof AnalysisError) return error;
  if (error instanceof ApiError) {
    if (error.status === 429) return new AnalysisError("ai_rate_limited", `Gemini HTTP 429`);
    if (error.status === 401 || error.status === 403) return new AnalysisError("not_configured", `Gemini HTTP ${error.status} (API key rejected)`);
    if (error.status === 404) return new AnalysisError("not_configured", "Gemini HTTP 404 (model not found)");
    if (error.status === 400 && /api key/i.test(error.message)) return new AnalysisError("not_configured", "Gemini HTTP 400 (invalid API key)");
    return new AnalysisError("ai_unavailable", `Gemini HTTP ${error.status}`);
  }
  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : "";
  if (name === "AbortError" || name === "TimeoutError" || /timed? ?out|abort/i.test(message)) {
    return new AnalysisError("ai_timeout", "Gemini call timed out");
  }
  return new AnalysisError("ai_unavailable", `Gemini call failed (${name || "unknown error"})`);
}

export function createGeminiGenerate(config: { apiKey: string; model: string; thinkingLevel: string }): GenerateFn {
  const ai = new GoogleGenAI({ apiKey: config.apiKey });
  return async (req) => {
    try {
      const response = await ai.models.generateContent({
        model: config.model,
        contents: req.userContent,
        config: {
          systemInstruction: req.systemInstruction,
          responseMimeType: "application/json",
          responseJsonSchema: req.responseSchema,
          maxOutputTokens: MAX_OUTPUT_TOKENS,
          thinkingConfig: { thinkingLevel: THINKING_LEVELS[config.thinkingLevel] ?? ThinkingLevel.LOW },
          httpOptions: { timeout: CALL_TIMEOUT_MS },
        },
      });
      const u = response.usageMetadata;
      return {
        text: response.text,
        usage: {
          inputTokens: u?.promptTokenCount ?? 0,
          outputTokens: u?.candidatesTokenCount ?? 0,
          thinkingTokens: u?.thoughtsTokenCount ?? 0,
          totalTokens: u?.totalTokenCount ?? 0,
        },
      };
    } catch (error) {
      throw toAnalysisError(error);
    }
  };
}
