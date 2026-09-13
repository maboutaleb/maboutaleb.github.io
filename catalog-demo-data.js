/**
 * SYNTHETIC sample data for the "AI-enabled catalog" demo on the home page.
 *
 * Every table name, column, number, user handle, and summary below is invented
 * for this demo. None of it is real Choice Hotels data. The STRUCTURE, however,
 * mirrors the real catalog.json emitted by claude-make-a-thon exactly:
 *   - stats.{query_count, distinct_users, total_executions}
 *   - top_columns.{selected, filtered, joined}
 *   - summary.{purpose, who_uses_it, when_to_use}
 *   - cooccurs_with[]
 *   - top_users[]        (obviously-fake handles)
 *   - examples[]         (representative SQL, as the real aggregate step emits)
 *
 * The query_count values are deliberately given the same heavy skew observed in
 * the real run — one dominant table, a couple of mid-volume tables, and a long
 * low-volume tail (real run: top table 5,640; median table just 1). That skew is
 * what makes the volume-weighting term in confidence_score() actually matter.
 */
const CATALOG_DEMO_TABLES = [
  {
    full_name: "sample_wh.revenue_daily_summary",
    domain: "Revenue Management",
    stats: { query_count: 5200, distinct_users: 46, total_executions: 90400 },
    top_columns: {
      selected: ["property_id", "stay_date", "total_revenue", "adr", "revpar"],
      filtered: ["property_id", "stay_date"],
      joined: ["property_id"],
    },
    cooccurs_with: ["sample_wh.property_dim"],
    top_users: ["rev_analyst_a", "finance_bi_svc", "rm_dashboard"],
    examples: [
      "SELECT property_id, stay_date, total_revenue, adr, revpar\nFROM sample_wh.revenue_daily_summary\nWHERE stay_date >= current_date - 30\nORDER BY total_revenue DESC;",
    ],
    summary: {
      purpose: "Daily property-level revenue, ADR, and RevPAR aggregates.",
      who_uses_it: "Revenue managers and finance analysts.",
      when_to_use: "Property revenue, ADR, and RevPAR reporting by day.",
    },
  },
  {
    full_name: "sample_wh.reservations_fact",
    domain: "Bookings & Reservations",
    stats: { query_count: 890, distinct_users: 31, total_executions: 14200 },
    top_columns: {
      selected: ["reservation_id", "property_id", "arrival_date", "departure_date", "room_nights"],
      filtered: ["property_id", "arrival_date"],
      joined: ["property_id", "channel_code"],
    },
    cooccurs_with: ["sample_wh.property_dim", "sample_wh.booking_channel_lookup"],
    top_users: ["demand_analyst_b", "booking_pace_svc"],
    examples: [
      "SELECT property_id, arrival_date, sum(room_nights) AS room_nights\nFROM sample_wh.reservations_fact\nWHERE arrival_date BETWEEN '2026-01-01' AND '2026-01-31'\nGROUP BY property_id, arrival_date;",
    ],
    summary: {
      purpose: "One row per reservation: dates, room nights, and booked value.",
      who_uses_it: "Booking and demand analysts.",
      when_to_use: "Reservation-level booking pace and room-night analysis.",
    },
  },
  {
    full_name: "sample_wh.property_dim",
    domain: "Hotel & Properties",
    stats: { query_count: 640, distinct_users: 52, total_executions: 11800 },
    top_columns: {
      selected: ["property_id", "brand_name", "region", "room_count"],
      filtered: ["property_id", "region"],
      joined: ["property_id"],
    },
    cooccurs_with: ["sample_wh.revenue_daily_summary", "sample_wh.reservations_fact"],
    top_users: ["rev_analyst_a", "demand_analyst_b", "exec_reporting"],
    examples: [
      "SELECT p.brand_name, p.region, sum(r.total_revenue) AS revenue\nFROM sample_wh.revenue_daily_summary r\nJOIN sample_wh.property_dim p USING (property_id)\nGROUP BY p.brand_name, p.region;",
    ],
    summary: {
      purpose: "One row per property: brand, region, and room count.",
      who_uses_it: "Nearly every analyst, as a dimension join.",
      when_to_use: "Adding brand or region context to any fact table.",
    },
  },
  {
    full_name: "sample_wh.rate_shopping_daily",
    domain: "Competitive Rates",
    stats: { query_count: 120, distinct_users: 14, total_executions: 3400 },
    top_columns: {
      selected: ["property_id", "competitor_name", "shop_date", "competitor_rate"],
      filtered: ["property_id", "shop_date"],
      joined: ["property_id"],
    },
    cooccurs_with: ["sample_wh.property_dim"],
    top_users: ["pricing_analyst_c", "comp_set_svc"],
    examples: [
      "SELECT competitor_name, shop_date, competitor_rate\nFROM sample_wh.rate_shopping_daily\nWHERE property_id = :property_id\nORDER BY shop_date DESC;",
    ],
    summary: {
      purpose: "Daily competitor rate shops per property.",
      who_uses_it: "Competitive-pricing analysts.",
      when_to_use: "Comparing a property's rate to its comp set.",
    },
  },
  {
    full_name: "sample_wh.loyalty_accounts",
    domain: "Customer & Loyalty",
    stats: { query_count: 44, distinct_users: 9, total_executions: 810 },
    top_columns: {
      selected: ["member_id", "tier", "enrollment_date", "points_balance"],
      filtered: ["member_id", "tier"],
      joined: ["member_id"],
    },
    cooccurs_with: [],
    top_users: ["loyalty_analyst_d"],
    examples: [
      "SELECT tier, count(*) AS members, avg(points_balance) AS avg_points\nFROM sample_wh.loyalty_accounts\nGROUP BY tier\nORDER BY members DESC;",
    ],
    summary: {
      purpose: "One row per loyalty member: tier and points balance.",
      who_uses_it: "Loyalty-program analysts.",
      when_to_use: "Member-level tier and points reporting.",
    },
  },
  {
    full_name: "sample_wh.guest_satisfaction_survey",
    domain: "Property Performance",
    stats: { query_count: 12, distinct_users: 5, total_executions: 190 },
    top_columns: {
      selected: ["survey_id", "property_id", "response_date", "nps_score"],
      filtered: ["property_id", "response_date"],
      joined: ["property_id"],
    },
    cooccurs_with: ["sample_wh.property_dim"],
    top_users: ["guest_xp_analyst_e"],
    examples: [
      "SELECT property_id, avg(nps_score) AS avg_nps\nFROM sample_wh.guest_satisfaction_survey\nWHERE response_date >= current_date - 90\nGROUP BY property_id;",
    ],
    summary: {
      purpose: "Guest survey responses and NPS score per property.",
      who_uses_it: "Guest-experience analysts.",
      when_to_use: "Tracking NPS and survey response trends by property.",
    },
  },
  {
    full_name: "sample_wh.booking_channel_lookup",
    domain: "Reference & Lookup",
    stats: { query_count: 6, distinct_users: 4, total_executions: 60 },
    top_columns: {
      selected: ["channel_code", "channel_name", "channel_type"],
      filtered: ["channel_code"],
      joined: ["channel_code"],
    },
    cooccurs_with: ["sample_wh.reservations_fact"],
    top_users: ["demand_analyst_b"],
    examples: [
      "SELECT c.channel_name, count(*) AS reservations\nFROM sample_wh.reservations_fact r\nJOIN sample_wh.booking_channel_lookup c USING (channel_code)\nGROUP BY c.channel_name;",
    ],
    summary: {
      purpose: "Reference table mapping booking channel codes to names.",
      who_uses_it: "Analysts decoding channel codes on reservations.",
      when_to_use: "Labeling reservation channel codes with readable names.",
    },
  },
  {
    full_name: "sample_wh.currency_exchange_rates",
    domain: "Reference & Lookup",
    stats: { query_count: 3, distinct_users: 2, total_executions: 28 },
    top_columns: {
      selected: ["currency_code", "rate_to_usd", "effective_date"],
      filtered: ["currency_code", "effective_date"],
      joined: ["currency_code"],
    },
    cooccurs_with: [],
    top_users: ["finance_bi_svc"],
    examples: [
      "SELECT currency_code, rate_to_usd\nFROM sample_wh.currency_exchange_rates\nWHERE effective_date = current_date;",
    ],
    summary: {
      purpose: "Daily currency exchange rates to USD.",
      who_uses_it: "Analysts normalizing multi-currency revenue.",
      when_to_use: "Converting non-USD revenue to a common currency.",
    },
  },
];

