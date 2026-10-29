'use strict';

/* Extracted from the original game script. Loaded before main.js. */

function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cw = Math.max(1, window.innerWidth);
    const ch = Math.max(1, window.innerHeight);
    canvas.width  = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    canvas.style.width  = cw + 'px';
    canvas.style.height = ch + 'px';
    ppu = Math.max(canvas.width / MAX_W, canvas.height / MAX_H);
    viewW = canvas.width / ppu;
    viewH = canvas.height / ppu;

    vignetteGrad = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.28,
      canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.75
    );
    vignetteGrad.addColorStop(0, 'rgba(0,0,0,0)');
    vignetteGrad.addColorStop(1, 'rgba(6,12,28,0.28)');
  }
function rrect(x, y, w, h, r) {
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
  }
function showStory(index, buttonLabel = 'Начать путь →') {
    const chapter = STORY[index];
    state.mode = 'story';
    showMessage(chapter.title, '<div class="story-kicker">' + chapter.chapter + '</div><p>' + chapter.text + '</p><div class="story-goal"><b>Задача</b><br>' + chapter.goal + '</div>', buttonLabel, () => {
      state.mode = 'play';
      hudDirty = true;
      hideOverlay();
    });
  }
function toggleAdminPanel() {
    adminOpen = !adminOpen;
    if (adminOpen) {
      adminLevels.innerHTML = '';
      LEVELS.forEach((lvl, idx) => {
        const btn = document.createElement('button');
        btn.textContent = `${idx+1}. ${lvl.name}`;
        btn.style.cssText = 'padding:8px 12px; border:none; border-radius:6px; background:rgba(100,200,255,0.15); color:#e0e8f0; cursor:pointer; font-family:inherit; text-align:left; font-size:13px; transition:background .15s;';
        btn.onmouseenter = () => btn.style.background = 'rgba(100,200,255,0.3)';
        btn.onmouseleave = () => btn.style.background = 'rgba(100,200,255,0.15)';
        btn.onclick = () => {
          state.levelIndex = idx;
          loadLevel(idx);
          state.mode = 'play';
          hideOverlay();
          hudDirty = true;
          updateHUD();
          toggleAdminPanel();
        };
        adminLevels.appendChild(btn);
      });
      adminPanel.style.display = 'block';
    } else {
      adminPanel.style.display = 'none';
    }
  }
function loadLevel(i) {
    const src = LEVELS[i];
    levelHintT = 360;
    theme = THEMES[src.theme] || THEMES.forest;

    level = {
      width: src.width, height: src.height,
      spawn: { ...src.spawn },
      goal:  { ...src.goal },
      platforms: src.platforms.map(p => ({
        x: p.x, y: p.y, prevX: p.x, prevY: p.y,
        w: p.w, h: p.h, ox: p.x, oy: p.y,
        move: p.move ? { ...p.move } : null,
        t: 0, dx: 0, dy: 0
      })),
      coins: src.coins.map(c => ({ x: c.x, y: c.y, taken: false, spin: Math.random() * TAU })),
      checkpoints: (src.checkpoints || []).map(c => ({ x: c.x, y: c.y, activated: false, pulse: 0 })),
      buffs: (src.buffs || []).map(b => ({ x: b.x, y: b.y, type: b.type, taken: false, bob: Math.random() * TAU })),
      enemies: src.enemies.map(e => ({ type: 'walker', ...e, prevX: e.x, baseY: e.y, alive: true, deadT: 0, phase: Math.random() * TAU, jumpT: Math.random() * TAU })),
      traps: (src.traps || []).map(t => ({ ...t, baseX: t.x, baseY: t.y, phase: Math.random() * TAU })),
      npc: { x: [1180, 1660, 1680, 1840, 3355][i], y: i === 4 ? 420 : 460, talked: false, name: ['Лесной хранитель', 'Шахтёр-исследователь', 'Механик', 'Страж башни', 'Голос ядра'][i] },
      tips: [],
      gravityZones: (src.gravityZones || [
        [ {x:1260,w:520,dir:-1,label:'ПЕРВАЯ ИНВЕРСИЯ'} ],
        [ {x:820,w:610,dir:-1,label:'ПОТОЛОЧНЫЙ ПРОХОД'}, {x:2200,w:650,dir:-1,label:'ДЛИННЫЙ ШЛЮЗ'} ],
        [ {x:680,w:650,dir:-1,label:'ИНВЕРСИЯ'}, {x:1690,w:730,dir:-1,label:'ДВИЖУЩИЕСЯ ОПОРЫ'}, {x:2790,w:720,dir:-1,label:'СЕРИЯ СДВИГОВ'} ],
        [ {x:520,w:700,dir:-1,label:'ПЕРЕВОРОТ'}, {x:1450,w:770,dir:-1,label:'ДЛИННЫЙ МАРШРУТ'}, {x:2400,w:830,dir:-1,label:'ЛОВУШКИ ВВЕРХУ'}, {x:3380,w:650,dir:-1,label:'ФИНАЛЬНЫЙ ШЛЮЗ'} ]
      ][Math.min(i,3)]).map(z => ({ ...z })),
      boss: src.boss ? { ...src.boss, maxHp: src.boss.hp, alive: true, phase: 0, hitFlash: 0, attackT: 100 } : null,
      arenaTitleT: 0, arenaTitleShown: false
    };
    level.gravityZones = level.gravityZones.filter(z => z.dir < 0).sort((a,b) => a.x - b.x);

    // Убираем разрывы пола (gaps) — пол должен быть непрерывным
    // Ранее здесь был код, который вырезал куски пола под зонами инверсии.
    // Теперь мы оставляем пол нетронутым.

    // Настройка ловушек и врагов под статические зоны (dynamic пропускаем)
    for (const z of level.gravityZones) {
      if (z.dynamic) continue;
      const safeStart = z.x + z.w - 10;
      const safeEnd = safeStart + 230;
      level.traps = level.traps.filter(t => t.x + (t.w || 0) < safeStart || t.x > safeEnd);
      level.enemies = level.enemies.filter(e => e.x + (e.w || 0) < safeStart || e.x > safeEnd);
    }

    // Фильтрация шипов, которые попали в статические зоны инверсии
    level.traps = level.traps.filter(t => t.type !== 'spikes' ||
      !level.gravityZones.some(z => !z.dynamic && t.x + (t.w || 0) > z.x && t.x < z.x + z.w));

    // Для статических зон поднимаем монеты/баффы/врагов на потолок
    for (const z of level.gravityZones) {
      if (z.dynamic) continue;
      for (const c of level.coins) {
        if (c.x >= z.x && c.x <= z.x + z.w && c.y > 250) c.y = 105 + ((Math.floor(c.x / 90) % 3) * 32);
      }
      for (const b of level.buffs) {
        if (b.x >= z.x && b.x <= z.x + z.w && b.y > 250) b.y = 125;
      }
      for (const e of level.enemies) {
        if (e.x >= z.x && e.x + (e.w || 28) <= z.x + z.w && e.y > 250) {
          const supports = (src.ceilingPlatforms || []).filter(cp => cp[0] + cp[2] >= e.x - 42 && cp[0] <= e.x + (e.w || 28) + 42);
          const support = supports.sort((a,b) => Math.abs((a[0] + a[2]/2) - (e.x + (e.w || 28)/2)) - Math.abs((b[0] + b[2]/2) - (e.x + (e.w || 28)/2)))[0];
          e.y = support ? support[1] + 16 : 120;
          e.baseY = e.y;
          e.minX = Math.max(z.x + 18, e.minX ?? e.x - 45);
          e.maxX = Math.min(z.x + z.w - (e.w || 28) - 18, e.maxX ?? e.x + 45);
          if (e.maxX <= e.minX) { e.minX = e.x - 24; e.maxX = e.x + 24; }
        }
      }
      for (const t of level.traps) {
        if (t.x >= z.x && t.x <= z.x + z.w && t.y > 250) {
          t.y = 165;
          t.baseY = t.y;
        }
      }
      if (level.npc.x >= z.x && level.npc.x <= z.x + z.w && level.npc.y > 250) level.npc.y = 150;
    }

    // Создание потолочных платформ для статических зон
    const generatedCeilings = level.gravityZones.filter(z => !z.dynamic).flatMap((z, zi) => {
      const count = 4 + i + Math.min(zi, 1);
      const inset = 28;
      const usable = Math.max(120, z.w - inset * 2);
      const step = usable / count;
      const width = Math.min(68, step * 0.58);
      const pattern = [62, 112, 72, 145, 88, 54, 126, 76, 102];
      return Array.from({length: count}, (_, n) => {
        const x = z.x + inset + n * step + (step - width) * 0.5;
        const y = pattern[(n + zi * 2 + i) % pattern.length];
        return [x, y, width];
      });
    });
    let ceilings = (src.ceilingPlatforms || generatedCeilings).map(c => [...c]);
    ceilings = ceilings.map(([x,y,w], idx) => {
      const zone = level.gravityZones.find(z => !z.dynamic && x + w / 2 >= z.x && x + w / 2 <= z.x + z.w);
      if (!zone) return [x,y,w];
      const hasEnemy = level.enemies.some(e => e.x + e.w >= x - 30 && e.x <= x + w + 30 && e.x + e.w / 2 >= zone.x && e.x + e.w / 2 <= zone.x + zone.w);
      if (!hasEnemy) return [x,y,w];
      const targetW = Math.min(155, zone.x + zone.w - 18 - x);
      const nextX = Math.max(zone.x + 18, x);
      return [nextX,y,Math.max(w, Math.min(targetW, 155))];
    });
    for (let ci=0; ci<ceilings.length; ci++) {
      const [x,y,w] = ceilings[ci];
      level.platforms.push({ x,y,w,h:16,prevX:x,prevY:y,ox:x,oy:y,move:null,t:0,dx:0,dy:0,ceiling:true });
    }

    // Привязка врагов к потолочным платформам в статических зонах
    for (const e of level.enemies) {
      const zone = level.gravityZones.find(z => !z.dynamic && e.x + e.w / 2 >= z.x && e.x + e.w / 2 <= z.x + z.w);
      if (!zone) continue;
      const supports = level.platforms.filter(pl => pl.ceiling && pl.x + pl.w >= e.x - 18 && pl.x <= e.x + e.w + 18);
      supports.sort((a,b) => Math.abs((a.x + a.w/2) - (e.x + e.w/2)) - Math.abs((b.x + b.w/2) - (e.x + e.w/2)));
      const support = supports[0];
      if (support && support.w >= e.w + 12) {
        e.ceilingSupport = support;
        e.y = support.y + support.h + 1;
        e.baseY = e.y;
        e.prevY = e.y;
        e.minX = support.x + 4;
        e.maxX = support.x + support.w - e.w - 4;
        if (e.maxX <= e.minX) e.removeForInversion = true;
        if (e.type === 'flyer' || e.type === 'hopper') {
          e.type = 'walker'; e.vy = 0; e.phase = 0;
        }
      } else {
        e.removeForInversion = true;
      }
    }
    level.enemies = level.enemies.filter(e => !e.removeForInversion);
    level.traps = level.traps.filter(t => {
      const zone = level.gravityZones.find(z => !z.dynamic && t.x + (t.w || 0) / 2 >= z.x && t.x + (t.w || 0) / 2 <= z.x + z.w);
      if (!zone) return true;
      return !level.enemies.some(e => Math.abs((e.x + e.w / 2) - (t.x + (t.w || 0) / 2)) < 150);
    });
    level.buffs.sort((a,b) => a.x - b.x);
    let lastBuffX = -Infinity;
    level.buffs = level.buffs.filter(b => {
      if (b.x - lastBuffX < 260) return false;
      lastBuffX = b.x;
      return true;
    });
    for (const cp of level.checkpoints) {
      const zone = level.gravityZones.find(z => !z.dynamic && cp.x >= z.x && cp.x <= z.x + z.w);
      if (!zone) continue;
      const supports = level.platforms.filter(pl => pl.ceiling && pl.x + pl.w >= cp.x - 34 && pl.x <= cp.x + 34);
      const support = supports.sort((a,b) => Math.abs((a.x + a.w/2) - cp.x) - Math.abs((b.x + b.w/2) - cp.x))[0];
      if (support) {
        cp.x = support.x + support.w / 2;
        cp.y = support.y + support.h;
        cp.inverted = true;
      }
    }
    // На пятом уровне потолочные платформы оставляем неподвижными: их вертикальный ход
    // мог вдавливать игрока в соседнюю платформу, а горизонтальная коллизия сдвигала его влево.
    if (i >= 2 && i < 4) {
      let movingIndex = 0;
      const every = i === 2 ? 3 : 2;
      for (const pl of level.platforms) if (pl.ceiling && movingIndex++ % every === 1) {
        pl.move = { ax: i >= 3 ? 10 : 0, ay: i === 2 ? 18 : 30, speed: i === 2 ? 0.022 : 0.028 };
      }
    }

    const candidates = [];
    const seen = new Set();
    for (const t of level.traps) {
      if (TIP_LIBRARY[t.type] && !seen.has('trap:' + t.type) && !shownMechanicTypes.has(t.type)) {
        seen.add('trap:' + t.type); candidates.push({ key: t.type, kind: 'trap', x: t.x, data: TIP_LIBRARY[t.type] });
      }
    }
    for (const e of level.enemies) {
      if (e.type !== 'walker' && TIP_LIBRARY[e.type] && !seen.has('enemy:' + e.type) && !shownEnemyTypes.has(e.type)) {
        seen.add('enemy:' + e.type); candidates.push({ key: e.type, kind: 'enemy', x: e.x, data: TIP_LIBRARY[e.type] });
      }
    }
    candidates.sort((a,b) => a.x - b.x);
    level.tips = candidates.map((t, idx) => ({ ...t, id: idx, shown: false }));

    skyGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    for (const [col, pos] of theme.skyStops) skyGrad.addColorStop(pos, col);

    clouds = [];
    const cloudCount = Math.ceil(level.width * 0.55 / 240) + 4;
    for (let c = 0; c < cloudCount; c++) {
      clouds.push({
        x: c * 240 + (c * 97) % 90,
        y: 30 + ((c * 53) % 150),
        s: 0.55 + ((c * 31) % 70) / 100,
        drift: 0.015 + ((c * 17) % 30) / 1400
      });
    }

    motes = [];
    for (let m = 0; m < 30; m++) {
      motes.push({
        x: Math.random() * level.width,
        y: Math.random() * level.height,
        r: 0.7 + Math.random() * 1.5,
        ph: Math.random() * TAU,
        a: 0.08 + Math.random() * 0.16
      });
    }

    particles.length = 0;
    bossProjectiles.length = 0;
    shake = 0;
    buffs.speed = 0; buffs.double = 0; buffs.magnet = 0; buffs.shield = false;

    const jumpButton = document.querySelector('#controls .btn.jump');
    if (jumpButton) { jumpButton.textContent = '▲'; jumpButton.setAttribute('aria-label', 'Прыжок: вверх / W'); }
    
    if (i === 4) {
      player.x = 100; player.y = 460 - player.h;
      player.prevX = player.x; player.prevY = player.y;
      player.vx = 0; player.vy = 0; player.gravityDir = 1; player.gravityZone = -1;
      player.onGround = true; player.groundPlat = null; player.invuln = 0; player.facing = 1; player.squash = 0;
      camX = 0;
      const target = cameraTargets(); camY = target.y; clampCamera();
      player.prevX = player.x; player.prevY = player.y;
    }
    respawn(true);
  }
