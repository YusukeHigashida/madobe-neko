"use strict";
/* ============================================================
   時間 → 見た目
   ============================================================ */
const lerp  = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const smooth= (t) => t * t * (3 - 2 * t);

function lookAt(hour){
  let a = TIMELINE[0], b = TIMELINE[TIMELINE.length - 1];
  for (let i = 0; i < TIMELINE.length - 1; i++){
    if (hour >= TIMELINE[i].h && hour <= TIMELINE[i+1].h){ a = TIMELINE[i]; b = TIMELINE[i+1]; break; }
  }
  const t = smooth(clamp((hour - a.h) / Math.max(.0001, b.h - a.h), 0, 1));
  const mix = (ka, kb) => ka.map((v, i) => lerp(v, kb[i], t));
  return {
    mul:  mix(a.mul, b.mul),
    scr:  mix(a.scr, b.scr),
    bri:  lerp(a.bri, b.bri, t),
    sat:  lerp(a.sat, b.sat, t),
    beam: lerp(a.beam, b.beam, t),
    beamX:lerp(a.beamX, b.beamX, t),
  };
}
const rgba = (c) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${c[3].toFixed(3)})`;

// 夜らしさ（0..1）：星・灯り・猫の眠さに使う
function nightAmount(h){
  if (h >= 20.5 || h <= 4.3) return 1;
  if (h > 4.3 && h < 6.4)   return smooth(clamp((6.4 - h) / 2.1, 0, 1));
  if (h > 18.6 && h < 20.5) return smooth(clamp((h - 18.6) / 1.9, 0, 1));
  return 0;
}
function dayAmount(h){ return 1 - nightAmount(h); }

// 朝焼け / 夕焼けの強さと、光が来る向き
function goldenAmount(h){
  const bell = (c, w) => Math.max(0, 1 - Math.abs(h - c) / w);
  const morning = smooth(bell(6.6, 2.0));
  const evening = smooth(bell(18.0, 2.2));
  return {
    amt: Math.max(morning, evening),
    x: evening > morning ? .82 : .22,
    warm: evening > morning ? [255, 150, 78] : [255, 176, 148],
  };
}

const WEATHER_TINT = {
  clear: [255,255,255,0],
  rain:  [122,138,158,.34],
  snow:  [186,206,226,.20],
};

function labelOf(h){
  if (h < 4.5)  return 'しんや';
  if (h < 7)    return 'あけがた';
  if (h < 10)   return 'あさ';
  if (h < 14)   return 'ひる';
  if (h < 16.5) return 'ごご';
  if (h < 18.6) return 'ゆうがた';
  if (h < 22.5) return 'よる';
  return 'しんや';
}

const elMul = $('tintMul'), elScr = $('tintScreen'), elBeam = $('sunbeam'),
      elLamp = $('lamp'), elWTint = $('weatherTint'),
      elCatWrap = $('catWrap'), elCatArt = $('catArt'), elCatEye = $('catEye'),
      elCatShadow = document.querySelector('.cat-shadow'),
      elCatInner = document.querySelector('.cat-inner'),
      elClock = $('clock'), elSlider = $('timeSlider'), elCredit = $('credit');

// 「その時間帯の専用画像がどれだけ効いているか」(0..1)
// 専用画像には既に朝焼け・夕焼け・夜が描き込まれているので、
// 重ねる色オーバーレイはこの分だけ弱める（二重に着色しないため）。
let bakedAmount = 0;

function render(){
  const h = state.hour;
  const L = lookAt(h);
  const night = nightAmount(h);

  // 背景のクロスフェード
  const w = bgWeights(h);
  applyBg(w);
  bakedAmount = ['night','morning','sunset'].reduce((s, k) => s + (BG[k].ok ? w[k] : 0), 0);
  const g = 1 - .82 * bakedAmount;        // 色オーバーレイの効き具合

  elMul.style.backgroundColor = rgba([L.mul[0], L.mul[1], L.mul[2], L.mul[3] * g]);
  elScr.style.backgroundColor = rgba([L.scr[0], L.scr[1], L.scr[2], L.scr[3] * g]);

  // 天気による空気感（雨はしっとり彩度を落とす）
  const wf = state.weather === 'rain' ? { b: .86, s: .62 }
           : state.weather === 'snow' ? { b: .97, s: .80 }
           : { b: 1, s: 1 };
  // 専用画像のときは明るさ・彩度の補正も控えめに（画像が既にその明るさなので）
  const bri = lerp(L.bri, 1, .85 * bakedAmount);
  const sat = lerp(L.sat, 1, .85 * bakedAmount);
  stage.style.filter = `brightness(${(bri * wf.b).toFixed(3)}) saturate(${(sat * wf.s).toFixed(3)})`;

  // 窓から差し込む光
  const beamStrength = L.beam * (state.weather === 'clear' ? 1 : state.weather === 'snow' ? .35 : .18)
                     * (1 - .5 * bakedAmount);
  elBeam.style.opacity = beamStrength.toFixed(3);
  elBeam.style.transform = `translateX(${L.beamX.toFixed(2)}%) rotate(${(L.beamX * .06).toFixed(2)}deg)`;

  // 夜の室内灯（夜画像にはランプが描かれているので、そのときは控えめに）
  elLamp.style.opacity = (night * .85 * (1 - .65 * bakedAmount)).toFixed(3);

  // 天気の色
  elWTint.style.backgroundColor = rgba(WEATHER_TINT[state.weather]);

  // 出典表示：明るい背景では濃い茶、暗い背景では生成り。
  // どちらでも「読めるが主張しない」濃さを保つ。
  if (elCredit){
    const cc = (r, g, b, a) => `rgba(${Math.round(r)},${Math.round(g)},${Math.round(b)},${a})`;
    const n = night;
    elCredit.style.color = cc(lerp(78,255,n), lerp(52,246,n), lerp(32,232,n), (.44 - .04*n).toFixed(2));
    elCredit.style.textShadow = '0 1px 2px ' + cc(lerp(255,18,n), lerp(250,10,n), lerp(240,4,n), .4);
  }

  // 猫の明るさ
  // 専用の背景画像を使っているときは全体の色補正を弱めているぶん、
  // 猫だけが昼のまま明るく浮いてしまう。その差を猫側のフィルタで埋める。
  const catDark = night * bakedAmount;
  const shadowA = (.26 * (1 - .55 * night)).toFixed(3);
  elCatArt.style.filter =
    `drop-shadow(3px 7px 7px rgba(96,62,32,${shadowA}))`
    + ` brightness(${lerp(1, .60, catDark).toFixed(3)})`
    + ` saturate(${lerp(1, .78, catDark).toFixed(3)})`;

  // 猫：夜は眠そう＆なでられると目を細める
  const sleepy = night * .72;
  const squint = clamp(Math.max(sleepy, state.pet), 0, 1);
  elCatEye.style.setProperty('--squint', squint.toFixed(3));
  elCatWrap.classList.toggle('sleepy', night > .45);
  elCatShadow.style.setProperty('--shadow-a', (0.25 + dayAmount(h) * (state.weather === 'clear' ? .75 : .4)).toFixed(3));

  // 時計表示
  const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
  elClock.innerHTML = `<b>${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')}</b><span>${labelOf(h)}</span>`;
}
