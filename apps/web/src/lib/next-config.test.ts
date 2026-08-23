import assert from "node:assert/strict";
import test from "node:test";
import nextConfig from "../../next.config";

test("content security policy permits attachment audio sources", async () => {
  assert.equal(typeof nextConfig.headers, "function");

  const headerRules = await nextConfig.headers!();
  const policy = headerRules
    .flatMap((rule) => rule.headers)
    .find((header) => header.key === "Content-Security-Policy")?.value;

  assert.ok(policy);
  assert.match(
    policy,
    /media-src 'self' blob: (?:[^;]* )?https:\/\/\*\.supabase\.co/,
  );
});

test("permissions policy allows first-party voice recording", async () => {
  assert.equal(typeof nextConfig.headers, "function");

  const headerRules = await nextConfig.headers!();
  const policy = headerRules
    .flatMap((rule) => rule.headers)
    .find((header) => header.key === "Permissions-Policy")?.value;

  assert.ok(policy);
  assert.match(policy, /microphone=\(self\)/);
  assert.doesNotMatch(policy, /microphone=\(\)/);
});
