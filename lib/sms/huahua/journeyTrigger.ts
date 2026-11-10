import "server-only";
import { getSmsSupabaseAdmin } from "../admin";
import { getSmsConfig } from "../config";
import { logSmsError } from "../log";
import { createSupabaseSmsRpc } from "../rpc";
import { enqueueJourneyOpener } from "./openers";

/**
 * Queues a Huahua opener after a Journey step is completed. Never sends
 * anything itself and never fails the caller: the job runner applies every
 * gate (consent, subscription, window, allowance, ...) later.
 */
export async function queueJourneyOpener(input: { userId: string; journeyIslandId: string }) {
  if (!getSmsConfig().enabled) return;
  try {
    const rpc = createSupabaseSmsRpc(getSmsSupabaseAdmin());
    await enqueueJourneyOpener({ rpc }, input);
  } catch (error) {
    logSmsError("journey opener enqueue failed", error);
  }
}
