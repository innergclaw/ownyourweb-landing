(function () {
  const endpoint = window.SR_FAMILY_INTAKE_ENDPOINT || "https://zkyhhoxcrjkhywblzehr.supabase.co/functions/v1/sr-family-intake";
  const forms = document.querySelectorAll("[data-sr-intake-form]");
  if (!forms.length) return;

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

  forms.forEach((form) => {
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
        setStatus(form, "Submitted. The SR Sensory Gym team will follow up soon.", "success");
      } catch (error) {
        setStatus(form, "Something went wrong. Please email info@srchildrenslounge.com directly.", "error");
      } finally {
        if (button) {
          button.disabled = false;
          button.textContent = original;
        }
      }
    });
  });
})();
