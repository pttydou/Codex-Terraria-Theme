import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import { parseColor, backgroundFor, assessText, assessIcon, assessRun, renderHtml, contextKey } from '../scripts/inspection/report.mjs';
import { parseArgs } from '../scripts/inspect-skin.mjs';
import { assessGeometry } from '../scripts/inspection/geometry.mjs';
import { readScreenshotPng, inspectScreenshotEdges, inspectScreenshotPopovers } from '../scripts/inspection/png.mjs';
const solid = color => ({ color, image: 'none', complex: false });
const text = (fg, bg) => ({ foreground: fg, layers: [solid(bg)], fontSize: 14, fontWeight: 400 });
let count = 0;
const test = (name, run) => { run(); count++; console.log(`  PASS ${name}`); };
test('dark icon on dark panel is flagged', () => assert.equal(assessIcon(text('rgb(26,28,31)', 'rgb(57,37,94)')).status, 'warn'));
test('icon threshold is 3:1 and does not weaken text checks', () => { const c=text('rgb(130,130,130)', 'rgb(0,0,0)'); assert.equal(assessIcon(c).threshold,3); assert.equal(assessText(c).threshold,4.5); });
test('black on white has 21:1 contrast', () => assert.equal(assessText(text('rgb(0,0,0)', 'rgb(255,255,255)')).ratio, 21));
test('white on white is flagged', () => assert.equal(assessText(text('rgb(255,255,255)', 'rgb(255,255,255)')).status, 'warn'));
test('transparent text is flagged', () => assert.equal(assessText(text('rgba(0,0,0,0)', 'rgb(255,255,255)')).ratio, 1));
test('alpha backgrounds composite correctly', () => assert.deepEqual(backgroundFor([solid('rgba(255,255,255,0.5)'), solid('rgb(0,0,0)')]), [127.5,127.5,127.5,1]));
test('unresolved transparency is unknown', () => assert.equal(backgroundFor([solid('rgba(0,0,0,0)')]), null));
test('gradient is unknown', () => assert.equal(backgroundFor([{ color: 'rgb(0,0,0)', image: 'linear-gradient(black,white)' }]), null));
test('opaque child hides ancestor background image', () => assert.deepEqual(backgroundFor([solid('rgb(0,0,0)'), { image: 'url([image])' }]), [0,0,0,1]));
test('ancestor opacity makes contrast unknown', () => assert.equal(backgroundFor([solid('rgb(0,0,0)'), { complex: true }]), null));
test('modern RGB and unsupported colors are handled', () => { assert.deepEqual(parseColor('rgb(20 30 40 / 50%)'), [20,30,40,0.5]); assert.equal(parseColor('color(display-p3 1 1 1)'), null); });
const sample = elapsedMs => ({ elapsedMs, verify: { installed: true, version: 'test', styleEnabled: true,
  frontendCompatibility: { schema: 2, status: 'compatible', safety: { mode: 'normal' }, diagnostics: {},
    adapters: { main: { required: true, status: 'ready' }, composer: { required: true, status: 'ready' } } },
  documentOverflow: { x: false, y: false }, visibleComposerMarkerCount: 1 },
  page: { route: 'conversation', settingsPage: null, themeId: 'theme', environment: 'forest', style: 'terraria',
    viewport: { width: 1000, height: 800, scale: 1 }, fontsStatus: 'loaded',
    surfaces: { main: { count: 1, appearance: { font: 'system' } }, composer: { count: 1, appearance: {} }, settings: { count: 0 } },
    controls: [text('rgb(0,0,0)', 'rgb(255,255,255)')], totalTextRuns: 1,
    musicState: 'ready', musicButton: true, companionCount: 1 } });
const healthy = () => ({ createdAt: 'now', connected: true, version: 'test', expectedThemeId: 'theme',
  geometry: { changedContext: false, frames: Array.from({length:151}, (_,i) => ({elapsedMs: i * 17,
    composer: {x:124,y:600,width:752,height:120}, pane:{x:100,y:0,width:800,height:800}})) },
  samples: [0,500,1200,2500].map(sample), screenshots: ['first.png','last.png'],
  imageEdges: [{status:'pass',candidates:[]},{status:'pass',candidates:[]}] });
