import assert from "node:assert/strict";
import test from "node:test";
import {
  TransactionPhase,
  buildMemoText,
  canRequestSignature,
  canTransitionTransaction,
  createRpcPayload,
  findNightlyProvider,
  readChainStatus,
  rpcRequest,
  safeErrorMessage,
  toAddressString,
} from "../src/core.js";

function jsonResponse(payload, ok = true, status = 200) {
  return { ok, status, json: async () => payload };
}

test("Nightly detection is read-only and rejects generic wallets", () => {
  let calls = 0;
  const genericWallet = { connect() { calls += 1; } };
  assert.equal(findNightlyProvider({ solana: genericWallet }), null);
  assert.equal(calls, 0);

  const nightly = { connect() { calls += 1; }, isNightly: true };
  assert.equal(findNightlyProvider({ solana: nightly }), nightly);
  assert.equal(calls, 0);
});

test("namespaced Nightly is accepted without calling connect", () => {
  let connected = false;
  const nightly = { connect() { connected = true; } };
  assert.equal(findNightlyProvider({ nightly: { solana: nightly } }), nightly);
  assert.equal(connected, false);
});

test("RPC payload has the expected JSON-RPC shape", () => {
  assert.deepEqual(createRpcPayload("health", "getHealth"), {
    jsonrpc: "2.0",
    id: "health",
    method: "getHealth",
    params: [],
  });
});

test("RPC request returns a result and retains confirmed slot params", async () => {
  const requests = [];
  const result = await rpcRequest({
    fetchImpl: async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return jsonResponse({ jsonrpc: "2.0", id: "slot", result: 42 });
    },
    id: "slot",
    method: "getSlot",
    params: [{ commitment: "confirmed" }],
  });
  assert.equal(result, 42);
  assert.deepEqual(requests[0].params, [{ commitment: "confirmed" }]);
});

test("RPC request reports server errors without treating them as healthy", async () => {
  await assert.rejects(
    () => rpcRequest({
      fetchImpl: async () => jsonResponse({ error: { message: "RPC unavailable" } }),
      id: "health",
      method: "getHealth",
    }),
    /RPC unavailable/,
  );
});

test("chain status preserves a partial slot failure", async () => {
  const status = await readChainStatus({
    fetchImpl: async (_url, options) => {
      const { method } = JSON.parse(options.body);
      return method === "getHealth"
        ? jsonResponse({ result: "ok" })
        : jsonResponse({ error: { message: "slot unavailable" } });
    },
    now: () => new Date("2026-09-22T10:00:00.000Z"),
  });
  assert.equal(status.health.ok, true);
  assert.equal(status.slot.ok, false);
  assert.equal(status.readAt, "2026-09-22T10:00:00.000Z");
});

test("transaction state transitions leave pending signature explicit", () => {
  assert.equal(canTransitionTransaction(TransactionPhase.WALLET_DISCONNECTED, TransactionPhase.IDLE), true);
  assert.equal(canTransitionTransaction(TransactionPhase.IDLE, TransactionPhase.TRANSACTION_READY), true);
  assert.equal(canTransitionTransaction(TransactionPhase.TRANSACTION_READY, TransactionPhase.PENDING_SIGNATURE), true);
  assert.equal(canTransitionTransaction(TransactionPhase.PENDING_SIGNATURE, TransactionPhase.CONFIRMED), true);
  assert.equal(canTransitionTransaction(TransactionPhase.CONFIRMED, TransactionPhase.PENDING_SIGNATURE), false);
});

test("a signing request is available only from transaction-ready", () => {
  const prepared = { transaction: {} };
  assert.equal(canRequestSignature(TransactionPhase.TRANSACTION_READY, prepared), true);
  assert.equal(canRequestSignature(TransactionPhase.PENDING_SIGNATURE, prepared), false);
  assert.equal(canRequestSignature(TransactionPhase.CONFIRMED, prepared), false);
  assert.equal(canRequestSignature(TransactionPhase.FAILED, prepared), false);
});

test("address and errors are made safe for display", () => {
  assert.equal(toAddressString({ toBase58: () => "CookieAddress" }), "CookieAddress");
  assert.equal(safeErrorMessage(new Error("Failed at https://rpc.cookiescan.io/private")), "Failed at the RPC endpoint");
});

test("memo content is explicit, non-empty, and bounded before transaction preparation", () => {
  assert.equal(buildMemoText("agent-run: checksum abc123"), "cookie-memo-ledger:v1:agent-run: checksum abc123");
  assert.throws(() => buildMemoText("  "), /Enter a memo note/);
  assert.throws(() => buildMemoText("x".repeat(281)), /280 characters/);
});
