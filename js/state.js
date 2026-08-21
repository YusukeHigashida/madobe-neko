"use strict";
/* ============================================================
   状態
   ============================================================ */
/* 東京の現在時刻を 0〜24 の小数で返す（PCのタイムゾーンが違っても正しく出る） */
let tokyoFmt = null;
function tokyoHour(){
  try{
    if (!tokyoFmt){
      tokyoFmt = new Intl.DateTimeFormat('en-GB', {
        timeZone: LIVE_WEATHER.tz, hour12: false,
        hour: '2-digit', minute: '2-digit', second: '2-digit',
      });
    }
    const p = tokyoFmt.formatToParts(new Date());
    const g = (t) => +p.find(x => x.type === t).value;
    return (g('hour') % 24) + g('minute') / 60 + g('second') / 3600;
  } catch (e){
    // タイムゾーン情報が使えない環境ではPCのローカル時刻で代用
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60 + d.getSeconds() / 3600;
  }
}

const state = {
  hour: START.followRealTime ? tokyoHour() : START.hour,
  followTime: START.followRealTime,   // 実時間に追従中か
  playing: START.playing,
  weather: START.weather,
  sound: false,
  pet: 0,          // なで度 0..1
  petting: false,
  lastPet: -1e9,
  live: false,     // 実際の天気に同期中か
  liveText: '',    // 「晴れ」「雨」などの表示用ラベル
  liveError: '',
};

const $ = (id) => document.getElementById(id);
// a 以上 b 未満の乱数。猫のふるまい・天気・ハートで共用する。
const rand = (a, b) => a + Math.random() * (b - a);
const stage = $('stage');
const fx = $('fx'), ctx = fx.getContext('2d');