/**
 * FAQ cards, grouped by domain — mirrors the real app's Home tab, which renders
 * the LLM-generated FAQ cards (5 per domain in the real run). Kept SYNTHETIC.
 *
 * Every `tables_cited` entry resolves to a real table in CATALOG_DEMO_TABLES —
 * i.e. 0 ungrounded citations, matching the real run's 0-of-61 result. The demo
 * renderer verifies this against the catalog index and flags any that don't.
 */
const CATALOG_DEMO_FAQ = [
  {
    domain: "Revenue Management",
    cards: [
      {
        q: "Where do I find daily revenue, ADR, and RevPAR by property?",
        a: "sample_wh.revenue_daily_summary holds one row per property per day with total_revenue, adr, and revpar. Join to sample_wh.property_dim for brand and region.",
        tables_cited: ["sample_wh.revenue_daily_summary", "sample_wh.property_dim"],
      },
      {
        q: "How do I roll daily revenue up to brand or region?",
        a: "Join sample_wh.revenue_daily_summary to sample_wh.property_dim on property_id, then group by brand_name or region.",
        tables_cited: ["sample_wh.revenue_daily_summary", "sample_wh.property_dim"],
      },
    ],
  },
  {
    domain: "Bookings & Reservations",
    cards: [
      {
        q: "Which table has reservation-level room nights and booking dates?",
        a: "sample_wh.reservations_fact is one row per reservation with arrival_date, departure_date, and room_nights — the base for booking-pace analysis.",
        tables_cited: ["sample_wh.reservations_fact"],
      },
      {
        q: "How do I label the booking channel on a reservation?",
        a: "Join sample_wh.reservations_fact to sample_wh.booking_channel_lookup on channel_code to turn codes into readable channel names.",
        tables_cited: ["sample_wh.reservations_fact", "sample_wh.booking_channel_lookup"],
      },
    ],
  },
  {
    domain: "Hotel & Properties",
    cards: [
      {
        q: "What's the canonical property dimension?",
        a: "sample_wh.property_dim — one row per property with brand_name, region, and room_count. It's the join key (property_id) for nearly every fact table.",
        tables_cited: ["sample_wh.property_dim"],
      },
    ],
  },
  {
    domain: "Competitive Rates",
    cards: [
      {
        q: "Where are competitor rate shops stored?",
        a: "sample_wh.rate_shopping_daily has daily competitor_rate by property and competitor_name — used to compare a property against its comp set.",
        tables_cited: ["sample_wh.rate_shopping_daily"],
      },
    ],
  },
  {
    domain: "Customer & Loyalty",
    cards: [
      {
        q: "How do I get the loyalty tier distribution?",
        a: "Aggregate sample_wh.loyalty_accounts by tier (count of member_id). This is a low-traffic table, so grounded answers about it land at Medium confidence.",
        tables_cited: ["sample_wh.loyalty_accounts"],
      },
    ],
  },
  {
    domain: "Property Performance",
    cards: [
      {
        q: "Where is guest satisfaction / NPS tracked?",
        a: "sample_wh.guest_satisfaction_survey holds survey responses with nps_score per property and response_date.",
        tables_cited: ["sample_wh.guest_satisfaction_survey"],
      },
    ],
  },
  {
    domain: "Reference & Lookup",
    cards: [
      {
        q: "How do I convert non-USD revenue to USD?",
        a: "sample_wh.currency_exchange_rates gives rate_to_usd by currency_code and effective_date. Join on currency_code and multiply.",
        tables_cited: ["sample_wh.currency_exchange_rates"],
      },
      {
        q: "What do the booking channel codes mean?",
        a: "sample_wh.booking_channel_lookup maps channel_code to channel_name and channel_type.",
        tables_cited: ["sample_wh.booking_channel_lookup"],
      },
    ],
  },
];

