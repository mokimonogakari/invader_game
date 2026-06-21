/*
 * インベーダーゲーム (Space Invaders)
 * Vanilla JavaScript + HTML5 Canvas 実装。
 * ゲームの状態遷移は docs/state-graph.md のステートグラフに対応している。
 */

(() => {
  "use strict";

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const W = canvas.width;
  const H = canvas.height;

  // ---- UI 要素 ----
  const scoreEl = document.getElementById("score");
  const highScoreEl = document.getElementById("highScore");
  const levelEl = document.getElementById("level");
  const livesEl = document.getElementById("lives");
  const overlay = document.getElementById("overlay");
  const overlayTitle = document.getElementById("overlayTitle");
  const overlayText = document.getElementById("overlayText");
  const startButton = document.getElementById("startButton");

  // ---- ゲーム状態 (ステートグラフのノード) ----
  const State = {
    READY: "READY",
    PLAYING: "PLAYING",
    PAUSED: "PAUSED",
    LEVEL_CLEAR: "LEVEL_CLEAR",
    GAME_OVER: "GAME_OVER",
  };

  const HIGH_SCORE_KEY = "invader_high_score";

  const game = {
    state: State.READY,
    score: 0,
    highScore: Number(localStorage.getItem(HIGH_SCORE_KEY) || 0),
    level: 1,
    lives: 3,
    lastTime: 0,
    clearTimer: 0,
  };

  // ---- プレイヤー ----
  const player = {
    w: 40,
    h: 18,
    x: W / 2 - 20,
    y: H - 50,
    speed: 320,
    cooldown: 0,
    fireDelay: 0.35,
  };

  // ---- エンティティ配列 ----
  let playerBullets = [];
  let enemyBullets = [];
  let invaders = [];
  let barriers = [];
  let particles = [];

  // ---- インベーダーの群れ制御 ----
  const swarm = {
    dir: 1, // 1 = 右, -1 = 左
    speed: 24, // px/sec (水平)
    stepDown: 24,
    fireChance: 0.4, // 1秒あたりの発射期待値（レベルで増加）
  };

  // ---- 入力 ----
  const keys = { left: false, right: false, fire: false };

  // ===================================================================
  // 初期化
  // ===================================================================
  function createInvaders(level) {
    invaders = [];
    const cols = 8;
    const rows = 4 + Math.min(level - 1, 2); // レベルで行数増加 (最大6)
    const gapX = 48;
    const gapY = 40;
    const offsetX = (W - (cols - 1) * gapX) / 2;
    const offsetY = 70;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        // 上段ほど高得点
        const type = r === 0 ? 30 : r < 2 ? 20 : 10;
        invaders.push({
          x: offsetX + c * gapX - 16,
          y: offsetY + r * gapY,
          w: 32,
          h: 24,
          alive: true,
          points: type,
          frame: 0,
        });
      }
    }
    swarm.dir = 1;
    swarm.speed = 24 + (level - 1) * 8;
    swarm.fireChance = 0.4 + (level - 1) * 0.25;
  }

  function createBarriers() {
    barriers = [];
    const count = 4;
    const bw = 56;
    const bh = 36;
    const spacing = (W - count * bw) / (count + 1);
    const y = H - 130;
    for (let i = 0; i < count; i++) {
      const bx = spacing + i * (bw + spacing);
      // 各バリアを 4x3 のブロックに分割（破壊可能）
      const cellsX = 7;
      const cellsY = 5;
      const cw = bw / cellsX;
      const ch = bh / cellsY;
      const cells = [];
      for (let cy = 0; cy < cellsY; cy++) {
        for (let cx = 0; cx < cellsX; cx++) {
          // 下側中央をくり抜いてアーチ状にする
          if (cy >= cellsY - 2 && cx >= 2 && cx <= cellsX - 3) continue;
          cells.push({
            x: bx + cx * cw,
            y: y + cy * ch,
            w: cw,
            h: ch,
            hp: 3,
          });
        }
      }
      barriers.push(...cells);
    }
  }

  function resetEntities() {
    playerBullets = [];
    enemyBullets = [];
    particles = [];
    player.x = W / 2 - player.w / 2;
    player.cooldown = 0;
  }

  function startGame() {
    game.score = 0;
    game.level = 1;
    game.lives = 3;
    resetEntities();
    createInvaders(game.level);
    createBarriers();
    setState(State.PLAYING);
    updateHud();
  }

  function nextLevel() {
    game.level += 1;
    resetEntities();
    createInvaders(game.level);
    createBarriers();
    setState(State.PLAYING);
    updateHud();
  }

  // ===================================================================
  // 状態遷移
  // ===================================================================
  function setState(next) {
    game.state = next;
    switch (next) {
      case State.PLAYING:
        hideOverlay();
        break;
      case State.PAUSED:
        showOverlay("PAUSED", "P キー / タップで再開");
        break;
      case State.LEVEL_CLEAR:
        game.clearTimer = 1.6;
        showOverlay("LEVEL CLEAR!", `LEVEL ${game.level} 突破`);
        break;
      case State.GAME_OVER:
        saveHighScore();
        showOverlay("GAME OVER", `SCORE: ${game.score}  /  スペースで再挑戦`);
        break;
      case State.READY:
      default:
        showOverlay("INVADER GAME", "スペース / タップで開始");
        break;
    }
  }

  function showOverlay(title, text) {
    overlayTitle.textContent = title;
    overlayText.textContent = text;
    startButton.textContent =
      game.state === State.GAME_OVER ? "RETRY" : "START";
    overlay.classList.remove("hidden");
  }

  function hideOverlay() {
    overlay.classList.add("hidden");
  }

  // ===================================================================
  // 入力ハンドリング
  // ===================================================================
  function fire() {
    if (game.state !== State.PLAYING) return;
    if (player.cooldown > 0) return;
    playerBullets.push({
      x: player.x + player.w / 2 - 2,
      y: player.y - 10,
      w: 4,
      h: 12,
      speed: 520,
    });
    player.cooldown = player.fireDelay;
  }

  function handlePrimaryAction() {
    // スペース / タップ / START ボタンの共通処理
    switch (game.state) {
      case State.READY:
      case State.GAME_OVER:
        startGame();
        break;
      case State.PAUSED:
        setState(State.PLAYING);
        break;
      case State.PLAYING:
        fire();
        break;
    }
  }

  document.addEventListener("keydown", (e) => {
    switch (e.code) {
      case "ArrowLeft":
      case "KeyA":
        keys.left = true;
        break;
      case "ArrowRight":
      case "KeyD":
        keys.right = true;
        break;
      case "Space":
        e.preventDefault();
        handlePrimaryAction();
        keys.fire = true;
        break;
      case "KeyP":
        if (game.state === State.PLAYING) setState(State.PAUSED);
        else if (game.state === State.PAUSED) setState(State.PLAYING);
        break;
    }
  });

  document.addEventListener("keyup", (e) => {
    switch (e.code) {
      case "ArrowLeft":
      case "KeyA":
        keys.left = false;
        break;
      case "ArrowRight":
      case "KeyD":
        keys.right = false;
        break;
      case "Space":
        keys.fire = false;
        break;
    }
  });

  startButton.addEventListener("click", handlePrimaryAction);

  // タッチ操作
  function bindTouch(id, onDown, onUp) {
    const el = document.getElementById(id);
    if (!el) return;
    const down = (e) => {
      e.preventDefault();
      onDown();
    };
    const up = (e) => {
      e.preventDefault();
      if (onUp) onUp();
    };
    el.addEventListener("touchstart", down, { passive: false });
    el.addEventListener("touchend", up, { passive: false });
    el.addEventListener("mousedown", down);
    el.addEventListener("mouseup", up);
    el.addEventListener("mouseleave", up);
  }

  bindTouch(
    "btnLeft",
    () => (keys.left = true),
    () => (keys.left = false)
  );
  bindTouch(
    "btnRight",
    () => (keys.right = true),
    () => (keys.right = false)
  );
  bindTouch("btnFire", handlePrimaryAction);

  // キャンバスタップで開始/再開
  canvas.addEventListener("touchstart", (e) => {
    if (game.state !== State.PLAYING) {
      e.preventDefault();
      handlePrimaryAction();
    }
  });

  // ===================================================================
  // 更新ロジック
  // ===================================================================
  function update(dt) {
    if (game.state === State.LEVEL_CLEAR) {
      game.clearTimer -= dt;
      if (game.clearTimer <= 0) nextLevel();
      updateParticles(dt);
      return;
    }
    if (game.state !== State.PLAYING) return;

    // プレイヤー移動
    if (keys.left) player.x -= player.speed * dt;
    if (keys.right) player.x += player.speed * dt;
    player.x = Math.max(0, Math.min(W - player.w, player.x));
    if (player.cooldown > 0) player.cooldown -= dt;
    if (keys.fire) fire();

    updateBullets(dt);
    updateSwarm(dt);
    updateEnemyFire(dt);
    updateParticles(dt);
    checkCollisions();
    checkEndConditions();
  }

  function updateBullets(dt) {
    playerBullets.forEach((b) => (b.y -= b.speed * dt));
    enemyBullets.forEach((b) => (b.y += b.speed * dt));
    playerBullets = playerBullets.filter((b) => b.y + b.h > 0);
    enemyBullets = enemyBullets.filter((b) => b.y < H);
  }

  function updateSwarm(dt) {
    const living = invaders.filter((i) => i.alive);
    if (living.length === 0) return;

    // 残数が減るほど加速
    const aliveRatio = living.length / invaders.length;
    const speed = swarm.speed * (1 + (1 - aliveRatio) * 1.8);

    let minX = Infinity;
    let maxX = -Infinity;
    living.forEach((i) => {
      minX = Math.min(minX, i.x);
      maxX = Math.max(maxX, i.x + i.w);
    });

    let dropDown = false;
    if (swarm.dir === 1 && maxX + speed * dt >= W - 4) dropDown = true;
    if (swarm.dir === -1 && minX - speed * dt <= 4) dropDown = true;

    if (dropDown) {
      swarm.dir *= -1;
      living.forEach((i) => (i.y += swarm.stepDown));
    } else {
      living.forEach((i) => (i.x += swarm.dir * speed * dt));
    }

    // アニメーションフレーム切り替え
    swarmAnimTimer += dt;
    if (swarmAnimTimer > 0.5) {
      swarmAnimTimer = 0;
      living.forEach((i) => (i.frame ^= 1));
    }
  }
  let swarmAnimTimer = 0;

  function updateEnemyFire(dt) {
    const living = invaders.filter((i) => i.alive);
    if (living.length === 0) return;
    // 各列の最前線（最下段）のみ発射可能
    const frontLine = {};
    living.forEach((i) => {
      const col = Math.round(i.x / 4); // 近似でグルーピング
      if (!frontLine[col] || i.y > frontLine[col].y) frontLine[col] = i;
    });
    const shooters = Object.values(frontLine);
    if (Math.random() < swarm.fireChance * dt) {
      const shooter = shooters[Math.floor(Math.random() * shooters.length)];
      enemyBullets.push({
        x: shooter.x + shooter.w / 2 - 2,
        y: shooter.y + shooter.h,
        w: 4,
        h: 12,
        speed: 180 + game.level * 20,
      });
    }
  }

  function updateParticles(dt) {
    particles.forEach((p) => {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    });
    particles = particles.filter((p) => p.life > 0);
  }

  function spawnExplosion(x, y, color) {
    for (let i = 0; i < 12; i++) {
      const angle = (Math.PI * 2 * i) / 12;
      const sp = 60 + Math.random() * 90;
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * sp,
        vy: Math.sin(angle) * sp,
        life: 0.4 + Math.random() * 0.3,
        color: color || "#2bff88",
      });
    }
  }

  // ===================================================================
  // 衝突判定
  // ===================================================================
  function rectsOverlap(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  }

  function checkCollisions() {
    // プレイヤー弾 × インベーダー
    playerBullets.forEach((b) => {
      for (const inv of invaders) {
        if (inv.alive && rectsOverlap(b, inv)) {
          inv.alive = false;
          b.dead = true;
          addScore(inv.points);
          spawnExplosion(inv.x + inv.w / 2, inv.y + inv.h / 2, "#2bff88");
          break;
        }
      }
    });

    // 弾 × バリア（両方向）
    const hitBarrier = (bullets) => {
      bullets.forEach((b) => {
        for (const cell of barriers) {
          if (cell.hp > 0 && rectsOverlap(b, cell)) {
            cell.hp -= 1;
            b.dead = true;
            spawnExplosion(b.x, b.y, "#5fd0ff");
            break;
          }
        }
      });
    };
    hitBarrier(playerBullets);
    hitBarrier(enemyBullets);
    barriers = barriers.filter((c) => c.hp > 0);

    // 敵弾 × プレイヤー
    if (game.state === State.PLAYING) {
      for (const b of enemyBullets) {
        if (!b.dead && rectsOverlap(b, player)) {
          b.dead = true;
          loseLife();
          break;
        }
      }
    }

    playerBullets = playerBullets.filter((b) => !b.dead);
    enemyBullets = enemyBullets.filter((b) => !b.dead);
  }

  function loseLife() {
    game.lives -= 1;
    spawnExplosion(player.x + player.w / 2, player.y + player.h / 2, "#ff5b5b");
    updateHud();
    if (game.lives <= 0) {
      setState(State.GAME_OVER);
    } else {
      player.x = W / 2 - player.w / 2;
    }
  }

  function checkEndConditions() {
    const living = invaders.filter((i) => i.alive);
    // 全滅 → レベルクリア
    if (living.length === 0) {
      setState(State.LEVEL_CLEAR);
      return;
    }
    // インベーダーがプレイヤーラインに到達 → ゲームオーバー
    for (const inv of living) {
      if (inv.y + inv.h >= player.y) {
        setState(State.GAME_OVER);
        return;
      }
    }
  }

  // ===================================================================
  // スコア / HUD
  // ===================================================================
  function addScore(points) {
    game.score += points;
    if (game.score > game.highScore) game.highScore = game.score;
    updateHud();
  }

  function saveHighScore() {
    localStorage.setItem(HIGH_SCORE_KEY, String(game.highScore));
  }

  function updateHud() {
    scoreEl.textContent = game.score;
    highScoreEl.textContent = game.highScore;
    levelEl.textContent = game.level;
    livesEl.textContent = game.lives;
  }

  // ===================================================================
  // 描画
  // ===================================================================
  function drawStars() {
    ctx.fillStyle = "#0b1230";
    for (const s of stars) {
      ctx.globalAlpha = s.a;
      ctx.fillRect(s.x, s.y, s.s, s.s);
    }
    ctx.globalAlpha = 1;
  }

  const stars = Array.from({ length: 60 }, () => ({
    x: Math.random() * W,
    y: Math.random() * H,
    s: Math.random() < 0.8 ? 1 : 2,
    a: 0.3 + Math.random() * 0.6,
  }));

  function drawPlayer() {
    ctx.fillStyle = "#2bff88";
    const { x, y, w, h } = player;
    // 砲台
    ctx.fillRect(x, y + h - 8, w, 8);
    ctx.fillRect(x + 6, y + 4, w - 12, h - 8);
    ctx.fillRect(x + w / 2 - 3, y - 6, 6, 10);
  }

  function drawInvader(inv) {
    ctx.fillStyle =
      inv.points === 30 ? "#ff8be0" : inv.points === 20 ? "#ffe45b" : "#5fd0ff";
    const { x, y, w, h } = inv;
    const px = w / 8;
    const py = h / 6;
    // 8x6 のドットパターン（2フレーム）
    const patterns = [
      [
        "00111100",
        "01111110",
        "11011011",
        "11111111",
        "00100100",
        "01011010",
      ],
      [
        "00111100",
        "01111110",
        "11011011",
        "11111111",
        "01000010",
        "00100100",
      ],
    ];
    const pat = patterns[inv.frame];
    for (let row = 0; row < pat.length; row++) {
      for (let col = 0; col < 8; col++) {
        if (pat[row][col] === "1") {
          ctx.fillRect(x + col * px, y + row * py, px, py);
        }
      }
    }
  }

  function drawBarriers() {
    for (const cell of barriers) {
      const ratio = cell.hp / 3;
      ctx.fillStyle = `rgba(43, 255, 136, ${0.35 + ratio * 0.55})`;
      ctx.fillRect(cell.x, cell.y, cell.w, cell.h);
    }
  }

  function drawBullets() {
    ctx.fillStyle = "#eafff2";
    playerBullets.forEach((b) => ctx.fillRect(b.x, b.y, b.w, b.h));
    ctx.fillStyle = "#ff7b7b";
    enemyBullets.forEach((b) => ctx.fillRect(b.x, b.y, b.w, b.h));
  }

  function drawParticles() {
    particles.forEach((p) => {
      ctx.globalAlpha = Math.max(0, p.life * 2);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 1.5, p.y - 1.5, 3, 3);
    });
    ctx.globalAlpha = 1;
  }

  function render() {
    ctx.clearRect(0, 0, W, H);
    drawStars();
    drawBarriers();
    invaders.forEach((inv) => inv.alive && drawInvader(inv));
    if (game.state === State.PLAYING || game.state === State.LEVEL_CLEAR) {
      drawPlayer();
    }
    drawBullets();
    drawParticles();
  }

  // ===================================================================
  // メインループ
  // ===================================================================
  function loop(timestamp) {
    const dt = Math.min((timestamp - game.lastTime) / 1000 || 0, 0.05);
    game.lastTime = timestamp;
    update(dt);
    render();
    requestAnimationFrame(loop);
  }

  // 起動
  updateHud();
  setState(State.READY);
  requestAnimationFrame((t) => {
    game.lastTime = t;
    requestAnimationFrame(loop);
  });
})();
