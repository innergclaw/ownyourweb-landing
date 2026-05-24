const DEFAULT_WALLET = "UQBffr75eQax7lrOSfZqIjWUY0ZIg8JyG5if7NBrZ_r7CTnP";
const TON_API = "https://tonapi.io/v2";
const tg = window.Telegram?.WebApp;

const recoveryBaselines = {
  Yoda: { label: "Baby Yoda", price: 0.00268, drawdown: 0.4804 },
  strawberry: { label: "sweety strawberry", price: 0.00147, drawdown: 0.2557 },
  UTYA: { label: "Utya", price: 0.0312, drawdown: 0.1472 },
};

const targetSplit = [
  { key: "HYPE", label: "HYPE", pct: 0.5, tickers: ["HYPE", "HYPE-BUY", "HYPE-LOCKED"] },
  { key: "NEAR", label: "NEAR", pct: 0.25, tickers: ["NEAR"] },
  { key: "TON", label: "TON", pct: 0.15, tickers: ["TON", "TON-BUY"] },
  { key: "MEMES", label: "TON memes", pct: 0.1, tickers: ["Yoda", "strawberry", "UTYA"] },
];

const els = {
  form: document.querySelector("#walletForm"),
  input: document.querySelector("#walletInput"),
  status: document.querySelector("#statusText"),
  loadDemo: document.querySelector("#loadDemo"),
  copySummary: document.querySelector("#copySummary"),
  total: document.querySelector("#totalValue"),
  ton: document.querySelector("#tonValue"),
  meme: document.querySelector("#memeValue"),
  risk: document.querySelector("#riskCount"),
  asOf: document.querySelector("#asOf"),
  holdings: document.querySelector("#holdingsBody"),
  recovery: document.querySelector("#recoveryList"),
  allocation: document.querySelector("#allocationList"),
  actions: document.querySelector("#actionList"),
  telegramNote: document.querySelector("#telegramNote"),
};

let lastBag = null;