function spawnParticles(x, y, color, n, spread, opts) {
    opts = opts || {};
    // Переводим прежние жёлтые/кислотно-зелёные частицы в акцент текущей локации.
    const particleAccents = ['#67e8c8', '#b69aff', '#8fe5ff', '#ff9b86', '#ff7398'];
    const levelAccent = particleAccents[Math.max(0, Math.min(4, state.levelIndex || 0))];
    const colorKey = String(color || '').toLowerCase();
    if (['#ffd54f','#fff8d0','#ffe7a3','#ffd27a','#7be08a','#ffffff'].includes(colorKey)) {
      color = colorKey === '#ffffff' ? '#d9faff' : levelAccent;
    }
    n = Math.max(1, Math.round(n * 0.7));
    const particleLimit = state.levelIndex === 4 ? 150 : MAX_PARTICLES;
    const available = particleLimit - particles.length;
    if (available <= 0) return;
    n = Math.min(n, available);
    for (let i = 0; i < n; i++) {
      const ang = opts.angle !== undefined
        ? opts.angle + (Math.random() - 0.5) * (opts.arc || 1.2)
        : Math.random() * TAU;
      const sp = (opts.speed || spread) * (0.35 + Math.random() * 0.55);
      particles.push({
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life: (opts.life || 30) * (0.8 + Math.random() * 0.7) * 1.35,
        maxLife: (opts.life || 30) * 1.5,
        r: (opts.r || 2.4) * (0.5 + Math.random() * 0.85),
        color,
        grav: (opts.grav !== undefined ? opts.grav : 0.20) * 0.75,
        drag: opts.drag !== undefined ? opts.drag : 0.975,
        glow: !!opts.glow
      });
    }
  }
function updateParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy;
      p.vy += p.grav; p.vx *= p.drag; p.vy *= p.drag;
      p.life--;
      if (p.life <= 0) particles.splice(i, 1);
    }
  }
function updateBossProjectiles() {
    for (let i = bossProjectiles.length - 1; i >= 0; i--) {
      const shot = bossProjectiles[i];
      shot.x += shot.vx;
      shot.y += shot.vy;
      shot.life--;
      shot.trailT++;
      if (shot.trailT % 4 === 0) {
        spawnParticles(shot.x, shot.y, '#ff7398', 1, 0, {angle:Math.atan2(shot.vy, shot.vx) + Math.PI,arc:0.5,speed:0.6,life:12,r:1.8,grav:0,glow:true});
      }
      const hit = shot.x + shot.r > player.x && shot.x - shot.r < player.x + player.w &&
                  shot.y + shot.r > player.y && shot.y - shot.r < player.y + player.h;
      if (hit) {
        hurtPlayer();
        spawnParticles(shot.x, shot.y, '#ff9db5', 7, 0, {angle:0,arc:TAU,speed:1.8,life:22,r:2.2,grav:0,glow:true});
        bossProjectiles.splice(i, 1);
        continue;
      }
      if (shot.life <= 0 || shot.x < camX - 160 || shot.x > camX + viewW + 160 || shot.y < -80 || shot.y > level.height + 80) {
        bossProjectiles.splice(i, 1);
      }
    }
  }
function drawBossProjectiles() {
    for (const shot of bossProjectiles) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.shadowColor = '#ff4f83';
      ctx.shadowBlur = 16;
      const g = ctx.createRadialGradient(shot.x - shot.r * 0.25, shot.y - shot.r * 0.25, 1, shot.x, shot.y, shot.r * 1.7);
      g.addColorStop(0, '#fff5fa');
      g.addColorStop(0.32, '#ff9bb8');
      g.addColorStop(1, 'rgba(255,55,115,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(shot.x, shot.y, shot.r * 1.7, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ff5b8a';
      ctx.beginPath(); ctx.arc(shot.x, shot.y, shot.r * 0.62, 0, TAU); ctx.fill();
      ctx.restore();
    }
  }
function updatePlatforms() {
    for (const pl of level.platforms) {
      pl.prevX = pl.x; pl.prevY = pl.y;
      if (!pl.move) { pl.dx = 0; pl.dy = 0; continue; }
      pl.t += pl.move.speed;
      const nx = pl.ox + (pl.move.ax || 0) * Math.sin(pl.t);
      const ny = pl.oy + (pl.move.ay || 0) * Math.sin(pl.t);
      pl.dx = nx - pl.x; pl.dy = ny - pl.y;
      pl.x = nx; pl.y = ny;
    }
  }
function updateBuffs() {
    if (buffs.speed  > 0) buffs.speed--;
    if (buffs.double > 0) buffs.double--;
    if (buffs.magnet > 0) buffs.magnet--;
  }
function setAdminFly(enabled) {
    __gravityAdminFly = !!enabled;
    if (adminStatus) {
      adminStatus.textContent = __gravityAdminFly ? 'РЕЖИМ ВКЛЮЧЁН' : 'РЕЖИМ ВЫКЛЮЧЕН';
      adminStatus.style.display = 'block';
      adminStatus.style.opacity = '1';
      adminStatus.style.borderColor = __gravityAdminFly ? 'rgba(92,235,213,.8)' : 'rgba(255,115,152,.75)';
      adminStatus.style.color = __gravityAdminFly ? '#8fffe8' : '#ff9ab4';
      if (adminToastTimer) clearTimeout(adminToastTimer);
      adminToastTimer = setTimeout(() => {
        adminStatus.style.opacity = '0';
        setTimeout(() => { if (adminStatus.style.opacity === '0') adminStatus.style.display = 'none'; }, 220);
      }, 1450);
    }
    input.left = input.right = input.up = input.down = input.jump = false; jumpKeys.clear(); player.vx = 0; player.vy = 0;
    if (!__gravityAdminFly) { player.gravityDir = 1; player.gravityZone = -1; }
  }
