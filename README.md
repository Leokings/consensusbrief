# ConsensusBrief

ConsensusBrief turns 50–5,000 words of public source material into a neutral,
structured brief reviewed by GenLayer validators. Users can choose a 200, 400,
600, or 1,000-word output, share the accepted result, and export it as PDF,
DOCX, or TXT.

## Live contract

- App: [consensusbrief.vercel.app](https://consensusbrief.vercel.app)
- Network: GenLayer StudioNet (chain ID `61999`)
- Contract: [`0xC4BDAb7644538207e7b779CaaeBC1B1C0CBaaA8B`](https://explorer-studio.genlayer.com/address/0xC4BDAb7644538207e7b779CaaeBC1B1C0CBaaA8B)
- RPC: `https://studio.genlayer.com/api`
- [5,000-word StudioNet smoke-test evidence](evidence/studionet-5000-brief-2026-08-18.md)

The source and generated brief are public on StudioNet. Do not submit
confidential information.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Replace `DATABASE_URL` with a Neon Postgres connection string.
3. Install dependencies with `npm install`.
4. Apply the checked-in migration with `npm run db:migrate`.
5. Run `npm run dev`.

The app can create on-chain briefs without Postgres. Postgres is required for
permanent public share pages, wallet-verified personal archives, and server-side
exports. Only accepted, independently re-read contract records are indexed.

## Verification

```powershell
npm run lint
npm run typecheck
npm run build
C:\Users\user\Documents\Codex\mage-world\.venv\Scripts\python.exe -m pytest tests\direct\test_consensus_brief.py -v
C:\Users\user\Documents\Codex\mage-world\.venv\Scripts\genvm-lint.exe check contracts\consensus_brief.py --json
```

Run the hosted full-consensus smoke test with:

```powershell
C:\Users\user\Documents\Codex\mage-world\.venv\Scripts\python.exe -m pytest tests\integration\test_consensus_brief_studionet.py -vv -s
```
