/**
 * Runs one JobMatch analysis: one Gemini call, check the reply, retry once
 * only if the reply is unusable, then apply the app-code checks.
 * Gemini is passed in as `generate`, so tests can use a stand-in and the real
 * client (lib/server/gemini.ts) stays server-only.
 */
import { analysisProfile, normaliseForAnalysis, type JobInput } from "../job.ts";
import type { Analysis, Profile } from "../types.ts";
import { postProcess } from "./postprocess.ts";
import { PROMPT_VERSION, SYSTEM_INSTRUCTION, buildUserContent } from "./prompt.ts";
import { aiAnalysisSchema, geminiResponseSchema } from "./schema.ts";

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number;
  totalTokens: number;
};

export type GenerateRequest = {
  systemInstruction: string;
  userContent: string;
  responseSchema: Record<string, unknown>;
};

export type GenerateResult = { text: string | undefined; usage: TokenUsage };

export type GenerateFn = (req: GenerateRequest) => Promise<GenerateResult>;

export type AnalysisErrorCode =
  | "not_configured"
  | "not_job_description"
  | "invalid_ai_response"
  | "ai_timeout"
  | "ai_rate_limited"
  | "ai_unavailable";

export class AnalysisError extends Error {
  readonly code: AnalysisErrorCode;
  constructor(code: AnalysisErrorCode, message?: string) {
    super(message ?? code);
    this.code = code;
    this.name = "AnalysisError";
  }
}

export const MAX_ATTEMPTS = 2;

export const ZERO_USAGE: TokenUsage = { inputTokens: 0, outputTokens: 0, thinkingTokens: 0, totalTokens: 0 };

function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    thinkingTokens: a.thinkingTokens + b.thinkingTokens,
    totalTokens: a.totalTokens + b.totalTokens,
  };
}

/** Parse and check one reply. Returns null if it is not usable JSON in the agreed shape. */
export function parseAiReply(text: string | undefined) {
  if (!text) return null;
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return null;
  }
  const result = aiAnalysisSchema.safeParse(data);
  return result.success ? result.data : null;
}

export type RunResult = { analysis: Analysis; usage: TokenUsage; calls: number };

export async function runAnalysis(input: {
  profile: Omit<Profile, "updatedAt">;
  job: JobInput;
  model: string;
  generate: GenerateFn;
}): Promise<RunResult> {
  const profile = analysisProfile(input.profile);
  const description = normaliseForAnalysis(input.job.description);
  const request: GenerateRequest = {
    systemInstruction: SYSTEM_INSTRUCTION,
    userContent: buildUserContent(profile, {
      description,
      titleHint: input.job.title,
      companyHint: input.job.company,
    }),
    responseSchema: geminiResponseSchema(),
  };

  let usage = ZERO_USAGE;
  let calls = 0;
  while (calls < MAX_ATTEMPTS) {
    calls += 1;
    const reply = await input.generate(request); // network/API errors are thrown as AnalysisError
    usage = addUsage(usage, reply.usage);
    const ai = parseAiReply(reply.text);
    if (!ai) continue; // unusable reply → one retry
    const result = postProcess(ai, { profile, jobDescription: description, model: input.model, promptVersion: PROMPT_VERSION });
    if (!result.ok) throw Object.assign(new AnalysisError("not_job_description"), { usage, calls });
    return { analysis: result.analysis, usage, calls };
  }
  throw Object.assign(new AnalysisError("invalid_ai_response"), { usage, calls });
}
