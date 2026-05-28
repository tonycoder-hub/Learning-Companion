#!/usr/bin/env node
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";

export const FEISHU_UPLOAD_PLAN_SCHEMA = "learning-companion.feishu-upload-plan.v1";

export function validateMirrorBundleForUpload(bundle) {
  if (!bundle || typeof bundle !== "object") {
    throw new Error("Mirror bundle must be a JSON object.");
  }
  if (bundle.schema !== "learning-companion.mirror-bundle.staging.v1") {
    throw new Error("Unsupported mirror bundle schema.");
  }
  if (bundle.contractStability !== "experimental") {
    throw new Error("Unsupported mirror bundle stability.");
  }
  if (bundle.canonical !== "workspace.json") {
    throw new Error("Mirror bundle canonical payload is missing.");
  }
  if (!Array.isArray(bundle.files) || bundle.files.length === 0) {
    throw new Error("Mirror bundle has no files.");
  }
  const canonicalFiles = bundle.files.filter((file) => file?.path === "workspace.json");
  if (canonicalFiles.length !== 1) {
    throw new Error("Mirror bundle must contain exactly one workspace.json file.");
  }
  const seenPaths = new Set();
  return {
    ...bundle,
    files: bundle.files.map((file) => {
      const path = safeMirrorPath(file?.path);
      if (seenPaths.has(path)) {
        throw new Error(`Duplicate mirror path: ${path}`);
      }
      seenPaths.add(path);
      const content = String(file?.content ?? "");
      const bytes = byteLength(content);
      if (Number(file?.bytes || 0) !== bytes) {
        throw new Error(`Mirror file byte count mismatch: ${path}`);
      }
      return {
        path,
        mediaType: String(file?.mediaType || "text/plain"),
        encoding: String(file?.encoding || "utf-8"),
        role: String(file?.role || "unknown"),
        sessionId: String(file?.sessionId || ""),
        sourceFingerprint: String(file?.sourceFingerprint || ""),
        contentFingerprint: String(file?.contentFingerprint || ""),
        bytes,
        content
      };
    })
  };
}

export function buildFeishuUploadPlan(bundle, options = {}) {
  const safeBundle = validateMirrorBundleForUpload(bundle);
  const generatedAt = normalizeIso(options.generatedAt) || new Date().toISOString();
  const rootName = cleanRootName(options.rootName) || "Learning Companion Mirror";
  const files = safeBundle.files.map((file) => ({
    path: file.path,
    role: file.role,
    mediaType: file.mediaType,
    encoding: file.encoding,
    bytes: file.bytes,
    contentFingerprint: file.contentFingerprint,
    action: "upsert"
  }));
  return {
    schema: FEISHU_UPLOAD_PLAN_SCHEMA,
    planVersion: 1,
    generatedAt,
    bundleFingerprint: safeBundle.manifest?.bundleFingerprint || "",
    provider: {
      name: "feishu-drive",
      mode: "one-way-mirror",
      auth: {
        status: "not-included",
        reason: "credential-free-planner"
      }
    },
    source: {
      schema: safeBundle.schema,
      exportedAt: safeBundle.exportedAt,
      bundleFingerprint: safeBundle.manifest?.bundleFingerprint || "",
      fileCount: safeBundle.files.length,
      totalBytes: safeBundle.files.reduce((sum, file) => sum + file.bytes, 0),
      canonical: safeBundle.canonical
    },
    target: {
      rootName,
      layout: "folder-files",
      staleRemoteCleanup: "requires-remote-listing"
    },
    files
  };
}

