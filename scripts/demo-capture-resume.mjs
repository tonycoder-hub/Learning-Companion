#!/usr/bin/env node
import { mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { buildCaptureResumeReceipt } from "./capture-resume-receipt.mjs";

const OUT_DIR = "dist/capture-resume";
const OUT_FILE = join(OUT_DIR, "CAPTURE_RESUME_RECEIPT.json");

await rm(OUT_DIR, { recursive: true, force: true });
await mkdir(dirname(OUT_FILE), { recursive: true });
const receipt = buildCaptureResumeReceipt();
await writeFile(OUT_FILE, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");

console.log("capture_resume_ok");
console.log(OUT_FILE);
