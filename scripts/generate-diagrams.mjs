import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import sharp from "sharp";

const root = process.cwd();
const iconsDir = join(root, "public/diagram-icons");
const publicDir = join(root, "public");

const CNCF_ICONS_BASE = "https://jajera.github.io/cncf-icons";
const AWS_ICONS_BASE = "https://jajera.github.io/aws-icons";

const THEMES = {
  dark: {
    name: "dark",
    bgTop: "#1a2332",
    bgBottom: "#0f172a",
    frameStroke: "#475569",
    bandFill: "#1e293b",
    bandStroke: "#475569",
    bandText: "#e2e8f0",
    title: "#f8fafc",
    muted: "#94a3b8",
    arrow: "#64748b",
    panelFill: "#1e293b",
    panelStroke: "#475569",
    panelLabel: "#e2e8f0",
    pillFill: "#334155",
    buildpacksPath: "icons/buildpacks/buildpacks-icon-white.svg",
    argoPath: "icons/argo/argo-icon-color.svg",
  },
  light: {
    name: "light",
    bgTop: "#f8fafc",
    bgBottom: "#e2e8f0",
    frameStroke: "#cbd5e1",
    bandFill: "#f1f5f9",
    bandStroke: "#cbd5e1",
    bandText: "#334155",
    title: "#0f172a",
    muted: "#64748b",
    arrow: "#94a3b8",
    panelFill: "#ffffff",
    panelStroke: "#cbd5e1",
    panelLabel: "#334155",
    pillFill: "#e2e8f0",
    buildpacksPath: "icons/buildpacks/buildpacks-icon-color.svg",
    argoPath: "icons/argo/argo-icon-color.svg",
  },
};

mkdirSync(iconsDir, { recursive: true });

function stripSvg(svgText) {
  return svgText
    .replace(/<\?xml[^?]*\?>/g, "")
    .replace(/<!DOCTYPE[^>]*>/g, "")
    .trim();
}

function scopeIconInner(inner, scopeId) {
  let out = inner;
  const ids = [...out.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
  for (const oldId of [...new Set(ids)]) {
    if (oldId.startsWith(`${scopeId}-`)) continue;
    const newId = `${scopeId}-${oldId}`;
    out = out.replaceAll(`id="${oldId}"`, `id="${newId}"`);
    out = out.replaceAll(`url(#${oldId})`, `url(#${newId})`);
    out = out.replaceAll(`href="#${oldId}"`, `href="#${newId}"`);
  }
  const classNames = new Set();
  for (const m of out.matchAll(/\.([A-Za-z_][\w-]*)\s*\{/g)) classNames.add(m[1]);
  for (const m of out.matchAll(/\bclass="([^"]+)"/g)) {
    for (const c of m[1].trim().split(/\s+/)) if (c) classNames.add(c);
  }
  for (const cls of classNames) {
    if (cls.startsWith(`${scopeId}-`)) continue;
    const scoped = `${scopeId}-${cls}`;
    out = out.replace(new RegExp(`\\.${cls}(?=[\\s{,])`, "g"), `.${scoped}`);
    out = out.replace(new RegExp(`(?<=\\bclass="[^"]*)\\b${cls}\\b`, "g"), scoped);
  }
  return out;
}

/** Drop Illustrator leftover paths that are fill:none with no stroke (edge "tabs"). */
function stripFillNoneJunk(inner) {
  const styleMatch = inner.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  if (!styleMatch) return inner;

  const noneClasses = new Set();
  const ruleRe = /\.([A-Za-z_][\w-]*)\s*\{([^}]*)\}/g;
  let rule;
  while ((rule = ruleRe.exec(styleMatch[1]))) {
    const body = rule[2].replace(/\s+/g, "");
    const hasStroke = /(?:^|;|)stroke:/.test(body) && !/stroke:\s*none/.test(rule[2]);
    const fillNone = /fill:\s*none/.test(rule[2]);
    if (fillNone && !hasStroke) noneClasses.add(rule[1]);
  }

  if (noneClasses.size === 0) return inner;

  let out = inner;
  for (const cls of noneClasses) {
    const tagRe = new RegExp(
      `<(?:path|polygon|polyline|circle|ellipse|rect)\\b[^>]*\\bclass="[^"]*\\b${cls}\\b[^"]*"[^>]*\\/?>`,
      "gi",
    );
    out = out.replace(tagRe, "");
  }
  return out;
}

function cleanSvgInner(svgText) {
  const stripped = stripSvg(svgText);
  const match = stripped.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  if (!match) throw new Error("Invalid SVG content");
  let inner = match[1]
    .replace(/\bxlink:href=/g, "href=")
    .replace(/<(?:sodipodi|inkscape):[^>]*>/g, "")
    .replace(/<\/(?:sodipodi|inkscape):[^>]*>/g, "")
    .replace(/\s(?:sodipodi|inkscape):[a-zA-Z0-9_-]+="[^"]*"/g, "")
    .replace(/<(?:metadata|title|desc)[\s\S]*?<\/(?:metadata|title|desc)>/gi, "");

  return stripFillNoneJunk(inner);
}

