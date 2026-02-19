import { runAgent } from "../agent/loop.js";

/**
 * In-process handler: run agent directly without connecting to the gateway.
 * Used when the gateway is not running or for single-shot CLI usage.
 */
export async function handleMessage(message: string): Promise<string> {
  return runAgent(message);
}
