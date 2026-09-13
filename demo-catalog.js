/**
 * "AI-enabled catalog" demo — a faithful miniature of the real three-tab
 * Streamlit app (claude-make-a-thon/app.py), packaged as an app window with
 * four inner tabs: Pipeline, Browse, Ask, FAQ.
 *
 *   - Ask  reproduces the Chat tab: score_table(), retrieve_tables(), and
 *          confidence_score() are ported line-for-line from Python to JS,
 *          reading the same catalog shape (stats / top_columns / summary).
 *   - Browse reproduces the Catalog tab: a plain substring + domain filter
 *          (NOT scored retrieval) over the same catalog, with per-table detail.
 *   - FAQ  reproduces the Home tab: the LLM-generated FAQ cards by domain.
 *   - Pipeline is a static diagram in index.html (no JS needed).
 *
 * Runs against the SYNTHETIC sample in catalog-demo-data.js. Retrieval ranking
 * and the confidence badge are computed live; only the answer TEXT is pre-written.
 */
(function () {
  if (typeof CATALOG_DEMO_TABLES === "undefined") return;

  const TABLE_INDEX = {};
  CATALOG_DEMO_TABLES.forEach((t) => (TABLE_INDEX[t.full_name] = t));
  // Mirrors: total_qc = sum(t["stats"]["query_count"] for t in catalog["tables"])
  const TOTAL_QC = CATALOG_DEMO_TABLES.reduce((s, t) => s + t.stats.query_count, 0);

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  /* ============================ Ask (Chat tab) ============================ */

  // --- score_table() ---
  function scoreTable(table, query) {
    const q = query.toLowerCase();
    let score = 0;
    const fullName = table.full_name.toLowerCase();
    if (fullName.includes(q)) score += 3;
    q.split(/\s+/).forEach((word) => {
      if (word && fullName.includes(word)) score += 1;
    });

    const cols = [
      ...(table.top_columns.selected || []),
      ...(table.top_columns.filtered || []),
      ...(table.top_columns.joined || []),
    ];
    cols.forEach((col) => {
      if (col.toLowerCase().includes(q)) score += 0.5;
    });

    // Boost by log of query count so popular tables rank higher
    const qc = table.stats.query_count || 0;
    if (qc > 0) score += Math.log10(qc) * 0.1;

    const summary = table.summary || {};
    const text =
      typeof summary === "object"
        ? Object.values(summary).join(" ").toLowerCase()
        : String(summary).toLowerCase();
    if (text.includes(q)) score += 0.5;

    return score;
  }

  // --- retrieve_tables() ---  (real app: top_k = 8, keep score > 0)
  function retrieveTables(query, topK = 8) {
    return CATALOG_DEMO_TABLES.map((t) => ({ table: t, score: scoreTable(t, query) }))
      .sort((a, b) => b.score - a.score)
      .filter((s) => s.score > 0)
      .slice(0, topK);
  }

  // --- confidence_score() ---  (checked against the FULL catalog index, not just retrieved)
  function confidenceScore(citations) {
    if (!citations.length) {
      return {
        badge: "🔴",
        label: "Low",
        score: 0,
        reason: "No table citations found in response.",
      };
    }
    const grounded = citations.filter((c) => c in TABLE_INDEX);
    const ungrounded = citations.filter((c) => !(c in TABLE_INDEX));
    const total = citations.length;
    const ratio = total ? grounded.length / total : 0;

    const citedQc = grounded.reduce((sum, c) => sum + TABLE_INDEX[c].stats.query_count, 0);
    const volumeWeight = TOTAL_QC > 0 ? citedQc / TOTAL_QC : 0;

    let combined = ratio * 0.7 + volumeWeight * 10 * 0.3;
    combined = Math.min(combined, 1.0);

    let badge, label;
    if (combined >= 0.8 && grounded.length) {
      badge = "🟢";
      label = "High";
    } else if (combined >= 0.5) {
      badge = "🟡";
      label = "Medium";
    } else {
      badge = "🔴";
      label = "Low";
    }

    let reason = `${grounded.length}/${total} cited tables found in catalog`;
    if (ungrounded.length) reason += `; unrecognized: ${ungrounded.join(", ")}`;
    reason += `. Volume coverage: ${(volumeWeight * 100).toFixed(1)}%.`;

    return { badge, label, score: Math.round(combined * 100) / 100, reason };
  }

  function matchCanned(query) {
    const q = query.toLowerCase();
    const exact = CATALOG_DEMO_QA.find((qa) => qa.question.toLowerCase() === q);
    if (exact) return exact;

    let best = null;
    let bestScore = 0;
    CATALOG_DEMO_QA.forEach((qa) => {
      const hits = qa.keywords.filter((k) => q.includes(k.toLowerCase())).length;
      if (hits > bestScore) {
        bestScore = hits;
        best = qa;
      }
    });
    return bestScore > 0 ? best : null;
  }

  function renderRetrieved(hits) {
    if (!hits.length) {
      return `<div class="catalog-empty">Retrieval returned no tables (nothing scored above zero) — the model would answer from an empty context.</div>`;
    }
    return hits
      .map(
        ({ table, score }) => `
        <div class="catalog-hit">
          <span class="catalog-hit-name mono">${table.full_name}</span>
          <span class="catalog-hit-meta">${table.domain} · ${table.stats.query_count.toLocaleString()} queries · score ${score.toFixed(2)}</span>
        </div>`
      )
      .join("");
  }

  function renderAnswer(canned, hits) {
    if (!canned) {
      return `
        <div class="catalog-no-answer">
          No pre-written answer matches this question in the demo — try one of the example chips above.
          The retrieval ranking on the left is still live and real for whatever you type.
        </div>`;
    }

    const conf = confidenceScore(canned.citations);
    const confClass = conf.label === "High" ? "ok" : conf.label === "Medium" ? "warn" : "bad";

    // Faithful to the real app: answer text, then a single confidence badge line with
    // score, the scorer's reason, and a "Context tables used" list of the retrieved
    // tables (which is distinct from what the answer cited).
    const guardrailNote = canned.guardrail
      ? `<p class="catalog-guardrail-note">⚠ Constructed guardrail example — the model here names
         <code>sample_wh.loyalty_tier_summary</code>, which isn't in the catalog (the real table is
         <code>sample_wh.loyalty_accounts</code>). In the real run 0 of 61 citations were ungrounded,
         so this branch never actually fired; it's shown to prove the scorer catches an invented
         citation instead of trusting it.</p>`
      : "";

    const contextList = hits.length
      ? hits.map((h) => `<li class="mono">${h.table.full_name}</li>`).join("")
      : `<li class="catalog-empty">none — retrieval scored no tables above zero</li>`;

    return `
      <p class="catalog-answer-text">${escapeHtml(canned.answer)}</p>
      <div class="demo-badge-row">
        <span class="demo-badge ${confClass}">${conf.badge} ${conf.label} confidence · score ${conf.score.toFixed(2)}</span>
      </div>
      <p class="catalog-confidence-reason">${conf.reason} <em>Confidence is heuristic, not calibrated.</em></p>
      ${guardrailNote}
      <details class="catalog-context">
        <summary>Context tables used (top retrieval hits sent to the model)</summary>
        <ul class="catalog-context-list">${contextList}</ul>
      </details>
    `;
  }

  function runAsk() {
    const input = document.getElementById("catalog-question");
    const retrievedEl = document.getElementById("catalog-retrieved");
    const answerEl = document.getElementById("catalog-answer");
    if (!input || !retrievedEl || !answerEl) return;

    const query = input.value.trim();
    if (!query) {
      retrievedEl.innerHTML = "";
      answerEl.innerHTML = "";
      return;
    }

    const hits = retrieveTables(query);
    retrievedEl.innerHTML = renderRetrieved(hits);

    const canned = matchCanned(query);
    answerEl.innerHTML = renderAnswer(canned, hits);
  }

  function initAsk() {
    document.querySelectorAll(".demo-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        const input = document.getElementById("catalog-question");
        input.value = chip.dataset.q;
        runAsk();
      });
    });

    const input = document.getElementById("catalog-question");
    if (input) {
      input.addEventListener("input", runAsk);
      // Seed with the first example so the widget isn't empty on load.
      input.value = CATALOG_DEMO_QA[0].question;
      runAsk();
    }
  }

  /* ============================ Browse (Catalog tab) ============================ */

  let browseSelected = CATALOG_DEMO_TABLES[0].full_name;

  function columnChips(cols) {
    if (!cols || !cols.length) return `<span class="catalog-col-none">—</span>`;
    return cols.map((c) => `<span class="tag">${c}</span>`).join("");
  }

  function renderBrowseDetail(name) {
    const t = TABLE_INDEX[name];
    if (!t) return "";
    const cooccur = (t.cooccurs_with || []).length
      ? t.cooccurs_with.map((c) => `<span class="tag">${c}</span>`).join("")
      : `<span class="catalog-col-none">none recorded</span>`;
    const users = (t.top_users || []).length
      ? t.top_users.map((u) => `<span class="tag">${u}</span>`).join("")
      : `<span class="catalog-col-none">—</span>`;
    const examples = (t.examples || [])
      .map((sql) => `<pre class="catalog-sql mono">${escapeHtml(sql)}</pre>`)
      .join("");

    return `
      <div class="catalog-detail-head">
        <h4 class="mono">${t.full_name}</h4>
        <span class="tag">${t.domain}</span>
      </div>
      <p class="catalog-detail-purpose">${t.summary.purpose}</p>

      <div class="catalog-stat-tiles">
        <div class="catalog-stat"><span class="catalog-stat-num">${t.stats.query_count.toLocaleString()}</span><span class="catalog-stat-label">distinct queries</span></div>
        <div class="catalog-stat"><span class="catalog-stat-num">${t.stats.total_executions.toLocaleString()}</span><span class="catalog-stat-label">total executions</span></div>
        <div class="catalog-stat"><span class="catalog-stat-num">${t.stats.distinct_users.toLocaleString()}</span><span class="catalog-stat-label">distinct users</span></div>
      </div>

      <div class="catalog-detail-section">
        <div class="catalog-detail-label">Columns by role <span class="catalog-detail-hint">— extracted from query history with sqlglot</span></div>
        <table class="data-table catalog-role-table">
          <tr><th>Selected</th><td>${columnChips(t.top_columns.selected)}</td></tr>
          <tr><th>Filtered</th><td>${columnChips(t.top_columns.filtered)}</td></tr>
          <tr><th>Joined</th><td>${columnChips(t.top_columns.joined)}</td></tr>
        </table>
      </div>

      <div class="catalog-detail-grid">
        <div class="catalog-detail-section">
          <div class="catalog-detail-label">Co-occurs with</div>
          <div class="tag-row">${cooccur}</div>
        </div>
        <div class="catalog-detail-section">
          <div class="catalog-detail-label">Top users</div>
          <div class="tag-row">${users}</div>
        </div>
      </div>

      <div class="catalog-detail-section">
        <div class="catalog-detail-label">Who uses it / when</div>
        <p class="catalog-detail-purpose">${t.summary.who_uses_it} ${t.summary.when_to_use}</p>
      </div>

      <div class="catalog-detail-section">
        <div class="catalog-detail-label">Example query</div>
        ${examples}
      </div>
    `;
  }

  function runBrowse() {
    const searchEl = document.getElementById("browse-search");
    const domainEl = document.getElementById("browse-domain");
    const listEl = document.getElementById("browse-list");
    const detailEl = document.getElementById("browse-detail");
    if (!listEl || !detailEl) return;

    const term = (searchEl ? searchEl.value : "").trim().toLowerCase();
    const domain = domainEl ? domainEl.value : "all";

    // Plain substring + domain filter — mirrors the app's Catalog tab (NOT scored retrieval).
    const matches = CATALOG_DEMO_TABLES.filter((t) => {
      const nameHit = t.full_name.toLowerCase().includes(term);
      const domainHit = domain === "all" || t.domain === domain;
      return nameHit && domainHit;
    });

    if (!matches.length) {
      listEl.innerHTML = `<div class="catalog-empty">No tables match "${escapeHtml(term)}".</div>`;
      detailEl.innerHTML = "";
      return;
    }

    // Keep the selected table valid; otherwise fall back to the first match.
    if (!matches.some((t) => t.full_name === browseSelected)) {
      browseSelected = matches[0].full_name;
    }

    listEl.innerHTML = matches
      .map(
        (t) => `
        <button class="catalog-browse-row${t.full_name === browseSelected ? " active" : ""}" data-table="${t.full_name}">
          <span class="catalog-browse-name mono">${t.full_name}</span>
          <span class="catalog-browse-meta">${t.domain} · ${t.stats.query_count.toLocaleString()} queries</span>
        </button>`
      )
      .join("");

    listEl.querySelectorAll(".catalog-browse-row").forEach((row) => {
      row.addEventListener("click", () => {
        browseSelected = row.dataset.table;
        runBrowse();
      });
    });

    detailEl.innerHTML = renderBrowseDetail(browseSelected);
  }

  function initBrowse() {
    const domainEl = document.getElementById("browse-domain");
    if (domainEl) {
      const domains = [...new Set(CATALOG_DEMO_TABLES.map((t) => t.domain))];
      domainEl.innerHTML =
        `<option value="all">All domains (${CATALOG_DEMO_TABLES.length})</option>` +
        domains.map((d) => `<option value="${d}">${d}</option>`).join("");
      domainEl.addEventListener("change", runBrowse);
    }
    const searchEl = document.getElementById("browse-search");
    if (searchEl) searchEl.addEventListener("input", runBrowse);
    runBrowse();
  }

  /* ============================ FAQ (Home tab) ============================ */

  function initFaq() {
    const el = document.getElementById("faq-cards");
    if (!el) return;
    if (typeof CATALOG_DEMO_FAQ === "undefined") return;

    el.innerHTML = CATALOG_DEMO_FAQ.map(
      (group) => `
      <div class="faq-domain">
        <div class="faq-domain-label">${group.domain}</div>
        <div class="faq-card-grid">
          ${group.cards
            .map((card) => {
              const chips = card.tables_cited
                .map((name) => {
                  const grounded = name in TABLE_INDEX;
                  return `<span class="citation-chip ${grounded ? "grounded" : "ungrounded"} mono">${name}</span>`;
                })
                .join("");
              return `
              <div class="faq-card">
                <p class="faq-q">${escapeHtml(card.q)}</p>
                <p class="faq-a">${escapeHtml(card.a)}</p>
                <div class="citation-row">${chips}</div>
              </div>`;
            })
            .join("")}
        </div>
      </div>`
    ).join("");
  }

  /* ============================ Boot ============================ */
  // Inner-tab switching is handled generically, per .app-window, by app-tabs.js.

  initBrowse();
  initAsk();
  initFaq();
})();
