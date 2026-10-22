import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { normalizeDatabaseUrl } from "../lib/database-url.mjs";

await test("legacy SSL modes preserve certificate and hostname verification without warnings", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import assert from 'node:assert/strict';
       import { Client } from 'pg';
       import { normalizeDatabaseUrl } from ${JSON.stringify(new URL("../lib/database-url.mjs", import.meta.url).href)};
       for (const mode of ['prefer', 'require', 'verify-ca']) {
         const connectionString = normalizeDatabaseUrl(
           'postgresql://user:p%40ss%2Fword@db.example.test:5433/app?sslmode=' + mode + '&channel_binding=require'
         );
         assert.equal(new URL(connectionString).searchParams.get('sslmode'), 'verify-full');
         assert.equal(new URL(connectionString).searchParams.get('channel_binding'), 'require');
         const { ssl, user, password, host, port, database } = new Client({ connectionString }).connectionParameters;
         assert.ok(ssl);
         assert.notEqual(ssl.rejectUnauthorized, false);
         assert.equal(ssl.checkServerIdentity, undefined);
         assert.equal(user, 'user');
         assert.equal(password, 'p@ss/word');
         assert.equal(host, 'db.example.test');
         assert.equal(port, 5433);
         assert.equal(database, 'app');
       }`,
    ],
    { cwd: new URL("../", import.meta.url), encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stderr);
  assert.doesNotMatch(result.stderr, /SECURITY WARNING/);
});

await test("local connections and explicit SSL choices remain unchanged", () => {
  for (const connectionString of [
    "postgresql://crm:crm@localhost:5432/crm",
    "postgresql://user:password@db.example.test/app?sslmode=disable",
    "postgresql://user:password@db.example.test/app?sslmode=verify-full",
    "postgresql://user:password@db.example.test/app?uselibpqcompat=true&sslmode=require",
    "/var/run/postgresql app",
  ]) {
    assert.equal(normalizeDatabaseUrl(connectionString), connectionString);
  }
});

await test("the last sslmode determines whether legacy modes are rewritten", () => {
  const base = "postgresql://user:password@db.example.test/app?";
  for (const mode of ["prefer", "require", "verify-ca"]) {
    const normalized = normalizeDatabaseUrl(`${base}sslmode=disable&sslmode=${mode}`);
    assert.deepEqual(new URL(normalized).searchParams.getAll("sslmode"), ["verify-full"]);
    for (const finalMode of ["disable", "verify-full"]) {
      const connectionString = `${base}sslmode=${mode}&sslmode=${finalMode}`;
      assert.equal(normalizeDatabaseUrl(connectionString), connectionString);
    }
  }
});

await test("the last uselibpqcompat determines whether legacy modes are preserved", () => {
  const base = "postgresql://user:password@db.example.test/app?sslmode=require&";
  const compatible = `${base}uselibpqcompat=false&uselibpqcompat=true`;
  assert.equal(normalizeDatabaseUrl(compatible), compatible);
  const normalized = normalizeDatabaseUrl(`${base}uselibpqcompat=true&uselibpqcompat=false`);
  const params = new URL(normalized).searchParams;
  assert.equal(params.get("sslmode"), "verify-full");
  assert.deepEqual(params.getAll("uselibpqcompat"), ["true", "false"]);
});