const status = (r, id) => assessRun(r).checks.find(c => c.id === id).status;
test('all automated items do not claim complete acceptance', () => { const r = assessRun(healthy()); assert.equal(r.score, 100); assert.equal(r.completeAcceptance, false); assert.ok(r.untested.length >= 7); });
test('offline report has no false pass', () => { const r = assessRun({ connected: false, error:'offline' }); assert.equal(r.score, 0); assert.equal(r.verdict, '发现故障'); });
test('bad popup icon affects report', () => { const r=healthy(); r.samples[0].page.icons=[text('rgb(26,28,31)', 'rgb(57,37,94)')]; assert.equal(status(r,'contrast'),'warn'); });
test('static popup label affects contrast and delayed stability', () => { const r=healthy(); r.samples[3].page.popupText=[text('rgb(26,28,31)', 'rgb(57,37,94)')]; assert.equal(status(r,'contrast'),'warn'); assert.equal(status(r,'stability'),'warn'); assert.equal(assessRun(r).contrastFindings[0].kind,'popup-text'); });
test('truncated popup labels cannot pass contrast', () => { const r=healthy(); r.samples[0].page.totalPopupTextRuns=161; r.samples[0].page.popupText=Array.from({length:160},()=>text('rgb(255,255,255)', 'rgb(0,0,0)')); assert.equal(status(r,'contrast'),'unknown'); });
test('old runtime fails', () => { const r=healthy(); r.samples[0].verify.version='old'; assert.equal(status(r,'runtime'),'fail'); });
test('missing skin fails', () => { const r=healthy(); r.samples[0].verify.installed=false; assert.equal(status(r,'runtime'),'fail'); });
test('theme mismatch fails', () => { const r=healthy(); r.expectedThemeId='other'; assert.equal(status(r,'runtime'),'fail'); });
test('disabled stylesheet fails', () => { const r=healthy(); r.samples[1].verify.styleEnabled=false; assert.equal(status(r,'contract'),'fail'); });
test('safe mode fails even with healthy contract', () => { const r=healthy(); r.samples[1].verify.frontendCompatibility.safety.mode='safe'; assert.equal(status(r,'contract'),'fail'); });
test('duplicate composer fails', () => { const r=healthy(); r.samples[2].page.surfaces.composer.count=2; assert.equal(status(r,'markers'),'fail'); });
test('settings route can omit conversation markers', () => { const r=healthy(); for(const s of r.samples) { s.page.route='settings'; s.page.surfaces.settings.count=1; for(const name of ['main','composer']) {s.verify.frontendCompatibility.adapters[name].required=false; s.page.surfaces[name].count=0;} } assert.equal(status(r,'markers'),'pass'); });
test('overflow in any sample fails', () => { const r=healthy(); r.samples[1].verify.documentOverflow.x=true; assert.equal(status(r,'overflow'),'fail'); });
test('delayed font change is flagged', () => { const r=healthy(); r.samples[3].page.surfaces.main.appearance.font='new'; assert.equal(status(r,'stability'),'warn'); });
test('surface geometry change is flagged even with identical colors', () => { const r=healthy(); r.samples[3].page.surfaces.composer.rect={x:10,width:900}; assert.equal(status(r,'stability'),'warn'); });
test('frame oscillation between four static samples is flagged', () => { const r=healthy(); r.geometry.frames[20].composer.width=1866; assert.equal(status(r,'stability'),'warn'); });
test('stable composer outside its pane is flagged', () => { const r=healthy(); for(const f of r.geometry.frames)f.composer.width=1866; assert.equal(assessGeometry(r.geometry).status,'warn'); });
test('viewport or split change during frames is unknown', () => {const r=healthy();r.geometry.changedContext=true;assert.equal(status(r,'stability'),'unknown');});
test('missing or throttled frame evidence cannot pass', () => {const r=healthy();delete r.geometry;assert.equal(status(r,'stability'),'unknown');assert.equal(assessGeometry({frames:[{elapsedMs:0},{elapsedMs:2500}]}).status,'unknown');});
test('split and full layouts never compare as the same context', () => {const r=healthy(), a=r.samples[0],b=r.samples[1];a.page.workspace={layout:'full'};b.page.workspace={layout:'split'};assert.notEqual(contextKey(a),contextKey(b));});
test('navigation during sampling is unknown', () => { const r=healthy(); r.samples[2].page.route='home'; assert.equal(status(r,'stability'),'unknown'); });
test('incomplete observation cannot pass stability', () => { const r=healthy(); r.samples.pop(); assert.equal(status(r,'stability'),'untested'); });
test('unknown contrast cannot earn points', () => { const r=healthy(); for (const s of r.samples) s.page.controls[0].layers[0].image='url([image])'; assert.equal(status(r,'contrast'),'unknown'); assert.equal(assessRun(r).score,90); });
test('new failures only compared within same context', () => { const old=assessRun(healthy()), r=healthy(); r.samples[0].verify.documentOverflow.x=true; assert.deepEqual(assessRun(r,old).regressions,['overflow']); r.samples[3].page.environment='space'; assert.deepEqual(assessRun(r,old).regressions,[]); assert.notEqual(contextKey(r.samples[3]),old.comparisonKey); });
test('internal white popover flags the visual check', () => { const r=healthy(); r.imageEdges[0].popovers=[{kind:'searchable-picker',status:'warn',brightFraction:.95}]; assert.equal(status(r,'edges'),'warn'); });
test('dark internal sidebar seam is flagged even when window edges pass', () => { const r=healthy(); r.samples[1].page.sidebarEdge={status:'warn',overhang:20}; assert.equal(status(r,'edges'),'warn'); });
test('dark footer paint is flagged without white pixels or document overflow', () => { const r=healthy(); r.samples[1].page.footerDecorations={status:'warn'}; assert.equal(status(r,'edges'),'warn'); });
test('unmeasurable popover cannot pass', () => { const r=healthy(); r.imageEdges[0].popovers=[{status:'unknown'}]; assert.equal(status(r,'edges'),'unknown'); });
test('open popup does not compare against closed state', () => { const r=healthy(), old=assessRun(r); r.samples[3].page.popovers=[{kind:'searchable-picker',rect:{x:10,y:20,width:260,height:160}}]; assert.equal(assessRun(r,old).baseline,null); });
test('report escapes embedded HTML', () => { const r=assessRun({error:'<script>alert(1)</script>'}); const html=renderHtml(r); assert.ok(!html.includes('<script>')); assert.ok(html.includes('&lt;script&gt;')); });
test('CLI validates argument boundaries', () => { for(const args of [['--port'],['--port','0'],['--port','65536'],['--port','1;echo'],['--unknown']]) assert.throws(()=>parseArgs(args)); assert.equal(parseArgs(['--port','1234']).port,'1234'); });
// Tiny synthetic PNG encoder with independent filter deltas; CRC is irrelevant
// to this local screenshot decoder (no PNG writing is performed by the tool).
function png({width=64,height=64,channels=3,filter=0,whiteEdge=false}={}) {
  const rows=[], pixels=Buffer.alloc(width*height*channels);
  for(let y=0;y<height;y++) for(let x=0;x<width;x++) {
    const i=(y*width+x)*channels, color=whiteEdge&&x===0?255:20;
    pixels.fill(color,i,i+3); if(channels===4)pixels[i+3]=255;
  }
  const stride=width*channels;
  for(let y=0;y<height;y++) { const row=Buffer.alloc(stride+1);row[0]=filter;
    for(let x=0;x<stride;x++){const i=y*stride+x,a=x>=channels?pixels[i-channels]:0,b=y?pixels[i-stride]:0,c=y&&x>=channels?pixels[i-stride-channels]:0;
      const p=a+b-c, da=Math.abs(p-a),db=Math.abs(p-b),dc=Math.abs(p-c),pa=da<=db&&da<=dc?a:db<=dc?b:c;
      row[x+1]=(pixels[i]-[0,a,b,Math.floor((a+b)/2),pa][filter])&255;} rows.push(row); }
  const chunk=(type,data)=>{const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(type,4);data.copy(b,8);return b;};
  const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(height,4);header[8]=8;header[9]=channels===3?2:6;
  return {bytes:Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',deflateSync(Buffer.concat(rows))),chunk('IEND',Buffer.alloc(0))]),pixels};
}
for(let filter=0;filter<=4;filter++) test(`PNG filter ${filter} round trips RGB and RGBA`,()=>{for(const channels of [3,4]) {const v=png({filter,channels,whiteEdge:true});assert.deepEqual(readScreenshotPng(v.bytes).pixels,v.pixels);}});
test('screenshot catches a real white edge',()=>assert.equal(inspectScreenshotEdges(png({whiteEdge:true}).bytes).status,'warn'));
test('dark screenshot edges pass',()=>assert.equal(inspectScreenshotEdges(png().bytes).status,'pass'));
test('bad screenshot cannot be interpreted as pass',()=>assert.throws(()=>inspectScreenshotEdges(Buffer.from('invalid'))));
test('popup pixel sampling respects viewport scaling',()=>{const input=png({width:80,height:80});const p=inspectScreenshotPopovers(input.bytes,[{kind:'picker',rect:{x:0,y:0,width:40,height:40}}],{width:40,height:40});assert.equal(p[0].status,'pass');});
test('offscreen popup pixels are unknown',()=>{const p=inspectScreenshotPopovers(png().bytes,[{kind:'picker',rect:{x:900,y:900,width:50,height:50}}],{width:64,height:64});assert.equal(p[0].status,'unknown');});
console.log(`PASS: ${count} inspection behavior scenarios.`);
