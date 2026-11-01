// Game.js - بطل واحد ضد الأعداء + زعيم + بوابة النهاية
(function(){
'use strict';

const $ = (s, r) => (r || document).querySelector(s);
const cv = $('#cv'), ctx = cv.getContext('2d');
const frame = $('#frame');

const BG_IMG = 'images/background-stage1.png';   // غيّر الرقم (stage1..stage4) لتغيير خلفية المرحلة

// طبقة الخلفية (عنصر HTML حتى يتحرك الـ GIF) + طبقة الشخصيات (عناصر img متحركة)
const bgDiv = document.createElement('div');
bgDiv.style.cssText = 'position:absolute;inset:0;z-index:0;pointer-events:none;background:#2a1850 url(' + BG_IMG + ') no-repeat 0 0;background-size:auto 100%';
frame.insertBefore(bgDiv, cv);
cv.style.position = 'relative';
const layer = document.createElement('div');
layer.style.cssText = 'position:absolute;inset:0;z-index:0;overflow:hidden;pointer-events:none';
frame.insertBefore(layer, $('#hud'));

let WORLD = 6400;                 // يُضبط تلقائيًا ليساوي عرض الخلفية
const H = 400, Y0 = 252, Y1 = 372;
let VW = 800, SC = 1, CS = 1;
const START = 130;
const ARENA = 760;                // عرض ساحة الزعيم قبل البوابة
const ROAD = () => WORLD - START - ARENA - 100;

const HERO_VIS = 84;
// أقصى عمق للشخصيات: القدمان تنزلان حتى يصير نصف الجسم تحت حافة الشاشة (غيّر القسمة لتغيير ذلك)
const YB = H + HERO_VIS / 2;


const HERO_SCALE = [1, 1, 1, 1];


const ENEMY_VIS = { thug: 80, brute: 100, brute3: 104, soldier: 82, ninja: 78, cop: 80, raptor: 62, trike: 64, boss: 108 };

const PROP_VIS = { crate: 38, barrel: 42 };
// ok = الصورة السليمة، br = صورة التحطم (تظهر مكانه ثم تختفي بعد WRECK_TIME ثانية)
const CRATE_SETS = [{ ok: 'box1', br: 'box1-broken' }];
const BARREL_SETS = [{ ok: 'box2', br: 'box2-broken' }, { ok: 'box3', br: 'box3-broken' }, { ok: 'box4', br: 'box4-broken' }];
const WRECK_TIME = 3;

const rr = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const SAVE_KEY = 'treasureRoadSave';
function loadSave() {
  let d = {};
  try { d = JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch (e) {}
  return { coins: typeof d.coins === 'number' ? d.coins : 1000, owned: d.owned || {}, inv: d.inv || {}, side: d.side | 0, diff: typeof d.diff === 'number' ? d.diff : 1 };
}
function writeSave(S) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) {} }
let gameConfig = { side: 0, diff: 1 };
try { const s = localStorage.getItem('gameConfig'); if (s) gameConfig = JSON.parse(s); } catch (e) {}
if (!(gameConfig.side >= 0 && gameConfig.side < 4)) gameConfig.side = 0;

// ==========================================
// IMAGE LOADING (GIF)
// ==========================================
const hiddenAssets = document.createElement('div');
hiddenAssets.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;overflow:hidden;opacity:.01;pointer-events:none;z-index:-1';
document.body.appendChild(hiddenAssets);

function loadImg(src) {
    const img = document.createElement('img');
    img.src = src;
    hiddenAssets.appendChild(img);
    return img;
}

const IMG = {
    bg: loadImg(BG_IMG),
    gate: loadImg('images/endpoint.gif'),
    explosion: loadImg('images/explosion.gif'),
    crates: CRATE_SETS.map(o => ({ ok: loadImg(`images/${o.ok}.gif`), br: loadImg(`images/${o.br}.gif`) })),
    barrels: BARREL_SETS.map(o => ({ ok: loadImg(`images/${o.ok}.gif`), br: loadImg(`images/${o.br}.gif`) })),
    use: {
        fist: loadImg('images/btn-boxing.png'), knife: loadImg('images/btn-knef.png'),
        pistol: loadImg('images/btn-Pistol.png'), shotgun: loadImg('images/btn-Rifle.png'), smg: loadImg('images/btn-machinegun.png')
    },
    item_fist: loadImg('images/btn-boxing.png'),
    item_health: loadImg('images/heart.png'),
    item_pistol: loadImg('images/Pistol-gun.png'),
    item_smg: loadImg('images/machine-gun.png'),
    item_shotgun: loadImg('images/Rifle-gun.png'),
    item_knife: loadImg('images/knef.png'),
    item_shuriken: loadImg('images/knef.png'),   // سكين الطريق (الأرض)
    item_ammo: loadImg('images/bullets.png'),
    item_bomb: loadImg('images/bomb.png'),
    item_mine: loadImg('images/Landmine.gif'),   // اللغم الأرضي
    enemies: {}
};

// ملفات الإطلاق الموجودة فعلاً لكل بطل (حتى لا تظهر أخطاء 404): player1h فيه _Pistol/_machinegun/_Rifle، والبقية فيهم _shoot/_shoot1/_shoot2
const SHOOT_FILES = [
    { pistol: '_Pistol', smg: '_machinegun', shotgun: '_Rifle' },
    { pistol: '_shoot',  smg: '_shoot2',     shotgun: '_shoot1' },
    { pistol: '_shoot',  smg: '_shoot2',     shotgun: '_shoot1' },
    { pistol: '_shoot',  smg: '_shoot2',     shotgun: '_shoot1' }
];
const PLAYER_SUFFIX = {
    idle: '', walk: '_walk', gun: '_gun', punch: '_punch',
    sword: '_sword', injured: '_injured', death: '_death', bomb: '_bomb',
    loot: '_loot', victory: '_victory'
};
function loadPlayerSprites(base, obj, idx) {
    for (const k in PLAYER_SUFFIX) obj[k] = loadImg(`images/${base}${PLAYER_SUFFIX[k]}.gif`);
    const sf = SHOOT_FILES[idx];
    for (const k in sf) obj[k] = loadImg(`images/${base}${sf[k]}.gif`);
}
// الأبطال الأربعة: نفس أسماء الملفات ونفس الكود لكل بطل (player1h ... player4h)
// الحركات: player1h.gif / _walk / _punch / _sword / _gun / _Pistol / _machinegun / _Rifle / _shoot* (قديم) / _bomb / _injured / _death / _loot / _victory
const HEROES = [
  { id: 'player1h', name: 'JACK' },
  { id: 'player2h', name: 'REX' },
  { id: 'player3h', name: 'MINA' },
  { id: 'player4h', name: 'MAX' }
];
IMG.heroes = HEROES.map((h, i) => { const o = {}; loadPlayerSprites(h.id, o, i); return o; });
// الرهائن (الأبطال وهم مربوطون): player1h-shok / player2h--gameover / player3h-gameover / player4h--gameover
const HOSTAGE_FILES = [
  ['player1h-shok', 'player1h-gameover'],
  ['player2h--gameover', 'player2h-gameover', 'player2h-shok'],
  ['player3h-gameover', 'player3h--gameover', 'player3h-shok'],
  ['player4h--gameover', 'player4h-gameover', 'player4h-shok']
];
IMG.hostage = HOSTAGE_FILES.map(list => {
  let i = 0;
  const img = loadImg(`images/${list[0]}.gif`);
  img.addEventListener('error', () => { if (++i < list.length) img.src = `images/${list[i]}.gif`; });   // يجرّب الاسم التالي إن لم يوجد الملف
  return img;
});

// الأعداء: enemyN.gif / enemyN_walk / enemyN_punch / enemyN_injured / enemyN_death
function loadEnemySprites(n) {
    return {
        idle:    loadImg(`images/enemy${n}.gif`),
        walk:    loadImg(`images/enemy${n}_walk.gif`),
        punch:   loadImg(`images/enemy${n}_punch.gif`),
        injured: loadImg(`images/enemy${n}_injured.gif`),
        death:   loadImg(`images/enemy${n}_death.gif`)
    };
}
IMG.enemies['thug']    = loadEnemySprites(1);
IMG.enemies['brute']   = loadEnemySprites(2);
IMG.enemies['brute3']  = loadEnemySprites(3);
IMG.enemies['soldier'] = loadEnemySprites(4);
IMG.enemies['ninja']   = loadEnemySprites(5);
IMG.enemies['cop']     = loadEnemySprites(6);
IMG.enemies['raptor']  = loadEnemySprites(7);
IMG.enemies['trike']   = loadEnemySprites(8);
IMG.enemies['boss']    = loadEnemySprites(9);   // الزعيم

const GATE = {};
function fitWorld() {
    const b = IMG.bg;
    if (b.naturalWidth && b.naturalHeight) WORLD = Math.round(b.naturalWidth * H / b.naturalHeight);
}
fitWorld();
IMG.bg.addEventListener('load', fitWorld);

// ==========================================
// SOUND MANAGEMENT
// ==========================================
const SND = {
    shoot: new Audio('sounds/shoot.mp3'),
    hit: new Audio('sounds/enemy_hit.mp3'),
    swing: new Audio('sounds/knife.mp3'),
    boom: new Audio('sounds/booom.mp3'),
    jump: new Audio('sounds/run.mp3'),
    pick: new Audio('sounds/powerup_collect.mp3'),
    win: new Audio('sounds/win_music.mp3'),
    lose: new Audio('sounds/lose_music.mp3'),
    bgm: new Audio('sounds/background_music.mp3'),
    box_destroy: new Audio('sounds/box_destroy.mp3'),
    health_refill: new Audio('sounds/health_refill.mp3'),
    warning: new Audio('sounds/time_warning.mp3')   // تنبيه آخر 10 ثوانٍ
};
SND.bgm.loop = true;
SND.warning.loop = true;   // يتكرر حتى ينتهي الوقت
let muted = false;

function playSnd(s) {
    if (muted) return;
    try { s.currentTime = 0; s.play().catch(()=>{}); } catch(e) {}
}

// تنبيه الوقت: يعمل عندما يتبقى 10 ثوانٍ أو أقل ويتكرر حتى ينتهي الوقت
function updateTimeWarning() {
    const w = SND.warning;
    const on = G.phase === 'play' && !G.paused && !muted && me && !me.dead && G.timeLeft > 0 && G.timeLeft <= 10;
    if (on) {
        if (w.paused) w.play().catch(() => {});
    } else {
        if (!w.paused) w.pause();
        if (!(G.timeLeft > 0 && G.timeLeft <= 10)) w.currentTime = 0;   // يبدأ من أول الصوت في المرة القادمة
    }
}

// ==========================================
// GAME CONSTANTS
// ==========================================
const WEAPONS = {
  fist: { name: 'Fists', type: 'melee', dm: 12, reach: 46, dur: .24, a0: .06, a1: .18, cd: .25, maxAmmo: Infinity },
  knife: { name: 'Knife', type: 'melee', dm: 16, reach: 50, dur: .24, a0: .06, a1: .18, cd: .25, maxAmmo: Infinity },
  pistol: { name: 'Pistol', type: 'gun', dm: 18, reach: 340, cd: .32, maxAmmo: 24, speed: 900, spread: .02, shots: 1, color: '#ffe58a' },
  smg: { name: 'SMG', type: 'gun', dm: 7, reach: 300, cd: .09, maxAmmo: 60, speed: 850, spread: .07, shots: 1, color: '#ffd34d' },
  shotgun: { name: 'Shotgun', type: 'gun', dm: 10, reach: 220, cd: .7, maxAmmo: 12, speed: 780, spread: .18, shots: 5, color: '#ffb347' }
};
const LEVEL_TIME = 120;   // مدة العد التنازلي بالثواني
const BOMB = { dm: 50, radius: 120, fuse: 1.5, vx: 280, vz: 340 };
const MINE = { dm: 60, radius: 130, armTime: .5, trigger: 38 };
// ---- الرهائن: 3 أبطال سابقين مربوطين. الأولى عند 3000 بيكسل من البداية والمسافة بين كل رهينة والتي بعدها 3000 ----
const HOSTAGE_FIRST = 5000, HOSTAGE_GAP = 5000, HOSTAGE_COUNT = 3;
const HOSTAGE_ROPE_HP = 36;      // قوة الحبل: ضرب الحبل حتى ينقطع
const HOSTAGE_VIS = 88;          // ارتفاع الرهينة المربوطة على الشاشة
// الحلفاء ضعفاء وأغبياء: صحة قليلة، ضرر ضعيف، بطيئون، يخطئون الضرب، يشردون أحياناً، ويرون العدو من مسافة قصيرة فقط
const ALLY = { hp: 100, hits: 20,   // يموت بعد 20 ضربة من الأعداء (كل ضربة = 1/20 من الشريط، والانفجار = 5 ضربات)
               ALLY_PLACEHOLDER: 0, spd: 105, reach: 42, dm: 5, dmKd: 8, cd: 1.15, aggro: 170, follow: 95,         // المسافة التي يقف عندها بجانب البطل
               leash: 210,        // إذا ابتعد عن البطل أكثر من هذا يترك القتال ويلحق به
               catchUp: 290,      // سرعته عند اللحاق (أسرع بكثير من البطل 175 حتى لا يتأخر)
               miss: .4,          // احتمال أن تذهب الضربة في الهواء
               think: .9,         // كل كم ثانية يعيد اختيار هدفه (رد فعل بطيء)
               daze: .12,         // احتمال أن يشرد ويقف بلا حراك عند كل تفكير
               dazeTime: 1.1,
               dmgTaken: 1.7 };   // الأعداء أقوى منه: ضررهم عليه مضاعف تقريباً
const GUN_Z = 68;   // ارتفاع خروج الرصاصة عن الأرض (مستوى الصدر)
const WEAPON_ORDER = ['fist', 'knife', 'pistol', 'smg', 'shotgun'];
const DROP_KINDS = ['ammo', 'pistol', 'smg', 'shotgun', 'health', 'bomb'];
const CRATE_CONTENTS = ['ammo', 'pistol', 'smg', 'shotgun', 'health', 'bomb'];

// rad = نصف عرض الإصابة، sh = عرض الظل، drop = احتمال إسقاط غنيمة
const ET = {
  thug:    { hp: 30,  spd: 62,  reach: 44, dmg: 8,  wind: .45, sc: 1,   kd: false, rad: 14, sh: 20, drop: .4 },
  brute:   { hp: 70,  spd: 46,  reach: 56, dmg: 15, wind: .7,  sc: 1.3, kd: true,  rad: 20, sh: 24, drop: .9 },
  brute3:  { hp: 85,  spd: 44,  reach: 60, dmg: 16, wind: .7,  sc: 1.3, kd: true,  rad: 20, sh: 25, drop: .9 },
  soldier: { hp: 36,  spd: 68,  reach: 46, dmg: 9,  wind: .4,  sc: 1,   kd: false, rad: 14, sh: 20, drop: .5 },
  ninja:   { hp: 24,  spd: 108, reach: 40, dmg: 8,  wind: .22, sc: 1,   kd: false, rad: 13, sh: 18, drop: .4 },
  cop:     { hp: 42,  spd: 60,  reach: 46, dmg: 10, wind: .45, sc: 1,   kd: false, rad: 14, sh: 20, drop: .5 },
  raptor:  { hp: 18,  spd: 118, reach: 38, dmg: 7,  wind: .22, sc: 1,   kd: false, rad: 14, sh: 20, drop: .4 },
  trike:   { hp: 50,  spd: 88,  reach: 46, dmg: 11, wind: .35, sc: 1,   kd: true,  rad: 16, sh: 24, drop: .6 },
boss:    { hp: 420, spd: 85,  reach: 62, dmg: 18, wind: .5,  sc: 1.15, kd: true,  rad: 22, sh: 28, drop: 0 }
};

// كل 1000 بيكسل يظهر طاقم أعداء مختلف (يزداد العدد والقوة مع التقدم)
const SEG_DIST = 1000;
const ENEMY_PACKS = [
  // المستوى 0
  [['thug', 'thug', 'soldier', 'thug'], ['thug', 'ninja', 'thug', 'soldier'], ['raptor', 'raptor', 'thug', 'thug']],
  // المستوى 1
  [['soldier', 'ninja', 'cop', 'thug', 'thug'], ['raptor', 'raptor', 'trike', 'thug', 'soldier'], ['cop', 'cop', 'ninja', 'thug', 'soldier']],
  // المستوى 2
  [['trike', 'raptor', 'cop', 'ninja', 'soldier', 'thug'], ['brute', 'thug', 'thug', 'soldier', 'ninja'], ['cop', 'soldier', 'ninja', 'raptor', 'raptor', 'trike']],
  // المستوى 3
  [['brute', 'brute3', 'ninja', 'soldier', 'cop', 'thug'], ['brute3', 'trike', 'trike', 'ninja', 'raptor', 'cop', 'soldier'], ['brute', 'brute3', 'soldier', 'ninja', 'raptor', 'raptor', 'cop']]
];
let packPlan = [];
function pickDifferent(n, prev) {
  let i; do { i = Math.floor(Math.random() * n); } while (n > 1 && i === prev);
  return i;
}
function makeEnemyPlan() {
  packPlan = [];
  const count = Math.max(1, Math.floor(ROAD() / SEG_DIST));
  let prev = -1;
  for (let i = 0; i < count; i++) {
    const tier = ENEMY_PACKS[Math.min(i, ENEMY_PACKS.length - 1)];
    const idx = pickDifferent(tier.length, i >= ENEMY_PACKS.length ? prev : -1);
    prev = idx;
    packPlan.push(tier[idx]);
  }
}

const DIFF = [
  { spd: .82, dmg: .8, cd: 1.3 },
  { spd: 1, dmg: 1, cd: 1 },
  { spd: 1.25, dmg: 1.25, cd: .72 }
];

const G = {
  phase: 'menu', side: gameConfig.side, diff: gameConfig.diff,
  time: 0, kills: 0, dmgDealt: 0, countT: 0, overT: 0, result: null,
  bossDead: false, bossIntro: false, t: 0
};

let me = null;
let allies = [], hostages = [];
let enemies = [], items = [], parts = [], floaters = [], bullets = [], bombs = [], mines = [], crates = [], barrels = [], explosions = [];
let cam = 0, shake = 0, waveIdx = 0, lastCount = -1;
const inp = { l: false, r: false, u: false, d: false, atk: false, jmp: false, sw: false, bomb: false, mine: false };
let padX = 0, padY = 0;

// ==========================================
// HERO & COMBAT
// ==========================================
function mkHero(side) {
  const w = { fist: Infinity, knife: Infinity, pistol: 0, smg: 0, shotgun: 0 };
  return {
    side: side, x: START, y: 312, z: 0, vz: 0, vx: 0,
    face: 1, hp: 100, lives: 3, st: 'i', stT: 0, ph: 0, mv: false,
    atkT: -1, atkType: 0, combo: 0, comboT: 0, ak: 0, ah: false, inv: 0,
    dead: false, respT: 0, throwT: -1,
    weapon: 'fist', weapons: w,
    bombs: 1, mines: 0,
    gunCd: 0, switchT: 0, hitEnemies: null,
    hk: 0, tk: 0, lk: 0, lootT: 0
  };
}

function prog(f) { return f.x - START; }
function inReach(ax, ay, az, af, reach, bx, by, bz, rad) {
  const dx = (bx - ax) * af;
  return dx > -12 && dx < reach + (rad || 14) && Math.abs(by - ay) <= 22 && Math.abs(bz - az) <= 46;
}
function getWeapon(f) { return WEAPONS[f.weapon] || WEAPONS.fist; }

// العدو "حيّ" فقط إذا لم يمت ولم يبدأ الموت.
// كل فحص تصادم (رصاص، ضرب قريب، انفجار، لغم، تزاحم) يمر من هذه الدالة،
// فالعدو الميت لا يتفاعل مع أي سلاح يستعمله اللاعب.
function alive(e) { return !e.dying && e.st !== 'dead' && e.hp > 0; }

function sparks(x, y, z, color) {
  for (let i = 0; i < 9; i++) {
    const a = rr(0, 6.28), s = rr(60, 180);
    parts.push({ x: x, y: y, z: z, vx: Math.cos(a) * s, vz: Math.sin(a) * s + 40, l: rr(.2, .38), c: color || (i % 2 ? '#ffe58a' : '#fff') });
  }
  shake = Math.min(6, shake + 2.2);
}
function floatText(x, y, text, color) { floaters.push({ x: x, y: y, t: 0, text: text, c: color }); }

// ---- توزيعات مختلفة: x = المسافة داخل المقطع، l = رقم المسار، v = شكل البرميل، c = محتوى الصندوق، k = نوع السلاح ----
const BARREL_DIST = 2000, CRATE_DIST = 3000;
const BARREL_LAYOUTS = [
  [{ x: 300, l: 1, v: 0 }, { x: 900, l: 3, v: 1 }, { x: 1500, l: 0, v: 2 }],
  [{ x: 400, l: 2, v: 2 }, { x: 1000, l: 0, v: 0 }, { x: 1650, l: 3, v: 1 }],
  [{ x: 600, l: 1, v: 1 }, { x: 650, l: 2, v: 0 }, { x: 1500, l: 3, v: 2 }],
  [{ x: 250, l: 3, v: 2 }, { x: 1100, l: 1, v: 1 }, { x: 1800, l: 0, v: 0 }]
];
const CRATE_LAYOUTS = [
  [{ x: 500, l: 0, c: 'pistol' }, { x: 1400, l: 2, c: 'health' }, { x: 2300, l: 3, c: 'smg' }],
  [{ x: 700, l: 3, c: 'ammo' }, { x: 1500, l: 1, c: 'bomb' }, { x: 2500, l: 0, c: 'shotgun' }],
  [{ x: 400, l: 2, c: 'health' }, { x: 1250, l: 0, c: 'shotgun' }, { x: 2100, l: 3, c: 'pistol' }]
];
const ITEM_LAYOUTS = [
  [{ x: 1000, l: 2, k: 'knife' }, { x: 2000, l: 0, k: 'smg' }],
  [{ x: 800, l: 0, k: 'pistol' }, { x: 2200, l: 3, k: 'health' }],
  [{ x: 1300, l: 3, k: 'shotgun' }, { x: 2600, l: 1, k: 'knife' }]
];

function spawnWorldObjects() {
  crates = []; barrels = [];
  const lanes = [Y0 + 20, Y0 + 55, Y0 + 90, Y1 - 15];

  // براميل: كل 2000 بيكسل توزيع مختلف عن السابق
  let prev = -1;
  for (let base = 0; base < WORLD - 300; base += BARREL_DIST) {
    prev = pickDifferent(BARREL_LAYOUTS.length, prev);
    for (const o of BARREL_LAYOUTS[prev]) {
      const x = base + o.x;
      if (x < WORLD - 300) barrels.push({ v: o.v, x: x, y: lanes[o.l], hp: 100, exploded: false });
    }
  }
  // صناديق: كل 3000 بيكسل توزيع مختلف
  prev = -1;
  for (let base = 0; base < WORLD - 400; base += CRATE_DIST) {
    prev = pickDifferent(CRATE_LAYOUTS.length, prev);
    for (const o of CRATE_LAYOUTS[prev]) {
      const x = base + o.x;
      if (x < WORLD - 400) crates.push({ v: 0, x: x, y: lanes[o.l], hp: 40, max: 40, content: o.c, broken: false, w: 26, h: 26 });
    }
  }
  // أسلحة على الأرض: كل 3000 بيكسل ترتيب مختلف
  prev = -1;
  for (let base = 0; base < WORLD - 400; base += CRATE_DIST) {
    prev = pickDifferent(ITEM_LAYOUTS.length, prev);
    for (const o of ITEM_LAYOUTS[prev]) {
      const x = base + o.x;
      if (x < WORLD - 400) items.push({ x: x, y: lanes[o.l], t: 0, kind: o.k });
    }
  }

  // فصل الصناديق عن البراميل: لا يجتمعان في نقطة واحدة ولا يتداخلان (أقل مسافة أفقية GAP)
  const GAP = 130;
  const clear = (x, self) => {
    for (const b of barrels) if (Math.abs(b.x - x) < GAP) return false;
    for (const c of crates) if (c !== self && Math.abs(c.x - x) < GAP) return false;
    return true;
  };
  for (const c of crates) {
    if (clear(c.x, c)) continue;
    for (let step = 20; step <= 700; step += 20) {
      let moved = false;
      for (const dir of [1, -1]) {
        const nx = c.x + dir * step;
        if (nx > 200 && nx < WORLD - 400 && clear(nx, c)) { c.x = nx; moved = true; break; }
      }
      if (moved) break;
    }
  }
  // الأسلحة على الأرض أيضًا بعيدة عن البراميل والصناديق
  for (const it of items) {
    const near = x => barrels.some(b => Math.abs(b.x - x) < 80) || crates.some(c => Math.abs(c.x - x) < 80);
    if (!near(it.x)) continue;
    for (let step = 20; step <= 600; step += 20) {
      let moved = false;
      for (const dir of [1, -1]) {
        const nx = it.x + dir * step;
        if (nx > 200 && nx < WORLD - 400 && !near(nx)) { it.x = nx; moved = true; break; }
      }
      if (moved) break;
    }
  }
}

function hurtMe(dmg, dir, kd, fromExplosion) {
  const m = me;
  if (!m || m.inv > 0 || m.dead || G.phase !== 'play') return false;
  if (G.armor) dmg = Math.max(1, Math.round(dmg * 0.8));   // درع من المتجر
  m.hp -= dmg; m.inv = .35;
  m.hk = (m.hk || 0) + 1;
  playSnd(SND.hit); sparks(m.x, m.y, m.z + 34);
  m.atkT = -1; m.ah = false; m.throwT = -1;

  if (m.hp <= 0) {
    m.hp = 0; m.dead = true; m.lives--;
    m.st = 'd'; m.stT = 0; m.vx = dir * 240; m.vz = 220; m.respT = 2.3;
  } else if (kd || m.z > 0 || fromExplosion) {
    m.st = 'd'; m.stT = 0; m.vx = dir * 220; m.vz = 210;
  } else {
    m.st = 'h'; m.stT = 0; m.vx = dir * 90;
  }
  return true;
}

function hurtEnemy(e, dmg, dir, kd) {
  if (!alive(e)) return;   // العدو الميت (أو المحتضر) لا يتأثر بأي سلاح
  // الزعيم: مدرّع لا يترنح، يموت فتُفتح البوابة
  if (e.k === 'boss') {
    e.hp -= dmg; e.hk++;
    playSnd(SND.hit); sparks(e.x, e.y, 60);
    if (e.hp <= 0) {
      e.hp = 0; e.dying = true; e.st = 'dead'; e.t = 0; G.kills++; G.bossDead = true; shake = 12;
      toast('GATE OPEN! Run!', 3000);
    }
    return;
  }
  e.hp -= dmg;
  e.hk = (e.hk || 0) + 1;
  playSnd(SND.hit); sparks(e.x, e.y, 34 * ET[e.k].sc);
  e.did = false;
  if (e.hp <= 0) {
    e.dying = true;   // من هذه اللحظة لا يتفاعل مع أي شيء
    G.kills++;
    const dropRoll = Math.random();
    if (dropRoll < (ET[e.k].drop || .4)) {
      let kind = 'ammo';
      if (Math.random() < .3) kind = 'health';
      else if (Math.random() < .3) kind = 'bomb';
      else if (Math.random() < .3) kind = 'pistol';
      items.push({ x: e.x, y: e.y, t: 0, kind: kind });
    }
    e.st = 'down'; e.t = 0; e.vx = dir * 260;
  } else if (kd) {
    e.st = 'down'; e.t = 0; e.vx = dir * 250;
  } else {
    e.st = 'hurt'; e.t = 0; e.vx = dir * 80;
  }
}

function createExplosion(x, y, z, radius, dm, owner) {
  explosions.push({ x: x, y: y, z: z, t: 0, dur: .55, maxR: radius });
  playSnd(SND.boom); shake = Math.min(14, shake + 8);
  for (let i = 0; i < 24; i++) {
    const a = rr(0, 6.28), sp = rr(80, 280);
    parts.push({ x: x, y: y, z: z, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp + 60, l: rr(.4, .9), c: i % 3 === 0 ? '#ffe58a' : (i % 3 === 1 ? '#ffb347' : '#ff6f4e') });
  }
  if (me && !me.dead && me.st !== 'd') {
    const dx = me.x - x, dy = me.y - y, dist = Math.hypot(dx, dy);
    if (dist < radius) hurtMe(Math.round(dm * (1 - dist / radius)), (dx > 0 ? 1 : -1), true, true);
  }
  if (owner !== 'boss') {          // قنابل الزعيم لا تؤذي أعوانه ولا نفسه
    for (const e of enemies) {
      if (!alive(e)) continue;
      const dx = e.x - x, dy = e.y - y, dist = Math.hypot(dx, dy);
      if (dist < radius) hurtEnemy(e, Math.round(dm * (1 - dist / radius)), (dx > 0 ? 1 : -1), true);
    }
  }
  if (owner !== 'boss') {          // الانفجار يقطع حبال الرهائن
    for (const h of hostages.slice()) if (Math.hypot(h.x - x, h.y - y) < radius) hitHostage(h, h.max);
  }
  if (owner !== 'me') {            // قنابل اللاعب لا تؤذي حلفاءه، أما انفجار البراميل وقنابل الزعيم فتؤذيهم
    for (const a of allies) {
      if (a.dead) continue;
      const dx = a.x - x, dy = a.y - y, dist = Math.hypot(dx, dy);
      if (dist < radius) hurtAlly(a, 0, (dx > 0 ? 1 : -1), true, 5);
    }
  }
  for (const b of barrels) {
    if (b.exploded) continue;
    if (Math.hypot(b.x - x, b.y - y) < radius * .95) { b.hp = 0; setTimeout(() => explodeBarrel(b), 50 + Math.random() * 80); }
  }
  for (const c of crates) {
    if (c.broken) continue;
    if (Math.hypot(c.x - x, c.y - y) < radius * .9) breakCrate(c);
  }
}

function explodeBarrel(b) {
  if (b.exploded) return;
  b.exploded = true; b.wreckT = WRECK_TIME;
  createExplosion(b.x, b.y, 10, 130, 55, 'barrel');
}

function breakCrate(c) {
  if (c.broken) return;
  c.broken = true; c.wreckT = WRECK_TIME;
  playSnd(SND.box_destroy); shake = Math.min(6, shake + 2);
  for (let i = 0; i < 10; i++) parts.push({ x: c.x, y: c.y, z: 10, vx: rr(-90, 90), vz: rr(60, 180), l: rr(.3, .7), c: '#8a5a2a' });
  items.push({ x: c.x, y: c.y, t: 0, kind: c.content });
}

function startMelee(f) {
  f.combo = f.comboT > 0 ? (f.combo + 1) % 3 : 0;
  f.comboT = .6; f.st = 'a'; f.atkT = 0; f.ak++; f.ah = false;
  f.atkType = f.combo === 2 ? 1 : 0; f.hitEnemies = new Set();
  playSnd(SND.swing);
}
function startMeleeAir(f) {
  f.atkT = 0; f.ak++; f.atkType = 2; f.ah = false;
  f.hitEnemies = new Set();
  playSnd(SND.swing);
}
function fireGun(f) {
  const W = getWeapon(f);
  if (W.type !== 'gun') return;
  if (f.weapons[f.weapon] <= 0) { f.weapon = 'knife'; return; }
  if (f.gunCd > 0) return;
  f.weapons[f.weapon]--; f.gunCd = W.cd;
  f.ak++; f.atkT = 0; f.atkType = 0; f.st = 'a'; f.ah = false;
  playSnd(SND.shoot);
  for (let s = 0; s < W.shots; s++) {
    const spread = (Math.random() - .5) * W.spread;
    bullets.push({
      x: f.x + f.face * 14, y: f.y, z: f.z + GUN_Z,
      vx: f.face * W.speed, vy: Math.sin(spread) * W.speed * .3, vz: Math.sin(spread) * 40,
      dm: W.dm, owner: 'me', color: W.color, life: .8, t: 0
    });
  }
}
function throwBomb(f) {
  if (f.bombs <= 0) return;
  f.bombs--;
  f.tk = (f.tk || 0) + 1;
  f.throwT = 0.3;
  bombs.push({ x: f.x + f.face * 16, y: f.y, z: f.z + 40, vx: f.face * BOMB.vx, vz: BOMB.vz, t: 0, fuse: BOMB.fuse, owner: 'me', dm: BOMB.dm, radius: BOMB.radius, settled: false });
}
function placeMine(f) {
  if (f.mines <= 0) return;
  f.mines--;
  f.mineT = 0.25; f.lk = (f.lk || 0) + 1;   // صورة _loot لمدة ثانية بعد وضع اللغم (lk يعيد تشغيل الـ GIF)
  mines.push({ x: f.x, y: f.y, t: 0, armed: false, armT: MINE.armTime, owner: 'me', dm: MINE.dm, radius: MINE.radius, gone: false });
}
function switchWeapon(f) {
  if (f.switchT > 0) return;
  const order = WEAPON_ORDER;
  const avail = order.filter(w => f.weapons[w] > 0);
  if (avail.length <= 1) return;
  f.weapon = avail[(avail.indexOf(f.weapon) + 1) % avail.length];
  f.switchT = .25;
}

function applyMeleeHits(f) {
  if (!f.ah) return;
  const kn = f.weapon === 'knife';
  const A = f.atkType === 1 ? { dm: kn ? 24 : 18, reach: kn ? 58 : 52, kd: true }
    : f.atkType === 2 ? { dm: kn ? 16 : 12, reach: kn ? 52 : 46, kd: false }
    : { dm: kn ? 16 : 12, reach: kn ? 50 : 44, kd: false };
  for (const e of enemies) {
    if (!alive(e) || f.hitEnemies.has(e)) continue;
    if (inReach(f.x, f.y, f.z, f.face, A.reach, e.x, e.y, 0, ET[e.k].rad)) {
      f.hitEnemies.add(e); hurtEnemy(e, A.dm, f.face, A.kd || f.atkType === 2); G.dmgDealt += A.dm;
    }
  }
  for (const h of hostages.slice()) {
    if (!f.hitEnemies.has(h) && inReach(f.x, f.y, f.z, f.face, A.reach, h.x, h.y, 0, 18)) { f.hitEnemies.add(h); hitHostage(h, A.dm); }
  }
  for (const c of crates) {
    if (!c.broken && Math.abs(c.x - f.x) < A.reach && Math.abs(c.y - f.y) < 20 && (c.x - f.x) * f.face > -12) {
      c.hp -= A.dm; if (c.hp <= 0) breakCrate(c);
    }
  }
  for (const b of barrels) {
    if (!b.exploded && Math.abs(b.x - f.x) < A.reach && Math.abs(b.y - f.y) < 20 && (b.x - f.x) * f.face > -12) {
      b.hp -= A.dm; if (b.hp <= 0) explodeBarrel(b);
    }
  }
}

// ==========================================
// UPDATE LOGIC
// ==========================================
function updateMe(dt) {
  const m = me;
  if (!m) return;
  m.inv = Math.max(0, m.inv - dt); m.comboT = Math.max(0, m.comboT - dt);
  m.stT += dt; m.gunCd = Math.max(0, m.gunCd - dt); m.switchT = Math.max(0, m.switchT - dt);
  if (m.throwT > 0) m.throwT -= dt;
  if (m.lootT > 0) m.lootT -= dt;
  if (m.mineT > 0) m.mineT -= dt;

  m.x += m.vx * dt; m.vx -= m.vx * Math.min(1, dt * 7);
  if (m.z > 0 || m.vz > 0) {
    m.vz -= 1000 * dt; m.z += m.vz * dt;
    if (m.z <= 0) { m.z = 0; m.vz = 0; if (m.st === 'j') { m.st = 'i'; m.atkT = -1; m.ah = false; } }
  }
  const ix = clamp((inp.r ? 1 : 0) - (inp.l ? 1 : 0) + padX, -1, 1);
  const iy = clamp((inp.d ? 1 : 0) - (inp.u ? 1 : 0) + padY, -1, 1);
  const canAct = G.phase === 'play';
  m.mv = false;
  const W = getWeapon(m);

  if (m.st === 'i') {
    if (canAct && (ix || iy)) {
      m.x += ix * 175 * dt; m.y += iy * 105 * dt; m.mv = true; m.ph += dt * 12;
      if (ix) m.face = ix > 0 ? 1 : -1;
    }
    if (canAct && inp.sw) { switchWeapon(m); inp.sw = false; }
    if (canAct && inp.bomb) { throwBomb(m); inp.bomb = false; }
    if (canAct && inp.mine) { placeMine(m); inp.mine = false; }
    if (canAct && inp.jmp) { m.vz = 370; m.st = 'j'; m.atkT = -1; playSnd(SND.jump); }
    else if (canAct && inp.atk) {
      if (W.type === 'gun') fireGun(m);
      else startMelee(m);
    }
  } else if (m.st === 'a') {
    m.atkT += dt;
    if (W.type === 'melee') {
      m.ah = m.atkT >= .06 && m.atkT <= .22;
      if (m.ah) m.x += m.face * 55 * dt;
    }
    if (W.type === 'melee' && inp.atk && m.atkT > .12) startMelee(m);
    else if (m.atkT >= (W.type === 'melee' ? .36 : .18)) { m.st = 'i'; m.atkT = -1; m.ah = false; }
  } else if (m.st === 'j') {
    m.x += ix * 140 * dt; m.y += iy * 60 * dt;
    if (ix) m.face = ix > 0 ? 1 : -1;
    m.ph += dt * 9;
    if (canAct && inp.atk && m.atkT < 0 && W.type === 'melee') startMeleeAir(m);
    if (canAct && inp.sw) { switchWeapon(m); inp.sw = false; }
    if (canAct && inp.bomb) { throwBomb(m); inp.bomb = false; }
    if (canAct && inp.mine) { placeMine(m); inp.mine = false; }
    if (m.atkT >= 0) {
      m.atkT += dt; m.ah = m.atkT >= 0 && m.atkT <= .26;
      if (m.atkT > .32) { m.atkT = -1; m.ah = false; }
    }
  } else if (m.st === 'h') {
    if (m.stT > .32) m.st = 'i';
  } else if (m.st === 'd') {
    if (m.dead) {
      m.respT -= dt;
      if (m.respT <= 0 && m.lives > 0) {
        m.dead = false; m.hp = 100; m.st = 'i'; m.z = 0; m.vz = 0; m.inv = 2;
        if (G.timeLeft <= 0) G.timeLeft = LEVEL_TIME;   // يُعاد العد فقط إذا مات بسبب انتهاء الوقت
        G.timeUp = false;
        floatText(m.x, m.y - 70, 'RESPAWN', '#fff');
      }
    } else if (m.z <= 0 && m.stT > .9) { m.st = 'i'; m.inv = 1; }
  }
  resolveObs(m);
  // البوابة مغلقة حتى يموت الزعيم
  m.x = clamp(m.x, 30, G.bossDead ? WORLD - 20 : WORLD - 160);
  m.y = clamp(m.y, Y0, YB);
  inp.atk = false; inp.jmp = false;
}

function mkEnemy(k, x, y) {
  const T = ET[k];
  return { k: k, x: x, y: y, z: 0, vx: 0, face: -1, hp: T.hp, st: 'walk', t: 0, cd: rr(.4, 1.2), ph: rr(0, 6), mv: false, offY: rr(-10, 10), did: false, remove: false, hk: 0, ak: 0, dying: false };
}

function mkBoss() {
  const hp = ET.boss.hp;
  return { k: 'boss', x: WORLD - 300, y: 312, z: 0, vx: 0, face: -1, hp: hp, maxHp: hp, st: 'walk', t: 0, cd: 1, ph: 0,
    mv: false, did: false, remove: false, hk: 0, ak: 0, home: WORLD - 300, shootCd: 2, bombCd: 4, dodgeT: 0, dd: 1, active: false, dying: false };
}

function spawnWave(pack, f) {
  pack.forEach((k, i) => {
    const behind = (pack.length > 3 && i % 3 === 2 && !ET[k].kd);
    const off = VW * .5 + 90 + i * 55 + rr(0, 30);
    const x = clamp(f.x + (behind ? -1 : 1) * off, 40, WORLD - ARENA - 40);
    enemies.push(mkEnemy(k, x, rr(Y0 + 8, Y1 - 8)));
  });
}

// ---------- الصناديق والبراميل صلبة ----------
function obsPush(e, o) {
  const dx = e.x - o.x, dy = e.y - o.y;
  const px = 29 - Math.abs(dx), py = 16 - Math.abs(dy);
  if (px <= 0 || py <= 0) return null;
  if (px <= py) { e.x += (dx >= 0 ? 1 : -1) * px; return 'x'; }
  e.y += (dy >= 0 ? 1 : -1) * py; return 'y';
}
function resolveObs(e) {
  if (e.z > 34) return null;
  let blocked = null;
  for (const o of crates) {
    if (o.broken || Math.abs(o.x - e.x) > 45) continue;
    if (obsPush(e, o) === 'x') blocked = o;
  }
  for (const o of barrels) {
    if (o.exploded || Math.abs(o.x - e.x) > 45) continue;
    if (obsPush(e, o) === 'x') blocked = o;
  }
  return blocked;
}

// ---------- رئيس العصابة ----------
function bossShoot(e, D) {
  e.st = 'atk'; e.t = 0; e.did = true; e.ak++; e.shootCd = rr(1.4, 2.2) * D.cd; playSnd(SND.shoot);
  for (let i = -1; i <= 1; i++)
    bullets.push({ x: e.x + e.face * 30, y: e.y + i * 6, z: 20, vx: e.face * 620, vy: 0, vz: 0, dm: Math.round(9 * D.dmg), owner: 'boss', color: '#ff4d4d', life: 1, t: 0 });
}
function bossBomb(e, D) {
  e.st = 'atk'; e.t = 0; e.did = true; e.ak++; e.bombCd = rr(3, 5) * D.cd;
  bombs.push({ x: e.x + e.face * 20, y: e.y, z: 50, vx: e.face * BOMB.vx, vz: BOMB.vz, t: 0, fuse: BOMB.fuse, owner: 'boss', dm: Math.round(45 * D.dmg), radius: BOMB.radius, settled: false });
}
function updateBoss(e, dt) {
  const T = ET.boss, D = DIFF[G.diff], m = me;
  e.t += dt; e.mv = false;
  if (e.dying || e.st === 'dead') { if (e.t > 1.4) e.remove = true; return; }
  e.shootCd -= dt; e.bombCd -= dt; e.cd -= dt;
  const minX = WORLD - ARENA + 60, maxX = WORLD - 190;
  const near = !!(m && !m.dead && m.x > WORLD - ARENA && G.phase === 'play');
  e.active = near;

  if (e.st === 'atk') {
    if (!e.did && e.t < .16 && near && inReach(e.x, e.y, 0, e.face, T.reach, m.x, m.y, m.z, 14)) {
      e.did = true; hurtMe(Math.round(T.dmg * D.dmg), e.face, true);
    }
    if (e.t >= .34) { e.st = 'walk'; e.t = 0; }
  } else if (near) {
    const dx = m.x - e.x, adx = Math.abs(dx), ady = Math.abs(m.y - e.y);
    e.face = dx >= 0 ? 1 : -1;
    // تفادي الرصاص القادم
    if (e.dodgeT <= 0) for (const b of bullets) {
      if (b.owner === 'me' && Math.abs(b.x - e.x) < 280 && (b.x - e.x) * b.vx < 0 && Math.abs(b.y - e.y) < 26) {
        e.dodgeT = .4; e.dd = e.y >= b.y ? 1 : -1;
        if (e.y > YB - 10) e.dd = -1;
        if (e.y < Y0 + 10) e.dd = 1;
        break;
      }
    }
    // الابتعاد عن القنابل والألغام
    let flee = 0;
    for (const b of bombs) if (b.owner === 'me' && Math.abs(b.x - e.x) < 160) flee = e.x >= b.x ? 1 : -1;
    for (const mi of mines) if (Math.abs(mi.x - e.x) < 110 && Math.abs(mi.y - e.y) < 40) flee = e.x >= mi.x ? 1 : -1;

    if (e.cd <= 0 && adx < T.reach + 8 && ady < 16) {
      e.st = 'atk'; e.t = 0; e.did = false; e.ak++; e.cd = rr(1, 1.6) * D.cd;
    } else if (e.shootCd <= 0 && !flee && ady < 20 && adx > 90 && adx < 440) bossShoot(e, D);
    else if (e.bombCd <= 0 && adx > 120 && adx < 260) bossBomb(e, D);
    else if (e.dodgeT > 0) { e.dodgeT -= dt; e.y += e.dd * 150 * dt; e.mv = true; }
    else if (flee) { e.x += flee * T.spd * 1.6 * dt; e.mv = true; }
    else if (adx < 70) { e.x -= Math.sign(dx || 1) * T.spd * dt; e.mv = true; }
    else if (adx > 360) { e.x += Math.sign(dx) * T.spd * .8 * dt; e.mv = true; }
    else if (ady > 12) { e.y += Math.sign(m.y - e.y) * 70 * dt; e.mv = true; }
  } else {
    // اللاعب بعيد: يرجع إلى مكانه ويحرس البوابة
    const dx = e.home - e.x;
    if (Math.abs(dx) > 6) { e.x += Math.sign(dx) * T.spd * 1.4 * dt; e.face = Math.sign(dx); e.mv = true; } else e.face = -1;
    const dy = 312 - e.y;
    if (Math.abs(dy) > 6) { e.y += Math.sign(dy) * 70 * dt; e.mv = true; }
  }
  if (e.mv) e.ph += dt * 11;
  e.x = clamp(e.x, minX, maxX);   // لا يخرج من ساحته أبدًا
  e.y = clamp(e.y, Y0, YB);
  resolveObs(e);
}

function updateEnemies(dt) {
  for (const e of enemies) {
    if (e.k === 'boss') { updateBoss(e, dt); continue; }
    const T = ET[e.k];
    // المحتضر لا يهاجم ولا يتفاعل: يُجبَر على حالة السقوط
    if (e.dying && e.st !== 'down' && e.st !== 'dead') { e.st = 'down'; e.t = 0; }
    e.t += dt; e.cd -= dt;
    e.x += e.vx * dt; e.vx -= e.vx * Math.min(1, dt * 6);
    e.mv = false;

    if (e.st === 'walk') {
      const tgt = pickTarget(e);
      e.tgt = tgt;
      if (tgt) {
        const sgn = e.x >= tgt.x ? 1 : -1;
        const tx = tgt.x + sgn * T.reach * .75;
        const ty = clamp(tgt.y + e.offY, Y0, YB);
        const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
        e.face = tgt.x > e.x ? 1 : -1;
        if (e.sdT > 0) {
          e.sdT -= dt; e.y += e.sd * 70 * dt; e.x += Math.sign(dx || 1) * T.spd * .5 * dt;
          e.mv = true; e.ph += dt * 11;
        } else if (d > 6) {
          e.x += dx / d * T.spd * dt; e.y += dy / d * T.spd * .7 * dt;
          e.mv = true; e.ph += dt * 11;
        }
        if (alive(e) && e.cd <= 0 && Math.abs(tgt.x - e.x) < T.reach + 8 && Math.abs(tgt.y - e.y) < 14 && tgt.st !== 'd' && !tgt.dead && G.phase === 'play') {
          e.st = 'wind'; e.t = 0;
          e.ak = (e.ak || 0) + 1;
        }
      }
    } else if (e.st === 'wind') {
      if (e.tgt) e.face = e.tgt.x > e.x ? 1 : -1;
      if (e.t >= T.wind) { e.st = 'atk'; e.t = 0; e.did = false; }
    } else if (e.st === 'atk') {
      const t2 = e.tgt;
      if (!e.did && e.t < .16 && t2 && !t2.dead && inReach(e.x, e.y, 0, e.face, T.reach, t2.x, t2.y, t2.z, 14)) { e.did = true; if (t2.ally) hurtAlly(t2, Math.round(T.dmg * DIFF[G.diff].dmg), e.face, T.kd); else hurtMe(T.dmg, e.face, T.kd); }
      if (e.t >= .34) { e.st = 'walk'; e.t = 0; e.cd = rr(1, 1.8); e.did = false; }
    } else if (e.st === 'hurt') {
      if (e.t >= .32) { e.st = 'walk'; e.t = 0; e.cd = .4; }
    } else if (e.st === 'down') {
      if (e.t >= .85) { if (e.hp <= 0 || e.dying) { e.st = 'dead'; e.t = 0; } else { e.st = 'walk'; e.t = 0; e.cd = .6; } }
    } else if (e.st === 'dead') {
      if (e.t >= .6) e.remove = true;
    }

    for (const o of enemies) {
      if (o === e || !alive(o)) continue;
      const dx = e.x - o.x, dy = e.y - o.y;
      if (Math.abs(dx) < 22 && Math.abs(dy) < 9) { e.x += Math.sign(dx || 1) * 40 * dt; e.y += Math.sign(dy || 1) * 30 * dt; }
    }
    const bl = resolveObs(e);
    if (bl && !(e.sdT > 0)) {
      e.sd = e.y >= bl.y ? 1 : -1;
      if (e.y >= YB - 6) e.sd = -1;
      if (e.y <= Y0 + 6) e.sd = 1;
      e.sdT = .5;
    }
    e.x = clamp(e.x, 20, WORLD - ARENA); e.y = clamp(e.y, Y0, YB);
    if (me && Math.abs(e.x - me.x) > 1100) e.remove = true;
  }
  enemies = enemies.filter(e => !e.remove);
}

function pickupItems(f) {
  if (!f || f.dead) return;
  for (const it of items) {
    if (it.gone) continue;
    if (Math.abs(f.x - it.x) < 26 && Math.abs(f.y - it.y) < 20) {
      it.gone = true;
      f.lootT = .5; f.lk = (f.lk || 0) + 1;
      playSnd(SND.pick);
      if (it.kind === 'health') {
        f.hp = Math.min(100, f.hp + 30); floatText(f.x, f.y - 70, '+30', '#9dff8a');
        playSnd(SND.health_refill);
      } else if (it.kind === 'bomb') {
        f.bombs++; floatText(f.x, f.y - 70, 'BOMB!', '#ffb347');
      } else if (it.kind === 'ammo') {
        ['pistol', 'smg', 'shotgun'].forEach(w => { if (f.weapons[w] > 0) f.weapons[w] += Math.round(WEAPONS[w].maxAmmo * .3); });
        f.bombs++; floatText(f.x, f.y - 70, 'AMMO!', '#ffc233');
      } else if (WEAPONS[it.kind]) {
        const w = it.kind, Wp = WEAPONS[w];
        if (f.weapons[w] > 0) f.weapons[w] += Math.round(Wp.maxAmmo * .5);
        else f.weapons[w] = Wp.maxAmmo;
        f.weapon = w; floatText(f.x, f.y - 70, Wp.name.toUpperCase() + '!', '#ffc233');
      }
    }
  }
}

// ==========================================
// HOSTAGES & ALLIES (الرهائن والحلفاء)
// ==========================================
function spawnHostages() {
  hostages = [];
  const others = HEROES.map((h, i) => i).filter(i => i !== G.side);   // الأبطال الثلاثة الآخرون
  for (let i = 0; i < HOSTAGE_COUNT && i < others.length; i++) {
    const x = START + HOSTAGE_FIRST + i * HOSTAGE_GAP;
    if (x > WORLD - ARENA - 120) break;                                 // لا تُوضع داخل ساحة الزعيم
    hostages.push({ side: others[i], x: x, y: 312, hp: HOSTAGE_ROPE_HP, max: HOSTAGE_ROPE_HP, hk: 0, freed: false });
  }
}

// ضرب الحبل: عند انقطاعه تتحرر الرهينة وتنضم للبطل
function hitHostage(h, dm) {
  if (h.freed) return;
  h.hp -= dm; h.hk++;
  playSnd(SND.swing); sparks(h.x, h.y, 44, '#d9c08a');
  if (h.hp <= 0) freeHostage(h);
  else floatText(h.x, h.y - HOSTAGE_VIS - 6, 'CUT!', '#ffe58a');
}
function freeHostage(h) {
  h.freed = true;
  playSnd(SND.box_destroy); playSnd(SND.pick);
  const a = mkAlly(h);
  allies.push(a);
  const nm = HEROES[h.side].name;
  floatText(h.x, h.y - HOSTAGE_VIS - 6, 'FREE!', '#9dff8a');
  toast(nm + ' JOINED YOU!', 2200);
  hostages = hostages.filter(o => o !== h);
}

function mkAlly(h) {
  return {
    ally: true, side: h.side, x: h.x, y: h.y, z: 0, vx: 0, face: me ? (me.x >= h.x ? 1 : -1) : 1,
    hp: ALLY.hp, st: 'i', stT: 0, atkT: -1, ak: 0, hk: 0, ph: 0, mv: false, did: false, combo: 0, comboT: 0,
    cd: 1, inv: .6, dead: false, deadT: 0, vicT: 1.1, remove: false, thinkT: 0, dazeT: 0, tgt: null
  };
}

function hurtAlly(a, dmg, dir, kd, hits) {
  if (!a || a.dead || a.inv > 0 || G.phase !== 'play') return false;
  dmg = (hits || 1) * ALLY.hp / ALLY.hits;   // كل ضربة تأخذ جزءاً ثابتاً من الشريط مهما كان العدو
  a.hp -= dmg; a.inv = .2; a.hk++;
  playSnd(SND.hit); sparks(a.x, a.y, 34);
  a.atkT = -1; a.did = false; a.vicT = 0;
  if (a.hp <= 0) {
    a.hp = 0; a.dead = true; a.st = 'd'; a.stT = 0; a.deadT = 0; a.vx = dir * 240;
    floatText(a.x, a.y - HERO_VIS - 6, HEROES[a.side].name + ' DOWN', '#ff6f4e');
  } else if (kd) { a.st = 'd'; a.stT = 0; a.vx = dir * 220; }
  else { a.st = 'h'; a.stT = 0; a.vx = dir * 90; }
  return true;
}

// العدو يستهدف الأقرب: البطل أو أحد حلفائه
function pickTarget(e) {
  let best = (me && !me.dead) ? me : null;
  let bd = best ? Math.abs(best.x - e.x) + Math.abs(best.y - e.y) * 1.5 : 1e9;
  for (const a of allies) {
    if (a.dead) continue;
    const d = (Math.abs(a.x - e.x) + Math.abs(a.y - e.y) * 1.5) * .6;   // الحليف الضعيف هدف مفضّل للأعداء
    if (d < bd) { bd = d; best = a; }
  }
  return best;
}

function updateAllies(dt) {
  const alive_ = allies.filter(a => !a.dead);
  for (const a of allies) {
    a.x += a.vx * dt; a.vx -= a.vx * Math.min(1, dt * 7);
    if (a.dead) { a.deadT += dt; if (a.deadT > 1.6) a.remove = true; continue; }
    a.inv = Math.max(0, a.inv - dt); a.stT += dt; a.cd -= dt; a.comboT = Math.max(0, a.comboT - dt);
    a.mv = false;
    if (a.vicT > 0) a.vicT -= dt;

    if (a.st === 'a' && me && G.phase === 'play' && Math.abs(me.x - a.x) > ALLY.leash) { a.st = 'i'; a.atkT = -1; }   // البطل ابتعد: يترك القتال ويلحق به
    if (a.st === 'h') { if (a.stT > .32) a.st = 'i'; }
    else if (a.st === 'd') { if (a.stT > .7) { a.st = 'i'; a.inv = .6; } }
    else if (a.st === 'a') {
      a.atkT += dt;
      if (!a.did && a.atkT >= .08) {
        a.did = true;
        const strong = a.combo === 2;
        const whiff = Math.random() < ALLY.miss;   // ضربة غبية في الهواء
        for (const e of enemies) {
          if (whiff || !alive(e) || (e.k === 'boss' && !e.active)) continue;
          if (inReach(a.x, a.y, 0, a.face, ALLY.reach, e.x, e.y, 0, e.k === 'boss' ? 22 : ET[e.k].rad)) {
            hurtEnemy(e, strong ? ALLY.dmKd : ALLY.dm, a.face, strong); G.dmgDealt += ALLY.dm;
          }
        }
      }
      if (a.atkT >= .36) { a.st = 'i'; a.atkT = -1; }
    } else if (a.vicT > 0) {
      // لحظة الامتنان بعد التحرير
    } else if (G.phase === 'play' && me) {
      // رد فعل بطيء: لا يعيد اختيار الهدف إلا كل ALLY.think ثانية، وأحياناً يشرد ويقف
      a.thinkT -= dt;
      if (a.dazeT > 0) a.dazeT -= dt;
      if (a.thinkT <= 0) {
        a.thinkT = ALLY.think * rr(.8, 1.4);
        if (Math.random() < ALLY.daze) a.dazeT = ALLY.dazeTime;
        let best = null, bd = ALLY.aggro;
        for (const e of enemies) {
          if (!alive(e) || (e.k === 'boss' && !e.active)) continue;
          const d = Math.abs(e.x - a.x) + Math.abs(e.y - a.y);
          if (d < bd) { bd = d; best = e; }
        }
        a.tgt = best;
      }
      const far = Math.abs(me.x - a.x) > ALLY.leash;   // بعيد عن البطل: يلحق به أولاً
      let tgt = (a.tgt && alive(a.tgt) && Math.abs(a.tgt.x - a.x) < ALLY.aggro * 1.6) ? a.tgt : null;
      if (far) { tgt = null; a.dazeT = 0; }
      else if (a.dazeT > 0) { tgt = null; a.mv = false; }
      if (tgt) {
        const sgn = a.x >= tgt.x ? 1 : -1, tr = tgt.k === 'boss' ? 22 : ET[tgt.k].rad;
        const tx = tgt.x + sgn * ALLY.reach * .7, dx = tx - a.x, dy = tgt.y - a.y, d = Math.hypot(dx, dy);
        a.face = tgt.x >= a.x ? 1 : -1;
        if (d > 6) { a.x += dx / d * ALLY.spd * dt; a.y += dy / d * ALLY.spd * .7 * dt; a.mv = true; a.ph += dt * 12; }
        if (a.cd <= 0 && inReach(a.x, a.y, 0, a.face, ALLY.reach - 6, tgt.x, tgt.y, 0, tr)) {
          a.combo = a.comboT > 0 ? (a.combo + 1) % 3 : 0; a.comboT = .7;
          a.st = 'a'; a.atkT = 0; a.ak++; a.did = false; a.cd = ALLY.cd; playSnd(SND.swing);
        }
      } else if (a.dazeT > 0) {
        // شارد الذهن: يقف مكانه
      } else {
        // يتبع البطل ويقترب منه ويقف بجانبه دون التزاحم
        const slot = alive_.indexOf(a);
        const gap = ALLY.follow + slot * 40;
        const dx = me.x - a.x;
        const ty = clamp(me.y + (slot % 2 ? 24 : -24), Y0, YB), dy = ty - a.y;
        if (Math.abs(dx) > gap) {
          const sp = Math.abs(dx) > gap * 1.8 ? ALLY.catchUp : ALLY.spd * 1.3;
          a.x += Math.sign(dx) * sp * dt; a.face = Math.sign(dx); a.mv = true;
        } else if (Math.abs(dx) < 40 + slot * 20) {
          a.x -= Math.sign(dx || 1) * ALLY.spd * .5 * dt; a.mv = true; a.face = Math.sign(dx || 1);   // يبتعد قليلاً عن البطل
        }
        if (Math.abs(dy) > 8) { a.y += Math.sign(dy) * ALLY.spd * .7 * dt; a.mv = true; }
        if (!a.mv && me) a.face = me.x >= a.x ? 1 : -1;
        if (Math.abs(dx) > 400) { a.x = me.x - me.face * 90 - slot * 30; a.y = me.y; }   // تأخر كثيراً: يلحق بالبطل فوراً
        if (a.mv) a.ph += dt * 12;
      }
    }
    resolveObs(a);
    a.x = clamp(a.x, 30, G.bossDead ? WORLD - 20 : WORLD - 160);
    a.y = clamp(a.y, Y0, YB);
  }
  allies = allies.filter(a => !a.remove);
}

function allySpr(a) {
  const p = IMG.heroes[a.side];
  if (a.dead) return ['death', p.death];
  if (a.st === 'h' || a.st === 'd') return ['inj' + a.hk, p.injured];
  if (a.st === 'a') return ['melee' + a.ak, p.punch];
  let v = p.victory;
  if ((a.vicT > 0 || (G.phase === 'over' && G.result && G.result.win)) && v && !(v.complete && !v.naturalWidth)) return ['vic', v];
  if (a.mv) return ['walk', p.walk];
  return ['idle', p.idle];
}

// الرصاصة تصيب الصندوق/البرميل فقط إذا مرّت داخل إطار صورته المرسومة فعلاً (عرض الصورة × ارتفاعها)،
// وليس الفراغ فوقها. الفحص على مسار الرصاصة في هذا الإطار حتى لا تخترق الأجسام الرفيعة.
function bulletInFrame(b, dt, o, img, h) {
  const nw = img && img.naturalWidth, nh = img && img.naturalHeight;
  const hw = nw && nh ? (nw * h / nh) / 2 : 18;          // نصف عرض الإطار كما يُرسم
  const sy = b.y - b.z;                                   // موضع الرصاصة على الشاشة
  if (sy < o.y - h || sy > o.y) return false;             // خارج ارتفاع الإطار (فوقه أو تحته)
  const px = b.x - b.vx * dt;                             // موضعها في الإطار السابق
  return Math.max(px, b.x) >= o.x - hw && Math.min(px, b.x) <= o.x + hw;
}

function updateBullets(dt) {
  for (const b of bullets) {
    b.t += dt;
    if (b.t > b.life) { b.gone = true; continue; }
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    if (b.z < 0) { b.z = 0; b.vz = 0; }
    if (b.owner === 'me') {
      for (const e of enemies) {
        if (!alive(e)) continue;   // الرصاص يمر من خلال الميت
if (Math.abs(e.x - b.x) < (e.k === 'boss' ? 20 : ET[e.k].rad) && Math.abs(e.y - b.y) < 16 && b.z >= (e.z || 0) - 10 && b.z <= (e.z || 0) + (e.k === 'boss' ? 115 : 100)) {
            hurtEnemy(e, b.dm, Math.sign(b.vx), false); G.dmgDealt += b.dm; b.gone = true; break;
        }
      }
    } else if (b.owner === 'boss') {
      if (me && !me.dead && me.inv <= 0 && me.st !== 'd' && Math.abs(me.x - b.x) < 16 && Math.abs(me.y - b.y) < 18 && Math.abs(me.z - b.z) < 34) {
        hurtMe(b.dm, Math.sign(b.vx), false); b.gone = true;
      }
    }
    if (!b.gone && b.owner === 'me') {
      for (const h of hostages.slice()) {
        if (Math.abs(h.x - b.x) < 20 && Math.abs(h.y - b.y) < 16 && b.z <= HOSTAGE_VIS) { hitHostage(h, b.dm); b.gone = true; break; }
      }
    }
    if (!b.gone) {
      for (const c of crates) {
        if (!c.broken && bulletInFrame(b, dt, c, IMG.crates[c.v].ok, PROP_VIS.crate)) { c.hp -= b.dm; if (c.hp <= 0) breakCrate(c); b.gone = true; break; }
      }
    }
    if (!b.gone) {
      for (const bar of barrels) {
        if (!bar.exploded && bulletInFrame(b, dt, bar, IMG.barrels[bar.v].ok, PROP_VIS.barrel)) { bar.hp -= b.dm; if (bar.hp <= 0) explodeBarrel(bar); b.gone = true; break; }
      }
    }
  }
  bullets = bullets.filter(b => !b.gone);
}

function updateBombs(dt) {
  for (const b of bombs) {
    b.t += dt;
    if (!b.settled) {
      b.x += b.vx * dt; b.z += b.vz * dt; b.vz -= 800 * dt;
      if (b.z <= 0) { b.z = 0; if (Math.abs(b.vz) < 80) { b.settled = true; b.vz = 0; b.vx *= .3; } else { b.vz = -b.vz * .45; } }
      b.vx *= .98;
    }
    if (b.t >= b.fuse) { b.gone = true; createExplosion(b.x, b.y, b.z, b.radius, b.dm, b.owner); }
  }
  bombs = bombs.filter(b => !b.gone);

  for (const m of mines) {
    m.t += dt; m.armT -= dt;
    if (m.armT <= 0) m.armed = true;
    if (m.armed && !m.gone) {
      let trig = false;
      for (const e of enemies) { if (alive(e) && Math.abs(e.x - m.x) < MINE.trigger && Math.abs(e.y - m.y) < 20) { trig = true; break; } }
      if (trig) { m.gone = true; createExplosion(m.x, m.y, 0, m.radius, m.dm, m.owner); }
    }
  }
  mines = mines.filter(m => !m.gone);
}

// ==========================================
// RENDER LOGIC & ANIMATIONS
// ==========================================
function drawImg(g, img, x, y, w, h, face) {
  if (!img || !img.complete || img.naturalWidth === 0) return;
  const k = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * k, dh = img.naturalHeight * k;
  g.save();
  if (face === -1) {
    g.translate(x, y); g.scale(-1, 1);
    g.drawImage(img, -dw / 2, -dh, dw, dh);
  } else {
    g.drawImage(img, x - dw / 2, y - dh, dw, dh);
  }
  g.restore();
}

// DOM SPRITES: كل شخصية عنصر <img> حتى يتحرك الـ GIF فعلاً
const sprAll = new Set(), sprUsed = new Set();

function dropSprite(o) {
  if (o._el) { o._el.remove(); o._el = null; }
  if (o._pend) { o._pend.remove(); o._pend = null; }
  o._key = null;
}

function placeSprite(o, key, shared, x, y, face, zi, vis, sizeFn) {
  if (!shared) return;
  sprUsed.add(o); sprAll.add(o);
  if (o._key !== key) {
    o._key = key;
    if (o._pend) o._pend.remove();
    const im = document.createElement('img');
    im.src = shared.src;
    im.draggable = false;
    im.style.cssText = 'position:absolute;left:0;top:0;opacity:0;pointer-events:none;max-width:none;user-select:none';
    layer.appendChild(im);
    o._pend = im;
  }
  if (o._pend && o._pend.complete && o._pend.naturalWidth > 0) {
    if (o._el) o._el.remove();
    o._el = o._pend; o._pend = null;
  }
  const el = o._el;
  if (!el) return;
  const d = sizeFn(el), w = d[0], h = d[1];
  el.style.opacity = vis ? '1' : '0';
  el.style.width = (w * CS) + 'px';
  el.style.height = (h * CS) + 'px';
  const ox = (d[3] || 0) * (face === -1 ? -1 : 1);
  el.style.transform = 'translate(' + ((x - cam - w / 2 + ox) * CS) + 'px,' + ((y + (d[2] || 0) - h) * CS) + 'px) scaleX(' + (face === -1 ? -1 : 1) + ')';
  el.style.zIndex = zi;
}

// ==========================================
// توحيد الأحجام: لا نعتمد على مقاس ملف الصورة إطلاقًا (1000px أو 100px).
// كل GIF يُقاس الجزء المرئي منه فعلاً، ثم يُكبَّر/يُصغَّر حتى يظهر الجسم بنفس الارتفاع (vis)
// مع تثبيت القدمين على الأرض وتوسيط الجسم أفقيًا.
// ==========================================
const _mc = new Map();
function measureImg(img) {
  if (!img || !img.complete || !img.naturalWidth) return null;
  const key = img.src;
  if (_mc.has(key)) return _mc.get(key);
  let m = null;
  try {
    const w = img.naturalWidth, h = img.naturalHeight;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, w, h).data;
    let t = -1, b = -1, l = w, r = -1;
    for (let yy = 0; yy < h; yy++) {
      for (let xx = 0; xx < w; xx++) {
        if (d[(yy * w + xx) * 4 + 3] > 30) {
          if (t < 0) t = yy;
          b = yy;
          if (xx < l) l = xx;
          if (xx > r) r = xx;
        }
      }
    }
    if (t >= 0 && b - t > 4 && r - l > 4) m = { cw: r - l + 1, ch: b - t + 1, pad: h - 1 - b, cx: (l + r) / 2 };
  } catch (e) {}
  if (m) _mc.set(key, m);
  return m;
}
// lying = حركة الموت (الجسم مستلقٍ): نستعمل أكبر بُعد مرئي حتى لا يتضخم
function normSize(el, vis, lying) {
  const nw = el.naturalWidth, nh = el.naturalHeight, m = measureImg(el);
  if (!m) { const k = vis / nh; return [nw * k, nh * k, 0, 0]; }   // احتياط: ارتفاع الصورة يساوي ارتفاع الجسم
  const k = vis / (lying ? Math.max(m.cw, m.ch) : m.ch);
  return [nw * k, nh * k, m.pad * k, -(m.cx - nw / 2) * k];
}
function heroSize(el, side, lying) {
  return normSize(el, HERO_VIS * (HERO_SCALE[side] || 1), lying);
}
function propSize(el, h) {
  const k = h / (el.naturalHeight || h);
  return [el.naturalWidth * k, h];
}

