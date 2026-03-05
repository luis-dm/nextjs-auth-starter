#!/usr/bin/env node
/**
 * BIM Filesystem Builder
 * Converts hierarchical IFC JSON export into a query-friendly filesystem structure
 *
 * Usage:
 *   npx tsx build_bim_fs.ts --input enhancedspatial.json --out bim_fs --force
 *   node build_bim_fs.js --input enhancedspatial.json --out bim_fs --force
 */

import * as fs from "fs/promises";
import * as path from "path";
import { createWriteStream, WriteStream } from "fs";

// ============================================================================
// TYPES
// ============================================================================

interface RawElement {
  category?: string | null;
  localId?: number | string | null;
  name?: string | null;
  properties?: Record<string, any>;
  children?: RawElement[];
  [key: string]: any;
}

interface Element {
  _localId: string;
  _category: string;
  Name?: string;
  ObjectType?: string;
  ContainedInStructure?: string;
  [key: string]: any;
}

interface StoreyInfo {
  name: string;
  slug: string;
  type?:
    | "ground"
    | "basement"
    | "standard"
    | "roof"
    | "parking"
    | "mezzanine"
    | "unknown";
}

interface CLIArgs {
  input: string;
  out: string;
  force: boolean;
  pretty: boolean;
}

// ============================================================================
// CLI ARGUMENT PARSING
// ============================================================================

function parseArgs(): CLIArgs {
  const args = process.argv.slice(2);
  const result: CLIArgs = {
    input: "",
    out: "./bim_fs",
    force: false,
    pretty: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--input" && i + 1 < args.length) {
      result.input = args[++i];
    } else if (arg === "--out" && i + 1 < args.length) {
      result.out = args[++i];
    } else if (arg === "--force") {
      result.force = true;
    } else if (arg === "--pretty") {
      result.pretty = true;
    }
  }

  if (!result.input) {
    console.error("Error: --input <path> is required");
    console.log("\nUsage:");
    console.log(
      "  npx tsx build_bim_fs.ts --input enhancedspatial.json [options]",
    );
    console.log("\nOptions:");
    console.log("  --input <path>    Input JSON file (required)");
    console.log("  --out <path>      Output directory (default: ./bim_fs)");
    console.log("  --force           Overwrite existing output directory");
    console.log("  --pretty          Pretty-print JSON outputs");
    throw new Error("Missing required --input argument");
  }

  return result;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_.-]/g, "")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "");
}

async function ensureCleanOutDir(
  outDir: string,
  force: boolean,
): Promise<void> {
  try {
    await fs.access(outDir);
    if (force) {
      console.log(`Removing existing directory: ${outDir}`);
      await fs.rm(outDir, { recursive: true, force: true });
    } else {
      console.error(
        `Error: Output directory ${outDir} already exists. Use --force to overwrite.`,
      );
      process.exit(1);
    }
  } catch {
    // Directory doesn't exist, which is fine
  }

  // Create directory structure
  const dirs = [
    path.join(outDir, "source"),
    path.join(outDir, "flat"),
    path.join(outDir, "raw", "by_id"),
    path.join(outDir, "index", "by_category"),
    path.join(outDir, "index", "by_storey"),
    path.join(outDir, "schema", "keys_by_category"),
    path.join(outDir, "state"),
  ];

  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }
}

async function writeJson(
  filePath: string,
  obj: any,
  pretty: boolean,
): Promise<void> {
  const json = pretty ? JSON.stringify(obj, null, 2) : JSON.stringify(obj);
  await fs.writeFile(filePath, json + "\n", "utf8");
}

function appendJsonl(stream: WriteStream, obj: any): void {
  stream.write(JSON.stringify(obj) + "\n");
}

// ============================================================================
// INPUT READING & FLATTENING
// ============================================================================

function* flattenTree(
  node: RawElement,
  parentStorey?: string,
): Generator<Element> {
  // Merge properties into the node for easier access
  const merged = { ...node, ...(node.properties || {}) };

  // Extract core fields
  const localId = merged._localId ?? merged.localId;
  const category = merged._category ?? merged.category;
  const name = merged.Name ?? merged.name;

  // Determine storey: use ContainedInStructure if present, else inherit from parent
  const storey = merged.ContainedInStructure || parentStorey || "";

  // Only yield if we have a valid element (has localId and category)
  if (
    localId != null &&
    category &&
    category !== "IFCPROJECT" &&
    category !== "IFCSITE" &&
    category !== "IFCBUILDING" &&
    category !== "IFCBUILDINGSTOREY"
  ) {
    const element: Element = {
      _localId: String(localId),
      _category: String(category),
      ...merged,
    };

    // Ensure ContainedInStructure is set
    if (storey) {
      element.ContainedInStructure = storey;
    }

    delete element.children;
    delete element.properties;

    yield element;
  }

  // Update parent storey if this is a building storey
  const currentStorey =
    category === "IFCBUILDINGSTOREY" ? name || storey : storey;

  // Recursively process children
  if (node.children && Array.isArray(node.children)) {
    for (const child of node.children) {
      yield* flattenTree(child, currentStorey);
    }
  }
}

