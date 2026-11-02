import { test } from "node:test";
import assert from "node:assert/strict";
import {
  hasAdminCapability,
  cleanAdminCapabilities,
} from "../src/lib/admin/capabilities.ts";
import {
  userListParams,
  usersHref,
  validateUser,
} from "../src/lib/admin/users.ts";
const user = {
  email: " Owner@Example.com ",
  fullName: " Owner ",
  username: " OWNER.Name ",
  role: "admin",
  fullAccess: false,
  capabilities: ["posts", "media"],
  password: "A-long-initial-password",
};
test("restricted admins receive only selected sections, while full administrators keep complete access", () => {
  const restricted = { role: "admin", adminCapabilities: ["posts"] };
  assert.equal(hasAdminCapability(restricted, "posts"), true);
  assert.equal(hasAdminCapability(restricted, "orders"), false);
  assert.equal(hasAdminCapability(restricted), false);
  assert.equal(
    hasAdminCapability({ role: "admin", adminCapabilities: null }),
    true,
  );
  assert.equal(
    hasAdminCapability(
      { role: "customer", adminCapabilities: ["posts"] },
      "posts",
    ),
    false,
  );
  assert.deepEqual(
    cleanAdminCapabilities("admin", false, [
      "posts",
      "posts",
      "media",
      "constructor",
    ]),
    ["posts", "media"],
  );
  assert.deepEqual(cleanAdminCapabilities("admin", false, []), []);
  assert.equal(cleanAdminCapabilities("customer", false, ["posts"]), null);
});
test("pagination ignores malformed input and search links preserve filters and special characters", () => {
  assert.deepEqual(
    userListParams({ q: "  Alice  ", role: "admin", page: "2" }),
    { q: "Alice", role: "admin", page: 2 },
  );
  for (const page of ["-2", "1.5", "Infinity", "no", ["2"]])
    assert.equal(userListParams({ page }).page, 1);
  assert.equal(userListParams({ role: "constructor" }).role, "");
  const url = new URL(
    usersHref("a+b@example.com", "business_owner", 3),
    "https://example.com",
  );
  assert.equal(url.searchParams.get("q"), "a+b@example.com");
  assert.equal(url.searchParams.get("role"), "business_owner");
  assert.equal(url.searchParams.get("page"), "3");
  assert.equal(usersHref("", ""), "/admin/users/");
});
test("user validation normalizes identifiers and rejects invalid roles, capabilities and short passwords", () => {
  const result = validateUser(user, true);
  assert.ok(!("error" in result));
  assert.equal(result.value.email, "owner@example.com");
  assert.equal(result.value.username, "owner.name");
  for (const patch of [
    { role: "constructor" },
    { role: "superadmin" },
    { capabilities: ["users"] },
    { capabilities: ["constructor"] },
    { password: "short" },
    { email: "bad" },
    { username: "ab" },
  ])
    assert.ok("error" in validateUser({ ...user, ...patch }, true));
  assert.ok(!("error" in validateUser({ ...user, password: "" }, false)));
  assert.ok("error" in validateUser({ ...user, password: "" }, true));
});
