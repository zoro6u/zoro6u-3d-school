// Performance measurements that are meaningful without a GPU:
//  1. JS main-thread cost per frame at 4x CPU throttle (WebGL disabled, so the numbers are sim + charts + React only)
//  2. GPU-independent render workload: draw calls / triangles per lab (via the ?perf=1 overlay)
//  3. Transfer size of the initial load per route (gzip)
// Usage: pnpm build && pnpm preview --port 4173 &   then   node e2e/perf.cjs
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const BASE = process.env.BASE_URL || 'http://localhost:4173';
const q = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };

(async () => {
  const out = {};
  // ---- 1. JS cost per frame, throttled, no WebGL ----
  const noGl = await chromium.launch({ args: ['--disable-gpu', '--disable-software-rasterizer', '--disable-webgl', '--disable-webgl2'] });
  out.jsFrames = {};
  for (const [name, route] of [['physics', '/lab/physics'], ['chemistry', '/lab/chemistry'], ['biology', '/lab/biology']]) {
    const page = await (await noGl.newContext({ viewport: { width: 412, height: 915 } })).newPage();
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
    await page.goto(`${BASE}${route}?autoquality=off`);
    await page.waitForTimeout(2500);
    if (name === 'chemistry') await page.getByRole('button', { name: /Guided tour/ }).first().click();
    await page.evaluate(() => {
      window.__f = []; window.__lt = 0;
      new PerformanceObserver((l) => { window.__lt += l.getEntries().filter((e) => e.duration > 50).length; }).observe({ entryTypes: ['longtask'] });
      let last = performance.now();
      const tick = (now) => { window.__f.push(now - last); last = now; requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    });
    await page.waitForTimeout(10000);
    const { f, lt } = await page.evaluate(() => ({ f: window.__f.slice(5), lt: window.__lt }));
    const heap = await page.evaluate(() => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null));
    out.jsFrames[name] = { frames: f.length, medianMs: +q(f, 0.5).toFixed(1), p95Ms: +q(f, 0.95).toFixed(1), maxMs: +Math.max(...f).toFixed(1), longTasksOver50ms: lt, heapMB: heap };
  }
  await noGl.close();

  // ---- 2. render workload (software GL is fine: counts don't depend on the GPU) ----
  const gl = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  out.render = {};
  for (const low of [false, true]) {
    const ctx = await gl.newContext({ viewport: { width: 412, height: 915 } });
    await ctx.addInitScript((l) => localStorage.setItem('3dschool.settings', JSON.stringify({ state: { lang: 'en', lowGraphics: l, reducedMotion: false, teacherVoice: false }, version: 1 })), low);
    const page = await ctx.newPage();
    for (const [name, route] of [['landing', '/'], ['physics', '/lab/physics'], ['biology', '/lab/biology'], ['chemistry', '/lab/chemistry']]) {
      await page.goto(`${BASE}${route}?perf=1&autoquality=off`);
      await page.waitForSelector('canvas', { timeout: 20000 });
      await page.waitForTimeout(3500);
      const txt = await page.locator('pre').first().innerText().catch(() => '');
      const n = (k) => Number((new RegExp(k + ' (\\d+)').exec(txt) || [])[1]);
      (out.render[low ? 'low' : 'high'] ??= {})[name] = { drawCalls: n('calls'), triangles: n('tris'), geometries: n('geo'), dpr: Number((/dpr ([\d.]+)/.exec(txt) || [])[1]) };
    }
    await ctx.close();
  }
  await gl.close();

  // ---- 3. transfer sizes ----
  const dist = path.join(__dirname, '../dist/assets');
  const gz = (f) => zlib.gzipSync(fs.readFileSync(path.join(dist, f))).length;
  const files = fs.readdirSync(dist).filter((f) => f.endsWith('.js') || f.endsWith('.css'));
  const find = (re) => files.filter((f) => re.test(f));
  const kb = (fs_) => +(fs_.reduce((s, f) => s + gz(f), 0) / 1024).toFixed(1);
  const html = zlib.gzipSync(fs.readFileSync(path.join(__dirname, '../dist/index.html'))).length / 1024;
  const core = [...find(/^index-.*\.js$/), ...find(/^index-.*\.css$/)];
  const three = find(/react-three-fiber/);
  const lab = (name) => find(new RegExp(`^(${name}|LabShell|layout|Scene3D)-`)); // upper bound: all Scene3D chunks
  out.gzipKB = {
    firstLoadNo3D: +(kb(core) + html).toFixed(1),
    threeAndR3F: kb(three),
    landingTotal: +(kb(core) + kb(three) + kb(find(/^Hallway-/)) + html).toFixed(1),
    labChunks: Object.fromEntries(['physics', 'biology', 'chemistry'].map((n) => [n, kb(find(new RegExp(`^${n}-`)))])),
    sharedLabShell: kb(find(/^LabShell-/)),
    avatar: kb(find(/^Avatar-/)),
  };
  console.log(JSON.stringify(out, null, 2));
  fs.writeFileSync(path.join(__dirname, 'perf-report.json'), JSON.stringify(out, null, 2));
})();
