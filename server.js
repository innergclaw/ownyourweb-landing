import { createReadStream, existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.env.PORT || 8003);
const DATA_DIR = join(__dirname, "data", "agent-store-requests");
const PROJECTS_DIR = join(__dirname, "data", "agent-store-projects");

await loadDotEnv(join(__dirname, ".env"));

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || "";
const SITE_URL = process.env.SITE_URL || `http://127.0.0.1:${PORT}`;
const STRIPE_API_VERSION = "2026-02-25.clover";
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const TELEGRAM_CHAT_IDS = (process.env.TELEGRAM_CHAT_IDS || process.env.TELEGRAM_CHAT_ID || "")
  .split(",")
  .map((chatId) => chatId.trim())
  .filter(Boolean);
const TELEGRAM_AGENT_STORE_TOPIC_CHAT_ID = process.env.TELEGRAM_AGENT_STORE_TOPIC_CHAT_ID || "";
const TELEGRAM_AGENT_STORE_TOPIC_THREAD_ID = process.env.TELEGRAM_AGENT_STORE_TOPIC_THREAD_ID || "";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml"
};

async function loadDotEnv(filePath) {
  if (!existsSync(filePath)) return;
  const lines = (await readFile(filePath, "utf8")).split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const [key, ...valueParts] = trimmed.split("=");
    if (process.env[key]) continue;
    process.env[key] = valueParts.join("=").replace(/^["']|["']$/g, "");
  }
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(data, null, 2));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = Buffer.concat(chunks).toString("utf8");
  return body ? JSON.parse(body) : {};
}

function slugify(value) {
  return String(value || "agent-store-request")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "agent-store-request";
}

function packageAmount(packageName, budgetRange) {
  const pkg = String(packageName || "").toLowerCase();
  const budget = String(budgetRange || "").toLowerCase();

  if (pkg.includes("automation") || budget.includes("$3,000")) return 150000;
  if (pkg.includes("local") || pkg.includes("boutique") || budget.includes("$1,500")) return 75000;
  return 50000;
}

function customerName(packet) {
  return [packet.customer_first_name, packet.customer_last_name].filter(Boolean).join(" ").trim();
}

function packetToMarkdown(packet) {
  return `# ${packet.business_name || "OWNYOURWEB Agent Store Request"}

- Request ID: ${packet.request_id}
- Status: ${packet.status}
- Created: ${packet.created_at}
- Package: ${packet.package}
- Budget Range: ${packet.budget_range}
- Timeline: ${packet.timeline}
- Contact / Buyer Agent: ${packet.buyer_agent_or_contact}
- Customer: ${customerName(packet) || "Not provided"}
- Email: ${packet.customer_email || "Not provided"}
- Source: ${packet.source_page || "Agent Store"}

## Business

- Name: ${packet.business_name}
- Industry: ${packet.industry}

## Request

${packet.request}

## Assets Available

${packet.assets_available}

## Current Website

${packet.current_website || "Not provided"}

## Stripe

- Checkout Session: ${packet.checkout_session_id || "pending"}
- Checkout URL: ${packet.checkout_url || "pending"}
`;
}

async function savePacket(packet) {
  await mkdir(DATA_DIR, { recursive: true });
  const base = join(DATA_DIR, packet.request_id);
  await writeFile(`${base}.json`, JSON.stringify(packet, null, 2), "utf8");
  await writeFile(`${base}.md`, packetToMarkdown(packet), "utf8");
  return { json: `${base}.json`, markdown: `${base}.md` };
}

async function listPackets() {
  await mkdir(DATA_DIR, { recursive: true });
  const files = (await readdir(DATA_DIR)).filter((file) => file.endsWith(".json")).sort().reverse();
  const packets = [];
  for (const file of files) {
    const packet = JSON.parse(await readFile(join(DATA_DIR, file), "utf8"));
    packets.push({
      request_id: packet.request_id,
      created_at: packet.created_at,
      business_name: packet.business_name,
      industry: packet.industry,
      package: packet.package,
      budget_range: packet.budget_range,
      timeline: packet.timeline,
      customer_first_name: packet.customer_first_name,
      customer_last_name: packet.customer_last_name,
      customer_email: packet.customer_email,
      source_page: packet.source_page,
      current_website: packet.current_website,
      buyer_agent_or_contact: packet.buyer_agent_or_contact,
      status: packet.status,
      payment_status: packet.payment_status,
      notification_status: packet.notification_status,
      checkout_url: packet.checkout_url || "",
      project_folder: packet.project_folder || ""
    });
  }
  return packets;
}

