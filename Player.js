'use strict';

/* Extracted from the original game script. Loaded before main.js. */

function findRespawnPoint() {
    let last = null;
    for (const cp of level.checkpoints) if (cp.activated) last = cp;
    if (last) return { x: last.x - 13, y: last.inverted ? last.y + 2 : last.y - 34 };
    return { x: level.spawn.x, y: level.spawn.y };
  }
function cameraTargets() {
    const look = clamp(player.vx * 9, -38, 38);
    const lookDown = input.down ? 135 : 0;
    const yOffset = player.gravityDir < 0 ? viewH * 0.35 : viewH * 0.60;
    return {
      x: player.x + player.w / 2 + look - viewW / 2,
      y: player.y + player.h / 2 + lookDown - yOffset
    };
  }
function clampCamera() {
    if (viewW >= level.width) camX = (level.width - viewW) / 2;
    else camX = clamp(camX, 0, level.width - viewW);
    
    const minY = state.levelIndex === 4 ? -150 : 0;
    if (viewH >= level.height) camY = level.height - viewH;
    else camY = clamp(camY, minY, level.height - viewH);
  }
function respawn(snap) {
    const pt = findRespawnPoint();
    player.x = pt.x; player.y = pt.y;
    player.prevX = player.x; player.prevY = player.y;
    player.vx = 0; player.vy = 0; player.gravityDir = 1; player.gravityZone = -1;
    player.onGround = false; player.groundPlat = null;
    player.coyote = 0; player.jumpBuf = 0; player.jumping = false;
    player.invuln = snap ? 0 : 90;
    player.facing = 1; player.walkPhase = 0;
    player.squash = 0; player.dustTimer = 0;
    player.jumpsLeft = hasDoubleJump() ? 2 : 1;

    if (snap) {
      const t = cameraTargets();
      camX = t.x; camY = t.y;
    }
    clampCamera();
  }
function buffColor(t) {
    if (t === 'speed')  return '#ffe066';
    if (t === 'double') return '#c8a8ff';
    if (t === 'magnet') return '#7ec8ff';
    if (t === 'shield') return '#7be08a';
    return '#ffffff';
  }
function applyBuff(type) {
    if (type === 'speed')  buffs.speed  = BUFF_DUR.speed;
    else if (type === 'double') buffs.double = BUFF_DUR.double;
    else if (type === 'magnet') buffs.magnet = BUFF_DUR.magnet;
    else if (type === 'shield') buffs.shield = true;
    hudDirty = true;
  }
function hurtPlayer(force) {
    if (!force && player.invuln > 0) return;
    if (state.mode !== 'play') return;

    if (buffs.shield) {
      buffs.shield = false;
      player.invuln = 70;
      shake = 4;
      spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#7be08a', 14, 0,
        { angle: 0, arc: TAU, speed: 2.2, life: 40, r: 2.6, grav: 0.06, glow: true });
      spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#ffffff', 8, 0,
        { angle: 0, arc: TAU, speed: 1.3, life: 30, r: 1.8, grav: 0.04, glow: true });
      hudDirty = true;
      return;
    }

    state.lives--;
    hudDirty = true;
    shake = 5;

    spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#ff8a80', 12, 0,
      { angle: 0, arc: TAU, speed: 2.0, life: 42, r: 2.6, grav: 0.11, glow: true });
    spawnParticles(player.x + player.w / 2, player.y + player.h / 2, '#ffffff', 7, 0,
      { angle: 0, arc: TAU, speed: 1.2, life: 30, r: 1.8, grav: 0.06, glow: true });

    if (state.lives <= 0) {
      state.mode = 'gameover';
      showMessage('Игра окончена', 'Собрано осколков: ' + state.coins, 'Заново', startGame);
    } else {
      respawn(false);
    }
  }
