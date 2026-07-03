// يجلب خط Cairo (وزن 400 و700، مجموعتا arabic وlatin) من Google Fonts
// ويحفظه محليًا في fonts/ ثم يكتب css/fonts.css بمسارات محلية
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const cssUrl = 'https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap';
const res = await fetch(cssUrl, { headers: { 'User-Agent': UA } });
if (!res.ok) throw new Error(`CSS fetch failed: ${res.status}`);
const css = await res.text();

// تقسيم إلى كتل: /* subset */ @font-face { ... }
const blocks = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*@font-face\s*\{([\s\S]*?)\}/g)];
const wanted = blocks.filter((b) => ['arabic', 'latin'].includes(b[1]));
if (!wanted.length) throw new Error('No arabic/latin blocks found');

await mkdir(path.join(root, 'fonts'), { recursive: true });
let out = '/* Cairo — محلي للعمل بدون إنترنت (مولّد بـ tools/fetch-fonts.mjs) */\n';

for (const [, subset, body] of wanted) {
  const weight = body.match(/font-weight:\s*(\d+)/)[1];
  const url = body.match(/url\((https:[^)]+\.woff2)\)/)[1];
  const range = body.match(/unicode-range:\s*([^;]+);/)[1].trim();
  const file = `cairo-${subset}-${weight}.woff2`;
  const bin = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!bin.ok) throw new Error(`Font fetch failed: ${url}`);
  await writeFile(path.join(root, 'fonts', file), Buffer.from(await bin.arrayBuffer()));
  console.log(`saved fonts/${file}`);
  out += `@font-face {
  font-family: 'Cairo';
  font-style: normal;
  font-weight: ${weight};
  font-display: swap;
  src: url(../fonts/${file}) format('woff2');
  unicode-range: ${range};
}\n`;
}

await writeFile(path.join(root, 'css', 'fonts.css'), out);
console.log('wrote css/fonts.css');