function levelComplete() {
    if (state.mode !== 'play') return;
    state.mode = 'clear';

    const g = level.goal;
    spawnParticles(g.x + 12, g.y - 80, '#ffd54f', 18, 0,
      { angle: 0, arc: TAU, speed: 2.4, life: 54, r: 2.6, grav: 0.09, glow: true });
    spawnParticles(g.x + 12, g.y - 80, '#ffffff', 10, 0,
      { angle: 0, arc: TAU, speed: 1.5, life: 40, r: 1.9, grav: 0.05, glow: true });

    if (state.levelIndex >= LEVELS.length - 1) {
      showMessage('Победа!',
        'Осколок встаёт в центр башни, и некогда тревожный сигнал превращается в мягкое сияние. Энергия стабилизирована, а древние механизмы снова работают. Герой не просто добрался до цели — он вернул жизнь целому миру.<br><br>Монет собрано: ' + state.coins,
        'Играть снова', () => { startGame(); });
      return;
    }

    setTimeout(() => openShop(), 400);
  }
function showGameTip(data, duration = 300) {
    if (!data) return;
    const title = String(data.title || '');
    const danger = /опасност|препятств|враг|пила|шип|заблокирован|урон|атак|страж/i.test(title);
    tipIcon.replaceChildren();
    const mark = document.createElement('span');
    mark.className = 'tip-mark';
    mark.setAttribute('aria-hidden', 'true');
    tipIcon.appendChild(mark);
    gameTip.classList.toggle('danger-tip', danger);
    tipTitle.textContent = title;
    tipText.textContent = data.text;
    gameTip.classList.add('show');
    tipHideT = duration;
  }
function hideGameTip() {
    gameTip.classList.remove('show');
    tipHideT = 0;
  }
function drawDialogNpc(index) {
    const c = dialogPortrait;
    if (!c || !c.getContext) return;
    const g = c.getContext('2d');
    const colors = ['#70e8bd','#c99aff','#9cecff','#ffb36b','#ff7398'];
    const core = colors[Math.max(0, Math.min(index, colors.length - 1))];
    const w = c.width, h = c.height, cx = w/2, cy = h/2 + 1;
    g.clearRect(0,0,w,h);
    const aura = g.createRadialGradient(cx,cy,2,cx,cy,48);
    aura.addColorStop(0,core+'55'); aura.addColorStop(1,'rgba(0,0,0,0)');
    g.fillStyle=aura; g.fillRect(0,0,w,h);
    g.save(); g.translate(cx,cy);
    g.shadowColor=core; g.shadowBlur=13; g.fillStyle='#111827'; g.strokeStyle=core; g.lineWidth=2.5;
    g.beginPath(); g.moveTo(0,-35); g.lineTo(25,-10); g.lineTo(20,17); g.lineTo(0,32); g.lineTo(-20,17); g.lineTo(-25,-10); g.closePath(); g.fill(); g.stroke();
    g.shadowBlur=0; g.fillStyle=core; g.beginPath(); g.moveTo(0,-19); g.lineTo(9,0); g.lineTo(0,15); g.lineTo(-9,0); g.closePath(); g.fill();
    g.fillStyle='#f4fcff'; g.beginPath(); g.arc(-6,-3,2.8,0,TAU); g.arc(6,-3,2.8,0,TAU); g.fill();
    g.strokeStyle=core+'aa'; g.lineWidth=1; g.beginPath(); g.moveTo(-36,43); g.lineTo(36,43); g.stroke(); g.restore();
  }
function closeNpcDialog() {
    if (!dialogLayer.classList.contains('show')) return;
    dialogLayer.classList.remove('show');
    state.mode = dialogReturnMode;
  }
function interactWithNpc() {
    if (state.mode === 'dialog') { closeNpcDialog(); return; }
    if (state.mode !== 'play' || !level || !level.npc) return;
    const npc = level.npc;
    const dx = player.x + player.w / 2 - npc.x;
    const dy = player.y + player.h - npc.y;
    if (Math.abs(dx) > 76 || Math.abs(dy) > 62) return;
    const d = NPC_DIALOGUES[state.levelIndex];
    npc.talked = true;
    dialogName.textContent = d.title;
    dialogText.textContent = d.text;
    drawDialogNpc(state.levelIndex);
    dialogNext.textContent = 'Продолжить →';
    dialogReturnMode = 'play';
    state.mode = 'dialog';
    hideGameTip();
    dialogLayer.classList.add('show');
  }
