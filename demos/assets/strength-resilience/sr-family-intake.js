(function () {
  const endpoint = window.SR_FAMILY_INTAKE_ENDPOINT || "https://zkyhhoxcrjkhywblzehr.supabase.co/functions/v1/sr-family-intake";

  function setStatus(form, message, tone) {
    const status = form.querySelector("[data-sr-form-status]");
    if (!status) return;
    status.textContent = message;
    status.dataset.tone = tone || "neutral";
  }

  function serialize(form) {
    const data = new FormData(form);
    const payload = {};
    for (const [key, value] of data.entries()) {
      if (payload[key]) {
        payload[key] = `${payload[key]}, ${value}`;
      } else {
        payload[key] = value;
      }
    }

    form.querySelectorAll('input[type="checkbox"]').forEach((input) => {
      payload[input.name] = input.checked;
    });

    return {
      ...payload,
      source_page: window.location.href,
    };
  }

  function bindForm(form) {
    if (form.dataset.srIntakeBound === "true") return;
    form.dataset.srIntakeBound = "true";

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      const original = button ? button.textContent : "";

      if (button) {
        button.disabled = true;
        button.textContent = "Sending...";
      }
      setStatus(form, "Sending your information securely...", "neutral");

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(serialize(form)),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) {
          throw new Error(data.error || "Submission failed");
        }
        form.reset();
        const isNewsletter = form.matches("[data-sr-newsletter-form]");
        setStatus(
          form,
          isNewsletter ? "You're signed up. Welcome to the SR community!" : "Submitted. The SR Sensory Gym team will follow up soon.",
          "success"
        );
        if (isNewsletter) {
          window.setTimeout(() => closeNewsletterPopup(true), 1200);
        }
      } catch (error) {
        setStatus(form, "Something went wrong. Please email info@srchildrenslounge.com directly.", "error");
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = original;
        }
      }
    });
  }

  const newsletterPopup = document.querySelector("[data-sr-newsletter-popup]");
  let newsletterTimer = null;

  function closeNewsletterPopup(remember) {
    if (!newsletterPopup) return;
    window.clearTimeout(newsletterTimer);
    newsletterPopup.classList.remove("is-visible");
    if (remember) {
      try {
        window.sessionStorage.setItem("srNewsletterPopupDismissed", "true");
      } catch (_error) {
        // Storage can be unavailable in private browsing; closing still works.
      }
    }
    window.setTimeout(() => {
      newsletterPopup.hidden = true;
    }, 300);
  }

  function positionNewsletterPopup() {
    if (!newsletterPopup || newsletterPopup.hidden) return;
    newsletterPopup.style.transform = `translateY(${window.scrollY}px)`;
  }

  function initNewsletterPopup() {
    if (!newsletterPopup) return;

    let dismissed = false;
    try {
      dismissed = window.sessionStorage.getItem("srNewsletterPopupDismissed") === "true";
    } catch (_error) {
      dismissed = false;
    }
    if (dismissed) return;

    newsletterPopup.querySelectorAll("[data-sr-newsletter-close]").forEach((button) => {
      button.addEventListener("click", () => closeNewsletterPopup(true));
    });

    window.addEventListener("scroll", positionNewsletterPopup, { passive: true });
    window.addEventListener("resize", positionNewsletterPopup);

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && newsletterPopup.classList.contains("is-visible")) {
        closeNewsletterPopup(true);
      }
    });

    newsletterTimer = window.setTimeout(() => {
      newsletterPopup.hidden = false;
      positionNewsletterPopup();
      window.requestAnimationFrame(() => {
        newsletterPopup.classList.add("is-visible");
      });
    }, 5000);
  }

  document.querySelectorAll("[data-sr-intake-form]").forEach(bindForm);
  initNewsletterPopup();
})();
