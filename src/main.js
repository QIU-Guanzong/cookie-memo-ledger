import { Connection, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import {
  COOKIE_EXPLORER_URL,
  COOKIE_MEMO_PROGRAM_ID,
  COOKIE_RPC_URL,
  TransactionPhase,
  assertTransactionTransition,
  buildMemoText,
  canRequestSignature,
  findNightlyProvider,
  readChainStatus,
  safeErrorMessage,
  toAddressString,
} from "./core.js";
import "./style.css";

const connection = new Connection(COOKIE_RPC_URL, "confirmed");

const element = (id) => document.getElementById(id);
const ui = {
  chainBadge: element("chain-badge"),
  health: element("health-value"),
  slot: element("slot-value"),
  readAt: element("read-at-value"),
  chainError: element("chain-error"),
  refreshChain: element("refresh-chain"),
  walletTitle: element("wallet-title"),
  walletBadge: element("wallet-badge"),
  walletCopy: element("wallet-copy"),
  walletAddressWrap: element("wallet-address-wrap"),
  walletAddress: element("wallet-address"),
  copyAddress: element("copy-address"),
  connectWallet: element("connect-wallet"),
  disconnectWallet: element("disconnect-wallet"),
  walletError: element("wallet-error"),
  walletHelp: element("wallet-help"),
  transactionBadge: element("transaction-badge"),
  transactionCopy: element("transaction-copy"),
  transactionDetails: element("transaction-details"),
  transactionError: element("transaction-error"),
  transactionLink: element("transaction-link"),
  prepareTransaction: element("prepare-transaction"),
  signAndSend: element("sign-and-send"),
  memoNote: element("memo-note"),
  memoCount: element("memo-count"),
  track: [...document.querySelectorAll(".state-track li")],
};

const app = {
  provider: findNightlyProvider(window),
  publicKey: null,
  prepared: null,
  phase: TransactionPhase.WALLET_DISCONNECTED,
};

function setBadge(target, label, tone = "muted") {
  target.textContent = label;
  target.className = `badge badge-${tone}`;
}

function showMessage(target, message = "") {
  target.textContent = message;
  target.hidden = !message;
}

function setPhase(nextPhase) {
  if (nextPhase !== app.phase) assertTransactionTransition(app.phase, nextPhase);
  app.phase = nextPhase;

  const label = nextPhase === TransactionPhase.IDLE ? "wallet connected · no transaction" : nextPhase.replaceAll("-", " ");
  const tone = nextPhase === TransactionPhase.CONFIRMED ? "success" : nextPhase === TransactionPhase.FAILED ? "danger" : nextPhase === TransactionPhase.PENDING_SIGNATURE ? "warning" : "muted";
  setBadge(ui.transactionBadge, label, tone);
  ui.track.forEach((item) => item.classList.toggle("is-current", item.dataset.phase === nextPhase));
}

function renderWallet() {
  const connected = Boolean(app.publicKey);
  if (!connected) {
    ui.walletTitle.textContent = "Wallet-disconnected";
    setBadge(ui.walletBadge, "Disconnected", "muted");
    ui.walletCopy.textContent = app.provider
      ? "Nightly was detected. Select Connect Nightly to open a wallet-controlled connection request."
      : "Nightly is the only wallet this ledger will request. Detection does not connect it.";
    ui.walletAddressWrap.hidden = true;
    ui.connectWallet.hidden = false;
    ui.disconnectWallet.hidden = true;
    ui.prepareTransaction.disabled = true;
    ui.signAndSend.disabled = true;
    ui.walletHelp.hidden = Boolean(app.provider);
    return;
  }

  ui.walletTitle.textContent = "Nightly connected";
  setBadge(ui.walletBadge, "Connected", "success");
  ui.walletCopy.textContent = "Only the public address is displayed. It is not stored or sent anywhere by this app.";
  ui.walletAddress.textContent = toAddressString(app.publicKey);
  ui.walletAddressWrap.hidden = false;
  ui.connectWallet.hidden = true;
  ui.disconnectWallet.hidden = false;
  ui.walletHelp.hidden = true;
  ui.prepareTransaction.disabled = app.phase === TransactionPhase.PENDING_SIGNATURE || !ui.memoNote.value.trim();
  ui.signAndSend.disabled = !canRequestSignature(app.phase, app.prepared);
  ui.memoNote.disabled = app.phase === TransactionPhase.PENDING_SIGNATURE;
}

async function refreshChainStatus() {
  ui.refreshChain.disabled = true;
  setBadge(ui.chainBadge, "Checking", "muted");
  ui.health.textContent = "Checking RPC health…";
  ui.slot.textContent = "Checking current slot…";
  showMessage(ui.chainError);

  try {
    const status = await readChainStatus({ fetchImpl: window.fetch.bind(window) });
    ui.health.textContent = status.health.ok ? String(status.health.value) : `Unavailable: ${safeErrorMessage(status.health.error)}`;
    ui.slot.textContent = status.slot.ok ? status.slot.value.toLocaleString() : `Unavailable: ${safeErrorMessage(status.slot.error)}`;
    ui.readAt.textContent = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "medium" }).format(new Date(status.readAt));

    const healthy = status.health.ok && status.health.value === "ok" && status.slot.ok;
    setBadge(ui.chainBadge, healthy ? "Live read" : "Partial read", healthy ? "success" : "warning");
    if (!healthy) showMessage(ui.chainError, "One or more read-only RPC calls failed. The displayed values are not treated as a full health confirmation.");
  } catch (error) {
    setBadge(ui.chainBadge, "Read failed", "danger");
    ui.health.textContent = "Unavailable";
    ui.slot.textContent = "Unavailable";
    showMessage(ui.chainError, safeErrorMessage(error));
  } finally {
    ui.refreshChain.disabled = false;
  }
}

