# Cookie Memo Ledger

A small, static-first Cookie Chain memo ledger. It starts with read-only RPC health and confirmed-slot checks, then makes every wallet and transaction transition visible.

Cookie Memo Ledger lets a wallet holder prepare a compact public Memo v1 record after reading the chain state. It is not a bridge, a token transfer tool, or a claim that a transaction has happened.

## Live app

[Open Cookie Memo Ledger](https://qiu-guanzong.github.io/cookie-memo-ledger/). The public page has been checked without a wallet: it performs read-only RPC health and confirmed-slot calls, keeps the wallet disconnected, and disables transaction controls until an account holder acts.

## What it does

- Reads `getHealth` and a **confirmed** `getSlot` independently from the Cookie Chain community RPC.
- Detects Nightly without invoking it. A generic injected wallet is rejected unless it explicitly identifies as Nightly.
- Calls `connect()` only from the visible **Connect Nightly** button.
- Shows the full public address after a successful wallet-controlled connection.
- Presents five explicit states: `wallet-disconnected`, `transaction-ready`, `pending-signature`, `confirmed`, and `failed`.
- Builds an unsigned **Memo v1 transaction** only after the connected wallet holder enters a concise memo and selects **Prepare signing request**.
- Requests signing and sends only when the holder selects **Request signature and send**. The app never handles a private key.

## Deliberate limitations

- No wallet connection is made on page load.
- No transaction is built, signed, sent, or confirmed during install, build, tests, or initial page rendering.
- The project does not create an account, accept terms, collect personal data, bridge assets, deploy a program, or use any funds.
- The signing path can charge a Cookie Chain network fee **only if the wallet holder approves the future wallet prompt and the transaction is sent**. The on-chain content is the exact user-entered Memo v1 note, which becomes public only after that approval.
- The public static page is not a submitted cApp or a completed bounty entry. It does not establish a wallet connection, transaction, review, award, or income.

## Official Cookie Chain inputs

Only current Cookie Chain documentation is used for chain-specific facts:

- [Developer Guide](https://docs.cookiechain.wtf/developer-guide): Cookie Chain is SVM-compatible; standard Solana SDKs work through `https://rpc.cookiescan.io`; the documented commitment example is `confirmed`.
- [Wallets](https://docs.cookiechain.wtf/wallets): Nightly is fully supported and the custom RPC is `https://rpc.cookiescan.io`.
- [For Builders](https://docs.cookiechain.wtf/for-builders): wallet-connected reads, slots, and transaction history are appropriate builder starting points.
- [Ecosystem Programs](https://docs.cookiechain.wtf/ecosystem): Memo v1 is embedded at genesis at `MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr`.

The app uses `@solana/web3.js` because the Developer Guide explicitly identifies standard Solana client SDKs as compatible. It adds no wallet-adapter package and no design/motion library.

## Run locally

This project needs Node.js 20 or newer and pnpm.

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Open the local URL printed by Vite. The RPC read should work without any wallet extension.

For a production-like static build:

```bash
pnpm test
pnpm build
pnpm preview
```

## Static deployment

The repository includes a GitHub Pages workflow. It builds with a repository
subpath only in that workflow, so local development stays at `/` while a Pages
deployment loads its JavaScript and project mark correctly. A workflow file or
successful build is not evidence that a public URL, wallet connection, or
on-chain record exists.

## Human-controlled flow

1. Open the app and inspect the independent RPC health and confirmed-slot values.
2. Install/configure Nightly yourself from the official site, then set its custom SVM RPC to `https://rpc.cookiescan.io` if required by the wallet.
3. Click **Connect Nightly**. Approve or reject the connection in Nightly yourself.
4. Inspect the complete public address displayed by the app.
5. Enter a concise non-sensitive memo note, then click **Prepare signing request** only if you want to prepare the in-memory Memo v1 transaction.
6. Read the fee warning, then click **Request signature and send** only if you want Nightly to present its signing prompt.
7. Approve or reject that prompt yourself. Treat the app’s result as provisional until you independently inspect the signature in Cookiescan.

The exact final step is expanded in [docs/HUMAN-ONLY-FINAL-STEP.md](docs/HUMAN-ONLY-FINAL-STEP.md). An honest local demo outline is in [docs/DEMO.md](docs/DEMO.md).

## Tests

```bash
pnpm test
```

The test suite covers Nightly-only detection without `connect()` side effects, RPC payloads, safe partial read failures, explicit transaction transition rules, and display-safe error formatting. It makes no chain write, wallet request, or network call.

## License

[MIT](LICENSE)