export function materializeMirrorBundle(bundle, outDir, options = {}) {
  const safeBundle = validateMirrorBundleForUpload(bundle);
  const plan = options.plan || buildFeishuUploadPlan(safeBundle, options);
  const force = Boolean(options.force);
  const root = resolve(outDir);
  const filesRoot = resolve(root, "files");
  mkdirSync(filesRoot, { recursive: true, mode: 0o700 });
  for (const file of safeBundle.files) {
    const target = safeOutputPath(filesRoot, file.path);
    if (!force && existsSync(target)) {
      throw new Error(`Output file already exists: ${file.path}`);
    }
    assertNoSymlinkInExistingPath(filesRoot, dirname(target));
    mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
    assertNoSymlinkInExistingPath(filesRoot, dirname(target));
    if (existsSync(target) && lstatSync(target).isSymbolicLink()) {
      throw new Error(`Refusing to overwrite symbolic link: ${file.path}`);
    }
    writeFileSync(target, file.content, "utf8");
  }
  const planPath = resolve(root, "feishu-upload-plan.json");
  if (!force && existsSync(planPath)) {
    throw new Error("Upload plan already exists.");
  }
  writeFileSync(planPath, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  return {
    schema: "learning-companion.feishu-upload-local-result.v1",
    ok: true,
    outDir: root,
    filesDir: filesRoot,
    planPath,
    fileCount: safeBundle.files.length,
    totalBytes: plan.source.totalBytes,
    bundleFingerprint: plan.source.bundleFingerprint
  };
}

function safeMirrorPath(value) {
  const path = String(value || "").replaceAll("\\", "/");
  if (!path || path.startsWith("/") || path.includes("\0")) {
    throw new Error("Unsafe mirror path.");
  }
  const parts = path.split("/");
  if (parts.some((part) => !part || part === "." || part === ".." || /[\u0000-\u001f<>:"|?*]/.test(part) || isWindowsReservedName(part))) {
    throw new Error("Unsafe mirror path.");
  }
  return parts.join("/");
}

function safeOutputPath(root, virtualPath) {
  const target = resolve(root, virtualPath);
  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    throw new Error("Unsafe output path.");
  }
  return target;
}

function assertNoSymlinkInExistingPath(root, targetDir) {
  const relativePath = relative(root, targetDir);
  if (!relativePath || relativePath === ".") return;
  if (relativePath.startsWith("..") || relativePath.includes(`..${sep}`)) {
    throw new Error("Unsafe output path.");
  }
  let current = root;
  for (const part of relativePath.split(sep).filter(Boolean)) {
    current = resolve(current, part);
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) {
      throw new Error("Refusing to write through symbolic link.");
    }
  }
}

function isWindowsReservedName(value) {
  return /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i.test(value);
}

function cleanRootName(value) {
  return String(value || "").trim().replace(/[\u0000-\u001f/\\:*?"<>|]/g, " ").replace(/\s+/g, " ").slice(0, 120);
}

function normalizeIso(value) {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function byteLength(value) {
  return new Blob([String(value)]).size;
}

function parseArgs(argv) {
  const args = {
    bundle: "",
    out: "",
    planOut: "",
    rootName: "Learning Companion Mirror",
    expectFingerprint: "",
    json: false,
    force: false,
    help: false
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      args.help = true;
    } else if (arg === "--bundle") {
      args.bundle = argv[++index] || "";
    } else if (arg === "--out") {
      args.out = argv[++index] || "";
    } else if (arg === "--plan-out") {
      args.planOut = argv[++index] || "";
    } else if (arg === "--root-name") {
      args.rootName = argv[++index] || "";
    } else if (arg === "--expect-fingerprint") {
      args.expectFingerprint = argv[++index] || "";
    } else if (arg === "--json") {
      args.json = true;
    } else if (arg === "--force") {
      args.force = true;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return args;
}

function usage() {
  return [
    "Usage:",
    "  node scripts/feishu-mirror-uploader.mjs --bundle mirror.json [--out out-dir] [--plan-out plan.json] [--json] [--force]",
    "",
    "This is a credential-free Feishu Drive adapter boundary. It validates a mirror bundle, builds a one-way upload plan,",
    "and optionally materializes the folder files locally. It does not call Feishu OpenAPI. Existing files require --force."
  ].join("\n");
}

function runCli() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }
  if (!args.bundle) {
    throw new Error("Missing --bundle.");
  }
  const bundle = JSON.parse(readFileSync(args.bundle, "utf8"));
  const plan = buildFeishuUploadPlan(bundle, { rootName: args.rootName });
  if (args.expectFingerprint && args.expectFingerprint !== plan.source.bundleFingerprint) {
    throw new Error("Mirror bundle fingerprint mismatch.");
  }
  let result = null;
  if (args.out) {
    result = materializeMirrorBundle(bundle, args.out, { plan, force: args.force });
  }
  if (args.planOut) {
    if (!args.force && existsSync(args.planOut)) {
      throw new Error("Plan output already exists.");
    }
    mkdirSync(dirname(resolve(args.planOut)), { recursive: true, mode: 0o700 });
    writeFileSync(args.planOut, `${JSON.stringify(plan, null, 2)}\n`, "utf8");
  }
  if (!args.out && !args.planOut) {
    console.log(JSON.stringify(plan, null, 2));
  } else if (args.json) {
    console.log(JSON.stringify(result || {
      schema: "learning-companion.feishu-upload-local-result.v1",
      ok: true,
      planPath: resolve(args.planOut),
      fileCount: plan.files.length,
      totalBytes: plan.source.totalBytes,
      bundleFingerprint: plan.source.bundleFingerprint
    }, null, 2));
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
