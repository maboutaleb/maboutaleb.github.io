/**
 * Liquid UI — dynamic 3D cursor tilt for water-bubble cards.
 *
 * Any element carrying the `.tilt` class leans toward the pointer (max 6° on
 * each axis) so the glass surface catches light as if it were a physical
 * droplet. The transform is written inline on pointer move and cleared on
 * leave, handing control back to the CSS :hover spring. Purely presentational;
 * it attaches no behaviour to the tab systems (site-tabs.js / app-tabs.js).
 */
(function () {
  var MAX_TILT = 6; // degrees

  // Respect users who ask for reduced motion — no tilt at all.
  var reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduce) return;

  // Skip on touch-primary devices, where there is no hover pointer to follow.
  var hasFinePointer = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
  if (!hasFinePointer) return;

  function bind(card) {
    card.style.transformStyle = "preserve-3d";
    card.style.willChange = "transform";

    card.addEventListener("mousemove", function (e) {
      var rect = card.getBoundingClientRect();
      var px = (e.clientX - rect.left) / rect.width; // 0 → 1
      var py = (e.clientY - rect.top) / rect.height; // 0 → 1
      var rotateY = (px - 0.5) * 2 * MAX_TILT; // left/right lean
      var rotateX = (0.5 - py) * 2 * MAX_TILT; // up/down lean
      card.style.transform =
        "perspective(900px) rotateX(" + rotateX.toFixed(2) + "deg) rotateY(" +
        rotateY.toFixed(2) + "deg) translateY(-4px) scale(1.015)";
    });

    card.addEventListener("mouseleave", function () {
      // Clear inline transform so the CSS hover/rest state takes back over.
      card.style.transform = "";
    });
  }

  function init() {
    var cards = document.querySelectorAll(".tilt");
    for (var i = 0; i < cards.length; i++) bind(cards[i]);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
