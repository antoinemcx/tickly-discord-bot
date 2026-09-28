/**
 * Checks that locale files are in sync across all languages.
 *
 * Supports two layouts automatically:
 *   directory per locale <dir>/<locale>/<file>.json (for bot translation)
 *   file per locale <dir>/<locale>.json (for web services translation)
 *
 * Usage:
 *   node scripts/check-i18n.mjs [dir1] [dir2] ...
 *   (defaults to all known language directories when no args are given)
 *
 * Exit 0 — everything in sync
 * Exit 1 — at least one mismatch found
 */

import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import process from "node:process";

const DEFAULT_DIRS = [
  "src/bot/languages",
  "src/services/oauth/languages",
];

const dirs = process.argv.slice(2).length > 0 ? process.argv.slice(2) : DEFAULT_DIRS;

/** Recursively flatten an object into dot-separated keys. */
function flattenKeys(obj, prefix = "") {
  return Object.entries(obj).flatMap(([key, value]) => {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    return typeof value === "object" && value !== null && !Array.isArray(value)
      ? flattenKeys(value, fullKey)
      : [fullKey];
  });
}

/** Compare keys of two locales for a given label, returning whether errors were found. */
function compareKeys(referenceKeys, referenceLabel, targetKeys, targetLabel) {
  const missing = [...referenceKeys].filter(k => !targetKeys.has(k));
  const extra = [...targetKeys].filter(k => !referenceKeys.has(k));
  let hasErrors = false;

  if (missing.length) {
    console.error(
      `  ❌ [${targetLabel}] Missing keys (present in ${referenceLabel}):\n    ${missing.join("\n    ")}`,
    );
    hasErrors = true;
  }
  if (extra.length) {
    console.error(
      `  ❌ [${targetLabel}] Extra keys (not in ${referenceLabel}):\n    ${extra.join("\n    ")}`,
    );
    hasErrors = true;
  }

  return hasErrors;
}

// ── dir-per-locale: <dir>/<locale>/<file>.json ───────────────────────────────
function checkDirPerLocale(dir) {
  const locales = readdirSync(dir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  if (locales.length < 2) {
    console.log("  Only one locale found, nothing to compare.");
    return false;
  }

  const [reference, ...others] = locales;
  const referenceFiles = readdirSync(join(dir, reference)).filter(f => f.endsWith(".json"));
  let hasErrors = false;

  // 1. File-level check
  for (const locale of others) {
    const files = readdirSync(join(dir, locale)).filter(f => f.endsWith(".json"));
    const missing = referenceFiles.filter(f => !files.includes(f));
    const extra = files.filter(f => !referenceFiles.includes(f));

    if (missing.length) {
      console.error(`  ❌ [${locale}] Missing files: ${missing.join(", ")}`);
      hasErrors = true;
    }
    if (extra.length) {
      console.error(`  ❌ [${locale}] Extra files not in ${reference}: ${extra.join(", ")}`);
      hasErrors = true;
    }
  }

  // 2. Key-level check (per file)
  for (const file of referenceFiles) {
    const keysByLocale = {};

    for (const locale of locales) {
      const filePath = join(dir, locale, file);
      try {
        const json = JSON.parse(readFileSync(filePath, "utf-8"));
        keysByLocale[locale] = new Set(flattenKeys(json));
      }
      catch {
        console.error(`  ❌ Could not parse ${filePath}`);
        hasErrors = true;
      }
    }

    const referenceKeys = keysByLocale[reference];
    if (!referenceKeys)
      continue;

    let fileSynced = true;
    for (const locale of others) {
      const keys = keysByLocale[locale];
      if (!keys)
        continue;
      if (compareKeys(referenceKeys, `${reference}/${file}`, keys, `${locale}/${file}`)) {
        hasErrors = true;
        fileSynced = false;
      }
    }

    if (fileSynced)
      console.log(`  ✅ ${file}`);
  }

  return hasErrors;
}

// ── file-per-locale: <dir>/<locale>.json
function checkFilePerLocale(dir) {
  const files = readdirSync(dir).filter(f => f.endsWith(".json"));
  const locales = files.map(f => basename(f, ".json"));

  if (locales.length < 2) {
    console.log("  Only one locale found, nothing to compare.");
    return false;
  }

  const [reference, ...others] = locales;
  let referenceKeys;

  try {
    const json = JSON.parse(readFileSync(join(dir, `${reference}.json`), "utf-8"));
    referenceKeys = new Set(flattenKeys(json));
  }
  catch {
    console.error(`  ❌ Could not parse ${reference}.json`);
    return true;
  }

  let hasErrors = false;
  let allSynced = true;

  for (const locale of others) {
    let keys;
    try {
      const json = JSON.parse(readFileSync(join(dir, `${locale}.json`), "utf-8"));
      keys = new Set(flattenKeys(json));
    }
    catch {
      console.error(`  ❌ Could not parse ${locale}.json`);
      hasErrors = true;
      continue;
    }

    if (compareKeys(referenceKeys, `${reference}.json`, keys, `${locale}.json`)) {
      hasErrors = true;
      allSynced = false;
    }
  }

  if (allSynced)
    console.log(`  ✅ ${files.join(", ")}`);
  return hasErrors;
}

// ── Main
let globalErrors = false;

for (const dir of dirs) {
  console.log(`\nChecking: ${dir}`);

  const entries = readdirSync(dir, { withFileTypes: true });
  const hasSubDirs = entries.some(e => e.isDirectory());

  const hasErrors = hasSubDirs ? checkDirPerLocale(dir) : checkFilePerLocale(dir);
  if (hasErrors)
    globalErrors = true;
}

if (globalErrors) {
  console.error("\n❌ Locale files are out of sync.");
  process.exit(1);
}

console.log("\n✅ All locale files are in sync.");
