export const COOKIE_RPC_URL = "https://rpc.cookiescan.io";
export const COOKIE_EXPLORER_URL = "https://cookiescan.io";
export const COOKIE_MEMO_PROGRAM_ID = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";
export const DEFAULT_TIMEOUT_MS = 9_000;

export const TransactionPhase = Object.freeze({
  WALLET_DISCONNECTED: "wallet-disconnected",
  IDLE: "idle",
  TRANSACTION_READY: "transaction-ready",
  PENDING_SIGNATURE: "pending-signature",
  CONFIRMED: "confirmed",
  FAILED: "failed",
});

const ALLOWED_TRANSITIONS = Object.freeze({
  [TransactionPhase.WALLET_DISCONNECTED]: [TransactionPhase.IDLE],
  [TransactionPhase.IDLE]: [TransactionPhase.TRANSACTION_READY, TransactionPhase.WALLET_DISCONNECTED, TransactionPhase.FAILED],
  [TransactionPhase.TRANSACTION_READY]: [TransactionPhase.PENDING_SIGNATURE, TransactionPhase.IDLE, TransactionPhase.WALLET_DISCONNECTED, TransactionPhase.FAILED],
  [TransactionPhase.PENDING_SIGNATURE]: [TransactionPhase.CONFIRMED, TransactionPhase.FAILED, TransactionPhase.TRANSACTION_READY, TransactionPhase.WALLET_DISCONNECTED],
  [TransactionPhase.CONFIRMED]: [TransactionPhase.IDLE, TransactionPhase.TRANSACTION_READY, TransactionPhase.WALLET_DISCONNECTED],
  [TransactionPhase.FAILED]: [TransactionPhase.IDLE, TransactionPhase.TRANSACTION_READY, TransactionPhase.WALLET_DISCONNECTED],
});

export function canTransitionTransaction(from, to) {
  return ALLOWED_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransactionTransition(from, to) {
  if (!canTransitionTransaction(from, to)) {
    throw new Error(`Cannot move transaction state from ${from} to ${to}.`);
  }
}

/**
 * A prepared request may be sent exactly from the explicit review state.
 * Confirmed, failed, and pending requests must be prepared again first.
 */
export function canRequestSignature(phase, prepared) {
  return Boolean(prepared) && phase === TransactionPhase.TRANSACTION_READY;
}

export function toAddressString(publicKey) {
  if (typeof publicKey === "string") return publicKey;
  if (publicKey && typeof publicKey.toBase58 === "function") return publicKey.toBase58();
  return "";
}

export function buildMemoText(note) {
  const normalized = String(note ?? "").trim();
  if (!normalized) throw new Error("Enter a memo note before preparing a signing request.");
  if (normalized.length > 280) throw new Error("Memo notes must be 280 characters or fewer.");
  return `cookie-memo-ledger:v1:${normalized}`;
}

function hasProviderShape(candidate) {
  return Boolean(candidate && typeof candidate.connect === "function");
}

function isExplicitNightly(candidate) {
  if (!candidate) return false;
  if (candidate.isNightly === true) return true;
  return typeof candidate.name === "string" && candidate.name.toLowerCase() === "nightly";
}

/**
 * Detects a provider without invoking it. A generic injected Solana provider is
 * accepted only when it explicitly identifies itself as Nightly.
 */
export function findNightlyProvider(windowLike) {
  const namespaced = windowLike?.nightly?.solana;
  if (hasProviderShape(namespaced)) return namespaced;

  const injected = windowLike?.solana;
  if (hasProviderShape(injected) && isExplicitNightly(injected)) return injected;

  const listed = Array.isArray(injected?.providers) ? injected.providers : [];
  return listed.find((provider) => hasProviderShape(provider) && isExplicitNightly(provider)) ?? null;
}

export function createRpcPayload(id, method, params = []) {
  return { jsonrpc: "2.0", id, method, params };
}

export async function rpcRequest({
  fetchImpl,
  url = COOKIE_RPC_URL,
  id,
  method,
  params = [],
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(createRpcPayload(id, method, params)),
      signal: controller.signal,
    });

    if (!response.ok) throw new Error(`RPC request failed with HTTP ${response.status}.`);
    const payload = await response.json();
    if (payload.error) throw new Error(payload.error.message || "The Cookie Chain RPC returned an error.");
    if (!("result" in payload)) throw new Error("The Cookie Chain RPC response did not include a result.");
    return payload.result;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("The Cookie Chain RPC request timed out.");
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Health and slot calls are intentionally independent so a partial failure is
 * visible instead of being incorrectly rendered as a healthy network.
 */
export async function readChainStatus({ fetchImpl, url = COOKIE_RPC_URL, now = () => new Date() }) {
  const [health, slot] = await Promise.allSettled([
    rpcRequest({ fetchImpl, url, id: "cookie-capp-health", method: "getHealth" }),
    rpcRequest({
      fetchImpl,
      url,
      id: "cookie-capp-slot",
      method: "getSlot",
      params: [{ commitment: "confirmed" }],
    }),
  ]);

  return {
    health: health.status === "fulfilled" ? { ok: true, value: health.value } : { ok: false, error: health.reason },
    slot: slot.status === "fulfilled" ? { ok: true, value: slot.value } : { ok: false, error: slot.reason },
    readAt: now().toISOString(),
  };
}

export function safeErrorMessage(error) {
  const message = error instanceof Error ? error.message : String(error || "Unknown error");
  return message.replace(/https?:\/\/[^\s]+/g, "the RPC endpoint").slice(0, 240);
}
