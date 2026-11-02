import assert from "node:assert/strict";
import { test } from "node:test";
import {
  resolveLoginEmail,
  exactUsernamePattern,
} from "../src/lib/auth/login-identifier.ts";

test("email login trims input and bypasses username lookup", async () => {
  const email = await resolveLoginEmail(
    "  Owner+Shop@Example.com  ",
    async () => {
      throw new Error("Unexpected lookup");
    },
  );
  assert.equal(email, "owner+shop@example.com");
});

test("username login is case-insensitive and supports existing username punctuation", async () => {
  for (const username of ["Garage_One", "Garage.One", "Garage-One"]) {
    const email = await resolveLoginEmail(`  ${username}  `, async (name) => {
      assert.equal(name, username.toLowerCase());
      return "owner@example.com";
    });
    assert.equal(email, "owner@example.com");
  }
});

test("unknown usernames and invalid identifiers do not resolve an account", async () => {
  assert.equal(await resolveLoginEmail("missing", async () => null), null);
  for (const invalid of [
    "",
    "a",
    "%",
    "garage%",
    "garage,one",
    "garage(one)",
    "garage one",
    "x".repeat(255),
  ]) {
    assert.equal(
      await resolveLoginEmail(invalid, async () => {
        throw new Error("Unexpected lookup");
      }),
      null,
    );
  }
});

test("username underscores are matched literally rather than as wildcards", () => {
  assert.equal(exactUsernamePattern("garage_one"), "garage\\_one");
});
