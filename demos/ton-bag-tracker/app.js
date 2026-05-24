const TON_API = "https://tonapi.io/v2";
const CHOP_API = "https://chop.ag/api/v1/quote";
const USDT_MASTER = "EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs";
const SAMPLE_WHALE = "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c";
const tg = window.Telegram?.WebApp;

const defiTools = [
  {
    title: "DeFiLlama",
    text: "Free DeFi dashboards for TVL, chains, yields, stablecoins, fees, bridges, and DEX volume.",
    url: "https://defillama.com/",
    tag: "TVL / Yields",
  },
  {
    title: "DeFiLlama Downloads",
    text: "Download free CSV datasets for yields, protocol TVL, stablecoins, volume, fees, and chain data.",
    url: "https://defillama.com/downloads",
    tag: "CSV data",
  },
  {
    title: "chop",
    text: "TON-native route aggregator for checking best swap output before touching a DEX directly.",
    url: "https://www.chop.ag/",
    tag: "Best price",
  },
  {
    title: "STON.fi",
    text: "TON-native DEX to inspect swaps, pools, and liquidity routes.",
    url: "https://ston.fi/",
    tag: "TON DEX",
  },
  {
    title: "DeDust",
    text: "TON DeFi exchange for checking token pools, liquidity, and swap conditions.",
    url: "https://dedust.io/",
    tag: "TON DEX",
  },
  {
    title: "Tonviewer",
    text: "Explorer links for wallet transactions, jettons, NFTs, and contract activity.",
    url: "https://tonviewer.com/",
    tag: "Explorer",
  },
  {
    title: "TON Whales",
    text: "A public rich-list style view for discovering large TON holders before pasting addresses here.",
    url: "https://tonscan.org/whales",
    tag: "Whales",
  },
  {
    title: "Exchange Wallets",
    text: "Tonviewer exchange-address list for watching hot wallets and potential exchange flow.",
    url: "https://tonviewer.com/addresses?section=exchanges",
    tag: "Flow",
  },
];

const els = {
  form: document.querySelector("#walletForm"),
  input: document.querySelector("#walletInput"),
  status: document.querySelector("#statusText"),
  sampleWhale: document.querySelector("#sampleWhale"),
  copySummary: document.querySelector("#copySummary"),
  total: document.querySelector("#totalValue"),
  ton: document.querySelector("#tonValue"),
  whaleGrade: document.querySelector("#whaleGrade"),
  risk: document.querySelector("#riskCount"),
  asOf: document.querySelector("#asOf"),
  holdings: document.querySelector("#holdingsBody"),
  whale: document.querySelector("#whaleList"),
  transactions: document.querySelector("#transactionList"),
  defi: document.querySelector("#defiList"),
  telegramNote: document.querySelector("#telegramNote"),
  quoteForm: document.querySelector("#quoteForm"),
  quoteAmount: document.querySelector("#quoteAmount"),
  quoteStatus: document.querySelector("#quoteStatus"),
  bestQuote: document.querySelector("#bestQuote"),
  quoteMeta: document.querySelector("#quoteMeta"),
  dexQuotes: document.querySelector("#dexQuotes"),
};

let lastReport = null;

function initTelegram() {
  if (!tg) return;
  document.body.classList.add("telegram");
  tg.ready();
  tg.expand();
  tg.setHeaderColor(tg.themeParams?.bg_color || "#f6f2e8");
  tg.setBackgroundColor(tg.themeParams?.bg_color || "#f6f2e8");

  const user = tg.initDataUnsafe?.user;
  if (els.telegramNote) {
    els.telegramNote.textContent = user?.first_name
      ? `Telegram mode active for ${user.first_name}.`
      : "Telegram mode active.";
  }

  tg.MainButton.setText("Search Wallet");
  tg.MainButton.show();
  tg.MainButton.onClick(() => {
    tg.HapticFeedback?.impactOccurred("light");
    searchWallet(els.input.value.trim()).catch(showError);
  });

  if (tg.SecondaryButton) {
    tg.SecondaryButton.setText("Copy");
    tg.SecondaryButton.show();
    tg.SecondaryButton.onClick(() => {
      tg.HapticFeedback?.selectionChanged();
      copyCurrentSummary();
    });
  }
}