// صورة التحطم بنفس مقياس الصورة السليمة (حتى لا تتضخم أو تصغر)
function wreckSize(el, okImg, h) {
  const k = h / ((okImg && okImg.naturalHeight) || el.naturalHeight || h);
  return [el.naturalWidth * k, el.naturalHeight * k];
}

function playerSpr(f) {
  const p = IMG.heroes[f.side];
  const hk = f.hk || 0;
  if (f.st === 'd') return f.dead ? ['death' + hk, p.death] : ['inj' + hk, p.injured];
  if (f.st === 'h') return ['inj' + hk, p.injured];
  if (f.throwT > 0) return ['bomb' + (f.tk || 0), p.bomb];
  if (f.atkT >= 0 && (f.st === 'a' || f.st === 'j')) {
    const W = getWeapon(f);
    if (W.type === 'gun') {
      const k = f.weapon === 'shotgun' ? 'shotgun' : (f.weapon === 'smg' ? 'smg' : 'pistol');
      let im = p[k];
      if (!im || (im.complete && !im.naturalWidth)) im = p.gun;   // احتياط
      return ['shoot' + f.ak, im];
    }
    return ['melee' + f.ak, f.weapon === 'fist' ? p.punch : p.sword];
  }
  if (G.phase === 'over' && G.result && G.result.win && !f.dead) return ['victory', p.victory];
  if (f.mineT > 0) return ['loot' + (f.lk || 0), p.loot];
  if (f.lootT > 0 && !f.mv) return ['loot' + (f.lk || 0), p.loot];
  if (f.mv || f.st === 'j') return ['walk', p.walk];
  return ['idle', p.idle];
}

