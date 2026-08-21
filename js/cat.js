"use strict";
/* ============================================================
   猫のふるまい（姿勢の切り替えと歩行）
   ============================================================ */
const SHEET_SRC = { cat:'', poses:'', walk:'' };
const elCatArt2 = $('catArt'), elPoseSit = $('poseSit'), elPoseSprite = $('poseSprite'), elSpriteImg = $('spriteImg');

const cat = {
  pose: 'sit',
  x: 53,             // 猫の中心（ステージ幅の%）
  facing: -1,        // -1 = 左向き（素材そのまま） / +1 = 右向き（反転）
  until: 0,          // この時刻まで今の姿勢を続ける
  walkTo: null,
  frame: 0,
  frameT: 0,
};

// 姿勢を画面に反映する（箱の縦横比・大きさ・接地位置・コマの切り出し）
function applyPose(name, force){
  const p = POSES[name];
  if (!p) return;
  const cw = p.frames ? p.frameW : p.cell[2];
  const ch = p.frames ? p.frameH : p.cell[3];

  // 箱の縦横比とサイズ
  elCatArt2.style.paddingTop = (ch / cw * 100).toFixed(3) + '%';
  elCatWrap.style.width = p.widthPct + '%';

  // 足元が CAT_GROUND_Y に来るように縦位置を決める
  const cy = p.frames ? p.frames[cat.frame][1] : p.cell[1];
  const hPct = p.widthPct * 1.5 * ch / cw;          // ステージ高さに対する箱の高さ
  const gFrac = (p.ground - cy) / ch;               // 箱の中での足元の位置
  elCatWrap.style.bottom = ((100 - CAT_GROUND_Y) - (1 - gFrac) * hPct).toFixed(3) + '%';
  elCatWrap.style.left = (cat.x - p.widthPct / 2).toFixed(3) + '%';

  // 座り姿だけは分割レイヤー版を使う
  const isSit = (name === 'sit');
  elPoseSit.classList.toggle('show', isSit);
  elPoseSprite.classList.toggle('show', !isSit);
  if (!isSit) drawSpriteCell(p);

  elCatArt2.classList.toggle('flip', cat.facing > 0);
}

// スプライトシートから1コマだけ見えるように img をずらす
function drawSpriteCell(p){
  const src = SHEET_SRC[p.sheet];
  if (!src) return;
  if (elSpriteImg.getAttribute('src') !== src) elSpriteImg.src = src;
  const [cx, cy] = p.frames ? p.frames[cat.frame] : [p.cell[0], p.cell[1]];
  const cw = p.frames ? p.frameW : p.cell[2];
  const ch = p.frames ? p.frameH : p.cell[3];
  const sheet = SHEET_SIZE[p.sheet];
  elSpriteImg.style.width = (sheet[0] / cw * 100).toFixed(3) + '%';
  elSpriteImg.style.left  = (-cx / cw * 100).toFixed(3) + '%';
  elSpriteImg.style.top   = (-cy / ch * 100).toFixed(3) + '%';
  // 隣のコマの写り込みを切り落とす
  const clip = p.frameClip ? p.frameClip[cat.frame] : p.clip;
  elSpriteImg.style.clipPath = clip
    ? `inset(0% ${((sheet[0] - clip[1]) / sheet[0] * 100).toFixed(3)}% 0% ${(clip[0] / sheet[0] * 100).toFixed(3)}%)`
    : 'none';
}
const SHEET_SIZE = { cat:[1536,1024], poses:[2000,667], walk:[2000,674] };

// 今の時間帯で猫が「やりがちなこと」を選ぶ
function chooseBehavior(h){
  const n = nightAmount(h);
  const r = Math.random();
  if (n > .6)                    return r < .78 ? 'sleep' : 'loaf';        // 夜はほぼ寝ている
  if (h >= 4.8 && h < 9)         return r < .22 ? 'stretch' : r < .6 ? 'walk' : 'sit';
  if (h >= 9 && h < 16)          return r < .32 ? 'walk' : r < .68 ? 'sit' : 'loaf';
  return r < .2 ? 'walk' : r < .6 ? 'loaf' : 'sit';                        // 夕方はまったり
}

function poseDuration(name){
  switch (name){
    case 'stretch': return 3.4;
    case 'sleep':   return rand(18, 42);
    case 'loaf':    return rand(12, 26);
    default:        return rand(9, 20);
  }
}

function startBehavior(name, now){
  cat.pose = name;
  cat.frame = 0;
  cat.frameT = 0;
  if (name === 'walk'){
    // 今いる場所から十分離れた目的地を選ぶ
    let target, tries = 0;
    do { target = rand(WALK_RANGE[0], WALK_RANGE[1]); tries++; }
    while (Math.abs(target - cat.x) < 9 && tries < 12);
    cat.walkTo = target;
    cat.facing = target > cat.x ? 1 : -1;
    cat.until = now + 60;                      // 保険（到着で終わる）
  } else {
    cat.walkTo = null;
    cat.facing = -1;                           // 座る・寝るときは必ず窓の外（左）を向く
    cat.until = now + poseDuration(name);
  }
  elCatWrap.classList.toggle('walking', name === 'walk');
  applyPose(name, true);

  // 姿勢が変わった瞬間だけ、ふるっと動き直したように見せる
  // （小窓に引っ越したあとは document から引き直せないので、最初に掴んだ要素を使う）
  if (elCatInner){
    elCatInner.classList.remove('posing');
    void elCatInner.offsetWidth;
    elCatInner.classList.add('posing');
    setTimeout(() => elCatInner.classList.remove('posing'), 440);
  }
}

function updateCat(dt, nowSec){
  // なでられたら歩くのをやめて座る
  if (cat.pose === 'walk' && (performance.now() - state.lastPet) < 400){
    startBehavior('sit', nowSec);
  }

  if (cat.pose === 'walk'){
    const dir = Math.sign(cat.walkTo - cat.x);
    cat.x += dir * WALK_SPEED * dt;
    // 足の運び
    cat.frameT += dt;
    const step = 1 / POSES.walk.fps;
    if (cat.frameT >= step){
      cat.frameT -= step;
      cat.frame = (cat.frame + 1) % POSES.walk.frames.length;
      drawSpriteCell(POSES.walk);
    }
    elCatWrap.style.left = (cat.x - POSES.walk.widthPct / 2).toFixed(3) + '%';
    if (Math.abs(cat.walkTo - cat.x) < .4 || nowSec > cat.until){
      cat.x = cat.walkTo;
      startBehavior(Math.random() < .55 ? 'sit' : 'loaf', nowSec);
    }
    return;
  }

  if (nowSec > cat.until){
    // 伸びのあとは必ず座る。それ以外は時間帯に応じて選び直す
    const next = cat.pose === 'stretch' ? 'sit' : chooseBehavior(state.hour);
    startBehavior(next === cat.pose && Math.random() < .5 ? 'walk' : next, nowSec);
  }
}
