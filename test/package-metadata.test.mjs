import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("package metadata declares the MIT license", async () => {
  const manifest = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  assert.equal(manifest.license, "MIT");

  const lock = JSON.parse(await readFile(new URL("package-lock.json", root), "utf8"));
  assert.equal(lock.packages[""].license, manifest.license);
});

test("LICENSE file carries the standard MIT notice", async () => {
  const license = await readFile(new URL("LICENSE", root), "utf8");
  assert.match(license, /^MIT License\n/);
  assert.match(license, /Copyright \(c\) 2026 Andy Solomon/);
});

test("package files list does not exclude LICENSE", async () => {
  const manifest = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
  assert.ok(Array.isArray(manifest.files));
  assert.ok(!manifest.files.some((entry) => entry === "!LICENSE" || entry === "!LICENSE*"));
});