function enemySpr(e) {
  const p = IMG.enemies[e.k];
  if (e.st === 'dead' || (e.st === 'down' && e.hp <= 0)) return ['death', p.death];
  if (e.st === 'down' || e.st === 'hurt') return ['inj' + (e.hk || 0), p.injured];
  if (e.st === 'wind' || e.st === 'atk') return ['punch' + (e.ak || 0), p.punch];
  if (e.mv) return ['walk', p.walk];
  return ['idle', p.idle];
}

function shadow(g, x, y, rx, ry) {
  g.fillStyle = 'rgba(18,6,28,.4)';
  g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, 6.3); g.fill();
}

function drawChar(g, f, t) {
  const blink = f.inv > 0 && f.st !== 'd' && Math.floor(t * 14) % 2;
  const deadBlink = f.dead && f.st === 'd' && Math.floor(t * 10) % 2;
  const vis = !(blink || deadBlink);
  if (vis) shadow(g, f.x - cam, f.y + 1, 22, 6);
  const s = playerSpr(f);
    placeSprite(f, s[0], s[1], f.x, f.y - f.z, f.face, Math.round(f.y), vis, el => heroSize(el, f.side, s[0].indexOf('death') === 0));
}

function render(t) {
  const g = ctx;
  g.setTransform(SC, 0, 0, SC, 0, 0);
  g.clearRect(0, 0, VW, H);
  const sx = shake > 0 ? (Math.random() - .5) * shake : 0;
  const sy = shake > 0 ? (Math.random() - .5) * shake : 0;
  layer.style.transform = 'translate(' + (sx * CS) + 'px,' + (sy * CS) + 'px)';
  bgDiv.style.backgroundPosition = (-cam * CS) + 'px 0';
  sprUsed.clear();

  g.save();
  g.translate(sx, sy);

  g.fillStyle = 'rgba(20, 10, 25, 0.4)';
  g.fillRect(0, Y0 - 15, VW, H - Y0 + 15);
  g.fillStyle = 'rgba(0, 0, 0, 0.3)';
  g.fillRect(0, Y1 + 10, VW, H - Y1 - 10);

  // Items
  for (const it of items) {
    const ix = it.x - cam;
    let img = IMG.item_ammo;
    if (it.kind === 'health') img = IMG.item_health;
    else if (it.kind === 'bomb') img = IMG.item_bomb;
    else if (it.kind === 'pistol') img = IMG.item_pistol;
    else if (it.kind === 'shotgun') img = IMG.item_shotgun;
    else if (it.kind === 'smg') img = IMG.item_smg;
    else if (it.kind === 'knife') img = IMG.item_shuriken;
    shadow(g, ix, it.y + 1, 13, 4);
    drawImg(g, img, ix, it.y - 5 + Math.sin(t * 5) * 3, 28, 28, 1);
  }

  // Gate (بوابة الفوز)
  const gx = WORLD - 90, gOn = gx > cam - 200 && gx < cam + VW + 200;
  if (gOn) shadow(g, gx - cam, 338, 22, 6);
  placeSprite(GATE, 'g', IMG.gate, gx, 336, 1, 336, gOn, el => propSize(el, HERO_VIS));

  // Crates
  for (const c of crates) {
    if (c.x < cam - 80 || c.x > cam + VW + 80) continue;
    const set = IMG.crates[c.v];
    if (c.broken) {
      if (!(c.wreckT > 0)) continue;
      placeSprite(c, 'cb' + c.v, set.br, c.x, c.y, 1, Math.round(c.y) - 1, true, el => wreckSize(el, set.ok, PROP_VIS.crate));
      continue;
    }
    shadow(g, c.x - cam, c.y + 2, c.w * .6, 5);
    placeSprite(c, 'c' + c.v, set.ok, c.x, c.y, 1, Math.round(c.y), true, el => propSize(el, PROP_VIS.crate));
  }

  // Barrels
  for (const b of barrels) {
    if (b.x < cam - 80 || b.x > cam + VW + 80) continue;
    const set = IMG.barrels[b.v];
    if (b.exploded) {
      if (!(b.wreckT > 0)) continue;
      placeSprite(b, 'bb' + b.v, set.br, b.x, b.y, 1, Math.round(b.y) - 1, true, el => wreckSize(el, set.ok, PROP_VIS.barrel));
      continue;
    }
    shadow(g, b.x - cam, b.y + 2, 16, 5);
    placeSprite(b, 'b' + b.v, set.ok, b.x, b.y, 1, Math.round(b.y), true, el => propSize(el, PROP_VIS.barrel));
  }

  // Mines
  for (const m of mines) {
    shadow(g, m.x - cam, m.y + 1, 14, 4);
    // عنصر img حتى يتحرك الـ GIF (الكانفاس يعرض الإطار الأول فقط)
    placeSprite(m, 'mine', IMG.item_mine, m.x, m.y, 1, Math.round(m.y), true, el => { const k = Math.min(20 / el.naturalWidth, 20 / el.naturalHeight); return [el.naturalWidth * k, el.naturalHeight * k]; });   // نفس الحجم القديم: داخل مربع 20×20، القاعدة عند y
  }

  // Enemies + Boss
  for (const e of enemies) {
    if (e.st === 'dead' && e.t > (e.k === 'boss' ? 1.4 : 0.6)) continue;
    shadow(g, e.x - cam, e.y + 1, ET[e.k].sh, 6);
    const s = enemySpr(e);
    const base = IMG.enemies[e.k].idle;
    const vis = ENEMY_VIS[e.k] || 80;
    placeSprite(e, s[0], s[1], e.x, e.y - e.z, e.face, Math.round(e.y), true, el => normSize(el, vis, s[0] === 'death'));
  }

  // Hostages (الرهائن المربوطة)
  for (const h of hostages) {
    if (h.x < cam - 100 || h.x > cam + VW + 100) continue;
    shadow(g, h.x - cam, h.y + 1, 22, 6);
    placeSprite(h, 'hs', IMG.hostage[h.side], h.x, h.y, 1, Math.round(h.y), true, el => normSize(el, HOSTAGE_VIS, false));
    const hx = h.x - cam, top = h.y - HOSTAGE_VIS - 6;
    g.textAlign = 'center'; g.font = '800 12px Tajawal,sans-serif';
    g.fillStyle = '#000'; g.fillText('HELP!', hx + 1, top - 6 + Math.sin(t * 6) * 2 + 1);
    g.fillStyle = '#ffe58a'; g.fillText('HELP!', hx, top - 6 + Math.sin(t * 6) * 2);
    if (h.hp < h.max) {
      g.fillStyle = 'rgba(0,0,0,.7)'; g.fillRect(hx - 17, top, 34, 5);
      g.fillStyle = '#d9c08a'; g.fillRect(hx - 16, top + 1, 32 * clamp(h.hp / h.max, 0, 1), 3);
    }
  }

  // Allies (الرهائن المحررون)
  for (const a of allies) {
    const vis = !(a.inv > 0 && !a.dead && Math.floor(t * 14) % 2);
    if (!a.dead) shadow(g, a.x - cam, a.y + 1, 22, 6);
    const s = allySpr(a);
    placeSprite(a, s[0], s[1], a.x, a.y, a.face, Math.round(a.y), vis, el => heroSize(el, a.side, s[0] === 'death'));
    if (!a.dead) {
      const ax = a.x - cam, top = a.y - HERO_VIS - 10;
      g.textAlign = 'center'; g.font = '800 11px Tajawal,sans-serif';
      g.fillStyle = '#000'; g.fillText(HEROES[a.side].name, ax + 1, top - 3);
      g.fillStyle = '#33d6c0'; g.fillText(HEROES[a.side].name, ax, top - 4);
      g.fillStyle = 'rgba(0,0,0,.7)'; g.fillRect(ax - 17, top, 34, 5);
      g.fillStyle = a.hp > 35 ? '#33d6c0' : '#ff6f4e'; g.fillRect(ax - 16, top + 1, 32 * clamp(a.hp / ALLY.hp, 0, 1), 3);
    }
  }

  // Hero
  if (me) drawChar(g, me, t);

  // Bullets
  for (const b of bullets) {
    g.fillStyle = b.color;
    g.fillRect(b.x - cam - 3, b.y - b.z - 1, 6, 2);
  }

  // Bombs
  for (const b of bombs) drawImg(g, IMG.item_bomb, b.x - cam, b.y - b.z - 5, 24, 24, 1);

  // Explosions
  for (const e of explosions) {
    placeSprite(e, 'x', IMG.explosion, e.x, e.y - e.z + e.maxR * 0.5, 1, 2000, true, el => {
      const k = (e.maxR * 2) / (el.naturalWidth || 1);
      return [el.naturalWidth * k, el.naturalHeight * k];
    });
  }

  // Particles
  for (const p of parts) {
    g.globalAlpha = clamp(p.l * 3, 0, 1);
    g.fillStyle = p.c;
    g.fillRect(p.x - cam - 1.5, p.y - p.z - 1.5, 3, 3);
  }
  g.globalAlpha = 1;

  // Floaters
  g.textAlign = 'center'; g.font = '800 16px Tajawal,sans-serif';
  for (const f of floaters) {
    g.globalAlpha = 1 - f.t;
    g.fillStyle = '#000'; g.fillText(f.text, f.x - cam + 1, f.y - f.t * 30 + 1);
    g.fillStyle = f.c; g.fillText(f.text, f.x - cam, f.y - f.t * 30);
  }
  g.globalAlpha = 1;

  g.restore();

  for (const o of sprAll) {
    if (!sprUsed.has(o)) { dropSprite(o); sprAll.delete(o); }
  }
}