function drawStoryEnvironment() {
    const idx = state.levelIndex;
    if (idx === 0) {
      for (const x of [180, 900, 1320, 1880, 2860, 3370]) {
        ctx.fillStyle = 'rgba(22,75,61,0.72)';
        ctx.beginPath(); ctx.moveTo(x, 458); ctx.lineTo(x + 28, 382); ctx.lineTo(x + 56, 458); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(42,112,83,0.85)';
        ctx.beginPath(); ctx.moveTo(x + 8, 430); ctx.lineTo(x + 28, 370); ctx.lineTo(x + 48, 430); ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#7b573a'; ctx.fillRect(x + 25, 438, 6, 22);
      }
      const sx = 3330, sy = 405 + Math.sin(time * 0.045) * 4;
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(time * 0.008);
      ctx.shadowColor = '#79f4ff'; ctx.shadowBlur = 20; ctx.fillStyle = '#8af6ff';
      ctx.beginPath(); ctx.moveTo(0,-18); ctx.lineTo(10,-3); ctx.lineTo(4,16); ctx.lineTo(-8,8); ctx.lineTo(-10,-5); ctx.closePath(); ctx.fill(); ctx.restore();
    } else if (idx === 1) {
      for (const x of [280, 980, 1320, 1840, 3100, 3480]) {
        ctx.fillStyle = 'rgba(85,121,160,0.7)'; ctx.beginPath(); ctx.moveTo(x,460); ctx.lineTo(x+15,410); ctx.lineTo(x+28,460); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(119,205,255,0.85)'; ctx.beginPath(); ctx.moveTo(x+7,450); ctx.lineTo(x+15,422); ctx.lineTo(x+22,450); ctx.closePath(); ctx.fill();
      }
      ctx.globalAlpha = 0.55; ctx.strokeStyle = '#79c9d9'; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(1780, 400, 38, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(1780, 400, 22, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1;
    } else if (idx === 2) {
      for (const x of [350, 980, 1410, 1880, 2940, 3580]) {
        ctx.fillStyle = 'rgba(177,229,255,0.65)'; ctx.beginPath(); ctx.moveTo(x,460); ctx.lineTo(x+18,400); ctx.lineTo(x+36,460); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(240,252,255,0.8)'; ctx.beginPath(); ctx.moveTo(x+12,450); ctx.lineTo(x+18,420); ctx.lineTo(x+24,450); ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = 'rgba(130,225,255,0.12)'; ctx.fillRect(1900, 120, 1100, 250);
    } else {
      for (const x of [420, 1080, 1580, 2050, 3160, 3720]) {
        ctx.fillStyle = 'rgba(92,61,66,0.8)'; ctx.fillRect(x, 405, 24, 55); ctx.fillRect(x-10, 398, 44, 9);
        ctx.fillStyle = 'rgba(255,196,126,0.42)'; ctx.fillRect(x+7, 420, 10, 26);
      }
      ctx.globalAlpha = 0.34; ctx.fillStyle = '#4b294d';
      ctx.fillRect(3940, 245, 105, 215); ctx.fillRect(3920, 270, 145, 18);
      ctx.fillStyle = '#ffdf8a'; ctx.shadowColor = '#ffcf68'; ctx.shadowBlur = 24;
      ctx.beginPath(); ctx.arc(3992, 320, 18 + Math.sin(time * 0.04) * 3, 0, TAU); ctx.fill();
      ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }
  }
function drawCinematicDetails() {
    const idx=state.levelIndex, left=camX-120, right=camX+viewW+180;
    ctx.save();
    if(idx===0){
      for(let i=Math.floor(left/230);i<=Math.ceil(right/230);i++){
        const x=i*230+((i%3)*29), h=100+((i*17%5+5)%5)*18;
        const bark=ctx.createLinearGradient(x,0,x+28,0);bark.addColorStop(0,'#142e32');bark.addColorStop(.48,'#294d49');bark.addColorStop(1,'#10262d');
        ctx.fillStyle=bark;ctx.beginPath();ctx.moveTo(x,455);ctx.lineTo(x+5,455-h);ctx.quadraticCurveTo(x+19,455-h-12,x+27,455-h+3);ctx.lineTo(x+36,455);ctx.closePath();ctx.fill();
        ctx.strokeStyle='rgba(135,177,135,.23)';ctx.lineWidth=2;for(let k=0;k<3;k++){ctx.beginPath();ctx.moveTo(x+8+k*6,455-h*.55);ctx.lineTo(x+5+k*7,455-h*.24);ctx.stroke();}
        ctx.strokeStyle='rgba(89,139,103,.65)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+25,455-h+25);ctx.quadraticCurveTo(x+39,455-h+38,x+34,455-h+52);ctx.stroke();
      }
      ctx.globalAlpha=.22;ctx.fillStyle='#d6f7c0';for(let i=0;i<5;i++){const x=left+((i*197+time*.12)%(right-left));ctx.beginPath();ctx.moveTo(x,90);ctx.lineTo(x+40,90);ctx.lineTo(x+250,455);ctx.lineTo(x+185,455);ctx.closePath();ctx.fill();}ctx.globalAlpha=1;
    } else if(idx===1){
      for(let i=Math.floor(left/310);i<=Math.ceil(right/310);i++){
        const x=i*310;ctx.fillStyle='rgba(13,13,32,.72)';ctx.beginPath();ctx.moveTo(x,455);ctx.lineTo(x+24,300);ctx.lineTo(x+77,265);ctx.lineTo(x+105,330);ctx.lineTo(x+154,287);ctx.lineTo(x+190,455);ctx.closePath();ctx.fill();
        ctx.strokeStyle='rgba(119,101,177,.35)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+26,350);ctx.lineTo(x+72,329);ctx.lineTo(x+100,348);ctx.moveTo(x+107,390);ctx.lineTo(x+143,371);ctx.stroke();
        ctx.shadowColor='#82cfff';ctx.shadowBlur=9;ctx.fillStyle='rgba(121,213,255,.68)';ctx.beginPath();ctx.moveTo(x+71,382);ctx.lineTo(x+80,348);ctx.lineTo(x+87,382);ctx.closePath();ctx.fill();ctx.shadowBlur=0;
      }
      ctx.globalAlpha=.42;ctx.strokeStyle='#7cb5bd';ctx.lineWidth=5;for(let i=0;i<3;i++){const x=left+((i*420+280)%(right-left));ctx.beginPath();ctx.arc(x,350,38+i*5,0,TAU);ctx.stroke();ctx.strokeStyle='#405c78';ctx.lineWidth=2;for(let a=0;a<8;a++){const q=a*TAU/8;ctx.beginPath();ctx.moveTo(x+Math.cos(q)*38,350+Math.sin(q)*38);ctx.lineTo(x+Math.cos(q)*49,350+Math.sin(q)*49);ctx.stroke();}}ctx.globalAlpha=1;
    } else if(idx===2){
      for(let i=Math.floor(left/270);i<=Math.ceil(right/270);i++){
        const x=i*270,h=125+((i*13%4+4)%4)*22;const g=ctx.createLinearGradient(x,0,x+130,0);g.addColorStop(0,'rgba(66,126,163,.28)');g.addColorStop(.55,'rgba(178,231,249,.36)');g.addColorStop(1,'rgba(44,93,134,.34)');
        ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x,455);ctx.lineTo(x+17,455-h);ctx.lineTo(x+52,455-h-24);ctx.lineTo(x+76,455-h*.64);ctx.lineTo(x+103,455-h*.83);ctx.lineTo(x+138,455);ctx.closePath();ctx.fill();
        ctx.strokeStyle='rgba(235,253,255,.6)';ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x+51,455-h-20);ctx.lineTo(x+59,455-h*.62);ctx.lineTo(x+43,455-h*.38);ctx.moveTo(x+105,455-h*.8);ctx.lineTo(x+92,455-h*.52);ctx.stroke();
      }
      ctx.fillStyle='rgba(194,240,255,.16)';for(let i=0;i<38;i++){const x=(i*109+time*.18)%(right-left)+left,y=(i*61+Math.sin(time*.02+i)*9)%370;ctx.beginPath();ctx.arc(x,y,((i%3)+1)*.45,0,TAU);ctx.fill();}
    } else {
      for(let i=Math.floor(left/290);i<=Math.ceil(right/290);i++){
        const x=i*290,base=455,h=85+((i*11%4+4)%4)*24;ctx.fillStyle='rgba(40,31,43,.76)';ctx.fillRect(x,base-h,23,h);ctx.fillRect(x-9,base-h-7,42,8);ctx.fillRect(x+24,base-h+18,13,h-18);
        ctx.strokeStyle='rgba(180,128,94,.32)';ctx.lineWidth=1;for(let k=0;k<4;k++){ctx.beginPath();ctx.moveTo(x+3,base-h+18+k*15);ctx.lineTo(x+19,base-h+18+k*15);ctx.stroke();}
        ctx.strokeStyle='rgba(211,154,103,.38)';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(x+43,base-h+8);ctx.quadraticCurveTo(x+78,base-h-24,x+108,base-h+8);ctx.stroke();
      }
      const tx=left+((right-left)*.78);ctx.globalAlpha=.25;ctx.fillStyle='#2b2035';ctx.beginPath();ctx.moveTo(tx-42,455);ctx.lineTo(tx-27,250);ctx.lineTo(tx-13,218);ctx.lineTo(tx+2,245);ctx.lineTo(tx+18,205);ctx.lineTo(tx+38,455);ctx.closePath();ctx.fill();
      const core=ctx.createRadialGradient(tx+1,290,1,tx+1,290,75);core.addColorStop(0,'rgba(255,207,125,.8)');core.addColorStop(.25,'rgba(255,145,85,.26)');core.addColorStop(1,'rgba(255,145,85,0)');ctx.fillStyle=core;ctx.beginPath();ctx.arc(tx+1,290,75,0,TAU);ctx.fill();ctx.globalAlpha=1;
    }
    ctx.restore();
  }
function drawNpc() {
    if (!level || !level.npc) return;
    const n=level.npc, bob=Math.sin(time*.055)*3, x=n.x, y=n.y, idx=state.levelIndex;
    const cores=['#70e8bd','#c99aff','#9cecff','#ffb36b','#ff7398'];
    const core=cores[Math.min(idx,cores.length-1)];
    ctx.save();
    const aura=ctx.createRadialGradient(x,y-23+bob,1,x,y-23+bob,43);
    aura.addColorStop(0,core+'55'); aura.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=aura;ctx.beginPath();ctx.arc(x,y-23+bob,43,0,TAU);ctx.fill();
    ctx.fillStyle='rgba(0,0,0,.32)';ctx.beginPath();ctx.ellipse(x,y+2,13,3.5,0,0,TAU);ctx.fill();
    ctx.translate(x,y-25+bob);ctx.rotate(Math.sin(time*.025)*.07);
    ctx.fillStyle='#111827';ctx.strokeStyle=core;ctx.lineWidth=2.2;ctx.shadowColor=core;ctx.shadowBlur=10;
    ctx.beginPath();ctx.moveTo(0,-19);ctx.lineTo(14,-5);ctx.lineTo(11,11);ctx.lineTo(0,18);ctx.lineTo(-11,11);ctx.lineTo(-14,-5);ctx.closePath();ctx.fill();ctx.stroke();ctx.shadowBlur=0;
    ctx.fillStyle=core;ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(5,0);ctx.lineTo(0,8);ctx.lineTo(-5,0);ctx.closePath();ctx.fill();
    ctx.fillStyle='#f4fcff';ctx.beginPath();ctx.arc(-3,-2,1.8,0,TAU);ctx.arc(3,-2,1.8,0,TAU);ctx.fill();ctx.restore();
    if (Math.abs(player.x+player.w/2-x)<76 && Math.abs(player.y+player.h-y)<62 && state.mode==='play') {
      const w=112,h=23,bx=x-w/2,by=y-76+bob;ctx.save();ctx.fillStyle='rgba(7,12,21,.94)';ctx.beginPath();ctx.roundRect(bx,by,w,h,7);ctx.fill();ctx.strokeStyle=core+'aa';ctx.lineWidth=1;ctx.stroke();ctx.fillStyle=core;ctx.fillRect(bx+8,by+6,2,11);ctx.fillStyle='#e7f2f7';ctx.font='700 10px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('E  ·  поговорить',x+2,by+h/2);ctx.restore();
    }
  }
function updateContextTips() {
    if (state.mode === 'play' && level && state.levelIndex === 4) {
      if (!level.arenaTitleShown && player.x + player.w >= 3440) {
        level.arenaTitleShown = true;
        level.arenaTitleT = 210;
      }
      if (level.arenaTitleT > 0) level.arenaTitleT--;
    }
    if (state.mode !== 'play' || !level || !level.tips) return;
    for (const tip of level.tips) {
      if (tip.shown) continue;
      if (player.x >= tip.x - 105) {
        tip.shown = true;
        if (tip.kind === 'enemy') shownEnemyTypes.add(tip.key);
        if (tip.kind === 'trap') shownMechanicTypes.add(tip.key);
        showGameTip(tip.data, tip.key === 'saw' ? 600 : 420);
        break;
      }
    }
  }
function update() {
    time++;
    // На арене две узкие зоны инверсии меняют положение каждые 5 секунд.
    // Пол под ними один и непрерывный — потолочные платформы для арены не нужны.
    if (state.mode === 'play' && level && state.levelIndex === 4) {
      const movingZones = level.gravityZones.filter(z => z.dynamic);
      if (movingZones.length) {
        // Зоны растворяются перед перемещением и плавно проявляются на новых местах.
        level.arenaZoneTimer = (level.arenaZoneTimer ?? 300) - 1;
        if (level.arenaZoneFadeIn > 0) {
          level.arenaZoneFadeIn--;
          level.arenaZoneOpacity = 1 - level.arenaZoneFadeIn / 42;
        } else if (level.arenaZoneTimer <= 42) {
          level.arenaZoneOpacity = Math.max(0, level.arenaZoneTimer / 42);
        } else {
          level.arenaZoneOpacity = 1;
        }
        if (level.arenaZoneTimer <= 0) {
          const slots = [3480, 3600, 3720, 3840, 3960, 4080];
          const previous = movingZones.map(z => z.x);
          const available = slots.filter(x => !previous.includes(x));
          // Перемешиваем только доступные позиции, чтобы зоны не повторяли прежние места.
          for (let i = available.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [available[i], available[j]] = [available[j], available[i]];
          }
          movingZones.forEach((z, i) => { z.x = available[i] ?? slots[(i + 2) % slots.length]; });
          level.arenaZoneTimer = 300;
          level.arenaZoneFadeIn = 42;
          level.arenaZoneOpacity = 0;
          // Заставляем обработчик гравитации пересчитать зону после её перемещения.
          player.gravityZone = -999;
        }
      }
    }
    if (levelHintT > 0 && state.mode === 'play') levelHintT--;
    if (tipHideT > 0 && state.mode === 'play') { tipHideT--; if (tipHideT === 0) hideGameTip(); }
    updateParticles();
    if (shake > 0.04) shake *= 0.90;
    else shake = 0;
    updatePlatforms();
    if (state.mode === 'play') { updatePlayer(); updateBossProjectiles(); updateBuffs(); updateContextTips(); }
    for (const c of clouds) c.x += c.drift;
    if (hudDirty) { hudDirty = false; updateHUD(); }
  }
function drawSky() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const sun = theme.sun;
    if (!sun) return;
    const sunX = canvas.width * sun.x;
    const sunY = canvas.height * sun.y;
    const sunR = Math.min(canvas.width, canvas.height) * sun.r;

    const g = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, sunR);
    g.addColorStop(0, sun.glow);
    g.addColorStop(0.55, 'rgba(255, 226, 150, 0.08)');
    g.addColorStop(1, 'rgba(255, 220, 150, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR * 0.10, 0, TAU);
    ctx.fillStyle = sun.disc;
    ctx.fill();
  }
function drawWaveLayer(color, baseY, amp, freq, parallax, phase) {
    const off = camX * parallax * ppu;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-10, canvas.height + 10);
    for (let sx = -10; sx <= canvas.width + 12; sx += 8) {
      const wx = sx + off;
      const y = baseY
        + Math.sin(wx * freq + phase + time * 0.0006) * amp
        + Math.sin(wx * freq * 2.37 + phase * 1.7 + time * 0.0009) * amp * 0.40
        + Math.sin(wx * freq * 5.13 + phase * 2.6 + time * 0.0013) * amp * 0.14;
      ctx.lineTo(sx, y);
    }
    ctx.lineTo(canvas.width + 10, canvas.height + 10);
    ctx.closePath();
    ctx.fill();
  }