function drawPlayer(alpha) {
    const p=player, px=lerp(p.prevX,p.x,alpha), py=lerp(p.prevY,p.y,alpha);
    if(state.levelIndex!==4&&p.invuln>0&&Math.floor(time/6)%2===0)return;
    const cx=px+p.w/2,bottom=py+p.h;
    let groundY=null;for(const pl of level.platforms)if(cx>pl.x-4&&cx<pl.x+pl.w+4&&pl.y>=bottom-2&&(groundY===null||pl.y<groundY))groundY=pl.y;
    if(groundY!==null&&groundY-bottom<140){const k=clamp(1-(groundY-bottom)/140,0,1);ctx.fillStyle=`rgba(0,0,0,${(.24*k).toFixed(2)})`;ctx.beginPath();ctx.ellipse(cx,groundY-1,p.w*.42*(.6+k*.4),3*(.6+k*.4),0,0,TAU);ctx.fill();}
    const edge=['#62f2c4','#df9cff','#9ceeff','#ffad68','#ff7398'][Math.min(state.levelIndex||0,4)];
    const squash=p.squash>0?Math.min(p.squash/10,1):0,moving=p.onGround&&Math.abs(p.vx)>.35,airborne=!p.onGround;
    const run=moving?Math.sin(p.walkPhase):0,bob=moving?Math.abs(Math.sin(p.walkPhase*2))*.8:(airborne?Math.sin(time*.08)*.25:0);
    ctx.save();if(p.gravityDir<0){ctx.translate(cx,py+p.h/2);ctx.rotate(Math.PI);ctx.translate(-cx,-(py+p.h/2));}
    ctx.translate(cx,py+p.h/2+bob);ctx.scale(1+.06*squash,(1-.08*squash)*(1+Math.sin(time*.1)*.018));ctx.scale(p.facing||1,1);
    // One compact, asymmetric shape; only the silhouette, eyes and core carry identity.
    const body=ctx.createLinearGradient(-9,-11,9,11);body.addColorStop(0,'#554d77');body.addColorStop(.58,'#292b42');body.addColorStop(1,'#151b2a');
    ctx.shadowColor=edge;ctx.shadowBlur=state.levelIndex===4?10:5;ctx.fillStyle=body;ctx.strokeStyle=edge;ctx.lineWidth=1.35;
    ctx.beginPath();ctx.moveTo(-10,5);ctx.lineTo(-9,-5);ctx.lineTo(-4,-10);ctx.lineTo(2,-11);ctx.lineTo(9,-6);ctx.lineTo(11,2);ctx.lineTo(6,9);ctx.lineTo(-2,11);ctx.lineTo(-8,8);ctx.closePath();ctx.fill();ctx.stroke();ctx.shadowBlur=0;
    // Small eye marks, not oversized cartoon eyes.
    ctx.fillStyle='#e9fbff';ctx.beginPath();ctx.moveTo(-5,-3);ctx.lineTo(-1,-3);ctx.lineTo(-2,0);ctx.lineTo(-5,0);ctx.closePath();ctx.fill();
    ctx.beginPath();ctx.moveTo(2,-3);ctx.lineTo(6,-3);ctx.lineTo(5,0);ctx.lineTo(2,0);ctx.closePath();ctx.fill();
    // The core is a single flat accent rather than a large multicolour glow.
    ctx.fillStyle=edge;ctx.globalAlpha=.9;ctx.beginPath();ctx.moveTo(0,3);ctx.lineTo(3,6);ctx.lineTo(0,9);ctx.lineTo(-3,6);ctx.closePath();ctx.fill();ctx.globalAlpha=1;
    // A tiny movement notch replaces the previous trail, sparks, arms, feet and cheek details.
    if(moving){ctx.globalAlpha=.35;ctx.strokeStyle=edge;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(-10,2+run);ctx.lineTo(-14,4+run);ctx.stroke();ctx.globalAlpha=1;}
    if(buffs.shield){ctx.strokeStyle='rgba(120,220,190,.68)';ctx.lineWidth=1.3;ctx.beginPath();ctx.ellipse(0,0,p.w*.82,p.h*.62,0,0,TAU);ctx.stroke();}
    if(buffs.magnet>0){ctx.strokeStyle=edge+'88';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,19+Math.sin(time*.1)*2,0,TAU);ctx.stroke();}
    ctx.restore();
  }
