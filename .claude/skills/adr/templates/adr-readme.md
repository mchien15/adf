# Architecture Decision Records

Each file here records **one decision**, why it was made, and what was rejected along the way.

`system-architecture.md` describes what the system *is*. These records describe *why it turned out that way* — the constraint that ruled out the obvious alternative, the trade-off someone accepted on purpose. That reasoning is invisible in the code, and it is the first thing lost when people rotate off a project.

## File naming

```
NNNN-YYMMDD-kebab-title.md

0007-260730-choose-postgres-over-mongodb.md
│    │      └── short slug, lowercase, hyphens
│    └── date the decision was made (YYMMDD)
└── sequence number, zero-padded to 4
```

Refer to a record in prose as **ADR-0007**.

`_template.md` and `README.md` are not records — leave them out of any count or listing.

## Numbering, and why the date is in the file name

The next number is "highest existing + 1". That is fine on one branch and unreliable across several: two branches created in the same week both see `0006` as the highest and both write `0007`. The clash only surfaces at merge.

Number-only naming makes this **silent** — two `0007-*.md` files sort next to each other and look deliberate. With the date in the name the collision is legible at a glance:

```
0007-260730-choose-postgres-over-mongodb.md
0007-260802-adopt-feature-flags.md          ← same number, different day. Collision.
```

This is a real failure mode, not a hypothetical: an audit of one 22-record repo using number-only naming found **four colliding pairs**, plus one slug duplicated across two numbers from a half-finished renumber. Nobody had noticed.

### Resolving a collision

1. Keep the **earlier** date at its number.
2. Renumber the later one to the next free number.
3. Rename the file, update the `# ADR-NNNN:` heading inside it, and grep for inbound references:
   ```bash
   grep -rn "ADR-0007" .
   ```
4. Never renumber a record that others already reference. If it is already cited widely, leave the number alone and note the clash in both files.

## Status lifecycle

| Status | Meaning |
|---|---|
| 🟡 Proposed | Written down, not ratified. **Default for a new record.** |
| 🟢 Accepted | In force. Only a person moves a record into this state. |
| 🔴 Deprecated | No longer applies, and nothing replaced it |
| ⚪ Superseded by ADR-XXXX | Replaced. Link the replacement |

**Records are append-only in spirit.** Superseding one means writing a new record and flipping the old one to ⚪ — never rewriting history in place. A record that was wrong is still evidence of what was believed at the time, and that is often the useful part.

## Adding a record

Copy `_template.md`, or run `/adr "<decision title>"` if you use ADF.

Two things carry most of the value:

- **Alternatives considered**, including the `Why not` column. An alternative listed without a stated reason for rejection is the thing most likely to be re-proposed next quarter.
- **Negative consequences.** A record with only upsides reads as advocacy, and future readers discount the whole thing.
