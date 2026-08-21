"use strict";
/* ============================================================
   メインループ
   ============================================================ */
let last = performance.now();
let loopToken = 0;

function startLoop(){
  const mine = ++loopToken;          // 窓を移ったとき、古いループを止めるための札
  last = performance.now();
  const step = () => {
    if (mine !== loopToken) return;

    // 時間は必ず「このスクリプトを読み込んだ窓の時計」で測る。
    // 小窓（PiP）は別ウィンドウで performance の原点がこちらと違うので、
    // rAF が渡してくるタイムスタンプをそのまま使うと、小窓へ移った瞬間に
    // dt が大きな負の値になる（＝音量の補間が発散してノイズが出る）。
    // state.lastPet や cat.until もこの時計で記録しているので、混ぜないこと。
    const now = performance.now();
    const dt = Math.max(0, Math.min(.05, (now - last) / 1000));   // 負にしない
    last = now;

    if (state.playing){
      state.hour = (state.hour + 24 * dt / DAY_CYCLE_SEC) % 24;
      elSlider.value = Math.round(state.hour * 60);
    } else if (state.followTime){
      state.hour = tokyoHour();                 // 東京の実時間に追従
      elSlider.value = Math.round(state.hour * 60);
    }

    // なで度の増減
    const recentlyPetted = (now - state.lastPet) < 500;
    const target = recentlyPetted ? 1 : 0;
    state.pet += (target - state.pet) * Math.min(1, dt * (recentlyPetted ? 5 : 1.4));
    purrLevel = Math.min(1, Math.max(0, purrLevel - dt * (recentlyPetted ? .12 : .45)));
    if (recentlyPetted) purrLevel = Math.min(1, purrLevel + dt * .5);

    // どこか一箇所でつまずいてもループ自体は止めない
    // （止まると猫が固まったまま動かなくなり、原因も見えなくなる）
    try{
      if (START.behavior) updateCat(dt, now / 1000);
      render();
      drawFx(dt, now);
      updateAudio(dt);
    } catch (err){
      console.error('[箱庭猫] フレーム処理でエラー', err);
    }
    rafHost.requestAnimationFrame(step);
  };
  rafHost.requestAnimationFrame(step);
}

resize();
startBehavior('sit', performance.now() / 1000);
render();
startLoop();