function money(value) {
  return Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function compact(value) {
  return Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits: value > 1000 ? 2 : 6,
  });
}

function shortAddress(value) {
  if (!value) return "unknown";
  return `${value.slice(0, 6)}...${value.slice(-6)}`;
}

function tokenUnits(rawBalance, decimals) {
  return Number(rawBalance || 0) / 10 ** Number(decimals || 0);
}

function rawTon(amount) {
  const value = Math.max(0, Number(amount || 0));
  return String(Math.round(value * 1e9));
}

function fromRaw(value, decimals = 6) {
  return Number(value || 0) / 10 ** Number(decimals || 0);
}

function parseTonDiff(value) {
  if (typeof value === "number") return value / 100;
  return Number(String(value || "0").replace("−", "-").replace("%", "").replace("+", "")) / 100;
}

function signalFor(token) {
  const note = `${token.verification || ""} ${token.score ?? ""}`.toLowerCase();
  if (token.price <= 0 || token.verification === "blacklist") return { text: "exclude", tone: "bad" };
  if (token.ticker === "TON") return { text: "core", tone: "good" };
  if (token.score >= 50) return { text: "verified", tone: "info" };
  if (note.includes("whitelist")) return { text: "thin risk", tone: "warn" };
  return { text: "unknown", tone: "bad" };
}

function whaleGrade(tonQty, totalValue) {
  if (tonQty >= 1_000_000 || totalValue >= 2_000_000) return { grade: "Whale", tone: "violet", text: "Large enough to watch for market-moving behavior." };
  if (tonQty >= 100_000 || totalValue >= 200_000) return { grade: "Large", tone: "info", text: "Large holder. Watch transfer timing and exchange flow." };
  if (tonQty >= 10_000 || totalValue >= 25_000) return { grade: "Mid", tone: "warn", text: "Meaningful wallet. Useful for behavior tracking." };
  if (tonQty > 0 || totalValue > 0) return { grade: "Retail", tone: "good", text: "Small wallet. Useful for token composition, less useful for whale signals." };
  return { grade: "Empty", tone: "bad", text: "No tracked value found." };
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json();
}

async function getTonRate() {
  const rates = await fetchJson(`${TON_API}/rates?tokens=ton&currencies=usd`);
  return Number(rates.rates?.TON?.prices?.USD || 0);
}

async function getBestTonQuote(amountTon = "10") {
  const response = await fetch(CHOP_API, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      assetIn: "TON",
      assetOut: USDT_MASTER,
      amountIn: rawTon(amountTon),
      slippageBps: 50,
    }),
  });

  if (!response.ok) throw new Error(`chop quote unavailable: ${response.status}`);
  return response.json();
}

function pickQuoteOutput(quote) {
  const best = quote?.bestRoute || quote?.route || quote?.best || quote;
  const rawOut = best?.expectedOut || best?.amountOut || best?.outputAmount || best?.outAmount;
  return fromRaw(rawOut, 6);
}

