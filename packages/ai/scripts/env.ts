import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export function loadLocalEnv(): void {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  const packageRoot = resolve(scriptDir, "..");
  const repoRoot = resolve(packageRoot, "../..");

  for (const envPath of [
    resolve(repoRoot, ".env"),
    resolve(packageRoot, ".env"),
    resolve(process.cwd(), ".env"),
  ]) {
    loadEnvFileIfExists(envPath);
  }
}

export function hasAiGatewayKey(): boolean {
  return Boolean(process.env.TUTURUUU_AI_API_KEY?.trim());
}

export function getAiGatewayKey(): string | undefined {
  return process.env.TUTURUUU_AI_API_KEY?.trim();
}

export function aiGatewayEnvHint(action = "running this script"): string {
  return `Set TUTURUUU_AI_API_KEY before ${action}.`;
}

function loadEnvFileIfExists(path: string): void {
  if (!existsSync(path)) return;

  const content = readFileSync(path, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^([\w.-]+)\s*=\s*(.*)$/);
    if (!match) continue;

    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;

    process.env[key] = unquote(rawValue);
  }
}

function unquote(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}
