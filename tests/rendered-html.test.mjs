import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the FactoryOps shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>JinTai FactoryOps \| 金汰工厂运营管理系统<\/title>/);
  assert.match(html, /工厂运营看板/);
  assert.match(html, /生产计划/);
  assert.match(html, /PDM 数据同步/);
  assert.match(html, /金汰家具/);
  assert.match(html, /工厂运营管理系统/);
  assert.match(html, /Developed by 俞俊安/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/);
});

test("uses a readable typography scale for operational tables", async () => {
  const stylesheet = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(stylesheet, /table \{[^}]*font-size: 13px/);
  assert.match(stylesheet, /th \{[^}]*font-size: 12px/);
  assert.match(stylesheet, /\.sidebar nav button[^}]*font-size: 14px/);
});

test("PDM integration is hard-coded as read-only", async () => {
  const source = await readFile(new URL("../lib/pdm-readonly.ts", import.meta.url), "utf8");
  const route = await readFile(new URL("../app/api/pdm/sync/route.ts", import.meta.url), "utf8");
  assert.match(source, /accessMode:\s*"READ_ONLY"/);
  assert.match(source, /method:\s*"GET"/);
  assert.match(source, /effectiveRevision/);
  assert.doesNotMatch(source, /method:\s*"(?:POST|PUT|PATCH|DELETE)"/);
  assert.match(route, /writeBackPerformed:\s*false/g);
  assert.doesNotMatch(route, /api\.github\.com\/repos\/.*\/git\/refs/);
});

test("inventory is ledger-based and production release snapshots BOM", async () => {
  const schema = await readFile(new URL("../db/schema.ts", import.meta.url), "utf8");
  const operations = await readFile(new URL("../app/api/operations/route.ts", import.meta.url), "utf8");
  assert.match(schema, /inventory_transactions/);
  assert.match(schema, /quantity_delta/);
  assert.match(schema, /reversal_of_id/);
  assert.match(operations, /INSERT INTO production_order_bom_lines/);
  assert.match(operations, /STALE_PRODUCTION_ORDER/);
  assert.match(operations, /INVALID_STATUS_TRANSITION/);
});
