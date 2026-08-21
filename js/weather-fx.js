"use strict";
/* ============================================================
   天気パーティクル（canvas）
   ============================================================ */
let W = 0, H = 0, DPR = 1;
function resize(){
  const r = stage.getBoundingClientRect();
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  W = r.width; H = r.height;
  fx.width  = Math.max(1, Math.round(W * DPR));
  fx.height = Math.max(1, Math.round(H * DPR));
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  buildStars();
}
new ResizeObserver(resize).observe(stage);
window.addEventListener('resize', resize);

function clipPanes(){
  ctx.beginPath();
  for (const p of PANES){
    ctx.rect(p.x / 100 * W, p.y / 100 * H, p.w / 100 * W, p.h / 100 * H);
  }
  ctx.clip();
}

// --- 星 ---
let stars = [];
function buildStars(){
  stars = [];
  for (let i = 0; i < 90; i++){
    const p = PANES[Math.floor(Math.random() * PANES.length)];
    const y = rand(p.y, p.y + p.h * .62);
    if (y > 46) continue;
    stars.push({
      x: rand(p.x, p.x + p.w) / 100 * W,
      y: y / 100 * H,
      r: rand(.5, 1.5),
      ph: Math.random() * Math.PI * 2,
      sp: rand(.5, 1.8),
    });
  }
}

// --- 雲 ---
const clouds = Array.from({length: 7}, () => ({
  x: Math.random(), y: rand(.02, .26), s: rand(.10, .24), v: rand(.0035, .011), a: rand(.05, .13),
}));

// --- 雨・雪 ---
let drops = [], flakes = [], glass = [], motes = [];
function buildRain(){
  drops = Array.from({length: 300}, () => ({
    x: Math.random(), y: Math.random(), len: rand(.03, .075), v: rand(.85, 1.5), a: rand(.3, .72),
  }));
  glass = Array.from({length: 40}, () => ({
    x: Math.random(), y: Math.random() * .78, r: rand(1.6, 4.8), v: rand(.004, .022), a: rand(.2, .45),
  }));
}
function buildSnow(){
  flakes = Array.from({length: 150}, () => ({
    x: Math.random(), y: Math.random(), r: rand(1.2, 3.6), v: rand(.022, .062),
    ph: Math.random() * Math.PI * 2, sw: rand(.004, .016), a: rand(.45, .95),
  }));
}
function buildMotes(){
  motes = Array.from({length: 46}, () => ({
    x: Math.random(), y: rand(.25, .95), r: rand(.7, 2.1),
    vx: rand(-.006, .012), vy: rand(-.012, -.002), ph: Math.random() * 6.28, a: rand(.10, .34),
  }));
}
buildRain(); buildSnow(); buildMotes();

