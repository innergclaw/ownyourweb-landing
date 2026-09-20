import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.112.4/+esm";

const SUPABASE_URL = window.OWNYOURWEB_SUPABASE_URL || "https://zkyhhoxcrjkhywblzehr.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = window.OWNYOURWEB_SUPABASE_PUBLISHABLE_KEY || "sb_publishable_bdi3BexAKWDBaUIh40hJ_A_8CNVdnM_";
const AUDIT_ENDPOINT = window.OWNYOURWEB_AI_AUDIT_ENDPOINT || `${SUPABASE_URL}/functions/v1/ai-app-audit`;
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const ALLOWED_FILES = new Set(["package.json", "package-lock.json", "npm-shrinkwrap.json", "bun.lock"]);
const storageKey = "ownyourweb.ai-app-audit.current";

const form = document.querySelector("#audit-form");
const projectName = document.querySelector("#project-name");
const dropZone = document.querySelector("#drop-zone");
const fileInput = document.querySelector("#file-input");
const chooseFiles = document.querySelector("#choose-files");
const fileList = document.querySelector("#file-list");
const readiness = document.querySelector("#file-readiness");
const readinessTitle = document.querySelector("#readiness-title");
const readinessDetail = document.querySelector("#readiness-detail");
const dropTitle = document.querySelector("#drop-title");
const dropHelp = document.querySelector("#drop-help");
const scanButton = document.querySelector("#scan-button");
const sampleButton = document.querySelector("#sample-button");
const formStatus = document.querySelector("#form-status");
const results = document.querySelector("#results");
const unlockButton = document.querySelector("#unlock-button");
const authDialog = document.querySelector("#auth-dialog");
const authForm = document.querySelector("#auth-form");
const authStatus = document.querySelector("#auth-status");
const fullReport = document.querySelector("#full-report");
const reportStatus = document.querySelector("#report-status");
const reportContent = document.querySelector("#report-content");

let selectedFiles = new Map();
let pendingCheckout = false;

const lockfileNames = new Set(["package-lock.json", "npm-shrinkwrap.json", "bun.lock"]);

const safeJson = (text) => {
  try { return JSON.parse(text); } catch { return null; }
};

const setStatus = (element, message, state = "") => {
  element.textContent = message;
  element.dataset.state = state;
};

const readCurrentAudit = () => safeJson(sessionStorage.getItem(storageKey) || "null");
const saveCurrentAudit = (audit) => sessionStorage.setItem(storageKey, JSON.stringify(audit));

const updateReadiness = () => {
  const hasManifest = selectedFiles.has("package.json");
  const hasLockfile = Array.from(lockfileNames).some((name) => selectedFiles.has(name));
  const hasFiles = selectedFiles.size > 0;

  form.classList.toggle("has-files", hasFiles);
  dropZone.classList.toggle("has-files", hasFiles);
  scanButton.disabled = !hasManifest;

  dropTitle.textContent = hasFiles ? "package files added" : "drop package files here";
  dropHelp.textContent = hasFiles
    ? "add another supported file or replace one below"
    : "package.json + package-lock.json, npm-shrinkwrap.json, or bun.lock";
  chooseFiles.textContent = hasFiles ? "add files" : "choose files";

  if (!hasFiles) {
    readiness.dataset.state = "empty";
    readinessTitle.textContent = "package.json required";
    readinessDetail.textContent = "add the manifest first. a lockfile gives the preview stronger evidence.";
  } else if (!hasManifest) {
    readiness.dataset.state = "error";
    readinessTitle.textContent = "package.json is still needed";
    readinessDetail.textContent = "keep the lockfile, then add package.json to start the preview.";
  } else if (!hasLockfile) {
    readiness.dataset.state = "partial";
    readinessTitle.textContent = "ready for a basic preview";
    readinessDetail.textContent = "add a supported lockfile to map inherited packages and resolved versions.";
  } else {
    readiness.dataset.state = "ready";
    readinessTitle.textContent = "ready for the strongest preview";
    readinessDetail.textContent = "the manifest and lockfile are present. no private source code is needed.";
  }
};

const apiRequest = async (action, payload = {}, requireAuth = false) => {
  const headers = {
    "Content-Type": "application/json",
    apikey: SUPABASE_PUBLISHABLE_KEY,
  };

  if (requireAuth) {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.access_token) throw new Error("SIGN_IN_REQUIRED");
    headers.Authorization = `Bearer ${data.session.access_token}`;
  }

  const response = await fetch(AUDIT_ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({ action, ...payload }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data.error || "The audit service could not complete this request.");
    error.code = data.code || "REQUEST_FAILED";
    error.status = response.status;
    throw error;
  }
  return data;
};

