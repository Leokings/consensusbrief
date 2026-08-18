# ConsensusBrief StudioNet deployment evidence

Date: 2026-08-18  
Network: GenLayer StudioNet (chain ID `61999`)  
Validator mode: full consensus (`leader_only: false`)

## Fresh deployment

- Contract: [`0xC4BDAb7644538207e7b779CaaeBC1B1C0CBaaA8B`](https://explorer-studio.genlayer.com/address/0xC4BDAb7644538207e7b779CaaeBC1B1C0CBaaA8B)
- Deployment transaction: [`0xf8a5b4f27411cb4e89702743f4440126cb8cd4bb15d1365724af12dd2627b36b`](https://explorer-studio.genlayer.com/tx/0xf8a5b4f27411cb4e89702743f4440126cb8cd4bb15d1365724af12dd2627b36b)
- Deployment reached `FINALIZED` in 46.52 seconds.
- The deployment receipt passed `tx_execution_succeeded` before any contract
  reads were accepted as evidence.

## Full-consensus smoke test

- Brief ID: `studionet-5000-20260818`
- Source: [RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.txt)
- Submitted source: exactly 5,000 words
- Target: 1,000 words (accepted range: 800–1,000)
- Stored result: 945 words
- Title: `HTTP semantics consensus brief`
- Creation transaction: [`0x97a9fede679d716956910b7d23101eefe17c68cac74879c9231e6737ad922ac3`](https://explorer-studio.genlayer.com/tx/0x97a9fede679d716956910b7d23101eefe17c68cac74879c9231e6737ad922ac3)
- Creation reached `FINALIZED` in 130.52 seconds.

The test read the record back from the new contract and verified the exact
source, stored source word count, selected target, generated word bounds,
creator index, and contract configuration. Result: `1 passed in 191.59s`.

## Source checks

- `genvm-lint check`: passed lint and SDK validation for the deployed source.
- Direct contract suite: 6 passed in 0.26 seconds.

## Reproduce

```powershell
C:\Users\user\Documents\Codex\mage-world\.venv\Scripts\python.exe -m pytest tests\integration\test_consensus_brief_studionet.py -vv -s
```
