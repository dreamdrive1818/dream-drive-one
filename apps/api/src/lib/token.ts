/** Default booking token: ₹500. */
export const DEFAULT_TOKEN_PAISE = 50_000;

/** Token collected now. Never more than the trip total. */
export function tokenDuePaise(tokenPaise: number | null | undefined, amountPaise: number) {
  const configured = tokenPaise && tokenPaise > 0 ? tokenPaise : DEFAULT_TOKEN_PAISE;
  return Math.min(configured, Math.max(0, amountPaise));
}
