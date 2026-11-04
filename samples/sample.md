# Ajaia Docs: Import Pipeline Brief

## Problem

Customers arrive with work already written somewhere else — a Word file from
legal, a Markdown export from their old wiki, a scratch `.txt` of meeting
notes. Today they **retype it**, and most of them simply don't bother.

## What we are building

A single upload control on the documents list that accepts `.txt`, `.md` and
`.docx` up to 1 MB and lands the result in the editor as a *real* document,
not a blob of pasted HTML.

### Must-haves

- Headings, **bold** and *italic* survive the round trip
- Bulleted and numbered lists survive the round trip
- Nothing executable survives: scripts, event handlers and unknown tags are
  discarded by the schema, not by a regex
- A sensible title is inferred — the first `# H1` when there is one, otherwise
  the filename

### Rollout

1. Ship the converter behind the existing upload button
2. Watch the `PARSE_FAILED` rate for a week
3. Raise the size cap only once real `.docx` files stop surprising us

## Out of scope

Images, tables, footnotes and comments. They round-trip badly and would hold
the rest of this release hostage.
