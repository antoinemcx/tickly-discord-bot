/**
 * Checks that locale files are in sync across all languages.
 *
 * Supports two layouts automatically:
 *   directory per locale <dir>/<locale>/<file>.json (for bot translation)
 *   file per locale <dir>/<locale>.json (for web services translation)
 *
 * Also verifies:
 *   - All translation sources have the same set of locales
 *   - All translated locales have an emoji in config.example.json
 *   - Documentation folders (docs/) have the same files across locales
 *
 * Usage:
 *   node scripts/check-i18n.mjs [dir1] [dir2] ...
 *   (defaults to all known language directories when no args are given)
 *
 * Exit 0 — everything in sync
 * Exit 1 — at least one mismatch found
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import process from "node:process";

const DEFAULT_DIRS = [
  "src/bot/languages",
  "src/services/oauth/languages",
];

const CONFIG_PATH = "config.example.json";
const DOCS_DIR = "docs";

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

// ── Cross-source locale consistency check ────────────────────────────────────
/** Get locales from a directory (handles both dir-per-locale and file-per-locale). */
function getLocalesFromDir(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const hasSubDirs = entries.some(e => e.isDirectory());

  if (hasSubDirs) {
    return entries.filter(d => d.isDirectory()).map(d => d.name);
  }
  return entries
    .filter(f => f.isFile() && f.name.endsWith(".json"))
    .map(f => basename(f.name, ".json"));
}

/** Check that all translation sources have the same set of locales. */
function checkLocaleConsistency(dirs) {
  console.log("\nLocale consistency across sources:");

  const localesByDir = {};
  for (const dir of dirs) {
    localesByDir[dir] = new Set(getLocalesFromDir(dir));
  }

  const [referenceDir, ...otherDirs] = dirs;
  const referenceLocales = localesByDir[referenceDir];
  let hasErrors = false;

  for (const dir of otherDirs) {
    const locales = localesByDir[dir];
    const missing = [...referenceLocales].filter(l => !locales.has(l));
    const extra = [...locales].filter(l => !referenceLocales.has(l));

    if (missing.length) {
      console.error(`  ❌ [${dir}] Missing locales (present in ${referenceDir}): ${missing.join(", ")}`);
      hasErrors = true;
    }
    if (extra.length) {
      console.error(`  ❌ [${dir}] Extra locales (not in ${referenceDir}): ${extra.join(", ")}`);
      hasErrors = true;
    }
  }

  if (!hasErrors) {
    console.log(`  ✅ All sources have the same locales: ${[...referenceLocales].join(", ")}`);
  }

  return { hasErrors, locales: referenceLocales };
}

// ── Config emoji check ───────────────────────────────────────────────────────
/** Check that all translated locales have an emoji in config.example.json. */
function checkConfigLanguages(translatedLocales) {
  console.log("\nConfig emoji coverage:");

  if (!existsSync(CONFIG_PATH)) {
    console.error(`  ❌ Config file not found: ${CONFIG_PATH}`);
    return true;
  }

  let configJson;
  try {
    configJson = JSON.parse(readFileSync(CONFIG_PATH, "utf-8"));
  }
  catch {
    console.error(`  ❌ Could not parse ${CONFIG_PATH}`);
    return true;
  }

  const configLocales = new Set(Object.keys(configJson.emotes?.languages || {}));

  // Check that every translated locale has an emoji
  const missing = [...translatedLocales].filter(locale => !configLocales.has(locale));

  if (missing.length) {
    console.error(`  ❌ Locales missing from emotes.languages in ${CONFIG_PATH}: ${missing.join(", ")}`);
    return true;
  }

  console.log(`  ✅ All translated locales have emojis in config`);
  return false;
}

// ── Documentation folder check ───────────────────────────────────────────────
/** Check that docs/ locale folders have the same markdown files. */
function checkDocsFolders() {
  console.log("\nDocumentation folder sync:");

  if (!existsSync(DOCS_DIR)) {
    console.log(`  ⚠️  Docs directory not found: ${DOCS_DIR} (skipping)`);
    return false;
  }

  const entries = readdirSync(DOCS_DIR, { withFileTypes: true });
  const localeDirs = entries.filter(e => e.isDirectory()).map(e => e.name);

  if (localeDirs.length < 2) {
    console.log("  Only one locale folder found, nothing to compare.");
    return false;
  }

  const [reference, ...others] = localeDirs;
  const referenceFiles = readdirSync(join(DOCS_DIR, reference))
    .filter(f => f.endsWith(".md"))
    .sort();

  let hasErrors = false;

  for (const locale of others) {
    const files = readdirSync(join(DOCS_DIR, locale))
      .filter(f => f.endsWith(".md"))
      .sort();

    const missing = referenceFiles.filter(f => !files.includes(f));
    const extra = files.filter(f => !referenceFiles.includes(f));

    if (missing.length) {
      console.error(`  ❌ [docs/${locale}] Missing files (present in docs/${reference}): ${missing.join(", ")}`);
      hasErrors = true;
    }
    if (extra.length) {
      console.error(`  ❌ [docs/${locale}] Extra files (not in docs/${reference}): ${extra.join(", ")}`);
      hasErrors = true;
    }
  }

  if (!hasErrors) {
    console.log(`  ✅ All locale folders have the same files: ${referenceFiles.join(", ")}`);
  }

  return hasErrors;
}

// ── Main ─────────────────────────────────────────────────────────────────────
let globalErrors = false;

// 1. Check individual directories (JSON key sync)
for (const dir of dirs) {
  console.log(`\nChecking: ${dir}`);

  const entries = readdirSync(dir, { withFileTypes: true });
  const hasSubDirs = entries.some(e => e.isDirectory());

  const hasErrors = hasSubDirs ? checkDirPerLocale(dir) : checkFilePerLocale(dir);
  if (hasErrors)
    globalErrors = true;
}

// 2. Check locale consistency across all translation sources
const { hasErrors: localeConsistencyErrors, locales } = checkLocaleConsistency(dirs);
if (localeConsistencyErrors) {
  globalErrors = true;
}

// 3. Check config emoji coverage (only if we have locales)
if (locales.size > 0 && checkConfigLanguages(locales)) {
  globalErrors = true;
}

// 4. Check documentation folder sync
if (checkDocsFolders()) {
  globalErrors = true;
}

if (globalErrors) {
  console.error("\n❌ Locale files are out of sync.");
  process.exit(1);
}

console.log("\n✅ All locale files are in sync.");
