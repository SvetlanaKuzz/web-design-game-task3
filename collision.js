'use strict';

/* Extracted from the original game script. Loaded before main.js. */

function aabb(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x &&
           a.y < b.y + b.h && a.y + a.h > b.y;
  }
function updatePlayer() {
    const p = player;
    if (state.levelIndex === 4 && (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.vx) || !Number.isFinite(p.vy))) {
      p.x = level.spawn.x; p.y = 460 - p.h; p.vx = 0; p.vy = 0;
      p.gravityDir = 1; p.gravityZone = -1; p.onGround = true; p.groundPlat = null;
      p.invuln = 45; camX = 0;
    }
    p.prevX = p.x; p.prevY = p.y;
    if (__gravityAdminFly) {
      const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      const dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      p.vx = dx * 8; p.vy = dy * 8;
      p.x = clamp(p.x + p.vx, 0, level.width - p.w);
      p.y = clamp(p.y + p.vy, 0, level.height - p.h);
      p.gravityDir = 1; p.gravityZone = -1; p.onGround = false; p.groundPlat = null;
      p.jumping = false; p.jumpBuf = 0; jumpQueued = false;
      return;
    }

    if (p.groundPlat && p.groundPlat.move) {
      p.x += p.groundPlat.dx;
      p.y += p.groundPlat.dy;
    }
    const prevBottom = p.y + p.h;

    let activeZone = -1;
    for (let zi = 0; zi < level.gravityZones.length; zi++) {
      const z = level.gravityZones[zi];
      if (p.x + p.w * .5 >= z.x && p.x + p.w * .5 < z.x + z.w) { activeZone = zi; break; }
    }
    
    // ИСПРАВЛЕНИЕ: если игрок находится на платформе (onGround) и зона не изменилась,
    // то ничего не делаем. Если зона изменилась, но игрок на платформе, 
    // не сбрасываем его вниз, а позволяем продолжить.
    if (activeZone !== p.gravityZone) {
      const nextDir = activeZone >= 0 ? level.gravityZones[activeZone].dir : 1;
      if (nextDir !== p.gravityDir) {
        p.gravityZone = activeZone;
        p.gravityDir = nextDir;
        
        // Не задаём резкий импульс при смене гравитации: ускорение набирается постепенно.
        // Верхняя платформа арены поймает персонажа, когда он поднимется под действием инверсии.
        p.vy = 0;
        
        p.onGround = false; p.groundPlat = null;
        p.jumpBuf = 0; jumpQueued = false; input.jump = false; jumpKeys.clear();
        
        const jumpButton = document.querySelector('#controls .btn.jump');
        if (jumpButton) {
          jumpButton.textContent = nextDir < 0 ? '▼' : '▲';
          jumpButton.setAttribute('aria-label', nextDir < 0 ? 'Прыжок: вниз / S' : 'Прыжок: вверх / W');
        }
        spawnParticles(p.x + p.w/2, p.y + p.h/2, nextDir < 0 ? '#a9e8ff' : '#ffd27a', 12, 0,
          { angle:0, arc:TAU, speed:2.2, life:34, r:2.4, grav:0, glow:true });
      } else {
        p.gravityZone = activeZone;
      }
    }

    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const maxV = currentMaxV();
    const accelBase = 0.62 * currentAirMult();
    const ACCEL = (p.onGround ? 0.62 : accelBase);
    const FRIC  = 0.86;

    if (dir !== 0) {
      p.vx += dir * ACCEL;
      p.vx = clamp(p.vx, -maxV, maxV);
      p.facing = dir;
    } else {
      p.vx *= FRIC;
      if (Math.abs(p.vx) < 0.05) p.vx = 0;
    }

    if (p.onGround) {
      p.coyote = 8;
      p.jumpsLeft = hasDoubleJump() ? 2 : 1;
    } else if (p.coyote > 0) p.coyote--;

    if (jumpQueued) { p.jumpBuf = 8; jumpQueued = false; }
    else if (p.jumpBuf > 0) p.jumpBuf--;

    if (p.jumpBuf > 0 && p.jumpsLeft > 0) {
      const isGroundJump = p.onGround || p.coyote > 0;
      if (isGroundJump) {
        p.vy = baseJumpVel() * p.gravityDir;
        p.jumpsLeft--;
        p.onGround = false; p.coyote = 0; p.jumpBuf = 0;
        p.jumping = true; p.squash = -3.5;
        spawnParticles(p.x + p.w / 2, p.y + p.h, '#dff0ff', 5, 0,
          { angle: -Math.PI / 2, arc: 1.4, speed: 1.5, life: 22, r: 1.7, grav: 0.05 });
      } else if (hasDoubleJump()) {
        p.vy = -10.5 * p.gravityDir;
        p.jumpsLeft = 0; p.jumpBuf = 0; p.jumping = true; p.squash = -3.5;
        spawnParticles(p.x + p.w / 2, p.y + p.h * 0.7, '#c8a8ff', 8, 0,
          { angle: 0, arc: TAU, speed: 1.4, life: 28, r: 2.0, grav: 0.05, glow: true });
      }
    }

    if (p.jumping && !input.jump && p.vy * p.gravityDir < -4.0) p.vy = -4.0 * p.gravityDir;
    if (p.vy * p.gravityDir >= 0) p.jumping = false;

    p.vy += 0.62 * p.gravityDir;
    p.vy = clamp(p.vy, -14, 14);

    const oldX = p.x;
    p.x += p.vx;
    for (const pl of level.platforms) {
      // Разрешаем горизонтальное столкновение только когда игрок действительно пересёк боковую грань.
      // Если платформа сдвинулась по вертикали и временно наложилась на игрока, не телепортируем его вбок.
      const verticalOverlap = p.y + p.h > pl.y + 2 && p.y < pl.y + pl.h - 2;
      if (!verticalOverlap || !aabb(p, pl)) continue;
      if (p.vx > 0 && oldX + p.w <= pl.x + 3) {
        p.x = pl.x - p.w; p.vx = 0;
      } else if (p.vx < 0 && oldX >= pl.x + pl.w - 3) {
        p.x = pl.x + pl.w; p.vx = 0;
      }
    }

    const wasOnGround = p.onGround;
    const oldY = p.y;
    p.y += p.vy;
    p.onGround = false; p.groundPlat = null;
    for (const pl of level.platforms) {
      if (!aabb(p, pl)) continue;
      if (p.gravityDir > 0 && p.vy >= 0 && oldY + p.h <= pl.y + 5) {
        p.y = pl.y - p.h; p.onGround = true; p.groundPlat = pl;
        if (!wasOnGround && p.vy > 3.5) {
          p.squash = Math.min(6.5, p.vy * 0.55);
          spawnParticles(p.x + p.w/2, p.y + p.h, 'rgba(255,255,255,0.78)', 5, 0,
            { angle:0, arc:TAU, speed:1.3, life:24, r:1.9, grav:0.04, glow:true });
        }
        p.vy = 0;
      } else if (p.gravityDir < 0 && p.vy <= 0 && oldY >= pl.y + pl.h - 5) {
        p.y = pl.y + pl.h; p.onGround = true; p.groundPlat = pl;
        if (!wasOnGround && p.vy < -3.5) {
          p.squash = Math.min(6.5, -p.vy * 0.45);
          spawnParticles(p.x + p.w/2, p.y, '#a9e8ff', 6, 0,
            { angle:Math.PI/2, arc:TAU, speed:1.2, life:24, r:1.9, grav:0.04, glow:true });
        }
        p.vy = 0;
      } else if (p.vy > 0 && oldY + p.h <= pl.y + 5) {
        p.y = pl.y - p.h; p.vy = 0;
      } else if (p.vy < 0 && oldY >= pl.y + pl.h - 5) {
        p.y = pl.y + pl.h; p.vy = 0;
      }
    }

    if (p.x < 0) { p.x = 0; p.vx = 0; }
    if (p.x + p.w > level.width) { p.x = level.width - p.w; p.vx = 0; }
    if (p.invuln > 0) p.invuln--;

    if (p.onGround && Math.abs(p.vx) > 0.3) {
      p.walkPhase += Math.abs(p.vx) * 0.11;
      p.dustTimer -= Math.abs(p.vx);
      if (p.dustTimer <= 0) {
        p.dustTimer = 42;
        spawnParticles(p.x + p.w / 2 - p.facing * 6, p.y + p.h - 1,
          'rgba(220,205,180,0.7)', 1, 0,
          { angle: Math.PI + (Math.random() - 0.5), arc: 0.8, speed: 0.6, life: 22, r: 1.6, grav: 0.03, drag: 0.93 });
      }
    } else if (!p.onGround) {
      p.walkPhase += 0.05;
    } else {
      p.walkPhase *= 0.92;
    }

    if (p.squash > 0) p.squash *= 0.86;
    else if (p.squash < 0) p.squash *= 0.88;
    if (Math.abs(p.squash) < 0.12) p.squash = 0;

    if (level.boss && level.boss.alive) {
      const b = level.boss;
      b.phase += 0.045; if (b.hitFlash > 0) b.hitFlash--; b.attackT--;
      b.x += b.vx;
      if (b.x < b.minX) { b.x = b.minX; b.vx = Math.abs(b.vx); }
      if (b.x + b.w > b.maxX) { b.x = b.maxX - b.w; b.vx = -Math.abs(b.vx); }
      b.y = 280 + Math.sin(b.phase) * 18;
      if (b.attackT <= 0) {
        b.attackT = 145;
        // Три настоящих снаряда летят в сторону игрока с небольшим разбросом.
        const sx = b.x + b.w / 2, sy = b.y + b.h / 2;
        const tx = player.x + player.w / 2, ty = player.y + player.h / 2;
        const baseAngle = Math.atan2(ty - sy, tx - sx);
        for (let j = -1; j <= 1; j++) {
          const angle = baseAngle + j * 0.20;
          const speed = 3.4;
          bossProjectiles.push({ x: sx, y: sy, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
            r: 8, life: 150, trailT: 0 });
        }
        spawnParticles(sx, sy, '#ff6d91', 8, 0, {angle:baseAngle,arc:0.9,speed:1.8,life:26,r:2.8,grav:0,glow:true});
      }
      if (aabb(p,b)) {
        // Урон наносится только при падении сверху
        const landedOnBoss = (p.vy > 0 && p.prevY + p.h <= b.y + 22);
        if (landedOnBoss) {
          b.hp--; b.hitFlash = 12; p.vy = -9.5; p.jumping = false; p.onGround = false;
          shake = Math.max(shake, 5);
          spawnParticles(b.x+b.w/2,b.y+b.h/2,'#9be8ff',18,0,{angle:0,arc:TAU,speed:3.0,life:42,r:3,grav:0.04,glow:true});
          showGameTip({icon:'◇',title:'УДАР ПО СТРАЖУ',text:'Защита: ' + Math.max(0,b.hp) + ' / ' + b.maxHp + '. Прыгай на него сверху!'},110);
          if (b.hp <= 0) { b.alive = false; spawnParticles(b.x+b.w/2,b.y+b.h/2,'#ffe7a3',42,0,{angle:0,arc:TAU,speed:3.8,life:70,r:3.4,grav:0.03,glow:true}); showGameTip({icon:'◇',title:'СТРАЖ ПОВЕРЖЕН',text:'Ядро стабилизировано. Доберись до выходного портала.'},260); }
        } else hurtPlayer();
      }
    }

    for (const e of level.enemies) {
      e.prevX = e.x;
      if (!e.alive) { if (e.deadT > 0) e.deadT--; continue; }
      if (e.ceilingSupport) {
        e.x += e.vx;
        e.y = e.ceilingSupport.y + e.ceilingSupport.h;
        const left = Math.max(e.minX, e.ceilingSupport.x);
        const right = Math.min(e.maxX + e.w, e.ceilingSupport.x + e.ceilingSupport.w);
        if (e.x < left) { e.x = left; e.vx = Math.abs(e.vx); }
        if (e.x + e.w > right) { e.x = right - e.w; e.vx = -Math.abs(e.vx); }
      } else if (e.type === 'flyer') {
        e.x += e.vx;
        e.y = e.baseY + Math.sin(time * 0.075 + e.phase) * 24;
        if (e.x < e.minX) { e.x = e.minX; e.vx = Math.abs(e.vx); }
        if (e.x + e.w > e.maxX) { e.x = e.maxX - e.w; e.vx = -Math.abs(e.vx); }
      } else if (e.type === 'hopper') {
        e.x += e.vx;
        e.jumpT += 0.075;
        e.y = e.baseY - Math.max(0, Math.sin(e.jumpT)) * 34;
        if (e.x < e.minX) { e.x = e.minX; e.vx = Math.abs(e.vx); }
        if (e.x + e.w > e.maxX) { e.x = e.maxX - e.w; e.vx = -Math.abs(e.vx); }
      } else {
        e.x += e.vx;
        e.y = e.baseY;
        if (e.x < e.minX) { e.x = e.minX; e.vx = Math.abs(e.vx); }
        if (e.x + e.w > e.maxX) { e.x = e.maxX - e.w; e.vx = -Math.abs(e.vx); }
      }

      if (aabb(p, e)) {
        const stompFromAbove = p.gravityDir > 0 && p.vy > 0 && prevBottom <= e.y + 12;
        const stompFromBelow = p.gravityDir < 0 && p.vy < 0 && p.prevY >= e.y + e.h - 12;
        if (e.type !== 'flyer' && (stompFromAbove || stompFromBelow)) {
          e.alive = false; e.deadT = 26;
          p.vy = -9.5 * p.gravityDir; p.jumping = false; p.squash = -3;
          shake = Math.max(shake, 2);
          spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#c77dff', 11, 0,
            { angle: 0, arc: TAU, speed: 1.9, life: 40, r: 2.6, grav: 0.10, glow: true });
          spawnParticles(e.x + e.w / 2, e.y + e.h / 2, '#fff0ff', 6, 0,
            { angle: 0, arc: TAU, speed: 1.2, life: 28, r: 1.8, grav: 0.06, glow: true });
        } else {
          hurtPlayer();
        }
      }
    }

    const magR = magnetRadius();
    for (const c of level.coins) {
      if (c.taken) continue;
      c.spin += 0.026;
      if (magR > 12) {
        const dx = (p.x + p.w / 2) - c.x;
        const dy = (p.y + p.h / 2) - c.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < magR * magR) {
          const d = Math.sqrt(d2) || 1;
          const pull = 2.6 * (1 - d / magR) * (1 + 0.35 * (1 - d / magR));
          c.x += (dx / d) * pull;
          c.y += (dy / d) * pull;
        }
      }
      const box = { x: c.x - 11, y: c.y - 11, w: 22, h: 22 };
      if (aabb(p, box)) {
        c.taken = true;
        state.coins++;
        spawnParticles(c.x, c.y, '#ffd54f', 8, 0,
          { angle: 0, arc: TAU, speed: 1.5, life: 36, r: 2.2, grav: 0.07, glow: true });
        spawnParticles(c.x, c.y, '#fff8d0', 4, 0,
          { angle: 0, arc: TAU, speed: 0.9, life: 24, r: 1.6, grav: 0.03, glow: true });
        hudDirty = true;
      }
    }

    for (const t of level.traps) {
      let tx = t.x, ty = t.y;
      if (t.type === 'saw') {
        tx = t.baseX + Math.sin(time * (t.speed || 0.045) + t.phase) * (t.ax || 0);
        ty = t.baseY + Math.sin(time * (t.speed || 0.045) + t.phase * 1.7) * (t.ay || 0);
      }
      const box = { x: tx, y: ty, w: t.w, h: t.h };
      if (aabb(p, box)) { hurtPlayer(); break; }
    }

    for (const b of level.buffs) {
      if (b.taken) continue;
      const box = { x: b.x - 13, y: b.y - 13, w: 26, h: 26 };
      if (aabb(p, box)) {
        b.taken = true;
        applyBuff(b.type);
        spawnParticles(b.x, b.y, buffColor(b.type), 14, 0,
          { angle: 0, arc: TAU, speed: 2.0, life: 40, r: 2.6, grav: 0.06, glow: true });
        spawnParticles(b.x, b.y, '#ffffff', 8, 0,
          { angle: 0, arc: TAU, speed: 1.2, life: 28, r: 1.8, grav: 0.04, glow: true });
        hudDirty = true;
      }
    }

    for (const cp of level.checkpoints) {
      if (cp.activated) { cp.pulse *= 0.95; continue; }
      const box = cp.inverted
        ? { x: cp.x - 16, y: cp.y, w: 40, h: 70 }
        : { x: cp.x - 16, y: cp.y - 70, w: 40, h: 70 };
      if (aabb(p, box)) {
        cp.activated = true; cp.pulse = 1;
        spawnParticles(cp.x + 4, cp.y + (cp.inverted ? 20 : -60), '#7be08a', 16, 0,
          { angle: 0, arc: TAU, speed: 2.4, life: 46, r: 2.4, grav: 0.05, glow: true });
        spawnParticles(cp.x + 4, cp.y + (cp.inverted ? 20 : -60), '#ffffff', 10, 0,
          { angle: 0, arc: TAU, speed: 1.5, life: 34, r: 1.8, grav: 0.03, glow: true });
        hudDirty = true;
      }
      if (cp.pulse > 0) cp.pulse *= 0.94;
    }

    const g = level.goal;
    const goalBox = { x: g.x - 8, y: g.y - 100, w: 38, h: 100 };
    if (aabb(p, goalBox)) {
      if (level.boss && level.boss.alive) { showGameTip({icon:'◇',title:'ВЫХОД ЗАБЛОКИРОВАН',text:'Сначала победи Стража гравитации. Нужны точные приземления на броню.'},160); }
      else { levelComplete(); return; }
    }

    if (p.y > level.height + 120 || (p.gravityDir < 0 && p.y + p.h < -70)) hurtPlayer(true);
  }
