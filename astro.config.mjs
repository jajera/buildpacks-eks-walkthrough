import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import starlightThemeVintage from "starlight-theme-vintage";
import { starlightBasePath } from "starlight-base-path";

export default defineConfig({
  site: "https://buildpacks-eks-walkthrough.johna.kiwi",
  base: "/",
  integrations: [
    starlight({
      title: "Buildpacks on EKS",
      favicon: "/favicon.svg",
      description:
        "Hands on EKS lab for Cloud Native Buildpacks with kpack CodeCommit ECR and managed Argo CD.",
      plugins: [starlightThemeVintage(), starlightBasePath()],
      routeMiddleware: "./src/routeData.ts",
      customCss: ["./src/styles/splash-overrides.css"],
      social: [
        {
          icon: "github",
          label: "GitHub",
          href: "https://github.com/jajera/buildpacks-eks-walkthrough",
        },
      ],
      editLink: {
        baseUrl:
          "https://github.com/jajera/buildpacks-eks-walkthrough/edit/main/",
      },
      lastUpdated: true,
      pagination: true,
      sidebar: [
        { label: "Home", link: "/" },
        {
          label: "Concepts",
          items: [
            { slug: "concepts/what-are-buildpacks" },
            { slug: "concepts/kpack-vs-pack" },
          ],
        },
        {
          label: "Architecture",
          items: [{ slug: "architecture/overview" }],
        },
        {
          label: "Deploy and Operate",
          items: [
            { slug: "deploy-and-operate/prerequisites" },
            { slug: "deploy-and-operate/bootstrap-aws" },
            { slug: "deploy-and-operate/cluster" },
            { slug: "deploy-and-operate/argocd-capability" },
            { slug: "deploy-and-operate/codecommit" },
            { slug: "deploy-and-operate/kpack" },
            { slug: "deploy-and-operate/pulse-gitops" },
            { slug: "deploy-and-operate/prove-buildpacks" },
            { slug: "deploy-and-operate/verify-e2e" },
            { slug: "deploy-and-operate/teardown" },
          ],
        },
        {
          label: "Reference",
          items: [
            { slug: "reference/iam-map" },
            { slug: "reference/manifest-reference" },
            { slug: "reference/troubleshooting" },
          ],
        },
      ],
    }),
  ],
});
