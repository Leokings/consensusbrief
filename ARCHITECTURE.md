# ConsensusBrief architecture

## Responsibility boundary

- The browser owns wallet connection, input validation, transaction submission,
  progress display, and local drafts.
- The GenLayer contract owns source-grounded generation, validator review,
  deterministic length checks, creator attribution, and the persistent canonical
  brief record.
- Postgres indexes accepted contract records for wallet-verified archives,
  public share pages, and document exports. It never creates or edits consensus
  content.

## Flow

1. The user supplies 50–5,000 words and selects a 200, 400, 600, or 1,000-word
   output.
2. The browser submits `create_brief` to hosted StudioNet.
3. The leader generates a structured brief. If it misses the selected word
   range, the contract requests up to two focused revisions; an overlong final
   draft is deterministically capped while preserving every section.
4. Validators independently compare the resulting brief with the submitted
   source and vote on faithfulness. Deterministic contract code validates the
   result shape and word range before storing it.
5. After acceptance, the server reads the record and transaction from StudioNet,
   verifies creator, recipient, method and execution, then indexes the exact
   on-chain record in Postgres.
6. `/b/{brief-id}` renders a public share page. Export routes generate TXT, PDF,
   or DOCX from the indexed canonical record.
7. The in-app archive requires a wallet signature and queries only records whose
   creator matches that verified wallet.
8. Archive, share, and export reads are also scoped to the configured contract,
   so records from retired deployments are not exposed by the active app.

## Privacy

Source material and generated results are public on StudioNet. Product
documentation must not imply that submitted material is private.
