/**
 * Top-level home-page tabs: Overview / Live demos / Projects.
 * Only one zone shows at a time. Nav links and location.hash route to a tab
 * (#overview, #demos, #projects) so deep links and the nav bar both work.
 */
(function () {
  const tabs = Array.from(document.querySelectorAll("[data-site-tab]"));
  const panels = Array.from(document.querySelectorAll("[data-site-panel]"));
  if (!tabs.length) return;

  const names = tabs.map((t) => t.dataset.siteTab);

  function activate(name, { scroll = false } = {}) {
    if (!names.includes(name)) name = names[0];
    tabs.forEach((t) => {
      const on = t.dataset.siteTab === name;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach((p) => {
      p.hidden = p.dataset.sitePanel !== name;
    });
    if (history.replaceState) {
      history.replaceState(null, "", "#" + name);
    }
    if (scroll) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  tabs.forEach((tab, i) => {
    tab.addEventListener("click", (e) => {
      e.preventDefault();
      activate(tab.dataset.siteTab);
    });
    tab.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
      e.preventDefault();
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const next = tabs[(i + dir + tabs.length) % tabs.length];
      activate(next.dataset.siteTab);
      next.focus();
    });
  });

  // Nav links (and any in-page link) pointing at a tab hash route to that tab.
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    const target = a.getAttribute("href").slice(1);
    if (names.includes(target)) {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        activate(target, { scroll: true });
      });
    }
  });

  // Honor the hash on load; default to the first tab.
  const initial = (location.hash || "").slice(1);
  activate(names.includes(initial) ? initial : names[0]);
})();