// ==========================================
// FLOW & LOOP
// ==========================================
function toast(text, ms) {
  const t = $('#toast');
  t.textContent = text; t.classList.add('on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('on'), ms || 2600);
}
function banner(text, pop) {
  const b = $('#banner');
  if (!text) { b.hidden = true; return; }
  b.hidden = false; b.textContent = text;
  b.classList.remove('pop');
  if (pop) { void b.offsetWidth; b.classList.add('pop'); }
}

// ما اشتريته من المتجر: الأسلحة الدائمة + الذخيرة + القنابل + الألغام + الدرع
function applyLoadout() {
  const S = loadSave();
  G.armor = !!S.owned.armor; G.boughtBomb = S.inv.bomb || 0; G.boughtMine = S.inv.mine || 0; G.ammoUsed = false;
  ['pistol', 'smg', 'shotgun'].forEach(w => { if (S.owned[w]) me.weapons[w] = WEAPONS[w].maxAmmo; });
  const gunsOwned = ['pistol', 'smg', 'shotgun'].filter(w => me.weapons[w] > 0);
  if (gunsOwned.length) {
    if ((S.inv.ammo || 0) > 0) { gunsOwned.forEach(w => { me.weapons[w] += Math.round(WEAPONS[w].maxAmmo * .6); }); G.ammoUsed = true; }
    me.weapon = gunsOwned.indexOf('pistol') >= 0 ? 'pistol' : gunsOwned[0];
  }
  me.bombs = 1 + G.boughtBomb; me.mines = G.boughtMine;
}
// نهاية الجولة: خصم ما استُهلك فعلاً، وإضافة المكافأة
function settleRound(win) {
  const S = loadSave();
  const keepB = Math.min(G.boughtBomb, Math.max(0, me.bombs - 1)), keepM = Math.min(G.boughtMine, Math.max(0, me.mines));
  S.inv.bomb = Math.max(0, (S.inv.bomb || 0) - (G.boughtBomb - keepB));
  S.inv.mine = Math.max(0, (S.inv.mine || 0) - (G.boughtMine - keepM));
  if (G.ammoUsed) S.inv.ammo = Math.max(0, (S.inv.ammo || 0) - 1);
  G.reward = G.kills * 8 + (win ? 250 : 0);
  S.coins += G.reward;
  writeSave(S);
}

function newRound() {
  fitWorld();
  me = mkHero(G.side);
  applyLoadout();
  enemies = []; items = []; parts = []; floaters = []; bullets = []; bombs = []; mines = []; crates = []; barrels = []; explosions = [];
  waveIdx = 0; G.time = 0; G.timeLeft = LEVEL_TIME; G.timeUp = false; G.paused = false; G.kills = 0; G.dmgDealt = 0; G.result = null; lastCount = -1;
  G.bossDead = false; G.bossIntro = false;
  makeEnemyPlan();
  spawnWorldObjects();
  allies = [];
  spawnHostages();
  enemies.push(mkBoss());
  cam = clamp(me.x - VW * .38, 0, WORLD - VW);
}

function startCountdown() {
  newRound();
  G.phase = 'count'; G.countT = 3.3;
  $('#hud').hidden = false;
  $('#hp0 .nm').textContent = HEROES[G.side] ? HEROES[G.side].name : 'HERO';
  $('#hp0').className = 'hpc s' + G.side;
  $('#hpPortrait').src = 'images/face-' + (HEROES[G.side] ? HEROES[G.side].id : 'player1h') + '.png';
}

function endRound(win) {
  if (G.phase !== 'play') return;
  G.phase = 'over'; G.overT = 0; G.result = { win: win };
  settleRound(win);
  playSnd(win ? SND.win : SND.lose);
  banner(win ? 'VICTORY!' : 'DEFEAT', true);
}

function showResult() {
  const w = G.result.win;
  $('#rbox').classList.toggle('lose', !w);
  $('#rTitle').textContent = w ? 'YOU WIN!' : 'YOU LOSE!';
  $('#rSub').textContent = w ? 'You defeated the boss and passed the gate!' : (G.timeUp ? 'Time ran out and you lost your last life.' : 'You ran out of lives.');
  $('#rCoins').textContent = '+' + G.reward + ' COINS';
  $('#sTime').textContent = Math.round(G.time);
  $('#sKills').textContent = G.kills;
  $('#sDmg').textContent = G.dmgDealt;
  banner('');
  $('#result').hidden = false;
}

function playAgain() {
  $('#result').hidden = true;
  startCountdown();
}

function initGame() {
    startCountdown();
    if (!muted) {
        SND.bgm.volume = 0.5;
        SND.bgm.play().catch(()=>{});
    }
}

// انتهى الوقت: يموت اللاعب ويفقد روحاً واحدة
function timeOutMe() {
  const m = me;
  if (!m || m.dead || G.phase !== 'play') return;
  G.timeUp = true;
  m.hp = 0; m.dead = true; m.lives--;
  m.st = 'd'; m.stT = 0; m.vx = -m.face * 240; m.vz = 220; m.respT = 2.3;
  m.atkT = -1; m.ah = false; m.throwT = -1;
  playSnd(SND.hit);
  toast("TIME'S UP!", 2000);
}

// الإيقاف المؤقت
function setPause(p) {
  if (p && G.phase !== 'play' && G.phase !== 'count') return;
  if (G.paused === p) return;
  G.paused = p;
  $('#pausemsg').hidden = !p;
  paintPause();
  if (p) { SND.bgm.pause(); }
  else {
    if (!muted) SND.bgm.play().catch(() => {});
    inp.atk = inp.jmp = inp.sw = inp.bomb = inp.mine = false;
    last = performance.now();
  }
}

function stepGame(dt) {
  if (G.phase === 'count') {
    G.countT -= dt;
    const n = Math.ceil(G.countT - .3);
    if (n !== lastCount) {
      lastCount = n;
      if (n > 0) { banner(String(n), true); }
      else { banner('GO!', true); G.phase = 'play'; setTimeout(() => { if (G.phase === 'play') banner(''); }, 800); }
    }
    updateMe(dt);
  } else if (G.phase === 'play') {
    G.time += dt;
    if (!me.dead) {
      G.timeLeft = Math.max(0, G.timeLeft - dt);
      if (G.timeLeft <= 0) timeOutMe();
    }
    updateMe(dt);
    if (getWeapon(me).type === 'melee') applyMeleeHits(me);
    updateEnemies(dt);
    updateAllies(dt);
    updateBullets(dt);
    updateBombs(dt);

    while (waveIdx < packPlan.length && prog(me) >= 200 + waveIdx * SEG_DIST) { spawnWave(packPlan[waveIdx], me); waveIdx++; }

    for (const it of items) it.t += dt;
    pickupItems(me);
    items = items.filter(i => !i.gone);

    if (!G.bossIntro && me.x > WORLD - ARENA) { G.bossIntro = true; toast('BOSS FIGHT!', 2200); }

    if (me.lives <= 0 && me.dead) endRound(false);
    else if (G.bossDead && !me.dead && me.x > WORLD - 120) endRound(true);   // الفوز عند عبور البوابة

  } else if (G.phase === 'over') {
    G.overT += dt;
    if (G.overT > 1.5 && $('#result').hidden) showResult();
    if (me) me.inv = Math.max(0, me.inv - dt);
  }

  for (const p of parts) { p.l -= dt; p.x += p.vx * dt; p.y += (p.vy || 0) * dt; p.z += p.vz * dt; p.vz -= 520 * dt; }
  parts = parts.filter(p => p.l > 0);
  for (const c of crates) if (c.broken && c.wreckT > 0) c.wreckT -= dt;
  for (const b of barrels) if (b.exploded && b.wreckT > 0) b.wreckT -= dt;
  for (const e of explosions) e.t += dt;
  explosions = explosions.filter(e => e.t < e.dur);
  for (const f of floaters) f.t += dt;
  floaters = floaters.filter(f => f.t < 1);
  shake = Math.max(0, shake - dt * 20);

  if (me) {
    const tgt = me.x - VW * .38 + me.face * 20;
    cam += (tgt - cam) * Math.min(1, dt * 6);
    cam = clamp(cam, 0, WORLD - VW);
  }
}

function updateHUD() {
  const f = me;
  if (!f) return;

  const tEl = $('#timer');
  if (tEl) {
    tEl.hidden = !(G.phase === 'play' || G.phase === 'count' || G.phase === 'over');
    const s = Math.ceil(G.timeLeft || 0);
    if (tEl.textContent !== String(s)) tEl.textContent = s;
    tEl.classList.toggle('low', s <= 10 && G.phase === 'play');
  }

  const bs = enemies.find(e => e.k === 'boss'), bb = $('#bossbar');
  bb.hidden = !(bs && bs.active && bs.st !== 'dead');
  if (!bb.hidden) $('#bossbar i').style.transform = 'scaleX(' + clamp(bs.hp / bs.maxHp, 0, 1) + ')';

  const b = $('#hp0 .bar i');
  if (b) b.style.transform = 'scaleX(' + clamp(f.hp / 100, 0, 1) + ')';

  const p = $('#hp0 .pips');
  if (p && p.childElementCount !== 3) {
    let h = '';
    for (let i = 0; i < 3; i++) h += '<span class="pip' + (i < f.lives ? '' : ' off') + '"></span>';
    p.innerHTML = h;
  } else if (p) {
    Array.from(p.children).forEach((el, i) => el.classList.toggle('off', i >= f.lives));
  }

  // زر USE يتغير حسب السلاح المختار: قبضة / سكين / سلاح ناري
  const wt = getWeapon(f);
  const useSrc = (IMG.use[f.weapon] || IMG.use.fist).src;
  if (useImg.src !== useSrc) useImg.src = useSrc;
  const showMine = f.mines > 0;
  if (mineBtn.hidden === showMine) mineBtn.hidden = !showMine;
  grenBtn.classList.toggle('empty', f.bombs <= 0);   // رمادي شفاف عند انتهاء القنابل

  const wEl = $('#w0');
  if (wEl) {
    const order = WEAPON_ORDER;
    let html = '';
    for (const w of order) {
      const am = f.weapons[w];
      if (!(am > 0)) continue;
      let icon = IMG.item_knife.src;
      if (w === 'fist') icon = IMG.item_fist.src;
      else if (w === 'pistol') icon = IMG.item_pistol.src;
      else if (w === 'shotgun') icon = IMG.item_shotgun.src;
      else if (w === 'smg') icon = IMG.item_smg.src;
      html += '<div class="wslot' + (f.weapon === w ? ' active' : '') + '"><img src="' + icon + '"><span class="am">' + (am === Infinity ? '∞' : am) + '</span></div>';
    }
    if (f.bombs > 0) html += '<div class="wslot"><img src="' + IMG.item_bomb.src + '"><span class="am">' + f.bombs + '</span></div>';
    if (f.mines > 0) html += '<div class="wslot"><img src="' + IMG.item_mine.src + '"><span class="am">M' + f.mines + '</span></div>';
    if (wEl.innerHTML !== html) wEl.innerHTML = html;
  }
}

// ==========================================
// INPUT HANDLING
// ==========================================
const KEYS = { ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r', ArrowUp: 'u', w: 'u', W: 'u', ArrowDown: 'd', s: 'd', S: 'd' };
addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  const k = KEYS[e.key];
  if (k) { inp[k] = true; e.preventDefault(); return; }
  if (e.repeat) return;
  if (e.key === 'j' || e.key === 'J' || e.key === 'z' || e.key === 'Z') { inp.atk = true; e.preventDefault(); }
  else if (e.key === 'k' || e.key === 'K' || e.key === 'x' || e.key === 'X' || e.key === ' ') { inp.jmp = true; e.preventDefault(); }
  else if (e.key === 'q' || e.key === 'Q') { inp.sw = true; e.preventDefault(); }
  else if (e.key === 'g' || e.key === 'G') { inp.bomb = true; e.preventDefault(); }
  else if (e.key === 'e' || e.key === 'E') { inp.mine = true; e.preventDefault(); }
});
addEventListener('keyup', e => { const k = KEYS[e.key]; if (k) inp[k] = false; });
addEventListener('blur', () => { inp.l = inp.r = inp.u = inp.d = false; });

