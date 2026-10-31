// Accessibility (axe-core, WCAG 2.1 A/AA) + responsive-overflow audit across every route, both languages.
// Usage: pnpm build && pnpm preview --port 4173 &   then   node e2e/audit.cjs   (needs Playwright + a Chromium: npx playwright install chromium)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const axeSource = fs.readFileSync(path.join(__dirname, '../node_modules/axe-core/axe.min.js'), 'utf8');
const ROUTES = ['/', '/lab/physics', '/lab/biology', '/lab/chemistry'];
const WIDTHS = [360, 390, 768, 1280];

(async () => {
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const problems = [];
  const log = (s) => console.log(s);
  for (const lang of ['en', 'ar']) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addInitScript((l) => localStorage.setItem('3dschool.settings', JSON.stringify({ state: { lang: l, lowGraphics: false, reducedMotion: false, teacherVoice: false }, version: 1 })), lang);
    const page = await ctx.newPage();
    const runAxe = async (label) => {
      await page.evaluate(axeSource);
      const res = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] }, resultTypes: ['violations'] }));
      for (const v of res.violations) {
        problems.push(`[axe ${lang}] ${label}: ${v.id} (${v.impact}) x${v.nodes.length} — ${v.help} — e.g. ${v.nodes[0].target.join(' ')}`);
      }
      log(`  axe ${lang} ${label}: ${res.violations.length} violation(s)`);
    };
    const overflow = async (label) => {
      const o = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
      if (o.sw > o.iw + 1) problems.push(`[overflow ${lang}] ${label}: scrollWidth ${o.sw} > viewport ${o.iw}`);
    };
    for (const route of ROUTES) {
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`${BASE}${route}?autoquality=off`);
      await page.waitForSelector('canvas', { timeout: 20000 });
      await page.waitForTimeout(1200);
      await runAxe(route);
      for (const w of WIDTHS) {
        await page.setViewportSize({ width: w, height: 800 });
        await page.waitForTimeout(250);
        await overflow(`${route} @${w}`);
      }
      // fresh load at a phone width (not just a resize of an already-loaded page)
      for (const w of [360, 390]) {
        await page.setViewportSize({ width: w, height: 800 });
        await page.goto(`${BASE}${route}?autoquality=off`);
        await page.waitForSelector('canvas', { timeout: 20000 });
        await page.waitForTimeout(700);
        await overflow(`${route} fresh load @${w}`);
      }
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.goto(`${BASE}${route}?autoquality=off`);
      await page.waitForSelector('canvas', { timeout: 20000 });
      if (route !== '/') {
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.getByRole('button', { name: /Ask |اسأل/ }).first().click();
        await page.waitForTimeout(800);
        await runAxe(`${route} +teacher panel`);
        await page.getByRole('button', { name: /Guided tour|جولة إرشادية/ }).first().click().catch(() => {});
        await page.waitForTimeout(600);
        await runAxe(`${route} +tour card`);
        for (const w of [360, 390]) { await page.setViewportSize({ width: w, height: 800 }); await overflow(`${route} +panel @${w}`); }
        await page.setViewportSize({ width: 1280, height: 900 });
        await page.getByRole('button', { name: /Take the quiz|خوض الاختبار/ }).first().click();
        await page.waitForSelector('dialog[open]');
        await runAxe(`${route} +quiz dialog`);
        await page.keyboard.press('Escape');
      }
    }
    await ctx.close();
  }
  await browser.close();
  log('\n=== RESULT ===');
  if (!problems.length) log('No violations, no overflow.');
  else problems.forEach((p) => log(p));
  process.exit(problems.length ? 1 : 0);
})();
