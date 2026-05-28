#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

export const MIRROR_INTEGRITY_SCHEMA = "learning-companion.mirror-integrity-report.v1";

export function buildMirrorIntegrityReport(rootDir, options = {}) {
  const root = resolve(rootDir);
  const files = listFiles(root).sort((a, b) => a.localeCompare(b));
  const fileEntries = files.map((path) => {
    const data = readFileSync(path);
    return {
      path: toRelative(root, path),
      bytes: data.length,
      sha256: createHash("sha256").update(data).digest("hex")
    };
  });
  const links = [];
  const brokenLinks = [];
  let externalLinkCount = 0;

  for (const file of files.filter(isLinkScannable)) {
    const sourcePath = toRelative(root, file);
    const text = readFileSync(file, "utf8");
    for (const link of extractLinks(text)) {
      const resolved = resolveLink(root, file, link.href);
      if (resolved.kind === "external") {
        externalLinkCount += 1;
        continue;
      }
      const record = {
        sourcePath,
        href: link.href,
        line: lineForIndex(text, link.index),
        targetPath: resolved.targetPath,
        status: resolved.ok ? "ok" : "missing"
      };
      links.push(record);
      if (!resolved.ok) brokenLinks.push(record);
    }
  }

  return {
    schema: MIRROR_INTEGRITY_SCHEMA,
    evidence: {
      tier: "EXECUTED",
      label: "EVIDENCE: EXECUTED",
      reason: "Local static mirror folder was walked and every internal HTML/Markdown link was resolved on disk."
    },
    checkedAt: options.checkedAt || new Date().toISOString(),
    root: options.rootLabel || root,
    ok: brokenLinks.length === 0,
    summary: {
      fileCount: fileEntries.length,
      scannedFiles: files.filter(isLinkScannable).length,
      internalLinks: links.length,
      externalLinks: externalLinkCount,
      brokenLinks: brokenLinks.length,
      totalBytes: fileEntries.reduce((sum, file) => sum + file.bytes, 0)
    },
    files: fileEntries,
    links,
    brokenLinks
  };
}

function extractLinks(text) {
  const links = [];
  const htmlHref = /\bhref="([^"]+)"/g;
  const markdownHref = /\]\(([^)]+)\)/g;
  for (const regex of [htmlHref, markdownHref]) {
    for (const match of text.matchAll(regex)) {
      links.push({ href: match[1], index: match.index || 0 });
    }
  }
  return links;
}

function resolveLink(root, sourceFile, href) {
  const raw = String(href || "").trim();
  if (!raw || raw.startsWith("#") || /^(?:https?:|mailto:|data:|javascript:)/i.test(raw)) {
    return { kind: "external" };
  }
  const withoutFragment = raw.split("#")[0].split("?")[0];
  if (!withoutFragment) return { kind: "external" };
  let decoded = withoutFragment;
  try {
    decoded = decodeURIComponent(withoutFragment);
  } catch {
    return { kind: "local", ok: false, targetPath: withoutFragment };
  }
  const target = resolve(dirname(sourceFile), decoded);
  if (!isInside(root, target)) {
    return { kind: "local", ok: false, targetPath: decoded };
  }
  const targetPath = toRelative(root, target);
  return {
    kind: "local",
    ok: existsSync(target) && statSync(target).isFile(),
    targetPath
  };
}

function isLinkScannable(path) {
  return /\.(?:html|md)$/i.test(path);
}

function lineForIndex(text, index) {
  return text.slice(0, index).split("\n").length;
}

function listFiles(root) {
  const paths = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) {
      paths.push(...listFiles(path));
    } else if (entry.isFile()) {
      paths.push(path);
    }
  }
  return paths;
}

function isInside(root, path) {
  const rel = relative(root, path);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function toRelative(root, path) {
  return relative(root, path).split(sep).join("/");
}

function parseArgs(argv) {
  const args = {
    root: "dist/morning-demo/mirror-folder",
    out: "",
    checkedAt: ""
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--root") args.root = argv[++index] || "";
    else if (arg === "--out") args.out = argv[++index] || "";
    else if (arg === "--checked-at") args.checkedAt = argv[++index] || "";
    else if (arg === "--help") {
      console.log("Usage: node scripts/mirror-integrity-check.mjs --root dist/morning-demo/mirror-folder --out dist/morning-demo/MIRROR_INTEGRITY.json");
      process.exit(0);
    }
  }
  return args;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = parseArgs(process.argv.slice(2));
  const report = buildMirrorIntegrityReport(args.root, {
    checkedAt: args.checkedAt,
    rootLabel: args.root
  });
  if (args.out) {
    writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  }
  if (!report.ok) {
    console.error(`mirror_integrity_failed ${report.summary.brokenLinks} broken links`);
    process.exit(1);
  }
  console.log("mirror_integrity_ok");
  if (args.out) console.log(args.out);
}