const pad = $('#pad'), knob = $('#knob');
let padId = null;
function padSet(e) {
  const r = pad.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2);
  const m = Math.hypot(dx, dy);
  if (m > 1) { dx /= m; dy /= m; }
  padX = Math.abs(dx) > .28 ? Math.sign(dx) * Math.min(1, Math.abs(dx) * 1.15) : 0;
  padY = Math.abs(dy) > .28 ? Math.sign(dy) * Math.min(1, Math.abs(dy) * 1.15) : 0;
  knob.style.transform = 'translate(' + (dx * 70) + '%,' + (dy * 70) + '%)';
}
function padEnd(e) {
  if (e.pointerId === padId) { padId = null; padX = 0; padY = 0; knob.style.transform = ''; }
}
pad.addEventListener('pointerdown', e => { padId = e.pointerId; try { pad.setPointerCapture(e.pointerId); } catch(x) {} padSet(e); e.preventDefault(); });
pad.addEventListener('pointermove', e => { if (e.pointerId === padId) padSet(e); });
pad.addEventListener('pointerup', padEnd);
pad.addEventListener('pointercancel', padEnd);

const useImg = $('#bAtk img'), mineBtn = $('#bMine'), grenBtn = $('#bGren');
function bindBtn(el, key) {
  el.addEventListener('pointerdown', e => { inp[key] = true; el.classList.add('down'); e.preventDefault(); });
  const up = () => el.classList.remove('down');
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('pointerleave', up);
}
bindBtn($('#bAtk'), 'atk'); bindBtn($('#bJump'), 'jmp'); bindBtn($('#bSwitch'), 'sw'); bindBtn($('#bGren'), 'bomb'); bindBtn($('#bMine'), 'mine');

