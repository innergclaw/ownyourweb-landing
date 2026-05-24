# TON Bag Tracker

A static MVP for tracking TON wallets and jettons.

## What it does

- Loads the user's latest local bag summary as a demo.
- Scans any public TON wallet with TonAPI.
- Shows TON and jetton quantities, prices, values, and risk signals.
- Tracks Yoda, strawberry, and UTYA recovery targets.
- Compares portfolio buckets against the working target split:
  - HYPE 50%
  - NEAR 25%
  - TON 15%
  - TON memes 10%

## Run locally

From the workspace root:

```bash
python3 -m http.server 4173
```

Open:

```text
http://127.0.0.1:4173/ton-bag-tracker/
```

## Next build steps

- Add TON Connect wallet login.
- Add Telegram bot alerts for recovery target hits and high-risk token changes.
- Add Supabase user accounts and saved watchlists.
- Add manual buy entries and cost basis per token.