const renderFiles = () => {
  fileList.replaceChildren();
  selectedFiles.forEach((file, name) => {
    const item = document.createElement("li");
    const fileInfo = document.createElement("span");
    fileInfo.className = "file-info";
    const label = document.createElement("strong");
    label.textContent = name;
    const detail = document.createElement("small");
    detail.textContent = `${name === "package.json" ? "manifest" : "lockfile"} · ${Math.max(1, Math.round(file.size / 1024))} KB`;
    fileInfo.append(label, detail);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.setAttribute("aria-label", `Remove ${name}`);
    remove.textContent = "remove";
    remove.addEventListener("click", () => {
      selectedFiles.delete(name);
      renderFiles();
      setStatus(formStatus, selectedFiles.has("package.json") ? "files updated. ready when you are." : "add package.json before running the preview.", selectedFiles.has("package.json") ? "success" : "error");
    });
    item.append(fileInfo, remove);
    fileList.append(item);
  });
  updateReadiness();
};

const addFiles = (files) => {
  let error = "";
  Array.from(files).forEach((file) => {
    if (!ALLOWED_FILES.has(file.name)) {
      error = `${file.name} is not a supported dependency file.`;
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      error = `${file.name} is larger than the 2 MB preview limit.`;
      return;
    }
    selectedFiles.set(file.name, file);
  });
  renderFiles();
  if (error) setStatus(formStatus, error, "error");
  else if (selectedFiles.size) setStatus(formStatus, `${selectedFiles.size} file${selectedFiles.size === 1 ? "" : "s"} ready.`, "success");
};

chooseFiles.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("click", (event) => {
  if (event.target !== chooseFiles) fileInput.click();
});
dropZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    fileInput.click();
  }
});
fileInput.addEventListener("change", () => {
  addFiles(fileInput.files);
  fileInput.value = "";
});

["dragenter", "dragover"].forEach((name) => dropZone.addEventListener(name, (event) => {
  event.preventDefault();
  dropZone.classList.add("is-dragging");
}));
["dragleave", "drop"].forEach((name) => dropZone.addEventListener(name, (event) => {
  event.preventDefault();
  dropZone.classList.remove("is-dragging");
}));
dropZone.addEventListener("drop", (event) => addFiles(event.dataTransfer.files));

renderFiles();

const samplePackage = {
  name: "sample-vibe-app",
  version: "1.0.0",
  private: true,
  scripts: { dev: "vite", build: "vite build", postinstall: "node scripts/setup.js" },
  dependencies: { "@supabase/supabase-js": "^2.112.4", express: "^5.1.0", react: "^19.1.1" },
  devDependencies: { vite: "^7.1.5" },
};

const sampleLock = {
  name: "sample-vibe-app",
  version: "1.0.0",
  lockfileVersion: 3,
  requires: true,
  packages: {
    "": { dependencies: samplePackage.dependencies, devDependencies: samplePackage.devDependencies },
    "node_modules/@supabase/supabase-js": { version: "2.112.4", resolved: "https://registry.npmjs.org/@supabase/supabase-js/-/supabase-js-2.112.4.tgz" },
    "node_modules/express": { version: "5.1.0", resolved: "https://registry.npmjs.org/express/-/express-5.1.0.tgz" },
    "node_modules/react": { version: "19.1.1", resolved: "https://registry.npmjs.org/react/-/react-19.1.1.tgz" },
    "node_modules/vite": { version: "7.1.5", resolved: "https://registry.npmjs.org/vite/-/vite-7.1.5.tgz", hasInstallScript: true },
    "node_modules/esbuild": { version: "0.25.9", resolved: "https://registry.npmjs.org/esbuild/-/esbuild-0.25.9.tgz", hasInstallScript: true },
    "node_modules/postgrest-js": { version: "1.19.4", resolved: "https://registry.npmjs.org/postgrest-js/-/postgrest-js-1.19.4.tgz" },
    "node_modules/ws": { version: "8.18.3", resolved: "https://registry.npmjs.org/ws/-/ws-8.18.3.tgz" },
  },
};

sampleButton.addEventListener("click", () => {
  selectedFiles = new Map([
    ["package.json", new File([JSON.stringify(samplePackage, null, 2)], "package.json", { type: "application/json" })],
    ["package-lock.json", new File([JSON.stringify(sampleLock, null, 2)], "package-lock.json", { type: "application/json" })],
  ]);
  projectName.value = "sample vibe app";
  renderFiles();
  setStatus(formStatus, "safe sample loaded. run the preview when ready.", "success");
});

const filePayload = async () => {
  const payload = {};
  for (const [name, file] of selectedFiles) {
    const text = await file.text();
    if (name.endsWith(".json")) {
      const parsed = safeJson(text);
      if (!parsed) throw new Error(`${name} is not valid JSON.`);
      payload[name] = parsed;
    } else {
      payload[name] = text;
    }
  }
  return payload;
};