async function findPacketFile(requestId) {
  await mkdir(DATA_DIR, { recursive: true });
  const files = (await readdir(DATA_DIR)).filter((file) => file.endsWith(".json"));
  const match = files.find((file) => file === `${requestId}.json` || file.startsWith(`${requestId}-`));
  return match ? join(DATA_DIR, match) : null;
}

async function readPacket(requestId) {
  const filePath = await findPacketFile(requestId);
  if (!filePath) return null;
  return JSON.parse(await readFile(filePath, "utf8"));
}

async function createProjectWorkspace(packet) {
  const folderName = packet.request_id;
  const projectDir = join(PROJECTS_DIR, folderName);
  await mkdir(join(projectDir, "assets"), { recursive: true });
  await mkdir(join(projectDir, "build"), { recursive: true });

  const brief = `# ${packet.business_name || "OWNYOURWEB Project"}

## Status

${packet.status}

## Client / Buyer Agent

${packet.buyer_agent_or_contact || "Not provided"}

## Customer

- First Name: ${packet.customer_first_name || "Not provided"}
- Last Name: ${packet.customer_last_name || "Not provided"}
- Email: ${packet.customer_email || "Not provided"}

## Industry

${packet.industry || "Not provided"}

## Selected Package

${packet.package || "Not provided"}

## Budget Range

${packet.budget_range || "Not provided"}

## Timeline

${packet.timeline || "Not provided"}

## Request

${packet.request || "Not provided"}

## Assets

${packet.assets_available || "Not provided"}

## Payment

- Status: ${packet.payment_status || "pending"}
- Checkout URL: ${packet.checkout_url || "pending"}

## Source

- Source Page: ${packet.source_page || "Agent Store"}
- Current Website: ${packet.current_website || "Not provided"}
`;

  const todo = `# Build Tasks

- [ ] Review packet and approve final scope
- [ ] Confirm deposit/payment path
- [ ] Collect logo/photos/copy
- [ ] Draft homepage structure
- [ ] Build first demo
- [ ] QA desktop/mobile
- [ ] Send preview to client
- [ ] Collect revision notes
- [ ] Publish final site
`;

  const agentInstructions = `# Agent Instructions

You are helping OWNYOURWEB turn this request into a premium web-system build.

Rules:
- Keep pricing premium.
- Do not publish anything without owner approval.
- Preserve all client assets in ./assets.
- Create first drafts in ./build.
- Summarize changes clearly for Nasir.

First action:
Read client-brief.md, then propose the first homepage/demo structure.
`;

  await writeFile(join(projectDir, "client-brief.md"), brief, "utf8");
  await writeFile(join(projectDir, "todo.md"), todo, "utf8");
  await writeFile(join(projectDir, "agent-instructions.md"), agentInstructions, "utf8");
  await writeFile(join(projectDir, "packet.json"), JSON.stringify(packet, null, 2), "utf8");

  return projectDir;
}

async function createStripeCheckoutSession(packet) {
  if (!STRIPE_SECRET_KEY) {
    const error = new Error("STRIPE_SECRET_KEY is not configured on the server.");
    error.code = "missing_stripe_key";
    throw error;
  }

  const amount = packageAmount(packet.package, packet.budget_range);
  const fullName = customerName(packet);
  const params = new URLSearchParams({
    mode: "payment",
    client_reference_id: packet.request_id,
    customer_creation: "always",
    success_url: `${SITE_URL}/agent-store/?checkout=success&request_id=${encodeURIComponent(packet.request_id)}`,
    cancel_url: `${SITE_URL}/agent-store/?checkout=cancelled&request_id=${encodeURIComponent(packet.request_id)}`,
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(amount),
    "line_items[0][price_data][product_data][name]": `OWNYOURWEB Deposit: ${packet.package || "Web System Build"}`,
    "line_items[0][price_data][product_data][description]": `${packet.business_name || "Client"} / ${packet.industry || "Web system request"}`,
    "metadata[request_id]": packet.request_id,
    "metadata[business_name]": packet.business_name || "",
    "metadata[customer_first_name]": packet.customer_first_name || "",
    "metadata[customer_last_name]": packet.customer_last_name || "",
    "metadata[customer_email]": packet.customer_email || "",
    "metadata[customer_name]": fullName,
    "metadata[package]": packet.package || "",
    "metadata[status]": packet.status || "pending_owner_approval"
  });
  if (packet.customer_email) {
    params.set("customer_email", packet.customer_email);
  }

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": STRIPE_API_VERSION
    },
    body: params
  });

  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error?.message || "Stripe checkout session failed.");
    error.code = data.error?.code || "stripe_error";
    throw error;
  }
  return data;
}

