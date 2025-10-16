/**
 * Produce sanitized metadata for sensitive environment variables.
 *
 * Returns presence/length information and a stable fingerprint that can be used
 * to correlate logs without exposing the underlying secret.
 */
export function getSecretDiagnostics(value: string | undefined) {
  if (!value) {
    return {
      present: false,
      length: 0,
      fingerprint: null as string | null,
    };
  }

  const fingerprint = hashString(value).slice(0, 8);

  return {
    present: true,
    length: value.length,
    fingerprint,
  };
}

/**
 * Lightweight string hash that works in both Node and browser runtimes.
 * Uses a 32-bit FNV-1a variant and returns a hex string.
 */
function hashString(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    // 32-bit FNV prime
    hash = (hash * 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