const metric = (label, value) => {
  const article = document.createElement("article");
  const caption = document.createElement("span");
  const strong = document.createElement("strong");
  caption.textContent = label;
  strong.textContent = String(value);
  article.append(caption, strong);
  return article;
};

const renderPreview = (preview) => {
  const resultTitle = document.querySelector("#result-title");
  resultTitle.textContent = preview.headline || "your project has areas to review.";
  document.querySelector("#result-score").textContent = String(preview.risk_score ?? 0);
  document.querySelector("#locked-count").textContent = String(preview.locked_findings ?? 0);

  const metrics = document.querySelector("#result-metrics");
  metrics.replaceChildren(
    metric("packages mapped", preview.total_packages ?? 0),
    metric("direct choices", preview.direct_dependencies ?? 0),
    metric("transitive", preview.transitive_dependencies ?? 0),
    metric("install scripts", preview.install_scripts ?? 0),
  );

  const findingGrid = document.querySelector("#visible-findings");
  findingGrid.replaceChildren();
  (preview.visible_findings || []).forEach((finding) => {
    const card = document.createElement("article");
    card.className = "finding-card";
    const severity = document.createElement("span");
    const level = String(finding.level || "review").toLowerCase().replace(/[^a-z0-9_-]/g, "");
    severity.className = `severity ${level || "review"}`;
    severity.textContent = finding.label || "review";
    const title = document.createElement("h3");
    title.textContent = finding.title || "Review area";
    const body = document.createElement("p");
    body.textContent = finding.summary || "More analysis is needed.";
    const evidence = document.createElement("small");
    evidence.textContent = `evidence: ${finding.evidence || "not supplied"}`;
    card.append(severity, title, body, evidence);
    findingGrid.append(card);
  });

  results.hidden = false;
  results.scrollIntoView({ behavior: "smooth", block: "start" });
  resultTitle.focus({ preventScroll: true });
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!selectedFiles.has("package.json")) {
    setStatus(formStatus, "add package.json before running the preview.", "error");
    return;
  }
  scanButton.disabled = true;
  scanButton.textContent = "mapping packages...";
  fileInput.disabled = true;
  chooseFiles.disabled = true;
  sampleButton.disabled = true;
  dropZone.classList.add("is-disabled");
  fileList.querySelectorAll("button").forEach((button) => { button.disabled = true; });
  form.setAttribute("aria-busy", "true");
  document.body.classList.add("is-busy");
  setStatus(formStatus, "inventorying direct and transitive dependencies...");

  try {
    const files = await filePayload();
    const response = await apiRequest("preview", {
      project_name: projectName.value.trim() || files["package.json"]?.name || "untitled app",
      files,
    });
    saveCurrentAudit({ id: response.audit_id, preview_token: response.preview_token });
    renderPreview(response.preview);
    setStatus(formStatus, "preview complete. your locked findings were not sent to this browser.", "success");
  } catch (error) {
    console.error("AI App Audit preview failed", error);
    const message = error instanceof TypeError && /fetch/i.test(error.message)
      ? "the audit service could not connect. check your connection and try again."
      : error.message || "the preview could not run. try again.";
    setStatus(formStatus, message, "error");
  } finally {
    scanButton.disabled = !selectedFiles.has("package.json");
    scanButton.textContent = "run free preview";
    fileInput.disabled = false;
    chooseFiles.disabled = false;
    sampleButton.disabled = false;
    dropZone.classList.remove("is-disabled");
    fileList.querySelectorAll("button").forEach((button) => { button.disabled = false; });
    form.removeAttribute("aria-busy");
    document.body.classList.remove("is-busy");
  }
});

const startCheckout = async () => {
  const current = readCurrentAudit();
  if (!current?.id || !current?.preview_token) {
    setStatus(formStatus, "run a preview before unlocking the full report.", "error");
    document.querySelector("#scanner").scrollIntoView({ behavior: "smooth" });
    return;
  }

  unlockButton.disabled = true;
  unlockButton.textContent = "opening checkout...";
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      pendingCheckout = true;
      authDialog.showModal();
      return;
    }
    const response = await apiRequest("create_checkout", {
      audit_id: current.id,
      preview_token: current.preview_token,
    }, true);
    window.location.assign(response.checkout_url);
  } catch (error) {
    if (error.message === "SIGN_IN_REQUIRED") {
      pendingCheckout = true;
      authDialog.showModal();
    } else if (error.code === "PAYMENTS_NOT_CONFIGURED") {
      unlockButton.textContent = "early access opening soon";
      setStatus(formStatus, "the preview works now. secure paid checkout is being connected for launch.", "success");
      document.querySelector("#scanner").scrollIntoView({ behavior: "smooth" });
    } else {
      window.alert(error.message || "Checkout could not open. Please try again.");
    }
  } finally {
    if (!window.location.href.includes("checkout.stripe.com")) {
      unlockButton.disabled = false;
      if (unlockButton.textContent === "opening checkout...") unlockButton.textContent = "unlock full report";
    }
  }
};