function drawFx(dt, now){
  ctx.clearRect(0, 0, W, H);
  const h = state.hour;
  const night = nightAmount(h);
  const day = 1 - night;

  /* ---- 窓の外（ガラスの中だけ） ---- */
  ctx.save();
  clipPanes();

  // 窓の外だけ深く沈める（室内はランプで暖かいまま）
  // 専用の夜画像があるときは既に暗いので、この処理は弱める。
  const baked = bakedAmount;
  if (night > .01){
    ctx.fillStyle = `rgba(10,18,48,${(night * .50 * (1 - .85 * baked)).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }
  if (state.weather === 'rain'){
    ctx.fillStyle = `rgba(96,112,134,${(.12 + day * .08).toFixed(3)})`;
    ctx.fillRect(0, 0, W, H);
  }

  // 朝焼け・夕焼けの光（窓の外の空に低くひろがる）
  const gold = goldenAmount(h);
  if (gold.amt > .01 && state.weather !== 'rain'){
    const a = gold.amt * (state.weather === 'snow' ? .55 : 1) * (1 - .8 * baked);
    const cx = gold.x * W, cy = H * .46;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * .62);
    g.addColorStop(0,  `rgba(${gold.warm.join(',')},${(.50 * a).toFixed(3)})`);
    g.addColorStop(.35,`rgba(${gold.warm.join(',')},${(.26 * a).toFixed(3)})`);
    g.addColorStop(1,  `rgba(${gold.warm.join(',')},0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const hz = ctx.createLinearGradient(0, H * .10, 0, H * .52);
    hz.addColorStop(0, `rgba(${gold.warm.join(',')},0)`);
    hz.addColorStop(1, `rgba(${gold.warm.join(',')},${(.30 * a).toFixed(3)})`);
    ctx.fillStyle = hz;
    ctx.fillRect(0, 0, W, H * .52);
  }

  // 星
  if (night > .02){
    for (const s of stars){
      const tw = .55 + .45 * Math.sin(now * .0013 * s.sp + s.ph);
      // 夜画像には星が描かれているので、こちらは瞬き役として控えめに足す
      ctx.globalAlpha = night * tw * .92 * (1 - .55 * baked);
      ctx.fillStyle = '#fff8e8';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.2832); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // 流れる薄い雲
  const cloudA = state.weather === 'clear' ? .55 : 1;
  for (const c of clouds){
    c.x += c.v * dt * (state.weather === 'rain' ? 1.7 : 1);
    if (c.x > 1.35) c.x = -.35;
    const cx = c.x * W, cy = c.y * H, cr = c.s * W;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, cr);
    const tint = night > .5 ? '215,220,240' : (state.weather === 'rain' ? '190,196,206' : '255,255,255');
    g.addColorStop(0,   `rgba(${tint},${(c.a * cloudA * (.35 + day * .65)).toFixed(3)})`);
    g.addColorStop(.55, `rgba(${tint},${(c.a * cloudA * .35 * (.35 + day * .65)).toFixed(3)})`);
    g.addColorStop(1,   `rgba(${tint},0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(cx, cy, cr, cr * .42, 0, 0, 6.2832); ctx.fill();
  }

  // 雨
  if (state.weather === 'rain'){
    ctx.lineCap = 'round';
    for (const d of drops){
      d.y += d.v * dt * .55;
      d.x += d.v * dt * .12;
      if (d.y > 1){ d.y = -.1; d.x = Math.random() * 1.2 - .1; }
      if (d.x > 1.15) d.x -= 1.25;
      const x = d.x * W, y = d.y * H, L = d.len * H;
      ctx.strokeStyle = `rgba(${night > .5 ? '186,206,235' : '234,246,255'},${d.a * (.6 + day * .4)})`;
      ctx.lineWidth = Math.max(.9, W * .0013);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - L * .22, y + L); ctx.stroke();
    }
    // ガラスについた雫
    for (const g0 of glass){
      g0.y += g0.v * dt * (g0.r > 3.4 ? .5 : .12);
      if (g0.y > .82){ g0.y = -.02; g0.x = Math.random(); }
      const x = g0.x * W, y = g0.y * H, r = g0.r * (W / 1200);
      const gr = ctx.createRadialGradient(x - r * .3, y - r * .35, 0, x, y, r * 2.1);
      gr.addColorStop(0, `rgba(255,255,255,${g0.a * .9})`);
      gr.addColorStop(.5, `rgba(214,232,248,${g0.a * .35})`);
      gr.addColorStop(1, 'rgba(214,232,248,0)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(x, y, r * 2.1, 0, 6.2832); ctx.fill();
    }
  }

  // 雪
  if (state.weather === 'snow'){
    for (const f of flakes){
      f.y += f.v * dt * .5;
      f.ph += dt * 1.1;
      f.x += Math.sin(f.ph) * f.sw * dt;
      if (f.y > 1){ f.y = -.05; f.x = Math.random(); }
      if (f.x > 1.05) f.x = -.05; if (f.x < -.05) f.x = 1.05;
      const x = f.x * W, y = f.y * H, r = f.r * (W / 1200);
      const gr = ctx.createRadialGradient(x, y, 0, x, y, r * 2.4);
      gr.addColorStop(0, `rgba(255,255,255,${f.a * (.6 + day * .4)})`);
      gr.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = gr;
      ctx.beginPath(); ctx.arc(x, y, r * 2.4, 0, 6.2832); ctx.fill();
    }
  }

  ctx.restore();

  /* ---- 室内：光の粒（晴れの日中だけ、ごく控えめ） ---- */
  if (state.weather === 'clear'){
    const a = day * .85;
    if (a > .03){
      for (const m of motes){
        m.x += m.vx * dt * .06; m.y += m.vy * dt * .06;
        m.ph += dt * .8;
        if (m.y < .18){ m.y = 1.02; m.x = Math.random(); }
        if (m.x > 1.03) m.x = -.03; if (m.x < -.03) m.x = 1.03;
        const x = m.x * W, y = m.y * H, r = m.r * (W / 1200);
        ctx.globalAlpha = a * m.a * (.5 + .5 * Math.sin(m.ph));
        ctx.fillStyle = '#ffe8b8';
        ctx.beginPath(); ctx.arc(x, y, r, 0, 6.2832); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }
}
