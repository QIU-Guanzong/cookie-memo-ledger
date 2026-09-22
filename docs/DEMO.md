# Honest local demo script

This script demonstrates the public Cookie Memo Ledger page without making a wallet connection, requesting a signature, or sending a transaction.

## Setup

- Run `pnpm install --frozen-lockfile` and `pnpm dev`.
- Open the local Vite URL in a browser.
- Keep all wallets disconnected for the recording.

## Suggested narration

1. “This is Cookie Memo Ledger, a public read-first Cookie Chain cApp. It has not connected a wallet, submitted, or sent anything in this recording.”
2. “The first card reads `getHealth` and a confirmed slot from the community RPC separately. If one call fails, the UI marks the result as partial instead of reporting healthy.”
3. “The wallet card begins in `Wallet-disconnected`. The app detects Nightly without calling it. Only the Connect Nightly button could open a wallet-controlled connection request.”
4. “The transaction gate makes the state sequence visible: wallet-disconnected, transaction-ready, pending-signature, confirmed, or failed.”
5. “No transaction exists in this demo. A connected owner could enter a concise non-sensitive note, prepare an unsigned Memo v1 transaction in memory, then explicitly request a wallet signature. That last decision stays with the wallet holder.”
6. “The README and human-only checklist state the limitations, fee warning, and independent Cookiescan verification requirement.”

## Do not claim

- Do not claim that a wallet connected unless the wallet owner approved it.
- Do not claim a transaction exists, was signed, or was confirmed in this disconnected demo.
- Do not claim a deployment, submission, award, payment, or user adoption.