function resetTransactionForDisconnect() {
  app.prepared = null;
  if (app.phase !== TransactionPhase.WALLET_DISCONNECTED) setPhase(TransactionPhase.WALLET_DISCONNECTED);
  ui.transactionCopy.textContent = "Connect Nightly before a signing request can be prepared. No transaction exists yet.";
  ui.transactionDetails.textContent = "A memo transaction is not prepared, signed, or sent until the wallet holder explicitly takes those steps. A network fee may apply only after a future signing approval and a successful send.";
  ui.transactionLink.hidden = true;
  showMessage(ui.transactionError);
}

async function connectNightly() {
  showMessage(ui.walletError);
  app.provider = findNightlyProvider(window);
  if (!app.provider) {
    showMessage(ui.walletError, "Nightly was not detected in this browser. No connection request was sent.");
    renderWallet();
    return;
  }

  ui.connectWallet.disabled = true;
  ui.walletTitle.textContent = "Waiting for Nightly";
  setBadge(ui.walletBadge, "Connection requested", "warning");

  try {
    // This call occurs only in the click handler. It never runs on page load.
    const response = await app.provider.connect();
    const publicKey = response?.publicKey ?? app.provider.publicKey;
    const address = toAddressString(publicKey);
    if (!address) throw new Error("Nightly connected without returning a public address.");
    app.publicKey = new PublicKey(address);
    app.prepared = null;
    setPhase(TransactionPhase.IDLE);
    ui.transactionCopy.textContent = "Wallet connected. Enter a concise, non-sensitive memo before preparing a signing request. No transaction exists yet.";
    ui.transactionDetails.textContent = "A memo transaction is not prepared, signed, or sent until the wallet holder explicitly takes those steps. A network fee may apply only after a future signing approval and a successful send.";
    ui.transactionLink.hidden = true;
    showMessage(ui.transactionError);
    renderWallet();
  } catch (error) {
    app.publicKey = null;
    showMessage(ui.walletError, `Connection was not completed: ${safeErrorMessage(error)}`);
    renderWallet();
  } finally {
    ui.connectWallet.disabled = false;
  }
}

async function disconnectNightly() {
  try {
    await app.provider?.disconnect?.();
  } catch {
    // The local state still returns to disconnected; no external state is assumed.
  }
  app.publicKey = null;
  resetTransactionForDisconnect();
  renderWallet();
}

