#!/usr/bin/env node
/** Export only application source/assets into the ignored, isolated Sites checkout. */
import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
let plugin = process.argv[2] || process.env.SITES_PLUGIN_ROOT;
if (!plugin) {
  const base = path.join(homedir(), '.codex/plugins/cache/openai-curated-remote/sites');
  const versions = (await readdir(base)).sort((a,b) => b.localeCompare(a, undefined, { numeric:true }));
  plugin = path.join(base, versions[0]);
}
plugin = path.resolve(plugin);
const template = path.join(plugin, 'skills/sites/templates/vinext-starter');
const site = path.join(root, 'output/sites/swasthya');
const source = path.join(root, 'apps/web');
const manifest = JSON.parse(await readFile(path.join(root, '.openai/hosting.json'), 'utf8'));
if (!manifest.project_id) throw new Error('Register the Site once and persist its project_id first.');
await mkdir(site, { recursive:true });
if (!existsSync(path.join(site, 'package.json'))) {
  execFileSync(process.execPath, [path.join(plugin, 'scripts/project-setup.mjs')], { cwd:site, stdio:'inherit' });
}
for (const name of ['app','components','lib','public']) {
  await rm(path.join(site, name), { recursive:true, force:true });
  const from = name === 'public' ? path.join(source, name) : path.join(source, 'src', name);
  await cp(from, path.join(site, name), { recursive:true });
}
// Retain the request wrapper supplied by Sites; the app itself uses no connectors.
for (const name of ['connector-context.ts','connector-contract.mts','connector-errors.mts','connector-preview.d.ts']) {
  await cp(path.join(template, 'lib', name), path.join(site, 'lib', name));
}
for (const name of ['hooks','db','drizzle','examples','components.json','drizzle.config.ts']) {
  await rm(path.join(site, name), { recursive:true, force:true });
}
const base = JSON.parse(await readFile(path.join(template, 'package.json'), 'utf8'));
const app = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'));
base.name = 'swasthya-site';
base.dependencies = { ...app.dependencies, react:base.dependencies.react, 'react-dom':base.dependencies['react-dom'], next:base.dependencies.next };
for (const name of ['drizzle-kit','tw-animate-css']) delete base.devDependencies[name];
base.devDependencies['@types/three'] = app.devDependencies['@types/three'];
delete base.scripts['db:generate'];
await writeFile(path.join(site, 'package.json'), JSON.stringify(base,null,2)+'\n');
await writeFile(path.join(site, '.openai/hosting.json'), JSON.stringify({ d1:null, r2:null, ...manifest },null,2)+'\n');
await writeFile(path.join(site, 'README.md'), 'Swasthya: ChatGPT Sites deployment. Canonical application: apps/web. Browser-local data; optional stateless Gemini routes. No local secrets are exported.\n');
console.log(`Prepared ${site}. Install only if dependency inputs changed, then build/package with the Sites helper.`);
