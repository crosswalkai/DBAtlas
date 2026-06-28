# Writing DBAtlas narrative_hint Text

The `narrative_hint` field in each mock data file is the single biggest lever on demo quality. It is injected into the AI's checkpoint evaluation prompt as a clearly-labeled demo-context block. The AI treats it as expert framing (not as raw database evidence) and uses it to produce a coherent, impressive diagnosis. Weak hints produce vague analysis; strong hints produce the "wow" moment.

In production with real database connections, the field is absent and the injected block is omitted entirely — so writing rich hints for the demo costs nothing later.

---

## 1. Structure of a Strong narrative_hint
A strong hint tells the story the data is meant to reveal, points at the specific row or value that matters, and names the next logical move — written the way a senior DBA would think out loud.

* **Name the Smoking Gun**: Identify the specific row/value that is key ("Query 2841 is the critical regression").
* **Quantify Severity**: Express the impact in concrete terms ("48ms to 4,820ms, a 100x degradation").
* **Anchor to a Plausible Cause & Time**: ("right after the nightly maintenance window at 02:00").
* **Connect to Related Evidence**: ("queries 1204 and 3102 regressed at the same time, all in SalesDB, suggesting a shared-table statistics update").
* **Suggest the Next Step**: ("Claude should identify 2841 as the primary regression and proceed to plan comparison").

---

## 2. Common Pitfalls to Avoid
* **Vague Summaries** (e.g. "there are some slow queries here") — gives the AI nothing specific to analyze.
* **Restating Columns** (e.g. "this shows query_id, duration, and database") — the AI already understands the schema; it needs help with interpretation.
* **Over-determining the Final Answer Early** — let the diagnosis build across steps. The entry-step hint should point forward; the final-step hint can state the root cause plainly.
* **Contradicting Row Values** — the hint should interpret the rows, not contradict them or invent values that are not present.

---

## 3. Pattern: Escalate Across Steps
Author the hints so the story builds:
* **Entry step** — establish the signal and point forward. "X is the standout; proceed to confirm Y."
* **Middle steps** — deepen the evidence. "This confirms the suspicion from the previous step: Z."
* **Final step** — state the root cause and the fix. "Root cause confirmed: W. The remedy is V."

---

## 4. Worked Example (from sqlserver-plan-regression)
> "Query 2841 is the critical regression — it went from 48ms to 4,820ms average (100x degradation) starting at 02:14 on June 21, right after the nightly maintenance window. This is a catastrophic plan regression. The timestamp aligns precisely with the nightly auto-update statistics job which runs at 02:00. Queries 1204 and 3102 also regressed at the same time, all in SalesDB, strongly suggesting a statistics update on a shared table triggered plan changes across multiple queries. Claude should identify query 2841 as the primary regression and proceed to plan comparison."
