(function(){
'use strict';
const $ = (s, r) => (r || document).querySelector(s);
const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));

const HEROES = [
  { id: 'player1h', name: 'JACK',  c: '#33d6c0' },
  { id: 'player2h', name: 'REX',  c: '#ffc233' },
  { id: 'player3h', name: 'MINA', c: '#ff6f4e' },
  { id: 'player4h', name: 'MAX', c: '#6aa9ff' }
];
// permanent = يُشترى مرة واحدة، وغير ذلك يُستهلك (يرجع منه ما لم يُستعمل)
const ITEMS = [
  { id: 'pistol',  tab: 'w', name: 'PISTOL',  desc: '24 rounds. Accurate sidearm. Yours for every run.', price: 150, icon: 'Pistol-gun.png',  perm: true },
  { id: 'smg',     tab: 'w', name: 'SMG',     desc: '60 rounds. Rapid fire spray. Yours for every run.', price: 400, icon: 'machine-gun.png', perm: true },
  { id: 'shotgun', tab: 'w', name: 'SHOTGUN', desc: '12 shells. Devastating at close range.',            price: 350, icon: 'Rifle-gun.png', perm: true },
  { id: 'armor',   tab: 's', name: 'VITAL VEST', desc: 'Take 20% less damage. Permanent.',               price: 250, icon: 'heart.png', perm: true },
  { id: 'ammo',    tab: 's', name: 'AMMO PACK',  desc: '+60% ammo for your guns at the start of a run.', price: 50,  icon: 'bullets-amo.png' },
  { id: 'bomb',    tab: 's', name: 'BOMB',       desc: 'One extra bomb for your run. Press BOMB / G.',   price: 40,  icon: 'bomb.png' },
  { id: 'mine',    tab: 's', name: 'LAND MINE',  desc: 'Place with MINE / E. Blows up under enemies.',   price: 60,  icon: 'Landmine.gif' },
  { id: 'shuriken', tab: 's', name: 'SHURIKEN',  desc: 'Ninja throwing star.',                           price: 80,  icon: 'knef.png' }
];

// ---------- الحفظ (رصيد 1000 عند أول تشغيل) ----------
const KEY = 'treasureRoadSave';
function load() {
  let d = {};
  try { d = JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) {}
  return { coins: typeof d.coins === 'number' ? d.coins : 1000, owned: d.owned || {}, inv: d.inv || {}, side: d.side | 0, diff: typeof d.diff === 'number' ? d.diff : 1 };
}
let S = load();
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
if (!(S.side >= 0 && S.side < HEROES.length)) S.side = 0;
save();

// ---------- البطل ----------
function showHero(swap) {
  const h = HEROES[S.side], img = $('#hImg');
  document.documentElement.style.setProperty('--c', h.c);
  img.src = 'images/' + h.id + '.gif';
  img.classList.remove('swap');
  if (swap) { void img.offsetWidth; img.classList.add('swap'); }
  $$('#cards .card').forEach(c => c.classList.toggle('sel', +c.dataset.side === S.side));
}
$$('#cards .card').forEach(c => c.addEventListener('click', () => {
  S.side = +c.dataset.side; save(); showHero(true);
}));
$$('#diffs .chip').forEach(c => {
  if (c.dataset.d === '3') { c.addEventListener('click', () => toast('EXPERT - COMING SOON')); return; }
  c.classList.toggle('on', +c.dataset.d === S.diff);
  c.addEventListener('click', () => { S.diff = +c.dataset.d; save(); $$('#diffs .chip').forEach(x => x.classList.toggle('on', x === c)); });
});

// ---------- العتاد (يظهر ما اشتريته) ----------
function renderLoadout() {
  const el = $('#loadout'); let h = '';
  ITEMS.forEach(it => {
    const n = it.perm ? (S.owned[it.id] ? '✓' : 0) : (S.inv[it.id] || 0);
    if (!n) return;
    h += '<div class="lo ' + (it.cls || '') + '"><img src="images/' + it.icon + '" alt=""><b>' + (it.perm ? '' : '×' + n) + '</b>' + (it.perm ? it.name : '') + '</div>';
  });
  el.innerHTML = h || '<div class="lo empty">Knife only. Visit the store!</div>';
}
function renderCoins(bump) {
  $('#coinN').textContent = S.coins; $('#stCoins').textContent = S.coins;
  if (bump) { const b = $('#coinPill'); b.classList.remove('bump'); void b.offsetWidth; b.classList.add('bump'); }
}