function getViewBox(svgText) {
  const stripped = stripSvg(svgText);
  const match = stripped.match(/viewBox="([^"]+)"/i);
  if (match) return match[1];
  const w = Number(stripped.match(/width="(\d+)/i)?.[1] ?? 64);
  const h = Number(stripped.match(/height="(\d+)/i)?.[1] ?? 64);
  return `0 0 ${w} ${h}`;
}

function parseViewBox(viewBox) {
  const [x, y, w, h] = viewBox.split(/\s+/).map(Number);
  return { x, y, w, h };
}

const iconCache = new Map();

async function fetchIcon(id, path, { base = CNCF_ICONS_BASE } = {}) {
  if (iconCache.has(id)) return iconCache.get(id);
  const localPath = join(iconsDir, `${id}.svg`);
  let svgText;
  if (existsSync(localPath)) {
    svgText = readFileSync(localPath, "utf8");
  } else {
    const url = `${base}/${path}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
    svgText = await response.text();
    writeFileSync(localPath, svgText);
  }
  const icon = {
    id,
    baseInner: cleanSvgInner(svgText),
    viewBox: getViewBox(svgText),
  };
  iconCache.set(id, icon);
  return icon;
}

function makeThemeHelpers(theme) {
  let iconInstance = 0;

  function bgGradient(id) {
    return `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1" gradientUnits="objectBoundingBox">
      <stop stop-color="${theme.bgTop}"/>
      <stop offset="1" stop-color="${theme.bgBottom}"/>
    </linearGradient>`;
  }

  function framedRect(width, height, rx = 12) {
    return `<rect width="${width}" height="${height}" rx="${rx}" fill="url(#bg)"/>
  <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="${rx - 1}" stroke="${theme.frameStroke}" stroke-width="1" fill="none" opacity="0.55"/>`;
  }

  function wrapSvg(width, height, content) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" color-scheme="${theme.name}">
  <defs>${bgGradient("bg")}</defs>
  ${framedRect(width, height)}
  ${content}
</svg>`;
  }

  function hArrow(x1, x2, y) {
    return `<line x1="${x1}" y1="${y}" x2="${x2 - 10}" y2="${y}" stroke="${theme.arrow}" stroke-width="2"/>
  <polygon points="${x2 - 10},${y - 5} ${x2},${y} ${x2 - 10},${y + 5}" fill="${theme.arrow}"/>`;
  }

  function vArrow(x, y1, y2) {
    return `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2 - 8}" stroke="${theme.arrow}" stroke-width="2"/>
  <polygon points="${x - 5},${y2 - 8} ${x},${y2} ${x + 5},${y2 - 8}" fill="${theme.arrow}"/>`;
  }

  function nodeLabels(cx, labelY, title, subtitle) {
    let out = `<text x="${cx}" y="${labelY}" text-anchor="middle" fill="${theme.title}" font-family="sans-serif" font-size="13" font-weight="600">${title}</text>`;
    if (subtitle) {
      out += `<text x="${cx}" y="${labelY + 16}" text-anchor="middle" fill="${theme.muted}" font-family="sans-serif" font-size="11">${subtitle}</text>`;
    }
    return out;
  }

  function iconAt(icon, cx, iconY, size) {
    const scopeId = `${icon.id}-${iconInstance++}`;
    const inner = scopeIconInner(icon.baseInner, scopeId);
    const viewBox = parseViewBox(icon.viewBox);
    const scale = size / Math.max(viewBox.w, viewBox.h);
    const renderedW = viewBox.w * scale;
    const renderedH = viewBox.h * scale;
    const x = cx - renderedW / 2 - viewBox.x * scale;
    const y = iconY + (size - renderedH) / 2 - viewBox.y * scale;
    return `<g transform="translate(${x} ${y}) scale(${scale})">${inner}</g>`;
  }

  function iconNode(icon, cx, iconY, labelY, title, subtitle, size = 56) {
    return `${iconAt(icon, cx, iconY, size)}
  ${nodeLabels(cx, labelY, title, subtitle)}`;
  }

  /** Icon + labels anchored from panel bottom so titles sit below icons, not on them. */
  function bottomIconNode(icon, cx, panelBottom, title, subtitle, size = 44, bottomPadding = 24) {
    const labelY = panelBottom - bottomPadding - 16;
    const iconY = labelY - 14 - size;
    return iconNode(icon, cx, iconY, labelY, title, subtitle, size);
  }

  function buildIconRow(icons, startX, rowWidth, iconY, labelY) {
    const slotWidth = rowWidth / icons.length;
    const parts = [];
    for (let i = 0; i < icons.length; i += 1) {
      const entry = icons[i];
      const size = entry.size ?? 56;
      const cx = startX + slotWidth * i + slotWidth / 2;
      parts.push(iconNode(entry.icon, cx, iconY, labelY, entry.label, entry.sublabel, size));
      if (i < icons.length - 1) {
        const nextSize = icons[i + 1].size ?? 56;
        const nextCx = startX + slotWidth * (i + 1) + slotWidth / 2;
        const y = iconY + size / 2;
        parts.push(hArrow(cx + size / 2 + 8, nextCx - nextSize / 2 - 8, y));
      }
    }
    return parts.join("\n");
  }

  function pill(cx, cy, text) {
    const w = text.length * 7 + 24;
    return `<rect x="${cx - w / 2}" y="${cy - 14}" width="${w}" height="28" rx="8" fill="${theme.pillFill}" stroke="${theme.panelStroke}" stroke-width="1"/>
  <text x="${cx}" y="${cy + 4}" text-anchor="middle" fill="${theme.panelLabel}" font-family="sans-serif" font-size="12" font-weight="600">${text}</text>`;
  }

  function mutedLabel(x, y, text, centered = false) {
    const anchor = centered ? "middle" : "start";
    return `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${theme.muted}" font-family="sans-serif" font-size="11">${text}</text>`;
  }

  /** Lay out pills, icons, and downward arrows with consistent vertical spacing. */
  function verticalFlow(cx, startY, steps) {
    let y = startY;
    const parts = [];
    for (const step of steps) {
      if (step.type === "pill") {
        parts.push(pill(cx, y + 14, step.text));
        y += 40;
      } else if (step.type === "icon") {
        const size = step.size ?? 44;
        const labelY = y + size + 16;
        parts.push(iconNode(step.icon, cx, y, labelY, step.title, step.subtitle, size));
        y = labelY + (step.subtitle ? 28 : 16);
      } else if (step.type === "arrow") {
        const gap = step.gap ?? 30;
        const endY = y + gap;
        parts.push(vArrow(cx, y + 2, endY - 8));
        if (step.label) parts.push(mutedLabel(cx, y + 14, step.label, true));
        y = endY;
      }
    }
    return { html: parts.join("\n"), endY: y };
  }

  return {
    wrapSvg,
    hArrow,
    vArrow,
    iconAt,
    iconNode,
    bottomIconNode,
    verticalFlow,
    nodeLabels,
    buildIconRow,
    pill,
    mutedLabel,
    theme,
  };
}

/** Approximate bounding box for icon + title + optional subtitle below the icon. */
function iconStackBox(id, cx, iconY, size, hasSubtitle = true) {
  const half = size / 2;
  const labelY = iconY + size + 16;
  const bottom = hasSubtitle ? labelY + 18 : labelY + 6;
  return { id, x: cx - half, y: iconY, w: size, h: bottom - iconY };
}

function assertLayout(name, boxes, minGap = 8) {
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      const gapX =
        Math.max(a.x, b.x) - Math.min(a.x + a.w, b.x + b.w);
      const gapY =
        Math.max(a.y, b.y) - Math.min(a.y + a.h, b.y + b.h);
      if (gapX < minGap && gapY < minGap) {
        throw new Error(
          `${name}: "${a.id}" overlaps "${b.id}" (gap ${Math.round(gapX)}×${Math.round(gapY)}px)`,
        );
      }
    }
  }
}

async function verifyDiagramRaster(svgPath) {
  const png = await sharp(svgPath).png().toBuffer();
  if (png.length < 1000) {
    throw new Error(`${svgPath}: rasterized PNG looks empty (${png.length} bytes)`);
  }
  execSync(`xmllint --noout "${svgPath}"`, { stdio: "pipe" });
  assertSvgArrows(svgPath);
}

function assertSvgArrows(svgPath, minLen = 10) {
  const svg = readFileSync(svgPath, "utf8");
  const re = /<line x1="([\d.]+)" y1="([\d.]+)" x2="([\d.]+)" y2="([\d.]+)"/g;
  let match;
  while ((match = re.exec(svg)) !== null) {
    const dx = Number(match[3]) - Number(match[1]);
    const dy = Number(match[4]) - Number(match[2]);
    const len = Math.hypot(dx, dy);
    if (len < minLen) {
      throw new Error(
        `${svgPath}: arrow segment too short (${len.toFixed(1)}px) at (${match[1]},${match[2]})→(${match[3]},${match[4]})`,
      );
    }
  }
}

async function buildDockerfileVsBuildpacksDiagram(theme) {
  const h = makeThemeHelpers(theme);
  const suffix = theme.name;

  const [codecommit, buildpacks, ecr, eks, ci] = await Promise.all([
    fetchIcon(`codecommit-${suffix}`, "icons/service/developer/Arch_AWS-CodeCommit_64.svg", {
      base: AWS_ICONS_BASE,
    }),
    fetchIcon(`buildpacks-${suffix}`, theme.buildpacksPath),
    fetchIcon(`ecr-${suffix}`, "icons/service/containers/Arch_Amazon-Elastic-Container-Registry_64.svg", {
      base: AWS_ICONS_BASE,
    }),
    fetchIcon(`eks-${suffix}`, "icons/service/containers/Arch_Amazon-Elastic-Kubernetes-Service_64.svg", {
      base: AWS_ICONS_BASE,
    }),
    fetchIcon("deploy", "icons/k8s-resources/deploy-labeled.svg"),
  ]);

  const width = 1040;
  const height = 380;
  const gap = 24;
  const panelY = 56;
  const panelH = height - panelY - 24;
  const leftX = 24;
  const leftW = (width - 48 - gap) / 2;
  const rightX = leftX + leftW + gap;
  const leftCx = leftX + leftW / 2;
  const rightCx = rightX + leftW / 2;
  const iconY = panelY + 44;
  const rowCy = iconY + 28;
  const labelY = panelY + 118;
  const panelBottom = panelY + panelH;
  const bottomIconSize = 44;
  const bottomLabelY = panelBottom - 24 - 16;
  const bottomIconY = bottomLabelY - 14 - bottomIconSize;
  const rowSpread = 96;

  const content = `
  <text x="${width / 2}" y="34" text-anchor="middle" fill="${theme.title}" font-family="sans-serif" font-size="16" font-weight="600">Same destination — different build ownership</text>

  <rect x="${leftX}" y="${panelY}" width="${leftW}" height="${panelH}" rx="12" fill="${theme.panelFill}" stroke="${theme.panelStroke}" stroke-width="1"/>
  <text x="${leftX + 16}" y="${panelY + 22}" fill="${theme.panelLabel}" font-family="sans-serif" font-size="12" font-weight="600">Per-app Dockerfile</text>
  ${h.iconNode(codecommit, leftCx - rowSpread, iconY, labelY, "CodeCommit", "app source", 48)}
  ${h.hArrow(leftCx - rowSpread + 32, leftCx - 36, rowCy)}
  ${h.pill(leftCx, rowCy, "Dockerfile")}
  ${h.hArrow(leftCx + 36, leftCx + rowSpread - 32, rowCy)}
  ${h.iconNode(ci, leftCx + rowSpread, iconY, labelY, "CI runner", "docker build", 44)}
  ${h.vArrow(leftCx, labelY + 20, bottomIconY - 8)}
  ${h.mutedLabel(leftCx, labelY + 38, "push image", true)}
  ${h.bottomIconNode(ecr, leftCx, panelBottom, "ECR", "OCI image", bottomIconSize)}

  <rect x="${rightX}" y="${panelY}" width="${leftW}" height="${panelH}" rx="12" fill="${theme.panelFill}" stroke="${theme.panelStroke}" stroke-width="1"/>
  <text x="${rightX + 16}" y="${panelY + 22}" fill="${theme.panelLabel}" font-family="sans-serif" font-size="12" font-weight="600">Platform buildpacks (this lab)</text>
  ${h.iconNode(codecommit, rightCx - rowSpread, iconY, labelY, "CodeCommit", "app source only", 48)}
  ${h.hArrow(rightCx - rowSpread + 32, rightCx - 36, rowCy)}
  ${h.iconNode(buildpacks, rightCx, iconY, labelY, "kpack", "CNB on EKS", 48)}
  ${h.hArrow(rightCx + 36, rightCx + rowSpread - 32, rowCy)}
  ${h.iconNode(eks, rightCx + rowSpread, iconY, labelY, "EKS", "build pod", 44)}
  ${h.vArrow(rightCx, labelY + 20, bottomIconY - 8)}
  ${h.mutedLabel(rightCx, labelY + 38, "push image", true)}
  ${h.bottomIconNode(ecr, rightCx, panelBottom, "ECR", "OCI image", bottomIconSize)}
  `;

  return h.wrapSvg(width, height, content);
}

async function buildKpackVsPackDiagram(theme) {
  const h = makeThemeHelpers(theme);
  const suffix = theme.name;

  const [buildpacks, codecommit, ecr] = await Promise.all([
    fetchIcon(`buildpacks-${suffix}`, theme.buildpacksPath),
    fetchIcon(`codecommit-${suffix}`, "icons/service/developer/Arch_AWS-CodeCommit_64.svg", {
      base: AWS_ICONS_BASE,
    }),
    fetchIcon(`ecr-${suffix}`, "icons/service/containers/Arch_Amazon-Elastic-Container-Registry_64.svg", {
      base: AWS_ICONS_BASE,
    }),
  ]);

  const width = 1040;
  const height = 300;
  const gap = 24;
  const panelY = 56;
  const panelH = height - panelY - 24;
  const leftX = 24;
  const leftW = (width - 48 - gap) / 2;
  const rightX = leftX + leftW + gap;
  const leftCx = leftX + leftW / 2;
  const rightCx = rightX + leftW / 2;
  const iconY = panelY + 48;
  const rowCy = iconY + 26;
  const labelY = panelY + 118;
  const rowSpread = 108;
  const panelBottom = panelY + panelH;
  const captionY = panelBottom - 40;

  function panelCaption(panelX, panelW, text) {
    const pad = 16;
    const barW = panelW - pad * 2;
    return `<rect x="${panelX + pad}" y="${captionY}" width="${barW}" height="32" rx="8" fill="${theme.pillFill}" stroke="${theme.panelStroke}" stroke-width="1"/>
  <text x="${panelX + pad + barW / 2}" y="${captionY + 20}" text-anchor="middle" fill="${theme.muted}" font-family="sans-serif" font-size="11">${text}</text>`;
  }

  const content = `
  <text x="${width / 2}" y="34" text-anchor="middle" fill="${theme.title}" font-family="sans-serif" font-size="16" font-weight="600">Same buildpack engine — different where it runs</text>

  <rect x="${leftX}" y="${panelY}" width="${leftW}" height="${panelH}" rx="12" fill="${theme.panelFill}" stroke="${theme.panelStroke}" stroke-width="1"/>
  <text x="${leftX + 16}" y="${panelY + 22}" fill="${theme.panelLabel}" font-family="sans-serif" font-size="12" font-weight="600">pack — laptop or CI</text>
  ${h.pill(leftCx - rowSpread, rowCy, "demo/app")}
  ${h.hArrow(leftCx - rowSpread + 48, leftCx - 30, rowCy)}
  ${h.iconNode(buildpacks, leftCx, iconY, labelY, "pack CLI", "CNB engine", 48)}
  ${h.hArrow(leftCx + 30, leftCx + rowSpread - 48, rowCy)}
  ${h.pill(leftCx + rowSpread, rowCy, "local OCI")}
  ${panelCaption(leftX, leftW, "Manual or CI · you push to registry")}

  <rect x="${rightX}" y="${panelY}" width="${leftW}" height="${panelH}" rx="12" fill="${theme.panelFill}" stroke="${theme.panelStroke}" stroke-width="1"/>
  <text x="${rightX + 16}" y="${panelY + 22}" fill="${theme.panelLabel}" font-family="sans-serif" font-size="12" font-weight="600">kpack — on-cluster (this lab)</text>
  ${h.iconNode(codecommit, rightCx - rowSpread, iconY, labelY, "CodeCommit", "git push", 44)}
  ${h.hArrow(rightCx - rowSpread + 40, rightCx - 28, rowCy)}
  ${h.iconNode(buildpacks, rightCx, iconY, labelY, "kpack", "CNB · build pod", 48)}
  ${h.hArrow(rightCx + 28, rightCx + rowSpread - 40, rowCy)}
  ${h.iconNode(ecr, rightCx + rowSpread, iconY, labelY, "ECR", "IRSA push", 44)}
  ${panelCaption(rightX, leftW, "Poll / webhook · cluster pushes image")}
  `;

  return h.wrapSvg(width, height, content);
}

async function buildLabPipelineDiagram(theme) {
  const h = makeThemeHelpers(theme);
  const suffix = theme.name;

  const [codecommit, buildpacks, ecr, argo, eks, svc] = await Promise.all([
    fetchIcon(`codecommit-${suffix}`, "icons/service/developer/Arch_AWS-CodeCommit_64.svg", {
      base: AWS_ICONS_BASE,
    }),
    fetchIcon(`buildpacks-${suffix}`, theme.buildpacksPath),
    fetchIcon(`ecr-${suffix}`, "icons/service/containers/Arch_Amazon-Elastic-Container-Registry_64.svg", {
      base: AWS_ICONS_BASE,
    }),
    fetchIcon(`argo-${suffix}`, theme.argoPath),
    fetchIcon(`eks-${suffix}`, "icons/service/containers/Arch_Amazon-Elastic-Kubernetes-Service_64.svg", {
      base: AWS_ICONS_BASE,
    }),
    fetchIcon("svc", "icons/k8s-resources/svc-labeled.svg"),
  ]);

  const width = 1040;
  const height = 260;
  const startX = 32;
  const rowWidth = width - 64;
  const iconY = 72;
  const labelY = 148;

  const row = h.buildIconRow(
    [
      { icon: codecommit, label: "CodeCommit", sublabel: "pulse-app", size: 52 },
      { icon: buildpacks, label: "kpack", sublabel: "CNB build", size: 56 },
      { icon: ecr, label: "ECR", sublabel: "pulse:main", size: 52 },
      { icon: argo, label: "Argo CD", sublabel: "pulse-deploy", size: 52 },
      { icon: eks, label: "EKS", sublabel: "workload", size: 52 },
      { icon: svc, label: "Pulse", sublabel: "HTTP service", size: 48 },
    ],
    startX,
    rowWidth,
    iconY,
    labelY,
  );

  const content = `
  <text x="${width / 2}" y="34" text-anchor="middle" fill="${theme.title}" font-family="sans-serif" font-size="16" font-weight="600">Lab pipeline — build on-cluster, deploy with GitOps</text>
  ${row}
  <rect x="48" y="196" width="${width - 96}" height="44" rx="10" fill="${theme.pillFill}" stroke="${theme.panelStroke}" stroke-width="1"/>
  <text x="${width / 2}" y="224" text-anchor="middle" fill="${theme.panelLabel}" font-family="sans-serif" font-size="13">Push source → kpack rebuilds → Argo CD syncs manifests → Pulse serves traffic</text>
  `;

  return h.wrapSvg(width, height, content);
}

async function buildArchitectureDiagram(theme) {
  const h = makeThemeHelpers(theme);
  const suffix = theme.name;

  const [codecommitApp, codecommitDeploy, buildpacks, ecr, argo, svc] = await Promise.all([
    fetchIcon(`codecommit-app-${suffix}`, "icons/service/developer/Arch_AWS-CodeCommit_64.svg", {
      base: AWS_ICONS_BASE,
    }),
    fetchIcon(`codecommit-deploy-${suffix}`, "icons/service/developer/Arch_AWS-CodeCommit_64.svg", {
      base: AWS_ICONS_BASE,
    }),
    fetchIcon(`buildpacks-${suffix}`, theme.buildpacksPath),
    fetchIcon(`ecr-${suffix}`, "icons/service/containers/Arch_Amazon-Elastic-Container-Registry_64.svg", {
      base: AWS_ICONS_BASE,
    }),
    fetchIcon(`argo-${suffix}`, theme.argoPath),
    fetchIcon("svc", "icons/k8s-resources/svc-labeled.svg"),
  ]);

  const width = 1040;
  const height = 260;
  const gap = 24;
  const panelY = 56;
  const panelH = height - panelY - 24;
  const leftX = 24;
  const leftW = (width - 48 - gap) / 2;
  const rightX = leftX + leftW + gap;
  const leftCx = leftX + leftW / 2;
  const rightCx = rightX + leftW / 2;
  const iconY = panelY + 48;
  const rowCy = iconY + 26;
  const labelY = panelY + 118;
  const rowSpread = 108;

  assertLayout(
    "architecture-diagram",
    [
      iconStackBox("pulse-app", leftCx - rowSpread, iconY, 44),
      iconStackBox("kpack", leftCx, iconY, 48),
      iconStackBox("ecr", leftCx + rowSpread, iconY, 44),
      iconStackBox("pulse-deploy", rightCx - rowSpread, iconY, 44),
      iconStackBox("argo", rightCx, iconY, 48),
      iconStackBox("pulse", rightCx + rowSpread, iconY, 44),
    ],
    12,
  );

  const content = `
  <text x="${width / 2}" y="34" text-anchor="middle" fill="${theme.title}" font-family="sans-serif" font-size="16" font-weight="600">Two CodeCommit repos on one EKS cluster</text>

  <rect x="${leftX}" y="${panelY}" width="${leftW}" height="${panelH}" rx="12" fill="${theme.panelFill}" stroke="${theme.panelStroke}" stroke-width="1"/>
  <text x="${leftX + 16}" y="${panelY + 22}" fill="${theme.panelLabel}" font-family="sans-serif" font-size="12" font-weight="600">Build</text>
  ${h.iconNode(codecommitApp, leftCx - rowSpread, iconY, labelY, "pulse-app", "source", 44)}
  ${h.hArrow(leftCx - rowSpread + 40, leftCx - 28, rowCy)}
  ${h.iconNode(buildpacks, leftCx, iconY, labelY, "kpack", "on EKS", 48)}
  ${h.hArrow(leftCx + 28, leftCx + rowSpread - 40, rowCy)}
  ${h.iconNode(ecr, leftCx + rowSpread, iconY, labelY, "ECR", "image", 44)}

  <rect x="${rightX}" y="${panelY}" width="${leftW}" height="${panelH}" rx="12" fill="${theme.panelFill}" stroke="${theme.panelStroke}" stroke-width="1"/>
  <text x="${rightX + 16}" y="${panelY + 22}" fill="${theme.panelLabel}" font-family="sans-serif" font-size="12" font-weight="600">Deploy</text>
  ${h.iconNode(codecommitDeploy, rightCx - rowSpread, iconY, labelY, "pulse-deploy", "manifests", 44)}
  ${h.hArrow(rightCx - rowSpread + 40, rightCx - 28, rowCy)}
  ${h.iconNode(argo, rightCx, iconY, labelY, "Argo CD", "on EKS", 48)}
  ${h.hArrow(rightCx + 28, rightCx + rowSpread - 40, rowCy)}
  ${h.iconNode(svc, rightCx + rowSpread, iconY, labelY, "Pulse", "workload", 44)}
  `;

  return h.wrapSvg(width, height, content);
}

async function buildGitopsStagesDiagram(theme) {
  const h = makeThemeHelpers(theme);
  const suffix = theme.name;

  const [argo, buildpacks, ecr, svc] = await Promise.all([
    fetchIcon(`argo-${suffix}`, theme.argoPath),
    fetchIcon(`buildpacks-${suffix}`, theme.buildpacksPath),
    fetchIcon(`ecr-${suffix}`, "icons/service/containers/Arch_Amazon-Elastic-Container-Registry_64.svg", {
      base: AWS_ICONS_BASE,
    }),
    fetchIcon("svc", "icons/k8s-resources/svc-labeled.svg"),
  ]);

  const width = 1040;
  const height = 300;
  const gap = 16;
  const panelY = 56;
  const panelH = height - panelY - 24;
  const panelW = (width - 48 - gap * 2) / 3;
  const panels = [24, 24 + panelW + gap, 24 + (panelW + gap) * 2];

  function stagePanel(x, stage, title, bodyHtml, caption) {
    return `
  <rect x="${x}" y="${panelY}" width="${panelW}" height="${panelH}" rx="12" fill="${theme.panelFill}" stroke="${theme.panelStroke}" stroke-width="1"/>
  <text x="${x + 16}" y="${panelY + 24}" fill="${theme.muted}" font-family="sans-serif" font-size="11" font-weight="600">${stage}</text>
  <text x="${x + 16}" y="${panelY + 46}" fill="${theme.panelLabel}" font-family="sans-serif" font-size="14" font-weight="600">${title}</text>
  ${bodyHtml}
  <text x="${x + panelW / 2}" y="${panelY + panelH - 18}" text-anchor="middle" fill="${theme.muted}" font-family="sans-serif" font-size="11">${caption}</text>`;
  }

  const c0 = panels[0] + panelW / 2;
  const c1 = panels[1] + panelW / 2;
  const c2 = panels[2] + panelW / 2;
  const iconY = panelY + 70;
  const labelY = panelY + 150;

  const content = `
  <text x="${width / 2}" y="34" text-anchor="middle" fill="${theme.title}" font-family="sans-serif" font-size="16" font-weight="600">Same name “pulse” — three different things</text>

  ${stagePanel(
    panels[0],
    "1 · Platform",
    "Application kpack",
    `${h.iconNode(argo, c0, iconY, labelY, "Argo CD", "path: kpack", 48)}`,
    "Installs controller · webhook",
  )}

  ${stagePanel(
    panels[1],
    "2 · Build",
    "Image CR pulse",
    `${h.iconNode(buildpacks, c1 - 70, iconY, labelY, "build pod", "pulse-build-*", 44)}
  ${h.hArrow(c1 - 36, c1 + 28, iconY + 22)}
  ${h.iconNode(ecr, c1 + 70, iconY, labelY, "ECR", "pulse:main", 44)}`,
    "Not an Argo Application",
  )}

  ${stagePanel(
    panels[2],
    "3 · App",
    "Application pulse",
    `${h.iconNode(argo, c2 - 70, iconY, labelY, "Argo CD", "path: .", 48)}
  ${h.hArrow(c2 - 32, c2 + 28, iconY + 22)}
  ${h.iconNode(svc, c2 + 70, iconY, labelY, "Pulse", "Deploy · Service", 44)}`,
    "Runs the workload",
  )}
  `;

  return h.wrapSvg(width, height, content);
}

async function buildCnbLifecycleDiagram(theme) {
  const h = makeThemeHelpers(theme);
  const suffix = theme.name;

  const [codecommit, buildpacks, ecr] = await Promise.all([
    fetchIcon(`codecommit-${suffix}`, "icons/service/developer/Arch_AWS-CodeCommit_64.svg", {
      base: AWS_ICONS_BASE,
    }),
    fetchIcon(`buildpacks-${suffix}`, theme.buildpacksPath),
    fetchIcon(`ecr-${suffix}`, "icons/service/containers/Arch_Amazon-Elastic-Container-Registry_64.svg", {
      base: AWS_ICONS_BASE,
    }),
  ]);

  const width = 1120;
  const height = 400;
  const bandY = 56;
  const bandH = height - bandY - 48;
  const leftW = 200;
  const rightW = 180;
  const gap = 16;
  const leftX = 24;
  const centerX = leftX + leftW + gap;
  const centerW = width - 48 - leftW - rightW - gap * 2;
  const rightX = centerX + centerW + gap;

  const phases = [
    { n: "1", title: "Analyze", sub: "registry · reuse" },
    { n: "2", title: "Detect", sub: "Paketo Go" },
    { n: "3", title: "Restore", sub: "cache layers" },
    { n: "4", title: "Build", sub: "./cmd/pulse" },
    { n: "5", title: "Export", sub: "push OCI" },
  ];

  const phaseGap = 28;
  const phasePad = 14;
  const phaseW = (centerW - phasePad * 2 - phaseGap * (phases.length - 1)) / phases.length;
  const phaseH = 96;
  const phaseY = bandY + 88;

  let phaseHtml = "";
  for (let i = 0; i < phases.length; i += 1) {
    const p = phases[i];
    const x = centerX + phasePad + i * (phaseW + phaseGap);
    const cx = x + phaseW / 2;
    phaseHtml += `
  <rect x="${x}" y="${phaseY}" width="${phaseW}" height="${phaseH}" rx="10" fill="${theme.pillFill}" stroke="${theme.panelStroke}" stroke-width="1"/>
  <text x="${cx}" y="${phaseY + 28}" text-anchor="middle" fill="${theme.muted}" font-family="sans-serif" font-size="11" font-weight="600">${p.n}</text>
  <text x="${cx}" y="${phaseY + 52}" text-anchor="middle" fill="${theme.title}" font-family="sans-serif" font-size="13" font-weight="600">${p.title}</text>
  <text x="${cx}" y="${phaseY + 74}" text-anchor="middle" fill="${theme.muted}" font-family="sans-serif" font-size="11">${p.sub}</text>`;
    if (i < phases.length - 1) {
      phaseHtml += `
  ${h.hArrow(x + phaseW + 4, x + phaseW + phaseGap - 4, phaseY + phaseH / 2)}`;
    }
  }

  const leftCx = leftX + leftW / 2;
  const rightCx = rightX + rightW / 2;
  const leftIcon1Y = bandY + 40;
  const leftLabel1Y = leftIcon1Y + 54;
  const leftIcon2Y = leftLabel1Y + 56;
  const leftLabel2Y = leftIcon2Y + 54;
  const rightIconY = bandY + 90;
  const rightLabelY = rightIconY + 70;

  const content = `
  <text x="${width / 2}" y="34" text-anchor="middle" fill="${theme.title}" font-family="sans-serif" font-size="16" font-weight="600">CNB lifecycle inside the kpack build pod</text>

  <rect x="${leftX}" y="${bandY}" width="${leftW}" height="${bandH}" rx="12" fill="${theme.panelFill}" stroke="${theme.panelStroke}" stroke-width="1"/>
  <text x="${leftX + 14}" y="${bandY + 24}" fill="${theme.muted}" font-family="sans-serif" font-size="11" font-weight="600">Trigger</text>
  ${h.iconNode(codecommit, leftCx, leftIcon1Y, leftLabel1Y, "pulse-app", "CodeCommit", 40)}
  ${h.vArrow(leftCx, leftLabel1Y + 28, leftIcon2Y - 6)}
  ${h.iconNode(buildpacks, leftCx, leftIcon2Y, leftLabel2Y, "Image CR", "schedules pod", 40)}

  <rect x="${centerX}" y="${bandY}" width="${centerW}" height="${bandH}" rx="12" fill="${theme.panelFill}" stroke="${theme.panelStroke}" stroke-width="1"/>
  <text x="${centerX + 16}" y="${bandY + 24}" fill="${theme.muted}" font-family="sans-serif" font-size="11" font-weight="600">Build pod on EKS</text>
  <text x="${centerX + centerW / 2}" y="${bandY + 52}" text-anchor="middle" fill="${theme.panelLabel}" font-family="sans-serif" font-size="13" font-weight="600">Cloud Native Buildpacks lifecycle</text>
  <text x="${centerX + centerW / 2}" y="${bandY + 72}" text-anchor="middle" fill="${theme.muted}" font-family="sans-serif" font-size="11">Same engine as pack — phases run in order on the cluster</text>
  ${phaseHtml}
  <text x="${centerX + centerW / 2}" y="${bandY + bandH - 20}" text-anchor="middle" fill="${theme.muted}" font-family="sans-serif" font-size="11">Logs: participating buildpacks · go build · Saving pulse:main</text>

  <rect x="${rightX}" y="${bandY}" width="${rightW}" height="${bandH}" rx="12" fill="${theme.panelFill}" stroke="${theme.panelStroke}" stroke-width="1"/>
  <text x="${rightX + 14}" y="${bandY + 24}" fill="${theme.muted}" font-family="sans-serif" font-size="11" font-weight="600">Output</text>
  ${h.iconNode(ecr, rightCx, rightIconY, rightLabelY, "ECR", "pulse:main", 52)}
  ${h.mutedLabel(rightCx, rightLabelY + 36, "IRSA push", true)}

  <text x="${width / 2}" y="${height - 14}" text-anchor="middle" fill="${theme.muted}" font-family="sans-serif" font-size="12">Replaces Dockerfile + CodeBuild docker build / push</text>
  `;

  return h.wrapSvg(width, height, content);
}

async function writeDiagramPair(baseName, build) {
  for (const theme of [THEMES.dark, THEMES.light]) {
    const svg = await build(theme);
    const suffix = theme.name === "dark" ? "" : "-light";
    const svgPath = join(publicDir, `${baseName}${suffix}.svg`);
    writeFileSync(svgPath, svg);
    await verifyDiagramRaster(svgPath);
    console.log(`Wrote ${svgPath}`);
  }
}

await writeDiagramPair("dockerfile-vs-buildpacks-diagram", buildDockerfileVsBuildpacksDiagram);
await writeDiagramPair("kpack-vs-pack-diagram", buildKpackVsPackDiagram);
await writeDiagramPair("lab-pipeline-diagram", buildLabPipelineDiagram);
await writeDiagramPair("architecture-diagram", buildArchitectureDiagram);
await writeDiagramPair("gitops-stages-diagram", buildGitopsStagesDiagram);
await writeDiagramPair("cnb-lifecycle-diagram", buildCnbLifecycleDiagram);
