const PREFIX = "dd_quote_";

/** Minimum quote fields for FE.W.05 checkout handoff (no secrets). */
export function buildQuoteHandoff(quote, car) {
  if (!quote?.id) return null;
  return {
    id: quote.id,
    carModelId: quote.carModelId,
    rentalType: quote.rentalType,
    startsAt: quote.startsAt,
    endsAt: quote.endsAt,
    amountPaise: quote.amountPaise,
    depositPaise: quote.depositPaise ?? 0,
    expiresAt: quote.expiresAt,
    payload: quote.payload ?? null,
    carName: car?.name ?? "",
    carSlug: car?.slug ?? "",
    cityName: car?.city?.name ?? "",
  };
}

export function saveQuoteHandoff(quote, car) {
  const data = buildQuoteHandoff(quote, car);
  if (!data) return;
  try {
    sessionStorage.setItem(`${PREFIX}${quote.id}`, JSON.stringify(data));
  } catch {
    // sessionStorage may be unavailable
  }
  return data;
}

export function loadQuoteHandoff(quoteId) {
  if (!quoteId) return null;
  try {
    const raw = sessionStorage.getItem(`${PREFIX}${quoteId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
