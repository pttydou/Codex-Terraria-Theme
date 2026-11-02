// Full CSS + actual fixed/random images. Does not connect to the user's app.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../', import.meta.url);
const read = path => fs.readFile(new URL(path, root));
const manifest = JSON.parse(await read('local-presets/MAP_BACKGROUND_SOURCES.json'));
const random = JSON.parse(await read('local-presets/preset-terraria-random/theme.json'));
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE);
const browser = await chromium.launch({headless:true, executablePath:process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
  const page = await browser.newPage();
  await page.route('**/*', r => r.abort());
  await page.setContent(`<html class="codex-dream-skin" data-dream-style="terraria"><style>
    body{margin:0}#conversation{position:relative;width:100%;height:260px}
    #home{position:relative;height:220px}.dream-skin-home-shell{height:180px}
    .app-shell-left-panel{width:280px;height:200px}
    .dream-skin-home-hero{height:180px}
  </style><main id="conversation" class="trskin-main-surface trskin-task-route"></main>
  <main id="home" data-app-shell-main-surface><div role="main" class="trskin-main-surface dream-skin-home-shell"><div class="dream-skin-home"><div class="dream-skin-home-hero"></div></div></div></main>
  <aside class="app-shell-left-panel"></aside><div class="app-shell-left-panel"></div></html>`);
  if (process.env.BEFORE_CSS) {
    const old = await page.addStyleTag({content:await fs.readFile(process.env.BEFORE_CSS,'utf8')});
    await page.evaluate(()=>document.documentElement.dataset.dreamVariant='spider-nest');
    assert.equal(await page.locator('#conversation').evaluate(e=>getComputedStyle(e,'::before').backgroundRepeat),'repeat');
    await old.evaluate(e=>e.remove());
  }
  await page.addStyleTag({content:(await read('assets/dream-skin.css')).toString()});
  let count=0;
  for(const entry of manifest.environments) {
    const fixed = JSON.parse(await read(`local-presets/preset-terraria-${entry.variant}/theme.json`));
    const env = random.environmentPool.find(e=>e.variant===entry.variant);
    // Every random choice must resolve to the new artwork, including formerly
    // deduplicated space/pillar keys; checking only backgroundKey misses a pool.
    const paths = [`local-presets/${fixed.id}/${fixed.image}`,
      ...env.backgroundPool.map(k=>`local-presets/${random.id}/${random.assets[k]}`)];
    for(const path of paths) {
      const bytes=await read(path);
      assert.equal(createHash('sha256').update(bytes).digest('hex'),entry.sha256,path);
      const data='data:image/png;base64,'+bytes.toString('base64');
      for(const width of [800,1728,2560]) {
        await page.setViewportSize({width,height:1000});
        await page.evaluate(async({entry,data})=>{
          const image=new Image();image.src=data;await image.decode();
          if(image.naturalWidth!==115||image.naturalHeight!==65)throw Error('Unexpected map image');
          document.documentElement.dataset.dreamVariant=entry.variant;
          document.documentElement.style.setProperty('--dream-skin-art',`url("${data}")`);
        },{entry,data});
        const surfaces=await page.evaluate(()=>{
          const info=(e,pseudo)=>{const c=getComputedStyle(e,pseudo);return {size:c.backgroundSize,repeat:c.backgroundRepeat,image:c.backgroundImage,pixels:c.imageRendering}};
          return [info(document.querySelector('#conversation'),'::before'),info(document.querySelector('#home')),
            info(document.querySelector('.dream-skin-home-hero')),...[...document.querySelectorAll('.app-shell-left-panel')].map(e=>info(e))];
        });
        for(const s of surfaces) {
          assert.ok(s.image.includes(data),`${entry.variant}: artwork is missing`);
          // A preceding full-surface gradient may use repeat; the last layer
          // is the map image and must never be tiled.
          assert.equal(s.repeat.split(',').at(-1).trim(),'no-repeat',`${entry.variant}: ${s.repeat}`);
          assert.ok(s.size.includes('cover'),`${entry.variant}: ${s.size}`);
          assert.equal(s.pixels,'pixelated');
        }
        assert.equal(await page.locator('.dream-skin-home-shell').evaluate(e=>getComputedStyle(e).backgroundImage),'none','home keeps one outer background');
        count++;
      }
    }
  }
  console.log(`PASS: ${manifest.environments.length} environments, ${count} fixed/random/viewport cases; decoded images, full-scene cover, no repeating wall, legacy/current sidebar, single home canvas.`);
} finally {await browser.close();}
