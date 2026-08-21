"use strict";
/* ============================================================
   なでる
   ============================================================ */
const fxDom = $('fxDom');
const HEARTS = ['♡', '❤', '♡', '❥', '♡'];
const HEART_COLORS = ['#ff7d9c', '#ff9db4', '#ffb56b'];

function spawnHeart(clientX, clientY){
  const r = stage.getBoundingClientRect();
  const el = fxDom.ownerDocument.createElement('div');   // 今 fxDom がいる窓の document で作る
  el.className = 'heart';
  el.textContent = HEARTS[Math.floor(Math.random() * HEARTS.length)];
  el.style.left = ((clientX - r.left) + rand(-14, 14)) + 'px';
  el.style.top  = ((clientY - r.top)  + rand(-10, 10)) + 'px';
  el.style.fontSize = rand(1.1, 2.1) + 'rem';
  el.style.color = HEART_COLORS[Math.floor(Math.random() * HEART_COLORS.length)];
  fxDom.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

let petDist = 0, lastPt = null, heartCd = 0;
const catHit = $('catHit');

function petMove(e){
  const now = performance.now();
  const pt = { x: e.clientX, y: e.clientY };
  if (lastPt){
    petDist += Math.hypot(pt.x - lastPt.x, pt.y - lastPt.y);
  }
  lastPt = pt;
  state.petting = true;
  state.lastPet = now;
  hideHint();

  if (petDist > 45 && now - heartCd > 170){
    petDist = 0; heartCd = now;
    spawnHeart(pt.x, pt.y);
    purrBump();
    tryMeow(false);          // なで続けているときは、たまに鳴く
  }
}
catHit.addEventListener('pointerenter', (e) => { lastPt = null; state.lastPet = performance.now(); hideHint(); });
catHit.addEventListener('pointermove', petMove);
catHit.addEventListener('pointerleave', () => { state.petting = false; lastPt = null; });
catHit.addEventListener('pointerdown', (e) => {
  catHit.setPointerCapture?.(e.pointerId);
  spawnHeart(e.clientX, e.clientY);
  elCatWrap.classList.remove('petted');
  void elCatWrap.offsetWidth;
  elCatWrap.classList.add('petted');
  setTimeout(() => elCatWrap.classList.remove('petted'), 950);
  state.lastPet = performance.now();
  purrBump(1.6);
  tryMeow(true);             // 触れた瞬間は鳴く
  hideHint();
});

let hintHidden = false;
function hideHint(){
  if (hintHidden) return;
  hintHidden = true;
  const el = $('hint');
  if (!el) return;
  el.classList.add('hide');
  setTimeout(() => el.remove(), 900);
}
setTimeout(hideHint, 14000);

// 耳のピクッ
function scheduleEarTwitch(){
  const wait = rand(4200, 11000);
  setTimeout(() => {
    const ear = $('catEar');
    ear.classList.remove('twitch');
    void ear.offsetWidth;
    ear.classList.add('twitch');
    scheduleEarTwitch();
  }, wait);
}
scheduleEarTwitch();
