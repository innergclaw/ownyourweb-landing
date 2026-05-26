(() => {
  const root = document.querySelector("[data-client-project-root]");
  const script = document.currentScript;
  const slug = root?.dataset.projectSlug || script?.dataset.projectSlug || document.body.dataset.projectSlug;
  const endpoint = window.OWNYOURWEB_CLIENT_PROJECTS_ENDPOINT ||
    "https://zkyhhoxcrjkhywblzehr.supabase.co/functions/v1/ownyourweb-client-projects";

  if (!root || !slug) return;

  const statusEl = root.querySelector("[data-live-status]");
  const updateList = root.querySelector("[data-live-updates]");
  const projectStage = root.querySelector("[data-live-stage]");
  const currentStep = root.querySelector("[data-live-current-step]");
  const lastSynced = root.querySelector("[data-live-last-synced]");

  function formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function setStatus(text) {
    if (statusEl) statusEl.textContent = text;
  }

  function render(data) {
    const project = data.project || {};
    const updates = Array.isArray(data.updates) ? data.updates : [];

    setStatus(project.status_label || "Synced");
    if (projectStage) projectStage.textContent = project.stage || project.status_label || "Project active";
    if (currentStep) currentStep.textContent = project.current_step || "Watch this tracker for the next update.";
    if (lastSynced) lastSynced.textContent = `Synced ${formatDate(data.refreshed_at)}`;

    if (!updateList) return;
    if (!updates.length) {
      updateList.innerHTML = '<div class="note"><strong>No updates yet</strong>Project updates will appear here once they are added.</div>';
      return;
    }

    updateList.innerHTML = updates.slice(0, 5).map((update) => `
      <div class="note">
        <strong>${escapeHtml(update.title || "Project update")}</strong>
        <span>${linkify(update.body || "")}</span>
        <small>${escapeHtml(update.status_label || project.status_label || "")} · ${escapeHtml(formatDate(update.created_at))}</small>
      </div>
    `).join("");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function linkify(value) {
    return escapeHtml(value).replace(
      /(https?:\/\/[^\s<]+)/g,
      '<a href="$1" target="_blank" rel="noopener">$1</a>'
    );
  }

  async function load({ countView = false } = {}) {
    const url = new URL(endpoint);
    url.searchParams.set("slug", slug);
    if (countView) url.searchParams.set("view", "1");

    try {
      const response = await fetch(url, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Sync unavailable");
      }
      render(data);
      root.dataset.syncState = "live";
    } catch (error) {
      root.dataset.syncState = "offline";
      setStatus("Static fallback");
      if (lastSynced) lastSynced.textContent = "Live sync waiting on Supabase";
      console.warn("[OwnYourWeb client tracker]", error);
    }
  }

  load({ countView: true });
  window.setInterval(() => load(), 30000);
})();