function checkTouch() {
  const t = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || matchMedia('(pointer:coarse)').matches || innerWidth <= 820;
  document.body.classList.toggle('touch', !!t);
}
function resize() {
  checkTouch();
  const st = $('#stage'), r = st.getBoundingClientRect();
  const aw = Math.max(200, r.width), ah = Math.max(120, r.height);
  const ratio = Math.min(3, Math.max(1.35, aw / ah));   // يملأ الشاشة كلها بنسبتها الحقيقية
  VW = Math.round(H * ratio);
  const w = Math.min(aw, ah * ratio), h = w / ratio;
  frame.style.width = w + 'px'; frame.style.height = h + 'px'; frame.style.aspectRatio = 'auto';
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  cv.width = Math.max(2, Math.round(w * dpr)); cv.height = Math.max(2, Math.round(h * dpr));
  SC = cv.width / VW;
  CS = w / VW;
}
addEventListener('resize', resize);
resize();

$('#rAgain').addEventListener('click', playAgain);
$('#rMenu').addEventListener('click', () => { window.location.href = 'home.html'; });
const ICON_ON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9H3z" fill="currentColor"/><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
const ICON_OFF = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 9v6h4l5 4V5L7 9H3z" fill="currentColor"/><path d="M16 9l6 6M22 9l-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
function paintMute() {
  const b = $('#mute');
  b.innerHTML = muted ? ICON_OFF : ICON_ON;
  b.setAttribute('aria-label', muted ? 'Sound off' : 'Sound on');
  b.classList.toggle('off', muted);
}
paintMute();
$('#mute').addEventListener('click', () => {
  muted = !muted;
  paintMute();
  SND.bgm.muted = muted;
});

