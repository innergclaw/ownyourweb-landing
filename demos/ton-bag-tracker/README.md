# TON Chain Radar

Telegram-ready public TON blockchain intelligence mini app.

## What it does

- Starts blank: no personal wallet is loaded by default.
- Lets users paste any public TON wallet address.
- Pulls native TON, jettons, estimated USD values, and risk tags from TonAPI.
- Shows recent transaction flow with explorer links.
- Grades wallets as retail, mid, large, or whale based on TON balance / tracked value.
- Quotes TON to USDt through chop's TON DEX router, with a TonAPI spot-price fallback.
- Links out to free DeFi systems such as chop, DeFiLlama, STON.fi, DeDust, Tonviewer, Tonscan whales, and exchange-wallet lists.

## Telegram setup

Set this as the bot Mini App URL in BotFather:

```text
https://ownyourweb.xyz/demos/ton-bag-tracker/
```

The app uses Telegram's `telegram-web-app.js` bridge for native Telegram main-button behavior, haptics, theme support, and auto-expand.
