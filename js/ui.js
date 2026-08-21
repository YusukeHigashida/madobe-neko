"use strict";
/* ============================================================
   UI
   ============================================================ */
// ボタンの中身は <i>アイコン</i><span class="lbl">文字</span> の形。
// 小窓モードでは .lbl が消えてアイコンだけになるので、両方を別々に書き換える。
function setBtn(btn, icon, label){
  if (!btn) return;
  const i = btn.querySelector('i'), l = btn.querySelector('.lbl');
  if (i) i.textContent = icon;
  if (l) l.textContent = label;
}

const playBtn = $('playBtn');
function setPlaying(v){
  state.playing = v;
  if (v) setFollowTime(false);          // タイムラプスを回すあいだは実時間から離れる
  setBtn(playBtn, v ? '❚❚' : '▶', v ? '一時停止' : '再生');
  playBtn.classList.toggle('on', v);
}
playBtn.addEventListener('click', () => setPlaying(!state.playing));

// 実時間への追従の入り切り。「いま」ボタン（と時計）でいつでも現在時刻に戻せる。
const nowBtn = $('nowBtn');
function setFollowTime(v){
  state.followTime = v;
  elClock.classList.toggle('live', v);
  if (nowBtn){
    nowBtn.classList.toggle('on', v);
    nowBtn.title = v
      ? `${LIVE_WEATHER.name}の現在時刻に同期中`
      : `${LIVE_WEATHER.name}の現在時刻に戻す`;
  }
  elClock.title = v
    ? `${LIVE_WEATHER.name}の現在時刻に同期中`
    : `クリックすると${LIVE_WEATHER.name}の現在時刻に戻ります`;
  if (v){
    state.hour = tokyoHour();
    elSlider.value = Math.round(state.hour * 60);
    render();
  }
}
function backToNow(){
  if (state.playing) setPlaying(false);
  setFollowTime(true);
}
elClock.addEventListener('click', backToNow);
if (nowBtn) nowBtn.addEventListener('click', backToNow);

setPlaying(START.playing);
setFollowTime(START.followRealTime);

elSlider.value = Math.round(state.hour * 60);
elSlider.addEventListener('input', () => {
  state.hour = (+elSlider.value) / 60;
  render();
});
elSlider.addEventListener('pointerdown', () => { setPlaying(false); setFollowTime(false); });

// 天気ボタンも同じ理由で最初に掴んでおく（小窓では #weatherGroup が主文書から消える）
const WEATHER_BTNS = [...document.querySelectorAll('#weatherGroup button')];

function setWeather(w, byUser){
  if (state.weather !== w){
    state.weather = w;
    if (w === 'rain') buildRain();
    if (w === 'snow') buildSnow();
  }
  WEATHER_BTNS.forEach(x => x.classList.toggle('on', x.dataset.w === w));
  if (byUser && state.live){ state.live = false; updateLiveBtn(); }   // 手で選んだら同期は解除
  render();
}

$('weatherGroup').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-w]');
  if (b) setWeather(b.dataset.w, true);
});

/* ------------------------------------------------------------
   実際の天気と同期（Open-Meteo）
   起動時に一度取得し、失敗したら黙って晴れのまま。
   天気ボタンを手で押すと同期は解除される。
   ------------------------------------------------------------ */
// WMO weather code → このアプリの3種類
function weatherFromCode(c){
  if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow';
  if ((c >= 51 && c <= 67) || (c >= 80 && c <= 82) || c >= 95) return 'rain';
  return 'clear';
}
function codeLabel(c){
  if (c === 0) return '快晴';
  if (c === 1) return '晴れ';
  if (c === 2) return '晴れ時々くもり';
  if (c === 3) return 'くもり';
  if (c === 45 || c === 48) return '霧';
  if (c >= 51 && c <= 57) return '小雨';
  if (c >= 61 && c <= 67) return '雨';
  if (c >= 71 && c <= 77) return '雪';
  if (c >= 80 && c <= 82) return 'にわか雨';
  if (c === 85 || c === 86) return 'にわか雪';
  if (c >= 95) return '雷雨';
  return '—';
}

