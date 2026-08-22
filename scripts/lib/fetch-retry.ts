/**
 * Retries a fetch a few times with backoff. PCI SSC's feed endpoint
 * occasionally resets the TLS connection (ECONNRESET) under the daily
 * scheduled workflow; a bare `fetch failed` shouldn't fail the whole run.
 */

const DEFAULT_RETRIES = 3;
const DEFAULT_DELAY_MS = 3000;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function fetchWithRetry(
  url: string,
  init?: RequestInit,
  retries = DEFAULT_RETRIES,
  delayMs = DEFAULT_DELAY_MS,
): Promise<Response> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, init);
      if (!res.ok) throw new Error(`Feed fetch failed: ${res.status} ${res.statusText}`);
      return res;
    } catch (err) {
      if (attempt === retries) throw err;
      console.warn(`  Fetch attempt ${attempt} failed (${(err as Error).message}), retrying in ${delayMs * attempt}ms…`);
      await sleep(delayMs * attempt);
    }
  }
  throw new Error('unreachable');
}
