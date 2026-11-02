// Game.js - بطل واحد ضد الأعداء + زعيم + بوابة النهاية
(function(){
'use strict';

const $ = (s, r) => (r || document).querySelector(s);
const cv = $('#cv'), ctx = cv.getContext('2d');
const frame = $('#frame');

// خلفيات المراحل الأربع: لا يفوز اللاعب إلا بعد إكمال المراحل 1 → 4
const BG_IMGS = [0, 1, 2, 3, 4].map(n => 'images/backgrounds/background-stage' + n + '.png');   // المرحلة 0 (السطح) ثم 1 → 4
const BG_IMG = BG_IMGS[0];
let bgCropH = 0;     // 0 = الصورة كاملة تملأ ارتفاع الشاشة

// طبقة الخلفية (عنصر HTML حتى يتحرك الـ GIF) + طبقة الشخصيات (عناصر img متحركة)
const bgDiv = document.createElement('div');
bgDiv.style.cssText = 'position:absolute;inset:0;z-index:0;pointer-events:none;background:#2a1850 url(' + BG_IMG + ') no-repeat 0 0;background-size:auto 100%;transition:opacity .45s';
frame.insertBefore(bgDiv, cv);
cv.style.position = 'relative';
const stageLbl = document.createElement('div');
stageLbl.hidden = true;
stageLbl.style.cssText = 'position:absolute;left:50%;top:calc(var(--u,4px)*1.2 + max(20px,calc(var(--u,4px)*6.6)) + 6px);transform:translateX(-50%);z-index:3;pointer-events:none;direction:ltr;white-space:nowrap;font-family:var(--f-display,Lalezar),sans-serif;font-size:max(11px,calc(var(--u,4px)*2.8));color:var(--gold,#ffc233);text-shadow:0 2px 0 #000,0 0 6px #000;letter-spacing:.04em';
frame.appendChild(stageLbl);
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
// ارتفاع سطح الصندوق/البرميل الذي يقف عليه البطل بعد القفز (بنفس وحدات z)
const PROP_TOP = { crate: 34, barrel: 38 };
const PROP_HALF = { x: 22, y: 13 };   // مساحة السطح الذي يمكن الوقوف عليه
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

// ==========================================
// SPRITE SHEETS (بدل صور GIF): كل حركة = صورة PNG فيها الإطارات متجاورة،
// والكود يعرض الإطار المناسب حسب الوقت (مثل الألعاب الحقيقية). البيانات في sprites.js
// ==========================================
const SHEETS = window.SPRITES || null;
// كل صورة حركة في مجلدها: الأبطال، الأعداء، الأسلحة، عناصر الطريق
const IMG_DIR = {
  backgrounds: 'images/backgrounds/', heroes: 'images/heroes/', enemies: 'images/enemies/',
  buttons: 'images/buttons/', items: 'images/items/', weapons: 'images/weapons/', ui: 'images/ui/'
};
function sheetDir(name) {
  let m = /^(player\d+h)/.exec(name);
  if (m) return IMG_DIR.heroes + m[1] + '/';                // كل بطل في مجلده: images/heroes/player1h/
  m = /^(enemy\d+)/.exec(name);
  if (m) return IMG_DIR.enemies + m[1] + '/';               // كل عدو في مجلده: images/enemies/enemy1/
  if (name === 'Landmine') return IMG_DIR.weapons;         // اللغم
  return IMG_DIR.items;                                    // الصناديق، البراميل، الانفجار، Checkpoint
}
function makeSheet(name) {
  const M = SHEETS[name], img = new Image(), dir = sheetDir(name);
  img.src = dir + name + '.png';
  const cum = []; let total = 0;
  for (const d of M.d) { total += d; cum.push(total); }
  return {
    sheet: true, name: name, M: M, img: img, cum: cum, total: total, rows: Math.ceil(M.n / M.c),
    url: dir + name + '.png', src: dir + name + '.png',
    icon: name === 'Landmine' ? dir + 'Landmine_icon.png' : dir + name + '.png',
    // نفس خصائص صورة GIF القديمة حتى يعمل باقي الكود كما هو (أبعاد الإطار الأصلي)
    get complete() { return img.complete && img.naturalWidth > 0; },
    get naturalWidth() { return img.complete && img.naturalWidth ? M.o[2] : 0; },
    get naturalHeight() { return img.complete && img.naturalWidth ? M.o[3] : 0; },
    addEventListener(t, f, o) { img.addEventListener(t, f, o); }
  };
}
// رقم الإطار بعد ms من بداية الحركة (تكرار، أو التوقف على آخر إطار للحركات التي تُعرض مرة واحدة)
function sheetFrame(S, ms) {
  if (S.M.n <= 1) return 0;
  if (!S.M.loop && ms >= S.total) return S.M.n - 1;
  const t = ms % S.total;
  let i = 0; while (i < S.cum.length - 1 && t >= S.cum[i]) i++;
  return i;
}
// تحميل حركة باسمها (مثل 'enemy1_walk'): الصورة من مجلدها حسب sheetDir
function loadAnim(name) { return makeSheet(name); }
function loadImg(src) {
    const img = document.createElement('img');
    img.src = src;
    hiddenAssets.appendChild(img);
    return img;
}

const IMG = {
    // خلفية المرحلة 0 فقط تُحمَّل فوراً، والباقي في الخلفية بعد بدء اللعبة (أسرع بكثير عند الفتح)
    bgs: BG_IMGS.map((src, i) => { const im = document.createElement('img'); hiddenAssets.appendChild(im); if (i === 0) im.src = src; else im.dataset.src = src; return im; }),
    bg: null,
    gate: loadAnim('endpoint'),          // بوابة الفوز: في آخر مرحلة فقط
    checkpoint: loadAnim('Checkpoint'),  // نهاية المراحل 1 و 2 و 3
    explosion: loadAnim('explosion'),
    crates: CRATE_SETS.map(o => ({ ok: loadAnim(`${o.ok}`), br: loadAnim(`${o.br}`) })),
    barrels: BARREL_SETS.map(o => ({ ok: loadAnim(`${o.ok}`), br: loadAnim(`${o.br}`) })),
    use: {
        fist: loadImg('images/buttons/btn-boxing.png'), knife: loadImg('images/buttons/btn-knef.png'),
        pistol: loadImg('images/buttons/btn-Pistol.png'), shotgun: loadImg('images/buttons/btn-Rifle.png'), smg: loadImg('images/buttons/btn-machinegun.png')
    },
    item_fist: loadImg('images/buttons/btn-boxing.png'),
    item_health: loadImg('images/items/heart.png'),
    item_pistol: loadImg('images/weapons/Pistol-gun.png'),
    item_smg: loadImg('images/weapons/machine-gun.png'),
    item_shotgun: loadImg('images/weapons/Rifle-gun.png'),
    item_knife: loadImg('images/weapons/knef.png'),
    item_shuriken: loadImg('images/weapons/knef.png'),   // سكين الطريق (الأرض)
    item_ammo: loadImg('images/weapons/bullets.png'),
    item_bomb: loadImg('images/weapons/bomb.png'),
    item_mine: loadAnim('Landmine'),   // اللغم الأرضي
    enemies: {}
};
IMG.bg = IMG.bgs[0];
function bgStart(i) { const im = IMG.bgs[i]; if (im && !im.getAttribute('src') && im.dataset.src) im.src = im.dataset.src; }
function bgReady(i) { const im = IMG.bgs[i]; if (!im) return true; bgStart(i); return im.complete && im.naturalWidth > 0; }
// تحميل خلفيات المراحل التالية واحدة بعد الأخرى دون أن تزاحم بداية اللعبة
function preloadRest(i) {
  i = i || 1;
  const im = IMG.bgs[i]; if (!im) return;
  const next = () => setTimeout(() => preloadRest(i + 1), 50);
  if (im.complete && im.naturalWidth) return next();
  im.addEventListener('load', next, { once: true }); im.addEventListener('error', next, { once: true });
  bgStart(i);
}

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
    loot: '_loot', victory: '_victory',
    up: '_up'                         // القفز: صورة واحدة (playerNhup.png) طوال القفزة
};
function loadPlayerSprites(base, obj, idx) {
    for (const k in PLAYER_SUFFIX) obj[k] = loadAnim(`${base}${PLAYER_SUFFIX[k]}`);
    const sf = SHOOT_FILES[idx];
    for (const k in sf) obj[k] = loadAnim(`${base}${sf[k]}`);
}
// الأبطال الأربعة: نفس أسماء الملفات ونفس الكود لكل بطل (player1h ... player4h)
// الحركات: player1h.gif / _walk / _punch / _sword / _gun / _Pistol / _machinegun / _Rifle / _shoot* (قديم) / _bomb / _injured / _death / _loot / _victory
const HEROES = [
  { id: 'player1h', name: 'JACK' },
  { id: 'player2h', name: 'REX' },
  { id: 'player3h', name: 'MINA' },
  { id: 'player4h', name: 'MAX' }
];
IMG.heroes = HEROES.map(() => ({}));
loadPlayerSprites(HEROES[gameConfig.side].id, IMG.heroes[gameConfig.side], gameConfig.side);   // البطل المختار فوراً
IMG.car = document.createElement('img');   // سيارة المشهد الأخير (تُحمَّل لاحقاً)
function loadOtherHeroes() {   // الأبطال الآخرون (رهائن/حلفاء) بعد بدء اللعبة
  if (!IMG.car.getAttribute('src')) { hiddenAssets.appendChild(IMG.car); IMG.car.src = 'images/items/car.png'; }
  HEROES.forEach((h, i) => { if (!IMG.heroes[i].idle) loadPlayerSprites(h.id, IMG.heroes[i], i); });
}
// الرهائن (الأبطال وهم مربوطون): player1h-shok / player2h--gameover / player3h-gameover / player4h--gameover
// صورة كل بطل وهو مربوط تُختار من رقمه (player1h ... player4h)، فالرهائن هم دائماً الأبطال الثلاثة الآخرون غير الذي تلعب به
const HOSTAGE_FILES = [
  ['player1h-shok', 'player1h--gameover', 'player1h-gameover'],      // JACK
  ['player2h--gameover', 'player2h-gameover', 'player2h-shok'],      // REX
  ['player3h-gameover', 'player3h--gameover', 'player3h-shok'],      // MINA
  ['player4h--gameover', 'player4h-gameover', 'player4h-shok']       // MAX
];
IMG.hostage = HOSTAGE_FILES.map(list => {
  return loadAnim(list.find(n => SHEETS[n]) || list[0]);   // أول اسم موجود من الأسماء المحتملة
});

// الأعداء: enemyN.gif / enemyN_walk / enemyN_punch / enemyN_injured / enemyN_death
function loadEnemySprites(n) {
    return {
        idle:    loadAnim(`enemy${n}`),
        walk:    loadAnim(`enemy${n}_walk`),
        punch:   loadAnim(`enemy${n}_punch`),
        injured: loadAnim(`enemy${n}_injured`),
        death:   loadAnim(`enemy${n}_death`)
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
// مقياس الخلفية الحالية: بيكسل الصورة → وحدات العالم
// مقياس إحداثيات المرحلة → وحدات العالم.
// كل الأماكن (النار، الماء، النافذة، الرهينة، حدود المشي، الباب...) مكتوبة بإحداثيات "صورة مرجعية" (ref)،
// فإذا صُغّرت صورة الخلفية أو كُبّرت تبقى الأماكن صحيحة تلقائياً (الخلفية تملأ ارتفاع الشاشة دائماً).
function bgScale() {
  const S = curStage();
  if (S && S.ref) return H / S.ref[1];
  const b = IMG.bg; return b && b.naturalHeight ? H / (bgCropH && bgCropH < b.naturalHeight ? bgCropH : b.naturalHeight) : 1;
}

// ---------- شعلات متحركة فوق النار المرسومة في الخلفية ----------
function flameNoise(t, seed) { return Math.sin(t * 9.1 + seed) * .5 + Math.sin(t * 15.7 + seed * 2.3) * .3 + Math.sin(t * 23.3 + seed * 4.1) * .2; }
function flameTongue(g, x, y, w, h, sway, col) {
  g.fillStyle = col;
  g.beginPath();
  g.moveTo(x - w / 2, y);
  g.bezierCurveTo(x - w / 2, y - h * .45, x - w * .15 + sway * .5, y - h * .7, x + sway, y - h);
  g.bezierCurveTo(x + w * .15 + sway * .5, y - h * .7, x + w / 2, y - h * .45, x + w / 2, y);
  g.closePath(); g.fill();
}
function drawFlames(g, t) {
  const list = curStage().flames;
  if (!list) return;
  const k = bgScale();
  g.save();
  for (let i = 0; i < list.length; i++) {
    const f = list[i], x = f.x * k - cam, y = f.y * k, w = f.w * k, h = f.h * k;
    if (x < -w * 3 || x > VW + w * 3) continue;
    const n = flameNoise(t, i * 1.7), big = f.kind === 'fire';
    // توهج يتنفس حول الشعلة
    const gr = h * (big ? 1.5 : 1.9) * (1 + n * .08);
    const glow = g.createRadialGradient(x, y - h * .45, 1, x, y - h * .45, gr);
    glow.addColorStop(0, 'rgba(255,170,60,' + (big ? .28 : .32) * (1 + n * .25) + ')');
    glow.addColorStop(1, 'rgba(255,120,30,0)');
    g.fillStyle = glow; g.beginPath(); g.arc(x, y - h * .45, gr, 0, 6.3); g.fill();
    // ألسنة اللهب
    const tongues = big ? (LOWQ ? 3 : 5) : 1;
    for (let j = 0; j < tongues; j++) {
      const off = big ? (j - (tongues - 1) / 2) / (tongues - 1) * w * .5 : 0;
      const nj = flameNoise(t * (1 + j * .13), i * 3 + j * 1.3);
      const hh = h * (big ? (1 - Math.abs(off) / w * 1.1) : 1) * (.85 + nj * .18);
      const ww = big ? w * .3 : w;
      const sway = nj * ww * .35;
      const a = big ? .6 : 1;   // نار المدفأة أشفّ حتى تظهر النار المرسومة تحتها
      g.globalAlpha = .45 * a; flameTongue(g, x + off, y, ww, hh, sway, '#ff5a14');
      g.globalAlpha = .55 * a; flameTongue(g, x + off, y, ww * .68, hh * .78, sway * .8, '#ffa322');
      g.globalAlpha = .65 * a; flameTongue(g, x + off, y, ww * .38, hh * .5, sway * .6, '#fff2a8');
    }
    g.globalAlpha = 1;
    // شرر يتطاير من المدفأة
    if (big && G.phase !== 'menu' && Math.random() < .12)
      parts.push({ x: f.x * k + rr(-w * .3, w * .3), y: y, z: rr(h * .3, h * .6), vx: rr(-15, 15), vz: rr(40, 90), l: rr(.4, .8), c: Math.random() < .5 ? '#ffd27a' : '#ff8a3a' });
  }
  g.restore();
}

function fitWorld() {
    const b = IMG.bg;
    if (b.naturalWidth && b.naturalHeight) {
      const ch = bgCropH && bgCropH < b.naturalHeight ? bgCropH : b.naturalHeight;
      WORLD = Math.round(b.naturalWidth * H / ch);
      bgDiv.style.backgroundSize = 'auto ' + (b.naturalHeight / ch * 100).toFixed(3) + '%';
    }
}
fitWorld();
IMG.bg.addEventListener('load', fitWorld);

// ==========================================
// الجودة: وضع منخفض تلقائي للهواتف الضعيفة
// - يبدأ منخفضاً إذا كان الجهاز ضعيفاً (ذاكرة ≤ 3GB أو معالج ≤ 4 أنوية)
// - ويتحول تلقائياً إلى منخفض إذا نزلت سرعة اللعبة عن 45 إطاراً في الثانية، ويتذكر ذلك للمرة القادمة
// - للتجربة: game.html?q=low أو game.html?q=high
// ==========================================
const IS_TOUCH = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
let LOWQ = (() => {
  const q = new URLSearchParams(location.search).get('q');
  if (q === 'low') return true;
  if (q === 'high') return false;
  try { if (localStorage.getItem('tr_quality') === 'low') return true; } catch (e) {}
  const mem = navigator.deviceMemory || 8, cores = navigator.hardwareConcurrency || 8;
  return mem <= 3 || cores <= 4;
})();
const QFORCED = /[?&]q=(low|high)/.test(location.search);
function setLowQuality() {
  if (LOWQ) return;
  LOWQ = true; seaFx = null;
  try { localStorage.setItem('tr_quality', 'low'); } catch (e) {}
  resize();
}
// مراقبة السرعة أثناء اللعب
const fpsMon = { t: 0, n: 0, bad: 0, warm: 0 };
function watchFps(dt) {
  // نقيس فقط أثناء اللعب الفعلي، ونتجاهل أول 4 ثوانٍ (تحميل الصور يبطئ اللعبة لحظياً في البداية)
  if (LOWQ || QFORCED || G.paused || document.hidden || !(G.phase === 'play' || G.phase === 'ending')) { fpsMon.t = fpsMon.n = 0; fpsMon.warm = 0; return; }
  if ((fpsMon.warm += dt) < 4) return;
  fpsMon.t += dt; fpsMon.n++;
  if (fpsMon.t >= 2) {
    const fps = fpsMon.n / fpsMon.t; fpsMon.t = fpsMon.n = 0;
    fpsMon.bad = fps < 42 ? fpsMon.bad + 1 : 0;
    if (fpsMon.bad >= 3) setLowQuality();   // 6 ثوانٍ متتالية بطيئة
  }
}

// ==========================================
// SOUND MANAGEMENT
// ==========================================
// المؤثرات الصوتية بـ Web Audio: بدون تأخر على الهواتف، ويمكن تشغيل نفس الصوت عدة مرات في نفس الوقت.
// الموسيقى الخلفية تبقى عنصر Audio عادي (ملف طويل يُشغَّل تدريجياً).
// إذا لم يعمل Web Audio (مثلاً فتح اللعبة من ملف محلي) يرجع تلقائياً إلى Audio العادي.
// المتصفح يمنع تشغيل الصوت قبل أول لمسة/ضغطة من اللاعب، لذلك ننشئ محرك الصوت بعد أول لمسة فقط.
// الملفات تُحمَّل من البداية (بدون فك)، وتُفك مباشرة بعد أول لمسة.
const AC_CLASS = window.AudioContext || window.webkitAudioContext;
let AC = null, sfxOut = null;
const sfxAll = [];
function userActive() { const u = navigator.userActivation; return !u || u.hasBeenActive; }
function unlockAudio() {
  if (!AC_CLASS || location.protocol === 'file:' || !userActive()) return;
  if (!AC) {
    try { AC = new AC_CLASS(); sfxOut = AC.createGain(); sfxOut.connect(AC.destination); } catch (e) { AC = null; return; }
    sfxAll.forEach(s => s.decode());
  }
  if (AC.state === 'suspended') AC.resume().catch(() => {});
  // الموسيقى: إذا منعها المتصفح في البداية تبدأ مع أول لمسة
  if (typeof SND !== 'undefined' && !muted && SND.bgm.paused && !G.paused && G.phase !== 'over') SND.bgm.play().catch(() => {});
}
['pointerup', 'touchend', 'keydown', 'click', 'mousedown'].forEach(ev => addEventListener(ev, unlockAudio, { capture: true, passive: true }));
function mkSfx(url, opt) {
  opt = opt || {};
  const s = { url: url, buf: null, el: null, loop: !!opt.loop, vol: opt.vol == null ? 1 : opt.vol, src: null, last: 0, _paused: true };
  const useEl = () => { if (!s.el) { s.el = new Audio(url); s.el.loop = s.loop; s.el.volume = s.vol; s.el.preload = 'auto'; } };
  s.ab = null;
  s.decode = function () {
    if (!AC || !s.ab || s.buf || s.decoding) return;
    s.decoding = true;
    AC.decodeAudioData(s.ab.slice(0), b => { s.buf = b; }, () => useEl());
  };
  if (AC_CLASS && location.protocol !== 'file:') {
    sfxAll.push(s);
    fetch(url).then(r => r.ok ? r.arrayBuffer() : Promise.reject(r.status))
      .then(ab => { s.ab = ab; s.decode(); }).catch(useEl);
  } else useEl();
  s.play = function () {
    if (s.buf && AC) {
      if (AC.state !== 'running') { unlockAudio(); if (AC.state !== 'running' && !s.loop) return Promise.resolve(); }
      if (s.loop && !s._paused) return Promise.resolve();
      const now = AC.currentTime;
      if (!s.loop && now - s.last < .03) return Promise.resolve();   // نفس الصوت مرتين في نفس اللحظة = صوت مزعج
      s.last = now;
      const src = AC.createBufferSource(); src.buffer = s.buf; src.loop = s.loop;
      const g = AC.createGain(); g.gain.value = s.vol;
      src.connect(g); g.connect(sfxOut); src.start();
      if (s.loop) { s.src = src; s._paused = false; src.onended = () => { if (s.src === src) { s.src = null; s._paused = true; } }; }
      return Promise.resolve();
    }
    if (!userActive()) return Promise.resolve();   // قبل أول لمسة: المتصفح سيمنع الصوت على أي حال
    useEl();
    try { if (!s.loop) s.el.currentTime = 0; return s.el.play() || Promise.resolve(); } catch (e) { return Promise.resolve(); }
  };
  s.pause = function () {
    if (s.src) { try { s.src.stop(); } catch (e) {} s.src = null; }
    s._paused = true;
    if (s.el) s.el.pause();
  };
  Object.defineProperty(s, 'paused', { get: () => s.el && !s.buf ? s.el.paused : s._paused });
  Object.defineProperty(s, 'currentTime', { get: () => s.el ? s.el.currentTime : 0, set: v => { if (s.el) try { s.el.currentTime = v; } catch (e) {} } });
  return s;
}
const SND = {
    shoot: mkSfx('sounds/shoot.mp3'),
    hit: mkSfx('sounds/enemy_hit.mp3'),
    swing: mkSfx('sounds/knife.mp3'),
    boom: mkSfx('sounds/booom.mp3'),
    jump: mkSfx('sounds/run.mp3'),
    pick: mkSfx('sounds/powerup_collect.mp3'),
    win: mkSfx('sounds/win_music.mp3'),
    lose: mkSfx('sounds/lose_music.mp3'),
    bgm: new Audio('sounds/background_music.mp3'),
    box_destroy: mkSfx('sounds/box_destroy.mp3'),
    health_refill: mkSfx('sounds/health_refill.mp3'),
    warning: mkSfx('sounds/time_warning.mp3', { loop: true }),  // تنبيه آخر 10 ثوانٍ (يتكرر حتى ينتهي الوقت)
    glass: mkSfx('sounds/Breaking_glass.mp3')    // تكسر النافذة
};
SND.bgm.loop = true; SND.bgm.preload = 'auto';
let muted = false;

function playSnd(s) {
    if (muted || !s) return;
    try { s.play().catch(() => {}); } catch (e) {}
}

// عند خروج اللاعب من التطبيق/التبويب: نوقف كل الأصوات، وعند العودة نكمل الموسيقى
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    SND.bgm.pause(); SND.warning.pause();
    if (AC && AC.state === 'running') AC.suspend().catch(() => {});
  } else {
    if (AC && userActive()) AC.resume().catch(() => {});
    if (!muted && !G.paused && G.phase !== 'over') SND.bgm.play().catch(() => {});
  }
});

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
               catchUp: 330,      // سرعته عند اللحاق (أسرع بكثير من البطل 175 حتى لا يتأخر)
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
// أعداء يهاجمون من بعيد:
//  حارس الغابة (soldier): حركة البندقية تطلق رصاصة حقيقية
//  النينجا (ninja): يرمي سكاكين صغيرة من بعيد، ويضرب باليد من قريب
//  العملاق (brute3): يرمي كرة حديدية تطير في قوس
const RANGED = {
  soldier: { kind: 'bullet', min: 0,   max: 400, keep: 210, cd: [1.5, 2.4], dmg: 9, speed: 560, wind: .35, z: 58 },
  ninja:   { kind: 'knife',  min: 110, max: 360, keep: 0,   cd: [1.6, 2.6], dmg: 7, speed: 430, wind: .2,  z: 48 },
  brute3:  { kind: 'ball',   min: 130, max: 300, keep: 0,   cd: [3, 4.5],   dmg: 14, speed: 0,  wind: .45, z: 70 }
};

