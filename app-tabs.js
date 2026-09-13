/**
 * Generic app-window inner-tab switching, scoped PER .app-window so multiple
 * app windows on the same page don't fight over each other's tabs/panels.
 * Each window has [data-app-tab] buttons and [data-app-panel] panels whose
 * values match; the first tab is activated on init.
 */
(function () {
  document.querySelectorAll(".app-window").forEach((win) => {
    const tabs = Array.from(win.querySelectorAll("[data-app-tab]"));
    const panels = Array.from(win.querySelectorAll("[data-app-panel]"));
    if (!tabs.length) return;

    function activate(name) {
      tabs.forEach((t) => {
        const on = t.dataset.appTab === name;
        t.classList.toggle("active", on);
        t.setAttribute("aria-selected", on ? "true" : "false");
        t.tabIndex = on ? 0 : -1;
      });
      panels.forEach((p) => {
        p.hidden = p.dataset.appPanel !== name;
      });
    }

    tabs.forEach((tab, i) => {
      tab.addEventListener("click", () => activate(tab.dataset.appTab));
      tab.addEventListener("keydown", (e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        const dir = e.key === "ArrowRight" ? 1 : -1;
        const next = tabs[(i + dir + tabs.length) % tabs.length];
        activate(next.dataset.appTab);
        next.focus();
      });
    });

    activate(tabs[0].dataset.appTab);
  });
})();