function drawParallaxBackdrop() {
    const W = canvas.width, H = canvas.height;
    const idx = Math.min(state.levelIndex || 0, 4);
    const palettes = [
      { top:'#07131b', mid:'#10272d', low:'#193b3c', edge:'#62f2c4', glow:'rgba(65,230,190,.12)' },
      { top:'#080613', mid:'#171126', low:'#241a36', edge:'#df9cff', glow:'rgba(180,110,255,.10)' },
      { top:'#061322', mid:'#10283b', low:'#173b50', edge:'#9ceeff', glow:'rgba(80,200,255,.11)' },
      { top:'#120b19', mid:'#24101f', low:'#351b2b', edge:'#ffad68', glow:'rgba(255,100,90,.10)' },
      { top:'#070911', mid:'#111321', low:'#1c1528', edge:'#ff7398', glow:'rgba(255,60,120,.13)' }
    ];
    const pal = palettes[idx];
    // A dark, restrained gradient replaces the bright natural/desert skies.
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, pal.top); sky.addColorStop(.58, pal.mid); sky.addColorStop(1, pal.low);
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W*.66,H*.28,0,W*.66,H*.28,Math.max(W,H)*.7);
    glow.addColorStop(0,pal.glow); glow.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=glow;ctx.fillRect(0,0,W,H);

    // Keep the second and third locations' familiar layered atmosphere, but harmonize their colors.
    if (idx === 1 || idx === 2) {
      for (let i=0;i<theme.layers.length;i++) {
        const L=theme.layers[i];
        ctx.save(); ctx.globalAlpha=.48;
        drawWaveLayer(idx===1 ? ['rgba(45,35,70,.36)','rgba(63,42,88,.42)','rgba(77,48,105,.46)','rgba(90,58,120,.48)'][i] : ['rgba(25,53,75,.34)','rgba(29,70,98,.40)','rgba(35,85,112,.44)','rgba(42,100,128,.46)'][i], H*L.baseY, H*L.amp*.62, L.freq, L.par, L.ph);
        ctx.restore();
      }
    } else {
      // Layered floating shards: abstract silhouettes rather than forest trees or desert blocks.
      const shift = camX * .12 * ppu;
      for (let layer=0; layer<3; layer++) {
        ctx.save(); ctx.globalAlpha=[.18,.27,.38][layer];
        ctx.fillStyle=pal.edge;
        const spacing=[190,245,310][layer], yBase=H*[.57,.68,.78][layer], par=[.10,.19,.30][layer];
        for(let i=-2;i<Math.ceil(W/spacing)+3;i++){
          const x=((i*spacing-shift*par)%(W+spacing)+W+spacing)%(W+spacing)-spacing*.25;
          const h=H*(.09+((i*7+layer*11)%5+5)%5*.025);
          ctx.beginPath(); ctx.moveTo(x,yBase); ctx.lineTo(x+spacing*.19,yBase-h); ctx.lineTo(x+spacing*.34,yBase-h*.68); ctx.lineTo(x+spacing*.48,yBase); ctx.closePath(); ctx.fill();
          ctx.strokeStyle=pal.edge;ctx.lineWidth=1;ctx.globalAlpha=[.10,.15,.21][layer];
          ctx.beginPath();ctx.moveTo(x+spacing*.19,yBase-h);ctx.lineTo(x+spacing*.34,yBase-h*.68);ctx.lineTo(x+spacing*.48,yBase);ctx.stroke();
          ctx.globalAlpha=[.18,.27,.38][layer];
        }
        ctx.restore();
      }
      // Sparse floating polygon fragments add depth without cluttering the play area.
      ctx.save(); ctx.strokeStyle=pal.edge; ctx.lineWidth=1; ctx.globalAlpha=.18;
      for(let i=0;i<12;i++){
        const x=((i*137-shift*.42)%(W+90)+W+90)%(W+90)-35;
        const y=H*(.13+((i*29)%43)/100), r=5+(i%4)*3;
        ctx.beginPath();ctx.moveTo(x,y-r);ctx.lineTo(x+r,y);ctx.lineTo(x,y+r);ctx.lineTo(x-r,y);ctx.closePath();ctx.stroke();
      }
      ctx.restore();
    }
    // Ground/floor is a dark plane with a single readable luminous seam.
    const groundTop = H * (idx===4 ? .88 : .87);
    const gg=ctx.createLinearGradient(0,groundTop,0,H);gg.addColorStop(0,pal.low);gg.addColorStop(1,pal.top);
    ctx.fillStyle=gg;ctx.fillRect(0,groundTop,W,H-groundTop);
    ctx.save();ctx.shadowColor=pal.edge;ctx.shadowBlur=7;ctx.strokeStyle=pal.edge;ctx.globalAlpha=.35;ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(0,groundTop);ctx.lineTo(W,groundTop);ctx.stroke();ctx.restore();
  }
function drawCloudsScreen() {
    ctx.save();
    const off  = camX * 0.18 * ppu;
    const offY = camY * 0.10 * ppu;
    for (const c of clouds) {
      const sx = c.x * ppu - off;
      const sy = c.y * ppu - offY;
      if (sx < -200 || sx > canvas.width + 200) continue;
      const r = 22 * c.s * ppu;
      ctx.fillStyle = theme.cloudColor;
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, TAU);
      ctx.arc(sx + r * 1.15, sy + r * 0.28, r * 0.72, 0, TAU);
      ctx.arc(sx - r * 1.18, sy + r * 0.34, r * 0.62, 0, TAU);
      ctx.arc(sx + r * 0.24, sy - r * 0.52, r * 0.66, 0, TAU);
      ctx.arc(sx + r * 0.85, sy - r * 0.22, r * 0.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = theme.cloudShade;
      ctx.beginPath();
      ctx.arc(sx + r * 0.3, sy + r * 0.7, r * 0.7, 0, TAU);
      ctx.arc(sx - r * 0.7, sy + r * 0.6, r * 0.5, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
function drawPlatforms(alpha) {
    const edge=['#62f2c4','#df9cff','#9ceeff','#ffad68','#ff7398'][Math.min(state.levelIndex,4)];
    for (const pl of level.platforms) {
      const x=lerp(pl.prevX,pl.x,alpha), y=lerp(pl.prevY,pl.y,alpha);
      ctx.save();
      if(pl.ceiling){ctx.shadowColor=edge;ctx.shadowBlur=12;ctx.fillStyle='#111827';ctx.strokeStyle=edge;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x+4,y);ctx.lineTo(x+pl.w-4,y);ctx.lineTo(x+pl.w,y+pl.h);ctx.lineTo(x,y+pl.h);ctx.closePath();ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.strokeStyle=edge+'88';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+10,y+pl.h-3);ctx.lineTo(x+pl.w-12,y+pl.h-3);ctx.stroke();ctx.restore();continue;}
      ctx.fillStyle='rgba(0,0,0,.3)';ctx.beginPath();ctx.moveTo(x+4,y+pl.h+5);ctx.lineTo(x+pl.w,y+pl.h+5);ctx.lineTo(x+pl.w-5,y+pl.h+10);ctx.lineTo(x+8,y+pl.h+10);ctx.closePath();ctx.fill();
      const g=ctx.createLinearGradient(0,y,0,y+pl.h);g.addColorStop(0,'#293348');g.addColorStop(1,'#0d1422');ctx.fillStyle=g;
      ctx.beginPath();ctx.moveTo(x+5,y);ctx.lineTo(x+pl.w-5,y);ctx.lineTo(x+pl.w,y+pl.h-4);ctx.lineTo(x+pl.w-7,y+pl.h);ctx.lineTo(x+6,y+pl.h);ctx.lineTo(x,y+pl.h-4);ctx.closePath();ctx.fill();
      ctx.shadowColor=edge;ctx.shadowBlur=7;ctx.strokeStyle=edge;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(x+5,y+.5);ctx.lineTo(x+pl.w-5,y+.5);ctx.stroke();ctx.shadowBlur=0;
      ctx.strokeStyle=edge+'55';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+12,y+pl.h-5);ctx.lineTo(x+pl.w*.34,y+pl.h-5);ctx.lineTo(x+pl.w*.42,y+pl.h-10);ctx.moveTo(x+pl.w*.7,y+pl.h-5);ctx.lineTo(x+pl.w-12,y+pl.h-5);ctx.stroke();
      ctx.restore();
    }
  }
function drawCoins() {
    for (const c of level.coins) {
      if (c.taken) continue;
      const bob = Math.sin(time * 0.045 + c.x * 0.05) * 2.2;
      const y = c.y + bob;
      const pulse = 1 + Math.sin(time * 0.055 + c.x) * .08;
      const col = ['#70e8bd','#c99aff','#9cecff','#ffb36b','#ff7398'][state.levelIndex] || '#9cecff';
      ctx.save(); ctx.translate(c.x,y); ctx.rotate(Math.sin(time*.025+c.spin)*.16); ctx.scale(pulse,1);
      ctx.shadowColor=col; ctx.shadowBlur=14;
      ctx.fillStyle=col+'28'; ctx.strokeStyle=col; ctx.lineWidth=1.5;
      ctx.beginPath(); ctx.moveTo(0,-10); ctx.lineTo(7,-3); ctx.lineTo(5,6); ctx.lineTo(0,10); ctx.lineTo(-6,4); ctx.lineTo(-7,-4); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.shadowBlur=0; ctx.fillStyle='#f1ffff'; ctx.globalAlpha=.9;
      ctx.beginPath(); ctx.moveTo(0,-5); ctx.lineTo(3,0); ctx.lineTo(0,5); ctx.lineTo(-2,0); ctx.closePath(); ctx.fill();
      ctx.globalAlpha=.5; ctx.strokeStyle=col; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(-13,0); ctx.lineTo(-9,0); ctx.moveTo(9,0); ctx.lineTo(13,0); ctx.stroke();
      ctx.restore();
    }
  }
