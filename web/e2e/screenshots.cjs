// Regenerates the README screenshots in docs/screenshots.
// Needs: API with MOCK_LLM=true on :8000, and the built app served on :4173 (pnpm build && pnpm preview --port 4173).
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const OUT = path.join(__dirname, '../../docs/screenshots');
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const Q = '?autoquality=off';

(async () => {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const mk = async (opts = {}, lang = 'en') => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
    await ctx.addInitScript((l) => {
      localStorage.setItem('3dschool.settings', JSON.stringify({ state: { lang: l, lowGraphics: false, reducedMotion: false, teacherVoice: false }, version: 1 }));
    }, lang);
    return ctx;
  };
  const shot = async (page, name, o = {}) => { await page.screenshot({ path: path.join(OUT, name), ...o }); console.log('  ', name); };
  const open = async (page, route) => { await page.goto(BASE + route + Q); await page.waitForSelector('canvas', { timeout: 20000 }); await page.waitForTimeout(2500); };
  const ask = async (page, re) => { await page.getByRole('button', { name: re }).first().click(); await page.waitForSelector('aside canvas', { timeout: 15000 }); };

  // 1. landing
  let ctx = await mk(); let p = await ctx.newPage();
  await open(p, '/'); await shot(p, '01-landing.png');
  // 2. physics + teacher
  await open(p, '/lab/physics'); await ask(p, /Ask Prof. Karim/);
  await p.getByRole('button', { name: 'What happens on the Moon?' }).click(); await p.waitForTimeout(16000);
  await shot(p, '02-physics-teacher.png');
  // 3. biology cutaway + focus
  await open(p, '/lab/biology');
  await p.getByRole('button', { name: 'Cutaway' }).click();
  await p.getByRole('button', { name: 'Mitochondria' }).click(); await p.waitForTimeout(3500);
  await shot(p, '03-biology-cutaway.png');
  // 4. chemistry reaction glow
  await open(p, '/lab/chemistry');
  await p.getByRole('button', { name: /Go to step 5/ }).click(); await p.waitForTimeout(9500);
  await shot(p, '04-chemistry-reaction.png');
  // 5. chemistry balancing (solved)
  await p.getByRole('tab', { name: 'Balance it' }).click();
  await p.getByRole('button', { name: 'Show the answer' }).click(); await p.waitForTimeout(400);
  await shot(p, '05-chemistry-balance.png');
  // 6. guided tour (works with no API key)
  await open(p, '/lab/physics');
  await p.getByRole('button', { name: /Guided tour/ }).first().click(); await p.waitForTimeout(800);
  const tour = p.getByRole('region', { name: 'Tour narration' });
  await tour.getByRole('button', { name: 'Pause' }).click();
  for (let k = 0; k < 14; k++) { const m = /STEP (\d+) OF/.exec(await tour.innerText()); if (Number(m[1]) === 6) break; await tour.getByRole('button', { name: /^Next/ }).click(); await p.waitForTimeout(120); }
  await p.waitForTimeout(9000);
  await shot(p, '06-guided-tour.png');
  // 7. quiz
  await open(p, '/lab/biology');
  await p.getByRole('button', { name: 'Take the quiz' }).first().click(); await p.waitForSelector('dialog[open]');
  await p.locator('dialog input[type=radio]').nth(2).check(); await p.getByRole('button', { name: 'Check answer' }).click(); await p.waitForTimeout(300);
  await shot(p, '07-quiz.png');
  await ctx.close();
  // 8. Arabic RTL with teacher
  ctx = await mk({}, 'ar'); p = await ctx.newPage();
  await open(p, '/lab/physics'); await ask(p, /اسأل الأستاذ كريم/);
  await p.getByPlaceholder('اطرح سؤالًا…').fill('القمر'); await p.keyboard.press('Enter'); await p.waitForTimeout(15000);
  await shot(p, '08-arabic-rtl.png');
  await ctx.close();
  // 9-10. mobile (390x844, device pixel ratio 2)
  ctx = await mk({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }); p = await ctx.newPage();
  await open(p, '/'); await shot(p, '09-mobile-landing.png');
  await open(p, '/lab/biology'); await p.getByRole('button', { name: 'Ribosomes' }).click(); await p.waitForTimeout(3500);
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(400);
  await shot(p, '10-mobile-biology.png');
  await ctx.close();
  // social preview (1200x630): the hallway with the title
  ctx = await mk({ viewport: { width: 1200, height: 630 } }); p = await ctx.newPage();
  await open(p, '/');
  await p.addStyleTag({ content: 'header,section[aria-labelledby=choose]{display:none!important} section{min-height:630px!important}h1{font-size:68px!important}' });
  await p.waitForTimeout(800);
  await p.screenshot({ path: path.join(__dirname, '../public/og-image.png') });
  console.log('   og-image.png');
  await browser.close();
})();
