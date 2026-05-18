// year
document.getElementById("year").textContent = new Date().getFullYear();

// mobile menu
const burger = document.getElementById("burger");
const menu = document.getElementById("menu");
burger?.addEventListener("click", () => menu.classList.toggle("open"));
menu?.querySelectorAll("a").forEach(a => a.addEventListener("click", () => menu.classList.remove("open")));

// reveal on scroll
const els = Array.from(document.querySelectorAll(".reveal"));
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) e.target.classList.add("show");
  });
}, { threshold: 0.15 });

els.forEach(el => io.observe(el));

// fake theme toggle (optional)
const themeBtn = document.getElementById("themeBtn");
themeBtn?.addEventListener("click", () => {
  document.body.classList.toggle("light");
});

// CTA
document.getElementById("ctaBtn")?.addEventListener("click", () => {
  document.querySelector("#pricing")?.scrollIntoView({ behavior: "smooth" });
});
