import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const html = await readFile(new URL("./index.html", import.meta.url), "utf8");

test("OWNYOURWEB homepage leads with customer actions", () => {
  assert.match(html, /Make It Easier for Customers to Act/);
  assert.match(html, /Build around the customer action that matters\./);
  assert.match(html, /Where are customers getting stuck\?/);
  for (const action of ["Find You", "Understand The Offer", "Contact You", "Book Or Buy", "Stay Updated"]) {
    assert.match(html, new RegExp(action));
  }
});

test("OWNYOURWEB homepage preserves the live intake and ecosystem paths", () => {
  assert.match(html, /id="leadForm"/);
  assert.match(html, /https:\/\/ownyourweb\.marketing/);
  assert.match(html, /https:\/\/shopnasgfx\.com\//);
  assert.match(html, /account\//);
});