async function* readInputElements(inputPath: string): AsyncGenerator<Element> {
  const content = await fs.readFile(inputPath, "utf8");
  const data = JSON.parse(content);

  if (Array.isArray(data)) {
    // Array of elements
    for (const item of data) {
      yield* flattenTree(item);
    }
  } else if (typeof data === "object") {
    // Single root object (like your example)
    yield* flattenTree(data);
  } else {
    throw new Error("Unexpected input format: expected array or object");
  }
}

// ============================================================================
// SCHEMA DISCOVERY
// ============================================================================

function buildSchemaCounts(
  element: Element,
  globalCounts: Map<string, number>,
  categoryCounts: Map<string, Map<string, number>>,
): void {
  const category = element._category;

  if (!categoryCounts.has(category)) {
    categoryCounts.set(category, new Map());
  }

  const catMap = categoryCounts.get(category)!;

  for (const key of Object.keys(element)) {
    // Count in global
    globalCounts.set(key, (globalCounts.get(key) || 0) + 1);

    // Count in category
    catMap.set(key, (catMap.get(key) || 0) + 1);
  }
}

// ============================================================================
// STOREY MANAGEMENT
// ============================================================================

function classifyStoreyType(
  storeyName: string,
):
  | "ground"
  | "basement"
  | "standard"
  | "roof"
  | "parking"
  | "mezzanine"
  | "unknown" {
  const name = storeyName.toLowerCase();

  if (/^g(round)?f?(loor)?$|^g$/.test(name)) return "ground";
  if (/^b[a-z0-9_-]*$/.test(name)) return "basement";
  if (/^(r(oof)?|rfl|attic|a)$/i.test(name)) return "roof";
  if (/^p[a-z0-9_-]*$/.test(name)) return "parking";
  if (/^m(e|ezzanine|z)?$/i.test(name)) return "mezzanine";

  return "standard";
}

// ============================================================================
// MAIN PROCESSING
// ============================================================================

