# Buildpacks on EKS Walkthrough

Hands on EKS lab for Cloud Native Buildpacks with kpack CodeCommit ECR and managed Argo CD.

**Site:** https://buildpacks-eks-walkthrough.johna.kiwi/

## Quick start

```bash
npm install
npm run dev
```

Open the local preview URL (usually http://localhost:4321/).

## Lab assets

Runnable demo under `demo/` — Pulse app, deploy manifests, and walkthrough steps. Follow the site starting at [Prerequisites](https://buildpacks-eks-walkthrough.johna.kiwi/deploy-and-operate/prerequisites/).

AWS resource names for scripts and agents: [`demo/aws-resources.json`](demo/aws-resources.json) — load with `eval "$(node scripts/export-lab-env.mjs)"`.

## Structure

```text
demo/                 Lab app, deploy manifests, platform templates, aws-resources.json
AGENTS.md             Notes for coding agents (points at the inventory)
src/content/docs/     Walkthrough (Astro Starlight)
public/               Favicon and OG image assets
```

## License

See [LICENSE](LICENSE).