unlockButton.addEventListener("click", startCheckout);

const authenticate = async (mode) => {
  const data = new FormData(authForm);
  const email = String(data.get("email") || "").trim();
  const password = String(data.get("password") || "");
  if (!email || password.length < 8) {
    setStatus(authStatus, "use a valid email and a password with at least 8 characters.", "error");
    return;
  }
  authForm.querySelectorAll("button").forEach((button) => { button.disabled = true; });
  setStatus(authStatus, mode === "signup" ? "creating your secure account..." : "signing you in...");

  const result = mode === "signup"
    ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.href.split("?")[0] } })
    : await supabase.auth.signInWithPassword({ email, password });

  authForm.querySelectorAll("button").forEach((button) => { button.disabled = false; });
  if (result.error) {
    setStatus(authStatus, result.error.message || "we could not complete that request.", "error");
    return;
  }
  if (mode === "signup" && !result.data.session) {
    setStatus(authStatus, "check your email to confirm the account, then return here to unlock the report.", "success");
    return;
  }
  setStatus(authStatus, "account verified. opening secure checkout...", "success");
  authDialog.close();
  if (pendingCheckout) {
    pendingCheckout = false;
    await startCheckout();
  }
};

authForm.addEventListener("submit", (event) => {
  event.preventDefault();
  authenticate("signin");
});
authForm.querySelector("[data-auth-action='signup']").addEventListener("click", () => authenticate("signup"));
authForm.querySelector(".dialog-close").addEventListener("click", () => {
  pendingCheckout = false;
  authDialog.close();
});

const reportFinding = (finding, index) => {
  const article = document.createElement("article");
  article.className = "report-finding";
  const title = document.createElement("h3");
  title.textContent = `${String(index + 1).padStart(2, "0")} · ${finding.title || "Review area"}`;
  const summary = document.createElement("p");
  summary.textContent = finding.summary || "";
  const details = document.createElement("dl");
  const fields = [
    ["level", finding.severity],
    ["verified", finding.verified],
    ["possible reach", Array.isArray(finding.reach) ? finding.reach.join(" · ") : finding.reach],
    ["recommended action", finding.recommendation],
  ];
  fields.forEach(([label, value]) => {
    const dt = document.createElement("dt");
    const dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value || "not established";
    details.append(dt, dd);
  });
  article.append(title, summary, details);
  return article;
};

const renderReport = (report) => {
  reportContent.replaceChildren();
  const summary = document.createElement("article");
  summary.className = "report-summary";
  const title = document.createElement("h3");
  title.textContent = report.title || "AI App Audit report";
  const body = document.createElement("p");
  body.textContent = report.executive_summary || "Your complete audit is ready.";
  summary.append(title, body);
  reportContent.append(summary);
  (report.findings || []).forEach((finding, index) => reportContent.append(reportFinding(finding, index)));
  fullReport.hidden = false;
  fullReport.scrollIntoView({ behavior: "smooth" });
};

const loadPaidReport = async (auditId) => {
  fullReport.hidden = false;
  setStatus(reportStatus, "verifying payment and preparing your full report...");
  fullReport.scrollIntoView({ behavior: "smooth" });
  try {
    const response = await apiRequest("get_report", { audit_id: auditId }, true);
    if (response.status === "processing") {
      setStatus(reportStatus, "payment confirmed. the AI interpretation is processing. this page will check again in a moment.");
      window.setTimeout(() => loadPaidReport(auditId), 5000);
      return;
    }
    if (response.status === "locked") {
      setStatus(reportStatus, "checkout has not been confirmed yet. if you just paid, refresh in a moment.", "error");
      return;
    }
    setStatus(reportStatus, `report ready · audit version ${response.report?.audit_version || "1.0"}`, "success");
    renderReport(response.report);
  } catch (error) {
    if (error.message === "SIGN_IN_REQUIRED") {
      pendingCheckout = false;
      authDialog.showModal();
      setStatus(authStatus, "sign in with the account used at checkout to open your report.");
    } else {
      setStatus(reportStatus, error.message || "the report could not be loaded.", "error");
    }
  }
};

document.querySelector("#print-report").addEventListener("click", () => window.print());

const initialize = async () => {
  const params = new URLSearchParams(window.location.search);
  const auditId = params.get("audit");
  const checkout = params.get("checkout");
  if (auditId && checkout === "success") {
    const current = readCurrentAudit() || {};
    saveCurrentAudit({ ...current, id: auditId });
    await loadPaidReport(auditId);
  } else if (checkout === "cancelled") {
    setStatus(formStatus, "checkout was cancelled. your preview is still available in this browser.");
  }
};

initialize();