/**
 * Answer text is pre-written (a static site can't safely make a live LLM call).
 * Retrieval ranking and the confidence badge shown next to each answer are computed
 * live from these citations using the real algorithm ported in demo-catalog.js.
 *
 * The four examples are chosen to show the confidence tiers that ACTUALLY occur in
 * the real app, plus one clearly-labeled guardrail stress-test:
 *
 *   1. High   — cites the dominant, heavily-queried table(s): grounded AND high volume.
 *   2. Medium — cites a correct but rarely-queried table: fully grounded, near-zero volume.
 *   3. Low    — question isn't covered by the catalog, so the model cites nothing
 *               (<cites></cites>). This is the honest-refusal path the system prompt
 *               explicitly instructs, and the tier that genuinely fires in real use.
 *   4. Low (guardrail) — a CONSTRUCTED example where the model names a table that isn't
 *               in the catalog. In the real run 0 of 61 FAQ citations were ungrounded, so
 *               this branch never actually fired — it's shown to prove the scorer catches
 *               an invented citation rather than trusting it.
 */
const CATALOG_DEMO_QA = [
  {
    question: "Which table has property-level daily revenue metrics?",
    keywords: ["revenue", "adr", "revpar", "daily revenue"],
    tier: "High",
    answer:
      "Property-level daily revenue, ADR, and RevPAR are tracked in sample_wh.revenue_daily_summary, " +
      "joined to sample_wh.property_dim for brand and region context. It's the single most-queried " +
      "table in this warehouse, so an answer grounded in it scores high on both citation grounding and " +
      "query-volume coverage.",
    citations: ["sample_wh.revenue_daily_summary", "sample_wh.property_dim"],
  },
  {
    question: "Which table has currency exchange rates?",
    keywords: ["currency", "exchange rate", "fx rate"],
    tier: "Medium",
    answer:
      "Daily currency exchange rates to USD are in sample_wh.currency_exchange_rates. The citation is " +
      "fully grounded (the table really exists), but it's one of the least-queried tables in the " +
      "warehouse — so the volume-coverage term stays near zero and the answer lands at Medium rather " +
      "than High. Correct, but low-traffic.",
    citations: ["sample_wh.currency_exchange_rates"],
  },
  {
    question: "Which table stores guest credit-card numbers?",
    keywords: ["credit card", "credit-card", "payment", "card number"],
    tier: "Low",
    answer:
      "Nothing in this catalog stores payment or credit-card data. Retrieval surfaces " +
      "sample_wh.guest_satisfaction_survey because it shares the word \"guest,\" but it holds NPS survey " +
      "responses, not payment details. Since the catalog doesn't cover the question, the honest answer " +
      "cites no tables (<cites></cites>) — which the scorer reads as Low confidence, i.e. \"not answerable " +
      "from warehouse evidence.\"",
    citations: [],
  },
  {
    question: "What's our loyalty member tier distribution?",
    keywords: ["loyalty", "tier distribution", "member tier"],
    tier: "Low",
    guardrail: true,
    answer:
      "Loyalty tier distribution would come from sample_wh.loyalty_tier_summary, aggregating member " +
      "counts by tier.",
    // GUARDRAIL STRESS-TEST (constructed, did not occur in the real run — 0/61 citations
    // were ungrounded there). The real table is sample_wh.loyalty_accounts; this answer
    // deliberately cites a table that is NOT in the catalog so you can see the confidence
    // scorer catch the invented citation and drop the answer to Low instead of trusting it.
    citations: ["sample_wh.loyalty_tier_summary"],
  },
];
