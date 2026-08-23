export type GlossaryEntry =
  | string
  | {
      definition: string;
      url?: string;
      urlLabel?: string;
    };

export const glossary: Record<string, GlossaryEntry> = {
  buildpacks: {
    definition:
      "Cloud Native Buildpacks (CNB) — turn application source into OCI images without a Dockerfile per app.",
    url: "https://buildpacks.io/",
    urlLabel: "buildpacks.io",
  },
  kpack:
    "Kubernetes-native build service that runs CNB builds on-cluster and pushes images to a registry.",
  pack:
    "CLI from the CNB project — builds images locally or in CI using builders and buildpacks.",
  paketo:
    "Paketo Buildpacks — mature open-source builders for Go, Node, Java, Python, and more.",
  codecommit:
    "AWS managed Git hosting — GitHub alternative used for app source and deploy manifests in this lab.",
  ecr:
    "Amazon Elastic Container Registry — stores OCI images built by kpack; EKS pulls from here.",
  eks:
    "Amazon Elastic Kubernetes Service — this lab uses cluster name `cluster-1`.",
  argocd:
    "Argo CD — GitOps controller that syncs cluster state from Git repositories.",
  "argocd-capability":
    "EKS Capability for Argo CD — AWS-managed Argo CD that reads CodeCommit via IAM on the capability role.",
  gitops:
    "Declarative delivery from Git — manifests live in a repository; Argo CD applies changes on sync.",
  irsa:
    "IAM Roles for Service Accounts — pods use a Kubernetes service account annotated with an IAM role ARN.",
  eksctl:
    "CLI for creating and managing EKS clusters — used here for the eval cluster and IRSA.",
  idc: {
    definition:
      "Short for IAM Identity Center — see Identity Center. Lab vars like `IDC_REGION`, `IDC_INSTANCE_ARN`, and `IDC_USER_ID` wire SSO for managed Argo CD (the only supported auth for that capability).",
    url: "https://docs.aws.amazon.com/singlesignon/latest/userguide/what-is.html",
    urlLabel: "IAM Identity Center docs",
  },
  "identity-center": {
    definition:
      "AWS IAM Identity Center (formerly AWS SSO) — organization-wide workforce identity. CLI access uses `aws sso login`. For the EKS managed Argo CD capability it is the only supported UI auth (local Argo CD users are not supported).",
    url: "https://docs.aws.amazon.com/singlesignon/latest/userguide/what-is.html",
    urlLabel: "IAM Identity Center docs",
  },
  pulse:
    "Sample app in this lab — HTTP service monitor with dashboard, API, and Kubernetes health probes.",
  rebase:
    "CNB operation to refresh an app image onto a newer stack without a full rebuild from source.",
};

export function resolveGlossaryEntry(entry: GlossaryEntry | undefined) {
  if (!entry) return { definition: undefined, url: undefined, urlLabel: undefined };
  if (typeof entry === "string") {
    return { definition: entry, url: undefined, urlLabel: undefined };
  }
  return {
    definition: entry.definition,
    url: entry.url,
    urlLabel: entry.urlLabel ?? entry.url,
  };
}
