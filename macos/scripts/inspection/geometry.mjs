// Read-only renderer sampling. A deadline also ends the probe when rAF is
// throttled in a background window. No user content or DOM writes are needed.
export function sampleGeometry() {
  return new Promise(resolve => {
    const frames = [], start = performance.now();
    let raf, timer, changedContext = false, firstContext;
    const rect = el => {
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return r.width && r.height ? { x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) } : null;
    };
    const finish = () => { clearTimeout(timer); cancelAnimationFrame(raf); resolve({ frames, changedContext }); };
    const step = () => {
      const composer = document.querySelector('.dream-skin-composer-surface');
      const pane = composer?.closest('[data-app-shell-main-content-layout]');
      const workspace = composer?.closest('[data-app-shell-workspace-layout]');
      const context = JSON.stringify([location.href, innerWidth, innerHeight, devicePixelRatio,
        document.documentElement.getAttribute('data-dream-variant'), workspace?.getAttribute('data-app-shell-workspace-layout'), rect(pane)]);
      firstContext ??= context;
      changedContext ||= context !== firstContext;
      frames.push({ elapsedMs: Math.round(performance.now() - start), composer: rect(composer), pane: rect(pane) });
      if (performance.now() - start >= 2500 || frames.length >= 600) finish();
      else raf = requestAnimationFrame(step);
    };
    timer = setTimeout(finish, 3200);
    step();
  });
}
export const GEOMETRY_EXPRESSION = `(${sampleGeometry.toString()})()`;

export function assessGeometry(observation) {
  const frames = observation?.frames || [];
  if (observation?.changedContext) return { status: 'unknown', detail: '逐帧采样期间页面、窗口或分栏尺寸改变，请静止重测' };
  const gaps = frames.slice(1).map((f, i) => f.elapsedMs - frames[i].elapsedMs);
  if (frames.length < 30 || frames.at(-1).elapsedMs - frames[0].elapsedMs < 2400 || Math.max(...gaps) > 250) {
    return { status: 'unknown', detail: '逐帧证据不足或采样被暂停，不能判定无闪烁' };
  }
  const outside = frames.some(({ composer: c, pane: p }) => c && p && (c.x < p.x - 2 || c.x + c.width > p.x + p.width + 2));
  const changes = new Set(frames.map(f => JSON.stringify(f.composer))).size;
  return { status: outside || changes > 1 ? 'warn' : 'pass',
    detail: `${frames.length} 帧；输入区几何状态 ${changes} 种；${outside ? '输入区超出聊天窗格' : '未发现输入区越界'}` };
}
