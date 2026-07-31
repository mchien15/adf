# Nygard ADR Format — Section Spec

Michael Nygard's format, as ADF writes it. One decision per record.

| Section | Required | Fails when |
|---|---|---|
| Title + status line | ✅ | Status set to Accepted without a person saying so |
| Metadata (Date, Deciders) | ✅ | Deciders left as a placeholder |
| Context | ✅ | Describes the solution instead of the problem |
| Decision | ✅ | Hedged — "we may consider" |
| Alternatives considered | ✅ | Missing, or `Why not` left blank |
| Consequences | ✅ | Only positives listed |
| Implementation notes | ⬜ | — |
| Related | ⬜ | — |

## Title and status

```markdown
# ADR-0007: Choose Postgres over MongoDB for the primary store

🟡 Proposed
```

Title states the decision, not the topic. "Choose Postgres over MongoDB" — not "Database selection". A reader scanning the directory should learn what was decided without opening anything.

Exactly one status emoji on its own line. See the lifecycle table in [`../templates/adr-readme.md`](../templates/adr-readme.md).

## Metadata

```markdown
- **Date**: 2026-07-30
- **Deciders**: platform team, @alice
```

`Date` is the day the decision was made, which is also the `YYMMDD` in the file name. **Deciders** is who is accountable — leaving it as a placeholder makes the record unusable when someone later needs to ask why.

## Context

Two to four paragraphs. What forced a decision, what constrained it, which forces conflicted.

The test: **would this paragraph still make sense to someone with none of today's context?** Write down the things that feel too obvious to write down — the deadline, the team's existing skill set, the vendor contract expiring. Those are exactly what evaporates.

Describe the problem, not the answer. If the Context reads like an argument for the Decision, it is being written backwards, and the record loses its ability to show that alternatives were genuinely weighed.

## Decision

One or two paragraphs, prescriptive. "We will use X for Y." Present tense, active, no hedging. If the decision has conditions or a scope limit ("for new services only"), state them here — an unqualified decision gets applied where nobody intended.

## Alternatives considered

```markdown
| Option | Pros | Cons | Why not |
|---|---|---|---|
| MongoDB | Flexible schema, team has used it | Weak multi-document transactions | Billing needs cross-row atomicity |
| Postgres (chosen) | Transactions, JSONB covers the flexible parts | Schema migrations need process | — |
| Do nothing (SQLite) | Zero ops | Single-writer | Blocks the concurrency target for Q4 |
```

**The `Why not` column is mandatory.** It is the single highest-value cell in the record. An alternative listed with pros and cons but no stated rejection reason will be re-proposed, and the re-proposal will look reasonable because nothing on the page rules it out.

List at least two real alternatives. "Do nothing" / "keep the status quo" counts and is frequently the one worth documenting. Mark the chosen option and put `—` in its `Why not`.

Alternatives invented after the fact to make the decision look considered are worse than none — a future reader who spots one stops trusting the whole record.

## Consequences

Three subsections: **Positive**, **Negative**, **Neutral / trade-off**.

Negative is not optional and must not be padded with fake mild downsides. Every real decision costs something; a record listing only upsides reads as advocacy and gets discounted wholesale. Being specific here is what makes the record trustworthy later:

```markdown
### Negative

- Schema changes now need a migration and a review — slower than a document store
- Nobody on the team has run Postgres at this write volume
```

Neutral covers consequences that are neither good nor bad but that someone will trip over — a new dependency, a changed local-dev setup, a different backup story.

## Implementation notes (optional)

Concrete follow-through: library versions, migration order, files affected, feature flags. Skip when there is nothing specific. Do not restate the Decision here in more words.

## Related (optional)

```markdown
- Supersedes ADR-0003
- Superseded by ADR-0011
- Spec: [payments FSD](../project-fsd.md)
- External: [Postgres JSONB docs](https://www.postgresql.org/docs/current/datatype-json.html)
```

When one record supersedes another, **edit both**: the new one links back, the old one flips to ⚪ and points forward. A one-way link leaves a live-looking record that has quietly been overruled.

## Scope: one decision per record

Two decisions in one record cannot be superseded independently. When the second one is later reversed, the whole record has to be marked ⚪ — including the part that is still in force. Split them.

## What does not belong in a record

- Status changed to 🟢 Accepted by an agent — ratification is a human act
- Secrets, credentials, tokens, internal hostnames. Describe the constraint, do not paste the value
- Tool-specific front-matter (`sidebar_position`, `_category_.json`, draft flags) — the record must stay portable across docs tooling
- A running work log. Decisions belong here; progress belongs in the plan's Decision Log
