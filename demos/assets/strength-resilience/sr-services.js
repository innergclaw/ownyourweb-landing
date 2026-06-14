(() => {
  const form = document.querySelector("[data-sr-service-request-form]");
  if (!form) return;

  const serviceSelect = form.querySelector("[name='requested_service']");

  document.querySelectorAll("[data-sr-service-choice]").forEach((link) => {
    link.addEventListener("click", () => {
      serviceSelect.value = link.dataset.srServiceChoice || "";
      window.setTimeout(() => serviceSelect.focus(), 350);
    });
  });
})();
