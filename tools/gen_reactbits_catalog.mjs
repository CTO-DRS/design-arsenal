#!/usr/bin/env node
/**
 * gen_reactbits_catalog.mjs — regenerate skills/react-bits/CATALOG.md + catalog.json
 * from the local react-bits source tree (src/ts-default + src/ts-tailwind).
 *
 * Usage:
 *   node tools/gen_reactbits_catalog.mjs <reactbits-src-dir> <output-dir>
 *
 *   <reactbits-src-dir>  the upstream react-bits `src/` directory containing
 *                        ts-default/ and ts-tailwind/ (each with 5 category dirs)
 *   <output-dir>         where CATALOG.md and catalog.json are written
 *                        (typically skills/react-bits/)
 */
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const [srcDirArg, outDirArg] = process.argv.slice(2);
if (!srcDirArg || !outDirArg) {
  console.error('Usage: node tools/gen_reactbits_catalog.mjs <reactbits-src-dir> <output-dir>');
  process.exit(1);
}
const srcDir = resolve(srcDirArg);
const outDir = resolve(outDirArg);

const FLAVORS = ['ts-default', 'ts-tailwind'];
const CATEGORY_ORDER = ['Animations', 'Backgrounds', 'Components', 'Micro', 'TextAnimations'];

const flavors = {};
const warnings = [];

for (const flavor of FLAVORS) {
  flavors[flavor] = {};
  for (const category of CATEGORY_ORDER) {
    const catDir = join(srcDir, flavor, category);
    let entries;
    try {
      entries = readdirSync(catDir, { withFileTypes: true });
    } catch {
      warnings.push(`missing category dir: ${flavor}/${category}`);
      flavors[flavor][category] = [];
      continue;
    }
    flavors[flavor][category] = entries
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  }
}

const uniqueDefault = new Set(
  Object.values(flavors['ts-default']).flat(),
);
const uniqueTailwind = new Set(
  Object.values(flavors['ts-tailwind']).flat(),
);
const total = uniqueDefault.size;

// Flavor mismatch is informational — upstream usually keeps flavors in sync.
for (const name of uniqueDefault) {
  if (!uniqueTailwind.has(name)) warnings.push(`ts-tailwind missing component: ${name}`);
}

const catalog = {
  name: 'react-bits',
  source: 'https://github.com/DavidHDev/react-bits',
  registry: {
    shadcn: 'https://reactbits.dev/r/{name}.json',
    componentsJson:
      '{"registries":{"@react-bits":"https://reactbits.dev/r/{name}.json"}}',
  },
  install: 'npx shadcn@latest add "@react-bits/<Component>-TS-TW"',
  localUsage: 'Copy from ts-tailwind (Tailwind projects) or ts-default (CSS projects)',
  totalComponents: total,
  flavors,
};

const lines = [];
lines.push('# React Bits — Component Catalog');
lines.push('');
lines.push(`> **${total} components** in ${CATEGORY_ORDER.length} categories · Source: [DavidHDev/react-bits](https://github.com/DavidHDev/react-bits)`);
lines.push('');
lines.push('## How to use');
lines.push('');
lines.push('**Option A — Registry (recommended, always fresh):**');
lines.push('');
lines.push('```bash');
lines.push('# 1. Add registry to components.json in your project root:');
lines.push('#    {"registries": {"@react-bits": "https://reactbits.dev/r/{name}.json"}}');
lines.push('npx shadcn@latest add "@react-bits/SplitText-TS-TW"');
lines.push('```');
lines.push('');
lines.push('**Option B — Local copy (offline, this bundle):**');
lines.push('');
lines.push('- Tailwind projects → copy from `ts-tailwind/<Category>/<Name>/`');
lines.push('- Plain CSS projects → copy from `ts-default/<Category>/<Name>/`');
lines.push('');
lines.push('## Component list (ts-default flavor)');
for (const category of CATEGORY_ORDER) {
  const items = flavors['ts-default'][category];
  lines.push('');
  lines.push(`### ${category} (${items.length})`);
  lines.push('');
  for (const name of items) {
    lines.push(`- ${name}`);
  }
}
lines.push('');
lines.push('');

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'catalog.json'), JSON.stringify(catalog, null, 2));
writeFileSync(join(outDir, 'CATALOG.md'), lines.join('\n'));

console.log(`catalog written: ${total} components across ${CATEGORY_ORDER.length} categories`);
if (warnings.length) {
  console.log('warnings:');
  for (const w of warnings) console.log(`  - ${w}`);
}