// ---------- المتجر ----------
function toast(t) {
  const el = $('#toast'); el.textContent = t; el.classList.add('on');
  clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove('on'), 1600);
}
// كم يملك اللاعب من هذا العنصر (للدائم: 0 أو 1)
function haveOf(it) { return it.perm ? (S.owned[it.id] ? 1 : 0) : (S.inv[it.id] || 0); }
function renderStore() {
  $('#items').innerHTML = ITEMS.map(it => {
    const have = haveOf(it);
    const owned = it.perm && have;
    const badge = owned ? '<span class="own">OWNED</span>' : (have ? '<span class="own">\u00d7' + have + '</span>' : '');
    const noBuy = owned || S.coins < it.price;
    return '<div class="item" title="' + it.desc + '">' + badge +
      '<div class="ic"><img class="' + (it.cls || '') + '" src="images/' + it.icon + '" alt=""></div>' +
      '<h3>' + it.name + '</h3><p>' + it.desc + '</p>' +
      '<div class="btnrow">' +
      '<button class="buy" type="button" data-id="' + it.id + '"' + (noBuy ? ' disabled' : '') + '>' +
      (owned ? 'OWNED' : '<i class="coin"></i>' + it.price) + '</button>' +
      '<button class="sell" type="button" data-id="' + it.id + '"' + (have ? '' : ' disabled') + '>SELL <i class="coin"></i>' + it.price + '</button>' +
      '</div></div>';
  }).join('');
}
function snd() { try { const a = new Audio('sounds/powerup_collect.mp3'); a.play().catch(() => {}); } catch (e) {} }
function buy(id) {
  const it = ITEMS.find(i => i.id === id);
  if (!it || (it.perm && S.owned[id])) return;
  if (S.coins < it.price) { toast('NOT ENOUGH COINS'); return; }
  S.coins -= it.price;
  if (it.perm) S.owned[id] = true; else S.inv[id] = (S.inv[id] || 0) + 1;
  save(); snd();
  toast(it.name + ' PURCHASED');
  renderStore(); renderLoadout(); renderCoins(true);
}
// بيع: يسترجع اللاعب كامل السعر
function sell(id) {
  const it = ITEMS.find(i => i.id === id);
  if (!it || !haveOf(it)) return;
  if (it.perm) delete S.owned[id]; else S.inv[id] = Math.max(0, (S.inv[id] || 0) - 1);
  S.coins += it.price;
  save(); snd();
  toast(it.name + ' SOLD +' + it.price);
  renderStore(); renderLoadout(); renderCoins(true);
}
$('#items').addEventListener('click', e => {
  const b = e.target.closest('.buy'), s = e.target.closest('.sell');
  if (b && !b.disabled) buy(b.dataset.id);
  else if (s && !s.disabled) sell(s.dataset.id);
});
function openStore() { renderStore(); $('#store').hidden = false; }
$('#shopBtn').addEventListener('click', openStore);
$('#coinBtn').addEventListener('click', openStore);
$('#stClose').addEventListener('click', () => { $('#store').hidden = true; });
$('#store').addEventListener('click', e => { if (e.target.id === 'store') $('#store').hidden = true; });
addEventListener('keydown', e => { if (e.key === 'Escape') $('#store').hidden = true; });

// ---------- اللعب ----------
$('#startBtn2').addEventListener('click', () => {
  try { localStorage.setItem('gameConfig', JSON.stringify({ side: S.side, diff: S.diff })); } catch (e) {}
  save();
  window.location.href = 'game.html';
});


// ---------- واجهة الهوم الجديدة ----------
function prevNext(d) { S.side = (S.side + d + HEROES.length) % HEROES.length; save(); showHero(true); }
$('#prevH').addEventListener('click', () => prevNext(-1));
$('#nextH').addEventListener('click', () => prevNext(1));
$('#gemBtn').addEventListener('click', () => toast('GEMS - COMING SOON'));
function openLoadout() { renderLoadout(); $('#loadoutModal').hidden = false; }
$('#loClose').addEventListener('click', () => { $('#loadoutModal').hidden = true; });
$('#loadoutModal').addEventListener('click', e => { if (e.target.id === 'loadoutModal') e.currentTarget.hidden = true; });
addEventListener('keydown', e => {
  if (e.key === 'Escape') $('#loadoutModal').hidden = true;
  else if (e.key === 'ArrowLeft' && $('#store').hidden && $('#loadoutModal').hidden) prevNext(-1);
  else if (e.key === 'ArrowRight' && $('#store').hidden && $('#loadoutModal').hidden) prevNext(1);
});
const ACT = {
  home: () => {},
  character: () => { const r = $('#cards'); r.classList.remove('pulse'); void r.offsetWidth; $$('#cards .card.sel').forEach(c => { c.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-1.2cqh)' }, { transform: 'translateY(0)' }], { duration: 500 }); }); },
  loadout: openLoadout,
  settings: () => toast('SETTINGS - COMING SOON'),
  achievements: () => toast('ACHIEVEMENTS - COMING SOON'),
  exit: () => { window.location.href = 'index.html'; },
  mail: () => toast('NO NEW MAIL'),
  friends: () => toast('FRIENDS - COMING SOON'),
  chat: () => toast('CHAT - COMING SOON')
};
$$('[data-act]').forEach(b => b.addEventListener('click', () => { const f = ACT[b.dataset.act]; if (f) f(); }));

showHero(false); renderLoadout(); renderCoins(false);
})();