function drawCheckpoints() {
    for (const cp of level.checkpoints) {
      const baseY = cp.y;
      const poleH = 60;
      const active = cp.activated;
      if (cp.inverted) {
        ctx.save();
        ctx.translate(cp.x, baseY);
        ctx.scale(1, -1);
        ctx.translate(-cp.x, -baseY);
      }

      if (active) {
        const beam = ctx.createLinearGradient(0, baseY - 90, 0, baseY);
        beam.addColorStop(0, 'rgba(123, 224, 138, 0)');
        beam.addColorStop(0.6, 'rgba(123, 224, 138, 0.18)');
        beam.addColorStop(1, 'rgba(123, 224, 138, 0.32)');
        ctx.fillStyle = beam;
        ctx.fillRect(cp.x - 14, baseY - 90, 36, 90);

        const pulse = 1 + cp.pulse * 1.8;
        const glow = ctx.createRadialGradient(cp.x + 4, baseY - 55, 0, cp.x + 4, baseY - 55, 30 * pulse);
        glow.addColorStop(0, 'rgba(190, 255, 200, 0.7)');
        glow.addColorStop(1, 'rgba(123, 224, 138, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath(); ctx.arc(cp.x + 4, baseY - 55, 30 * pulse, 0, TAU); ctx.fill();
      }

      ctx.fillStyle = active ? '#7be08a' : '#7a8590';
      rrect(cp.x - 8, baseY - 6, 22, 8, 4); ctx.fill();

      ctx.fillStyle = active ? '#d7fff4' : '#718093';
      rrect(cp.x, baseY - poleH, 3, poleH, 1.5); ctx.fill();

      const wave = Math.sin(time * 0.07) * 1.5;
      const mark = active ? '#8fffe0' : '#65748b';
      ctx.save(); ctx.shadowColor=mark; ctx.shadowBlur=active?12:3; ctx.fillStyle=mark; ctx.strokeStyle=mark; ctx.lineWidth=1.2;
      ctx.beginPath(); ctx.moveTo(cp.x+3,baseY-poleH+3); ctx.lineTo(cp.x+25,baseY-poleH+12+wave); ctx.lineTo(cp.x+3,baseY-poleH+24); ctx.lineTo(cp.x+9,baseY-poleH+13); ctx.closePath(); ctx.fill();
      ctx.globalAlpha=.65; ctx.beginPath(); ctx.moveTo(cp.x+8,baseY-poleH+13); ctx.lineTo(cp.x+19,baseY-poleH+12+wave); ctx.stroke(); ctx.restore();
      if (cp.inverted) ctx.restore();
    }
  }
function drawBuffs() {
    for (const b of level.buffs) {
      if (b.taken) continue;
      const bob = Math.sin(time * 0.055 + b.bob) * 3;
      const y = b.y + bob, col = buffColor(b.type);
      ctx.save(); ctx.translate(b.x,y); ctx.rotate(Math.sin(time*.025+b.bob)*.08);
      ctx.shadowColor=col; ctx.shadowBlur=13+Math.sin(time*.07+b.bob)*2;
      ctx.fillStyle='#101827'; ctx.strokeStyle=col; ctx.lineWidth=1.7;
      ctx.beginPath(); ctx.moveTo(0,-15); ctx.lineTo(12,-5); ctx.lineTo(9,9); ctx.lineTo(0,15); ctx.lineTo(-10,7); ctx.lineTo(-12,-5); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.shadowBlur=0; ctx.strokeStyle=col; ctx.fillStyle=col; ctx.lineWidth=2.1; ctx.lineCap='round'; ctx.lineJoin='round';
      if (b.type === 'double') {
        ctx.beginPath(); ctx.moveTo(-4,5); ctx.lineTo(-4,-5); ctx.lineTo(-7,-2); ctx.moveTo(-4,-5); ctx.lineTo(-1,-2); ctx.moveTo(4,5); ctx.lineTo(4,-5); ctx.lineTo(1,-2); ctx.moveTo(4,-5); ctx.lineTo(7,-2); ctx.stroke();
      } else if (b.type === 'speed') {
        ctx.beginPath(); ctx.moveTo(2,-9); ctx.lineTo(-4,1); ctx.lineTo(0,1); ctx.lineTo(-2,8); ctx.lineTo(5,-2); ctx.lineTo(1,-2); ctx.closePath(); ctx.fill();
      } else if (b.type === 'magnet') {
        ctx.beginPath(); ctx.moveTo(-6,-4); ctx.lineTo(-6,3); ctx.quadraticCurveTo(-6,8,0,8); ctx.quadraticCurveTo(6,8,6,3); ctx.lineTo(6,-4); ctx.moveTo(-8,-4); ctx.lineTo(-4,-4); ctx.moveTo(4,-4); ctx.lineTo(8,-4); ctx.stroke();
      } else if (b.type === 'shield') {
        ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(6,-5); ctx.lineTo(5,2); ctx.lineTo(0,8); ctx.lineTo(-5,2); ctx.lineTo(-6,-5); ctx.closePath(); ctx.stroke();
      }
      ctx.restore();
    }
  }
function drawTraps() {
    for (const t of level.traps) {
      let x = t.x, y = t.y;
      if (t.type === 'saw') {
        x = t.baseX + Math.sin(time * (t.speed || 0.045) + t.phase) * (t.ax || 0);
        y = t.baseY + Math.sin(time * (t.speed || 0.045) + t.phase * 1.7) * (t.ay || 0);
      }
      if (t.type === 'spikes') {
        const count = Math.max(2, Math.floor(t.w / 10));
        const step = t.w / count;
        ctx.fillStyle = '#d8e0ea';
        for (let i = 0; i < count; i++) {
          ctx.beginPath();
          ctx.moveTo(x + i * step, y + t.h);
          ctx.lineTo(x + (i + 0.5) * step, y);
          ctx.lineTo(x + (i + 1) * step, y + t.h);
          ctx.closePath(); ctx.fill();
        }
        ctx.fillStyle = 'rgba(20,28,40,0.28)';
        ctx.fillRect(x, y + t.h - 2, t.w, 2);
      } else if (t.type === 'saw') {
        // Stylized high-contrast energy saw: larger silhouette and location-specific glow
        // so the hazard is immediately visible after its warning appears.
        const cx = x + t.w / 2, cy = y + t.h / 2;
        const accents = ['#62f2c4', '#df9cff', '#9ceeff', '#ffad68', '#ff7398'];
        const accent = accents[Math.min(state.levelIndex || 0, accents.length - 1)];
        const r = Math.max(17, Math.min(t.w, t.h) * 0.58);
        ctx.save(); ctx.translate(cx, cy); ctx.rotate(time * 0.095);
        ctx.shadowColor = accent; ctx.shadowBlur = 16;
        ctx.fillStyle = '#111827'; ctx.strokeStyle = accent; ctx.lineWidth = 2.2;
        ctx.beginPath();
        for (let i = 0; i < 16; i++) {
          const a = i * TAU / 16, rr = i % 2 ? r * 0.72 : r * 1.18;
          const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
          if (!i) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.shadowBlur = 0;
        ctx.strokeStyle = accent + 'cc'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.67, 0, TAU); ctx.stroke();
        ctx.fillStyle = '#080d18'; ctx.strokeStyle = accent; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.34, 0, TAU); ctx.fill(); ctx.stroke();
        ctx.fillStyle = accent; ctx.beginPath(); ctx.moveTo(0, -r * 0.2); ctx.lineTo(r * 0.2, 0); ctx.lineTo(0, r * 0.2); ctx.lineTo(-r * 0.2, 0); ctx.closePath(); ctx.fill();
        ctx.restore();
      }
    }
  }
function drawEnemies(alpha) {
    const edges=['#62f2c4','#df9cff','#9ceeff','#ffad68','#ff7398'];
    const edge=edges[Math.min(state.levelIndex||0,4)];
    for (const e of level.enemies) {
      const ex=lerp(e.prevX,e.x,alpha), ey=e.y;
      if(!e.alive){
        if(e.deadT>0){const k=e.deadT/26;ctx.save();ctx.globalAlpha=k;ctx.fillStyle=edge;ctx.beginPath();ctx.moveTo(ex+e.w*.12,ey+e.h);ctx.lineTo(ex+e.w*.32,ey+e.h*.72);ctx.lineTo(ex+e.w*.62,ey+e.h*.82);ctx.lineTo(ex+e.w*.9,ey+e.h);ctx.closePath();ctx.fill();ctx.restore();}
        continue;
      }
      const invertedZone=level.gravityZones.find(z=>ex+e.w/2>=z.x&&ex+e.w/2<=z.x+z.w);
      ctx.save();
      if(invertedZone){ctx.translate(ex+e.w/2,ey+e.h/2);ctx.rotate(Math.PI);ctx.translate(-(ex+e.w/2),-(ey+e.h/2));}
      const cx=ex+e.w/2, cy=ey+e.h/2;
      const bob=Math.sin(time*.075+e.phase)*(e.type==='hopper'?2:1.1);
      ctx.globalAlpha=.22;ctx.fillStyle=edge;ctx.beginPath();ctx.ellipse(cx,ey+e.h+3,e.w*.36,2.5,0,0,TAU);ctx.fill();ctx.globalAlpha=1;
      ctx.save();ctx.translate(cx,cy+bob);
      if(e.type==='flyer'){
        // Floating shard with two small side fins; no organic wings.
        ctx.shadowColor=edge;ctx.shadowBlur=9;ctx.fillStyle='#111827';ctx.strokeStyle=edge;ctx.lineWidth=1.5;
        ctx.beginPath();ctx.moveTo(0,-e.h*.48);ctx.lineTo(e.w*.35,-e.h*.12);ctx.lineTo(e.w*.42,e.h*.22);ctx.lineTo(0,e.h*.45);ctx.lineTo(-e.w*.42,e.h*.22);ctx.lineTo(-e.w*.35,-e.h*.12);ctx.closePath();ctx.fill();ctx.stroke();ctx.shadowBlur=0;
        ctx.fillStyle=edge;ctx.beginPath();ctx.moveTo(-e.w*.28,0);ctx.lineTo(-e.w*.56,-e.h*.22);ctx.lineTo(-e.w*.43,e.h*.16);ctx.closePath();ctx.fill();
        ctx.beginPath();ctx.moveTo(e.w*.28,0);ctx.lineTo(e.w*.56,-e.h*.22);ctx.lineTo(e.w*.43,e.h*.16);ctx.closePath();ctx.fill();
        ctx.fillStyle='#f4fbff';ctx.beginPath();ctx.arc(-4,0,2,0,TAU);ctx.arc(4,0,2,0,TAU);ctx.fill();
      } else {
        // Ground enemies use a compact, jagged silhouette matching the hero's abstract world.
        const w=e.w,h=e.h;
        ctx.shadowColor=edge;ctx.shadowBlur=7;ctx.fillStyle='#141725';ctx.strokeStyle=edge;ctx.lineWidth=1.4;
        ctx.beginPath();ctx.moveTo(-w*.48,h*.36);ctx.lineTo(-w*.42,-h*.08);ctx.lineTo(-w*.2,-h*.28);ctx.lineTo(-w*.1,-h*.48);ctx.lineTo(w*.08,-h*.3);ctx.lineTo(w*.3,-h*.4);ctx.lineTo(w*.46,-h*.08);ctx.lineTo(w*.48,h*.36);ctx.lineTo(w*.2,h*.46);ctx.lineTo(-w*.22,h*.46);ctx.closePath();ctx.fill();ctx.stroke();ctx.shadowBlur=0;
        ctx.strokeStyle=edge;ctx.globalAlpha=.52;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-w*.2,-h*.18);ctx.lineTo(-w*.05,h*.06);ctx.lineTo(w*.13,-h*.12);ctx.stroke();ctx.globalAlpha=1;
        const eyeY=-h*.04, look=e.vx>0?1:-1;
        ctx.fillStyle=edge;ctx.beginPath();ctx.moveTo(-w*.23+look,eyeY);ctx.lineTo(-w*.04+look,eyeY-1);ctx.lineTo(-w*.07+look,eyeY+3);ctx.closePath();ctx.fill();
        ctx.beginPath();ctx.moveTo(w*.05+look,eyeY-1);ctx.lineTo(w*.24+look,eyeY);ctx.lineTo(w*.08+look,eyeY+3);ctx.closePath();ctx.fill();
      }
      ctx.restore();ctx.restore();
    }
  }