// ==========================================
// المراحل الأربع: لكل مرحلة خلفية وأعداء وأحداث وزعيم مختلف
// ==========================================
const SEG_DIST = 750;   // كل 750 بيكسل يظهر طاقم أعداء
const STAGES = [
  { title: 'STAGE 0', name: 'THE ROOFTOP', ref: [2172, 724], rooftop: true,
    // البحر خلف السطح (بإحداثيات الصورة المرجعية): التأثير يُرسم فقط على بكسلات الماء الزرقاء داخل هذه المنطقة
    sea: { x0: 0, x1: 1882, top: 345, bottom: 585, band: [0, 1340, 359, 400], seed: 375 }, event: null, evFirst: 0, evGap: 0, packs: [], boss: null },
  { title: 'STAGE 1', name: 'CASTLE HALL', ref: [8041, 714], event: 'ambush', evFirst: 900, evGap: 1300,
    // من قراءة background-stage1.png (8041×714) بإحداثيات الصورة:
    // نار المدفأتين (المدخنة) والمشاعل الكبيرة على أعمدة الحجر. x = المركز، y = قاعدة اللهب، h = ارتفاعه، w = عرضه
    flames: [
      { kind: 'fire',  x: 2756, y: 418, w: 96, h: 84 },     // المدفأة الأولى
      { kind: 'fire',  x: 6934, y: 418, w: 110, h: 100 },   // المدفأة الثانية
      { kind: 'torch', x: 1028, y: 253, w: 22, h: 36 },
      { kind: 'torch', x: 4108, y: 262, w: 26, h: 42 },
      { kind: 'torch', x: 6511, y: 258, w: 24, h: 40 },
      { kind: 'torch', x: 6775, y: 256, w: 26, h: 42 },
      { kind: 'torch', x: 7095, y: 254, w: 26, h: 42 },
      { kind: 'torch', x: 7512, y: 256, w: 32, h: 58 },
      { kind: 'torch', x: 7817, y: 76,  w: 20, h: 36 }
    ],
    hostageX: 3728,      // الرهينة أسفل عمود الحجر (مركزه في الصورة)، فوق خط المنع العلوي مباشرة
    // النافذة الكبيرة في آخر القاعة: بعد قتل الزعيم يقفز البطل منها ويتكسر الزجاج
    // poly = زوايا الزجاج، cx = نقطة العبور، sill = أسفل النافذة، launchX = مكان الانطلاق للقفز (كلها بإحداثيات الصورة)
    window: { poly: [[7935, 100], [8041, 140], [8041, 410], [7935, 372]], left: 7935, cx: 7990, sill: 372, launchX: 7780 },
    packs: [['thug', 'thug', 'cop'], ['thug', 'cop', 'thug', 'thug'], ['cop', 'cop', 'thug', 'thug'], ['cop', 'thug', 'cop', 'thug', 'thug'], ['thug', 'thug', 'cop', 'cop', 'thug']],
    boss: { type: 'tony', name: 'BIG TONY', spr: 'brute', hp: 300, dmg: 20, spd: 80 } },
  { title: 'STAGE 2', name: 'THE DOCKS', event: 'ninjaDrop', evFirst: 700, evGap: 1000,
    packs: [['ninja', 'thug', 'thug'], ['ninja', 'ninja', 'thug', 'cop'], ['ninja', 'thug', 'cop', 'thug'], ['ninja', 'ninja', 'cop', 'thug', 'thug'], ['ninja', 'ninja', 'ninja', 'cop', 'thug']],
    boss: { type: 'iron', name: 'IRON HANK', spr: 'brute3', hp: 320, dmg: 18, spd: 75 } },
  { title: 'STAGE 3', name: 'WILD FOREST', ref: [7356, 724], event: 'stampede', evFirst: 800, evGap: 1100,
    // من قراءة background-stage3.png (7356×724) بإحداثيات الصورة:
    // المنع من الأعلى فقط: lo = حافة العشب العلوية (لا مشي فوق العشب). من الأسفل كما في باقي المراحل (ينزل حتى يبقى نصفه ظاهراً)
    walk: {
      lo: [[0, 500], [3858, 500], [3868, 522], [4660, 522], [5510, 522], [5530, 527], [7356, 527]]
    },
    hostageX: 3418,      // الرهينة مربوط بجذع الشجرة الكبيرة في الخلفية (مركزه في الصورة)، فوق حافة الطريق العلوية
    // البحيرة: الطريق يكمل داخل الماء (خوض) مع تأثير الماء المتحرك وتموجات الأقدام
    water: { x0: 3864, x1: 4652, top: 520, bottom: 724 },
    packs: [['soldier', 'raptor', 'thug'], ['soldier', 'soldier', 'raptor', 'raptor'], ['soldier', 'ninja', 'raptor', 'raptor'], ['soldier', 'soldier', 'raptor', 'raptor', 'thug'], ['soldier', 'soldier', 'ninja', 'raptor', 'raptor', 'raptor']],
    boss: { type: 'trike', name: 'KING TRIKE', spr: 'trike', hp: 340, dmg: 18, spd: 95 } },
  { title: 'STAGE 4', name: 'THE LOST VALLEY', ref: [4000, 335], event: ['airstrike', 'ninjaDrop', 'ambush'], evFirst: 700, evGap: 1000,
    // من قراءة background-stage4.png (4000×335) بإحداثيات الصورة:
    // المشي فوق التراب فقط (حافة العشب العلوية y≈200)، ولا دخول في خط النار أسفل اليمين
    walk: {
      lo: [[0, 200], [3950, 200], [4000, 272]],
      hi: [[0, 372], [3640, 372], [3668, 286], [3905, 286], [3932, 372], [4000, 372]]
    },
    flames: [   // خط النار على الأرض + النار فوق إطار الباب الحجري
      { kind: 'fire', x: 3700, y: 333, w: 52, h: 40 }, { kind: 'fire', x: 3748, y: 333, w: 56, h: 46 },
      { kind: 'fire', x: 3798, y: 333, w: 56, h: 42 }, { kind: 'fire', x: 3846, y: 333, w: 56, h: 46 },
      { kind: 'fire', x: 3884, y: 333, w: 40, h: 36 },
      { kind: 'fire', x: 3975, y: 50, w: 52, h: 46 }
    ],
    // الماء: البحيرة والشلالات خلف السياج الخشبي + بحيرات صغيرة بعيدة
    pools: [
      { x0: 3215, x1: 3505, top: 112, bottom: 152 },
      { x0: 1712, x1: 1765, top: 118, bottom: 142 },
      { x0: 225, x1: 322, top: 139, bottom: 157 },
      { x0: 2272, x1: 2298, top: 139, bottom: 155 }
    ],
    // الباب الحجري الأخير (حافة الصورة اليمنى): يُفجَّر بقنبلة بعد قتل الزعيم ثم يدخل البطل عبره جرياً
    stoneDoor: { x0: 3958, x1: 4000, top: 32, bottom: 205, cx: 3982 },
    packs: [['soldier', 'ninja', 'cop', 'thug'], ['soldier', 'soldier', 'ninja', 'thug', 'cop'], ['ninja', 'ninja', 'soldier', 'cop', 'raptor'], ['soldier', 'ninja', 'cop', 'cop', 'raptor', 'thug'], ['soldier', 'soldier', 'ninja', 'ninja', 'cop', 'thug', 'raptor']],
    boss: { type: 'warlord', name: 'THE WARLORD', spr: 'boss', hp: 460, dmg: 18, spd: 90 } }
];
const STAGE_COUNT = STAGES.length;   // 5 = المرحلة 0 + المراحل 1-4
const LAST_NUM = STAGE_COUNT - 1;    // رقم آخر مرحلة (4)

// ==========================================
// المرحلة 0: سطح المبنى (background-stage0.png 2172×724 → العالم 1200×400)
// كل الإحداثيات هنا بإحداثيات الصورة نفسها، وتُحوَّل للعالم بـ IK (400/724).
// قرأت الخلفية: الأرضية = البلاط بين الحاجز الخلفي (y≈450) وحافة الجدار الأمامي (y≈548)،
// حافة السطح اليسرى مائلة (هاوية) من x≈870 في الخلف إلى x≈1030 في الأمام،
// الجدار الأمامي ينحدر بين x≈1550 و 1690 فتتسع الأرضية حتى y≈632، الصناديق المكدسة عند x≈1810-1900،
// جدار المبنى يميل حتى الباب الأزرق (x≈2020-2068، y≈402-597)، والبراميل بعده عند x≈2100.
// ==========================================
const IK = 400 / 724;                      // صورة → عالم
const S0 = {
  minX: 870 * IK, maxX: 2090 * IK,
  heroX: 1086 * IK, heroY: 500 * IK,      // البطل عند بداية النصف الثاني من الصورة
  door: { x: 2044 * IK, left: 2020 * IK, right: 2068 * IK, top: 402 * IK, bottom: 597 * IK, hp: 60 },
  // سطح المبنى الأيمن (فوق الباب): الأعداء يقفون عليه ثم يقفزون. sy = موضع أقدامهم على الشاشة
  roofs: [{ x: 1915 * IK, sy: 298 * IK }, { x: 1990 * IK, sy: 322 * IK }, { x: 2060 * IK, sy: 348 * IK }],
  waves: [['thug', 'thug'], ['thug', 'cop', 'thug'], ['cop', 'ninja', 'thug', 'cop']],
  intro: 5.2                           // مدة المشهد السينمائي بالثواني
};
// حدود الأرضية (أدنى وأعلى y بالعالم) عند موضع x في المرحلة 0
function s0Bounds(x) {
  const xi = x / IK;
  let lo = 452;                                       // الحاجز الخلفي
  if (xi > 1800) lo = 500;                            // أمام الصناديق المكدسة
  if (xi > 1900) lo = 500 + (xi - 1900) * .65;        // جدار المبنى المائل حتى الباب
  const hi = 546 + clamp((xi - 1550) / 140, 0, 1) * 86;   // حافة الجدار الأمامي ثم انحدارها
  return [lo * IK, Math.max(lo + 8, hi) * IK];
}
// حافة السطح اليسرى المائلة (الهاوية): أقل x مسموح عند العمق y
function s0MinX(y) { return (870 + (y / IK - 452) * 1.65) * IK; }
// حدود الأرضية حسب المرحلة
function polyAt(pts, xi) {
  if (xi <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) if (xi <= pts[i][0]) { const a = pts[i - 1], b = pts[i]; return a[1] + (b[1] - a[1]) * (xi - a[0]) / (b[0] - a[0]); }
  return pts[pts.length - 1][1];
}
function walkBounds(W, x) { const k = bgScale(), xi = x / k; return [polyAt(W.lo, xi) * k, W.hi ? polyAt(W.hi, xi) * k : YB]; }
function yBounds(x) {
  if (G.stage === 0) return s0Bounds(x);
  const W = curStage().walk;
  return W ? walkBounds(W, x) : [Y0, YB];
}
// مسار عشوائي داخل الأرضية المسموحة عند x (لظهور الأعداء)
function laneAt(x) { const b = yBounds(x); const lo = b[0] + 6, hi = Math.min(b[1], Y1 + 20) - 6; return hi > lo ? rr(lo, hi) : (b[0] + b[1]) / 2; }
function clampY(o) {
  const b = yBounds(o.x); o.y = clamp(o.y, b[0], b[1]);
  if (G.stage === 0) o.x = clamp(o.x, s0MinX(o.y), S0.maxX);
}
function enemyMaxX(e) { return G.stage === 0 ? S0.maxX : (e.arena ? WORLD - 200 : WORLD - ARENA); }
function enemyMinX() { return G.stage === 0 ? S0.minX : 20; }
const curStage = () => STAGES[G.stage] || STAGES[0];

let packPlan = [];
function pickDifferent(n, prev) {
  let i; do { i = Math.floor(Math.random() * n); } while (n > 1 && i === prev);
  return i;
}
function makeEnemyPlan() {
  packPlan = [];
  const S = curStage();
  if (!S.packs.length) return;
  const count = Math.max(2, Math.floor(ROAD() / SEG_DIST));
  for (let i = 0; i < count; i++) packPlan.push(S.packs[i < S.packs.length ? i : 2 + Math.floor(Math.random() * (S.packs.length - 2))]);
}

const DIFF = [
  { spd: .82, dmg: .8, cd: 1.3 },
  { spd: 1, dmg: 1, cd: 1 },
  { spd: 1.25, dmg: 1.25, cd: .72 }
];

const G = {
  phase: 'menu', side: gameConfig.side, diff: gameConfig.diff,
  time: 0, kills: 0, dmgDealt: 0, countT: 0, overT: 0, result: null,
  bossDead: false, bossIntro: false, t: 0,
  stage: 0, stagesCleared: 0, evX: 0, transT: 0
};

let me = null;
let allies = [], hostages = [];
let enemies = [], items = [], parts = [], floaters = [], bullets = [], bombs = [], mines = [], crates = [], barrels = [], explosions = [], lobs = [], shards = [];
let uiHidden = false;
let cam = 0, shake = 0, waveIdx = 0, lastCount = -1;
const inp = { l: false, r: false, u: false, d: false, atk: false, jmp: false, sw: false, bomb: false, mine: false };
let padX = 0, padY = 0;