export async function buildFilesystem(options: {
  inputFile: string;
  outputDir: string;
  force: boolean;
  pretty?: boolean;
}): Promise<void> {
  const args = {
    input: options.inputFile,
    out: options.outputDir,
    force: options.force,
    pretty: options.pretty || false,
  };

  console.log("BIM Filesystem Builder");
  console.log("======================\n");
  console.log(`Input: ${args.input}`);
  console.log(`Output: ${args.out}`);
  console.log(`Force: ${args.force}`);
  console.log(`Pretty JSON: ${args.pretty}\n`);

  // Setup output directory
  await ensureCleanOutDir(args.out, args.force);

  // Copy source file
  const sourcePath = path.join(args.out, "source", path.basename(args.input));
  await fs.copyFile(args.input, sourcePath);
  console.log(`✓ Copied source to ${sourcePath}`);

  // Initialize tracking structures
  const globalCounts = new Map<string, number>();
  const categoryCounts = new Map<string, Map<string, number>>();
  const storeys = new Map<string, StoreyInfo>();
  const categoryIndexes = new Map<string, Element[]>();
  const storeyIndexes = new Map<string, Element[]>();
  const objectTypes = new Map<string, { category: string; count: number }>();

  // Open flat elements JSONL stream
  const flatStream = createWriteStream(
    path.join(args.out, "flat", "elements.jsonl"),
  );

  let processedCount = 0;
  let errorCount = 0;

  console.log("\nProcessing elements...");

  // Process all elements
  for await (const element of readInputElements(args.input)) {
    try {
      processedCount++;

      if (processedCount % 100 === 0) {
        process.stdout.write(`\rProcessed: ${processedCount} elements`);
      }

      // Schema discovery
      buildSchemaCounts(element, globalCounts, categoryCounts);

      // Track storey
      const storey = element.ContainedInStructure || "";
      if (storey && !storeys.has(storey)) {
        storeys.set(storey, {
          name: storey,
          slug: slugify(storey),
          type: classifyStoreyType(storey),
        });
      }

      const storeySlug = storey ? slugify(storey) : "unknown";

      // Add storeySlug to element for convenience
      element.storeySlug = storeySlug;

      // Track object types
      const objectType = element.ObjectType;
      if (objectType) {
        const key = objectType;
        if (!objectTypes.has(key)) {
          objectTypes.set(key, { category: element._category, count: 0 });
        }
        objectTypes.get(key)!.count++;
      }

      // Write to flat JSONL - full element
      appendJsonl(flatStream, element);

      // Add to category index
      if (!categoryIndexes.has(element._category)) {
        categoryIndexes.set(element._category, []);
      }
      categoryIndexes.get(element._category)!.push(element);

      // Add to storey index
      if (!storeyIndexes.has(storeySlug)) {
        storeyIndexes.set(storeySlug, []);
      }
      storeyIndexes.get(storeySlug)!.push(element);

      // Write raw element
      const rawPath = path.join(
        args.out,
        "raw",
        "by_id",
        `${element._localId}.json`,
      );
      await writeJson(rawPath, element, args.pretty);
    } catch (err) {
      errorCount++;
      console.error(
        `\nWarning: Error processing element ${element._localId}: ${err}`,
      );
    }
  }

  flatStream.end();
  console.log(
    `\n✓ Processed ${processedCount} elements (${errorCount} errors)`,
  );

  // Write schema files
  console.log("\nWriting schema files...");

  // Global keys
  const globalKeysObj = Object.fromEntries(
    Array.from(globalCounts.entries()).sort((a, b) => b[1] - a[1]),
  );
  await writeJson(
    path.join(args.out, "schema", "keys_global.json"),
    globalKeysObj,
    args.pretty,
  );
  console.log("✓ schema/keys_global.json");

  // Per-category keys
  const sortedCategories = Array.from(categoryCounts.keys()).sort();
  for (const category of sortedCategories) {
    const catCounts = categoryCounts.get(category)!;
    const catKeysObj = Object.fromEntries(
      Array.from(catCounts.entries()).sort((a, b) => b[1] - a[1]),
    );
    const catPath = path.join(
      args.out,
      "schema",
      "keys_by_category",
      `${category}.json`,
    );
    await writeJson(catPath, catKeysObj, args.pretty);
  }
  console.log(`✓ schema/keys_by_category/* (${sortedCategories.length} files)`);

  // Categories list
  const categoriesList = sortedCategories.map((cat) => ({
    category: cat,
    count: categoryIndexes.get(cat)?.length || 0,
  }));
  await writeJson(
    path.join(args.out, "schema", "categories.json"),
    categoriesList,
    args.pretty,
  );
  console.log("✓ schema/categories.json");

  // Storeys
  const storeysArray = Array.from(storeys.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  await writeJson(
    path.join(args.out, "schema", "storeys.json"),
    storeysArray,
    args.pretty,
  );
  console.log("✓ schema/storeys.json");

  // Object types
  const objectTypesList = Array.from(objectTypes.entries())
    .map(([objectType, data]) => ({
      objectType,
      category: data.category,
      count: data.count,
    }))
    .sort((a, b) => {
      // Sort by category first, then by count descending
      if (a.category !== b.category) {
        return a.category.localeCompare(b.category);
      }
      return b.count - a.count;
    });
  await writeJson(
    path.join(args.out, "schema", "object_types.json"),
    objectTypesList,
    args.pretty,
  );
  console.log("✓ schema/object_types.json");

  // Write indexes
  console.log("\nWriting indexes...");

  // By category
  for (const [category, records] of categoryIndexes.entries()) {
    const catPath = path.join(
      args.out,
      "index",
      "by_category",
      `${category}.jsonl`,
    );
    const catStream = createWriteStream(catPath);
    for (const record of records) {
      appendJsonl(catStream, record);
    }
    catStream.end();
  }
  console.log(`✓ index/by_category/* (${categoryIndexes.size} files)`);

  // By storey
  for (const [storeySlug, records] of storeyIndexes.entries()) {
    const storeyPath = path.join(
      args.out,
      "index",
      "by_storey",
      `${storeySlug}.jsonl`,
    );
    const storeyStream = createWriteStream(storeyPath);
    for (const record of records) {
      appendJsonl(storeyStream, record);
    }
    storeyStream.end();
  }
  console.log(`✓ index/by_storey/* (${storeyIndexes.size} files)`);

  // Write empty state/last_result.json
  await writeJson(
    path.join(args.out, "state", "last_result.json"),
    {},
    args.pretty,
  );
  console.log("✓ state/last_result.json");

  console.log("\nDone! Filesystem structure created at:", args.out);
}

// ============================================================================
// ENTRY POINT
// ============================================================================

async function main() {
  const args = parseArgs();
  await buildFilesystem({
    inputFile: args.input,
    outputDir: args.out,
    force: args.force,
    pretty: args.pretty,
  });
}

// Only run main if this file is executed directly (not imported)
if (require.main === module) {
  main().catch((err) => {
    console.error("\n❌ Fatal error:", err.message);
    process.exit(1);
  });
}
