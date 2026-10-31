// Turns the demo build (dist-demo/) into ONE self-contained index.html: JS, CSS and the favicon inlined.
// Hosts like claude.ai artifacts serve a single page more reliably than a tree of relative files.
import { readFileSync, writeFileSync, rmSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist-demo');
let html = readFileSync(join(dist, 'index.html'), 'utf8');

const asset = (ref) => readFileSync(join(dist, ref.replace(/^\.?\//, '')), 'utf8');
const safeJs = (js) => js.replace(/<\/script/gi, '<\\/script').replace(/<!--/g, '<\\!--');

html = html.replace(/<script type="module"[^>]*src="([^"]+)"[^>]*><\/script>/g, (_, src) => `<script type="module">${safeJs(asset(src))}</script>`);
html = html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_, href) => `<style>${asset(href)}</style>`);
html = html.replace(/<link rel="modulepreload"[^>]*>/g, '');
html = html.replace(/<link rel="(?:apple-touch-icon|manifest)"[^>]*>/g, '');
const favicon = readFileSync(join(root, 'public/favicon.svg'));
html = html.replace(/<link rel="icon"[^>]*>/, `<link rel="icon" href="data:image/svg+xml;base64,${favicon.toString('base64')}" />`);
html = html.replace(/<meta property="og:image"[^>]*>/, '');

if (/(src|href)="\.?\/(assets|icons)/.test(html)) throw new Error('demo html still references external files');
writeFileSync(join(dist, 'index.html'), html);
for (const f of readdirSync(dist)) if (f !== 'index.html') rmSync(join(dist, f), { recursive: true, force: true });
console.log(`dist-demo/index.html: ${(html.length / 1024).toFixed(0)} KB`);
