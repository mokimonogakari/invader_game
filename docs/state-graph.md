# ゲーム状態遷移グラフ (State Graph)

このゲームは **有限ステートマシン (FSM)** として設計されています。
LangGraph のようなグラフ指向の考え方で、各「状態 (ノード)」と「遷移 (エッジ)」を
明示的に定義することで、ゲームフローの見通しを良くしています。

状態は `game.js` 内の `State` オブジェクトに対応します。

```js
const State = {
  READY,        // 開始待ち
  PLAYING,      // プレイ中
  PAUSED,       // 一時停止
  LEVEL_CLEAR,  // レベルクリア演出
  GAME_OVER,    // ゲームオーバー
};
```

## 状態遷移図 (Mermaid)

```mermaid
stateDiagram-v2
    [*] --> READY

    READY --> PLAYING: START / Space / Tap

    PLAYING --> PAUSED: P キー
    PAUSED --> PLAYING: P キー / Tap

    PLAYING --> LEVEL_CLEAR: インベーダー全滅
    LEVEL_CLEAR --> PLAYING: 1.6秒後に次レベル生成

    PLAYING --> GAME_OVER: ライフ0 / 敵が下端到達
    GAME_OVER --> PLAYING: RETRY / Space (リスタート)

    GAME_OVER --> [*]
```

## 状態ごとの責務

| 状態 | 説明 | 主な更新処理 | 遷移先 |
| --- | --- | --- | --- |
| `READY` | タイトル表示・開始待ち | なし（描画のみ） | `PLAYING` |
| `PLAYING` | コアゲームループ | 移動・発射・敵AI・当たり判定 | `PAUSED` / `LEVEL_CLEAR` / `GAME_OVER` |
| `PAUSED` | 一時停止 | なし | `PLAYING` |
| `LEVEL_CLEAR` | クリア演出（タイマー） | パーティクルのみ更新 | `PLAYING`（次レベル） |
| `GAME_OVER` | 終了・ハイスコア保存 | なし | `PLAYING`（リスタート） |

## 遷移を司る関数

すべての状態遷移は `setState(next)` を通して行われます。
これにより副作用（オーバーレイ表示・ハイスコア保存・タイマー初期化）を一元管理しています。

```mermaid
flowchart LR
    input[入力イベント] --> handler[handlePrimaryAction / keydown]
    handler --> setState[setState]
    setState --> overlay[オーバーレイ更新]
    setState --> side[副作用: タイマー/保存/リセット]
    setState --> stateVar[(game.state)]
    loop[update ループ] --> stateVar
```

## ゲームループとの関係

`requestAnimationFrame` による `loop()` は毎フレーム `update(dt)` を呼び、
`game.state` の値に応じて処理を分岐します。

```mermaid
flowchart TD
    raf[requestAnimationFrame] --> loop[loop dt]
    loop --> update[update dt]
    update -->|state == PLAYING| play[移動・発射・敵AI・衝突]
    update -->|state == LEVEL_CLEAR| timer[クリアタイマー減算]
    update -->|その他| noop[更新なし]
    loop --> render[render: 全エンティティ描画]
    render --> raf
```
