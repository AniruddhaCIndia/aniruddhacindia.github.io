document.addEventListener("DOMContentLoaded", () => {
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Staggered scroll reveal ---------- */
  const revealEls = document.querySelectorAll("[data-reveal]");
  revealEls.forEach((el, i) => {
    el.style.transitionDelay = `${Math.min(i, 5) * 90}ms`;
  });

  if (!("IntersectionObserver" in window) || revealEls.length === 0) {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  } else {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );
    revealEls.forEach((el) => observer.observe(el));
  }

  /* ---------- Sliding nav indicator ---------- */
  const navList = document.querySelector("nav.site-nav ul");
  if (navList) {
    const indicator = document.createElement("span");
    indicator.className = "nav-indicator";
    indicator.setAttribute("aria-hidden", "true");
    navList.appendChild(indicator);

    const links = navList.querySelectorAll("a");
    const currentLink = navList.querySelector('a[aria-current="page"]');

    const moveIndicatorTo = (el) => {
      if (!el) return;
      indicator.style.left = `${el.offsetLeft}px`;
      indicator.style.width = `${el.offsetWidth}px`;
    };

    // Position under current page after layout, without an initial slide-from-zero
    requestAnimationFrame(() => {
      if (currentLink) {
        indicator.style.transition = "none";
        moveIndicatorTo(currentLink);
        requestAnimationFrame(() => {
          indicator.style.transition = "";
        });
      }
    });

    links.forEach((link) => {
      link.addEventListener("mouseenter", () => moveIndicatorTo(link));
      link.addEventListener("focus", () => moveIndicatorTo(link));
    });

    navList.addEventListener("mouseleave", () => moveIndicatorTo(currentLink));
  }
});
