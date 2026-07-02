/**
 * Check l10n files for missing translations and parameter consistency
 * Compares all translation files against the base bundle.l10n.json and package.nls.json
 */

const fs = require("node:fs");
const path = require("node:path");

const L10N_DIR = path.join(__dirname, "../l10n");
const BASE_FILE = "bundle.l10n.json";
const ROOT_DIR = path.join(__dirname, "..");
const PACKAGE_NLS_BASE = "package.nls.json";

function loadJson(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to load ${filePath}:`, error.message);
    return null;
  }
}

/**
 * Extract placeholders from a translation string
 * Supports formats: {0}, {1}, {variableName}
 * @param {string} text - The translation text
 * @returns {string[]} - Array of found placeholders (sorted for consistent comparison)
 */
function extractPlaceholders(text) {
  if (typeof text !== "string") {
    return [];
  }

  const placeholders = [];
  let searchFrom = 0;
  while (searchFrom < text.length) {
    const start = text.indexOf("{", searchFrom);
    if (start === -1) break;

    const end = text.indexOf("}", start + 1);
    if (end === -1) break;
    if (end > start + 1) {
      placeholders.push(text.slice(start, end + 1));
    }
    searchFrom = end + 1;
  }

  // Return sorted array for consistent comparison
  return placeholders.toSorted((a, b) => a.localeCompare(b));
}

/**
 * Check if two placeholder arrays are equal
 * @param {string[]} arr1
 * @param {string[]} arr2
 * @returns {boolean}
 */
function placeholdersMatch(arr1, arr2) {
  if (arr1.length !== arr2.length) {
    return false;
  }

  for (let i = 0; i < arr1.length; i++) {
    if (arr1[i] !== arr2[i]) {
      return false;
    }
  }

  return true;
}

function checkFileSet(baseDir, baseFileName, filePattern, sectionTitle) {
  // Load base translation file
  const basePath = path.join(baseDir, baseFileName);
  const baseTranslations = loadJson(basePath);

  if (!baseTranslations) {
    console.error(`Failed to load base file: ${baseFileName}`);
    return { hasIssues: true, coverageStats: [] };
  }

  const baseKeys = Object.keys(baseTranslations);
  console.log(`\n${sectionTitle}`);
  console.log(`📚 Base file (${baseFileName}): ${baseKeys.length} keys\n`);

  const files = fs
    .readdirSync(baseDir)
    .filter((file) => file.startsWith(filePattern) && file !== baseFileName)
    .toSorted((a, b) => a.localeCompare(b));

  if (files.length === 0) {
    console.log("✅ No additional translation files found\n");
    return { hasIssues: false, coverageStats: [] };
  }

  let hasIssues = false;
  const coverageStats = [];

  // Check each translation file
  files.forEach((file) => {
    const filePath = path.join(baseDir, file);
    const translations = loadJson(filePath);

    if (!translations) {
      return;
    }

    const keys = Object.keys(translations);
    const missing = baseKeys.filter((k) => !(k in translations));
    const extra = keys.filter((k) => !(k in baseTranslations));

    // Extract locale name
    let locale;
    if (file.startsWith("bundle.l10n.")) {
      locale = file.replace("bundle.l10n.", "").replace(".json", "");
    } else if (file.startsWith("package.nls.")) {
      locale = file.replace("package.nls.", "").replace(".json", "");
    }

    const coverage =
      baseKeys.length > 0 ? (((keys.length - extra.length) / baseKeys.length) * 100).toFixed(1) : 0;
    coverageStats.push({
      locale,
      coverage: Number.parseFloat(coverage),
      total: baseKeys.length,
      translated: keys.length - extra.length
    });

    console.log(`🌍 ${locale} (${file}): ${keys.length} keys - Coverage: ${coverage}%`);

    if (missing.length > 0) {
      hasIssues = true;
      console.log(`  ⚠️  Missing ${missing.length} translation(s):`);
      missing.forEach((k) => {
        console.log(`     - ${k}: "${baseTranslations[k]}"`);
      });
    }

    if (extra.length > 0) {
      hasIssues = true;
      console.log(`  ⚠️  Extra ${extra.length} key(s) not in base:`);
      extra.forEach((k) => {
        console.log(`     - ${k}`);
      });
    }

    // Check parameter consistency
    const paramIssues = [];
    keys.forEach((key) => {
      if (key in baseTranslations) {
        const basePlaceholders = extractPlaceholders(baseTranslations[key]);
        const translatedPlaceholders = extractPlaceholders(translations[key]);

        if (!placeholdersMatch(basePlaceholders, translatedPlaceholders)) {
          paramIssues.push({
            key,
            base: basePlaceholders,
            translated: translatedPlaceholders,
            baseText: baseTranslations[key],
            translatedText: translations[key]
          });
        }
      }
    });

    if (paramIssues.length > 0) {
      hasIssues = true;
      console.log(`  ⚠️  Parameter mismatch in ${paramIssues.length} translation(s):`);
      paramIssues.forEach((issue) => {
        console.log(`     - ${issue.key}:`);
        console.log(`       Base: "${issue.baseText}" -> [${issue.base.join(", ")}]`);
        console.log(
          `       Translation: "${issue.translatedText}" -> [${issue.translated.join(", ")}]`
        );
      });
    }

    if (missing.length === 0 && extra.length === 0 && paramIssues.length === 0) {
      console.log(`  ✅ Complete`);
    }

    console.log("");
  });

  return { hasIssues, coverageStats };
}

function printCoverageSummary(allStats) {
  if (allStats.length === 0) {
    return;
  }

  console.log("\n📊 Coverage Summary by Language:\n");
  console.log("┌──────────────┬──────────────────┬──────────────────┐");
  console.log("│   Language   │  bundle.l10n.*.  │   package.nls.*  │");
  console.log("├──────────────┼──────────────────┼──────────────────┤");

  // Group stats by locale
  const localeMap = {};
  allStats.forEach((stat) => {
    if (!localeMap[stat.locale]) {
      localeMap[stat.locale] = {};
    }
    localeMap[stat.locale][stat.type] = stat.coverage;
  });

  Object.keys(localeMap)
    .toSorted((a, b) => a.localeCompare(b))
    .forEach((locale) => {
      const localeStats = localeMap[locale];
      const bundleCov = formatCoverage(localeStats.bundle);
      const packageCov = formatCoverage(localeStats.package);

      console.log(
        `│ ${locale.padEnd(12)} │ ${bundleCov.padStart(16)} │ ${packageCov.padStart(16)} │`
      );
    });

  console.log("└──────────────┴──────────────────┴──────────────────┘\n");
}

function formatCoverage(coverage) {
  if (coverage === undefined) return "N/A";
  return `${coverage}%`;
}

function checkTranslations() {
  const allStats = [];

  // Check bundle.l10n.* files
  const bundleResult = checkFileSet(
    L10N_DIR,
    BASE_FILE,
    "bundle.l10n.",
    "=== Checking bundle.l10n.* files ==="
  );
  bundleResult.coverageStats.forEach((stat) => {
    allStats.push({ ...stat, type: "bundle" });
  });

  // Check package.nls.* files
  const packageResult = checkFileSet(
    ROOT_DIR,
    PACKAGE_NLS_BASE,
    "package.nls.",
    "=== Checking package.nls.* files ==="
  );
  packageResult.coverageStats.forEach((stat) => {
    allStats.push({ ...stat, type: "package" });
  });

  // Print coverage summary
  printCoverageSummary(allStats);

  const hasIssues = bundleResult.hasIssues || packageResult.hasIssues;

  if (hasIssues) {
    console.log("⚠️  Translation issues found\n");
    process.exit(1);
  } else {
    console.log("✅ All translations are complete\n");
  }
}

checkTranslations();