// ==========================================
// HERO & COMBAT
// ==========================================
function mkHero(side) {
  const w = { fist: Infinity, knife: Infinity, pistol: 0, smg: 0, shotgun: 0 };
  return {
    side: side, x: START, y: 312, z: 0, vz: 0, vx: 0, gz: 0,
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

// الصناديق والبراميل والأسلحة داخل الأرضية المسموحة، وخارج البحيرة
function fitObjectsToGround() {
  const S = curStage(), k = bgScale(), Wt = S.water;
  const fit = o => {
    if (Wt && o.x > Wt.x0 * k - 40 && o.x < Wt.x1 * k + 40) o.x = (o.x - Wt.x0 * k < Wt.x1 * k - o.x) ? Wt.x0 * k - 50 : Wt.x1 * k + 50;
    if (S.hostageX && Math.abs(o.x - S.hostageX * k) < 80) o.x = S.hostageX * k + (o.x < S.hostageX * k ? -90 : 90);   // بعيداً عن الرهينة
    const b = yBounds(o.x); o.y = clamp(o.y, b[0] + 12, b[1] - 6);
  };
  crates.forEach(fit); barrels.forEach(fit); items.forEach(fit);
}

function hurtMe(dmg, dir, kd, fromExplosion) {
  const m = me;
  if (!m || m.inv > 0 || m.dead || G.phase !== 'play') return false;
  if (G.armor) dmg = Math.max(1, Math.round(dmg * 0.8));   // درع من المتجر
  m.hp -= dmg; m.inv = .35;
  if (dir) m.face = -Math.sign(dir);   // يلتفت نحو من ضربه (dir = اتجاه الدفع بعيداً عن المهاجم)
  m.hk = (m.hk || 0) + 1;
  playSnd(SND.hit); sparks(m.x, m.y, m.z + 34);
  m.atkT = -1; m.ah = false; m.throwT = -1;

  if (m.hp <= 0) {
    m.hp = 0; m.dead = true; m.lives--;
    m.st = 'd'; m.stT = 0; m.vx = dir * 240; m.vz = 220; m.respT = 2.3;
  } else if (kd || m.z > (m.gz || 0) + 1 || fromExplosion) {
    m.st = 'd'; m.stT = 0; m.vx = dir * 220; m.vz = 210;
  } else {
    m.st = 'h'; m.stT = 0; m.vx = dir * 90;
  }
  // عند الضربة الثالثة المتتالية أثناء قتال الزعيم: يومض البطل ولا يتلقى ضربات لمدة نصف ثانية ليتمكن من الهرب
  const now = G.time;
  m.hitChain = (now - (m.lastHitT || -9) < ESCAPE.window) ? (m.hitChain || 0) + 1 : 1;
  m.lastHitT = now;
  if (!m.dead && m.hitChain >= ESCAPE.hits && enemies.some(e => e.k === 'boss' && e.active && alive(e))) {
    m.inv = Math.max(m.inv, ESCAPE.inv); m.escBlink = true; m.hitChain = 0;
  }
  return true;
}

const ESCAPE = { hits: 3, window: 5, inv: .5 };   // الضربة الثالثة خلال 5 ثوانٍ من سابقتها → وميض وحماية نصف ثانية

function hurtEnemy(e, dmg, dir, kd) {
  if (!alive(e)) return;   // العدو الميت (أو المحتضر) لا يتأثر بأي سلاح
  // الزعيم: مدرّع لا يترنح، يموت فتُفتح البوابة
  if (e.k === 'boss') {
    e.hp -= dmg; e.hk++;
    playSnd(SND.hit); sparks(e.x, e.y, 60);
    if (e.hp <= 0) {
      e.hp = 0; e.dying = true; e.st = 'dead'; e.t = 0; G.kills++; G.bossDead = true; shake = 12;
      items.push({ x: e.x, y: e.y, t: 0, kind: 'health' });
      const CS_ = curStage();
      toast(e.name + ' DEFEATED! ' + (CS_.window ? 'ESCAPE THROUGH THE WINDOW!' : CS_.stoneDoor ? 'BLOW UP THE STONE DOOR WITH A BOMB!' : G.stage < STAGE_COUNT - 1 ? 'GATE OPEN - NEXT STAGE!' : 'GATE OPEN - RUN!'), 3600);
      if (CS_.stoneDoor && me && me.bombs < 1) { me.bombs = 1; floatText(me.x, me.y - 95, '+1 BOMB', '#ffb347'); }
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

// ---------- الباب الحجري الأخير: تفجيره بالقنبلة وتطاير الحجارة ----------
let rocks = [];
function doorW() { const D = curStage().stoneDoor; if (!D) return null; const k = bgScale(); return { x0: D.x0 * k, x1: D.x1 * k, top: D.top * k, bottom: D.bottom * k, cx: D.cx * k }; }
function blowDoor() {
  if (G.doorBlown) return;
  const D = doorW();
  G.doorBlown = true; G.doorBlownT = 0;
  shake = 18; playSnd(SND.boom); playSnd(SND.box_destroy);
  explosions.push({ x: D.cx, y: D.bottom, z: (D.bottom - D.top) * .45, t: 0, dur: .7, maxR: 110 });
  const floorY = yBounds(D.cx - 30)[0];
  for (let i = 0; i < 48; i++) {
    const sy = rr(D.top, D.bottom), fy = floorY + rr(0, 70);
    const pts = []; const n = 5 + (i % 3);
    for (let j = 0; j < n; j++) { const a = j / n * 6.283, r = rr(.6, 1); pts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    rocks.push({ x: rr(D.x0, D.x1), y: fy, z: Math.max(0, fy - sy), vx: rr(-460, -40), vz: rr(40, 330), r: rr(0, 6.3), vr: rr(-9, 9),
      s: rr(3, i % 6 === 0 ? 13 : 8), l: rr(2.6, 4), pts: pts, c: ['#8f8a80', '#a39c8f', '#6f6a62', '#b5ac9a'][i % 4] });
  }
  for (let i = 0; i < 30; i++) parts.push({ x: D.cx + rr(-20, 10), y: floorY + 5, z: rr(10, D.bottom - D.top), vx: rr(-220, 30), vz: rr(-20, 160), l: rr(.5, 1.1), c: i % 2 ? '#c9bfa8' : '#8d8577' });
  toast('THE DOOR IS OPEN!', 2000);
}
function updateRocks(dt) {
  for (const p of rocks) {
    p.l -= dt; p.vz -= 900 * dt; p.x += p.vx * dt; p.z += p.vz * dt; p.r += p.vr * dt;
    if (p.z <= 0) { p.z = 0; p.vz = -p.vz * .35; p.vx *= .5; p.vr *= .5; }
  }
  rocks = rocks.filter(p => p.l > 0);
}
function drawStoneDoor(g, t) {
  const D = doorW();
  if (D && G.doorBlown) {
    // فتحة مظلمة مكان الباب المحطم، وكومة حجارة عند قاعدته
    const x0 = D.x0 - cam, x1 = D.x1 - cam + 2;
    const grd = g.createLinearGradient(x0, 0, x1, 0);
    grd.addColorStop(0, 'rgba(10,8,6,.92)'); grd.addColorStop(1, 'rgba(0,0,0,.98)');
    g.fillStyle = grd;
    g.beginPath(); g.moveTo(x0 + 6, D.top + 10); g.lineTo(x1, D.top + 4); g.lineTo(x1, D.bottom + 40); g.lineTo(x0, D.bottom); g.closePath(); g.fill();
    g.fillStyle = '#7d776d';
    for (let i = 0; i < 9; i++) { const rx = x0 - 6 + i * 6, ry = D.bottom + 2 - (i % 3) * 3; g.beginPath(); g.ellipse(rx, ry, 6, 4, i, 0, 6.3); g.fill(); }
  } else if (D && G.bossDead && G.phase === 'play') {
    // سهم يشير إلى الباب الحجري
    const ax = D.cx - cam - 8, ay = D.top - 8 + Math.sin(t * 6) * 4;
    g.fillStyle = '#000'; g.beginPath(); g.moveTo(ax - 10, ay - 13); g.lineTo(ax + 10, ay - 13); g.lineTo(ax, ay + 1); g.closePath(); g.fill();
    g.fillStyle = '#ffc233'; g.beginPath(); g.moveTo(ax - 8, ay - 12); g.lineTo(ax + 8, ay - 12); g.lineTo(ax, ay - 1); g.closePath(); g.fill();
  }
  for (const p of rocks) {
    g.save(); g.translate(p.x - cam, p.y - p.z); g.rotate(p.r); g.globalAlpha = clamp(p.l, 0, 1);
    g.fillStyle = p.c; g.strokeStyle = 'rgba(40,34,28,.8)'; g.lineWidth = 1;
    g.beginPath(); p.pts.forEach((q, i) => i ? g.lineTo(q[0] * p.s, q[1] * p.s) : g.moveTo(q[0] * p.s, q[1] * p.s)); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
}

function createExplosion(x, y, z, radius, dm, owner) {
  // قنبلة البطل قرب الباب الحجري بعد قتل الزعيم الأخير → يتحطم الباب
  if (owner === 'me' && G.bossDead && !G.doorBlown && curStage().stoneDoor) { const D = doorW(); if (Math.abs(x - D.cx) < radius + 50) blowDoor(); }
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
    if (G.stage === 0 && owner === 'me' && Math.hypot(S0.door.x - x, S0.door.bottom - y) < radius) hitDoor(Math.round(dm * .8));
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

// ---------- سلسلة الضرب (كومبو): كل ضغطة تعرض الحركة التالية من صورة الضرب ----------
// إطارات punch.png لكل بطل مقسّمة إلى حركات: لكمة، لكمة ثانية، ركبة/ركلة...
// كلما تابع اللاعب الضغط تكتمل الصورة كلها (يديه ورجليه)، وآخر حركة هي الضربة القوية التي تُسقط العدو
const MELEE_SEGS = {
  player1h: [[0], [1, 2], [3, 4], [5, 6]],        // لكمة ← لكمة ← ركبة ثم ركلة ← ركلة عالية
  player2h: [[0], [1, 2], [3, 4], [5, 6, 7]],     // لكمة ← حراسة ولكمة ← ضربة كوع ← لكمة قوية
  player3h: [[0], [1, 2], [3, 4, 5]],             // لكمة ← اندفاع بلكمة ← قفزة وركلة
  player4h: [[0, 1], [2, 3]]                      // لكمة ← لكمة
};
const MELEE_TIME = 360;   // مدة كل حركة (نفس مدة الضربة في اللعب) بالميلي ثانية
function meleeSegs(side) { return MELEE_SEGS[HEROES[side].id] || [[0]]; }
const _segCache = {};
// نسخة من صورة الضرب تعرض إطارات حركة واحدة فقط ثم تقف على آخر إطار
function punchSeg(side, i) {
  const base = IMG.heroes[side].punch;
  if (!base || !base.sheet) return base;
  const segs = meleeSegs(side), fr = segs[i % segs.length].filter(n => n < base.M.n), key = side + ':' + i;
  if (!fr.length) return base;
  if (!_segCache[key]) {
    const per = MELEE_TIME / fr.length, v = Object.create(base);
    v.pick = ms => fr[Math.min(fr.length - 1, Math.floor(ms / per))];
    _segCache[key] = v;
  }
  return _segCache[key];
}
function nextSeg(o, side) {
  const n = meleeSegs(side).length;
  o.mseg = o.comboT > 0 ? ((o.mseg || 0) + 1) % n : 0;
  return o.mseg === n - 1;   // آخر حركة في السلسلة = ضربة قوية
}

function startMelee(f) {
  const strong = f.weapon === 'fist' ? nextSeg(f, f.side) : false;
  f.combo = f.comboT > 0 ? (f.combo + 1) % 3 : 0;
  f.comboT = .6; f.st = 'a'; f.atkT = 0; f.ak++; f.ah = false;
  f.atkType = (f.weapon === 'fist' ? strong : f.combo === 2) ? 1 : 0; f.hitEnemies = new Set();
  playSnd(SND.swing);
}
function startMeleeAir(f) {
  f.mseg = meleeSegs(f.side).length - 1;   // في الهواء: الركلة (آخر حركة)
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
  if (G.stage === 0 && !f.hitEnemies.has('door') && nearDoor(f.x, f.y, A.reach) && (S0.door.x - f.x) * f.face > -14) {
    if (hitDoor(A.dm)) f.hitEnemies.add('door');
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
  // الأرض تحت البطل: 0 أو سطح صندوق/برميل إذا كان فوقه
  const gz = groundZ(m); m.gz = gz;
  if (m.z < gz) m.z = gz;
  if (m.z > gz || m.vz > 0) {
    if (m.st === 'i' && m.z > gz + 4 && m.vz <= 0) { m.st = 'j'; m.atkT = -1; }   // نزل من حافة الصندوق
    m.vz -= 1000 * dt; m.z += m.vz * dt;
    if (m.z <= gz) {
      m.z = gz; m.vz = 0;
      if (m.st === 'j') { m.st = 'i'; m.atkT = -1; m.ah = false; }
      if (gz > 0) { m.gz = gz; for (let i = 0; i < 5; i++) parts.push({ x: m.x + rr(-12, 12), y: m.y, z: gz, vx: rr(-50, 50), vz: rr(20, 70), l: rr(.15, .3), c: '#d8c9a8' }); }
    }
  }
  const ix = clamp((inp.r ? 1 : 0) - (inp.l ? 1 : 0) + padX, -1, 1);
  const iy = clamp((inp.d ? 1 : 0) - (inp.u ? 1 : 0) + padY, -1, 1);
  const canAct = G.phase === 'play';
  m.mv = false;
  if (runDir && Math.sign(ix) !== runDir) runDir = 0;   // ترك زر الاتجاه أو غيّره: يرجع للمشي العادي
  const W = getWeapon(m);

  if (m.st === 'i') {
    if (canAct && (ix || iy)) {
      const sp = runDir ? RUN_SPEED : 175;
      m.x += ix * sp * dt; m.y += iy * 105 * dt; m.mv = true; m.ph += dt * (runDir ? 18 : 12);
      if (runDir && Math.random() < .35) parts.push({ x: m.x - m.face * 12, y: m.y, z: 2, vx: -m.face * rr(30, 80), vz: rr(20, 60), l: rr(.15, .3), c: '#cfc6b8' });
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
    m.x += ix * (runDir ? 230 : 140) * dt; m.y += iy * 60 * dt;
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
    } else if (m.z <= (m.gz || 0) && m.stT > .9) { m.st = 'i'; m.inv = 1; }
  }
  resolveObs(m);
  // البوابة مغلقة حتى يموت الزعيم
  if (G.stage === 0) m.x = clamp(m.x, S0.minX, S0.maxX);
  else m.x = clamp(m.x, 30, G.bossDead ? WORLD - 20 : WORLD - 160);
  clampY(m);
  inp.atk = false; inp.jmp = false;
}

function mkEnemy(k, x, y) {
  const T = ET[k];
  const R = RANGED[k];
  return { k: k, x: x, y: y, z: 0, vz: 0, vx: 0, face: -1, hp: T.hp, st: 'walk', t: 0, cd: rr(.4, 1.2), ph: rr(0, 6), mv: false, offY: rr(-10, 10), did: false, remove: false, hk: 0, ak: 0, dying: false,
    rcd: R ? rr(.6, 1.6) : 0, shot: false };
}

// الزعيم يختلف حسب المرحلة (الشكل، الاسم، الصحة، القدرات)
function mkBoss() {
  const B = curStage().boss, hp = Math.round(B.hp * (G.diff === 2 ? 1.2 : G.diff === 0 ? .85 : 1));
  return { k: 'boss', type: B.type, name: B.name, spr: B.spr, vis: ENEMY_VIS[B.spr] || 80, bdmg: B.dmg, bspd: B.spd,
    x: WORLD - 300, y: 312, z: 0, vx: 0, face: -1, hp: hp, maxHp: hp, st: 'walk', t: 0, cd: 1, ph: 0,
    mv: false, did: false, remove: false, hk: 0, ak: 0, home: WORLD - 300, shootCd: 2, bombCd: 4, skillCd: 3, dodgeT: 0, dd: 1,
    active: false, dying: false, chargeT: 0, chargeDir: 1, burst: 0, burstT: 0, summoned: false, enraged: false, fade: 0 };
}

function spawnWave(pack, f) {
  pack.forEach((k, i) => {
    const behind = (pack.length > 3 && i % 3 === 2 && !ET[k].kd);
    const off = VW * .5 + 90 + i * 55 + rr(0, 30);
    const x = clamp(f.x + (behind ? -1 : 1) * off, 40, WORLD - ARENA - 40);
    enemies.push(mkEnemy(k, x, laneAt(x)));
  });
}

// ---------- الصناديق والبراميل صلبة، ويمكن الوقوف فوقها بالقفز ----------
function obsPush(e, o) {
  const dx = e.x - o.x, dy = e.y - o.y;
  const px = 29 - Math.abs(dx), py = 16 - Math.abs(dy);
  if (px <= 0 || py <= 0) return null;
  if (px <= py) { e.x += (dx >= 0 ? 1 : -1) * px; return 'x'; }
  e.y += (dy >= 0 ? 1 : -1) * py; return 'y';
}
function resolveObs(e) {
  const z = e.z || 0;
  let blocked = null;
  for (const o of crates) {
    if (o.broken || Math.abs(o.x - e.x) > 45 || z >= PROP_TOP.crate - 8) continue;   // فوق الصندوق: لا يصطدم به
    if (obsPush(e, o) === 'x') blocked = o;
  }
  for (const o of barrels) {
    if (o.exploded || Math.abs(o.x - e.x) > 45 || z >= PROP_TOP.barrel - 8) continue;
    if (obsPush(e, o) === 'x') blocked = o;
  }
  return blocked;
}
// أعلى سطح تحت قدمي البطل (0 = الأرض)
function groundZ(e) {
  let g = 0;
  const z = e.z || 0, on = (o, top) => Math.abs(e.x - o.x) < PROP_HALF.x && Math.abs(e.y - o.y) < PROP_HALF.y && z >= top - 10;
  for (const o of crates) if (!o.broken && on(o, PROP_TOP.crate)) g = Math.max(g, PROP_TOP.crate);
  for (const o of barrels) if (!o.exploded && on(o, PROP_TOP.barrel)) g = Math.max(g, PROP_TOP.barrel);
  return g;
}

// ---------- مقذوفات الأعداء ----------
// رصاصة حارس الغابة / سكين النينجا الصغيرة
function enemyFire(e, R, tgt) {
  const D = DIFF[G.diff], dir = e.face;
  const dm = Math.round(R.dmg * D.dmg);
  if (R.kind === 'ball') { throwFlail(e, dm, R.max, 480); return; }
  const dy = clamp((tgt.y - e.y) * 1.2, -40, 40);
  bullets.push({ x: e.x + dir * 26, y: e.y, z: R.z, vx: dir * R.speed * D.spd, vy: dy, vz: 0, dm: dm, owner: 'enemy',
    kind: R.kind, color: R.kind === 'bullet' ? '#ffdf6b' : '#dfe6ee', life: 1.3, t: 0 });
  playSnd(R.kind === 'bullet' ? SND.shoot : SND.swing);
  if (R.kind === 'bullet') for (let i = 0; i < 4; i++) parts.push({ x: e.x + dir * 30, y: e.y, z: R.z, vx: dir * rr(40, 120), vz: rr(-30, 40), l: rr(.08, .18), c: i % 2 ? '#fff3b0' : '#ffb347' });
}
// الكرة الحديدية المربوطة بحبل بني: تنطلق في خط مستقيم ثم تعود إلى صاحبها (enemy3)
const FLAIL_Z = 46;   // ارتفاع الكرة عن الأرض (القفز العالي يتفاداها)
function throwFlail(e, dm, reach, speed) {
  const dir = e.face;
  e.holdBall = true; e.st = 'atk'; e.t = 0; e.did = true; e.ak++;
  lobs.push({ own: e, dir: dir, x: e.x + dir * 22, y: e.y, z: FLAIL_Z, d: 0, max: reach, sp: speed, back: false, hit: false, dm: dm, t: 0 });
  playSnd(SND.swing);
}
function flailHand(b) { return b.own.x + b.dir * 22; }
function updateLobs(dt) {
  for (const b of lobs) {
    const e = b.own;
    b.t += dt;
    if (!e || e.remove || e.dying || e.st === 'dead') { b.gone = true; if (e) e.holdBall = false; continue; }
    b.y = e.y;
    if (!b.back) {
      // ذهاب في خط مستقيم
      b.x += b.dir * b.sp * dt; b.d += b.sp * dt;
      if (b.d >= b.max) b.back = true;
      for (const c of crates) if (!c.broken && Math.abs(c.x - b.x) < 16 && Math.abs(c.y - b.y) < 18) { breakCrate(c); b.back = true; }
      for (const o of barrels) if (!o.exploded && Math.abs(o.x - b.x) < 16 && Math.abs(o.y - b.y) < 18) { explodeBarrel(o); b.back = true; }
    } else {
      // رجوع إلى يد صاحبها
      const hx = flailHand(b), dx = hx - b.x;
      const st = b.sp * 1.1 * dt;
      if (Math.abs(dx) <= st) { b.gone = true; e.holdBall = false; e.st = 'walk'; e.t = 0; continue; }
      b.x += Math.sign(dx) * st;
    }
    // الإصابة (مرة واحدة في كل رمية، ذهاباً أو إياباً)
    if (!b.hit) {
      const hits = f => f && !f.dead && Math.abs(f.x - b.x) < 18 && Math.abs(f.y - b.y) < 16 && b.z >= (f.z || 0) - 8 && b.z <= (f.z || 0) + 80;
      if (hits(me) && me.inv <= 0 && me.st !== 'd') { b.hit = true; hurtMe(b.dm, b.back ? -b.dir : b.dir, true); b.back = true; }
      else for (const a of allies) if (hits(a) && a.inv <= 0) { b.hit = true; hurtAlly(a, b.dm, b.dir, true, 2); b.back = true; break; }
    }
  }
  lobs = lobs.filter(b => !b.gone);
}

// ---------- زعماء العصابات: زعيم مختلف في نهاية كل مرحلة ----------
//  1) BIG TONY      : عملاق الشارع، يندفع بقوة (هجوم الثور) ويضرب بقبضته
//  2) SHADOW MASTER : زعيم النينجا، يختفي ويظهر خلفك ويرمي مروحة سكاكين
//  3) THE COLONEL   : قائد حراس الغابة، يطلق رشقات من البندقية ويرمي القنابل
//  4) THE WARLORD   : الزعيم الأخير، رصاص + قنابل + ضربات قوية ويغضب عند نصف صحته
function bossShoot(e, D) {
  e.st = 'atk'; e.t = 0; e.did = true; e.ak++; e.shootCd = rr(1.4, 2.2) * D.cd * (e.enraged ? .7 : 1); playSnd(SND.shoot);
  for (let i = -1; i <= 1; i++)
    bullets.push({ x: e.x + e.face * 30, y: e.y + i * 6, z: 26, vx: e.face * 620, vy: i * 18, vz: 0, dm: Math.round(9 * D.dmg), owner: 'boss', kind: 'bullet', color: '#ff4d4d', life: 1, t: 0 });
}
function bossBomb(e, D) {
  e.st = 'atk'; e.t = 0; e.did = true; e.ak++; e.bombCd = rr(3, 5) * D.cd * (e.enraged ? .7 : 1);
  bombs.push({ x: e.x + e.face * 20, y: e.y, z: 50, vx: e.face * BOMB.vx, vz: BOMB.vz, t: 0, fuse: BOMB.fuse, owner: 'boss', dm: Math.round(45 * D.dmg), radius: BOMB.radius, settled: false });
}
function bossKnives(e, D) {
  e.st = 'atk'; e.t = 0; e.did = true; e.ak++; e.shootCd = rr(1.6, 2.4) * D.cd * (e.enraged ? .65 : 1); playSnd(SND.swing);
  const n = e.enraged ? 5 : 3;
  for (let i = 0; i < n; i++) {
    const s = i - (n - 1) / 2;
    bullets.push({ x: e.x + e.face * 24, y: e.y, z: 50, vx: e.face * 470, vy: s * 55, vz: 0, dm: Math.round(8 * D.dmg), owner: 'boss', kind: 'knife', color: '#e6d7ff', life: 1.2, t: 0 });
  }
}
function bossRifle(e, D) {
  playSnd(SND.shoot);
  bullets.push({ x: e.x + e.face * 34, y: e.y, z: 62, vx: e.face * 640, vy: me ? clamp((me.y - e.y) * 1.3, -40, 40) : 0, vz: 0, dm: Math.round(8 * D.dmg), owner: 'boss', kind: 'bullet', color: '#ffdf6b', life: 1.1, t: 0 });
  for (let i = 0; i < 4; i++) parts.push({ x: e.x + e.face * 40, y: e.y, z: 62, vx: e.face * rr(40, 120), vz: rr(-30, 40), l: rr(.08, .18), c: i % 2 ? '#fff3b0' : '#ffb347' });
}
// الزعيم يستدعي أعوانه داخل ساحته
function bossSummon(e, kinds) {
  kinds.forEach((k, i) => {
    const side = i % 2 ? 1 : -1;
    const x = clamp(e.x + side * rr(220, 300), WORLD - ARENA + 40, WORLD - 200);
    const en = mkEnemy(k, x, laneAt(x));
    en.arena = true;
    enemies.push(en);
    sparks(x, en.y, 40, '#ff6f4e');
  });
}
const BOSS_HELP = { tony: ['thug', 'cop'], iron: ['ninja', 'thug'], trike: ['raptor', 'raptor'], warlord: ['soldier', 'ninja'] };

function updateBoss(e, dt) {
  const T = ET.boss, D = DIFF[G.diff], m = me;
  e.t += dt; e.mv = false;
  if (e.fade > 0) e.fade = Math.max(0, e.fade - dt);
  if (e.dying || e.st === 'dead') { if (e.t > 1.4) e.remove = true; return; }
  e.shootCd -= dt; e.bombCd -= dt; e.cd -= dt; e.skillCd -= dt;
  const minX = WORLD - ARENA + 60, maxX = WORLD - 190;
  if (e.holdBall) { e.st = 'atk'; e.t = .2; e.did = true; e.active = true; return; }   // يمسك الحبل حتى تعود الكرة
  const near = !!(m && !m.dead && m.x > WORLD - ARENA && G.phase === 'play');
  e.active = near;
  const spd = e.bspd * (e.enraged ? 1.3 : 1), cdk = D.cd * (e.enraged ? .7 : 1);

  // عند نصف الصحة: يغضب ويستدعي أعوانه
  if (near && !e.summoned && e.hp < e.maxHp * .5) {
    e.summoned = true; e.enraged = true; shake = 8;
    toast(e.name + ' IS ANGRY!', 1800);
    bossSummon(e, BOSS_HELP[e.type] || ['thug']);
  }
  // رشقة البندقية (الكولونيل)
  if (e.burst > 0) { e.burstT -= dt; if (e.burstT <= 0) { e.burst--; e.burstT = .15; e.ak++; bossRifle(e, D); } }

  if (e.chargeT > 0) {
    // اندفاع BIG TONY
    e.chargeT -= dt; e.face = e.chargeDir; e.x += e.chargeDir * 440 * dt; e.mv = true; e.ph += dt * 16;
    if (Math.random() < .5) parts.push({ x: e.x - e.chargeDir * 20, y: e.y, z: 2, vx: -e.chargeDir * rr(30, 90), vz: rr(20, 80), l: rr(.2, .4), c: '#b9a98a' });
    if (!e.did && near && Math.abs(m.x - e.x) < 42 && Math.abs(m.y - e.y) < 22 && m.z < 40) { e.did = true; hurtMe(Math.round(e.bdmg * 1.25 * D.dmg), e.chargeDir, true); }
    for (const a of allies) if (!a.dead && Math.abs(a.x - e.x) < 40 && Math.abs(a.y - e.y) < 22) hurtAlly(a, 0, e.chargeDir, true, 3);
    for (const c of crates) if (!c.broken && Math.abs(c.x - e.x) < 34 && Math.abs(c.y - e.y) < 22) breakCrate(c);
    for (const b of barrels) if (!b.exploded && Math.abs(b.x - e.x) < 34 && Math.abs(b.y - e.y) < 22) explodeBarrel(b);
    if (e.x <= minX || e.x >= maxX) { e.chargeT = 0; shake = Math.min(12, shake + 6); e.cd = .8; }
  } else if (e.st === 'wind') {
    // تحذير قبل الاندفاع
    if (e.t >= .5) { e.st = 'walk'; e.t = 0; e.chargeT = 1.2; e.did = false; e.skillCd = rr(4, 6) * cdk; }
  } else if (e.st === 'atk') {
    if (!e.did && e.t < .16 && near && inReach(e.x, e.y, 0, e.face, T.reach, m.x, m.y, m.z, 14)) {
      e.did = true; hurtMe(Math.round(e.bdmg * D.dmg), e.face, true);
    }
    if (!e.didA && e.t < .16) {
      for (const a of allies) if (!a.dead && inReach(e.x, e.y, 0, e.face, T.reach, a.x, a.y, 0, 14)) { hurtAlly(a, 0, e.face, true, 2); e.didA = true; }
    }
    if (e.t >= .34) { e.st = 'walk'; e.t = 0; }
  } else if (near) {
    const dx = m.x - e.x, adx = Math.abs(dx), ady = Math.abs(m.y - e.y);
    e.face = dx >= 0 ? 1 : -1;
    // تفادي الرصاص (كل الزعماء ما عدا TONY الثقيل)
    if (e.type !== 'tony' && e.type !== 'trike' && e.dodgeT <= 0) for (const b of bullets) {
      if (b.owner === 'me' && Math.abs(b.x - e.x) < 280 && (b.x - e.x) * b.vx < 0 && Math.abs(b.y - e.y) < 26) {
        e.dodgeT = .4; e.dd = e.y >= b.y ? 1 : -1;
        const yb = yBounds(e.x);
        if (e.y > yb[1] - 10) e.dd = -1;
        if (e.y < yb[0] + 10) e.dd = 1;
        break;
      }
    }
    let flee = 0;
    for (const b of bombs) if (b.owner === 'me' && Math.abs(b.x - e.x) < 160) flee = e.x >= b.x ? 1 : -1;
    for (const mi of mines) if (Math.abs(mi.x - e.x) < 110 && Math.abs(mi.y - e.y) < 40) flee = e.x >= mi.x ? 1 : -1;
    const melee = () => { e.st = 'atk'; e.t = 0; e.did = false; e.didA = false; e.ak++; e.cd = rr(1, 1.6) * cdk; };
    const moveY = () => { if (ady > 12) { e.y += Math.sign(m.y - e.y) * 80 * dt; e.mv = true; } };

    if (e.cd <= 0 && adx < T.reach + 8 && ady < 16) melee();
    else if (e.type === 'tony' || e.type === 'trike') {
      // BIG TONY و KING TRIKE: اندفاع قوي بعد إشارة !!
      if (e.skillCd <= 0 && adx > 130 && ady < 40) {
        e.st = 'wind'; e.t = 0; e.ak++; e.chargeDir = Math.sign(dx) || -1; e.y += (m.y - e.y) * .6;
        floatText(e.x, e.y - e.vis - 10, '!!', '#ff4d4d');
      } else if (adx > 50) { e.x += Math.sign(dx) * spd * dt; e.mv = true; moveY(); }
      else moveY();
    } else if (e.type === 'iron') {
      // IRON HANK: يطلق الكرة الحديدية في خط مستقيم ثم تعود إليه بالحبل (أبعد وأسرع عند الغضب)
      if (e.shootCd <= 0 && !flee && adx > 90 && adx < (e.enraged ? 400 : 330) && ady < 14) {
        e.shootCd = rr(1.6, 2.4) * cdk;
        throwFlail(e, Math.round(15 * D.dmg), Math.min(adx + 70, e.enraged ? 420 : 350), e.enraged ? 620 : 520);
      } else if (e.shootCd <= 0 && adx > 90 && adx < 400 && ady >= 14) moveY();   // يصطف مع البطل ليرمي
      else if (e.dodgeT > 0) { e.dodgeT -= dt; e.y += e.dd * 130 * dt; e.mv = true; }
      else if (flee) { e.x += flee * spd * 1.5 * dt; e.mv = true; }
      else if (adx > 60) { e.x += Math.sign(dx) * spd * dt; e.mv = true; moveY(); }
      else moveY();
    } else {
      // THE WARLORD
      if (e.shootCd <= 0 && !flee && ady < 40 && adx > 90 && adx < 440) bossKnives(e, D);   // الزعيم الأخير يرمي السكاكين بدل إطلاق النار
      else if (e.bombCd <= 0 && adx > 120 && adx < 260) bossBomb(e, D);
      else if (e.dodgeT > 0) { e.dodgeT -= dt; e.y += e.dd * 150 * dt; e.mv = true; }
      else if (flee) { e.x += flee * spd * 1.6 * dt; e.mv = true; }
      else if (adx < 70) { e.x -= Math.sign(dx || 1) * spd * dt; e.mv = true; }
      else if (adx > 360) { e.x += Math.sign(dx) * spd * .8 * dt; e.mv = true; }
      else moveY();
    }
  } else {
    // اللاعب بعيد: يرجع إلى مكانه ويحرس البوابة
    const dx = e.home - e.x;
    if (Math.abs(dx) > 6) { e.x += Math.sign(dx) * spd * 1.4 * dt; e.face = Math.sign(dx); e.mv = true; } else e.face = -1;
    const dy = 312 - e.y;
    if (Math.abs(dy) > 6) { e.y += Math.sign(dy) * 70 * dt; e.mv = true; }
  }
  if (e.mv) e.ph += dt * 11;
  e.x = clamp(e.x, minX, maxX);   // لا يخرج من ساحته أبدًا
  clampY(e);
  if (e.chargeT <= 0) resolveObs(e);
}

function updateEnemies(dt) {
  for (const e of enemies) {
    if (e.k === 'boss') { updateBoss(e, dt); continue; }
    if (e.holdBall && alive(e)) { e.st = 'atk'; e.t = .2; e.mv = false; continue; }
    const T = ET[e.k];
    // المحتضر لا يهاجم ولا يتفاعل: يُجبَر على حالة السقوط
    if (e.dying && e.st !== 'down' && e.st !== 'dead') { e.st = 'down'; e.t = 0; }
    e.t += dt; e.cd -= dt;
    e.x += e.vx * dt; e.vx -= e.vx * Math.min(1, dt * 6);
    e.mv = false;
    const R = RANGED[e.k];
    if (R) e.rcd -= dt;

    // عدو واقف فوق السطح (المرحلة 0): ينتظر لحظة ثم يقفز نحو أرضية البطل
    if (e.standT > 0) {
      e.standT -= dt; if (me) e.face = me.x >= e.x ? 1 : -1;
      if (e.standT <= 0) {
        e.vz = 320;
        const tl = (320 + Math.sqrt(320 * 320 + 1800 * e.z)) / 900;   // زمن الوصول للأرض
        e.jvx = (e.tx - e.x) / tl; playSnd(SND.jump);
      }
      continue;
    }
    // نينجا يسقط من السماء (حدث المرحلة 2) / عدو يقفز من السطح (المرحلة 0)
    if (e.z > 0 || e.vz > 0) {
      e.vz -= 900 * dt; e.z += e.vz * dt;
      if (e.jvx) e.x += e.jvx * dt;
      if (e.z <= 0) {
        e.z = 0; e.vz = 0; e.jvx = 0; shake = Math.min(6, shake + 2);
        for (let i = 0; i < 6; i++) parts.push({ x: e.x + rr(-14, 14), y: e.y, z: 0, vx: rr(-70, 70), vz: rr(30, 90), l: rr(.2, .4), c: '#cfc6b8' });
      }
      if (me) e.face = me.x >= e.x ? 1 : -1;
      continue;
    }
    // ديناصور هائج يركض عبر الشاشة (حدث المرحلة 3)
    if (e.charge && alive(e) && e.st === 'walk') {
      e.x += e.charge * 330 * dt; e.face = e.charge; e.mv = true; e.ph += dt * 14;
      if (Math.random() < .3) parts.push({ x: e.x - e.charge * 16, y: e.y, z: 2, vx: -e.charge * rr(20, 70), vz: rr(20, 60), l: rr(.2, .35), c: '#7a6a4a' });
      if (!e.did && me && !me.dead && Math.abs(me.x - e.x) < 30 && Math.abs(me.y - e.y) < 16 && me.z < 30) { e.did = true; hurtMe(Math.round(T.dmg * 1.5), e.charge, true); }
      for (const a of allies) if (!a.dead && Math.abs(a.x - e.x) < 28 && Math.abs(a.y - e.y) < 16) hurtAlly(a, 0, e.charge, true, 2);
      if ((e.charge > 0 && (e.x > cam + VW + 260 || e.x > WORLD - ARENA)) || (e.charge < 0 && e.x < cam - 260)) e.remove = true;
      continue;
    }

    if (e.st === 'walk') {
      const tgt = pickTarget(e);
      e.tgt = tgt;
      if (tgt) {
        const sgn = e.x >= tgt.x ? 1 : -1;
        // حارس الغابة يبقى على مسافة ليطلق النار، والنينجا يبتعد قليلاً عندما تكون سكينه جاهزة
        const keep = R ? (R.keep || (R.kind === 'knife' && e.rcd <= 0 ? 190 : 0)) : 0;
        // الأعداء العاديون ممنوعون من ساحة الزعيم: هدفهم لا يتجاوز الحد، فيقفون عنده بحالة الوقوف العادية
        const lim = enemyMaxX(e);
        const tx = Math.min(tgt.x + sgn * (keep || T.reach * .75), lim);
        const yb = yBounds(e.x), ty = clamp(tgt.y + e.offY, yb[0], yb[1]);
        const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
        e.face = tgt.x > e.x ? 1 : -1;
        if (e.x >= lim - 14 && tgt.x > lim) {
          e.sdT = 0;   // عند الحد والبطل داخل الساحة: وقوف فقط
        } else if (e.sdT > 0) {
          e.sdT -= dt; e.y += e.sd * 70 * dt; e.x += Math.sign(dx || 1) * T.spd * .5 * dt;
          e.mv = true; e.ph += dt * 11;
        } else if (d > 6) {
          e.x += dx / d * T.spd * dt; e.y += dy / d * T.spd * .7 * dt;
          e.mv = true; e.ph += dt * 11;
        }
        const adx = Math.abs(tgt.x - e.x), ady = Math.abs(tgt.y - e.y);
        const onScreen = e.x > cam - 10 && e.x < cam + VW + 10;
        const canHit = alive(e) && tgt.st !== 'd' && !tgt.dead && G.phase === 'play';
        if (canHit && R && e.rcd <= 0 && onScreen && adx >= R.min && adx <= R.max && ady < 22) {
          // هجوم من بعيد: رصاصة / سكين / كرة حديدية
          e.st = 'wind'; e.t = 0; e.shot = true;
          e.ak = (e.ak || 0) + 1;
        } else if (canHit && e.k !== 'soldier' && e.cd <= 0 && adx < T.reach + 8 && ady < 14) {
          e.st = 'wind'; e.t = 0; e.shot = false;
          e.ak = (e.ak || 0) + 1;
        }
      }
    } else if (e.st === 'wind') {
      if (e.tgt) e.face = e.tgt.x > e.x ? 1 : -1;
      if (e.t >= (e.shot ? R.wind : T.wind)) { e.st = 'atk'; e.t = 0; e.did = false; }
    } else if (e.st === 'atk') {
      const t2 = e.tgt;
      if (e.shot) {
        if (!e.did && t2) { e.did = true; enemyFire(e, R, t2); if (e.holdBall) continue; }
        if (e.t >= .34) { e.st = 'walk'; e.t = 0; e.shot = false; e.did = false; e.rcd = rr(R.cd[0], R.cd[1]) * DIFF[G.diff].cd; e.cd = Math.max(e.cd, .5); }
      } else {
        if (!e.did && e.t < .16 && t2 && !t2.dead && inReach(e.x, e.y, 0, e.face, T.reach, t2.x, t2.y, t2.z, 14)) { e.did = true; if (t2.ally) hurtAlly(t2, Math.round(T.dmg * DIFF[G.diff].dmg), e.face, T.kd); else hurtMe(T.dmg, e.face, T.kd); }
        if (e.t >= .34) { e.st = 'walk'; e.t = 0; e.cd = rr(1, 1.8); e.did = false; }
      }
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
      const yb = yBounds(e.x);
      if (e.y >= yb[1] - 6) e.sd = -1;
      if (e.y <= yb[0] + 6) e.sd = 1;
      e.sdT = .5;
    }
    e.x = clamp(e.x, enemyMinX(), enemyMaxX(e)); clampY(e);
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
// رهينة واحدة في منتصف كل مرحلة (المراحل 1 و 2 و 3)، فتصل للزعيم الأخير ومعك حتى 3 حلفاء
function spawnHostages() {
  hostages = [];
  const others = HEROES.map((h, i) => i).filter(i => i !== G.side);   // الأبطال الثلاثة الآخرون
  const i = G.stage - 1;   // رهينة في المراحل 1 و 2 و 3
  if (i >= 0 && i < HOSTAGE_COUNT && i < others.length) {
    const S = curStage();
    // إذا حُدد عمود في الخلفية: الرهينة أسفله تماماً، وقدماها على خط المنع العلوي (Y0)
    const x = S.hostageX ? S.hostageX * bgScale() : Math.min(START + Math.round(ROAD() * .55), WORLD - ARENA - 160);   // لا تُوضع داخل ساحة الزعيم
    const hb = yBounds(x);
    hostages.push({ side: others[i], x: x, y: S.hostageX ? hb[0] : clamp(312, hb[0] + 10, hb[1] - 10), hp: HOSTAGE_ROPE_HP, max: HOSTAGE_ROPE_HP, hk: 0, freed: false });
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
    if (a.z > 0) {   // ينزل من الأعلى (بداية المرحلة بعد القفز من النافذة)
      a.vz -= 1000 * dt; a.z += a.vz * dt; a.mv = false;
      if (a.z <= 0) { a.z = 0; a.vz = 0; shake = Math.min(6, shake + 2); }
      continue;
    }
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
          nextSeg(a, a.side); a.combo = a.comboT > 0 ? (a.combo + 1) % 3 : 0; a.comboT = .7;
          a.st = 'a'; a.atkT = 0; a.ak++; a.did = false; a.cd = ALLY.cd; playSnd(SND.swing);
        }
      } else if (a.dazeT > 0) {
        // شارد الذهن: يقف مكانه
      } else {
        // يتبع البطل ويقترب منه ويقف بجانبه دون التزاحم
        const slot = alive_.indexOf(a);
        const gap = ALLY.follow + slot * 40;
        const dx = me.x - a.x;
        const ayb = yBounds(a.x), ty = clamp(me.y + (slot % 2 ? 24 : -24), ayb[0], ayb[1]), dy = ty - a.y;
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
    a.x = G.stage === 0 ? clamp(a.x, S0.minX, S0.maxX) : clamp(a.x, 30, G.bossDead ? WORLD - 20 : WORLD - 160);
    clampY(a);
  }
  allies = allies.filter(a => !a.remove);
}

function allySpr(a) {
  const p = IMG.heroes[a.side];
  if (a.dead) return ['death', p.death];
  if (a.st === 'h' || a.st === 'd') return ['inj' + a.hk, p.injured];
  if (a.st === 'a') return ['melee' + a.ak, punchSeg(a.side, a.mseg || 0)];
  let v = p.victory;
  if ((a.vicT > 0 || (G.phase === 'over' && G.result && G.result.win)) && v && !(v.complete && !v.naturalWidth)) return ['vic', v];
  if (a.st === 'j' || (a.z || 0) > 2) { const js = jumpSpr(a, p); if (js) return js; }
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
    } else {
      // رصاص الزعيم ورصاص حارس الغابة وسكاكين النينجا: تصيب البطل وحلفاءه (القفز العالي يتفاداها)
      const hits = f => Math.abs(f.x - b.x) < 16 && Math.abs(f.y - b.y) < 18 && b.z >= (f.z || 0) - 10 && b.z <= (f.z || 0) + 75;
      if (me && !me.dead && me.inv <= 0 && me.st !== 'd' && hits(me)) {
        hurtMe(b.dm, Math.sign(b.vx), false); b.gone = true;
      } else {
        for (const a of allies) if (!a.dead && a.inv <= 0 && hits(a)) { hurtAlly(a, b.dm, Math.sign(b.vx), false); b.gone = true; break; }
      }
    }
    if (!b.gone && b.owner === 'me' && G.stage === 0 && G.s0 && G.s0.open && !G.s0.door.broken &&
        Math.min(b.x, b.x - b.vx * dt) <= S0.door.right && Math.max(b.x, b.x - b.vx * dt) >= S0.door.left && b.y >= S0.door.bottom - 22) { hitDoor(b.dm); b.gone = true; }
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
    if (b.drop) {
      // قنبلة الغارة الجوية: تسقط عموديًا وتنفجر عند ملامسة الأرض
      if (b.t < b.delay) continue;
      b.vz -= 900 * dt; b.z += b.vz * dt;
      if (b.z <= 0) { b.gone = true; createExplosion(b.x, b.y, 0, b.radius, b.dm, 'sky'); }
      continue;
    }
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

// عرض حركة من Sprite Sheet: عنصر خارجي بحجم الإطار الأصلي (للموضع والقلب)، وداخله الإطار الحالي من الصورة
function placeSheet(o, key, S, x, y, face, zi, vis, sizeFn) {
  sprUsed.add(o); sprAll.add(o);
  if (!S.complete) return;
  let el = o._el;
  if (!el || !el._sh) {
    if (el) el.remove();
    if (o._pend) { o._pend.remove(); o._pend = null; }
    el = document.createElement('div'); el._sh = 1;
    el.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none';
    const inn = document.createElement('div');
    inn.style.cssText = 'position:absolute;background-repeat:no-repeat';
    el.appendChild(inn); el._in = inn;
    layer.appendChild(el); o._el = el; o._key = null;
  }
  const now = performance.now();
  if (o._key !== key) { o._key = key; o._t0 = now; }   // حركة جديدة تبدأ من أول إطار
  const M = S.M, inn = el._in;
  if (el._src !== S.url) { inn.style.backgroundImage = 'url(' + S.url + ')'; el._src = S.url; }
  const d = sizeFn(S), w = d[0], h = d[1];
  const rx = w * CS / M.o[2], ry = h * CS / M.o[3];
  const f = S.pick ? S.pick(now - o._t0) : sheetFrame(S, now - o._t0), col = f % M.c, row = (f / M.c) | 0;
  inn.style.left = (M.o[0] * rx) + 'px'; inn.style.top = (M.o[1] * ry) + 'px';
  inn.style.width = (M.w * rx) + 'px'; inn.style.height = (M.h * ry) + 'px';
  inn.style.backgroundSize = (M.c * M.w * rx) + 'px ' + (S.rows * M.h * ry) + 'px';
  inn.style.backgroundPosition = (-col * M.w * rx) + 'px ' + (-row * M.h * ry) + 'px';
  el.style.opacity = vis ? '1' : '0';
  el.style.width = (w * CS) + 'px';
  el.style.height = (h * CS) + 'px';
  const ox = (d[3] || 0) * (face === -1 ? -1 : 1);
  el.style.transform = 'translate(' + ((x - cam - w / 2 + ox) * CS) + 'px,' + ((y + (d[2] || 0) - h) * CS) + 'px) scaleX(' + (face === -1 ? -1 : 1) + ')';
  el.style.zIndex = zi;
}

function placeSprite(o, key, shared, x, y, face, zi, vis, sizeFn) {
  if (!shared) return;
  if (shared.sheet) return placeSheet(o, key, shared, x, y, face, zi, vis, sizeFn);
  sprUsed.add(o); sprAll.add(o);
  if (o._el && o._el._sh) { o._el.remove(); o._el = null; o._key = null; }
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
  if (img && img.sheet) {   // قياس محسوب مسبقاً في sprites.js
    if (!img.complete) return null;
    const m = img.M.m;
    return m ? (img._mm || (img._mm = { cw: m[0], ch: m[1], pad: m[2], cx: m[3] })) : null;
  }
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
// صور القفز: بنفس مقياس صورة المشي (نفس حجم الإطار الأصلي) حتى لا يكبر البطل وهو منكمش في الهواء
function jumpSize(el, side) {
  const W = IMG.heroes[side].walk, mw = measureImg(W), mj = measureImg(el);
  if (!mw || !mj || !W.M || !el.M) return heroSize(el, side, false);
  const k = HERO_VIS * (HERO_SCALE[side] || 1) / mw.ch * (W.M.o[3] / el.M.o[3]);
  return [el.naturalWidth * k, el.naturalHeight * k, mj.pad * k, -(mj.cx - el.naturalWidth / 2) * k];
}
function jumpSpr(o, p) {   // صورة القفز طوال القفزة (صعوداً ونزولاً)
  return p.up && p.up.sheet ? ['jup', p.up] : null;
}
function charSize(s, el, side) {
  return s[0] === 'jup' ? jumpSize(el, side) : heroSize(el, side, s[0].indexOf('death') === 0);
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
  if (G.paused) return ['idle', p.idle];   // عند الإيقاف المؤقت: البطل في وضع الوقوف
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
    return ['melee' + f.ak, f.weapon === 'fist' ? punchSeg(f.side, f.mseg || 0) : p.sword];
  }
  if (G.phase === 'trans' && !f.dead) return ['walk', p.walk];
  if (G.phase === 'over' && G.result && G.result.win && !f.dead) return ['victory', p.victory];
  if (f.mineT > 0) return ['loot' + (f.lk || 0), p.loot];
  if (f.lootT > 0 && !f.mv) return ['loot' + (f.lk || 0), p.loot];
  if (f.st === 'j') { const js = jumpSpr(f, p); if (js) return js; }
  if (f.mv || f.st === 'j') return ['walk', p.walk];
  return ['idle', p.idle];
}

function enemySpr(e) {
  const p = IMG.enemies[e.spr || e.k];
  if (e.st === 'dead' || (e.st === 'down' && e.hp <= 0)) return ['death', p.death];
  if (G.paused && e.st !== 'down') return ['idle', p.idle];   // عند الإيقاف المؤقت: كل الأعداء الأحياء في وضع الوقوف
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
  if (f.escBlink && f.inv <= 0) f.escBlink = false;
  const blink = f.inv > 0 && (f.st !== 'd' || f.escBlink) && !f.dead && Math.floor(t * 14) % 2;
  const deadBlink = f.dead && f.st === 'd' && Math.floor(t * 10) % 2;
  const vis = !(blink || deadBlink || f.hidden);
  const gz = f.gz || 0;
  if (vis) shadow(g, f.x - cam, f.y + 1 - gz, 22, 6);
  const s = playerSpr(f);
  // فوق الصندوق/البرميل: يُرسم أمامه
  placeSprite(f, s[0], s[1], f.x, f.y - f.z, f.face, Math.round(f.y) + (gz > 0 ? 30 : 0), vis, el => charSize(s, el, f.side));
}

function render(t) {
  const g = ctx;
  g.setTransform(SC, 0, 0, SC, 0, 0);
  g.clearRect(0, 0, VW, H);
  const sx = shake > 0 ? (Math.random() - .5) * shake : 0;
  const sy = shake > 0 ? (Math.random() - .5) * shake : 0;
  layer.style.transform = 'translate(' + (sx * CS) + 'px,' + (sy * CS) + 'px)' + zoomCss();
  bgDiv.style.backgroundPosition = (-cam * CS) + 'px 0';
  sprUsed.clear();

  g.save();
  g.translate(sx, sy);

  if (G.stage !== 0) {   // تظليل الطريق في المراحل 1-4 فقط (لا يناسب خلفية السطح)
    g.fillStyle = 'rgba(20, 10, 25, 0.4)';
    g.fillRect(0, Y0 - 15, VW, H - Y0 + 15);
    g.fillStyle = 'rgba(0, 0, 0, 0.3)';
    g.fillRect(0, Y1 + 10, VW, H - Y1 - 10);
  }
  drawFlames(g, t);
  drawWindowAndShards(g, t);
  drawWater(g, t);
  drawStoneDoor(g, t);

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

  // نهاية المرحلة: Checkpoint في المراحل 1-3، وبوابة الفوز endpoint في المرحلة الأخيرة فقط
  const lastStage = G.stage >= STAGE_COUNT - 1;
  if (G.stage === 0) drawDoor(g, t);
  const gx = WORLD - 90, gOn = gx > cam - 200 && gx < cam + VW + 200;
  if (gOn && lastStage) shadow(g, gx - cam, 338, 22, 6);
  // CP_H = ارتفاع Checkpoint على الشاشة، CP_Y = موضع قاعدتها (رقم أصغر = أعلى)
  const CP_H = 20, CP_Y = 160, CP_X = WORLD - 28;
  if (G.stage === 0) { /* لا بوابة في المرحلة 0: الباب هو المخرج */ }
  else if (curStage().stoneDoor) { /* المخرج الأخير: الباب الحجري (بدل endpoint.gif) */ }
  else if (lastStage) placeSprite(GATE, 'g', IMG.gate, gx, 336, 1, 336, gOn, el => propSize(el, HERO_VIS));
  else if (curStage().window) { /* المخرج هو النافذة */ }
  else placeSprite(GATE, 'cp', IMG.checkpoint, CP_X, CP_Y, 1, 336, CP_X > cam - 200 && CP_X < cam + VW + 200, el => propSize(el, CP_H));

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
    const vis = e.vis || ENEMY_VIS[e.k] || 80;
    shadow(g, e.x - cam, e.y + 1, e.k === 'boss' ? vis * .26 : ET[e.k].sh * (e.z > 0 ? clamp(1 - e.z / 400, .4, 1) : 1), 6);
    const s = enemySpr(e);
    placeSprite(e, s[0], s[1], e.x, e.y - e.z, e.face, Math.round(e.y), true, el => normSize(el, vis, s[0] === 'death'));

  }

  // Hostages (الرهائن المربوطة)
  for (const h of hostages) {
    if (h.x < cam - 100 || h.x > cam + VW + 100) continue;
    shadow(g, h.x - cam, h.y + 1, 22, 6);
    // صور الرهائن الأصلية تنظر إلى اليسار: نقلبها عندما يكون البطل على اليمين حتى ينظر إليه دائماً
    const hFace = me && me.x > h.x ? -1 : 1;
    placeSprite(h, 'hs', IMG.hostage[h.side], h.x, h.y, hFace, Math.round(h.y), true, el => normSize(el, HOSTAGE_VIS, false));
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
    const vis = !(a.inv > 0 && !a.dead && Math.floor(t * 14) % 2) && !a.hidden;
    if (!a.dead) shadow(g, a.x - cam, a.y + 1, 22, 6);
    const s = allySpr(a);
    placeSprite(a, s[0], s[1], a.x, a.y - (a.z || 0), a.face, Math.round(a.y), vis, el => charSize(s, el, a.side));
    if (!a.dead && !a.hidden) {
      const ax = a.x - cam, top = a.y - (a.z || 0) - HERO_VIS - 10;
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
    const bx = b.x - cam, by = b.y - b.z;
    if (b.kind === 'knife') {
      // سكين صغيرة تدور في الهواء
      g.save(); g.translate(bx, by); g.rotate(b.t * 22 * Math.sign(b.vx || 1));
      g.fillStyle = b.color; g.beginPath(); g.moveTo(9, 0); g.lineTo(0, -2.2); g.lineTo(-1, 2.2); g.closePath(); g.fill();
      g.fillStyle = '#5a3a22'; g.fillRect(-6, -1.6, 5, 3.2);
      g.fillStyle = '#c9c9c9'; g.fillRect(-1.5, -3, 1.5, 6);
      g.restore();
    } else if (b.owner !== 'me') {
      g.fillStyle = 'rgba(255,120,60,.45)'; g.fillRect(bx - Math.sign(b.vx) * 10 - 5, by - 1.5, 10, 3);
      g.fillStyle = b.color; g.fillRect(bx - 4, by - 1.5, 8, 3);
    } else {
      g.fillStyle = b.color;
      g.fillRect(bx - 3, by - 1, 6, 2);
    }
  }

  // الكرة الحديدية والحبل البني الذي يربطها بيد enemy3
  for (const b of lobs) {
    const FLAIL_LIFT = 14;   // رفع الحبل والكرة على الشاشة (رقم أكبر = أعلى)
    const bx = b.x - cam, by = b.y - b.z - FLAIL_LIFT, hx = flailHand(b) - cam, hy = b.own.y - FLAIL_Z - 6 - FLAIL_LIFT;
    shadow(g, bx, b.y + 1, 9, 3);
    const sag = Math.min(14, Math.abs(bx - hx) * .05) * (b.back ? 1.4 : .6);
    g.lineCap = 'round';
    g.strokeStyle = '#3b2210'; g.lineWidth = 4.2;
    g.beginPath(); g.moveTo(hx, hy); g.quadraticCurveTo((hx + bx) / 2, (hy + by) / 2 + sag, bx, by); g.stroke();
    g.strokeStyle = '#8b5a2b'; g.lineWidth = 2.4; g.setLineDash([5, 3]);
    g.beginPath(); g.moveTo(hx, hy); g.quadraticCurveTo((hx + bx) / 2, (hy + by) / 2 + sag, bx, by); g.stroke();
    g.setLineDash([]);
    const grd = g.createRadialGradient(bx - 3, by - 3, 1, bx, by, 9);
    grd.addColorStop(0, '#e2e2e2'); grd.addColorStop(1, '#2e2e2e');
    g.fillStyle = grd; g.beginPath(); g.arc(bx, by, 9, 0, 6.3); g.fill();
    g.strokeStyle = '#1a1a1a'; g.lineWidth = 1; g.stroke();
  }

  // Bombs
  for (const b of bombs) {
    if (b.drop) {
      // علامة الهدف الحمراء على الأرض قبل سقوط قنبلة الغارة
      const k = clamp(b.t / (b.delay + .6), 0, 1);
      g.strokeStyle = 'rgba(255,60,40,' + (.4 + .5 * Math.abs(Math.sin(t * 10))) + ')'; g.lineWidth = 2;
      g.beginPath(); g.ellipse(b.x - cam, b.y, b.radius * .55 * (1.3 - k * .3), b.radius * .17, 0, 0, 6.3); g.stroke();
      if (b.t >= b.delay) drawImg(g, IMG.item_bomb, b.x - cam, b.y - b.z - 5, 26, 26, 1);
      continue;
    }
    drawImg(g, IMG.item_bomb, b.x - cam, b.y - b.z - 5, 24, 24, 1);
  }

  // Explosions
  for (const e of explosions) {
    placeSprite(e, 'x', IMG.explosion, e.x, e.y - e.z + e.maxR * 0.5, 1, 2000, true, el => {
      const k = (e.maxR * 2) / (el.naturalWidth || 1);
      return [el.naturalWidth * k, el.naturalHeight * k];
    });
  }

  if (G.endScene) renderEnding(g, t);

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
  G.reward = (G.kills - (G.paidKills || 0)) * 8 + (G.stagesCleared - (G.paidStages || 0)) * 100 + (win ? 250 : 0);
  S.coins += G.reward;
  writeSave(S);
  // ما دُفع/استُهلك لا يُحسب مرة أخرى إذا أكمل اللاعب بعد GAME OVER
  G.paidKills = G.kills; G.paidStages = G.stagesCleared;
  G.boughtBomb = keepB; G.boughtMine = keepM; G.ammoUsed = false;
}

function newRound() {
  stopEnding();
  me = mkHero(G.side);
  applyLoadout();
  allies = [];
  G.time = 0; G.paused = false; G.kills = 0; G.dmgDealt = 0; G.result = null; G.stagesCleared = 0; G.paidKills = 0; G.paidStages = 0; G.dropping = false;
  loadStage(0);
}

// تحميل مرحلة: خلفية جديدة + أعداء + صناديق + رهينة + زعيم جديد. البطل يحتفظ بأرواحه وأسلحته وحلفائه
function loadStage(n) {
  G.stage = n;
  const S = curStage();
  IMG.bg = IMG.bgs[n];
  bgDiv.style.backgroundImage = 'url(' + BG_IMGS[n] + ')';
  fitWorld();
  enemies = []; items = []; parts = []; floaters = []; bullets = []; bombs = []; mines = []; crates = []; barrels = []; explosions = []; lobs = [];
  waveIdx = 0; G.timeLeft = LEVEL_TIME; G.timeUp = false; lastCount = -1;
  G.bossDead = false; G.bossIntro = false; G.bossDeadT = 0; G.winBroken = false; G.winJ = false; shards = []; ripples = []; rocks = []; G.doorBlown = false; G.doorRun = false;
  G.evX = START + S.evFirst; G.evN = 0;
  makeEnemyPlan();
  if (!S.rooftop) { spawnWorldObjects(); fitObjectsToGround(); }
  spawnHostages();
  if (S.boss) enemies.push(mkBoss());
  G.s0 = S.rooftop ? { wave: 0, waveT: 1.2, open: false, door: { hp: S0.door.hp, broken: false, hitT: 0 } } : null;
  const m = me;
  m.hidden = false;
  m.x = S.rooftop ? S0.heroX : START; m.y = S.rooftop ? S0.heroY : 312; m.z = 0; m.vz = 0; m.vx = 0; m.gz = 0; m.face = 1;
  if (!m.dead) { m.st = 'i'; m.atkT = -1; m.ah = false; }
  allies.forEach((a, i) => {
    a.x = START - 50 - i * 34; a.y = clamp(312 + (i % 2 ? 26 : -26), Y0, YB); a.vx = 0;
    a.st = 'i'; a.vicT = 0; a.tgt = null; a.atkT = -1;
  });
  cam = clamp(m.x - VW * .38, 0, Math.max(0, WORLD - VW));
  const bl = $('#bossbar span'); if (bl && S.boss) bl.textContent = S.boss.name;
  if (!S.rooftop) toast(S.title + ' — ' + S.name, 3000);
}

// المرحلة انتهت (هُزم الزعيم وعبر البطل البوابة): ننتقل للمرحلة التالية
function stageClear() {
  if (G.phase !== 'play') return;
  G.phase = 'trans'; G.transT = 0; G.transOutT = 0; G.stagesCleared++;
  if (G.stage === 0) return;   // المرحلة 0: البطل يدخل من الباب المحطم مباشرة
  banner('STAGE CLEAR!', true);
  playSnd(SND.pick);
  const m = me;
  m.hp = Math.min(100, m.hp + 40);
  floatText(m.x, m.y - 90, '+40', '#9dff8a');
  playSnd(SND.health_refill);
}
// ---------- القفز من النافذة (نهاية المرحلة 1) ----------
function winW() { const W = curStage().window, k = bgScale(); return { left: W.left * k, cx: W.cx * k, sill: W.sill * k, launchX: W.launchX * k, poly: W.poly.map(p => [p[0] * k, p[1] * k]) }; }
function breakWindow() {
  if (G.winBroken) return;
  G.winBroken = true;
  playSnd(SND.glass); shake = Math.min(14, shake + 9);
  const W = winW();
  // شظايا الزجاج تتطاير ثم تسقط على الأرض
  for (let i = 0; i < 46; i++) {
    const t = Math.random(), u = Math.random();
    const px = W.left + (W.poly[1][0] - W.left) * t;
    const sy = (W.poly[0][1] + (W.poly[1][1] - W.poly[0][1]) * t) * (1 - u) + (W.poly[3][1] + (W.poly[2][1] - W.poly[3][1]) * t) * u;
    const fy = Y0 + rr(0, 60);
    shards.push({ x: px, y: fy, z: Math.max(0, fy - sy), vx: rr(-300, 60), vz: rr(-30, 170), r: rr(0, 6.3), vr: rr(-14, 14), s: rr(3, 8.5), l: rr(1.4, 2.6), m: rr(0, 1) });
  }
  for (let i = 0; i < 18; i++) parts.push({ x: W.cx, y: Y0 + 4, z: rr(Y0 - W.sill, Y0 - W.poly[0][1]), vx: rr(-180, 80), vz: rr(-20, 120), l: rr(.3, .7), c: '#ffffff' });
}
function updateShards(dt) {
  for (const p of shards) {
    p.l -= dt; p.vz -= 700 * dt; p.x += p.vx * dt; p.z += p.vz * dt; p.r += p.vr * dt;
    if (p.z <= 0) { p.z = 0; p.vz = -p.vz * .3; p.vx *= .45; p.vr *= .5; }
  }
  shards = shards.filter(p => p.l > 0);
}
function drawWindowAndShards(g, t) {
  const S = curStage();
  if (S.window && G.winBroken) {
    // الفتحة المكسورة: ليل خلف النافذة وبقايا زجاج حادة على الإطار
    const W = winW(), P = W.poly.map(p => [p[0] - cam, p[1]]);
    const grd = g.createLinearGradient(0, P[0][1], 0, P[3][1]);
    grd.addColorStop(0, 'rgba(6,10,30,.92)'); grd.addColorStop(1, 'rgba(14,28,70,.92)');
    g.fillStyle = grd; g.beginPath(); P.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.fill();
    g.fillStyle = 'rgba(170,215,255,.75)'; g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 1;
    const edge = (a, b, n, inward) => {
      for (let i = 0; i < n; i++) {
        const u0 = i / n, u1 = (i + 1) / n, um = (u0 + u1) / 2;
        const ax = a[0] + (b[0] - a[0]) * u0, ay = a[1] + (b[1] - a[1]) * u0, bx = a[0] + (b[0] - a[0]) * u1, by = a[1] + (b[1] - a[1]) * u1;
        const len = 4 + ((i * 7) % 5) * 2.2, mx = a[0] + (b[0] - a[0]) * um + inward[0] * len, my = a[1] + (b[1] - a[1]) * um + inward[1] * len;
        g.beginPath(); g.moveTo(ax, ay); g.lineTo(mx, my); g.lineTo(bx, by); g.closePath(); g.fill(); g.stroke();
      }
    };
    edge(P[0], P[1], 5, [0, 1]); edge(P[3], P[2], 5, [0, -1]); edge(P[0], P[3], 8, [1, 0]);
  }
  for (const p of shards) {
    const a = clamp(p.l, 0, 1);
    g.save(); g.translate(p.x - cam, p.y - p.z); g.rotate(p.r);
    g.globalAlpha = a; g.fillStyle = p.m < .5 ? 'rgba(180,225,255,.85)' : 'rgba(225,245,255,.9)'; g.strokeStyle = '#ffffff'; g.lineWidth = .8;
    g.beginPath(); g.moveTo(-p.s * .6, p.s * .4); g.lineTo(0, -p.s); g.lineTo(p.s * .5, p.s * .5); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }
}
// كل شخصية (البطل ثم الحلفاء): تجري إلى نقطة الانطلاق، تقفز نحو النافذة، وتختفي خلفها
function windowActor(o, dt, delay, isHero) {
  const W = winW();
  const j = o.wj || (o.wj = { ph: 'wait', t: 0 });
  j.t += dt;
  o.face = 1; o.atkT = -1; o.vicT = 0;
  if (j.ph === 'wait') { o.mv = false; o.st = 'i'; if (j.t >= delay) { j.ph = 'run'; j.t = 0; } return false; }
  if (j.ph === 'run') {
    const tx = W.launchX, ty = Y0 + 6, dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy);
    o.st = 'i'; o.mv = true; o.ph += dt * 16; o.z = 0;
    if (d > 4) { const st = Math.min(d, 260 * dt); o.x += dx / d * st; o.y += dy / d * st; }
    else { j.ph = 'jump'; j.t = 0; j.x0 = o.x; j.zEnd = Math.max(20, o.y - W.sill + 4); if (isHero) playSnd(SND.jump); }
    return false;
  }
  if (j.ph === 'jump') {
    const T = .6, u = Math.min(1, j.t / T);
    o.st = 'j'; o.mv = true;
    o.x = j.x0 + (W.cx + 30 - j.x0) * u;
    o.z = j.zEnd * u + 150 * u * (1 - u);
    if (o.x >= W.left - 8) breakWindow();
    if (u >= 1) { j.ph = 'gone'; o.hidden = true; o.mv = false; }
    return false;
  }
  return true;
}

// ---------- البحيرة: ماء متحرك بنسيم خفيف + تموجات ورذاذ تحت الأقدام ----------
let ripples = [];
function lakeW() { const Wt = curStage().water; if (!Wt) return null; const k = bgScale(); return { x0: Wt.x0 * k, x1: Wt.x1 * k, top: Wt.top * k, bottom: Wt.bottom * k }; }
function inLake(o, L) { return L && o.x > L.x0 + 4 && o.x < L.x1 - 4 && (o.z || 0) < 4; }
function updateWater(dt) {
  for (const r of ripples) r.t += dt;
  ripples = ripples.filter(r => r.t < r.life);
  const L = lakeW();
  if (!L || (G.phase !== 'play' && G.phase !== 'trans')) return;
  const list = [me].concat(allies.filter(a => !a.dead && !a.hidden), enemies.filter(e => !e.dying && e.st !== 'dead'));
  for (const o of list) {
    if (!o) continue;
    const air = (o.z || 0) >= 4;
    if (inLake(o, L)) {
      if (o._air) {   // هبط في الماء بعد قفزة: رذاذ كبير
        ripples.push({ x: o.x, y: o.y, t: 0, life: 1.1, r: 34 });
        for (let i = 0; i < 14; i++) parts.push({ x: o.x + rr(-10, 10), y: o.y, z: 2, vx: rr(-110, 110), vz: rr(90, 230), l: rr(.35, .7), c: i % 2 ? '#d8f6ff' : '#7fd3e6' });
      }
      o._rip = (o._rip || 0) - dt;
      if (o._rip <= 0) {
        const moving = o.mv || o.st === 'walk' || o.charge;
        ripples.push({ x: o.x, y: o.y, t: 0, life: moving ? .8 : 1.3, r: moving ? 20 : 26 });
        if (moving) for (let i = 0; i < 4; i++) parts.push({ x: o.x + rr(-8, 8), y: o.y, z: 1, vx: rr(-60, 60) - (o.face || 0) * 25, vz: rr(50, 120), l: rr(.2, .4), c: '#cdf3ff' });
        o._rip = moving ? .2 : .9;
      }
    }
    o._air = air;
  }
}
// ---------- البحر (المرحلة 0): تموجات ولمعات يحركها الهواء، مقصوصة على شكل الماء في الصورة ----------
let seaFx = null;
const SEA_MASK = new Image(); SEA_MASK.src = 'images/backgrounds/sea-mask-stage0.png';
function buildSeaMask() {
  const S = curStage(), A = S.sea, k = bgScale(), img = IMG.bg;
  if (!A || !img || !img.complete || !img.naturalWidth) return null;
  const R = LOWQ ? 1 : 2;   // دقة القناع: بكسلان لكل وحدة عالم (واحد في الجودة المنخفضة)
  const x0 = A.x0 * k, y0 = A.top * k, w = (A.x1 - A.x0) * k, h = (A.bottom - A.top) * k;
  const cw = Math.round(w * R), ch = Math.round(h * R);
  const mask = document.createElement('canvas'); mask.width = cw; mask.height = ch;
  const mx = mask.getContext('2d');
  const sx = img.naturalWidth / S.ref[0], sy = img.naturalHeight / S.ref[1];
  let ok = false;
  if (S.rooftop && SEA_MASK.complete && SEA_MASK.naturalWidth) {
    // قناع البحر الجاهز: يعمل حتى عند فتح اللعبة من ملف محلي
    const mk = SEA_MASK.naturalWidth / S.ref[0];
    mx.drawImage(SEA_MASK, A.x0 * mk, A.top * mk, (A.x1 - A.x0) * mk, (A.bottom - A.top) * mk, 0, 0, cw, ch);
    ok = true;
  } else try {
    mx.drawImage(img, A.x0 * sx, A.top * sy, (A.x1 - A.x0) * sx, (A.bottom - A.top) * sy, 0, 0, cw, ch);
    const d = mx.getImageData(0, 0, cw, ch), p = d.data, N = cw * ch;
    const blue = new Uint8Array(N), keep = new Uint8Array(N);
    for (let j = 0, i = 0; j < N; j++, i += 4) {
      const r = p[i], gg = p[i + 1], b = p[i + 2];
      blue[j] = (b > 120 && b > r + 45 && b >= gg - 10 && gg > 50) ? 1 : 0;
    }
    // نأخذ فقط الماء المتصل بالبحر المفتوح (لا الأبواب ولا النوافذ الزرقاء ولا الأرضية)
    const stack = [], sy0 = Math.round((A.seed - A.top) * k * R);
    for (let x = 0; x < cw; x++) { const j = sy0 * cw + x; if (blue[j]) { keep[j] = 1; stack.push(j); } }
    while (stack.length) {
      const j = stack.pop(), x = j % cw;
      const nb = [x > 0 ? j - 1 : -1, x < cw - 1 ? j + 1 : -1, j - cw, j + cw];
      for (const q of nb) if (q >= 0 && q < N && blue[q] && !keep[q]) { keep[q] = 1; stack.push(q); }
    }
    // تآكل خفيف حتى لا يلمس التأثير حواف السطح أو المباني
    for (let j = 0, i = 0; j < N; j++, i += 4) {
      const x = j % cw;
      const ok2 = keep[j] && (x < 2 || keep[j - 2]) && (x > cw - 3 || keep[j + 2]) && keep[j - 2 * cw] && keep[j + 2 * cw];
      p[i] = p[i + 1] = p[i + 2] = 255; p[i + 3] = ok2 ? 255 : 0;
    }
    mx.putImageData(d, 0, 0); ok = true;
  } catch (e) {
    // عند فتح اللعبة من ملف محلي يمنع المتصفح قراءة البكسلات: نستعمل شريط البحر المستطيل فقط
    const B = A.band; mx.fillStyle = '#fff';
    mx.fillRect((B[0] - A.x0) * k * R, (B[2] - A.top) * k * R, (B[1] - B[0]) * k * R, (B[3] - B[2]) * k * R);
  }
  const fx = document.createElement('canvas'); fx.width = cw; fx.height = ch;
  return { stage: G.stage, mask: mask, fx: fx, x0: x0, y0: y0, w: w, h: h, R: R, ok: ok, low: LOWQ };
}
function drawSea(g, t) {
  if (!curStage().sea) return;
  if (!seaFx || seaFx.stage !== G.stage || (!seaFx.ok && SEA_MASK.complete && SEA_MASK.naturalWidth)) seaFx = buildSeaMask();
  const F = seaFx; if (!F) return;
  if (F.x0 + F.w < cam - 10 || F.x0 > cam + VW + 10) return;
  const c = F.fx.getContext('2d'), R = F.R, W = F.fx.width, Hh = F.fx.height;
  c.globalCompositeOperation = 'source-over'; c.clearRect(0, 0, W, Hh);
  // أمواج شفافة ناعمة تتحرك مع نسيم خفيف: قمة فاتحة وظل خفيف تحتها
  // بدون filter:blur (ثقيل جداً على الهواتف): النعومة تأتي من خط عريض باهت تحت كل موجة
  c.lineCap = 'round'; c.lineJoin = 'round';
  const nW = LOWQ ? 10 : 18;
  for (let i = 0; i < nW; i++) {
    const k = i / (nW - 1), y = (6 + k * (F.h - 10)) * R + Math.sin(t * .6 + i * 1.3) * 1.5 * R;
    const amp = (.8 + k * 2.2) * R, fr = .035 - k * .018, sp = .7 + k * .4;
    const al = .22 + .14 * (.5 + .5 * Math.sin(t * .9 + i * 1.9));
    const layers = [['0,45,95', (1.5 + k * 2) * R, (1.2 + k * 2) * R, al * .7], ['255,255,255', 0, (1 + k * 1.6) * R * 2.6, al * .3], ['255,255,255', 0, (1 + k * 1.6) * R * .8, al]];
    for (const [col, dy, lw, aa] of layers) {
      c.strokeStyle = 'rgba(' + col + ',' + aa + ')';
      c.lineWidth = lw; c.beginPath();
      for (let x = -20; x <= W + 20; x += 8 * R) {
        const yy = y + dy + Math.sin((x / R + F.x0) * fr + t * sp + i * 2.1) * amp;
        x === -20 ? c.moveTo(x, yy) : c.lineTo(x, yy);
      }
      c.stroke();
    }
  }
  // لمعات خفيفة جدا تنجرف ببطء
  for (let i = 0; i < (LOWQ ? 25 : 60); i++) {
    const k = ((i * 37) % 100) / 100;
    const gx = (((i * 113.7) + t * (6 + k * 8)) % (F.w + 40)) - 20, gy = 4 + k * (F.h - 8);
    const a = .35 * Math.sin(t * 1.6 + i * 2.3);
    if (a <= .03) continue;
    c.fillStyle = 'rgba(255,255,255,' + a + ')';
    c.fillRect(gx * R, gy * R, (2 + k * 4) * R, Math.max(1, .7 * R));
  }
  // قص التأثير على شكل الماء فقط
  c.globalCompositeOperation = 'destination-in';
  c.drawImage(F.mask, 0, 0);
  c.globalCompositeOperation = 'source-over';
  g.drawImage(F.fx, F.x0 - cam, F.y0, F.w, F.h);
}

function drawWater(g, t) {
  drawSea(g, t);
  const L = lakeW();
  if (L) drawWaterRect(g, t, L, 16, 46);
  const P = curStage().pools;
  if (P) {
    const k = bgScale();
    for (const p of P) {
      const r = { x0: p.x0 * k, x1: p.x1 * k, top: p.top * k, bottom: p.bottom * k };
      drawWaterRect(g, t, r, Math.max(3, Math.round((r.bottom - r.top) / 6)), Math.max(4, Math.round((r.x1 - r.x0) * (r.bottom - r.top) / 260)));
    }
  }
  drawRipples(g);
}
function drawWaterRect(g, t, L, nLines, nGlints) {
  if (LOWQ) { nLines = Math.ceil(nLines / 2); nGlints = Math.ceil(nGlints / 2); }
  const x0 = L.x0 - cam, x1 = L.x1 - cam;
  if (x1 < -20 || x0 > VW + 20) return;
  g.save();
  g.beginPath(); g.rect(x0, L.top, x1 - x0, L.bottom - L.top); g.clip();
  // تموجات أفقية تتحرك ببطء مع النسيم
  const wind = t * 14;
  for (let i = 0; i < nLines; i++) {
    const y = L.top + 4 + i * (L.bottom - L.top - 4) / nLines + Math.sin(t * .9 + i) * 1.5;
    g.strokeStyle = 'rgba(220,250,255,' + (.07 + .05 * Math.sin(t * 1.3 + i * 1.7)) + ')';
    g.lineWidth = i < 3 ? 1.3 : 1;
    g.beginPath();
    for (let x = x0 - 10; x <= x1 + 10; x += 8) {
      const yy = y + Math.sin((x + cam) * .045 + t * 1.6 + i * .8) * (1.2 + i * .08);
      x === x0 - 10 ? g.moveTo(x, yy) : g.lineTo(x, yy);
    }
    g.stroke();
  }
  // لمعات صغيرة تنجرف مع الهواء
  for (let i = 0; i < nGlints; i++) {
    const fx = ((i * 97.3 + wind * (1 + (i % 3) * .3)) % (L.x1 - L.x0)) + L.x0 - cam;
    const fy = L.top + 6 + ((i * 53.7) % (L.bottom - L.top - 10));
    const a = .18 + .18 * Math.sin(t * 3 + i * 2.1);
    if (a <= .05) continue;
    g.fillStyle = 'rgba(255,255,255,' + a + ')';
    g.fillRect(fx, fy, 4 + (i % 4) * 2, 1);
  }
  // خط السطح المتلألئ
  g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.2; g.beginPath();
  for (let x = x0; x <= x1; x += 6) { const yy = L.top + 1 + Math.sin((x + cam) * .08 + t * 2.2) * .9; x === x0 ? g.moveTo(x, yy) : g.lineTo(x, yy); }
  g.stroke();
  g.restore();
}
function drawRipples(g) {
  // تموجات الأقدام: دوائر تتسع وتختفي
  for (const r of ripples) {
    const k = r.t / r.life, rx = 5 + r.r * k;
    g.strokeStyle = 'rgba(230,252,255,' + (.6 * (1 - k)) + ')'; g.lineWidth = 1.4;
    g.beginPath(); g.ellipse(r.x - cam, r.y + 1, rx, rx * .3, 0, 0, 6.3); g.stroke();
    if (k < .6) { g.strokeStyle = 'rgba(230,252,255,' + (.4 * (1 - k / .6)) + ')'; g.beginPath(); g.ellipse(r.x - cam, r.y + 1, rx * .55, rx * .17, 0, 0, 6.3); g.stroke(); }
  }
}

// بداية المرحلة التالية: البطل (وحلفاؤه) ينزلون من الأعلى كتكملة للقفزة، وشظايا الزجاج تتساقط حولهم
function dropFromWindow() {
  const m = me;
  G.dropping = true; G.dropUntil = G.time + 3;   // الواجهة والأزرار مخفية 3 ثوانٍ في بداية المرحلة 2
  m.x = START + 60; m.y = 300; m.z = 330; m.vz = -60; m.st = 'j'; m.atkT = -1; m.inv = 1.2; m.face = 1;
  allies.forEach((a, i) => { a.x = START - 10 - i * 45; a.y = clamp(300 + (i % 2 ? 30 : -30), Y0, YB); a.z = 380 + i * 90; a.vz = -60; a.st = 'i'; });
  for (let i = 0; i < 30; i++) {
    shards.push({ x: m.x + rr(-110, 130), y: clamp(m.y + rr(-45, 45), Y0, YB), z: rr(140, 420), vx: rr(-40, 70), vz: rr(-80, 40),
      r: rr(0, 6.3), vr: rr(-12, 12), s: rr(3, 8), l: rr(2, 3), m: rr(0, 1) });
  }
  cam = clamp(m.x - VW * .38, 0, Math.max(0, WORLD - VW));
}

function stepTransition(dt) {
  G.transT += dt;
  if (G.doorRun) {
    // الدخول عبر الباب الحجري المحطم جرياً
    const D = doorW();
    const run = (o, delay) => {
      if (o.hidden || G.transT < delay) { if (!o.hidden) { o.mv = false; o.st = 'i'; } return o.hidden; }
      o.st = 'i'; o.atkT = -1; o.vicT = 0; o.z = 0; o.face = 1; o.mv = true; o.ph += dt * 18;
      const tx = D.cx + 10, ty = yBounds(D.x0)[0] + 4, dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy);
      if (d > 5) { const st = Math.min(d, 320 * dt); o.x += dx / d * st; o.y += dy / d * st; if (Math.random() < .4) parts.push({ x: o.x - 10, y: o.y, z: 2, vx: rr(-80, -20), vz: rr(20, 60), l: rr(.15, .3), c: '#b89a74' }); }
      else { o.hidden = true; o.mv = false; }
      return o.hidden;
    };
    let all = run(me, 0), d = .35;
    for (const a of allies) { if (a.dead) continue; if (!run(a, d)) all = false; d += .3; }
    if (all && !G.transOutT) G.transOutT = G.transT;
    if (G.transOutT && G.transT > G.transOutT + .4) {
      G.doorRun = false; G.transOutT = 0;
      G.stagesCleared = STAGE_COUNT; startEnding();   // المشهد السينمائي الأخير ثم الفوز
    }
    return;
  }
  if (G.winJ) {
    // نهاية المرحلة 1: القفز من النافذة الكبيرة
    let out = windowActor(me, dt, 0, true);
    let d = .55;
    for (const a of allies) { if (a.dead) continue; if (!windowActor(a, dt, d, false)) out = false; d += .4; }
    if (out && !G.transOutT) G.transOutT = G.transT + .5;
    if (G.transOutT && G.transT > G.transOutT + .3 && !G.transFaded) { G.transFaded = true; bgDiv.style.opacity = '0'; layer.style.opacity = '0'; }
    if (G.transOutT && G.transT > G.transOutT + .9) {
      if (!bgReady(G.stage + 1)) { banner('LOADING...'); return; }
      G.transFaded = false; G.transOutT = 0; G.winJ = false;
      me.z = 0; me.st = 'i'; me.wj = null;
      allies.forEach(a => { a.hidden = false; a.z = 0; a.wj = null; });
      loadStage(G.stage + 1);
      dropFromWindow();
      bgDiv.style.opacity = '1'; layer.style.opacity = '1';
      G.phase = 'play';
      banner(curStage().title, true);
      setTimeout(() => { if (G.phase === 'play') banner(''); }, 1500);
    }
    return;
  }
  // البطل يمشي إلى الأمام حتى يختفي وراء إطار الشاشة، والحلفاء يلحقون به
  const m = me;
  m.st = 'i'; m.atkT = -1; m.z = 0; m.vz = 0; m.gz = 0; m.face = 1; m.mv = true; m.ph += dt * 12;
  let out;
  if (G.stage === 0) {
    // يمشي إلى الباب المحطم ثم يدخل منه
    const tx = S0.door.x, ty = S0.door.bottom + 4, dx = tx - m.x, dy = ty - m.y, d = Math.hypot(dx, dy);
    if (d > 4) { const st = Math.min(d, 150 * dt); m.x += dx / d * st; m.y += dy / d * st; }
    else { m.hidden = true; m.mv = false; }
    out = m.hidden;
  } else {
    m.x += 175 * dt;
    out = m.x > cam + VW + 70;
  }
  for (const a of allies) {
    if (a.dead) continue;
    a.st = 'i'; a.atkT = -1; a.vicT = 0; a.face = 1; a.mv = true; a.ph += dt * 12;
    a.x += (a.x < m.x - 60 ? 260 : 175) * dt;
    if (a.x < cam + VW + 70) out = false;
  }
  if ((out || G.transT > 7) && !G.transOutT) G.transOutT = G.transT;
  if (G.transOutT && G.transT > G.transOutT + .3 && !G.transFaded) { G.transFaded = true; bgDiv.style.opacity = '0'; layer.style.opacity = '0'; }
  if (G.transOutT && G.transT > G.transOutT + .9) {
    if (!bgReady(G.stage + 1)) { banner('LOADING...'); return; }
    G.transFaded = false; G.transOutT = 0;
    loadStage(G.stage + 1);
    bgDiv.style.opacity = '1'; layer.style.opacity = '1';
    // العد 3-2-1-GO في بداية المرحلة الأولى فقط؛ المراحل التالية تبدأ مباشرة مع اسم المرحلة
    G.phase = 'play';
    banner(curStage().title, true);
    setTimeout(() => { if (G.phase === 'play') banner(''); }, 1500);
  }
}

// ---------- أحداث مختلفة لكل مرحلة ----------
function stageEvent(kind) {
  const m = me, D = DIFF[G.diff];
  const lane = () => laneAt(m.x);
  const maxX = WORLD - ARENA - 40;
  if (kind === 'ambush') {
    // المرحلة 1: كمين في الشارع، عصابة تهاجم من الخلف ومن الأمام
    toast('AMBUSH!', 1800);
    const back = G.evN > 1 ? ['thug', 'cop', 'thug'] : ['thug', 'cop'];
    back.forEach((k, i) => enemies.push(mkEnemy(k, clamp(m.x - VW * .5 - 60 - i * 50, 40, maxX), lane())));
    enemies.push(mkEnemy(G.evN > 1 ? 'cop' : 'thug', clamp(m.x + VW * .5 + 80, 40, maxX), lane()));
  } else if (kind === 'ninjaDrop') {
    // المرحلة 2: نينجا يسقطون من فوق الحاويات
    toast('NINJAS FROM ABOVE!', 1800);
    const n = G.evN > 1 ? 4 : 3;
    for (let i = 0; i < n; i++) {
      const e = mkEnemy('ninja', clamp(m.x + rr(-200, 240), 40, maxX), lane());
      e.z = 300 + i * 70; e.vz = 0; e.rcd = rr(.8, 1.6);
      enemies.push(e);
    }
  } else if (kind === 'stampede') {
    // المرحلة 3: ديناصورات هائجة تركض عبر الغابة، اقفز فوق صندوق أو ابتعد عن طريقها
    toast('STAMPEDE! JUMP ON A CRATE!', 2200);
    const dir = G.evN % 2 ? -1 : 1;
    const n = G.evN > 1 ? 5 : 4;
    for (let i = 0; i < n; i++) {
      const x = dir > 0 ? cam - 120 - i * 95 : Math.min(cam + VW + 120 + i * 95, WORLD - ARENA - 20);
      const e = mkEnemy('raptor', x, i === 0 ? m.y : laneAt(x));
      e.charge = dir; e.face = dir;
      enemies.push(e);
    }
  } else if (kind === 'airstrike') {
    // المرحلة 4: غارة جوية، قنابل تسقط من السماء على علامات حمراء
    toast('AIRSTRIKE! WATCH THE RED MARKS!', 2200);
    const n = G.evN > 1 ? 7 : 5;
    for (let i = 0; i < n; i++) {
      const x = i === 0 ? m.x : clamp(m.x + rr(-220, 280), 40, maxX), y = i === 0 ? m.y : lane();
      bombs.push({ drop: true, x: x, y: y, z: 420, vx: 0, vz: 0, t: 0, delay: .7 + i * .35, owner: 'sky', dm: Math.round(38 * D.dmg), radius: 100, settled: false });
    }
  }
  G.evN++;
}

function startCountdown() {
  newRound();
  // المشهد السينمائي في بداية اللعبة (المرحلة 0) ثم العد 3-2-1-GO
  G.phase = 'intro'; G.introT = 0; G.zoom = S0Z.from;
  $('#hud').hidden = true;
  stageLbl.hidden = true;
  $('#hp0 .nm').textContent = HEROES[G.side] ? HEROES[G.side].name : 'HERO';
  $('#hp0').className = 'hpc s' + G.side;
  $('#hpPortrait').src = (id => 'images/heroes/' + id + '/face-' + id + '.png')(HEROES[G.side] ? HEROES[G.side].id : 'player1h');
}

function endRound(win) {
  if (G.phase !== 'play') return;
  G.phase = 'over'; G.overT = 0; G.result = { win: win };
  settleRound(win);
  playSnd(win ? SND.win : SND.lose);
  banner(win ? 'VICTORY!' : 'GAME OVER', true);
  if (!win) SND.bgm.pause();
}

function showResult() {
  const w = G.result.win;
  $('#rbox').classList.toggle('lose', !w);
  $('#rTitle').textContent = w ? 'YOU WIN!' : 'GAME OVER';
  // نافذة GAME OVER: كونتينيو + ريستارت + منيو. الفوز: بلاي أجين + منيو
  contBtn.hidden = w;
  $('#rAgain').textContent = w ? 'PLAY AGAIN' : 'RESTART';
  $('#rSub').textContent = w ? 'You beat all 4 stages and every gang boss!'
    : (G.timeUp ? 'Time ran out and you lost your last life.' : 'You ran out of lives.') + ' Reached ' + curStage().title + ' of ' + LAST_NUM + '.';
  $('#rCoins').textContent = '+' + G.reward + ' COINS';
  $('#sTime').textContent = Math.round(G.time);
  $('#sKills').textContent = G.kills;
  $('#sDmg').textContent = G.dmgDealt;
  banner('');
  $('#result').hidden = false;
}

function playAgain() {
  $('#result').hidden = true;
  if (!muted) SND.bgm.play().catch(() => {});
  startCountdown();
}

// CONTINUE: يكمل اللعب من نفس المكان الذي مات فيه، بأرواح كاملة، في نفس المرحلة وبنفس الأعداء
function continueGame() {
  if (!G.result || G.result.win) return;
  $('#result').hidden = true; banner('');
  const m = me;
  m.lives = 3; m.hp = 100; m.dead = false; m.respT = 0;
  m.st = 'i'; m.stT = 0; m.z = 0; m.vz = 0; m.vx = 0; m.atkT = -1; m.ah = false; m.throwT = -1;
  m.inv = 2.5;   // حماية قصيرة بعد العودة
  m.hitChain = 0;
  if (G.timeLeft <= 0 || G.timeUp) G.timeLeft = LEVEL_TIME;
  G.timeUp = false; G.result = null; G.overT = 0;
  bullets = bullets.filter(b => b.owner === 'me'); lobs = [];
  floatText(m.x, m.y - 90, 'CONTINUE!', '#9dff8a');
  G.phase = 'play';
  inp.atk = inp.jmp = inp.sw = inp.bomb = inp.mine = false;
  if (!muted) SND.bgm.play().catch(() => {});
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

// ---------- المشهد السينمائي: زوم كبير على النصف الأيسر، ثم تتراجع الكاميرا وتتحرك يميناً نحو البطل ----------
const S0Z = { from: 1.8, fx: 543 * IK, fy: 470 * IK };   // وسط النصف الأيسر من الصورة   // الزوم الابتدائي ونقطة التركيز (وسط النصف الأيسر)
function smooth(k) { k = clamp(k, 0, 1); return k * k * (3 - 2 * k); }
function stepIntro(dt) {
  G.introT += dt;
  const T = G.introT, zk = smooth((T - .9) / 2.6), pk = smooth((T - 2.1) / 2.7);
  G.zoom = S0Z.from + (1 - S0Z.from) * zk;
  const camEnd = clamp(me.x - VW * .38, 0, Math.max(0, WORLD - VW));
  cam = camEnd * pk;
  updateMe(dt);
  if (T >= S0.intro) endIntro();
}
function endIntro() {
  if (G.phase !== 'intro') return;
  G.zoom = 1; G.phase = 'play'; lastCount = -1;   // بعد المشهد يبدأ اللعب مباشرة (بدون عد تنازلي)
  cam = clamp(me.x - VW * .38, 0, Math.max(0, WORLD - VW));
  $('#hud').hidden = false; stageLbl.hidden = false;
}
// تحويل CSS للزوم: النقطة (fx,fy) تظهر في وسط الشاشة عند الزوم الابتدائي ويعود كل شيء طبيعياً عند 1
function zoomCss() {
  const Z = G.zoom || 1;
  if (Z <= 1.0001) return '';
  const k = (Z - 1) / (S0Z.from - 1);                        // 1 في البداية → 0 في النهاية
  const W = VW * CS, Hh = H * CS;
  const ax = ((W / 2) - (S0Z.fx - cam) * CS * S0Z.from) / (1 - S0Z.from);
  const ay = ((Hh / 2) - S0Z.fy * CS * S0Z.from) / (1 - S0Z.from);
  // نفس نقطة الارتكاز طوال الزوم حتى يكون التراجع سلساً
  return ' translate(' + ax + 'px,' + ay + 'px) scale(' + Z + ') translate(' + (-ax) + 'px,' + (-ay) + 'px)';
}
function applyZoom() {
  if (!applyZoom.init) { applyZoom.init = 1; bgDiv.style.transformOrigin = cv.style.transformOrigin = layer.style.transformOrigin = '0 0'; }
  const z = zoomCss().trim();
  if (bgDiv.style.transform !== z) bgDiv.style.transform = z;
  if (cv.style.transform !== z) cv.style.transform = z;
}

// ---------- المرحلة 0: موجات الأعداء من فوق الأسطح، ثم تحطيم الباب ----------
function s0SpawnWave(kinds) {
  kinds.forEach((k, i) => {
    // نقطة الهبوط دائماً فوق أرضية البطل (داخل الحدود)
    let tx = clamp(me.x + (i % 2 ? -1 : 1) * rr(80, 170), S0.minX + 40, S0.maxX - 20);
    const b = s0Bounds(tx), ty = rr(b[0] + 3, b[1] - 3);
    tx = Math.max(tx, s0MinX(ty) + 12);
    let e;
    if (i % 2 === 0) {
      // يقف فوق سطح المبنى الأيمن ثم يقفز إلى الأرضية
      const r = S0.roofs[(G.s0.wave + i) % S0.roofs.length];
      e = mkEnemy(k, r.x, ty);
      e.z = Math.max(10, ty - r.sy); e.standT = .7 + i * .3;
    } else {
      // يسقط من أعلى الشاشة مباشرة فوق نقطة الهبوط
      e = mkEnemy(k, tx, ty);
      e.z = ty + 60 + i * 30; e.vz = 0;
    }
    e.tx = tx; e.face = me.x >= e.x ? 1 : -1;
    enemies.push(e);
  });
  toast(G.s0.wave === 0 ? 'ENEMIES ON THE ROOF!' : 'MORE ENEMIES!', 1600);
}
function stepStage0(dt) {
  const st = G.s0;
  if (!st || st.open) return;
  if (enemies.some(e => alive(e) || e.standT > 0)) return;
  st.waveT -= dt;
  if (st.waveT > 0) return;
  if (st.wave < S0.waves.length) { s0SpawnWave(S0.waves[st.wave]); st.wave++; st.waveT = 1.4; }
  else { st.open = true; toast('BREAK THE DOOR!', 2600); }
}
// ضرب الباب (بالقبضة/السكين/الرصاص/الانفجار) بعد قتل كل الأعداء
function hitDoor(dm) {
  const st = G.s0;
  if (!st || !st.open || st.door.broken) return false;
  const D = st.door;
  D.hp -= dm; D.hitT = .15;
  playSnd(SND.hit); shake = Math.min(6, shake + 2);
  for (let i = 0; i < 6; i++) parts.push({ x: S0.door.x + rr(-12, 12), y: S0.door.bottom, z: rr(20, 70), vx: rr(-90, 40), vz: rr(40, 140), l: rr(.25, .5), c: i % 2 ? '#3d7fc2' : '#7a5230' });
  if (D.hp <= 0) {
    D.broken = true; shake = 12; playSnd(SND.box_destroy);
    for (let i = 0; i < 22; i++) parts.push({ x: S0.door.x + rr(-14, 14), y: S0.door.bottom, z: rr(10, 85), vx: rr(-160, 60), vz: rr(60, 220), l: rr(.4, .9), c: i % 3 ? '#3d7fc2' : '#5a3a22' });
    stageClear();
  }
  return true;
}
function nearDoor(x, y, reach) {
  return Math.abs(x - S0.door.x) < reach + 14 && y >= S0.door.bottom - 16;
}
function drawDoor(g, t) {
  const st = G.s0;
  if (!st) return;
  const d = S0.door, x0 = d.left - cam, w = d.right - d.left, y0 = d.top, h = d.bottom - d.top;
  if (st.door.broken) {
    // فتحة مظلمة مكان الباب المحطم
    const grd = g.createLinearGradient(0, y0, 0, y0 + h);
    grd.addColorStop(0, '#0b0806'); grd.addColorStop(1, '#2a1c12');
    g.fillStyle = grd; g.fillRect(x0, y0, w, h);
    g.fillStyle = '#2f5f93'; g.fillRect(x0, y0 + h - 6, w * .45, 6); g.fillRect(x0 + w * .6, y0 + 4, 4, h * .35);
    return;
  }
  // شقوق تزداد مع الضرب
  const dmg = 1 - st.door.hp / d.hp;
  if (dmg > 0) {
    g.strokeStyle = 'rgba(20,12,6,.85)'; g.lineWidth = 1.5;
    const n = Math.ceil(dmg * 6);
    for (let i = 0; i < n; i++) {
      const cx = x0 + w * (.2 + .6 * ((i * 37) % 10) / 10), cy = y0 + h * (.15 + .7 * ((i * 53) % 10) / 10);
      g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + 6, cy + 9); g.lineTo(cx + 2, cy + 17); g.moveTo(cx + 6, cy + 9); g.lineTo(cx + 12, cy + 7); g.stroke();
    }
  }
  if (st.door.hitT > 0) { g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(x0, y0, w, h); }
  if (st.open) {
    // سهم يشير إلى الباب
    const ay = y0 - 14 + Math.sin(t * 6) * 4, ax = d.x - cam;
    g.fillStyle = '#000'; g.beginPath(); g.moveTo(ax - 9, ay - 12); g.lineTo(ax + 9, ay - 12); g.lineTo(ax, ay + 1); g.closePath(); g.fill();
    g.fillStyle = '#ffc233'; g.beginPath(); g.moveTo(ax - 7, ay - 11); g.lineTo(ax + 7, ay - 11); g.lineTo(ax, ay - 1); g.closePath(); g.fill();
  }
}

// ==========================================
// المشهد السينمائي الأخير (20 ثانية، بدون لعب ولا تحكم) في خلفية الغابة:
// السيارة الحمراء (car.png وفيها MINA و MAX) تسير، وJACK و REX يجريان خلفها ثم بجانبها ويغيّران سرعتهما
// ==========================================
const ENDING = {
  fade: .55, bgStage: 3, endHold: 3, endBlack: 2,   // عند نهاية الخلفية: الأبطال يتوقفون ويحتفلون 3 ثوانٍ، ثم تظلم الشاشة تدريجياً (2 ث) ثم نافذة الفوز
  camSpeed: 92,                               // سرعة تحرك الكاميرا/السيارة/الأبطال في العالم
  carH: 118, carY: 328, carScreenX: .6,       // ارتفاع السيارة على الشاشة، عمقها، ومكانها الأفقي
  // عجلات car.png (بإحداثيات الصورة 1000×476): المركز ونصف القطر
  wheels: [{ x: 228, y: 380, r: 88 }, { x: 790, y: 380, r: 88 }],
  // العدّاءان: offset = المسافة خلف مركز السيارة (تتغير: مرة خلفها ومرة بجانبها)
  runners: [{ side: 0, y: 366, base: 230, amp: 210, w: .52, ph: .4 }, { side: 1, y: 350, base: 160, amp: 190, w: .37, ph: 2.6 }]
};
let carEl = null, endDust = [], endRunners = [];
const endBlack = document.createElement('div');
endBlack.style.cssText = 'position:absolute;inset:0;z-index:25;background:#000;opacity:0;pointer-events:none';
frame.appendChild(endBlack);
function startEnding() {
  G.phase = 'ending'; G.endT = 0; G.endHoldT = 0; G.endScene = true; G.endSwitched = false; G.endArrived = false; G.wheelT = 0;
  endBlack.style.opacity = '0';
  bgDiv.style.opacity = '0'; layer.style.opacity = '0';
}
function switchToEndingScene() {
  G.endSwitched = true;
  G.stage = ENDING.bgStage;
  IMG.bg = IMG.bgs[ENDING.bgStage]; bgCropH = 0;
  bgDiv.style.backgroundImage = 'url(' + BG_IMGS[ENDING.bgStage] + ')';
  fitWorld();
  enemies = []; items = []; bullets = []; bombs = []; mines = []; crates = []; barrels = []; hostages = []; explosions = []; lobs = []; shards = []; rocks = []; parts = []; floaters = []; ripples = []; endDust = [];
  me.hidden = true; allies.forEach(a => a.hidden = true);
  endRunners = ENDING.runners.map(r => Object.assign({ o: {} }, r));
  cam = 0;
  if (!carEl) {
    carEl = document.createElement('canvas'); carEl.width = 1000; carEl.height = 476;
    carEl.style.cssText = 'position:absolute;left:0;top:0;pointer-events:none';
  }
  layer.appendChild(carEl);
  bgDiv.style.opacity = '1'; layer.style.opacity = '1';
  banner('');
}
function endingCar() { const h = ENDING.carH, w = h * 1000 / 476; return { x: cam + VW * ENDING.carScreenX, y: ENDING.carY, w: w, h: h, k: h / 476 }; }
function stepEnding(dt) {
  G.endT += dt;
  if (!G.endSwitched) { if (G.endT >= ENDING.fade && bgReady(ENDING.bgStage)) switchToEndingScene(); return; }
  const T = G.endT - ENDING.fade;
  const arrived = G.endArrived;
  if (!arrived) G.wheelT += dt;
  // الكاميرا تتقدم بسلاسة (تسارع في البداية)
  cam = Math.min(WORLD - VW, ENDING.camSpeed * Math.max(0, T - .6 * (1 - Math.min(1, T / 1.2))));
  const C = endingCar();
  // غبار العجلات: سحابات تتخلف خلف السيارة
  const L = lakeW();
  const wet = x => L && x > L.x0 && x < L.x1;
  for (const wh of (arrived ? [] : ENDING.wheels)) {
    const wx = C.x - C.w / 2 + wh.x * C.k;
    if (wet(wx)) {   // داخل البحيرة: رذاذ وتموجات بدل الغبار
      if (Math.random() < .5) ripples.push({ x: wx, y: C.y, t: 0, life: 1, r: 34 });
      for (let i = 0; i < 3; i++) parts.push({ x: wx + rr(-10, 4), y: C.y, z: 2, vx: rr(-140, 30), vz: rr(90, 230), l: rr(.3, .6), c: i % 2 ? '#d8f6ff' : '#8fd8ea' });
      continue;
    }
    if (Math.random() < (LOWQ ? .35 : .8)) endDust.push({ x: C.x - C.w / 2 + (wh.x - 70) * C.k, y: C.y + rr(-3, 3), z: rr(0, 6), vx: ENDING.camSpeed * rr(.05, .35), vz: rr(8, 30), r: rr(5, 9), gr: rr(22, 40), l: rr(.9, 1.6), t: 0 });
  }
  // العدّاءان يغيّران سرعتهما: مرة خلف السيارة ومرة بجانبها
  for (const r of (arrived ? [] : endRunners)) {
    const off = r.base + r.amp * Math.sin(T * r.w + r.ph) + 25 * Math.sin(T * r.w * 3.1 + r.ph);
    r.x = C.x - off; r.y2 = r.y + Math.sin(T * 7 + r.ph) * 1.5;
    r.dustT = (r.dustT || 0) - dt;
    if (r.dustT <= 0 && wet(r.x)) { r.dustT = .16; ripples.push({ x: r.x, y: r.y, t: 0, life: .8, r: 20 }); for (let i = 0; i < 3; i++) parts.push({ x: r.x, y: r.y, z: 1, vx: rr(-70, 40), vz: rr(50, 120), l: rr(.2, .4), c: '#cdf3ff' }); }
    else if (r.dustT <= 0) { r.dustT = .14; endDust.push({ x: r.x - 8, y: r.y, z: 1, vx: ENDING.camSpeed * .3, vz: rr(6, 18), r: 3, gr: rr(10, 16), l: rr(.5, .8), t: 0 }); }
  }
  for (const d of endDust) { d.t += dt; d.x += d.vx * dt; d.z += d.vz * dt; d.vz *= .96; }
  endDust = endDust.filter(d => d.t < d.l);
  // عند وصول الكاميرا إلى نهاية الخلفية: السيارة والأبطال يتوقفون ويحتفلون (صور الفوز) 3 ثوانٍ،
  // ثم تظلم الشاشة تدريجياً حتى الأسود الداكن، ثم تظهر نافذة الفوز
  if (!arrived && cam >= WORLD - VW - .5) {
    G.endArrived = true; G.endHoldT = 0;
    const C2 = endingCar();
    endRunners.forEach((r, i) => {   // كل بطل يقف في مكان ظاهر بجانب السيارة
      r.x = Math.max(cam + 40 + i * 50, Math.min(r.x, C2.x - C2.w / 2 - 30 - i * 55)); r.y2 = r.y; r.vicT = 0;
    });
  }
  if (G.endArrived) {
    G.endHoldT += dt;
    endRunners.forEach(r => r.vicT += dt);
    const k = Math.max(0, Math.min(1, (G.endHoldT - ENDING.endHold) / ENDING.endBlack));
    endBlack.style.opacity = String(k * k * (3 - 2 * k));
    if (G.phase === 'ending' && k >= 1) { G.phase = 'play'; endRound(true); banner(''); G.overT = 1.5; }
  }
}
function renderEnding(g, t) {
  if (!G.endSwitched) return;
  const C = endingCar();
  // الغبار (تحت الشخصيات)
  for (const d of endDust) {
    const k = d.t / d.l, r = d.r + d.gr * k, x = d.x - cam, y = d.y - d.z;
    const grd = g.createRadialGradient(x, y, 1, x, y, r);
    grd.addColorStop(0, 'rgba(196,160,112,' + (.42 * (1 - k)) + ')'); grd.addColorStop(1, 'rgba(196,160,112,0)');
    g.fillStyle = grd; g.beginPath(); g.arc(x, y, r, 0, 6.3); g.fill();
  }
  shadow(g, C.x - cam, C.y + 1, C.w * .46, 9);
  // السيارة: ترتج قليلاً، وعجلاتها تدور فعلاً (ندوّر جزء العجلة من الصورة نفسها)
  const img = IMG.car;
  if (carEl && img.complete && img.naturalWidth) {
    const cx = carEl.getContext('2d');
    cx.clearRect(0, 0, 1000, 476);
    const bob = G.endArrived ? 0 : Math.sin(t * 17) * 1.2 + Math.sin(t * 5.3) * 1;   // ارتجاج الهيكل (يتوقف عند الوصول)
    cx.drawImage(img, 0, bob);
    const ang = G.wheelT * 9;   // دوران العجلات باتجاه الحركة (يمين) ويتوقف عند الوصول
    for (const wh of ENDING.wheels) {
      for (let j = 0; j < (G.endArrived ? 1 : 3); j++) {   // نسخ متتالية = ضبابية حركة
        cx.save(); cx.globalAlpha = j === 0 ? 1 : .35;
        cx.beginPath(); cx.arc(wh.x, wh.y, wh.r, 0, 6.283); cx.clip();
        cx.translate(wh.x, wh.y); cx.rotate(ang - j * .12); cx.drawImage(img, -wh.x, -wh.y);
        cx.restore();
      }
      if (G.endArrived) continue;
      // غبار يغطي أسفل العجلة
      const gg = cx.createRadialGradient(wh.x - 40, wh.y + 80, 4, wh.x - 40, wh.y + 80, 120);
      gg.addColorStop(0, 'rgba(200,165,118,.55)'); gg.addColorStop(1, 'rgba(200,165,118,0)');
      cx.fillStyle = gg; cx.fillRect(wh.x - 170, wh.y - 20, 260, 120);
    }
    carEl.style.width = (C.w * CS) + 'px'; carEl.style.height = (C.h * CS) + 'px';
    carEl.style.transform = 'translate(' + ((C.x - cam - C.w / 2) * CS) + 'px,' + ((C.y - C.h + 6) * CS) + 'px)';
    carEl.style.zIndex = Math.round(C.y);
  }
  // العدّاءان JACK و REX
  for (const r of endRunners) {
    const p = IMG.heroes[r.side];
    if (!p || !p.walk) continue;
    shadow(g, r.x - cam, r.y + 1, 22, 6);
    if (G.endArrived && p.victory) placeSprite(r.o, 'victory', p.victory, r.x, r.y2, 1, Math.round(r.y), true, el => heroSize(el, r.side, false));
    else placeSprite(r.o, 'run', p.walk, r.x, r.y2, 1, Math.round(r.y), true, el => heroSize(el, r.side, false));
  }
}
function stopEnding() {
  G.endScene = false; G.endSwitched = false; G.endArrived = false; endBlack.style.opacity = '0';
  if (carEl && carEl.parentNode) carEl.remove();
  endDust = []; endRunners = [];
}

function stepGame(dt) {
  if (G.phase === 'ending') {
    stepEnding(dt);
  } else if (G.phase === 'intro') {
    stepIntro(dt);
  } else if (G.phase === 'count') {
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
    updateLobs(dt);

    // حدث المرحلة كل مسافة معينة (قبل ساحة الزعيم)
    const S = curStage();
    if (S.event && me.x >= G.evX && me.x < WORLD - ARENA - 200) {
      const ev = [].concat(S.event);
      stageEvent(ev[G.evN % ev.length]);
      G.evX += S.evGap;
    }

    while (waveIdx < packPlan.length && prog(me) >= 200 + waveIdx * SEG_DIST) { spawnWave(packPlan[waveIdx], me); waveIdx++; }
    if (G.stage === 0) { stepStage0(dt); if (G.s0 && G.s0.door.hitT > 0) G.s0.door.hitT -= dt; }

    for (const it of items) it.t += dt;
    pickupItems(me);
    items = items.filter(i => !i.gone);

    if (!G.bossIntro && curStage().boss && me.x > WORLD - ARENA) { G.bossIntro = true; toast('BOSS FIGHT: ' + curStage().boss.name + '!', 2400); }

    if (me.lives <= 0 && me.dead) endRound(false);
    else if (curStage().window && G.bossDead && !me.dead) {
      // بعد قتل زعيم المرحلة 1: عندما يتوجه البطل إلى النافذة ويصل قربها يقفز منها
      if (me.x >= winW().launchX - 30 && me.st !== 'd') { stageClear(); G.winJ = true; G.transT = 0; }
    }
    else if (curStage().stoneDoor) {
      // بعد تفجير الباب: البطل يجري إلى داخله ثم الفوز
      if (G.doorBlown && !me.dead) { G.doorBlownT += dt; if (G.doorBlownT > .9) { G.phase = 'trans'; G.transT = 0; G.doorRun = true; G.stagesCleared++; } }
      // لا يعلق اللاعب: إذا ضاعت قنبلته يحصل على أخرى
      if (G.bossDead && !G.doorBlown && me.bombs < 1 && !bombs.some(b => b.owner === 'me')) {
        G.bombGiveT = (G.bombGiveT || 0) + dt;
        if (G.bombGiveT > 1.5) { G.bombGiveT = 0; me.bombs = 1; floatText(me.x, me.y - 95, '+1 BOMB', '#ffb347'); }
      }
    }
    else if (G.bossDead && !me.dead && me.x > WORLD - 120) {
      // لا فوز إلا بعد إكمال المراحل الأربع
      if (G.stage < STAGE_COUNT - 1) stageClear();
      else { G.stagesCleared = STAGE_COUNT; endRound(true); }
    }

  } else if (G.phase === 'trans') {
    stepTransition(dt);
  } else if (G.phase === 'over') {
    if (G.endScene) stepEnding(dt);
    G.overT += dt;
    if (G.overT > 1.5 && $('#result').hidden) showResult();
    if (me) me.inv = Math.max(0, me.inv - dt);
  }

  updateShards(dt);
  updateWater(dt);
  updateRocks(dt);
  for (const p of parts) { p.l -= dt; p.x += p.vx * dt; p.y += (p.vy || 0) * dt; p.z += p.vz * dt; p.vz -= 520 * dt; }
  parts = parts.filter(p => p.l > 0);
  if (LOWQ && parts.length > 90) parts.splice(0, parts.length - 90);   // وضع الجودة المنخفضة: جزيئات أقل
  for (const c of crates) if (c.broken && c.wreckT > 0) c.wreckT -= dt;
  for (const b of barrels) if (b.exploded && b.wreckT > 0) b.wreckT -= dt;
  for (const e of explosions) e.t += dt;
  explosions = explosions.filter(e => e.t < e.dur);
  for (const f of floaters) f.t += dt;
  floaters = floaters.filter(f => f.t < 1);
  shake = Math.max(0, shake - dt * 20);

  if (me && G.phase !== 'intro' && !G.endScene) {
    const tgt = me.x - VW * .38 + me.face * 20;
    cam += (tgt - cam) * Math.min(1, dt * 6);
    cam = clamp(cam, 0, Math.max(0, WORLD - VW));
  }
}

// إخفاء/إظهار الواجهة العلوية وأزرار التحكم (أثناء نزول الأبطال في بداية المرحلة 2)
function setUiHidden(h) {
  if (uiHidden === h) return;
  uiHidden = h;
  const v = h ? 'hidden' : '';
  ['#hud', '#timer', '#controls', '#pause', '#mute'].forEach(q => { const el = $(q); if (el) el.style.visibility = v; });
  stageLbl.style.visibility = v;
}
function updateHUD() {
  const f = me;
  if (!f) return;
  if (G.dropping && G.time >= G.dropUntil && f.z <= 0 && !allies.some(a => !a.dead && a.z > 0)) G.dropping = false;
  setUiHidden(!!G.dropping || !!G.endScene);

  const tEl = $('#timer');
  if (tEl) {
    tEl.hidden = !(G.phase === 'play' || G.phase === 'count' || G.phase === 'over' || G.phase === 'trans');
    const s = Math.ceil(G.timeLeft || 0);
    if (tEl.textContent !== String(s)) tEl.textContent = s;
    tEl.classList.toggle('low', s <= 10 && G.phase === 'play');
  }

  const sl = curStage().title + ' / ' + LAST_NUM;
  if (stageLbl.textContent !== sl) stageLbl.textContent = sl;

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
    if (f.mines > 0) html += '<div class="wslot"><img src="' + (IMG.item_mine.icon || IMG.item_mine.src) + '"><span class="am">M' + f.mines + '</span></div>';
    if (wEl.innerHTML !== html) wEl.innerHTML = html;
  }
}

// ==========================================
// INPUT HANDLING
// ==========================================
// الجري: الضغط مرتين بسرعة على زر الاتجاه (يمين أو يسار) ثم الإبقاء عليه
const RUN_SPEED = 300, RUN_TAP = .3;
let runDir = 0, lastTapDir = 0, lastTapT = -9;
function dirTap(d) {
  const now = performance.now() / 1000;
  if (d === lastTapDir && now - lastTapT < RUN_TAP) runDir = d;
  lastTapDir = d; lastTapT = now;
}
const KEYS = { ArrowLeft: 'l', a: 'l', A: 'l', ArrowRight: 'r', d: 'r', D: 'r', ArrowUp: 'u', w: 'u', W: 'u', ArrowDown: 'd', s: 'd', S: 'd' };
addEventListener('keydown', e => {
  if (e.target && e.target.tagName === 'INPUT') return;
  const k = KEYS[e.key];
  if (k) { if ((k === 'l' || k === 'r') && !inp[k]) dirTap(k === 'r' ? 1 : -1); inp[k] = true; e.preventDefault(); return; }
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
let padId = null, padDir = 0;
function padSet(e) {
  const r = pad.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  let dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2);
  const m = Math.hypot(dx, dy);
  if (m > 1) { dx /= m; dy /= m; }
  padX = Math.abs(dx) > .28 ? Math.sign(dx) * Math.min(1, Math.abs(dx) * 1.15) : 0;
  padY = Math.abs(dy) > .28 ? Math.sign(dy) * Math.min(1, Math.abs(dy) * 1.15) : 0;
  const nd = Math.abs(dx) > .45 ? Math.sign(dx) : 0;   // لمسة يمين/يسار على عصا التحكم
  if (nd !== padDir) { if (nd) dirTap(nd); padDir = nd; }
  knob.style.transform = 'translate(' + (dx * 70) + '%,' + (dy * 70) + '%)';
}
function padEnd(e) {
  if (e.pointerId === padId) { padId = null; padX = 0; padY = 0; padDir = 0; knob.style.transform = ''; }
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
  document.body.classList.toggle('phone', IS_TOUCH);
}
function resize() {
  checkTouch();
  const st = $('#stage'), r = st.getBoundingClientRect();
  const aw = Math.max(200, r.width), ah = Math.max(120, r.height);
  const ratio = Math.min(3, Math.max(1.35, aw / ah));   // يملأ الشاشة كلها بنسبتها الحقيقية
  VW = Math.round(H * ratio);
  const w = Math.min(aw, ah * ratio), h = w / ratio;
  frame.style.width = w + 'px'; frame.style.height = h + 'px'; frame.style.aspectRatio = 'auto';
  const dpr = Math.min(LOWQ ? 1 : (IS_TOUCH ? 1.5 : 2), window.devicePixelRatio || 1);   // الهواتف: دقة أقل = سرعة أعلى
  cv.width = Math.max(2, Math.round(w * dpr)); cv.height = Math.max(2, Math.round(h * dpr));
  SC = cv.width / VW;
  CS = w / VW;
}
addEventListener('resize', resize);
resize();

// الهاتف: اللعبة أفقية. عند أول لمسة نحاول ملء الشاشة وقفلها على الوضع الأفقي (يعمل على أندرويد)،
// وإذا كان الهاتف عمودياً تظهر رسالة "أدر الهاتف"
const rotHint = document.createElement('div');
rotHint.id = 'rotHint';
rotHint.innerHTML = '<div class="rot-ic"></div><b>ROTATE YOUR PHONE</b><span>أدر الهاتف للعب</span>';
document.body.appendChild(rotHint);
function lockLandscape() {
  if (!IS_TOUCH) return;
  const de = document.documentElement, o = screen.orientation;
  const lock = () => { if (o && o.lock) o.lock('landscape').catch(() => {}); };
  if (!userActive()) return;
  removeEventListener('pointerup', lockLandscape, true); removeEventListener('touchend', lockLandscape, true);
  if (!document.fullscreenElement && de.requestFullscreen) de.requestFullscreen({ navigationUI: 'hide' }).then(lock).catch(lock);
  else lock();
}
// ملء الشاشة مسموح فقط عند رفع الإصبع (وليس عند لمسه)
addEventListener('pointerup', lockLandscape, true);
addEventListener('touchend', lockLandscape, true);
addEventListener('orientationchange', () => setTimeout(resize, 250));

// زر CONTINUE يُضاف أول نافذة GAME OVER
const contBtn = document.createElement('button');
contBtn.className = 'btn'; contBtn.type = 'button'; contBtn.id = 'rCont'; contBtn.textContent = 'CONTINUE'; contBtn.hidden = true;
$('#rAgain').parentNode.insertBefore(contBtn, $('#rAgain'));
$('#rAgain').classList.add('alt');
contBtn.addEventListener('click', continueGame);
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
  if (muted) SND.warning.pause();
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
  const rawDt = (now - last) / 1000, dt = Math.min(.05, rawDt);
  last = now; G.t = (now - T0) / 1000;
  try {
    if (rawDt > 0 && rawDt < .5) watchFps(rawDt);
    if (!G.paused) stepGame(dt);
    render(G.t);
    applyZoom();
    if (G.phase !== 'menu') updateHUD();
    updateTimeWarning();
  } catch (err) { console.error(err); }
  requestAnimationFrame(loop);
}

// ننتظر تحميل الخلفية ليُضبط طول العالم قبل بدء اللعب
let tries = 0;
function boot() {
  if ((IMG.bgs[0].complete && IMG.bgs[0].naturalWidth) || tries++ > 80) {
    fitWorld();
    initGame();
    setTimeout(() => { loadOtherHeroes(); preloadRest(1); }, 400);
    last = performance.now();
    requestAnimationFrame(loop);
  } else setTimeout(boot, 50);
}
boot();

})();