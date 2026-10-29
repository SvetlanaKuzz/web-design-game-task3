'use strict';

  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });

  const MAX_W = 420, MAX_H = 640;
  let ppu = 1, viewW = 420, viewH = 640;
  let skyGrad = null, vignetteGrad = null;

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 120));

  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);
  const lerp  = (a, b, t) => a + (b - a) * t;
  const TAU = Math.PI * 2;

  const THEMES = {
    forest: {
      skyStops: [['#1c4f96', 0], ['#4a8fd4', 0.35], ['#8fc4e8', 0.65], ['#d8eef8', 1]],
      sun: { x: 0.76, y: 0.15, r: 0.42, glow: 'rgba(255, 250, 214, 0.55)', disc: 'rgba(255, 252, 232, 0.9)' },
      layers: [
        { c: 'rgba(140, 172, 206, 0.62)', baseY: 0.60, amp: 0.085, freq: 0.0026, par: 0.10, ph: 0.4 },
        { c: 'rgba(96, 138, 168, 0.78)',  baseY: 0.68, amp: 0.075, freq: 0.0042, par: 0.24, ph: 1.9 },
        { c: 'rgba(74, 140, 122, 0.85)',  baseY: 0.76, amp: 0.062, freq: 0.0064, par: 0.40, ph: 3.2 },
        { c: 'rgba(58, 122, 92, 0.95)',   baseY: 0.84, amp: 0.050, freq: 0.0092, par: 0.62, ph: 5.1 }
      ],
      groundGrad: ['rgba(78, 154, 92, 1)', 'rgba(48, 100, 60, 1)'], groundTop: 0.86,
      dirtGrad: ['#8a6b4c', '#6b503a', '#4a3628'],
      grassGrad: ['#7be08a', '#4fc463', '#2f8f43'],
      grassBlade: '#6fe07c', grassHighlight: 'rgba(255,255,255,0.22)',
      mote: '#ffffff', cloudColor: 'rgba(255,255,255,0.84)', cloudShade: 'rgba(210, 230, 250, 0.42)',
      hue: 'forest'
    },
    cave: {
      skyStops: [['#0a0a18', 0], ['#1a1533', 0.4], ['#2a2048', 0.75], ['#3a2f58', 1]],
      sun: { x: 0.5, y: 0.35, r: 0.55, glow: 'rgba(200, 160, 255, 0.28)', disc: 'rgba(220, 190, 255, 0.45)' },
      layers: [
        { c: 'rgba(50, 40, 80, 0.70)',  baseY: 0.60, amp: 0.10,  freq: 0.0030, par: 0.10, ph: 0.4 },
        { c: 'rgba(70, 50, 100, 0.80)', baseY: 0.68, amp: 0.09,  freq: 0.0048, par: 0.24, ph: 1.9 },
        { c: 'rgba(90, 60, 130, 0.85)', baseY: 0.76, amp: 0.07,  freq: 0.0072, par: 0.40, ph: 3.2 },
        { c: 'rgba(110, 75, 155, 0.95)',baseY: 0.86, amp: 0.055, freq: 0.0100, par: 0.62, ph: 5.1 }
      ],
      groundGrad: ['rgba(60, 40, 90, 1)', 'rgba(30, 18, 50, 1)'], groundTop: 0.88,
      dirtGrad: ['#5a4560', '#3d2e45', '#251b2e'],
      grassGrad: ['#9b7bd4', '#6a4f9e', '#3d2a6b'],
      grassBlade: '#b090e0', grassHighlight: 'rgba(200, 170, 255, 0.25)',
      mote: '#c8a8ff', cloudColor: 'rgba(140, 110, 200, 0.45)', cloudShade: 'rgba(80, 60, 140, 0.3)',
      hue: 'cave'
    },
    ice: {
      skyStops: [['#0d2a4a', 0], ['#2a5f8f', 0.4], ['#7ab8dc', 0.72], ['#e0f0f8', 1]],
      sun: { x: 0.22, y: 0.18, r: 0.4, glow: 'rgba(220, 240, 255, 0.55)', disc: 'rgba(255, 255, 255, 0.95)' },
      layers: [
        { c: 'rgba(180, 210, 235, 0.60)', baseY: 0.60, amp: 0.09,  freq: 0.0026, par: 0.10, ph: 0.4 },
        { c: 'rgba(140, 185, 220, 0.75)', baseY: 0.68, amp: 0.08,  freq: 0.0042, par: 0.24, ph: 1.9 },
        { c: 'rgba(120, 175, 210, 0.85)', baseY: 0.76, amp: 0.065, freq: 0.0064, par: 0.40, ph: 3.2 },
        { c: 'rgba(100, 160, 200, 0.95)', baseY: 0.84, amp: 0.052, freq: 0.0092, par: 0.62, ph: 5.1 }
      ],
      groundGrad: ['rgba(140, 190, 225, 1)', 'rgba(80, 130, 175, 1)'], groundTop: 0.87,
      dirtGrad: ['#cfe0ee', '#a8c0d8', '#7894b0'],
      grassGrad: ['#f0f8ff', '#c8e4f4', '#8ec0dc'],
      grassBlade: '#d8ecfa', grassHighlight: 'rgba(255, 255, 255, 0.55)',
      mote: '#ffffff', cloudColor: 'rgba(255,255,255,0.92)', cloudShade: 'rgba(190, 215, 240, 0.55)',
      hue: 'ice'
    },
    desert: {
      skyStops: [['#3a1a4a', 0], ['#a04060', 0.4], ['#e08050', 0.72], ['#f8d890', 1]],
      sun: { x: 0.72, y: 0.30, r: 0.5, glow: 'rgba(255, 220, 140, 0.6)', disc: 'rgba(255, 240, 200, 0.95)' },
      layers: [
        { c: 'rgba(200, 140, 120, 0.60)', baseY: 0.60, amp: 0.08,  freq: 0.0026, par: 0.10, ph: 0.4 },
        { c: 'rgba(200, 120, 90, 0.75)',  baseY: 0.68, amp: 0.075, freq: 0.0042, par: 0.24, ph: 1.9 },
        { c: 'rgba(220, 130, 80, 0.85)',  baseY: 0.76, amp: 0.065, freq: 0.0064, par: 0.40, ph: 3.2 },
        { c: 'rgba(230, 150, 90, 0.95)',  baseY: 0.84, amp: 0.050, freq: 0.0092, par: 0.62, ph: 5.1 }
      ],
      groundGrad: ['rgba(230, 160, 90, 1)', 'rgba(180, 110, 60, 1)'], groundTop: 0.87,
      dirtGrad: ['#c08a5a', '#8a5838', '#5a3820'],
      grassGrad: ['#f0c890', '#d89858', '#a06838'],
      grassBlade: '#f0c890', grassHighlight: 'rgba(255, 240, 200, 0.35)',
      mote: '#ffe0a0', cloudColor: 'rgba(255, 230, 200, 0.5)', cloudShade: 'rgba(220, 160, 120, 0.4)',
      hue: 'desert'
    }
  };

  const SHOP_ITEMS = [
    { id: 'jump',   name: 'Высокий прыжок',   desc: '+9% к силе прыжка',       icon: '◇', maxLevel: 2, costs: [8, 15] },
    { id: 'speed',  name: 'Быстрые ноги',     desc: '+8% к скорости бега',     icon: '◇', maxLevel: 2, costs: [8, 15] },
    { id: 'hearts', name: 'Запасное сердце',  desc: '+1 к макс. жизням',       icon: '◇', maxLevel: 2, costs: [10, 20] },
    { id: 'magnet', name: 'Магнит',           desc: '+45 к радиусу сбора осколков', icon: '◇', maxLevel: 1, costs: [10] },
    { id: 'air',    name: 'Контроль в воздухе', desc: 'лучше управление в прыжке', icon: '◇', maxLevel: 1, costs: [10] }
  ];

  const LEVELS = [
    {
      name: 'Лесная тропа', icon: '◇', theme: 'forest',
      width: 3600, height: 520,
      spawn: { x: 60, y: 390 },
      goal:  { x: 3480, y: 460 },
      platforms: [
        { x: 0, y: 460, w: 380, h: 60 },
        { x: 460, y: 400, w: 120, h: 20 },
        { x: 660, y: 350, w: 120, h: 20 },
        { x: 860, y: 400, w: 120, h: 20 },
        { x: 1060, y: 350, w: 120, h: 20 },
        { x: 1260, y: 400, w: 120, h: 20 },
        { x: 460, y: 460, w: 900, h: 60 },
        { x: 1460, y: 460, w: 400, h: 60 },
        { x: 1940, y: 400, w: 120, h: 20 },
        { x: 2140, y: 350, w: 120, h: 20 },
        { x: 2340, y: 300, w: 120, h: 20 },
        { x: 2540, y: 350, w: 120, h: 20 },
        { x: 2740, y: 400, w: 120, h: 20 },
        { x: 1940, y: 460, w: 900, h: 60 },
        { x: 2940, y: 460, w: 660, h: 60 }
      ],
      coins: [
        { x: 520, y: 380 }, { x: 720, y: 330 }, { x: 920, y: 380 },
        { x: 1120, y: 330 }, { x: 1320, y: 380 },
        { x: 700, y: 415 }, { x: 1000, y: 415 }, { x: 1300, y: 415 },
        { x: 1650, y: 415 },
        { x: 2000, y: 380 }, { x: 2200, y: 330 }, { x: 2400, y: 280 },
        { x: 2600, y: 330 }, { x: 2800, y: 380 },
        { x: 2150, y: 415 }, { x: 2450, y: 415 }, { x: 2750, y: 415 },
        { x: 3100, y: 415 }, { x: 3300, y: 415 },
        { x: 3500, y: 415 }
      ],
      checkpoints: [
        { x: 1560, y: 460 },
        { x: 3020, y: 460 }
      ],
      buffs: [
        { x: 720,  y: 330, type: 'speed' },
        { x: 2400, y: 280, type: 'double' },
        { x: 1000, y: 415, type: 'magnet' },
        { x: 2750, y: 415, type: 'shield' }
      ],
      enemies: [
        { x: 250,  y: 426, w: 28, h: 34, vx:  0.85, minX: 60,   maxX: 400  },
        { x: 700,  y: 426, w: 28, h: 34, vx: -0.85, minX: 480,  maxX: 900  },
        { x: 1100, y: 426, w: 28, h: 34, vx:  0.9,  minX: 1000, maxX: 1340 },
        { x: 2100, y: 426, w: 28, h: 34, vx: -0.9,  minX: 1980, maxX: 2340 },
        { x: 2600, y: 426, w: 28, h: 34, vx:  0.9,  minX: 2480, maxX: 2800 },
        { x: 3200, y: 426, w: 28, h: 34, vx: -0.85, minX: 3100, maxX: 3380 },
      ],
      traps: []
    },
    {
      name: 'Пещеры', icon: '◇', theme: 'cave',
      width: 3800, height: 520,
      spawn: { x: 60, y: 390 },
      goal:  { x: 3680, y: 460 },
      platforms: [
        { x: 0, y: 460, w: 400, h: 60 },
        { x: 480, y: 400, w: 120, h: 20 },
        { x: 680, y: 340, w: 120, h: 20 },
        { x: 880, y: 300, w: 130, h: 20 },
        { x: 1080, y: 340, w: 120, h: 20 },
        { x: 1280, y: 400, w: 120, h: 20 },
        { x: 480, y: 460, w: 920, h: 60 },
        { x: 1480, y: 460, w: 400, h: 60 },
        { x: 1980, y: 400, w: 110, h: 20, move: { ay: 25, speed: 0.012 } },
        { x: 2170, y: 350, w: 110, h: 20 },
        { x: 2360, y: 300, w: 110, h: 20 },
        { x: 2550, y: 350, w: 110, h: 20 },
        { x: 2740, y: 400, w: 110, h: 20 },
        { x: 1980, y: 460, w: 870, h: 60 },
        { x: 2950, y: 460, w: 850, h: 60 }
      ],
      coins: [
        { x: 540, y: 380 }, { x: 740, y: 320 }, { x: 940, y: 280 },
        { x: 1140, y: 320 }, { x: 1340, y: 380 },
        { x: 700, y: 415 }, { x: 1000, y: 415 }, { x: 1300, y: 415 },
        { x: 1650, y: 415 },
        { x: 2030, y: 380 }, { x: 2220, y: 330 }, { x: 2410, y: 280 },
        { x: 2600, y: 330 }, { x: 2790, y: 380 },
        { x: 2150, y: 415 }, { x: 2450, y: 415 }, { x: 2750, y: 415 },
        { x: 3150, y: 415 }, { x: 3400, y: 415 },
        { x: 3600, y: 415 }
      ],
      checkpoints: [
        { x: 1580, y: 460 },
        { x: 3050, y: 460 }
      ],
      buffs: [
        { x: 940,  y: 280, type: 'speed' },
        { x: 2410, y: 280, type: 'double' },
        { x: 1300, y: 415, type: 'shield' },
        { x: 2600, y: 330, type: 'magnet' }
      ],
      enemies: [
        { x: 250,  y: 426, w: 28, h: 34, vx:  0.9,  minX: 60,   maxX: 380  },
        { x: 750,  y: 426, w: 28, h: 34, vx: -0.9,  minX: 500,  maxX: 940  },
        { x: 1150, y: 426, w: 28, h: 34, vx:  0.95, minX: 1050, maxX: 1380 },
        { x: 2150, y: 426, w: 28, h: 34, vx: -0.95, minX: 2000, maxX: 2400 },
        { x: 2650, y: 426, w: 28, h: 34, vx:  0.9,  minX: 2500, maxX: 2820 },
        { x: 3250, y: 426, w: 28, h: 34, vx: -0.9,  minX: 3100, maxX: 3480 },
        { x: 1450, y: 426, w: 30, h: 34, vx: -1.05, minX: 1400, maxX: 1880, type: 'hopper' },
        { x: 2920, y: 350, w: 32, h: 26, vx: 1.1, minX: 2880, maxX: 3480, type: 'flyer' }
      ],
      traps: [
        { x: 610, y: 450, w: 64, h: 10, type: 'spikes' },
        { x: 1500, y: 450, w: 52, h: 10, type: 'spikes' },
        { x: 2010, y: 450, w: 60, h: 10, type: 'spikes' },
        { x: 2280, y: 430, w: 34, h: 30, type: 'saw', ax: 70, ay: 20, speed: 0.055 },
        { x: 3000, y: 450, w: 64, h: 10, type: 'spikes' }
      ]
    },
    {
      name: 'Ледяные пики', icon: '◇', theme: 'ice',
      width: 3900, height: 520,
      spawn: { x: 60, y: 390 },
      goal:  { x: 3780, y: 460 },
      platforms: [
        { x: 0, y: 460, w: 380, h: 60 },
        { x: 460, y: 420, w: 110, h: 20 },
        { x: 650, y: 370, w: 110, h: 20 },
        { x: 840, y: 320, w: 110, h: 20 },
        { x: 1030, y: 370, w: 110, h: 20 },
        { x: 1220, y: 320, w: 110, h: 20 },
        { x: 460, y: 460, w: 940, h: 60 },
        { x: 1480, y: 460, w: 420, h: 60 },
        { x: 1990, y: 400, w: 110, h: 20, move: { ax: 60, speed: 0.010 } },
        { x: 2200, y: 340, w: 110, h: 20 },
        { x: 2410, y: 280, w: 110, h: 20, move: { ay: 25, speed: 0.014 } },
        { x: 2620, y: 340, w: 110, h: 20 },
        { x: 2830, y: 400, w: 110, h: 20 },
        { x: 1990, y: 460, w: 900, h: 60 },
        { x: 3020, y: 460, w: 880, h: 60 }
      ],
      coins: [
        { x: 520, y: 400 }, { x: 710, y: 350 }, { x: 900, y: 300 },
        { x: 1090, y: 350 }, { x: 1280, y: 300 },
        { x: 700, y: 415 }, { x: 1000, y: 415 }, { x: 1300, y: 415 },
        { x: 1650, y: 415 },
        { x: 2040, y: 380 }, { x: 2250, y: 320 }, { x: 2460, y: 260 },
        { x: 2670, y: 320 }, { x: 2880, y: 380 },
        { x: 2200, y: 415 }, { x: 2500, y: 415 }, { x: 2800, y: 415 },
        { x: 3250, y: 415 }, { x: 3500, y: 415 },
        { x: 3700, y: 415 }
      ],
      checkpoints: [
        { x: 1580, y: 460 },
        { x: 3120, y: 460 }
      ],
      buffs: [
        { x: 900,  y: 300, type: 'double' },
        { x: 2460, y: 260, type: 'speed' },
        { x: 1000, y: 415, type: 'magnet' },
        { x: 2880, y: 380, type: 'shield' }
      ],
      enemies: [
        { x: 250,  y: 426, w: 28, h: 34, vx:  0.9,  minX: 60,   maxX: 380  },
        { x: 800,  y: 426, w: 28, h: 34, vx: -0.9,  minX: 500,  maxX: 940  },
        { x: 1200, y: 426, w: 28, h: 34, vx:  0.9,  minX: 1100, maxX: 1380 },
        { x: 2200, y: 426, w: 28, h: 34, vx: -0.9,  minX: 2020, maxX: 2420 },
        { x: 2700, y: 426, w: 28, h: 34, vx:  0.9,  minX: 2560, maxX: 2850 },
        { x: 3350, y: 426, w: 28, h: 34, vx: -0.9,  minX: 3180, maxX: 3550 },
        { x: 1450, y: 426, w: 30, h: 34, vx: 1.1, minX: 1380, maxX: 1900, type: 'hopper' },
        { x: 2960, y: 330, w: 32, h: 26, vx: -1.15, minX: 2880, maxX: 3650, type: 'flyer' }
      ],
      traps: [
        { x: 600, y: 450, w: 66, h: 10, type: 'spikes' },
        { x: 1500, y: 450, w: 58, h: 10, type: 'spikes' },
        { x: 2010, y: 450, w: 60, h: 10, type: 'spikes' },
        { x: 2140, y: 430, w: 34, h: 30, type: 'saw', ax: 75, ay: 28, speed: 0.06 },
        { x: 2660, y: 430, w: 34, h: 30, type: 'saw', ax: 0, ay: 25, speed: 0.075 },
        { x: 3050, y: 450, w: 70, h: 10, type: 'spikes' }
      ]
    },
    {
      name: 'Песчаные дюны', icon: '◇', theme: 'desert',
      width: 4200, height: 520,
      spawn: { x: 60, y: 390 },
      goal:  { x: 4080, y: 460 },
      platforms: [
        { x: 0, y: 460, w: 420, h: 60 },
        { x: 520, y: 420, w: 140, h: 20 },
        { x: 740, y: 370, w: 140, h: 20 },
        { x: 960, y: 320, w: 140, h: 20 },
        { x: 1180, y: 370, w: 140, h: 20 },
        { x: 1400, y: 420, w: 140, h: 20 },
        { x: 520, y: 460, w: 1020, h: 60 },
        { x: 1640, y: 460, w: 400, h: 60 },
        { x: 2140, y: 400, w: 130, h: 20 },
        { x: 2140, y: 460, w: 130, h: 60 },
        { x: 2360, y: 350, w: 130, h: 20 },
        { x: 2360, y: 460, w: 130, h: 60 },
        { x: 2580, y: 400, w: 130, h: 20 },
        { x: 2580, y: 460, w: 130, h: 60 },
        { x: 2800, y: 340, w: 130, h: 20 },
        { x: 2800, y: 460, w: 130, h: 60 },
        { x: 3020, y: 400, w: 130, h: 20 },
        { x: 3020, y: 460, w: 130, h: 60 },
        { x: 3240, y: 460, w: 960, h: 60 }
      ],
      coins: [
        { x: 590, y: 400 }, { x: 810, y: 350 }, { x: 1030, y: 300 },
        { x: 1250, y: 350 }, { x: 1470, y: 400 },
        { x: 780, y: 415 }, { x: 1080, y: 415 }, { x: 1380, y: 415 },
        { x: 1820, y: 415 },
        { x: 2200, y: 380 }, { x: 2420, y: 330 }, { x: 2640, y: 380 },
        { x: 2860, y: 320 }, { x: 3080, y: 380 },
        { x: 2200, y: 415 }, { x: 2420, y: 415 }, { x: 2640, y: 415 },
        { x: 2860, y: 415 }, { x: 3080, y: 415 },
        { x: 3500, y: 415 }, { x: 3800, y: 415 }
      ],
      checkpoints: [
        { x: 1740, y: 460 },
        { x: 3350, y: 460 }
      ],
      buffs: [
        { x: 1030, y: 300, type: 'double' },
        { x: 2800, y: 340, type: 'speed' },
        { x: 1080, y: 415, type: 'shield' },
        { x: 3080, y: 380, type: 'magnet' }
      ],
      enemies: [
        { x: 260,  y: 426, w: 28, h: 34, vx:  0.9,  minX: 60,   maxX: 400  },
        { x: 800,  y: 426, w: 28, h: 34, vx: -0.9,  minX: 560,  maxX: 1040 },
        { x: 1250, y: 426, w: 28, h: 34, vx:  0.9,  minX: 1150, maxX: 1500 },
        { x: 2400, y: 426, w: 28, h: 34, vx: -0.95, minX: 2200, maxX: 2600 },
        { x: 2850, y: 426, w: 28, h: 34, vx:  0.9,  minX: 2700, maxX: 3050 },
        { x: 3600, y: 426, w: 28, h: 34, vx: -0.9,  minX: 3420, maxX: 3820 },
        { x: 1580, y: 426, w: 30, h: 34, vx: -1.15, minX: 1500, maxX: 2040, type: 'hopper' },
        { x: 2320, y: 350, w: 32, h: 26, vx: 1.2, minX: 2140, maxX: 3150, type: 'flyer' },
        { x: 3160, y: 320, w: 32, h: 26, vx: -1.3, minX: 3000, maxX: 3250, type: 'flyer' }
      ],
      traps: [
        { x: 680, y: 450, w: 72, h: 10, type: 'spikes' },
        { x: 1680, y: 450, w: 64, h: 10, type: 'spikes' },
        { x: 2160, y: 450, w: 64, h: 10, type: 'spikes' },
        { x: 2270, y: 430, w: 34, h: 30, type: 'saw', ax: 90, ay: 24, speed: 0.065 },
        { x: 2510, y: 430, w: 34, h: 30, type: 'saw', ax: 0, ay: 32, speed: 0.08 },
        { x: 2730, y: 430, w: 34, h: 30, type: 'saw', ax: 65, ay: 20, speed: 0.075 },
        { x: 3280, y: 450, w: 76, h: 10, type: 'spikes' },
        { x: 3850, y: 450, w: 82, h: 10, type: 'spikes' }
      ]
    },
    {
      name: 'Ядро башни', icon: '✦', theme: 'ice', width: 4200, height: 520,
      spawn: { x: 90, y: 410 }, goal: { x: 4070, y: 460 },
      platforms: [
        {x:0,y:460,w:760,h:60},
        {x:650,y:420,w:100,h:18},
        {x:1270,y:390,w:150,h:18},
        {x:1510,y:460,w:340,h:60},
        {x:1735,y:415,w:95,h:18},
        {x:2360,y:390,w:150,h:18},
        {x:2630,y:460,w:280,h:60},
        {x:2800,y:415,w:95,h:18},
        // Переход через пропасть перед ареной: три ступени, по которым можно добраться до пола арены.
        {x:2960,y:420,w:135,h:18},
        {x:3140,y:375,w:135,h:18},
        {x:3315,y:420,w:105,h:18},
        {x:3440,y:460,w:760,h:60}
      ],
      coins: [
        {x:340,y:415},{x:680,y:390},{x:850,y:55},{x:1035,y:95},{x:1215,y:50},
        {x:1400,y:350},{x:1590,y:415},{x:1810,y:380},{x:1945,y:70},{x:2135,y:110},
        {x:2320,y:65},{x:2440,y:350},{x:2720,y:415},{x:3000,y:65},{x:3190,y:105},
        {x:3370,y:60},{x:3600,y:415},{x:3900,y:415}
      ],
      checkpoints: [{x:1540,y:460},{x:2670,y:460}],
      buffs: [
        {x:420,y:415,type:'double'},
        {x:1580,y:415,type:'shield'},
        {x:2730,y:415,type:'magnet'},
        {x:3820,y:415,type:'speed'}
      ],
      enemies: [
        {x:835,y:426,w:28,h:34,vx:0.75,minX:810,maxX:920},
        {x:1550,y:426,w:28,h:34,vx:0.8,minX:1525,maxX:1770},
        {x:1920,y:426,w:30,h:34,vx:-0.7,minX:1895,maxX:2025,type:'hopper'},
        {x:2670,y:426,w:28,h:34,vx:0.75,minX:2645,maxX:2860},
        {x:3010,y:386,w:28,h:34,vx:0.7,minX:2970,maxX:3060}
      ],
      traps: [
        {x:1010,y:450,w:54,h:10,type:'spikes'},
        {x:1770,y:450,w:50,h:10,type:'spikes'},
        {x:2860,y:450,w:50,h:10,type:'spikes'},
        {x:3970,y:450,w:70,h:10,type:'spikes'}
      ],
      // ИЗМЕНЕНИЕ: Убрана зона инверсии в районе пропасти. 
      // Динамические зоны теперь только на арене босса (x=3400..4100)
      gravityZones: [
        {x:780,w:500,dir:-1,label:'ПЕРВЫЙ СДВИГ'},
        {x:1850,w:520,dir:-1,label:'ПОТОЛОЧНЫЙ МАРШРУТ'},
        {x:3520,w:100,dir:-1,label:'СДВИГ А', dynamic:true},
        {x:3880,w:100,dir:-1,label:'СДВИГ Б', dynamic:true}
      ],
      ceilingPlatforms: [
        [800,82,150],[980,122,155],[1165,76,105],
        [1870,92,155],[2055,132,160],[2245,82,105],
        // На арене босса нужна сплошная верхняя платформа, которая ловит игрока при инверсии.
        [3440,82,760]
      ],
      boss: {x:3700,y:280,w:100,h:110,hp:3,vx:1.1,minX:3500,maxX:4000}
    }
  ];

  const state = { mode: 'menu', coins: 0, lives: 3, levelIndex: 0 };
  const upgrades = { jump: 0, speed: 0, hearts: 0, magnet: 0, air: 0 };
  let levelHintT = 0;

  const STORY = [
    { chapter: 'Глава I · Зов леса', title: 'Сигнал из чащи', text: 'На краю тихого леса герой находит мерцающий осколок. Он посылает импульсы в сторону старой башни — будто зовёт на помощь. Чтобы узнать источник сигнала, нужно пройти лесную тропу и собрать рассыпавшиеся искры.', goal: 'Добраться до выхода и собрать искры' },
    { chapter: 'Глава II · Под землёй', title: 'Следы древнего механизма', text: 'Осколок оживает и показывает карту подземных ходов. В пещерах спрятан механизм, который когда-то питал башню. Но проход охраняют прыгучие существа, а старые ловушки всё ещё работают.', goal: 'Преодолеть ловушки и найти механизм' },
    { chapter: 'Глава III · Забытый завод', title: 'Сердце машины', text: 'Механизм запускается, но его энергия уходит в заброшенный завод. Здесь движущиеся пилы и летающие стражи защищают главный источник питания. Герою предстоит восстановить поток энергии, используя найденные улучшения.', goal: 'Добраться до ядра и восстановить питание' },
    { chapter: 'Глава IV · Последний рубеж', title: 'Башня просыпается', text: 'Все части пути сходятся у башни. Осколок раскрывает правду: сигнал был предупреждением — энергия выходит из-под контроля. Враги и ловушки теперь действуют вместе. Пройди последний рубеж и верни башне равновесие.', goal: 'Добраться до вершины и стабилизировать башню' },
    { chapter: 'Глава V · Сердце сигнала', title: 'Страж гравитации', text: 'Внутри ядра проснулся Страж. Используй динамические зоны инверсии на арене, чтобы перевернуться и упасть на него сверху. Зоны появляются и исчезают — лови момент!', goal: 'Победить Стража: 3 удара сверху' }
  ];

  const LEVEL_HINTS = [
    'Освой управление и собери осколки. В синей зоне герой перевернётся — прыгай ↓ / S по голубым опорам.',
    'Секции инверсии стали длиннее. Планируй прыжки заранее и следи за шипами.',
    'Потолочные платформы движутся, а пилы перекрывают маршрут. Выбирай момент для перехода.',
    'Длинные цепочки инверсии сочетают движущиеся опоры и ловушки. Не теряй темп.',
    'Босс летает по центру арены. Зайди в синюю зону, перевернись и упади на него сверху! Зоны двигаются.'
  ];

  const shownEnemyTypes = new Set();
  const shownMechanicTypes = new Set();

  const TIP_LIBRARY = {
    spikes: { icon: '▲', title: 'Новые препятствия', text: 'Шипы опасны при касании. Перепрыгивай их или ищи безопасный участок.' },
    saw: { icon: '!', title: 'ОПАСНОСТЬ: ДВИЖУЩАЯСЯ ПИЛА', text: 'Впереди движущаяся пила! Она перемещается по траектории. Остановись на безопасной платформе, проследи за её движением и прыгай, когда путь свободен.' },
    hopper: { icon: '↟', title: 'Новый враг: прыгун', text: 'Этот враг подпрыгивает. Лучше атаковать сверху или переждать его прыжок.' },
    flyer: { icon: '✦', title: 'Новый враг: летун', text: 'Летун не стоит на земле. Следи за его высотой и не прыгай вслепую.' }
  };

  const buffs = { speed: 0, double: 0, magnet: 0, shield: false };
  const BUFF_DUR = { speed: 12 * 60, double: 15 * 60, magnet: 12 * 60 };

  let level = null;
  let theme = THEMES.forest;
  let clouds = [];
  let motes = [];
  let time = 0;
  let shake = 0;

  const player = {
    x: 0, y: 0, prevX: 0, prevY: 0,
    w: 26, h: 34,
    vx: 0, vy: 0,
    onGround: false, groundPlat: null,
    facing: 1, coyote: 0, jumpBuf: 0, jumping: false,
    invuln: 0, walkPhase: 0, squash: 0, dustTimer: 0, jumpsLeft: 1,
    gravityDir: 1, gravityZone: -1
  };

  const particles = [];
  const bossProjectiles = [];
  let camX = 0, camY = 0;

  const input = { left: false, right: false, up: false, down: false, jump: false };
  let jumpQueued = false;

  document.querySelectorAll('[data-key]').forEach(btn => {
    const k = btn.dataset.key;
    const press   = e => { e.preventDefault(); btn.classList.add('active');    setKey(k, true);  };
    const release = e => { e.preventDefault(); btn.classList.remove('active'); setKey(k, false); };
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
    btn.addEventListener('contextmenu', e => e.preventDefault());
  });

  const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
  const jumpKeys = new Set();
  window.addEventListener('keydown', e => {
    if (e.code === 'Escape' && !e.repeat) {
      if (state.mode === 'dialog') { e.preventDefault(); closeNpcDialog(); return; }
      if (state.mode === 'pause') { e.preventDefault(); resumeGame(); return; }
      if (state.mode === 'play') { e.preventDefault(); pauseGame(); return; }
    }
    if (e.code === 'F8' && !e.repeat) { e.preventDefault(); setAdminFly(!__gravityAdminFly); return; }
    if (e.code === 'F9' && !e.repeat) { e.preventDefault(); toggleAdminPanel(); return; }
    if (state.mode === 'dialog') {
      if (['Enter','Space','KeyE','Escape'].includes(e.code) && !e.repeat) { e.preventDefault(); closeNpcDialog(); }
      return;
    }
    if (__gravityAdminFly && ['ArrowUp','KeyW','ArrowDown','KeyS'].includes(e.code)) {
      e.preventDefault();
      setKey((e.code === 'ArrowUp' || e.code === 'KeyW') ? 'up' : 'down', true);
      return;
    }
    let k = KEYMAP[e.code];
    if (activeJumpCodes().includes(e.code)) {
      e.preventDefault();
      jumpKeys.add(e.code);
      refreshJumpInput();
    } else if (k) { e.preventDefault(); setKey(k, true); }
    if (e.code === 'KeyE' && !e.repeat) interactWithNpc();
  });
  window.addEventListener('keyup', e => {
    if (__gravityAdminFly && ['ArrowUp','KeyW','ArrowDown','KeyS'].includes(e.code)) {
      e.preventDefault();
      setKey((e.code === 'ArrowUp' || e.code === 'KeyW') ? 'up' : 'down', false);
      return;
    }
    const wasJumpKey = jumpKeys.delete(e.code);
    if (wasJumpKey || ['Space','ArrowUp','KeyW','ArrowDown','KeyS'].includes(e.code)) {
      e.preventDefault(); refreshJumpInput();
    }
    const k = KEYMAP[e.code];
    if (k) { e.preventDefault(); setKey(k, false); }
  });

  const baseJumpVel  = () => -11.8 - upgrades.jump * 0.9;
  const currentMaxV  = () => {
    let s = 3.7 + upgrades.speed * 0.30;
    if (buffs.speed > 0) s *= 1.35;
    return s;
  };
  const currentAirMult = () => 1 + upgrades.air * 0.20;
  const magnetRadius = () => {
    let r = 16;
    r += upgrades.magnet * 45;
    if (buffs.magnet > 0) r += 90;
    return r;
  };
  const hasDoubleJump = () => buffs.double > 0;

  /* =========================================================
     АДМИН-ПАНЕЛЬ
     ========================================================= */
  const adminPanel = document.getElementById('admin-panel');
  const adminLevels = document.getElementById('admin-levels');
  const adminClose = document.getElementById('admin-close');
  const adminAddLives = document.getElementById('admin-add-lives');
  let adminOpen = false;
  adminAddLives.addEventListener('click', () => {
    state.lives += 100;
    hudDirty = true;
    updateHUD();
    adminAddLives.textContent = '✓ Добавлено 100 жизней';
    setTimeout(() => { adminAddLives.textContent = '＋ Добавить 100 жизней'; }, 1200);
  });

  adminClose.addEventListener('click', toggleAdminPanel);

  /* =========================================================
     ЗАГРУЗКА УРОВНЯ
     ========================================================= */
  // Ограничиваем количество частиц для FPS
  const MAX_PARTICLES = 300;
  let __gravityAdminFly = false;
  const adminStatus = document.getElementById('admin-status');
  let adminToastTimer = 0;
  window.gameAdmin = {
    on() { setAdminFly(true); console.info('Admin fly ON. Press F8 or gameAdmin.off() to exit.'); },
    off() { setAdminFly(false); console.info('Admin fly OFF.'); },
    next() { if (state.levelIndex < LEVELS.length - 1) { state.levelIndex++; loadLevel(state.levelIndex); console.info('Level ' + (state.levelIndex + 1)); } },
    level(n) { const i = Math.max(0, Math.min(LEVELS.length - 1, Number(n) - 1)); state.levelIndex = i; loadLevel(i); console.info('Level ' + (i + 1)); }
  };

  const gameTip = document.getElementById('game-tip');
  const tipIcon = document.getElementById('tip-icon');
  const tipTitle = document.getElementById('tip-title');
  const tipText = document.getElementById('tip-text');
  const tipClose = document.getElementById('tip-close');
  let tipHideT = 0;

  tipClose.addEventListener('click', hideGameTip);

  const NPC_DIALOGUES = [
    { title: 'Лесной хранитель', portrait: '◇', text: '«Осколок проснулся впервые за сотни лет. Он ведёт к старому механизму под землёй. Собирай искры — они помогут усилить твои способности».', icon: '◇' },
    { title: 'Шахтёр-исследователь', portrait: '◇', text: '«Эти пещеры были частью энергосети башни. Прыгуны охраняют тоннели, а шипы — старые защитные механизмы. Не торопись и следи за поверхностью под ногами».', icon: '◇' },
    { title: 'Механик', portrait: '◇', text: '«Ядро завода ещё работает, но энергия нестабильна. Пилы питаются от старых приводов, а летуны реагируют на всплески энергии. Выбирай момент для прыжка и используй магнит для сбора искр».', icon: '◇' },
    { title: 'Страж башни', portrait: '◇', text: '«Ты добрался до источника сигнала. Башня не звала на помощь — она предупреждала об аварии. Осколок сможет стабилизировать ядро, если ты пройдёшь последний рубеж».', icon: '✧' },
    { title: 'Голос ядра', portrait: '◈', text: '«Страж неуязвим сбоку. Используй инверсию гравитации на арене, чтобы оказаться над ним и нанести урон! Прыгай на него сверху или упади с потолка, когда он под тобой. Уворачивайся от его снарядов!»', icon: '◈' }
  ];

  const dialogLayer = document.getElementById('dialog-layer');
  const dialogName = document.getElementById('dialog-name');
  const dialogText = document.getElementById('dialog-text');
  const dialogPortrait = document.getElementById('dialog-portrait');
  const dialogNext = document.getElementById('dialog-next');
  let dialogReturnMode = 'play';

  dialogNext.addEventListener('click', closeNpcDialog);
  dialogLayer.addEventListener('pointerdown', e => { if (e.target === dialogLayer) closeNpcDialog(); });

  const hudCoins = document.getElementById('hud-coins');
  const hudLives = document.getElementById('hud-lives');
  const hudLevel = document.getElementById('hud-level');
  const hudLocIcon = document.getElementById('hud-loc-icon');
  const hudProgress = document.getElementById('hud-progress');

  const perkEls = {
    speed:  document.querySelector('[data-perk="speed"]'),
    double: document.querySelector('[data-perk="double"]'),
    magnet: document.querySelector('[data-perk="magnet"]'),
    shield: document.querySelector('[data-perk="shield"]')
  };

  let hudDirty = true;

  const overlay = document.getElementById('overlay');
  const ovTitle = document.getElementById('ov-title');
  const ovText  = document.getElementById('ov-text');
  const ovBtn   = document.getElementById('ov-btn');
  const ovShop  = document.getElementById('ov-shop');
  let overlayAction = null;

  const pauseMenu = document.getElementById('pause-menu');
  const pauseResume = document.getElementById('pause-resume');
  const pauseRestart = document.getElementById('pause-restart');

  pauseResume.addEventListener('click', resumeGame);
  pauseRestart.addEventListener('click', restartCurrentLevel);

  ovBtn.addEventListener('click', () => {
    const a = overlayAction;
    hideOverlay();
    if (a) a();
  });

  const STEP = 1000 / 60;
  let lastT = 0, acc = 0;

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) { lastT = 0; acc = 0; }
  });

  resize();
  loadLevel(0);
  state.mode = 'menu';
  updateHUD();

  showMessage(
    'Платформер',
    'Собирай осколки, ищи контрольные узлы и усиления.<br>Между уровнями — магазин улучшений!',
    'Играть',
    startGame
  );

  requestAnimationFrame(frame);