function renderQuoteCards(quote, amountTon) {
  const cards = [];
  const quoteRows = Array.isArray(quote?.quotes) ? quote.quotes : [];

  for (const row of quoteRows.slice(0, 3)) {
    const label = row.dex || row.provider || row.name || "Route";
    const output = fromRaw(row.amountOut || row.expectedOut || row.outputAmount, 6);
    cards.push(`
      <div class="cardlet">
        <header><strong>${label}</strong><span class="badge good">quote</span></header>
        <p>${output ? money(output) : "Output pending"} for ${amountTon} TON.</p>
      </div>
    `);
  }

  if (!cards.length) {
    cards.push(
      `<div class="cardlet"><header><strong>chop</strong><span class="badge violet">router</span></header><p><a href="https://www.chop.ag/" target="_blank" rel="noreferrer">Open chop</a> for live route comparison.</p></div>`,
      `<div class="cardlet"><header><strong>STON.fi</strong><span class="badge info">DEX</span></header><p><a href="https://ston.fi/" target="_blank" rel="noreferrer">Open STON.fi</a> to inspect TON pools and swaps.</p></div>`,
      `<div class="cardlet"><header><strong>DeDust</strong><span class="badge info">DEX</span></header><p><a href="https://dedust.io/" target="_blank" rel="noreferrer">Open DeDust</a> to compare liquidity manually.</p></div>`,
    );
  }

  els.dexQuotes.innerHTML = cards.join("");
}

async function refreshBestQuote() {
  const amountTon = els.quoteAmount.value.trim() || "10";
  els.quoteStatus.textContent = "Checking TON route pricing...";

  try {
    const quote = await getBestTonQuote(amountTon);
    const output = pickQuoteOutput(quote);
    els.bestQuote.textContent = output ? money(output) : "Route found";
    els.quoteMeta.textContent = output
      ? `${amountTon} TON quoted through chop routing. Open the router before trading for final slippage.`
      : "chop returned a route, but no normalized USDt output field was found.";
    els.quoteStatus.textContent = "Live route quote loaded.";
    renderQuoteCards(quote, amountTon);
  } catch (error) {
    const spot = await getTonRate();
    const fallbackValue = Number(amountTon || 0) * spot;
    els.bestQuote.textContent = money(fallbackValue);
    els.quoteMeta.textContent = `TonAPI spot fallback at ${money(spot)} per TON. chop did not answer, so verify execution price before trading.`;
    els.quoteStatus.textContent = "Router unavailable in-browser; using TonAPI spot fallback.";
    renderQuoteCards(null, amountTon);
  }
}

async function getTransactions(address) {
  try {
    const json = await fetchJson(`${TON_API}/blockchain/accounts/${encodeURIComponent(address)}/transactions?limit=8`);
    return (json.transactions || []).map((tx) => ({
      hash: tx.hash,
      time: tx.utime ? new Date(tx.utime * 1000).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" }) : "unknown time",
      fee: Number(tx.total_fees || 0) / 1e9,
      link: tx.hash ? `https://tonviewer.com/transaction/${tx.hash}` : `https://tonviewer.com/${address}`,
      type: tx.in_msg?.source ? "inbound" : tx.out_msgs?.length ? "outbound" : "contract",
    }));
  } catch {
    return [];
  }
}

async function getTonWallet(address) {
  const [account, jettons, rates, transactions] = await Promise.all([
    fetchJson(`${TON_API}/accounts/${encodeURIComponent(address)}`),
    fetchJson(`${TON_API}/accounts/${encodeURIComponent(address)}/jettons?currencies=usd`),
    fetchJson(`${TON_API}/rates?tokens=ton&currencies=usd`),
    getTransactions(address),
  ]);

  const tonRate = rates.rates?.TON;
  const native = {
    asset: "Toncoin",
    ticker: "TON",
    quantity: Number(account.balance || 0) / 1e9,
    price: Number(tonRate?.prices?.USD || 0),
    change24h: parseTonDiff(tonRate?.diff_24h?.USD),
    value: 0,
    verification: "core",
    score: 100,
    address: "native TON",
  };
  native.value = native.quantity * native.price;

  const jettonRows = (jettons.balances || [])
    .map((item) => {
      const token = item.jetton || {};
      const quantity = tokenUnits(item.balance, token.decimals);
      const price = Number(item.price?.prices?.USD || 0);
      return {
        asset: token.name || token.symbol || "Unknown jetton",
        ticker: token.symbol || "UNKNOWN",
        quantity,
        price,
        value: quantity * price,
        verification: token.verification || "none",
        score: Number(item.score || 0),
        address: token.address || "",
      };
    })
    .filter((token) => token.quantity > 0)
    .sort((a, b) => b.value - a.value);

  return {
    asOf: new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" }),
    wallet: address,
    crypto: [native, ...jettonRows],
    transactions,
  };
}