const ICON_PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor"/></svg>';
const ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z" fill="currentColor"/></svg>';
function paintPause() {
  const b = $('#pause');
  b.innerHTML = G.paused ? ICON_PLAY : ICON_PAUSE;
  b.setAttribute('aria-label', G.paused ? 'Resume' : 'Pause');
}
paintPause();
$('#pause').addEventListener('click', () => setPause(!G.paused));
addEventListener('keydown', e => {
  if (e.repeat) return;
  if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') { setPause(!G.paused); e.preventDefault(); }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) setPause(true); });

let last = performance.now(), T0 = last;
function loop(now) {
  const dt = Math.min(.05, (now - last) / 1000);
  last = now; G.t = (now - T0) / 1000;
  try {
    if (!G.paused) stepGame(dt);
    render(G.t);
    if (G.phase !== 'menu') updateHUD();
    updateTimeWarning();
  } catch (err) { console.error(err); }
  requestAnimationFrame(loop);
}

// ننتظر تحميل الخلفية ليُضبط طول العالم قبل بدء اللعب
let tries = 0;
function boot() {
  if ((IMG.bg.complete && IMG.bg.naturalWidth) || tries++ > 50) {
    fitWorld();
    initGame();
    last = performance.now();
    requestAnimationFrame(loop);
  } else setTimeout(boot, 100);
}
setTimeout(boot, 300);

})();