async function prepareTransaction() {
  if (!app.publicKey) return;
  showMessage(ui.transactionError);
  ui.prepareTransaction.disabled = true;
  ui.transactionCopy.textContent = "Reading a recent confirmed blockhash to prepare an unsigned in-memory request…";

  try {
    const memo = buildMemoText(ui.memoNote.value);
    const latest = await connection.getLatestBlockhash("confirmed");
    const transaction = new Transaction({
      feePayer: app.publicKey,
      recentBlockhash: latest.blockhash,
    }).add(
      new TransactionInstruction({
        keys: [],
        programId: new PublicKey(COOKIE_MEMO_PROGRAM_ID),
        data: new TextEncoder().encode(memo),
      }),
    );
    app.prepared = { transaction, latest };
    if (app.phase !== TransactionPhase.TRANSACTION_READY) setPhase(TransactionPhase.TRANSACTION_READY);
    ui.transactionCopy.textContent = "Transaction-ready: an unsigned memo exists only in this browser’s memory. It has not been sent to Cookie Chain.";
    ui.transactionDetails.textContent = "The next control opens a Nightly signing request for your exact memo. Do not approve it unless you intentionally want to publish the note and pay any applicable Cookie Chain network fee.";
  } catch (error) {
    if (app.phase !== TransactionPhase.FAILED) setPhase(TransactionPhase.FAILED);
    app.prepared = null;
    ui.transactionCopy.textContent = "The unsigned request was not prepared.";
    showMessage(ui.transactionError, safeErrorMessage(error));
  } finally {
    renderWallet();
  }
}

async function signAndSend() {
  if (!app.provider || !app.prepared || !app.publicKey) return;
  showMessage(ui.transactionError);
  setPhase(TransactionPhase.PENDING_SIGNATURE);
  renderWallet();
  ui.transactionCopy.textContent = "Pending-signature: Nightly controls this request. Nothing is sent until the wallet holder approves it.";

  try {
    let signature;
    if (typeof app.provider.signAndSendTransaction === "function") {
      const result = await app.provider.signAndSendTransaction(app.prepared.transaction);
      signature = result?.signature ?? result;
    } else if (typeof app.provider.signTransaction === "function") {
      const signed = await app.provider.signTransaction(app.prepared.transaction);
      signature = await connection.sendRawTransaction(signed.serialize(), { preflightCommitment: "confirmed" });
    } else {
      throw new Error("This Nightly provider cannot sign and send a transaction.");
    }

    if (typeof signature !== "string" || !signature) throw new Error("The wallet did not return a transaction signature.");
    const confirmation = await connection.confirmTransaction(
      {
        signature,
        blockhash: app.prepared.latest.blockhash,
        lastValidBlockHeight: app.prepared.latest.lastValidBlockHeight,
      },
      "confirmed",
    );
    if (confirmation.value.err) throw new Error("Cookie Chain reported a transaction error during confirmation.");

    setPhase(TransactionPhase.CONFIRMED);
    ui.transactionCopy.textContent = "Confirmed: Cookie Chain reported the submitted transaction at confirmed commitment.";
    ui.transactionLink.href = `${COOKIE_EXPLORER_URL}/tx/${signature}`;
    ui.transactionLink.textContent = "View transaction in Cookiescan";
    ui.transactionLink.hidden = false;
  } catch (error) {
    setPhase(TransactionPhase.FAILED);
    ui.transactionCopy.textContent = "Failed: no success is claimed. Check the wallet and Cookiescan before trying again.";
    showMessage(ui.transactionError, safeErrorMessage(error));
  } finally {
    renderWallet();
  }
}

async function copyAddress() {
  const address = toAddressString(app.publicKey);
  if (!address || !navigator.clipboard?.writeText) return;
  await navigator.clipboard.writeText(address);
  ui.copyAddress.textContent = "Copied";
  window.setTimeout(() => {
    ui.copyAddress.textContent = "Copy";
  }, 1_400);
}

ui.refreshChain.addEventListener("click", refreshChainStatus);
ui.connectWallet.addEventListener("click", connectNightly);
ui.disconnectWallet.addEventListener("click", disconnectNightly);
ui.prepareTransaction.addEventListener("click", prepareTransaction);
ui.signAndSend.addEventListener("click", signAndSend);
ui.copyAddress.addEventListener("click", () => void copyAddress());
ui.memoNote.addEventListener("input", () => {
  ui.memoCount.textContent = `${ui.memoNote.value.length} / 280`;
  if (app.prepared) {
    app.prepared = null;
    if (app.phase !== TransactionPhase.PENDING_SIGNATURE) setPhase(TransactionPhase.IDLE);
    ui.transactionCopy.textContent = "Your memo changed. Prepare a new signing request to use this version.";
  }
  renderWallet();
});

if (app.provider?.on) {
  app.provider.on("accountChanged", (publicKey) => {
    const address = toAddressString(publicKey);
    app.publicKey = address ? new PublicKey(address) : null;
    if (!app.publicKey) resetTransactionForDisconnect();
    renderWallet();
  });
}

renderWallet();
void refreshChainStatus();
