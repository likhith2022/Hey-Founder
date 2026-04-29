import { spawnSync } from "node:child_process";

type LicenseEntry = {
  name: string;
  versions?: string[];
  license?: string;
};

type LicenseMap = Record<string, LicenseEntry[]>;

const copyleftPattern = /\b(AGPL|GPL|LGPL|MPL|EPL|CDDL)\b/i;
const unknownPattern = /unknown|unlicensed|none/i;

function runPnpmLicenses(scope: "prod" | "dev") {
  const args = ["pnpm", "licenses", "list", "--json", scope === "prod" ? "--prod" : "--dev"];
  const result = spawnSync("corepack", args, { encoding: "utf8" });
  if (result.status !== 0) {
    process.stderr.write(result.stderr);
    process.stderr.write(result.stdout);
    process.exit(result.status ?? 1);
  }
  const text = result.stdout.slice(result.stdout.indexOf("{"));
  return JSON.parse(text) as LicenseMap;
}

function summarize(scope: "prod" | "dev", map: LicenseMap) {
  const rows = Object.entries(map).map(([license, entries]) => ({
    license,
    count: entries.reduce((sum, entry) => sum + Math.max(1, entry.versions?.length ?? 1), 0),
    packages: entries.map((entry) => `${entry.name}@${entry.versions?.join(",") ?? "unknown"}`)
  }));
  const unknown = rows.filter((row) => unknownPattern.test(row.license));
  const copyleft = rows.filter((row) => copyleftPattern.test(row.license));
  const review = rows.filter((row) => /CC-BY|WTFPL|BlueOak/i.test(row.license));
  return { scope, rows, unknown, copyleft, review };
}

const prod = summarize("prod", runPnpmLicenses("prod"));
const dev = summarize("dev", runPnpmLicenses("dev"));
const summaries = [prod, dev];

for (const summary of summaries) {
  console.log(`\n${summary.scope.toUpperCase()} dependency license summary`);
  for (const row of summary.rows.sort((a, b) => a.license.localeCompare(b.license))) {
    console.log(`- ${row.license}: ${row.count} package version(s)`);
  }
  if (summary.review.length) {
    console.log(`Review noted: ${summary.review.map((row) => row.license).join(", ")}`);
  }
}

const unknown = summaries.flatMap((summary) => summary.unknown.map((row) => `${summary.scope}:${row.license}`));
const copyleft = summaries.flatMap((summary) => summary.copyleft.map((row) => `${summary.scope}:${row.license}`));

if (unknown.length || copyleft.length) {
  if (unknown.length) console.error(`Unknown/unlicensed dependencies require review: ${unknown.join(", ")}`);
  if (copyleft.length) console.error(`Copyleft dependencies require review: ${copyleft.join(", ")}`);
  process.exit(1);
}

console.log("\nLicense check passed: no unknown, GPL, AGPL, LGPL, MPL, EPL, or CDDL licenses detected by pnpm metadata.");