async function sendTelegramNotification(packet) {
  const destinations = TELEGRAM_CHAT_IDS.map((chatId) => ({ chatId }));
  if (TELEGRAM_AGENT_STORE_TOPIC_CHAT_ID && TELEGRAM_AGENT_STORE_TOPIC_THREAD_ID) {
    destinations.push({
      chatId: TELEGRAM_AGENT_STORE_TOPIC_CHAT_ID,
      messageThreadId: TELEGRAM_AGENT_STORE_TOPIC_THREAD_ID
    });
  }

  if (!TELEGRAM_BOT_TOKEN || destinations.length === 0) {
    return { ok: false, status: "telegram_not_configured" };
  }

  const message = [
    "#AgentStoreRequests",
    "OWNYOURWEB Agent Store",
    "",
    `New project request: ${packet.business_name || "Unnamed request"}`,
    `Industry: ${packet.industry || "Not provided"}`,
    `Package: ${packet.package || "Not provided"}`,
    `Budget: ${packet.budget_range || "Not provided"}`,
    `Timeline: ${packet.timeline || "Not provided"}`,
    `Customer: ${customerName(packet) || "Not provided"}`,
    `Email: ${packet.customer_email || "Not provided"}`,
    `Source: ${packet.source_page || "Agent Store"}`,
    `Buyer / Agent: ${packet.buyer_agent_or_contact || "Not provided"}`,
    "",
    "Request:",
    packet.request || "Not provided",
    "",
    `Admin queue: ${SITE_URL}/agent-store/admin.html`
  ].join("\n");

  try {
    const results = [];
    for (const destination of destinations) {
      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: destination.chatId,
          ...(destination.messageThreadId ? { message_thread_id: Number(destination.messageThreadId) } : {}),
          text: message,
          disable_web_page_preview: true
        })
      });
      const data = await response.json();
      results.push({
        chat_id: destination.chatId,
        message_thread_id: destination.messageThreadId || "",
        ok: response.ok && data.ok,
        message_id: data.result?.message_id || "",
        error: data.description || ""
      });
    }
    const failed = results.filter((result) => !result.ok);
    if (failed.length > 0) {
      return {
        ok: false,
        status: failed.length === results.length ? "telegram_failed" : "telegram_partially_sent",
        results,
        error: failed.map((result) => `${result.chat_id}: ${result.error}`).join("; ")
      };
    }
    return { ok: true, status: "telegram_sent", results };
  } catch (error) {
    return {
      ok: false,
      status: "telegram_failed",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

async function handleAgentRequest(req, res) {
  const body = await readJson(req);
  const requestId = `${new Date().toISOString().replace(/[:.]/g, "-")}-${slugify(body.business_name)}`;
  const packet = {
    store_agent: "ownyourweb",
    intent: "start_web_system_build",
    request_id: requestId,
    created_at: new Date().toISOString(),
    business_name: body.business_name || "",
    customer_first_name: body.customer_first_name || "",
    customer_last_name: body.customer_last_name || "",
    customer_email: body.customer_email || "",
    industry: body.industry || "",
    package: body.package || "",
    budget_range: body.budget_range || "",
    timeline: body.timeline || "",
    buyer_agent_or_contact: body.buyer_agent || "",
    request: body.request || "",
    assets_available: body.assets || "",
    current_website: body.current_website || "",
    source_page: body.source_page || "Agent Store",
    status: "pending_owner_approval",
    next_steps: [
      "Review scope",
      "Confirm price and deposit",
      "Send or approve checkout link",
      "Create project folder",
      "Start first demo build"
    ]
  };

  packet.payment_status = "pending_owner_approval";

  const notification = await sendTelegramNotification(packet);
  packet.notification_status = notification.status;
  if (notification.results) packet.notification_results = notification.results;
  if (notification.error) packet.notification_error = notification.error;

  const files = await savePacket(packet);
  sendJson(res, 200, { ok: true, packet, files });
}

async function handleListRequests(_req, res) {
  sendJson(res, 200, { ok: true, requests: await listPackets() });
}

async function handleGetRequest(req, res) {
  const url = new URL(req.url || "/", SITE_URL);
  const requestId = url.searchParams.get("request_id");
  if (!requestId) {
    sendJson(res, 400, { error: "request_id is required" });
    return;
  }
  const packet = await readPacket(requestId);
  if (!packet) {
    sendJson(res, 404, { error: "Request not found" });
    return;
  }
  sendJson(res, 200, { ok: true, packet });
}

async function handleApproveRequest(req, res) {
  const body = await readJson(req);
  const packet = await readPacket(body.request_id);
  if (!packet) {
    sendJson(res, 404, { error: "Request not found" });
    return;
  }
  packet.status = "approved_for_checkout";
  packet.approved_at = new Date().toISOString();
  packet.owner_notes = body.owner_notes || "";

  if (!packet.checkout_url) {
    try {
      const checkout = await createStripeCheckoutSession(packet);
      packet.checkout_session_id = checkout.id;
      packet.checkout_url = checkout.url;
      packet.payment_status = "checkout_created_pending_send";
      delete packet.payment_error;
    } catch (error) {
      packet.payment_status = "checkout_not_created";
      packet.payment_error = error instanceof Error ? error.message : String(error);
    }
  }

  const files = await savePacket(packet);
  sendJson(res, 200, { ok: true, packet, files });
}

async function handleCreateProject(req, res) {
  const body = await readJson(req);
  const packet = await readPacket(body.request_id);
  if (!packet) {
    sendJson(res, 404, { error: "Request not found" });
    return;
  }
  packet.status = "project_workspace_created";
  packet.project_created_at = new Date().toISOString();
  const projectDir = await createProjectWorkspace(packet);
  packet.project_folder = projectDir;
  const files = await savePacket(packet);
  sendJson(res, 200, { ok: true, packet, project_folder: projectDir, files });
}

function resolvePublicPath(urlPath) {
  const cleanPath = urlPath === "/" ? "/index.html" : urlPath.split("?")[0];
  const decoded = decodeURIComponent(cleanPath);
  const normalized = normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const filePath = join(__dirname, normalized);
  if (!filePath.startsWith(__dirname)) return null;
  if (existsSync(filePath) && !filePath.endsWith("/")) return filePath;
  const indexPath = join(filePath, "index.html");
  if (existsSync(indexPath)) return indexPath;
  return filePath;
}

async function handleStatic(req, res) {
  const filePath = resolvePublicPath(req.url || "/");
  if (!filePath || !existsSync(filePath)) {
    sendJson(res, 404, { error: "Not found" });
    return;
  }
  const type = mimeTypes[extname(filePath)] || "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": type,
    "Cache-Control": "no-store, no-cache, must-revalidate",
    "Pragma": "no-cache",
    "Expires": "0"
  });
  createReadStream(filePath).pipe(res);
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url?.startsWith("/api/agent-store/request")) {
      await handleAgentRequest(req, res);
      return;
    }
    if (req.method === "GET" && req.url?.startsWith("/api/agent-store/requests")) {
      await handleListRequests(req, res);
      return;
    }
    if (req.method === "GET" && req.url?.startsWith("/api/agent-store/request")) {
      await handleGetRequest(req, res);
      return;
    }
    if (req.method === "POST" && req.url?.startsWith("/api/agent-store/approve")) {
      await handleApproveRequest(req, res);
      return;
    }
    if (req.method === "POST" && req.url?.startsWith("/api/agent-store/create-project")) {
      await handleCreateProject(req, res);
      return;
    }
    if (req.method === "GET") {
      await handleStatic(req, res);
      return;
    }
    sendJson(res, 405, { error: "Method not allowed" });
  } catch (error) {
    sendJson(res, 500, {
      error: "Server error",
      detail: error instanceof Error ? error.message : String(error)
    });
  }
});

server.listen(PORT, () => {
  console.log(`OWNYOURWEB server running at http://127.0.0.1:${PORT}`);
  console.log(`Stripe key loaded: ${STRIPE_SECRET_KEY ? "yes" : "no"}`);
});
