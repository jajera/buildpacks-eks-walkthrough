#!/usr/bin/env node
/**
 * Export lab defaults from demo/aws-resources.json for shells and agents.
 *
 * Usage:
 *   eval "$(node scripts/export-lab-env.mjs)"
 *   node scripts/export-lab-env.mjs --json          # print inventory JSON path + summary
 *   node scripts/export-lab-env.mjs --resource ecr  # filter resources by service
 *   node scripts/export-lab-env.mjs --write-env     # refresh demo/config/env.example
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const inventoryPath = join(root, "demo/aws-resources.json");
const envExamplePath = join(root, "demo/config/env.example");

const inventory = JSON.parse(readFileSync(inventoryPath, "utf8"));
const args = process.argv.slice(2);

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}

function printExports() {
  for (const [key, value] of Object.entries(inventory.env)) {
    console.log(`export ${key}=${shellQuote(value)}`);
  }
  console.log(`# Derived (run after AWS auth):`);
  console.log(
    `export AWS_ACCOUNT_ID="\${AWS_ACCOUNT_ID:-$(aws sts get-caller-identity --query Account --output text)}"`,
  );
  console.log(
    `export ECR_REGISTRY="\${AWS_ACCOUNT_ID}.dkr.ecr.\${AWS_REGION}.amazonaws.com"`,
  );
  console.log(`export ECR_URI="\${ECR_REGISTRY}/\${ECR_REPO}"`);
  console.log(
    `export CODECOMMIT_APP_URL="https://git-codecommit.\${AWS_REGION}.amazonaws.com/v1/repos/\${CODECOMMIT_APP}"`,
  );
  console.log(
    `export CODECOMMIT_DEPLOY_URL="https://git-codecommit.\${AWS_REGION}.amazonaws.com/v1/repos/\${CODECOMMIT_DEPLOY}"`,
  );
  console.log(
    `export ARGOCD_ROLE_ARN="arn:aws:iam::\${AWS_ACCOUNT_ID}:role/\${ARGOCD_ROLE_NAME}"`,
  );
  console.log(`export LAB_DIR="\${LAB_DIR:-$(pwd)/demo}"`);
}

function writeEnvExample() {
  mkdirSync(dirname(envExamplePath), { recursive: true });
  const lines = [
    `# Generated from demo/aws-resources.json — do not hand-edit; run:`,
    `#   node scripts/export-lab-env.mjs --write-env`,
    `#`,
    `# Load:`,
    `#   eval "$(node scripts/export-lab-env.mjs)"`,
    `#   # or: set -a && source demo/config/env.example && set +a`,
    "",
  ];
  for (const [key, value] of Object.entries(inventory.env)) {
    lines.push(`export ${key}=${shellQuote(value)}`);
  }
  lines.push("");
  lines.push("# After aws sso login:");
  lines.push(
    '# export AWS_ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"',
  );
  lines.push(
    '# export ECR_URI="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPO}"',
  );
  lines.push(
    '# export CODECOMMIT_APP_URL="https://git-codecommit.${AWS_REGION}.amazonaws.com/v1/repos/${CODECOMMIT_APP}"',
  );
  lines.push(
    '# export CODECOMMIT_DEPLOY_URL="https://git-codecommit.${AWS_REGION}.amazonaws.com/v1/repos/${CODECOMMIT_DEPLOY}"',
  );
  lines.push("");
  writeFileSync(envExamplePath, lines.join("\n"));
  console.error(`Wrote ${envExamplePath}`);
}

if (args.includes("--write-env")) {
  writeEnvExample();
  process.exit(0);
}

if (args.includes("--json")) {
  console.log(
    JSON.stringify(
      {
        inventory: "demo/aws-resources.json",
        lab: inventory.lab,
        defaults: inventory.defaults,
        resourceCount: inventory.resources.length,
        services: [...new Set(inventory.resources.map((r) => r.service))],
      },
      null,
      2,
    ),
  );
  process.exit(0);
}

const resourceIdx = args.indexOf("--resource");
if (resourceIdx !== -1) {
  const service = args[resourceIdx + 1];
  if (!service) {
    console.error("Usage: --resource <service>  (ecr|eks|codecommit|iam)");
    process.exit(1);
  }
  const matched = inventory.resources.filter((r) => r.service === service);
  console.log(JSON.stringify(matched, null, 2));
  process.exit(0);
}

printExports();
