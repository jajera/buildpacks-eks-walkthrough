# Lab agent notes

## AWS resource inventory (source of truth)

Read **`demo/aws-resources.json`** for every AWS / lab name (ECR `pulse`, CodeCommit `pulse-app` / `pulse-deploy`, cluster `cluster-1`, IAM roles, teardown flags). Do not invent resource names from prose in MDX when this file exists.

```bash
# Shell exports
eval "$(node scripts/export-lab-env.mjs)"

# Filter by service (ecr|eks|codecommit|iam)
node scripts/export-lab-env.mjs --resource ecr

# Refresh demo/config/env.example after editing the JSON
node scripts/export-lab-env.mjs --write-env
```

Schema: `demo/aws-resources.schema.json`.

## Docs vs inventory

Walkthrough steps live in `src/content/docs/deploy-and-operate/*.mdx`. When changing a resource name, update `demo/aws-resources.json` first, regenerate `env.example`, then align MDX export blocks and [Teardown](src/content/docs/deploy-and-operate/teardown.mdx).
