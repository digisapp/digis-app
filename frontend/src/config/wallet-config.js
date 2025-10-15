// Token purchase packs (same for Fans and Creators)
export const TOKEN_PURCHASE_PACKS = [
  { tokens: 100, priceUsd: 10 },
  { tokens: 500, priceUsd: 45 },
  { tokens: 1000, priceUsd: 80 },
];

// Validate purchase packs config at runtime
export const validatePurchasePacks = (packs) => {
  try {
    if (!Array.isArray(packs) || packs.length === 0) return false;
    return packs.every(p =>
      Number.isInteger(p.tokens) && p.tokens > 0 &&
      typeof p.priceUsd === 'number' && p.priceUsd > 0
    );
  } catch {
    return false;
  }
};

// USD formatter
export const TOKEN_USD_FORMAT = new Intl.NumberFormat(undefined, {
  style: 'currency',
  currency: 'USD',
});

// Payout math (CONFIRMED): $0.05 USD per token
export const TOKEN_PAYOUT_USD_PER_TOKEN = 0.05;

// Estimate USD from earned tokens (for display)
export const estimatePayoutUsd = (earnedTokens) =>
  Number((earnedTokens * TOKEN_PAYOUT_USD_PER_TOKEN).toFixed(2));

// Format raw USD amount (not tokens)
export const formatUsd = (amount) => TOKEN_USD_FORMAT.format(amount);
