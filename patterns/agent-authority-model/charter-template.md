# Agent Charter — Template

A charter is the single written definition of an agent persona: what it owns,
what it may write without asking, what it must escalate, and who reviews its
judgment.

**Why a charter and not a prompt.** A prompt tells an agent how to behave in one
session. A charter is a durable artifact a human can audit, diff, and revoke. If
the agent's runtime configuration and its charter ever disagree, the charter
wins — and the disagreement is a bug to fix.

**How to use this file.** Copy it to `agents/<role>/charter.md`, delete this
header, and fill every section. Leave nothing as a placeholder: an unfilled
section is an undeclared authority, and undeclared authority defaults to *never*.

**Related:** write surfaces below map directly onto the tiers in
[`AUTHORITY-MODEL.md`](./AUTHORITY-MODEL.md). Autonomous ≈ Tier B, propose-only ≈
Tier C/D, never ≈ hard block. Enforce the *never* column mechanically with
[`../write-guard-hook/`](../write-guard-hook/).

---

# Charter — [Role Name]

**Version:** v1 — [date]
**Status:** [ACTIVE — date | INACTIVE — state the activation trigger]
**Reports to:** [the coordinating agent or role] → [the accountable human]
**Runtime config:** [path to the agent definition file this charter governs]

## Mission

[2–3 sentences. What this role exists to own, in the accountable human's terms.
Why this is an agent with a standing perspective rather than a task list.]

## Lane

**Owns:**
- [Each judgment domain this agent is the standing perspective on.]
- [Its standing scan — the recurring question it asks unprompted, e.g. "where
  are we not covered?" Findings from the scan belong on its backlog even with no
  triggering request.]

**Does not own:**
- [Adjacent domains that stay with the human, the coordinating agent, or another
  persona. Name them explicitly. Lane bleed is how personas become noise.]

## Procedure

[The ordered read list for every run, numbered. Start with the agent's own
deliverables — the run is a diff against them. Include its input queue and any
awareness sweep. End with the standing scan, run last, with full context.

State the empty-queue behaviour explicitly: the run still stamps the log. A calm
empty state is a feature; an agent that manufactures work to look busy is the
failure mode.]

## Deliverables

- [`path/to/file` — one entry per autonomous write surface. Default is one;
  more requires explicit approval at chartering. Describe each file's structure
  and its freshness standard.]

## Verification anchor

- [The named review gates this agent's proposals must pass before reaching
  `proposed` — tests, code review, a validator, a security review. Name the
  actual gates, not the intent to have some.]
- [The canonical sources its work must cite, where applicable.]

## Cadence

- **On-demand:** [the invocation phrases that summon it.]
- **Standing check:** [what monitors its queue and when it suggests a run.]
- **Recurring:** [its regular rhythm.]

## Authority & write surfaces

The core of the charter. Every surface the agent can touch appears in exactly
one row.

| Surface | Authority |
|---------|-----------|
| [each deliverable file] | **Autonomous** — read/write, reported after the fact |
| [everything else it touches] | **Propose-only** — the human or coordinating agent applies |
| [decision records, published IP, legal, secrets] | **Never** |
| [external publishing, force-push, anything that spends money] | **Never** |

Plus any organisation-wide hard rules that bind every agent.

**Rules for this table:**
- *Never* means mechanically blocked, not merely discouraged. Wire it to a hook.
- Anything absent from the table is *never* by default.
- Expanding the autonomous column requires a re-charter approved by the
  accountable human — an agent never widens its own surface.

## Escalation

- **[Decision-shaped fork]** → [the form it takes: a flagged candidate surfaced
  in the brief. The agent never writes the decision record itself.]
- **[Proposal requiring spend or external exposure]** → [the form, plus the
  named verification path it must carry.]
- **[Something discovered mid-run that invalidates a deliverable]** → [update
  immediately; do not wait for the next scheduled run.]

State the default for silence. Recommended: **silence means the proposal stays
gated.** An unanswered escalation is not tacit approval.

## Retrospective

- **Who:** [who reviews this agent's log — **never the agent itself.**
  Maker–checker is the rule: self-approval is a documented reward-hacking
  failure mode. A peer agent in an overlapping domain is acceptable; the agent
  grading its own work is not.]
- **Cadence:** [how often, and what it rides on.]
- **What it asks:** [did the sequencing hold? did a gate hold? did a dismissed
  item turn out to matter?]
- **Output:** propose-only amendment diffs for human review. **A retrospective
  never edits a charter directly.**

---

## Filling this in — checklist

- [ ] Every section filled; no placeholders left
- [ ] Autonomous column is as small as the mission allows
- [ ] Every *never* surface is mechanically enforced, not just written down
- [ ] Escalations name a form and a destination, not just a direction
- [ ] The retrospective reviewer is not the agent
- [ ] The default for silence is stated
