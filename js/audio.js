"use strict";
/* ============================================================
   音（すべてコード生成。素材ファイル不要）
   ============================================================ */
let AC = null, master = null, nodes = {};
function initAudio(){
  if (AC) return;
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return;
  AC = new Ctx();
  master = AC.createGain();
  master.gain.value = 0;
  master.connect(AC.destination);

  // --- ホワイトノイズ源（雨に使う） ---
  const len = AC.sampleRate * 2;
  const buf = AC.createBuffer(1, len, AC.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  const noise = AC.createBufferSource();
  noise.buffer = buf; noise.loop = true;
  const bp = AC.createBiquadFilter();
  bp.type = 'lowpass'; bp.frequency.value = 1400; bp.Q.value = .4;
  const hp = AC.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 320;
  const rainGain = AC.createGain(); rainGain.gain.value = 0;
  noise.connect(bp); bp.connect(hp); hp.connect(rainGain); rainGain.connect(master);
  noise.start();
  nodes.rain = rainGain;

  // --- ゴロゴロ音 ---
  const purrOsc = AC.createOscillator();
  purrOsc.type = 'sawtooth'; purrOsc.frequency.value = 27;
  const purrLp = AC.createBiquadFilter();
  purrLp.type = 'lowpass'; purrLp.frequency.value = 180;
  const purrGain = AC.createGain(); purrGain.gain.value = 0;
  const lfo = AC.createOscillator(); lfo.frequency.value = 23;
  const lfoGain = AC.createGain(); lfoGain.gain.value = .5;
  lfo.connect(lfoGain); lfoGain.connect(purrLp.detune);
  purrOsc.connect(purrLp); purrLp.connect(purrGain); purrGain.connect(master);
  purrOsc.start(); lfo.start();
  nodes.purr = purrGain;

  scheduleAmbient();
  if (BGM_ENABLED) initBgm();
}

/* ------------------------------------------------------------
   BGM エンジン
   ・パッド（和音）＋ ベル（旋律）＋ 低音 の3層
   ・時間帯と天気からパラメータを決め、和音の切れ目で滑らかに移る
   ------------------------------------------------------------ */
let bgm = null;

function midiHz(m){ return 440 * Math.pow(2, (m - 69) / 12); }

// 残響用のインパルス応答をその場で合成する（音源ファイル不要）
function makeReverbIR(sec, decay){
  const len = Math.floor(AC.sampleRate * sec);
  const buf = AC.createBuffer(2, len, AC.sampleRate);
  for (let ch = 0; ch < 2; ch++){
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++){
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  return buf;
}

function initBgm(){
  if (bgm) return;
  const out = AC.createGain();  out.gain.value = 0;            // BGM全体の音量
  const tone = AC.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = 2200; tone.Q.value = .3;
  const dry = AC.createGain();  dry.gain.value = .82;
  const wet = AC.createGain();  wet.gain.value = .45;
  const rev = AC.createConvolver(); rev.buffer = makeReverbIR(3.2, 2.6);
  tone.connect(dry); dry.connect(out);
  tone.connect(rev); rev.connect(wet); wet.connect(out);
  out.connect(master);
  bgm = { out, tone, nextChord: 0, nextNote: 0, chordIdx: 0, mood: BGM_MOODS[1], voices: [] };
  setInterval(bgmTick, 90);
}

// 今の時間帯と天気から、演奏のパラメータを決める
function bgmParams(){
  const h = state.hour;
  let m = BGM_MOODS[BGM_MOODS.length - 1];
  for (const p of BGM_MOODS) if (h >= p.from) m = p;
  if (h < BGM_MOODS[0].from) m = BGM_MOODS[BGM_MOODS.length - 1];   // 深夜は「よる」
  const w = state.weather;
  return {
    mood: m,
    cutoff:    m.cutoff * (w === 'rain' ? .5 : w === 'snow' ? .8 : 1),
    noteEvery: m.noteEvery * (w === 'rain' ? 1.35 : w === 'snow' ? 1.2 : 1),
    pad:       m.pad * (w === 'rain' ? 1.1 : 1),
    bellGain:  w === 'rain' ? .055 : w === 'snow' ? .05 : .07,
    bellOct:   m.bellOct + (w === 'snow' ? 1 : 0),
  };
}

// 和音を1つ鳴らす（ゆっくり立ち上がり、ゆっくり消える）
function playChord(t, root, dur, P){
  const third = P.mood.major ? 4 : 3;
  const notes = [root - 12, root, root + third, root + 7, root + 12];
  notes.forEach((n, i) => {
    const o = AC.createOscillator();
    o.type = i === 0 ? 'sine' : 'triangle';
    o.frequency.value = midiHz(n);
    o.detune.value = (i % 2 ? 4 : -4);
    const g = AC.createGain();
    const peak = P.pad * (i === 0 ? 1.25 : i === 4 ? .45 : .8);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + dur * .35);
    g.gain.setValueAtTime(peak, t + dur * .6);
    g.gain.linearRampToValueAtTime(0, t + dur);
    o.connect(g); g.connect(bgm.tone);
    o.start(t); o.stop(t + dur + .1);
  });
}

// 旋律を1音（やわらかいベル）
function playBell(t, midi, P){
  const o = AC.createOscillator();
  o.type = 'sine';
  o.frequency.value = midiHz(midi);
  const o2 = AC.createOscillator();          // 倍音をひとつ足して鈴らしさを出す
  o2.type = 'sine';
  o2.frequency.value = midiHz(midi + 12);
  const g = AC.createGain(), g2 = AC.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(P.bellGain, t + .02);
  g.gain.exponentialRampToValueAtTime(.0008, t + 2.6);
  g2.gain.setValueAtTime(0, t);
  g2.gain.linearRampToValueAtTime(P.bellGain * .3, t + .015);
  g2.gain.exponentialRampToValueAtTime(.0005, t + 1.2);
  o.connect(g); g.connect(bgm.tone);
  o2.connect(g2); g2.connect(bgm.tone);
  o.start(t); o.stop(t + 2.8);
  o2.start(t); o2.stop(t + 1.4);
}

function bgmTick(){
  if (!bgm || !AC) return;
  const P = bgmParams();
  const now = AC.currentTime;
  const AHEAD = .5;

  // 音色の明るさは常に滑らかに追従させる
  bgm.tone.frequency.setTargetAtTime(P.cutoff, now, 1.2);
  const target = (state.sound ? 1 : 0);
  bgm.out.gain.setTargetAtTime(target * .5, now, .8);
  if (!state.sound) return;                       // 消音中は音符を組まない

  // 和音（1コードを約11秒）
  const CHORD = 11;
  if (bgm.nextChord < now + AHEAD){
    if (bgm.nextChord < now) bgm.nextChord = now + .05;
    bgm.mood = P.mood;
    const root = P.mood.root + P.mood.prog[bgm.chordIdx % P.mood.prog.length];
    playChord(bgm.nextChord, root, CHORD + 1.5, P);   // 少し重ねて途切れさせない
    bgm.chordRoot = root;
    bgm.chordIdx++;
    bgm.nextChord += CHORD;
  }

  // 旋律
  if (bgm.nextNote < now + AHEAD){
    if (bgm.nextNote < now) bgm.nextNote = now + .1;
    if (Math.random() < .78){                        // ときどき休符
      const sc = P.mood.scale;
      const deg = sc[Math.floor(Math.random() * sc.length)];
      const oct = 12 * (P.bellOct + (Math.random() < .25 ? 1 : 0));
      playBell(bgm.nextNote, (bgm.chordRoot || P.mood.root) + deg + oct, P);
    }
    bgm.nextNote += P.noteEvery * rand(.8, 1.4);
  }
}

function chirp(){
  if (!AC || !state.sound) return;
  const t = AC.currentTime;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = 'sine';
  const base = rand(1900, 3200);
  o.frequency.setValueAtTime(base, t);
  o.frequency.exponentialRampToValueAtTime(base * rand(1.2, 1.7), t + .06);
  o.frequency.exponentialRampToValueAtTime(base * .85, t + .13);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(.05, t + .02);
  g.gain.exponentialRampToValueAtTime(.0008, t + .18);
  o.connect(g); g.connect(master);
  o.start(t); o.stop(t + .22);
}
function cricket(){
  if (!AC || !state.sound) return;
  const t = AC.currentTime;
  for (let k = 0; k < 3; k++){
    const o = AC.createOscillator(), g = AC.createGain();
    o.type = 'triangle'; o.frequency.value = rand(4200, 4800);
    const s = t + k * .09;
    g.gain.setValueAtTime(0, s);
    g.gain.linearRampToValueAtTime(.018, s + .01);
    g.gain.exponentialRampToValueAtTime(.0006, s + .06);
    o.connect(g); g.connect(master);
    o.start(s); o.stop(s + .08);
  }
}
function scheduleAmbient(){
  const tick = () => {
    if (state.sound){
      const n = nightAmount(state.hour);
      if (state.weather === 'clear' && n < .3 && Math.random() < .55){
        chirp();
        if (Math.random() < .45) setTimeout(chirp, rand(140, 380));
      }
      if (n > .6 && Math.random() < .6) cricket();
    }
    setTimeout(tick, rand(1400, 4200));
  };
  setTimeout(tick, 1200);
}

/* ------------------------------------------------------------
   鳴き声（合成）
   のこぎり波を「声帯」、3つのバンドパスを「口の形（フォルマント）」に見立て、
   フォルマントを「いー」→「あー」へ動かすと猫の鳴き声らしくなる。
   毎回わずかに高さ・長さ・抑揚を変えるので、連打しても同じ声にならない。
   ------------------------------------------------------------ */
function meow(){
  if (!AC || !state.sound) return;
  const t = AC.currentTime + .01;
  const sleepy = nightAmount(state.hour) > .5 || cat.pose === 'sleep';
  const chirp  = !sleepy && Math.random() < .3;    // ときどき短い「にゃっ」

  // 高めの声（子猫寄り）。口も小さいのでフォルマントも一緒に上げる。
  const base = rand(680, 880) * (sleepy ? .78 : 1);
  const dur  = sleepy ? rand(.5, .74) : chirp ? rand(.17, .26) : rand(.34, .54);

  const osc = AC.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(base * .84, t);
  osc.frequency.linearRampToValueAtTime(base * 1.26, t + dur * .18);   // きゅっと持ち上げる
  osc.frequency.setValueAtTime(base * 1.26, t + dur * .42);
  // 語尾は下げ切らない方が甘えた感じになる
  osc.frequency.exponentialRampToValueAtTime(base * (chirp ? 1.02 : .84), t + dur);

  const vib = AC.createOscillator();              // 細かな震え（速めのほうが可愛い）
  vib.frequency.value = rand(6.8, 9.2);
  const vibG = AC.createGain();
  vibG.gain.value = base * .028;
  vib.connect(vibG); vibG.connect(osc.frequency);

  // 口の形：狭い「にぃ」から少し開いた「ゃあ」へ（全体に高め）
  const F = [[720, 980, 7], [2450, 1550, 10], [3350, 2950, 11]];
  const amp = AC.createGain();
  F.forEach(([f0, f1, q], i) => {
    const bp = AC.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = q;
    bp.frequency.setValueAtTime(f0, t);
    bp.frequency.linearRampToValueAtTime(f1, t + dur * .7);
    const g = AC.createGain();
    g.gain.value = [1, .62, .3][i];               // 上の倍音を少し強めて明るく
    osc.connect(bp); bp.connect(g); g.connect(amp);
  });

  const peak = sleepy ? .085 : chirp ? .12 : .13;
  amp.gain.setValueAtTime(0, t);
  amp.gain.linearRampToValueAtTime(peak, t + (chirp ? .02 : .05));
  amp.gain.setValueAtTime(peak, t + dur * .5);
  amp.gain.exponentialRampToValueAtTime(.0008, t + dur);

  const lp = AC.createBiquadFilter();             // 角だけ取る（下げすぎるとこもる）
  lp.type = 'lowpass';
  lp.frequency.value = sleepy ? 2100 : 4600;

  amp.connect(lp); lp.connect(master);
  osc.start(t); osc.stop(t + dur + .05);
  vib.start(t); vib.stop(t + dur + .05);
}

let lastMeow = -1e9;
function tryMeow(sure){
  const now = performance.now();
  // 連打しても鳴きっぱなしにならないよう間隔を空け、なで続けているときは時々だけ
  if (now - lastMeow < (sure ? 1100 : 2600)) return;
  if (!sure && Math.random() > .45) return;
  lastMeow = now;
  meow();
}

let purrLevel = 0;
function purrBump(mul = 1){
  purrLevel = Math.min(1, purrLevel + .35 * mul);
}

$('soundBtn').addEventListener('click', () => {
  state.sound = !state.sound;
  if (state.sound){
    initAudio();
    AC && AC.resume();
    setBtn($('soundBtn'), '🔊', '音');
    $('soundBtn').classList.add('on');
  } else {
    setBtn($('soundBtn'), '🔇', '音');
    $('soundBtn').classList.remove('on');
  }
});

/* 音量を目標値へ近づける。
   万一 dt が壊れても、音量は 0..max の外へ出さない（＝耳に痛いノイズを出さない）。
   補間の係数も 0..1 に収める。 */
function approachGain(param, target, max, k){
  const step = Math.max(0, Math.min(1, k));
  param.value = Math.max(0, Math.min(max, param.value + (target - param.value) * step));
}

function updateAudio(dt){
  if (!AC || !master) return;
  approachGain(master.gain, state.sound ? .9 : 0, .9, dt * 3);
  if (nodes.rain){
    const t = (state.weather === 'rain' ? .16 : state.weather === 'snow' ? .012 : 0);
    approachGain(nodes.rain.gain, t, .16, dt * 1.2);
  }
  if (nodes.purr){
    approachGain(nodes.purr.gain, purrLevel * .09, .09, dt * 2.5);
  }
}
