'use strict';

/* Extracted from the original game script. Loaded before main.js. */

function setKey(k, v) {
    if (k === 'jump') {
      if (v && !input.jump) jumpQueued = true;
      input.jump = v;
    } else {
      input[k] = v;
    }
  }
function activeJumpCodes() {
    return player.gravityDir < 0 ? ['ArrowDown','KeyS'] : ['Space','ArrowUp','KeyW'];
  }
function refreshJumpInput() {
    const shouldJump = activeJumpCodes().some(code => jumpKeys.has(code));
    setKey('jump', shouldJump);
  }
