const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const reveals = document.querySelectorAll('.reveal');

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
