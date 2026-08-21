# まどべの猫 / Window Cat

窓辺の猫を眺めるだけの箱庭アプリ。ビルド不要・外部ライブラリなし。
`index.html` をブラウザで開けば動く（`file://` でも可）。

公開先: <https://yusukehigashida.github.io/madobe-neko/>

`main` に push すると GitHub Pages が自動で作り直す（設定は「Deploy from a branch / main / `/`」）。
ビルド工程は無いので、リポジトリの中身がそのまま配信される。
Jekyll に余計な処理をさせないために空の `.nojekyll` を置いている。

## フォルダ構成

```
index.html          画面の骨組みだけ。CSS と JS は読み込むだけ
css/style.css       見た目（色・レイアウト・アニメーション）
js/                 挙動。下の「読み込み順」の順番で読まれる
assets/             使っている画像素材
assets/unused/      古い版の素材（cat.png / bg-day.png）。参照していない
docs/SPEC.md        仕様メモ
tools/serve.js      動作確認用の簡易静的サーバー（`node tools/serve.js . 4321`）
```

## js/ の読み込み順

`index.html` の末尾で、**ふつうの `<script src>` を上から順に**読んでいる。
ES モジュールにすると `file://` で開けなくなるので、あえてモジュールにしていない。
そのぶん各ファイルは同じグローバルスコープを共有するので、**並べ替えると壊れる**。

| ファイル | 役割 |
| --- | --- |
| `config.js` | 起動時の設定、スプライトの切り出し座標、BGM パラメータ、時間帯カラー |
| `state.js` | アプリの状態（`state` / `cat`）と共通ヘルパ（`$` / `rand`） |
| `assets.js` | 画像素材の探索と読み込み、背景のクロスフェード比率 |
| `render.js` | 時間 → 見た目。背景・色オーバーレイ・猫の向きを毎フレーム反映 |
| `cat.js` | 猫のふるまい。姿勢の選択と歩行の状態遷移 |
| `weather-fx.js` | 雨・雪・星などのパーティクル（canvas） |
| `pet.js` | なでる操作とハートの演出 |
| `audio.js` | BGM・環境音・鳴き声。すべてコードで合成（音源ファイル不要） |
| `ui.js` | ボタンとスライダー、実際の天気（Open-Meteo）との同期 |
| `pip.js` | 小窓で最前面に出す（Document Picture-in-Picture） |
| `main.js` | メインループと起動 |

## 小窓（PiP）モードのときの注意

小窓に切り替えると `#app` ごと別ウィンドウの `document` へ引っ越す。
そのため **`document.querySelector()` で要素を引き直すコードは小窓で `null` になる**。
新しく要素を触るときは、起動時に掴んだ参照（`elCatInner` など）を使うこと。
CSS も別ウィンドウには自動で付いてこないので、`pip.js` の `moveInto()` が
`<style>` と `<link rel="stylesheet">` を複製している。

もうひとつの落とし穴が**時計**。小窓は別ウィンドウなので `performance.timeOrigin` が
こちらと違い、小窓側の `requestAnimationFrame` が渡してくるタイムスタンプは
元の窓の `performance.now()` と噛み合わない。混ぜると小窓へ移った瞬間に
`dt` が大きな負の値になり、音量の補間が発散して**ノイズが出る**。
そのため `main.js` のループは rAF の引数を使わず、常に `performance.now()` で測っている。
`state.lastPet` や `cat.until` もこの時計で記録しているので、時刻を扱うときは揃えること。

小窓が開いているあいだ、元のページは生きたまま残る。ブラウザの窓を閉じても
ページだけ生き残ることがあり、**音を止めていないと BGM が鳴り続ける**。
ホワイトノイズ・ゴロゴロ・LFO は起動時に `start()` したら止めない作りで、
BGM も `setInterval` で鳴り続けるので、`AudioContext` を閉じない限り音は消えない。
そこで `audio.js` の `shutdownAudio()` を `pagehide` で呼び、タイマーを止めて
`AudioContext` を閉じている。`pip.js` も同じ `pagehide` で小窓を閉じる。
どちらも `event.persisted`（＝「戻る」で復帰しうる状態）のときは何もしない。

## 素材について

天気データは [Open-Meteo](https://open-meteo.com/)（CC BY 4.0）。
ライセンス上クレジット表示が必須なので、画面右上の `#credit` は消さないこと。