function initTelegram() {
  if (!tg) return;
  document.body.classList.add("telegram");
  tg.ready();
  tg.expand();
  tg.setHeaderColor(tg.themeParams?.bg_color || "#f6f2e8");
  tg.setBackgroundColor(tg.themeParams?.bg_color || "#f6f2e8");
  if (els.telegramNote) {
    const user = tg.initDataUnsafe?.user;
    els.telegramNote.textContent = user?.first_name
      ? `Telegram mode: tracking for ${user.first_name}.`
      : "Telegram mode active.";
  }

  tg.MainButton.setText("Refresh Bag");
  tg.MainButton.show();
  tg.MainButton.onClick(() => {
    tg.HapticFeedback?.impactOccurred("light");
    refreshWallet(els.input.value.trim() || DEFAULT_WALLET).catch((error) => {
      els.status.textContent = error instanceof Error ? error.message : "Wallet scan failed.";
    });
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

function percent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function tokenUnits(rawBalance, decimals) {
  return Number(rawBalance || 0) / 10 ** Number(decimals || 0);
}

function parseTonDiff(value) {
  if (typeof value === "number") return value / 100;
  return Number(String(value || "0").replace("−", "-").replace("%", "").replace("+", "")) / 100;
}

function signalFor(token) {
  const note = `${token.verification || ""} ${token.score ?? ""}`.toLowerCase();
  if (token.price <= 0 || token.verification === "blacklist") return { text: "exclude", tone: "bad" };
  if (token.ticker === "TON") return { text: "core", tone: "good" };
  if (token.score >= 50) return { text: "watch", tone: "info" };
  if (note.includes("whitelist")) return { text: "high risk", tone: "warn" };
  return { text: "unknown", tone: "bad" };
}

async function getTonWallet(address) {
  const [accountRes, jettonsRes, ratesRes] = await Promise.all([
    fetch(`${TON_API}/accounts/${encodeURIComponent(address)}`),
    fetch(`${TON_API}/accounts/${encodeURIComponent(address)}/jettons?currencies=usd`),
    fetch(`${TON_API}/rates?tokens=ton&currencies=usd`),
  ]);

  if (!accountRes.ok || !jettonsRes.ok || !ratesRes.ok) {
    throw new Error("TonAPI did not return wallet data. Check the address and try again.");
  }

  const account = await accountRes.json();
  const jettons = await jettonsRes.json();
  const rates = await ratesRes.json();
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
  };
}

async function loadDemoBag() {
  const response = await fetch("../outputs/holdings_tracker/latest_summary.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load local demo summary.");
  const summary = await response.json();
  return {
    asOf: summary.asOf,
    wallet: DEFAULT_WALLET,
    crypto: summary.crypto.map((item) => ({
      asset: item.asset,
      ticker: item.ticker,
      quantity: item.quantity,
      price: item.price,
      value: item.value,
      verification: item.note?.includes("blacklist") ? "blacklist" : item.note?.includes("whitelist") ? "whitelist" : item.ticker === "TON" ? "core" : "manual",
      score: item.note?.match(/score (\d+)/)?.[1] ? Number(item.note.match(/score (\d+)/)[1]) : item.ticker === "TON" ? 100 : 0,
      address: item.note || "",
    })),
  };
}

async function copyCurrentSummary() {
  if (!lastBag) return;
  const total = lastBag.crypto.reduce((sum, token) => sum + Number(token.value || 0), 0);
  const lines = [
    `TON Bag Tracker - ${lastBag.asOf}`,
    `Tracked value: ${money(total)}`,
    ...lastBag.crypto.slice(0, 8).map((token) => `${token.ticker}: ${compact(token.quantity)} = ${money(token.value)}`),
  ];
  await navigator.clipboard.writeText(lines.join("\n"));
  els.status.textContent = "Summary copied.";
}

function groupValue(tokens, tickers) {
  return tokens
    .filter((token) => tickers.includes(token.ticker))
    .reduce((sum, token) => sum + Number(token.value || 0), 0);
}

function renderHoldings(tokens) {
  els.holdings.innerHTML = tokens
    .map((token) => {
      const signal = signalFor(token);
      return `
        <tr>
          <td class="token-name"><strong>${token.asset}</strong><small>${token.ticker}</small></td>
          <td class="number">${compact(token.quantity)}</td>
          <td class="number">${money(token.price)}</td>
          <td class="number">${money(token.value)}</td>
          <td><span class="badge ${signal.tone}">${signal.text}</span></td>
        </tr>
      `;
    })
    .join("");
}

function renderRecovery(tokens) {
  const cards = Object.entries(recoveryBaselines).map(([ticker, baseline]) => {
    const token = tokens.find((item) => item.ticker === ticker);
    if (!token) {
      return `<div class="cardlet"><header><strong>${baseline.label}</strong><span class="badge bad">missing</span></header><p>Not found in this wallet scan.</p></div>`;
    }

    const target = baseline.price / (1 - baseline.drawdown);
    const needed = target > 0 && token.price > 0 ? (target / token.price - 1) * 100 : 0;
    const progress = Math.min(100, (token.price / target) * 100);
    const hit = token.price >= target;
    return `
      <div class="cardlet">
        <header><strong>${token.ticker}</strong><span class="badge ${hit ? "good" : "warn"}">${hit ? "recovered" : `${percent(needed)} left`}</span></header>
        <p>${money(token.value)} at ${money(token.price)}. Recovery target: ${money(target)}.</p>
        <div class="bar"><span style="width:${progress}%"></span></div>
      </div>
    `;
  });
  els.recovery.innerHTML = cards.join("");
}

function renderAllocation(tokens) {
  const total = tokens.reduce((sum, token) => sum + Number(token.value || 0), 0);
  els.allocation.innerHTML = targetSplit
    .map((target) => {
      const current = groupValue(tokens, target.tickers);
      const targetValue = total * target.pct;
      const diff = current - targetValue;
      const progress = targetValue > 0 ? Math.min(140, (current / targetValue) * 100) : 0;
      return `
        <div class="cardlet">
          <header><strong>${target.label}</strong><span class="badge ${Math.abs(diff) < 5 ? "good" : diff > 0 ? "warn" : "info"}">${diff >= 0 ? "+" : ""}${money(diff)}</span></header>
          <p>Current ${money(current)} / target ${money(targetValue)} (${percent(target.pct * 100)}).</p>
          <div class="bar"><span style="width:${progress}%"></span></div>
        </div>
      `;
    })
    .join("");
}

function renderActions(tokens) {
  const badTokens = tokens.filter((token) => signalFor(token).tone === "bad");
  const highRiskValue = groupValue(tokens, ["Yoda", "strawberry", "UTYA"]);
  const total = tokens.reduce((sum, token) => sum + Number(token.value || 0), 0);
  const memePct = total > 0 ? highRiskValue / total : 0;
  const actions = [];

  if (badTokens.length) {
    actions.push(["Suspicious tokens", `${badTokens.length} token(s) have no price or blacklist/unknown status. Keep excluded from net worth decisions.`, "bad"]);
  }
  if (memePct > 0.12) {
    actions.push(["Meme exposure high", `Meme bucket is ${percent(memePct * 100)} of tracked value. Target is 10%.`, "warn"]);
  }
  if (actions.length === 0) {
    actions.push(["No urgent action", "Wallet is within the current watch rules. Keep tracking recovery targets.", "good"]);
  }

  els.actions.innerHTML = actions
    .map(([title, text, tone]) => `<div class="cardlet"><header><strong>${title}</strong><span class="badge ${tone}">signal</span></header><p>${text}</p></div>`)
    .join("");
}

function renderBag(bag) {
  lastBag = bag;
  const tokens = bag.crypto;
  const total = tokens.reduce((sum, token) => sum + Number(token.value || 0), 0);
  const tonValue = groupValue(tokens, ["TON"]);
  const memeValue = groupValue(tokens, ["Yoda", "strawberry", "UTYA"]);
  const riskCount = tokens.filter((token) => ["bad", "warn"].includes(signalFor(token).tone)).length;

  els.total.textContent = money(total);
  els.ton.textContent = money(tonValue);
  els.meme.textContent = money(memeValue);
  els.risk.textContent = String(riskCount);
  els.asOf.textContent = bag.asOf;
  renderHoldings(tokens);
  renderRecovery(tokens);
  renderAllocation(tokens);
  renderActions(tokens);
}

async function refreshWallet(address) {
  els.status.textContent = "Scanning TON wallet...";
  tg?.MainButton?.showProgress(false);
  const bag = await getTonWallet(address);
  renderBag(bag);
  els.status.textContent = `Loaded ${bag.crypto.length} token(s) from ${address.slice(0, 6)}...${address.slice(-6)}.`;
  tg?.MainButton?.hideProgress();
  tg?.HapticFeedback?.notificationOccurred("success");
}

async function refreshDemo() {
  els.input.value = DEFAULT_WALLET;
  await refreshWallet(DEFAULT_WALLET);
}

els.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    await refreshWallet(els.input.value.trim());
  } catch (error) {
    els.status.textContent = error instanceof Error ? error.message : "Wallet scan failed.";
  }
});

els.loadDemo.addEventListener("click", async () => {
  try {
    await refreshDemo();
  } catch (error) {
    els.status.textContent = error instanceof Error ? error.message : "Demo load failed.";
  }
});

els.copySummary.addEventListener("click", async () => {
  await copyCurrentSummary();
});

initTelegram();

refreshWallet(DEFAULT_WALLET).catch((error) => {
  refreshDemo().catch(() => {
    els.status.textContent = error instanceof Error ? error.message : "Initial load failed.";
  });
});
