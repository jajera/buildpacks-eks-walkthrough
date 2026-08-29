import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const root = process.cwd();
const iconsDir = join(root, "public/diagram-icons");
const svgOut = join(root, "public/og-image.svg");
const pngOut = join(root, "public/og-image.png");

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

function cleanSvgInner(svgText) {
  const stripped = stripSvg(svgText);
  const match = stripped.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  if (!match) throw new Error("Invalid SVG content");
  return match[1]
    .replace(/\bxlink:href=/g, "href=")
    .replace(/<(?:sodipodi|inkscape):[^>]*>/g, "")
    .replace(/<\/(?:sodipodi|inkscape):[^>]*>/g, "")
    .replace(/\s(?:sodipodi|inkscape):[a-zA-Z0-9_-]+="[^"]*"/g, "")
    .replace(/<(?:metadata|title|desc)[\s\S]*?<\/(?:metadata|title|desc)>/gi, "");
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

function loadIcon(id) {
  const localPath = join(iconsDir, `${id}.svg`);
  if (!existsSync(localPath)) {
    throw new Error(`Missing official icon ${localPath} — run npm run generate:diagram first`);
  }
  const svgText = readFileSync(localPath, "utf8");
  return { id, baseInner: cleanSvgInner(svgText), viewBox: getViewBox(svgText) };
}

let iconInstance = 0;

function iconAt(icon, cx, iconY, size) {
  const scopeId = `og-${icon.id}-${iconInstance++}`;
  const inner = scopeIconInner(icon.baseInner, scopeId);
  const viewBox = parseViewBox(icon.viewBox);
  const scale = size / Math.max(viewBox.w, viewBox.h);
  const renderedW = viewBox.w * scale;
  const renderedH = viewBox.h * scale;
  const x = cx - renderedW / 2 - viewBox.x * scale;
  const y = iconY + (size - renderedH) / 2 - viewBox.y * scale;
  return `<g transform="translate(${x} ${y}) scale(${scale})">${inner}</g>`;
}

function iconNode(icon, cx, iconY, labelY, title, subtitle, size) {
  return `${iconAt(icon, cx, iconY, size)}
  <text x="${cx}" y="${labelY}" text-anchor="middle" fill="#f8fafc" font-family="sans-serif" font-size="13" font-weight="600">${title}</text>
  <text x="${cx}" y="${labelY + 14}" text-anchor="middle" fill="#94a3b8" font-family="sans-serif" font-size="11">${subtitle}</text>`;
}

function hArrow(x1, x2, y) {
  return `<line x1="${x1}" y1="${y}" x2="${x2 - 10}" y2="${y}" stroke="#64748b" stroke-width="3"/>
  <polygon points="${x2 - 10},${y - 5} ${x2},${y} ${x2 - 10},${y + 5}" fill="#64748b"/>`;
}

const codecommit = loadIcon("codecommit-dark");
const buildpacks = loadIcon("buildpacks-dark");
const ecr = loadIcon("ecr-dark");
const argo = loadIcon("argo-dark");
const svc = loadIcon("svc");

const cardX = 620;
const cardY = 100;
const cardW = 420;
const cardH = 400;
const leftPad = 28;
const rowW = cardW - leftPad * 2;
const slot = rowW / 3;
const iconSize = 46;

function row(originY, items) {
  const iconY = originY;
  const labelY = originY + iconSize + 14;
  const cy = iconY + iconSize / 2;
  const parts = [];
  for (let i = 0; i < items.length; i += 1) {
    const cx = leftPad + slot * i + slot / 2;
    parts.push(iconNode(items[i].icon, cx, iconY, labelY, items[i].title, items[i].sub, iconSize));
    if (i < items.length - 1) {
      const nextCx = leftPad + slot * (i + 1) + slot / 2;
      parts.push(hArrow(cx + iconSize / 2 + 10, nextCx - iconSize / 2 - 10, cy));
    }
  }
  return parts.join("\n");
}

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630" fill="none">
  <defs>
    <linearGradient id="bg" x1="600" y1="0" x2="600" y2="630" gradientUnits="userSpaceOnUse">
      <stop stop-color="#1a2332"/>
      <stop offset="1" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="accent" x1="96" y1="370" x2="396" y2="370" gradientUnits="userSpaceOnUse">
      <stop stop-color="#7dd3fc"/>
      <stop offset="1" stop-color="#34d399"/>
    </linearGradient>
    <radialGradient id="glow" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(980 100) rotate(90) scale(320)">
      <stop stop-color="#7dd3fc" stop-opacity="0.24"/>
      <stop offset="1" stop-color="#7dd3fc" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#glow)"/>

  <path d="M48 48h72v8H56v64H48V48z" fill="#7dd3fc" fill-opacity="0.55"/>
  <path d="M1080 582h72v-72h8v80h-80z" fill="#ED7100" fill-opacity="0.7"/>
  <rect x="48" y="48" width="104" height="104" stroke="#7dd3fc" stroke-width="2" fill="none" opacity="0.55"/>
  <rect x="1048" y="478" width="104" height="104" stroke="#ED7100" stroke-width="2" fill="none" opacity="0.55"/>

  <text x="96" y="200" fill="#ED7100" font-family="sans-serif" font-size="24" font-weight="700" letter-spacing="2">CLOUD NATIVE BUILDPACKS</text>
  <text x="96" y="276" fill="#f8fafc" font-family="sans-serif" font-size="52" font-weight="700">Buildpacks on EKS</text>
  <text x="96" y="348" fill="#f8fafc" font-family="sans-serif" font-size="52" font-weight="700">Walkthrough</text>
  <rect x="96" y="370" width="300" height="8" rx="4" fill="url(#accent)"/>
  <text x="96" y="420" fill="#94a3b8" font-family="sans-serif" font-size="21" font-weight="500">Source → OCI · no Dockerfile</text>
  <text x="96" y="452" fill="#94a3b8" font-family="sans-serif" font-size="21" font-weight="500">kpack · CodeCommit · managed Argo CD</text>
  <text x="96" y="568" fill="#64748b" font-family="sans-serif" font-size="18">buildpacks-eks-walkthrough.johna.kiwi</text>

  <g transform="translate(${cardX} ${cardY})">
    <rect x="0" y="0" width="${cardW}" height="${cardH}" rx="16" fill="#1e293b" stroke="#475569" stroke-width="2"/>
    <text x="${cardW / 2}" y="32" text-anchor="middle" fill="#e2e8f0" font-family="sans-serif" font-size="14" font-weight="600">One cluster · two CodeCommit repos</text>

    <text x="${leftPad}" y="58" fill="#e2e8f0" font-family="sans-serif" font-size="12" font-weight="600">Build (CNB)</text>
    ${row(72, [
      { icon: codecommit, title: "pulse-app", sub: "source" },
      { icon: buildpacks, title: "kpack", sub: "detect→export" },
      { icon: ecr, title: "ECR", sub: "pulse:main" },
    ])}

    <text x="${leftPad}" y="232" fill="#e2e8f0" font-family="sans-serif" font-size="12" font-weight="600">Deploy (GitOps)</text>
    ${row(252, [
      { icon: codecommit, title: "pulse-deploy", sub: "kpack + base" },
      { icon: argo, title: "Argo CD", sub: "capability" },
      { icon: svc, title: "Pulse", sub: "workload" },
    ])}
  </g>
</svg>
`;

writeFileSync(svgOut, svg);
await sharp(Buffer.from(svg)).resize(1200, 630).png().toFile(pngOut);
console.log(`Wrote ${svgOut}`);
console.log(`Wrote ${pngOut}`);
