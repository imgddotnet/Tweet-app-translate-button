# Tweet.app Translate Button

[app.tweet.app](https://app.tweet.app) の各ツイートおよび投稿欄に翻訳ボタンを追加するTampermonkeyユーザースクリプト。

A Tampermonkey userscript that adds translate buttons to tweets and the compose box on [app.tweet.app](https://app.tweet.app).

## インストール方法 / Installation

1. TampermonkeyをSafariに導入(App Store)
   Install Tampermonkey for Safari (App Store)
2. Tampermonkeyメニュー→「新規スクリプトを追加」
   Tampermonkey menu → "Create a new script"
3. `tweet-app-translate.user.js` の内容を貼り付けて保存(Cmd+S)
   Paste the contents of `tweet-app-translate.user.js` and save (Cmd+S)
4. `app.tweet.app` を開くと自動的に有効化
   Open `app.tweet.app` — the script activates automatically

## 使い方 / Usage

- 各ツイート本文下の「🌐 翻訳」ボタンを押すと、選択言語に翻訳して表示(再度押すと非表示)
  Click the "🌐 翻訳" button under any tweet to show a translation in your selected language (click again to hide)
- 投稿欄の「🌐 翻訳を挿入」ボタンを押すと翻訳文が下に表示され、それをクリックすると入力欄末尾に挿入
  In the compose box, click "🌐 翻訳を挿入" to preview a translation below the input; click that preview to insert it at the end of your draft
- 画面上部(Who to followの上)にある2つのセレクトで言語を切替
  Two dropdowns appear above "Who to follow":
  - 左: ツイート閲覧時の翻訳先言語(初期値はOS/ブラウザの言語設定から自動判定)
    Left: language to translate tweets into (auto-detected from your OS/browser language by default)
  - 右(Translate to: ...): 投稿翻訳先言語(初期値は英語)
    Right ("Translate to: ..."): language for translating your own posts (defaults to English)
- 設定は自動保存され、次回起動時も引き継がれる
  Settings are saved automatically and persist across sessions

## 仕組み / How it works

Google翻訳の非公式エンドポイント(`translate.googleapis.com`)を使用し、レート制限(HTTP 429)発生時は自動的に別エンドポイント(`clients5.google.com`)へフォールバックする。

Uses Google Translate's unofficial endpoint (`translate.googleapis.com`), with automatic fallback to a secondary endpoint (`clients5.google.com`) when rate-limited (HTTP 429).

## 注意 / Notes

- 非公式APIを使用しているため、Google側の仕様変更により動作しなくなる可能性がある
  Relies on an unofficial API and may break if Google changes its response format
- `app.tweet.app` のDOM構造変更に伴い、ボタン挿入位置がずれる場合がある
  Button placement may break if `app.tweet.app`'s DOM structure changes

## License

MIT
