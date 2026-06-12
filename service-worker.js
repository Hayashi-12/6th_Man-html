// ============================================
// Service Worker - オフライン対応の仕組み
//
// 【解説】Service Workerとは？
// ブラウザとサーバーの「間」に立つプログラムです。
// 通常: ブラウザ → サーバー → レスポンス
// SW有: ブラウザ → Service Worker → キャッシュ or サーバー
//
// 一度ページを開くとファイルをキャッシュ（保存）し、
// 次回以降はオフラインでもキャッシュから表示できます。
//
// Service Workerには3つのイベントがあります:
// 1. install  → 初回登録時。キャッシュにファイルを保存
// 2. activate → 更新時。古いキャッシュを削除
// 3. fetch    → 通信発生時。キャッシュから返すか判断
// ============================================

// キャッシュの名前（バージョン管理用）
// ファイルを更新したらここの数字を上げると、古いキャッシュが消えて新しいものに置き換わります
var CACHE_NAME = '6thman-v1';

// キャッシュするファイルの一覧
var FILES_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// ============================================
// 1. install イベント - キャッシュにファイルを保存
//
// 【解説】
// event.waitUntil() の中の処理が完了するまで
// インストールを「待つ」という意味です。
// caches.open() でキャッシュを開き、
// cache.addAll() で一括保存します。
// ============================================
self.addEventListener('install', function(event) {
  console.log('[Service Worker] インストール中...');

  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('[Service Worker] ファイルをキャッシュ中...');
      return cache.addAll(FILES_TO_CACHE);
    })
  );

  // 新しいSWをすぐに有効化する
  self.skipWaiting();
});

// ============================================
// 2. activate イベント - 古いキャッシュを削除
//
// 【解説】
// CACHE_NAME を変更すると、古い名前のキャッシュが残ります。
// ここで古いキャッシュを見つけて削除します。
// これにより、アプリ更新時に古いファイルが残らなくなります。
// ============================================
self.addEventListener('activate', function(event) {
  console.log('[Service Worker] 有効化中...');

  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(name) {
          if (name !== CACHE_NAME) {
            console.log('[Service Worker] 古いキャッシュを削除:', name);
            return caches.delete(name);
          }
        })
      );
    })
  );

  // すべてのタブで即座に新しいSWを使う
  self.clients.claim();
});

// ============================================
// 3. fetch イベント - リクエストの処理
//
// 【解説】戦略: 「ネットワーク優先、失敗したらキャッシュ」
//
// 1. まずサーバーに取りに行く（最新のファイルを取得）
// 2. 成功 → そのレスポンスを返す＆キャッシュも更新
// 3. 失敗（オフライン）→ キャッシュから返す
//
// この戦略なら、オンライン時は常に最新、
// オフライン時はキャッシュで動作します。
// ============================================
self.addEventListener('fetch', function(event) {

  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        // ネットワーク成功 → キャッシュにも保存して返す
        var responseClone = response.clone();
        // ↑ response は1回しか読めないのでコピーを作る

        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, responseClone);
        });

        return response;
      })
      .catch(function() {
        // ネットワーク失敗（オフライン）→ キャッシュから返す
        return caches.match(event.request);
      })
  );
});
