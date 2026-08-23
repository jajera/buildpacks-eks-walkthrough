# Terraform (optional)

This walkthrough uses **inline AWS CLI, eksctl, and kubectl commands** in the site docs because they are easier to follow step by step.

## When to add Terraform

Add a `terraform/` module later if you need:

- Reproducible environments across accounts/regions
- Reviewable IAM in one place
- CI-driven infra provisioning

## Suggested module split

| Module | Resources |
|--------|-----------|
| `bootstrap` | CodeCommit repos, ECR repository |
| `eks` | EKS cluster, node group, IRSA for kpack |
| `argocd` | Capability role + policies (when provider supports it) |

Keep **kpack** CRs under `demo/platform/kpack/` and Argo CD Applications as kubectl heredocs in the docs (rendered under `demo/.generated/`) — don't move those into Terraform unless you standardize on a GitOps bootstrap stack.

## What the docs cover today

- CodeCommit + ECR creation (Bootstrap AWS page)
- eksctl cluster (EKS cluster page)
- eksctl IRSA for kpack → ECR (kpack setup page)
- kubectl apply for kpack / Application

## What stays manual for now

- **EKS Capability for Argo CD** — enable via Console or AWS CLI per [AWS docs](https://docs.aws.amazon.com/eks/latest/userguide/argocd.html)

Contributions welcome: a minimal OpenTofu/Terraform module that mirrors the bootstrap and cluster pages without changing the walkthrough flow.