function renderHoldings(tokens) {
  if (!tokens.length) {
    els.holdings.innerHTML = `<tr><td colspan="5">Search a wallet to load holdings.</td></tr>`;
    return;
  }

  els.holdings.innerHTML = tokens
    .map((token) => {
      const signal = signalFor(token);
      const explorer = token.address && token.address !== "native TON"
        ? `<a href="https://tonviewer.com/${token.address}" target="_blank" rel="noreferrer">explorer</a>`
        : `<a href="https://tonviewer.com/" target="_blank" rel="noreferrer">explorer</a>`;
      return `
        <tr>
          <td class="token-name"><strong>${token.asset}</strong><small>${token.ticker} · ${explorer}</small></td>
          <td class="number">${compact(token.quantity)}</td>
          <td class="number">${money(token.price)}</td>
          <td class="number">${money(token.value)}</td>
          <td><span class="badge ${signal.tone}">${signal.text}</span></td>
        </tr>
      `;
    })
    .join("");
}

function renderWhale(report) {
  const total = report.crypto.reduce((sum, token) => sum + Number(token.value || 0), 0);
  const ton = report.crypto.find((token) => token.ticker === "TON");
  const grade = whaleGrade(ton?.quantity || 0, total);
  const riskCount = report.crypto.filter((token) => ["bad", "warn"].includes(signalFor(token).tone)).length;
  const tonPct = total > 0 ? ((ton?.value || 0) / total) * 100 : 0;
  const explorer = `https://tonviewer.com/${report.wallet}`;

  els.whale.innerHTML = `
    <div class="cardlet">
      <header><strong>${grade.grade}</strong><span class="badge ${grade.tone}">grade</span></header>
      <p>${grade.text}</p>
    </div>
    <div class="cardlet">
      <header><strong>TON concentration</strong><span class="badge info">${tonPct.toFixed(1)}%</span></header>
      <p>${compact(ton?.quantity || 0)} TON is currently ${money(ton?.value || 0)} of this wallet.</p>
    </div>
    <div class="cardlet">
      <header><strong>Explorer</strong><span class="badge good">open</span></header>
      <p><a href="${explorer}" target="_blank" rel="noreferrer">${shortAddress(report.wallet)} on Tonviewer</a></p>
    </div>
    <div class="cardlet">
      <header><strong>Risk flags</strong><span class="badge ${riskCount ? "warn" : "good"}">${riskCount}</span></header>
      <p>Flags include no-price, blacklist, unknown, or thin-risk jettons.</p>
    </div>
  `;
}

function renderTransactions(report) {
  if (!report.transactions.length) {
    els.transactions.innerHTML = `<div class="cardlet"><header><strong>No recent flow</strong><span class="badge warn">empty</span></header><p>TonAPI did not return recent transactions for this wallet. Use the explorer link for deeper review.</p></div>`;
    return;
  }

  els.transactions.innerHTML = report.transactions
    .map((tx) => `
      <div class="cardlet">
        <header><strong>${tx.type}</strong><span class="badge info">${money(tx.fee)} fee</span></header>
        <p>${tx.time} · <a href="${tx.link}" target="_blank" rel="noreferrer">${shortAddress(tx.hash || "")}</a></p>
      </div>
    `)
    .join("");
}

function renderDefiTools() {
  els.defi.innerHTML = defiTools
    .map((tool) => `
      <div class="cardlet">
        <header><strong>${tool.title}</strong><span class="badge violet">${tool.tag}</span></header>
        <p>${tool.text}</p>
        <p><a href="${tool.url}" target="_blank" rel="noreferrer">Open ${tool.title}</a></p>
      </div>
    `)
    .join("");
}