const liveBtn = $('liveBtn');
function updateLiveBtn(){
  if (!liveBtn) return;
  liveBtn.classList.toggle('on', state.live);
  setBtn(liveBtn, '🗼', state.live
    ? `${LIVE_WEATHER.name} ${state.liveText}`
    : LIVE_WEATHER.name);
  liveBtn.title = state.live
    ? `${LIVE_WEATHER.name}の実際の天気に同期中（クリックで取り直し）`
    : (state.liveError
        ? `天気を取得できませんでした（${state.liveError}）。クリックで再試行`
        : `${LIVE_WEATHER.name}の今の天気に合わせる`);
}

async function fetchLiveWeather(){
  if (!liveBtn) return;
  setBtn(liveBtn, '🗼', `${LIVE_WEATHER.name} …`);
  try{
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), LIVE_WEATHER.timeoutMs);
    // ★ weather_code を単独で要求すると null が返ることがある（API側の癖）。
    //   複数項目をまとめて要求すると正しく返るので、必ずこの形で投げること。
    //   ついでに降水量も取り、コードが空でも天気を判定できるようにしておく。
    const url = 'https://api.open-meteo.com/v1/forecast'
      + `?latitude=${LIVE_WEATHER.lat}&longitude=${LIVE_WEATHER.lon}`
      + '&current=weather_code,precipitation,snowfall,temperature_2m,cloud_cover'
      + `&timezone=${encodeURIComponent(LIVE_WEATHER.tz)}`;
    const res = await fetch(url, { signal: ctl.signal, cache: 'no-store' });
    clearTimeout(timer);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const cur = (data && data.current) || {};

    let weather, label;
    if (typeof cur.weather_code === 'number'){
      weather = weatherFromCode(cur.weather_code);
      label   = codeLabel(cur.weather_code);
    } else if (typeof cur.precipitation === 'number'){
      // 予備：降水量から判定する
      const snowy = cur.snowfall > 0 || (cur.precipitation > 0 && cur.temperature_2m <= .5);
      weather = snowy ? 'snow' : cur.precipitation > 0 ? 'rain' : 'clear';
      label   = snowy ? '雪' : cur.precipitation > 0 ? '雨'
              : (cur.cloud_cover >= 80 ? 'くもり' : cur.cloud_cover >= 40 ? '晴れ時々くもり' : '晴れ');
    } else {
      throw new Error('天気の値が空でした');
    }

    state.live = true;
    state.liveError = '';
    state.liveText = label;
    setWeather(weather, false);
  } catch (err){
    // 取得できなくても世界観は壊さない：今の天気のまま静かに続ける
    state.live = false;
    state.liveError = (err && err.name === 'AbortError') ? 'タイムアウト' : String((err && err.message) || err);
  }
  updateLiveBtn();
}

if (liveBtn){
  liveBtn.addEventListener('click', fetchLiveWeather);
  updateLiveBtn();
  if (LIVE_WEATHER.enabled){
    fetchLiveWeather();
    setInterval(() => { if (state.live) fetchLiveWeather(); }, LIVE_WEATHER.refreshMinutes * 60000);
  }
}

function onKey(e){
  if (e.code === 'Space'){ e.preventDefault(); setPlaying(!state.playing); }
  if (e.key === '1') setWeather('clear', true);
  if (e.key === '2') setWeather('rain', true);
  if (e.key === '3') setWeather('snow', true);
}
window.addEventListener('keydown', onKey);

// 一定時間操作がなければ UI をそっと薄くする
let idleTimer = null;
function poke(){
  stage.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => stage.classList.add('idle'), 4500);
}
// ステージ自身にも付けておく（小窓に引っ越しても一緒に付いていく）
['pointermove','pointerdown'].forEach(ev => stage.addEventListener(ev, poke));
['pointermove','pointerdown','keydown'].forEach(ev => window.addEventListener(ev, poke));
poke();
