/**
 * POST /api/analyze logic, kept free of Next.js and of the real Gemini client
 * so it can be tested directly. app/api/analyze/route.ts wires in the real ones.
 *
 * Logging rule (spec SR-8): only counts, timings and error codes — never the
 * profile, the job description or the AI output.
 */
import { costUsd } from "./cost.ts";
import { MAX_BODY_BYTES, parseAnalyzeRequest } from "./request.ts";
import { AnalysisError, ZERO_USAGE, runAnalysis, type AnalysisErrorCode, type GenerateFn, type TokenUsage } from "./run.ts";

export const USER_MESSAGES: Record<AnalysisErrorCode | "bad_request" | "too_large" | "server_error", string> = {
  bad_request: "Something in the request wasn't valid. Please check your inputs and try again.",
  too_large: "The job description is too long. Please shorten it to 15,000 characters or fewer.",
  not_configured:
    "Job analysis isn't available right now because the AI service hasn't been set up. Your inputs are kept — please try again later.",
  not_job_description:
    "This doesn't look like a job description. Please paste the full job listing (responsibilities and requirements) and try again.",
  invalid_ai_response: "We couldn't complete the analysis this time. Your inputs are kept — please try again.",
  ai_timeout: "The analysis took too long. Your inputs are kept — please try again.",
  ai_rate_limited: "The analysis service is busy right now. Please wait a minute and try again.",
  ai_unavailable: "The analysis service isn't responding right now. Your inputs are kept — please try again in a moment.",
  server_error: "Something went wrong on our side. Your inputs are kept — please try again.",
};

const STATUS: Record<keyof typeof USER_MESSAGES, number> = {
  bad_request: 400,
  too_large: 413,
  not_job_description: 422,
  ai_rate_limited: 429,
  invalid_ai_response: 502,
  ai_unavailable: 502,
  not_configured: 503,
  ai_timeout: 504,
  server_error: 500,
};

export type AnalyzeDeps = {
  apiKey: string | null;
  model: string;
  makeGenerate: (apiKey: string) => GenerateFn;
  log?: (entry: Record<string, unknown>) => void;
  now?: () => number;
};

function errorResponse(code: keyof typeof USER_MESSAGES, message?: string): Response {
  return Response.json({ error: code, message: message ?? USER_MESSAGES[code] }, { status: STATUS[code] });
}

export async function handleAnalyzeRequest(request: Request, deps: AnalyzeDeps): Promise<Response> {
  const now = deps.now ?? Date.now;
  const started = now();
  const log = (entry: Record<string, unknown>) =>
    deps.log?.({ event: "analysis", model: deps.model, ms: now() - started, ...entry });

  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) {
    log({ outcome: "too_large" });
    return errorResponse("too_large");
  }
  let body: unknown;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY_BYTES) {
      log({ outcome: "too_large" });
      return errorResponse("too_large");
    }
    body = JSON.parse(raw);
  } catch {
    log({ outcome: "bad_request" });
    return errorResponse("bad_request");
  }

  const parsed = parseAnalyzeRequest(body);
  if (!parsed.ok) {
    log({ outcome: "bad_request" });
    return errorResponse("bad_request", parsed.message);
  }

  if (!deps.apiKey) {
    log({ outcome: "not_configured", reason: "GEMINI_API_KEY is not set" });
    return errorResponse("not_configured");
  }

  try {
    const { analysis, usage, calls } = await runAnalysis({
      profile: parsed.value.profile,
      job: parsed.value.job,
      model: deps.model,
      generate: deps.makeGenerate(deps.apiKey),
    });
    const cost = costUsd(deps.model, usage);
    log({
      outcome: "ok",
      calls,
      ...usage,
      costUsd: cost,
      requirements: analysis.requirements.length,
      groundingDowngrades: analysis.groundingDowngrades,
      alignment: analysis.alignmentLevel,
    });
    return Response.json({ analysis, meta: { model: deps.model, calls, usage, costUsd: cost } });
  } catch (error) {
    const e = error as AnalysisError & { usage?: TokenUsage; calls?: number };
    const usage = e.usage ?? ZERO_USAGE;
    if (e instanceof AnalysisError) {
      log({ outcome: e.code, detail: e.message, calls: e.calls ?? 1, ...usage, costUsd: costUsd(deps.model, usage) });
      return errorResponse(e.code);
    }
    log({ outcome: "server_error", detail: error instanceof Error ? error.name : "unknown" });
    return errorResponse("server_error");
  }
}
