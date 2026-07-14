const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const reveals = document.querySelectorAll('.reveal');
const smokyIntro = document.querySelector('[data-smoky-intro]');

if (smokyIntro) {
  const skipIntro = smokyIntro.querySelector('[data-smoky-skip]');
  let leaveTimer = 0;
  let removeTimer = 0;

  const removeIntro = () => {
    smokyIntro.remove();
    document.documentElement.classList.remove('intro-pending');
  };

  const leaveIntro = () => {
    if (smokyIntro.classList.contains('is-leaving')) return;
    window.clearTimeout(leaveTimer);
    smokyIntro.classList.add('is-leaving');
    removeTimer = window.setTimeout(removeIntro, 1080);
  };

  if (reducedMotion.matches) {
    removeIntro();
  } else {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => smokyIntro.classList.add('is-ready'));
    });
    leaveTimer = window.setTimeout(leaveIntro, 2700);
    skipIntro?.addEventListener('click', leaveIntro, { once: true });
    window.addEventListener('pagehide', () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(removeTimer);
    }, { once: true });
  }
} else {
  document.documentElement.classList.remove('intro-pending');
}

if (reducedMotion.matches || !('IntersectionObserver' in window)) {
  reveals.forEach((element) => element.classList.add('is-visible'));
} else {
  const observer = new IntersectionObserver((entries, revealObserver) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-visible');
      revealObserver.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });

  reveals.forEach((element) => observer.observe(element));
}

const progress = document.querySelector('.progress');
let frame = 0;
const renderProgress = () => {
  frame = 0;
  const range = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
  progress.style.transform = `scaleX(${Math.min(window.scrollY / range, 1)})`;
};

window.addEventListener('scroll', () => {
  if (!frame) frame = requestAnimationFrame(renderProgress);
}, { passive: true });
renderProgress();
