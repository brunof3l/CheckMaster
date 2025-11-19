export function safeUuid(): string {
  const g: any = (typeof globalThis !== 'undefined' ? globalThis : window) as any;
  // Prefer native crypto.randomUUID when available
  if (g.crypto && typeof g.crypto.randomUUID === 'function') {
    try {
      return g.crypto.randomUUID();
    } catch {}
  }
  // RFC4122 v4 fallback using getRandomValues when possible
  const bytes: Uint8Array = (g.crypto && typeof g.crypto.getRandomValues === 'function')
    ? g.crypto.getRandomValues(new Uint8Array(16))
    : new Uint8Array(16).map(() => Math.floor(Math.random() * 256)) as any;
  // Set version and variant bits
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0'));
  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}