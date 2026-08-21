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
let backToWindow = false;          // アプリの ⤢ ボタンで元に戻す途中か（小窓の × と見分けるための印）
let rafHost = window;              // アニメーションを回す窓（小窓側で回さないと裏に回ったとき止まる）

function pipSupported(){ return 'documentPictureInPicture' in window; }

function updatePipBtn(){
  if (!pipBtn) return;
  setBtn(pipBtn, pipWin ? '⤢' : '🪟', pipWin ? '元に戻す' : '小窓');
  pipBtn.classList.toggle('on', !!pipWin);
  pipBtn.title = pipWin
    ? (pipOnTop
        ? '最前面の小窓で表示中（クリックで元のウィンドウへ戻る／小窓の × で終了）'
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
  win.addEventListener('pagehide', onPipClosed, { once: true });
  updatePipBtn();
}

async function openPip(){
  if (pipWin){ backToWindow = true; pipWin.close(); return; }   // ⤢ ＝ 元のウィンドウへ戻る
  const r = stage.getBoundingClientRect();
  const w = Math.max(320, Math.min(720, Math.round(r.width * .6)));
  const h = Math.round(w / 1.5);

  // ① 本命：常に最前面に出る小窓（Chrome / Edge 116+）
  if (pipSupported()){
    try{
      moveInto(await documentPictureInPicture.requestWindow({
        width: w, height: h,
        // Chrome の「タブに戻る」ボタンを消す。アプリの ⤢ ボタンと役目が重なるうえ、
        // 押されたボタンを知る API が無いので × と見分けられない。
        // 消しておけば × は「まるごと終了」に専念できる。
        disallowReturnToOpener: true,
      }), true);
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

/* 小窓が閉じられたとき。
   ・アプリの ⤢ ボタン → 元のウィンドウへ戻す
   ・小窓の ×        → 元のウィンドウごと終了する
   どのボタンが押されたかを知る API は無いので、⤢ のときだけ backToWindow に
   印を付けて見分けている。 */
function onPipClosed(){
  if (backToWindow){
    backToWindow = false;
    restoreFromPip();
    return;
  }
  pipWin = null;
  window.close();
  // 閉じられない窓もある（script が開いた窓か、履歴が1件のタブだけが閉じられる）。
  // 閉じられなかったら元のウィンドウへ戻して、中身が宙に浮いたままにしない。
  setTimeout(() => { if (!window.closed) restoreFromPip(); }, 200);
}

// ページが捨てられるときは小窓も閉じる。
// 開いたまま残ると、中身が動かない窓と、音だけ鳴り続けるページが残ってしまう。
window.addEventListener('pagehide', (e) => {
  if (e.persisted || !pipWin) return;
  const win = pipWin;
  pipWin = null;                                     // これから閉じるので復帰処理は要らない
  win.removeEventListener('pagehide', onPipClosed);
  try { win.close(); } catch (err){ /* もう閉じている */ }
});

if (pipBtn){
  pipBtn.addEventListener('click', openPip);
  updatePipBtn();
}
