# Digis Creator Earnings Model - 100% to Creators

## 🎯 Business Model Overview

**Creators earn 100% of all tokens spent on them.**

**Digis makes money from token sales markup, not from creator earnings.**

---

## 💰 Revenue Flow

### Token Sales (Digis Revenue)
```
User buys tokens from Digis:
$9.99 → 100 tokens (Digis keeps the margin)
$39.99 → 500 tokens (Digis keeps the margin)
$99.99 → 1500 tokens (Digis keeps the margin)

Example:
User pays $9.99 → Gets 100 tokens
Cost of 100 tokens to Digis: ~$0.05 (5 cents)
Digis margin: $9.94 per purchase
```

### Token Spending (Creator Earnings)
```
When fans spend tokens on creators:
100 tokens spent → Creator gets 100 tokens (100%)
NO platform fee deducted
NO revenue split

Creator cashes out:
100 tokens → $5.00 USD payout
(1 token = 5 cents when cashing out)
```

---

## 🎬 How It Works

### 1. Tips
```
Fan sends 100 token tip to Creator
├─ Fan wallet: -100 tokens
└─ Creator wallet: +100 tokens (100%)

Billing events recorded:
- Fan: -100 tokens (tip)
- Creator: +100 tokens (payout)
- Platform fee: 0
```

### 2. Pay-Per-Minute Calls (PPM)
```
Call rate: 60 tokens/minute
Billing block: 30 seconds

Every 30s during call:
├─ Fan charged: 30 tokens
└─ Creator receives: 30 tokens (100%)

Billing events recorded:
- Fan: -30 tokens (ppm)
- Creator: +30 tokens (payout)
- Platform fee: 0
```

### 3. Ticketed Private Shows
```
Ticket price: 500 tokens

When fan purchases ticket:
├─ Fan wallet: -500 tokens
└─ Creator wallet: +500 tokens (100%)

Billing events recorded:
- Fan: -500 tokens (ticket)
- Creator: +500 tokens (payout)
- Platform fee: 0
```

---

## 📊 Example Calculations

### Scenario 1: Tipping
```
Fan buys 100 tokens for $9.99
├─ Digis receives: $9.99
├─ Digis cost: ~$0.05
└─ Digis margin: $9.94 ✅

Fan tips creator 100 tokens
├─ Creator receives: 100 tokens
└─ Creator cashes out: $5.00

Total flow:
- Fan paid: $9.99
- Creator earned: $5.00
- Digis margin: $4.99 (50% of payout value)
```

### Scenario 2: PPM Call (30 minutes)
```
Call rate: 60 tokens/min
Duration: 30 minutes
Total cost: 1,800 tokens

Fan buys 2,000 tokens for ~$100
├─ Digis receives: $100
├─ Digis cost: ~$0.10
└─ Digis margin: $99.90 ✅

During call:
├─ Fan charged: 1,800 tokens (60 blocks × 30 tokens)
└─ Creator receives: 1,800 tokens (100%)

Creator cashes out:
1,800 tokens → $90.00 USD

Total flow:
- Fan paid: $100
- Creator earned: $90
- Digis margin: $10 (10% of payout value)
```

### Scenario 3: Private Show Ticket
```
Ticket price: 500 tokens

Fan buys 500 tokens for $39.99
├─ Digis receives: $39.99
├─ Digis cost: ~$0.025
└─ Digis margin: $39.965 ✅

Fan purchases ticket:
├─ Fan charged: 500 tokens
└─ Creator receives: 500 tokens (100%)

Creator cashes out:
500 tokens → $25.00 USD

Total flow:
- Fan paid: $39.99
- Creator earned: $25.00
- Digis margin: $14.99 (37% of payout value)
```

---

## 🔍 Key Advantages

### For Creators
1. **100% of tokens spent** - No hidden fees or revenue splits
2. **Simple math** - If fan spends 100 tokens, creator gets 100 tokens
3. **Predictable earnings** - 1 token = 5 cents when cashing out
4. **No surprises** - No platform fees deducted from earnings

### For Digis
1. **Revenue from token sales** - Markup when users buy tokens
2. **No complex revenue splits** - Simple token economy
3. **Scalable margin** - Profit locked in at token purchase time
4. **Transparent pricing** - Easy to communicate to users

### For Fans
1. **Clear pricing** - Know exactly how many tokens creators get
2. **No hidden fees** - All tokens go directly to creators
3. **Fair system** - Creators get full value of spending

---

## 💡 Token Pricing Strategy

### Suggested Token Packages
```
Starter Pack:
$9.99 → 100 tokens
Cost: ~$0.05
Margin: $9.94 (99.5%)

Popular Pack:
$39.99 → 500 tokens (20% bonus)
Cost: ~$0.025
Margin: $39.965 (99.9%)

Best Value Pack:
$99.99 → 1500 tokens (50% bonus)
Cost: ~$0.07
Margin: $99.92 (99.9%)
```

