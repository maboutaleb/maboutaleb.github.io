/**
 * Live reproduction of the core logic in the real Source Trust Pipeline v4
 * (dap_monitor/source_trust_monthly_pipeline_v4.py). Three engines, one per
 * app-window tab, each ported from the exact formulas/constants in the code:
 *
 *   - Reconcile : symmetric %-diff, alignment tolerance, suspected-source logic
 *                 (_symmetric_pct_diff, _classify_suspected_source).
 *   - Anomaly   : trailing-baseline z-score, fast-spike vs slow-drift rules
 *                 (_z_score_with_zero_std, _add_property_anomaly_flags).
 *   - Trust     : 35/30/20/15 weighted trust score → trust_rating → current_status
 *                 (build_property_summary, _trust_rating).
 *
 * Defaults match the code: tolerance 5%, fast_sigma 6, slow_sigma 2, drift = 3
 * elevated months in a 3-month window, rating cutoffs 95/85/70/50, LOW_TRUST < 85.
 */
(function () {
  /* ------------------------------------------------------------------ */
  /*  Reconcile — pairwise alignment + suspected source                  */
  /* ------------------------------------------------------------------ */
  const SOURCES = ["RESERVATION", "CONSUMED", "PERFORMANCE"];
  const LABELS = { RESERVATION: "Reservation", CONSUMED: "Consumed", PERFORMANCE: "Performance" };

  // _symmetric_pct_diff: 2*|a-b| / (|a|+|b|); both-zero -> 0; one-zero -> 200%.
  function pctDiff(a, b) {
    const denom = Math.abs(a) + Math.abs(b);
    if (denom === 0) return 0;
    return ((2 * Math.abs(a - b)) / denom) * 100;
  }
  const fmtPct = (v) => v.toFixed(1) + "%";

  function readValue(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    const raw = el.value;
    if (raw === "" || raw === null) return null;
    const n = parseFloat(raw);
    return isNaN(n) ? null : n;
  }

  function classify() {
    const tolEl = document.getElementById("demo-tolerance");
    if (!tolEl) return;
    const tolerance = parseFloat(tolEl.value);
    const tolLabel = document.getElementById("demo-tolerance-value");
    if (tolLabel) tolLabel.textContent = tolerance;

    const values = {
      RESERVATION: readValue("demo-reservation"),
      CONSUMED: readValue("demo-consumed"),
      PERFORMANCE: readValue("demo-performance"),
    };

    const present = SOURCES.filter((s) => values[s] !== null);
    const results = document.getElementById("demo-results");
    if (!results) return;

    if (present.length < 2) {
      results.innerHTML = renderReconcile({
        pairs: [],
        alignment: null,
        suspected: "INSUFFICIENT_SOURCES",
        missing: SOURCES.filter((s) => values[s] === null),
      });
      return;
    }

    const pairDefs = [
      ["RESERVATION", "CONSUMED"],
      ["RESERVATION", "PERFORMANCE"],
      ["CONSUMED", "PERFORMANCE"],
    ];

    const pairs = pairDefs
      .filter(([a, b]) => values[a] !== null && values[b] !== null)
      .map(([a, b]) => {
        const diff = pctDiff(values[a], values[b]);
        return { a, b, diff, withinTolerance: diff <= tolerance };
      });

    const largest = Math.max(...pairs.map((p) => p.diff));
    const aligned = largest <= tolerance;

    // _classify_suspected_source: 2 agree + 1 disagrees -> name the outlier.
    let suspected = "NO_SUSPECTED_SOURCE";
    if (pairs.length === 3) {
      const within = pairs.filter((p) => p.withinTolerance);
      if (within.length === 1) {
        const [agreeA, agreeB] = [within[0].a, within[0].b];
        suspected = SOURCES.find((s) => s !== agreeA && s !== agreeB);
      } else if (within.length === 0) {
        suspected = "UNRESOLVED_THREE_WAY";
      } else {
        suspected = "NO_SUSPECTED_SOURCE";
      }
    } else if (pairs.length === 1) {
      suspected = aligned ? "NO_SUSPECTED_SOURCE" : "UNRESOLVED_PAIR";
    }

    results.innerHTML = renderReconcile({
      pairs,
      alignment: { largest, aligned },
      suspected,
      missing: SOURCES.filter((s) => values[s] === null),
    });
  }

  function renderReconcile({ pairs, alignment, suspected, missing }) {
    let html = "";
    if (missing.length) {
      html += `<div class="demo-missing">Missing: ${missing.map((s) => LABELS[s]).join(", ")}</div>`;
    }
    if (pairs.length) {
      html += `<div class="demo-pairs">`;
      pairs.forEach((p) => {
        const cls = p.withinTolerance ? "ok" : "bad";
        html += `
          <div class="demo-pair-row">
            <span class="demo-pair-names">${LABELS[p.a]} vs ${LABELS[p.b]}</span>
            <span class="demo-pair-diff ${cls}">${fmtPct(p.diff)}</span>
          </div>`;
      });
      html += `</div>`;
    }
    if (alignment) {
      const alignedCls = alignment.aligned ? "ok" : "bad";
      html += `
        <div class="demo-verdict-row">
          <span>Largest pairwise difference</span>
          <span class="demo-pair-diff ${alignedCls}">${fmtPct(alignment.largest)}</span>
        </div>
        <div class="demo-badge-row">
          <span class="demo-badge ${alignedCls}">${alignment.aligned ? "ALIGNED" : "OUTSIDE TOLERANCE"}</span>
        </div>`;
    }
    const suspectedLabel = suspected.replace(/_/g, " ");
    const suspectedCls = suspected === "NO_SUSPECTED_SOURCE"
      ? "ok"
      : suspected === "INSUFFICIENT_SOURCES"
      ? "neutral"
      : "bad";
    html += `
      <div class="demo-badge-row">
        <span class="demo-badge ${suspectedCls} mono">Suspected: ${suspectedLabel}</span>
      </div>`;
    return html;
  }

  /* ------------------------------------------------------------------ */
  /*  Anomaly — trailing z-score, fast spike vs slow drift               */
  /* ------------------------------------------------------------------ */
  const TOLERANCE_PCT = 5; // alignment_tolerance_pct = 0.05
  const FAST_SIGMA = 6;    // fast_sigma
  const SLOW_SIGMA = 2;    // slow_sigma

  // _z_score_with_zero_std
  function zScore(cur, mean, std) {
    if (std > 0) return (cur - mean) / std;
    if (cur === mean) return 0;
    return cur > mean ? Infinity : -Infinity;
  }

  function classifyMonth(diff, mean, std) {
    const z = zScore(diff, mean, std);
    const material = diff > TOLERANCE_PCT; // strictly greater than tolerance
    return {
      diff,
      z,
      material,
      elevated: material && z >= SLOW_SIGMA,
      fast: material && z >= FAST_SIGMA,
    };
  }

  const ANOM_PRESETS = {
    normal: [1.8, 2.1, 2.4],
    drift: [5.5, 6.0, 6.5],
    spike: [2.5, 3.0, 12.0],
  };

  function runAnomaly() {
    const meanEl = document.getElementById("anom-mean");
    const stdEl = document.getElementById("anom-std");
    const out = document.getElementById("anom-results");
    if (!meanEl || !stdEl || !out) return;

    const mean = parseFloat(meanEl.value) || 0;
    const std = parseFloat(stdEl.value) || 0;
    const diffs = ["anom-m1", "anom-m2", "anom-m3"].map((id) => {
      const el = document.getElementById(id);
      const valEl = document.getElementById(id + "-val");
      const v = parseFloat(el.value);
      if (valEl) valEl.textContent = v.toFixed(1) + "%";
      return v;
    });

    const months = diffs.map((d) => classifyMonth(d, mean, std));
    const cur = months[2];
    const drift = months.every((m) => m.elevated); // 3 elevated in a 3-month window

    let verdict, vClass, note;
    if (cur.fast) {
      verdict = "FAST_SPIKE";
      vClass = "bad";
      note = `Current month: diff > ${TOLERANCE_PCT}% and z ≥ ${FAST_SIGMA} — a sudden, extreme break from this property's own baseline.`;
    } else if (drift) {
      verdict = "SLOW_DRIFT";
      vClass = "bad";
      note = `3 consecutive months each > ${TOLERANCE_PCT}% and z ≥ ${SLOW_SIGMA} — a persistent drift, not a one-off.`;
    } else if (cur.elevated) {
      verdict = "ELEVATED (1 mo)";
      vClass = "warn";
      note = `Current month is elevated (> ${TOLERANCE_PCT}%, z ≥ ${SLOW_SIGMA}) but drift needs 3 in a row — a precursor, not yet an episode.`;
    } else if (cur.material) {
      verdict = "OUTSIDE_TOLERANCE";
      vClass = "warn";
      note = `Above the ${TOLERANCE_PCT}% tolerance but within normal statistical variation (z < ${SLOW_SIGMA}) — counted as an alignment miss, not a statistical alert.`;
    } else {
      verdict = "ALIGNED";
      vClass = "ok";
      note = `Within the ${TOLERANCE_PCT}% tolerance — no issue.`;
    }

    const monthLabels = ["month −2", "month −1", "current"];
    const strip = months
      .map((m, i) => {
        const zTxt = m.z === Infinity ? "∞" : m.z === -Infinity ? "−∞" : m.z.toFixed(1);
        const flag = m.fast ? "spike" : m.elevated ? "elevated" : m.material ? "outside tol." : "aligned";
        const flagCls = m.fast || (i === 2 && drift) ? "bad" : m.elevated ? "warn" : m.material ? "warn" : "ok";
        return `
          <div class="anom-month">
            <div class="anom-month-label">${monthLabels[i]}</div>
            <div class="anom-month-diff mono">${m.diff.toFixed(1)}%</div>
            <div class="anom-month-z mono">z = ${zTxt}</div>
            <span class="anom-flag ${flagCls}">${flag}</span>
          </div>`;
      })
      .join("");

    out.innerHTML = `
      <div class="anom-strip">${strip}</div>
      <div class="demo-badge-row">
        <span class="demo-badge ${vClass} mono">${verdict}</span>
      </div>
      <p class="anom-note">${note}</p>`;
  }

  /* ------------------------------------------------------------------ */
  /*  Trust score — 35/30/20/15 → trust_rating → current_status          */
  /* ------------------------------------------------------------------ */
  const WEIGHTS = { rev: 0.35, rooms: 0.3, comp: 0.2, stab: 0.15 };

  function trustRating(score) {
    if (score >= 95) return { label: "EXCELLENT", cls: "ok" };
    if (score >= 85) return { label: "GOOD", cls: "ok" };
    if (score >= 70) return { label: "REVIEW", cls: "warn" };
    if (score >= 50) return { label: "MATERIAL_CONCERN", cls: "bad" };
    return { label: "SEVERE_CONCERN", cls: "bad" };
  }

  function currentStatus(score, activeIssue, historicalIssue) {
    if (activeIssue) return { label: "ACTIVE_ISSUE", cls: "bad" };
    if (score < 85) return { label: "LOW_TRUST", cls: "warn" };
    if (historicalIssue) return { label: "HEALTHY_WITH_HISTORY", cls: "ok" };
    return { label: "HEALTHY", cls: "ok" };
  }

  function runTrust() {
    const rev = document.getElementById("trust-rev");
    if (!rev) return;
    const comps = {
      rev: parseFloat(document.getElementById("trust-rev").value),
      rooms: parseFloat(document.getElementById("trust-rooms").value),
      comp: parseFloat(document.getElementById("trust-comp").value),
      stab: parseFloat(document.getElementById("trust-stab").value),
    };
    Object.keys(comps).forEach((k) => {
      const v = document.getElementById("trust-" + k + "-val");
      if (v) v.textContent = comps[k].toFixed(0);
    });

    const overall =
      WEIGHTS.rev * comps.rev +
      WEIGHTS.rooms * comps.rooms +
      WEIGHTS.comp * comps.comp +
      WEIGHTS.stab * comps.stab;

    const activeIssue = document.getElementById("trust-active").checked;
    const historicalIssue = document.getElementById("trust-history").checked;
    const rating = trustRating(overall);
    const status = currentStatus(overall, activeIssue, historicalIssue);

    const rows = [
      ["Revenue alignment", comps.rev, WEIGHTS.rev],
      ["Rooms alignment", comps.rooms, WEIGHTS.rooms],
      ["Completeness", comps.comp, WEIGHTS.comp],
      ["Stability", comps.stab, WEIGHTS.stab],
    ]
      .map(
        ([name, val, w]) => `
        <div class="trust-comp-row">
          <span class="trust-comp-name">${name}</span>
          <span class="trust-comp-w mono">×${w}</span>
          <span class="trust-comp-contrib mono">${(val * w).toFixed(1)}</span>
        </div>`
      )
      .join("");

    const out = document.getElementById("trust-results");
    out.innerHTML = `
      <div class="trust-score-big">
        <span class="trust-score-num mono">${overall.toFixed(1)}</span>
        <span class="trust-score-scale">/ 100</span>
      </div>
      <div class="demo-badge-row trust-badges">
        <span class="demo-badge ${rating.cls} mono">${rating.label}</span>
        <span class="demo-badge ${status.cls} mono">${status.label}</span>
      </div>
      <div class="trust-comp-list">
        <div class="trust-comp-head">Weighted contributions</div>
        ${rows}
      </div>`;
  }

  /* ------------------------------------------------------------------ */
  /*  Wiring                                                             */
  /* ------------------------------------------------------------------ */
  ["demo-reservation", "demo-consumed", "demo-performance", "demo-tolerance"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", classify);
  });

  ["anom-mean", "anom-std", "anom-m1", "anom-m2", "anom-m3"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", runAnomaly);
  });
  document.querySelectorAll(".anom-preset").forEach((btn) => {
    btn.addEventListener("click", () => {
      const vals = ANOM_PRESETS[btn.dataset.preset];
      if (!vals) return;
      ["anom-m1", "anom-m2", "anom-m3"].forEach((id, i) => {
        const el = document.getElementById(id);
        if (el) el.value = vals[i];
      });
      runAnomaly();
    });
  });

  ["trust-rev", "trust-rooms", "trust-comp", "trust-stab", "trust-active", "trust-history"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", runTrust);
    if (el) el.addEventListener("change", runTrust);
  });

  classify();
  runAnomaly();
  runTrust();
})();