function renderReport(report) {
  lastReport = report;
  const tokens = report.crypto;
  const total = tokens.reduce((sum, token) => sum + Number(token.value || 0), 0);
  const ton = tokens.find((token) => token.ticker === "TON");
  const grade = whaleGrade(ton?.quantity || 0, total);
  const riskCount = tokens.filter((token) => ["bad", "warn"].includes(signalFor(token).tone)).length;

  els.total.textContent = money(total);
  els.ton.textContent = `${compact(ton?.quantity || 0)} TON`;
  els.whaleGrade.textContent = grade.grade;
  els.risk.textContent = String(riskCount);
  els.asOf.textContent = report.asOf;

  renderHoldings(tokens);
  renderWhale(report);
  renderTransactions(report);
  renderDefiTools();
}

function clearReport() {
  els.total.textContent = "$0.00";
  els.ton.textContent = "0 TON";
  els.whaleGrade.textContent = "-";
  els.risk.textContent = "0";
  els.asOf.textContent = "Not loaded";
  els.holdings.innerHTML = `<tr><td colspan="5">Paste any public TON wallet address and search.</td></tr>`;
  els.whale.innerHTML = `<div class="cardlet"><header><strong>Waiting for wallet</strong><span class="badge info">search</span></header><p>No personal wallet is loaded by default.</p></div>`;
  els.transactions.innerHTML = `<div class="cardlet"><header><strong>Recent flow</strong><span class="badge info">pending</span></header><p>Transactions appear after a wallet scan.</p></div>`;
  renderDefiTools();
}

async function searchWallet(address) {
  if (!address) {
    els.status.textContent = "Paste a public TON wallet address first.";
    return;
  }
  els.status.textContent = "Scanning public TON wallet...";
  tg?.MainButton?.showProgress(false);
  const report = await getTonWallet(address);
  renderReport(report);
  els.status.textContent = `Loaded ${report.crypto.length} token(s) and ${report.transactions.length} recent transaction(s) for ${shortAddress(address)}.`;
  tg?.MainButton?.hideProgress();
  tg?.HapticFeedback?.notificationOccurred("success");
}

async function copyCurrentSummary() {
  if (!lastReport) {
    els.status.textContent = "Search a wallet before copying a report.";
    return;
  }
  const total = lastReport.crypto.reduce((sum, token) => sum + Number(token.value || 0), 0);
  const ton = lastReport.crypto.find((token) => token.ticker === "TON");
  const grade = whaleGrade(ton?.quantity || 0, total);
  const lines = [
    `TON Chain Radar - ${lastReport.asOf}`,
    `Wallet: ${lastReport.wallet}`,
    `Whale grade: ${grade.grade}`,
    `Tracked value: ${money(total)}`,
    ...lastReport.crypto.slice(0, 8).map((token) => `${token.ticker}: ${compact(token.quantity)} = ${money(token.value)}`),
  ];
  await navigator.clipboard.writeText(lines.join("\n"));
  els.status.textContent = "Wallet report copied.";
}

function showError(error) {
  els.status.textContent = error instanceof Error ? error.message : "Wallet scan failed.";
  tg?.MainButton?.hideProgress();
  tg?.HapticFeedback?.notificationOccurred("error");
}

els.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await searchWallet(els.input.value.trim());
  } catch (error) {
    showError(error);
  }
});

els.sampleWhale.addEventListener("click", async () => {
  els.input.value = SAMPLE_WHALE;
  try {
    await searchWallet(SAMPLE_WHALE);
  } catch (error) {
    showError(error);
  }
});

els.copySummary.addEventListener("click", async () => {
  await copyCurrentSummary();
});

els.quoteForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  await refreshBestQuote();
});

initTelegram();
clearReport();
refreshBestQuote().catch(() => {
  els.quoteStatus.textContent = "Quote tools are warming up. Try the Quote button.";
  renderQuoteCards(null, els.quoteAmount.value || "10");
});
