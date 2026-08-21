"use strict";
/* ============================================================
   小窓で最前面（Document Picture-in-Picture）
   Chrome / Edge 116+ で利用可。枠のない小窓が常に手前に出る。
   ============================================================ */
const appEl = $('app');
const pipBtn = $('pipBtn');
let pipWin = null;
let pipNote = null;
let pipOnTop = false;              // 最前面固定の小窓で開けているか
let pipFallbackReason = '';
let rafHost = window;              // アニメーションを回す窓（小窓側で回さないと裏に回ったとき止まる）

function pipSupported(){ return 'documentPictureInPicture' in window; }

function updatePipBtn(){
  if (!pipBtn) return;
  setBtn(pipBtn, pipWin ? '⤢' : '🪟', pipWin ? '元に戻す' : '小窓');
  pipBtn.classList.toggle('on', !!pipWin);
  pipBtn.title = pipWin
    ? (pipOnTop
        ? '最前面の小窓で表示中（クリックで元に戻す）'
        : '別ウィンドウで表示中。最前面固定は使えませんでした（' + pipFallbackReason + '）')
    : 'デスクトップの最前面に小窓で表示する';
}

// 用意した窓に「絵の部分ごと」引っ越す
function moveInto(win, alwaysOnTop){
  win.document.title = document.title;
  // このページのスタイルをそのまま複製（見た目をまるごと持っていく）
  // <style> と <link rel=stylesheet> の両方。CSS は外部ファイルなので <link> が本体。
  document.querySelectorAll('style, link[rel="stylesheet"]').forEach(el => {
    const copy = win.document.importNode(el, true);
    if (copy.tagName === 'LINK') copy.href = el.href;   // 相対パスを絶対 URL に固定する
    win.document.head.appendChild(copy);
  });
  win.document.body.append(appEl);                 // #app ごと引っ越し
  stage.classList.add('pip');

  // 元の画面には案内を残す
  pipNote = document.createElement('div');
  pipNote.className = 'pip-placeholder';
  pipNote.textContent = '🐈 小窓で表示中 — 小窓を閉じるとここに戻ります';
  document.body.appendChild(pipNote);

  pipWin = win;
  pipOnTop = alwaysOnTop;
  rafHost = win;                                   // 小窓側で回さないと、裏に回ったとき止まる
  startLoop();
  resize();
  win.addEventListener('resize', resize);
  win.addEventListener('keydown', onKey);
  win.addEventListener('pointermove', poke);
  win.addEventListener('pagehide', restoreFromPip, { once: true });
  updatePipBtn();
}

async function openPip(){
  if (pipWin){ pipWin.close(); return; }
  const r = stage.getBoundingClientRect();
  const w = Math.max(320, Math.min(720, Math.round(r.width * .6)));
  const h = Math.round(w / 1.5);

  // ① 本命：常に最前面に出る小窓（Chrome / Edge 116+）
  if (pipSupported()){
    try{
      moveInto(await documentPictureInPicture.requestWindow({ width: w, height: h }), true);
      return;
    } catch (err){
      pipFallbackReason = (err && err.message) || String(err);
    }
  } else {
    pipFallbackReason = 'このブラウザは Document Picture-in-Picture 非対応';
  }

  // ② 代替：ふつうの別ウィンドウ（最前面固定ではないが、小窓としては使える）
  const popup = window.open('', 'madobeneko', `width=${w},height=${h}`);
  if (!popup){
    if (pipBtn) pipBtn.title = '小窓を開けませんでした（' + pipFallbackReason + '／ポップアップもブロックされました）';
    updatePipBtn();
    return;
  }
  popup.document.head.appendChild(
    Object.assign(popup.document.createElement('meta'), { charset: 'utf-8' })
  );
  moveInto(popup, false);
}

function restoreFromPip(){
  document.body.appendChild(appEl);
  if (pipNote){ pipNote.remove(); pipNote = null; }
  stage.classList.remove('pip');
  pipWin = null;
  pipOnTop = false;
  rafHost = window;
  startLoop();
  resize();
  updatePipBtn();
  poke();
}

if (pipBtn){
  pipBtn.addEventListener('click', openPip);
  updatePipBtn();
}
