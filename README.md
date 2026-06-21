# 🚀 インベーダーゲーム (Invader Game)

HTML5 Canvas と Vanilla JavaScript で実装したブラウザ向けスペースインベーダーゲームです。
ビルド不要で動作し、**GitHub Pages** で公開できます。

👉 **プレイする:** https://mokimonogakari.github.io/invader_game/

---

## 🎮 ゲーム概要

プレイヤーは画面下部の砲台を操作し、上空から迫りくるインベーダーの群れを全滅させます。
インベーダーは残数が減るほど加速し、レベルが上がるほど数と攻撃が激しくなります。

| 要素 | 内容 |
| --- | --- |
| ライフ | 3 機（敵弾の被弾で減少） |
| レベル | クリアごとに上昇（行数・速度・攻撃頻度が増加） |
| バリア | 破壊可能な防御壁（4 基） |
| スコア | 上段の敵ほど高得点（10 / 20 / 30 点） |
| ハイスコア | `localStorage` に保存され次回も引き継ぎ |

## 🕹️ 操作方法

| 操作 | キーボード | タッチ |
| --- | --- | --- |
| 移動 | `←` `→` (または `A` `D`) | 画面下の `◀` `▶` ボタン |
| 発射 | `Space` | `●` ボタン |
| 一時停止 | `P` | — |
| 開始 / 再挑戦 | `Space` / `START` ボタン | 画面タップ |

## 📁 ファイル構成

```
invader_game/
├── index.html            # ゲーム画面のマークアップ
├── style.css             # スタイル（レスポンシブ・タッチ対応）
├── game.js               # ゲームロジック（状態管理・描画・当たり判定）
├── README.md             # 本ドキュメント
├── docs/
│   ├── state-graph.md    # ゲーム状態遷移グラフ（LangGraph 風ステートマシン図）
│   └── architecture.md   # 設計・モジュール構成ドキュメント
└── .github/
    └── workflows/
        └── deploy.yml    # GitHub Pages 自動デプロイ
```

## 🚀 ローカルで動かす

静的ファイルのみなので、任意の HTTP サーバーで配信するだけです。

```bash
# Python の場合
python3 -m http.server 8000
# → http://localhost:8000 を開く
```

> `localStorage` を使うため、`file://` 直接オープンより HTTP サーバー経由を推奨します。

## 🌐 GitHub Pages での公開

このリポジトリには GitHub Actions（`.github/workflows/deploy.yml`）が含まれており、
`main` ブランチへの push で自動的に GitHub Pages へデプロイされます。

初回のみ、リポジトリの **Settings → Pages → Build and deployment → Source** を
**「GitHub Actions」** に設定してください。

詳細手順は [`docs/architecture.md`](docs/architecture.md#デプロイ) を参照してください。

## 📐 設計ドキュメント

- [ゲーム状態遷移グラフ (state-graph.md)](docs/state-graph.md) — ステートマシンの定義
- [アーキテクチャ (architecture.md)](docs/architecture.md) — モジュール構成とゲームループ

## 📜 ライセンス

MIT License
