// Renders every app icon from assets/images/logo.svg.
// Run from a folder where Playwright is installed: node make-icons.mjs <path to yami/assets/images/>
import fs from 'node:fs';
import { chromium } from 'playwright';

import { fileURLToPath, pathToFileURL } from 'node:url';
const dir = process.argv[2] ? pathToFileURL(process.argv[2].replace(/[\\/]?$/, '/')) : new URL('../assets/images/', import.meta.url);
const svg = fs.readFileSync(new URL('logo.svg', dir), 'utf8');
const mark = svg.match(/<g id="mark">[\s\S]*<\/g>\s*<\/svg>/)[0].replace(/<\/svg>$/, '');
const BG = '#030308';

// view: crop of the 1254 canvas (smaller = bigger mark). Full canvas keeps the mark inside Android's adaptive-icon safe zone.
const FULL = '0 0 1254 1254';
const TIGHT = '107 104 1040 1040';
const page = (view, { bg, mono } = {}) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${view}" width="100%" height="100%">
  ${bg ? `<rect x="-2000" y="-2000" width="6000" height="6000" fill="${bg}"/>` : ''}
  ${mono ? mark.replace(/#6B3BD9/g, '#FFFFFF').replace(/#F2F0F7/g, '#FFFFFF') : mark}</svg>`;

const outputs = [
  ['icon.png', 1024, page(TIGHT, { bg: BG })],
  ['favicon.png', 48, page(TIGHT, { bg: BG })],
  ['android-icon-foreground.png', 1024, page(FULL)],
  ['android-icon-monochrome.png', 1024, page(FULL, { mono: true })],
  ['android-icon-background.png', 1024, `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%"><rect width="100%" height="100%" fill="${BG}"/></svg>`],
  ['splash-icon.png', 1024, page(TIGHT)],
];

const browser = await chromium.launch({ channel: 'msedge' }).catch(() => chromium.launch());
for (const [name, size, body] of outputs) {
  const p = await browser.newPage({ viewport: { width: size, height: size } });
  await p.setContent(`<html><body style="margin:0;background:transparent">${body}</body></html>`);
  await p.screenshot({ path: fileURLToPath(new URL(name, dir)), omitBackground: true });
  await p.close();
  console.log('wrote', name, size);
}
await browser.close();
