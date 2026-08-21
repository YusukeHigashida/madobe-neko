"use strict";
/* ------------------------------------------------------------
   素材の読み込み
   ASSETS.cat（cat2.png）が見つかった場所を「素材フォルダ」として、以降そこから読む。
   ------------------------------------------------------------ */
/* 時間帯ごとの背景。画像が無い時間帯は昼の画像で代用し、
   色オーバーレイだけでその時間帯を演出する（＝素材が1枚でも成立する）。 */
const BG_ORDER = ['night', 'morning', 'day', 'sunset'];
const BG = {};                     // key -> { el, ok }
BG_ORDER.forEach(k => { BG[k] = { el: document.querySelector(`.bg[data-bg="${k}"]`), ok: false }; });

// 背景が切り替わる時刻。この前後 BG_FADE 時間かけてクロスフェードする。
const BG_BOUNDS = [
  { at:  4.6, from: 'night',   to: 'morning' },
  { at:  8.4, from: 'morning', to: 'day'     },
  { at: 16.4, from: 'day',     to: 'sunset'  },
  { at: 20.6, from: 'sunset',  to: 'night'   },
];
const BG_FADE = 1.0;               // 単位：時間（＝前後1時間ずつ混ざる）

(function loadAssets(){
  let i = 0;
  const probe = new Image();
  const use = (base) => {
    [$('catBody'), $('catTail'), $('catEar')].forEach(el => { el.src = base + ASSETS.cat; });
    SHEET_SRC.cat   = base + ASSETS.cat;
    SHEET_SRC.poses = base + ASSETS.poses;
    SHEET_SRC.walk  = base + ASSETS.walk;
    applyPose(cat.pose, true);
    BG.day.el.src = base + ASSETS.day;
    BG.day.ok = true;
    // 朝・夕・夜は「あれば使う」。無ければ昼の画像で代用する。
    [['morning', ASSETS.morning], ['sunset', ASSETS.sunset], ['night', ASSETS.night]].forEach(([k, file]) => {
      const p = new Image();
      p.onload  = () => { BG[k].el.src = base + file; BG[k].ok = true; };
      p.onerror = () => { BG[k].el.src = base + ASSETS.day; BG[k].ok = false; };
      p.src = base + file;
    });
  };
  const next = () => {
    if (i >= ASSET_BASES.length){ use(ASSET_BASES[0]); return; }   // 見つからなくても一応表示を試みる
    probe.onerror = () => { i++; next(); };
    probe.onload  = () => use(ASSET_BASES[i]);
    probe.src = ASSET_BASES[i] + ASSETS.cat;
  };
  next();
})();

// その時刻に各背景をどれだけ混ぜるか（合計 1 / 同時に混ざるのは最大2枚）
function bgWeights(h){
  const w = { night: 0, morning: 0, day: 0, sunset: 0 };
  for (const b of BG_BOUNDS){
    let d = h - b.at;
    if (d >  12) d -= 24;
    if (d < -12) d += 24;
    if (Math.abs(d) < BG_FADE){          // 境目の前後：2枚を混ぜる
      const t = smooth((d + BG_FADE) / (2 * BG_FADE));
      w[b.from] = 1 - t;
      w[b.to]   = t;
      return w;
    }
  }
  const inRange = (a, b) => a < b ? (h >= a && h < b) : (h >= a || h < b);
  w[ inRange(20.6, 4.6) ? 'night'
   : inRange( 4.6, 8.4) ? 'morning'
   : inRange( 8.4,16.4) ? 'day'
   : 'sunset' ] = 1;
  return w;
}

// 重みを実際の重ね順・不透明度に落とし込む
// （下に重い方を不透明で敷き、その上に軽い方をその重みで重ねる）
function applyBg(w){
  const active = BG_ORDER.filter(k => w[k] > .0005).sort((a, b) => w[b] - w[a]);
  BG_ORDER.forEach(k => {
    const el = BG[k].el;
    if (!el) return;
    if (k === active[0])      { el.style.opacity = 1;            el.style.zIndex = 1; }
    else if (k === active[1]) { el.style.opacity = w[k].toFixed(4); el.style.zIndex = 2; }
    else                      { el.style.opacity = 0;            el.style.zIndex = 0; }
  });
}
