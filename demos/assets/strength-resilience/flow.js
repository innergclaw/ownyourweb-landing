(() => {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const revealSelector = [
    "main > section",
    ".panel",
    ".quick-point",
    ".highlight-card",
    ".photo-card",
    ".story-card",
    ".visit-card",
    ".package-card",
    ".service-card",
    ".plan-card",
    ".event-card",
    ".note-band",
    ".donor-band"
  ].join(",");

  const floatSelector = [
    ".hero-photo",
    ".quick-point",
    ".highlight-card",
    ".photo-card",
    ".package-card",
    ".service-card",
    ".plan-card",
    ".event-card"
  ].join(",");

  const revealItems = [...document.querySelectorAll(revealSelector)];
  const floatItems = [...document.querySelectorAll(floatSelector)];

  if (reduceMotion) {
    revealItems.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  document.documentElement.classList.add("sr-flow-ready");
  revealItems.forEach((item) => item.classList.add("sr-reveal"));
  floatItems.forEach((item) => item.classList.add("sr-float"));

  const revealVisibleItems = () => {
    revealItems.forEach((item) => {
      if (item.classList.contains("is-visible")) return;
      const rect = item.getBoundingClientRect();
      const nearViewport = rect.top < window.innerHeight * 0.94 && rect.bottom > window.innerHeight * -0.18;
      if (nearViewport) item.classList.add("is-visible");
    });
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, {
    threshold: 0.01,
    rootMargin: "0px 0px 10% 0px"
  });

  revealItems.forEach((item) => observer.observe(item));

  let ticking = false;
  const requestRevealCheck = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      revealVisibleItems();
      ticking = false;
    });
  };

  revealVisibleItems();
  window.addEventListener("scroll", requestRevealCheck, { passive: true });
  window.addEventListener("resize", requestRevealCheck);
  window.addEventListener("load", revealVisibleItems);
  setTimeout(revealVisibleItems, 450);
})();