### Token Value
```
Purchase side (fans buy):
- 1 token costs ~$0.10 (in smallest package)
- 1 token costs ~$0.08 (in medium package)
- 1 token costs ~$0.067 (in largest package)

Payout side (creators cash out):
- 1 token = $0.05 (5 cents)
- Consistent across all amounts
```

---

## 📝 Implementation Details

### Backend Code Updates

**1. Tips** (`/backend/routes/tips.js`):
```javascript
// Creator gets 100%
const creatorCut = amountTokens;     // 100% to creator
const platformFee = 0;                // No platform fee

await client.query(
  'UPDATE wallets SET balance = balance + $1 WHERE user_id = $2',
  [creatorCut, creatorId]
);
```

**2. PPM Calls** (`/backend/services/billing.js`):
```javascript
// Creator gets 100%
const blockCost = Math.ceil((rate_tokens_per_min / 60) * 30);
const creatorCut = blockCost;         // 100% to creator
const platformFee = 0;                // No platform fee

await client.query(
  'UPDATE wallets SET balance = balance + $1 WHERE user_id = $2',
  [creatorCut, call.creator_id]
);
```

**3. Ticket Sales** (`/backend/routes/streams.js`):
```javascript
// Creator gets 100%
const creatorCut = priceTokens;       // 100% to creator
const platformFee = 0;                // No platform fee

await client.query(
  'UPDATE wallets SET balance = balance + $1 WHERE user_id = $2',
  [creatorCut, stream.creator_id]
);
```

---

## 🧪 Verification Tests

### Test 1: Tip Transaction
```
Setup:
- Fan has 100 tokens
- Creator has 0 tokens

Action:
- Fan tips creator 100 tokens

Expected Result:
- Fan balance: 0 tokens
- Creator balance: 100 tokens
- billing_events shows:
  * Fan: -100 (reason: tip)
  * Creator: +100 (reason: payout)
  * Platform fee: 0
```

### Test 2: PPM Call (1 minute)
```
Setup:
- Fan has 120 tokens
- Creator has 0 tokens
- Rate: 60 tokens/minute

Action:
- 1 minute call (2 billing blocks)

Expected Result:
- Fan balance: 60 tokens (120 - 60)
- Creator balance: 60 tokens
- billing_events shows:
  * Block 1: Fan -30, Creator +30
  * Block 2: Fan -30, Creator +30
  * All platform fees: 0
```

### Test 3: Ticket Purchase
```
Setup:
- Fan has 500 tokens
- Creator has 0 tokens
- Ticket price: 500 tokens

Action:
- Fan purchases ticket

Expected Result:
- Fan balance: 0 tokens
- Creator balance: 500 tokens
- billing_events shows:
  * Fan: -500 (reason: ticket)
  * Creator: +500 (reason: payout)
  * Platform fee: 0
```

---

## 📈 Financial Projections

### Example Month
```
Token Sales (Digis Revenue):
1,000 fans × $39.99 = $39,990
Digis cost: ~$25
Digis margin: $39,965

Token Spending (Creator Earnings):
Total tokens purchased: 500,000 tokens
Creators cash out: 400,000 tokens
Creator payouts: $20,000 (400,000 × $0.05)

Digis Net Revenue:
Token sales margin: $39,965
Creator payouts: -$20,000
Net profit: $19,965

ROI Analysis:
Revenue per user: $39.99
Cost per user: ~$0.025 (tokens) + $20 (payout)
Net per user: ~$19.97
Margin: 50%
```

---

## 🎯 Summary

**Revenue Model**: Token sales markup
**Creator Earnings**: 100% of tokens spent
**Platform Fee**: 0% (on spending)
**Token Value**: 1 token = 5 cents (payout)

**Key Principle**: Digis makes money when users **buy** tokens, not when they **spend** tokens.

This creates a **creator-friendly platform** with **transparent pricing** and **simple economics**.

---

## 🚀 Benefits Over Traditional Models

### Traditional Platform (80/20 split)
```
Fan spends $100
├─ Creator gets: $80
└─ Platform gets: $20

Issues:
- Complex revenue splits
- Creators feel platform is taking their earnings
- Hidden fees and calculations
```

### Digis Model (100% to creators)
```
Fan buys $100 in tokens
├─ Digis margin: $95 (locked in at purchase)

Fan spends tokens on creator
├─ Creator gets: 100% of tokens spent

Creator cashes out
├─ Gets predictable $0.05 per token

Benefits:
- Simple, transparent
- Creators get 100% of spending
- Digis margin locked in at token purchase
- No hidden fees or calculations
```

---

**This model positions Digis as the most creator-friendly platform in the market.** 🎉