function drawGoal() {
    // Выходной портал: абстрактная геометрическая арка вместо флажка.
    const g = level.goal;
    const t = time * 0.035;
    const cx = g.x + 15;
    const cy = g.y - 47;
    const rx = 28 + Math.sin(t * 1.7) * 2.5;
    const ry = 43 + Math.sin(t * 1.3) * 2;
    const palette = (level && level.theme) ? level.theme : {};
    const accent = palette.accent || palette.glow || '#72e8dc';
    const accent2 = palette.accent2 || '#a98aff';

    ctx.save();
    // Light pool on the ground.
    const pool = ctx.createRadialGradient(cx, g.y - 2, 2, cx, g.y - 2, 58);
    pool.addColorStop(0, 'rgba(100,238,222,.23)');
    pool.addColorStop(.55, 'rgba(100,238,222,.08)');
    pool.addColorStop(1, 'rgba(100,238,222,0)');
    ctx.fillStyle = pool;
    ctx.beginPath(); ctx.ellipse(cx, g.y - 1, 58, 13, 0, 0, TAU); ctx.fill();

    // Outer fragmented halo.
    ctx.translate(cx, cy);
    ctx.shadowColor = accent; ctx.shadowBlur = 22;
    ctx.lineWidth = 2.4; ctx.strokeStyle = accent;
    ctx.beginPath(); ctx.ellipse(0, 0, rx, ry, 0, -.92, 1.92); ctx.stroke();
    ctx.strokeStyle = accent2; ctx.shadowColor = accent2; ctx.shadowBlur = 15;
    ctx.beginPath(); ctx.ellipse(0, 0, rx - 6, ry - 7, 0, 2.25, 5.35); ctx.stroke();
    ctx.shadowBlur = 0;

    // Angular breaks give the portal a deliberately unstable silhouette.
    ctx.fillStyle = accent;
    for (let i = 0; i < 4; i++) {
      const a = t * .45 + i * Math.PI / 2;
      const x = Math.cos(a) * (rx + 3), y = Math.sin(a) * (ry + 3);
      ctx.save(); ctx.translate(x, y); ctx.rotate(a + Math.PI / 2);
      ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(3.5, 0); ctx.lineTo(0, 5); ctx.lineTo(-3.5, 0); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // Dark opening with a narrow luminous seam.
    ctx.fillStyle = 'rgba(5,10,22,.88)';
    ctx.beginPath(); ctx.ellipse(0, 0, rx - 8, ry - 9, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(225,255,252,.78)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(0, 0, rx - 12 + Math.sin(t * 2) * 1.5, ry - 13, 0, 0, TAU); ctx.stroke();
    ctx.restore();
  }
function drawGravityBoss(b) {
    ctx.save();
    const pulse = 1 + Math.sin(b.phase * 2) * .035;
    ctx.translate(b.x + b.w/2, b.y + b.h/2); ctx.scale(pulse, pulse);
    ctx.shadowColor = b.hitFlash ? '#ffffff' : '#ff477e'; ctx.shadowBlur = b.hitFlash ? 28 : 20;
    ctx.fillStyle = b.hitFlash ? '#f7fdff' : '#182738';
    ctx.beginPath(); ctx.moveTo(-b.w*.42,-b.h*.32); ctx.lineTo(-b.w*.28,-b.h*.5); ctx.lineTo(0,-b.h*.38); ctx.lineTo(b.w*.28,-b.h*.5); ctx.lineTo(b.w*.42,-b.h*.32); ctx.lineTo(b.w*.48,b.h*.22); ctx.lineTo(0,b.h*.48); ctx.lineTo(-b.w*.48,b.h*.22); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0; ctx.strokeStyle = '#ff7398'; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.fillStyle = '#ff557f'; ctx.beginPath(); ctx.arc(0,-5,13,0,TAU); ctx.fill();
    ctx.fillStyle = '#e8fbff'; ctx.beginPath(); ctx.arc(-4,-7,3,0,TAU); ctx.arc(4,-7,3,0,TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(150,225,255,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(-25,20); ctx.lineTo(-13,31); ctx.lineTo(0,20); ctx.lineTo(13,31); ctx.lineTo(25,20); ctx.stroke();
    ctx.restore();
    const bw = 112, bh = 8, bx = b.x + b.w/2 - bw/2, by = b.y - 22;
    ctx.save(); ctx.fillStyle = 'rgba(5,12,20,.8)'; rrect(bx,by,bw,bh,4); ctx.fill();
    ctx.fillStyle = '#ff6688'; rrect(bx,by,bw*(Math.max(0,b.hp)/b.maxHp),bh,4); ctx.fill();
    ctx.font = '800 10px system-ui'; ctx.textAlign = 'center'; ctx.fillStyle = '#ffe8ef'; ctx.fillText('СТРАЖ · ' + Math.max(0,b.hp) + '/' + b.maxHp,b.x+b.w/2,by-6); ctx.restore();
  }
function drawParticles() {
    // Частицы за пределами камеры продолжают жить и двигаться, но не тратят время на canvas-отрисовку.
    const left = camX - 36, right = camX + viewW + 36;
    const top = camY - 36, bottom = camY + viewH + 36;
    const visible = [];
    for (const p of particles) {
      if (p.x < left || p.x > right || p.y < top || p.y > bottom) continue;
      visible.push(p);
    }

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of visible) {
      if (!p.glow) continue;
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a * 0.42;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.4, 0, TAU); ctx.fill();
    }
    ctx.restore();

    for (const p of visible) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.4 + a * 0.6), 0, TAU); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
function drawMotes() {
    ctx.save();
    const px = camX * 1.20 * ppu;
    const py = camY * 1.20 * ppu;
    for (const m of motes) {
      const sx = m.x * ppu - px + Math.sin(time * 0.008 + m.ph) * 10;
      const sy = m.y * ppu - py + Math.cos(time * 0.007 + m.ph) * 8;
      if (sx < -20 || sx > canvas.width + 20 || sy < -20 || sy > canvas.height + 20) continue;
      const a = m.a * (0.55 + 0.45 * Math.sin(time * 0.018 + m.ph));
      ctx.globalAlpha = a;
      ctx.fillStyle = theme.mote;
      ctx.beginPath(); ctx.arc(sx, sy, m.r * ppu * 0.8, 0, TAU); ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }
function drawBossArenaTitle() {
    if (!level || state.levelIndex !== 4 || !level.arenaTitleT || state.mode !== 'play') return;
    const total = 210;
    const elapsed = total - level.arenaTitleT;
    const fadeIn = Math.min(1, elapsed / 22);
    const fadeOut = Math.min(1, level.arenaTitleT / 38);
    const alpha = Math.max(0, Math.min(fadeIn, fadeOut));
    if (alpha <= 0) return;
    const dpr = canvas.width / Math.max(1, window.innerWidth);
    const cx = canvas.width / 2;
    const cy = canvas.height * 0.31;
    const panelW = Math.min(canvas.width - 36 * dpr, 620 * dpr);
    const panelH = 112 * dpr;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = 'rgba(5, 8, 18, .86)';
    ctx.beginPath(); ctx.roundRect(cx - panelW / 2, cy - panelH / 2, panelW, panelH, 12 * dpr); ctx.fill();
    ctx.strokeStyle = 'rgba(255, 105, 145, .92)'; ctx.lineWidth = 1.5 * dpr;
    ctx.shadowColor = 'rgba(255, 65, 120, .55)'; ctx.shadowBlur = 18 * dpr;
    ctx.stroke(); ctx.shadowBlur = 0;
    ctx.fillStyle = '#ff7398'; ctx.fillRect(cx - panelW / 2 + 18 * dpr, cy - 24 * dpr, 3 * dpr, 48 * dpr);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f8fbff'; ctx.font = `900 ${Math.min(32 * dpr, panelW / 17)}px system-ui, sans-serif`;
    ctx.fillText('СТРАЖ ГРАВИТАЦИИ', cx, cy - 8 * dpr);
    ctx.fillStyle = '#ff9db7'; ctx.font = `700 ${12 * dpr}px system-ui, sans-serif`;
    ctx.fillText('СТРАЖ ЯДРА  ·  УРОВЕНЬ V', cx, cy + 25 * dpr);
    ctx.restore();
  }
function drawLevelHint() {
    if (state.mode !== 'play' || levelHintT <= 0 || !LEVEL_HINTS[state.levelIndex]) return;
    const fade = Math.min(1, levelHintT / 45);
    const dpr = canvas.width / Math.max(1, window.innerWidth);
    const margin = 14 * dpr;
    const maxW = Math.min(430 * dpr, canvas.width - margin * 2);
    const fontSize = 13 * dpr;
    ctx.save();
    ctx.font = `600 ${fontSize}px system-ui, sans-serif`;
    const text = LEVEL_HINTS[state.levelIndex];
    const padX = 14 * dpr;
    const maxTextW = maxW - padX * 2;
    const lines = [];
    let line = '';
    for (const word of text.split(/\s+/)) {
      const candidate = line ? line + ' ' + word : word;
      if (line && ctx.measureText(candidate).width > maxTextW) { lines.push(line); line = word; }
      else line = candidate;
    }
    if (line) lines.push(line);
    const measuredW = Math.max(...lines.map(ln => ctx.measureText(ln).width));
    const w = Math.min(maxW, measuredW + padX * 2);
    const lineH = fontSize * 1.38;
    const h = lines.length * lineH + 18 * dpr;
    const x = (canvas.width - w) / 2;
    const y = 14 * dpr;
    ctx.globalAlpha = 0.94 * fade;
    ctx.fillStyle = 'rgba(12, 18, 28, 0.9)';
    ctx.beginPath(); ctx.roundRect(x, y, w, h, 12 * dpr); ctx.fill();
    ctx.strokeStyle = 'rgba(125,211,252,.3)'; ctx.lineWidth = dpr; ctx.stroke();
    ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((ln, idx) => ctx.fillText(ln, canvas.width / 2, y + h / 2 + (idx - (lines.length - 1) / 2) * lineH));
    ctx.restore();
  }
function render(alpha) {
    drawSky();
    if (!level) return;

    drawParallaxBackdrop();
    drawCloudsScreen();

    const shX = shake > 0 ? (Math.random() - 0.5) * shake : 0;
    const shY = shake > 0 ? (Math.random() - 0.5) * shake : 0;

    ctx.setTransform(ppu, 0, 0, ppu, (-camX + shX) * ppu, (-camY + shY) * ppu);

    drawStoryEnvironment();
    drawCinematicDetails();
    drawGoal();
    drawCheckpoints();
    for (const z of level.gravityZones) {
      if (z.dir >= 0) continue;
      ctx.save();
      if (z.dynamic) {
        // Динамические зоны рисуются с пульсацией и прозрачностью
        const pulse = 0.3 + Math.sin(time * 0.1) * 0.2;
        const fade = level.arenaZoneOpacity ?? 1;
        const alphaVal = pulse * fade;
        ctx.strokeStyle = `rgba(125,220,255,${alphaVal})`;
        ctx.fillStyle = `rgba(100,210,255,${alphaVal * 0.5})`;
      } else {
        ctx.strokeStyle = 'rgba(125,220,255,.72)';
        ctx.fillStyle = 'rgba(100,210,255,.10)';
      }
      ctx.lineWidth = 3; ctx.setLineDash([8,7]);
      ctx.strokeRect(z.x, 24, z.w, 470); ctx.setLineDash([]);
      ctx.fillRect(z.x, 24, z.w, 470);
      ctx.font = '800 13px system-ui'; ctx.textAlign = 'center';
      ctx.globalAlpha = z.dynamic ? (level.arenaZoneOpacity ?? 1) : 1;
      ctx.fillStyle = z.dynamic ? '#ffffff' : '#a9e8ff';
      ctx.fillText('↑ ' + z.label, z.x+z.w/2, 42);
      ctx.restore();
    }
    drawPlatforms(alpha);
    drawTraps();
    drawCoins();
    drawBuffs();
    drawEnemies(alpha);
    if (level.boss && level.boss.alive) drawGravityBoss(level.boss);
    drawBossProjectiles();
    drawNpc();
    drawParticles();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawMotes();

    ctx.fillStyle = vignetteGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.setTransform(ppu, 0, 0, ppu, (-camX + shX) * ppu, (-camY + shY) * ppu);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    drawPlayer(alpha);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawLevelHint();
    drawBossArenaTitle();
  }
function updateHUD() {
    hudCoins.textContent = state.coins;
    hudLives.textContent = Math.max(0, state.lives);
    hudLevel.textContent = (state.levelIndex + 1) + '/' + LEVELS.length;
    hudLocIcon.textContent = ''; 
    if (hudProgress) hudProgress.style.width = ((state.levelIndex + 1) / LEVELS.length * 100) + '%';
    updatePerkBar();
  }
function updatePerkBar() {
    const sEl = perkEls.speed;
    if (buffs.speed > 0) {
      sEl.classList.add('on');
      sEl.querySelector('.bar > i').style.width = (buffs.speed / BUFF_DUR.speed * 100) + '%';
    } else sEl.classList.remove('on');

    const dEl = perkEls.double;
    if (buffs.double > 0) {
      dEl.classList.add('on');
      dEl.querySelector('.bar > i').style.width = (buffs.double / BUFF_DUR.double * 100) + '%';
    } else dEl.classList.remove('on');

    const mEl = perkEls.magnet;
    if (buffs.magnet > 0) {
      mEl.classList.add('on');
      mEl.querySelector('.bar > i').style.width = (buffs.magnet / BUFF_DUR.magnet * 100) + '%';
    } else mEl.classList.remove('on');

    perkEls.shield.classList.toggle('on', buffs.shield);
  }
function showMessage(title, text, btnLabel, action) {
    ovTitle.textContent = title;
    ovText.innerHTML = text;
    ovBtn.textContent = btnLabel;
    ovShop.style.display = 'none';
    overlayAction = action;
    overlay.classList.add('show');
  }
function hideOverlay() {
    overlay.classList.remove('show');
    overlayAction = null;
  }
function pauseGame() {
    if (state.mode !== 'play') return;
    state.mode = 'pause';
    pauseMenu.classList.add('show');
    ['left','right','up','down','jump'].forEach(k => setKey(k, false));
    jumpKeys.clear();
    refreshJumpInput();
    document.querySelectorAll('.btn.active').forEach(btn => btn.classList.remove('active'));
  }
function resumeGame() {
    if (state.mode !== 'pause') return;
    pauseMenu.classList.remove('show');
    state.mode = 'play';
    lastT = 0;
    acc = 0;
  }
function restartCurrentLevel() {
    pauseMenu.classList.remove('show');
    loadLevel(state.levelIndex);
    buffs.speed = 0; buffs.double = 0; buffs.magnet = 0; buffs.shield = false;
    particles.length = 0;
    bossProjectiles.length = 0;
    state.mode = 'play';
    hideOverlay();
    hideGameTip();
    hudDirty = true;
    updateHUD();
    lastT = 0;
    acc = 0;
  }
function openShop() {
    state.mode = 'shop';
    ovTitle.textContent = 'Магазин';
    ovText.innerHTML = '<div class="story-kicker">' + STORY[state.levelIndex].chapter + '</div><p><b>' + (state.levelIndex === LEVELS.length - 1 ? 'Башня стабилизирована!' : 'Этап завершён!') + '</b> ' + (state.levelIndex === 0 ? 'Осколок указывает путь в подземелье.' : state.levelIndex === 1 ? 'Древний механизм снова подаёт энергию.' : state.levelIndex === 2 ? 'Энергия направлена к башне. Остался последний путь.' : 'Сигнал затихает, а башня возвращается к жизни.') + '</p>Потрать монеты на постоянные улучшения.';
    ovShop.style.display = 'flex';
    ovShop.innerHTML = '';
    renderShopItems();
    ovBtn.textContent = state.levelIndex < LEVELS.length - 1 ? 'В путь →' : 'Финиш';
    overlayAction = () => {
      if (state.levelIndex < LEVELS.length - 1) {
        state.levelIndex++;
        loadLevel(state.levelIndex);
        hudDirty = true;
        showStory(state.levelIndex, 'Продолжить →');
      } else {
        startGame();
      }
    };
    overlay.classList.add('show');
  }
function renderShopItems() {
    ovShop.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'shop-head';
    head.innerHTML = '<span>Улучшения персонажа</span>' +
      '<span class="coin-badge"><i class="mini-shard"></i><b>' + state.coins + '</b></span>'; 
    ovShop.appendChild(head);

    for (const item of SHOP_ITEMS) {
      const curLevel = upgrades[item.id];
      const maxed = curLevel >= item.maxLevel;
      const cost = maxed ? null : item.costs[curLevel];
      const canBuy = !maxed && state.coins >= cost;

      const row = document.createElement('div');
      row.className = 'shop-item' + (maxed ? ' maxed' : (canBuy ? '' : ' cant'));

      row.innerHTML =
        '<div class="shop-icon">' + item.icon + '</div>' +
        '<div class="shop-info">' +
          '<div class="shop-name">' + item.name + '</div>' +
          '<div class="shop-desc">' + item.desc + '</div>' +
          '<div class="shop-level">Уровень ' + curLevel + ' / ' + item.maxLevel + '</div>' +
        '</div>';

      const btn = document.createElement('button');
      btn.className = 'shop-buy' + (maxed ? ' done' : '');
      if (maxed) {
        btn.textContent = '✓ МАКС';
        btn.disabled = true;
      } else {
        btn.innerHTML = '<i class="mini-shard"></i> ' + cost;
        btn.disabled = !canBuy;
        btn.addEventListener('click', () => buyUpgrade(item.id));
      }
      row.appendChild(btn);
      ovShop.appendChild(row);
    }
  }
function buyUpgrade(id) {
    const item = SHOP_ITEMS.find(i => i.id === id);
    const curLevel = upgrades[id];
    if (curLevel >= item.maxLevel) return;
    const cost = item.costs[curLevel];
    if (state.coins < cost) return;

    state.coins -= cost;
    upgrades[id]++;

    if (id === 'hearts') state.lives++;

    spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#ffd54f', 12, 0,
      { angle: 0, arc: TAU, speed: 2.0, life: 40, r: 2.4, grav: 0.06, glow: true });

    hudDirty = true;
    renderShopItems();
    updateHUD();
  }
function startGame() {
    state.coins = 0;
    state.lives = 3;
    state.levelIndex = 0;
    state.mode = 'play';
    for (const k in upgrades) upgrades[k] = 0;
    buffs.speed = 0; buffs.double = 0; buffs.magnet = 0; buffs.shield = false;
    loadLevel(0);
    hudDirty = true;
    updateHUD();
    showStory(0, 'Войти в лес →');
  }
function frame(now) {
    requestAnimationFrame(frame);
    if (!lastT) lastT = now;
    let dt = now - lastT;
    lastT = now;
    if (dt > 120) dt = 120;

    acc += dt;
    let guard = 0;
    while (acc >= STEP && guard++ < 5) { if (state.mode !== 'pause') update(); acc -= STEP; }
    const alpha = clamp(acc / STEP, 0, 1);

    if (level) {
      const t = cameraTargets();
      const kx = 1 - Math.exp(-dt * 0.0042);
      const ky = 1 - Math.exp(-dt * 0.0032);
      camX += (t.x - camX) * kx;
      camY += (t.y - camY) * ky;
      clampCamera();
    }

    render(alpha);
  }
