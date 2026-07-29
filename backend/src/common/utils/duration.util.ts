const UNIT_TO_SECONDS: Record<string, number> = {
  s: 1,
  m: 60,
  h: 60 * 60,
  d: 60 * 60 * 24,
};

/**
 * Parses short duration strings used in JWT expiry config (e.g. `15m`, `7d`)
 * into seconds, so the API can report `expiresIn` as a plain number.
 */
export function parseDurationToSeconds(value: string): number {
  const match = /^(\d+)\s*([smhd])$/i.exec(value.trim());
  if (!match) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  const [, amount, unit] = match;
  return Number(amount) * UNIT_TO_SECONDS[unit.toLowerCase()];
}
