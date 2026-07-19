# Agent Authority Model

**Version:** v0.1
**Status:** Published for use and adaptation
**License:** MIT

A four-tier model for grading how much autonomy an agent has, based on what the
action actually risks — rather than applying one approval gate to everything.

---

## The problem this solves

Most teams that put agents into real work converge on a single autonomy tier:
*propose-only*. Every agent, every scheduled job, every skill terminates in a
task for a human. It feels safe. It is the default that no one has to argue for.

It produces a specific failure. The proposal machine is multi-threaded and the
human executor is not. The task inbox only grows. The human starts approving
without reading, because reading every item is no longer possible. At that
point the approval gate has stopped being a control and started being a
formality that also happens to be the bottleneck.

This is documented, not anecdotal:

- **Gartner (2026-05-26)** — applying uniform governance across AI agents,
  regardless of autonomy level and scope, *causes* enterprise agent programmes
  to fail. Gartner predicts that by 2027, 40% of enterprises will demote or
  decommission autonomous AI agents because of governance gaps found only after
  a production incident. On approvals specifically: "approvals can degrade under
  time pressure or approval fatigue, creating a false sense of safety while
  expanding the attack surface." Gartner's recommendation is *proportional*
  governance — classify agents across distinct autonomy levels, each level a
  different trust boundary with its own requirements.
- **Okta, *AI Agents at Work 2026*** — 57% of respondents say the approval
  process is too slow or too difficult. A further 49% say the approved tools do
  not meet their needs. Only 6% cite not knowing approval was required. The
  friction is the design, not the awareness.

An ungraded membrane is not discipline. A routine internal file edit passing
through the same gate as a signed contract is not caution — it is an unfinished
design. This model grades the membrane.

> The question that produced this model: *"Is this really agent workforce
> management if the business only moves forward one prompt at a time?"*

---

## The four tiers

| Tier | Rule | Human involvement |
|------|------|-------------------|
| **A — Act** | The agent acts. No notice beyond its normal work log. | None |
| **B — Act & tell** | The agent acts, then reports what it did in the next brief. Reversible; blast radius stops inside the organisation's own files. | Read one line |
| **C — One action** | The agent prepares to the point where exactly one human action remains. Never authoring, never assembling. | One tap |
| **D — Decide** | The human decides. The agent may research, draft, and recommend, but never acts. | Judgment |

### The default is A. This is the inversion.

Under the single-tier design, the implicit default is D: anything the agent is
unsure about becomes a human task. Uncertainty routes upward, and uncertainty is
cheap to manufacture.

The rule that replaces it:

> **An agent may not file a human task without first testing whether the action
> fits A, B, or C.**

Every task an agent files must carry the reason it could not be executed — a
missing credential, a missing tool, a genuine judgment call, or an explicit Tier D
classification. *"It felt like a human thing"* is not a reason.

### Inbox depth is a failure signal

A growing human task queue is not evidence of thorough grooming. It is the
primary symptom of tier collapse — the measurable form of the Gartner failure
mode. Track it. Treat sustained growth as a defect in tier assignment, and audit
the filed reasons rather than the items.

---

## Assigning tiers

The tiers below are a starting classification. Adapt the contents; keep the
shape.

**Tier A — act, no notice**
- Reads of anything the agent already has access to
- Research, verification, scoring, corpus work
- Drafting of any kind, at any length
- Backlog grooming, sequencing, and roadmap maintenance inside a declared write
  surface
- Queue preparation, staging, scaffolding
- Internal analysis and scoring against published criteria

**Tier B — act, then report**
- Writes inside the agent's own declared write surfaces (see
  [`charter-template.md`](./charter-template.md))
- CRM record writes — creating, updating, and enriching records and notes
- File and folder creation in the organisation's own document store
- Corrections of fact: a stale statistic replaced with a sourced newer one, a
  misquote fixed, a broken link repaired
- Version-control commits on the normal flow
- Anything reversible whose blast radius stops at the organisation's own files

**Tier C — prepare to one action**
- Anything that reaches a named external human for the first time
- Anything published under an individual's personal identity
- Registration, scheduling, or booking that costs money

The single remaining action is **send / publish / approve**. If the human has to
write, assemble, look something up, or choose between two drafts, the agent has
not finished and the item is not Tier C. See
[What an agent owes at Tier C](#what-an-agent-owes-at-tier-c).

**Tier D — the human decides, always**
- Legal instruments, contracts, agreements — anything a lawyer would read
- Pricing, discounts, credits, anything that moves money
- Customer and partner commitments
- **New claims about what the organisation is or has done**
- Anything irreversible or outward-facing that would embarrass the organisation
  if wrong

---

## What an agent owes at Tier C

A Tier C item is not done when a draft exists. It is done when the human can act
without thinking. That means:

1. **The content is final.** Not "a starting point." Not "adjust to taste."
2. **It lives where the action happens** — in the queue file, the document, the
   staged draft — not described in a chat message the human has to copy out of.
3. **Any context needed is one line, above the item, in the human's terms.**
4. **Nothing in it requires looking something up.**

An item that fails any of these is Tier A work the agent left unfinished. This
test is the load-bearing part of the model: without it, "Tier C" degrades into
"propose-only" with a new name.

---

## Adopting the model

1. **Enumerate what your agents currently do.** Every job, skill, and scheduled
   task.
2. **Assign each action a tier.** Argue about the boundaries — the argument is
   the value. Most of the list will land in A and B, which is the point.
3. **Write the tiers into charters, not prompts.** Each agent gets a written
   charter naming its autonomous, propose-only, and never-touch write surfaces.
   Template: [`charter-template.md`](./charter-template.md).
4. **Enforce the never-touch surfaces mechanically.** A charter is a statement of
   intent; a hook is a control. See
   [`../write-guard-hook/`](../write-guard-hook/).
5. **Instrument inbox depth.** If it grows monotonically, the tiering is not
   holding.
6. **Review tier assignments on a fixed cadence, under maker–checker.** No agent
   grades its own tier assignments. Amendments are propose-only.

---

## Boundaries of this model

State these plainly rather than discovering them later.

- **It grades actions, not identity.** It assumes you have already solved
  authentication and authorisation for the agent itself. It is a policy layer on
  top of access control, not a substitute for it.
- **It assumes reversibility is knowable.** Tier B rests on "reversible, internal
  blast radius." Where you cannot answer that confidently, the action is not
  Tier B.
- **It is not a compliance framework.** Regulated actions belong in Tier D and
  in whatever regime already governs them.
- **v0.1 is untested at scale across many organisations.** It was derived from a
  single operator's audit of their own agent estate and reconciled against the
  Gartner and Okta findings above. It is published for adaptation, not as a
  standard.

---

## Change log

| Version | Date | Change |
|---------|------|--------|
| v0.1 | 2026-07-19 | Initial publication. Four tiers defined, default inverted to A, the "may not file a task without testing A/B/C" rule, and inbox depth reclassified as a failure signal. |

---

## Sources

- [Gartner Says Applying Uniform Governance Across AI Agents Will Lead to Enterprise AI Agent Failure](https://www.gartner.com/en/newsroom/press-releases/2026-05-26-gartner-says-applying-uniform-governance-across-ai-agents-will-lead-to-enterprise-ai-agent-failure) — Gartner press release, 2026-05-26
- [AI Agents at Work 2026: Securing the agentic enterprise](https://www.okta.com/newsroom/articles/ai-agents-at-work-2026-agentic-enterprise-security/) — Okta, 2026
