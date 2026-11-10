import { describeSmsError, logSmsError } from "../log";
import { TurnValidationError, validateTurn, type HuahuaTurn, type HuahuaTurnInput, type TurnGenerator } from "./ai";
import { outboundAsksForCredentials } from "./safety";

export const DEFAULT_TURN_TIMEOUT_MS = 20_000;

export type TurnResult =
  | { source: "model"; turn: HuahuaTurn }
  | { source: "fallback"; turn: HuahuaTurn; reason: string };

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Huahua generation timed out after ${ms}ms`)), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Runs the model and validates its structured output. Invalid or unsafe
 * output falls back immediately. Transport failures (unavailable, timeout)
 * are retried once; after that `allowFallback` decides whether to send the
 * deterministic text or rethrow so the caller can retry later.
 */
export async function produceTurn(
  generate: TurnGenerator,
  input: HuahuaTurnInput,
  options: { fallback: HuahuaTurn; timeoutMs?: number; allowFallback: () => Promise<boolean> },
): Promise<TurnResult> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TURN_TIMEOUT_MS;
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const turn = validateTurn(await withTimeout(generate(input), timeoutMs));
      if (outboundAsksForCredentials(turn.message)) {
        return { source: "fallback", turn: options.fallback, reason: "unsafe_output" };
      }
      return { source: "model", turn };
    } catch (error) {
      lastError = error;
      if (error instanceof TurnValidationError) {
        logSmsError("Huahua output invalid, using fallback", error);
        return { source: "fallback", turn: options.fallback, reason: "invalid_output" };
      }
      logSmsError(`Huahua generation failed (attempt ${attempt + 1})`, error);
    }
  }
  if (await options.allowFallback()) {
    return { source: "fallback", turn: options.fallback, reason: describeSmsError(lastError).slice(0, 80) };
  }
  throw lastError;
}
