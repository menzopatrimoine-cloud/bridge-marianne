/* Bridge — sons du jeu fabriqués par le navigateur (aucun fichier audio, marche hors ligne)
   et annonces vocales des enchères (voix française de l'iPad). */
var B = globalThis.B = globalThis.B || {};
B.sound = (function () {
'use strict';
let ctx = null, master = null, comp = null, noise = null, unlocked = false, voiceUnlocked = false;
let enabled = true, volume = 0.7, voice = false, musicLevel = 0, music = null;
const VOL = { faible: 0.35, moyen: 0.7, fort: 1 };
const MUSIC_VOL = { non: 0, douce: 0.5, moyenne: 0.85, forte: 1.3 };

function init() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = volume;
  // compresseur léger : aucun son ne doit surprendre par sa force
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp); comp.connect(ctx.destination);
  noise = makeNoise(ctx);
  return true;
}
function makeNoise(c) {
  const b = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return b;
}
// L'iPad n'autorise le son qu'après un toucher : on « déverrouille » au premier toucher
function unlock() {
  if ((enabled || musicLevel) && init()) {
    if (ctx.state !== 'running') ctx.resume();
    if (!unlocked) {
      const s = ctx.createBufferSource();
      s.buffer = ctx.createBuffer(1, 1, 22050);
      s.connect(ctx.destination); s.start(0);
      unlocked = true;
    }
    if (musicLevel) startMusic();
  }
  if (voice && !voiceUnlocked && 'speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(' ');
    u.volume = 0;
    speechSynthesis.speak(u);
    voiceUnlocked = true;
  }
}
function env(g, t, peak, a, d) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
}
function tone(freq, t, dur, o) {
  o = o || {};
  const osc = ctx.createOscillator(), g = ctx.createGain();
  osc.type = o.type || 'sine';
  osc.frequency.setValueAtTime(freq, t);
  if (o.glide) osc.frequency.exponentialRampToValueAtTime(o.glide, t + dur);
  env(g, t, o.gain || 0.2, o.attack || 0.005, dur);
  osc.connect(g); g.connect(master);
  osc.start(t); osc.stop(t + dur + 0.05);
}
// bruit filtré : le « clac » d'une carte, le froissement du paquet
function burst(t, dur, o) {
  const s = ctx.createBufferSource();
  s.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = o.type || 'bandpass';
  f.frequency.setValueAtTime(o.freq || 2500, t);
  if (o.sweep) f.frequency.exponentialRampToValueAtTime(o.sweep, t + dur);
  f.Q.value = o.q || 0.9;
  const g = ctx.createGain();
  env(g, t, o.gain || 0.3, o.attack || 0.002, dur);
  s.connect(f); f.connect(g); g.connect(master);
  s.start(t, Math.random() * 0.5, dur + 0.05);
}
const SOUNDS = {
  card(t) { burst(t, 0.07, { freq: 2300, q: 0.7, gain: 0.5 }); tone(150, t, 0.06, { gain: 0.2, glide: 90 }); },
  select(t) { tone(1300, t, 0.035, { gain: 0.07 }); },
  bid(t) { tone(1050, t, 0.06, { gain: 0.15, type: 'triangle' }); burst(t, 0.03, { freq: 3500, q: 1.2, gain: 0.12 }); },
  turn(t) {
    tone(784, t, 0.5, { gain: 0.16 }); tone(1568, t, 0.3, { gain: 0.04 });
    tone(1047, t + 0.14, 0.75, { gain: 0.16 }); tone(2093, t + 0.14, 0.4, { gain: 0.035 });
  },
  win(t) {
    burst(t, 0.2, { type: 'lowpass', freq: 2000, sweep: 400, gain: 0.16 });
    [659, 880, 1319].forEach((f, i) => tone(f, t + 0.05 + i * 0.07, 0.35, { gain: 0.12, type: 'triangle' }));
  },
  lose(t) { burst(t, 0.22, { type: 'lowpass', freq: 1600, sweep: 300, gain: 0.16 }); tone(330, t + 0.03, 0.22, { gain: 0.07, type: 'triangle' }); },
  shuffle(t) { for (let i = 0; i < 18; i++) burst(t + i * 0.034 + Math.random() * 0.012, 0.03, { freq: 1800 + Math.random() * 1500, q: 0.8, gain: 0.15 + Math.random() * 0.08 }); },
  dummy(t) { for (let i = 0; i < 5; i++) burst(t + i * 0.05, 0.05, { freq: 2000 + i * 150, q: 0.7, gain: 0.18 }); },
  success(t) {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.11, i === 3 ? 0.9 : 0.4, { gain: 0.15, type: 'triangle' }));
    tone(1568, t + 0.33, 0.8, { gain: 0.035 });
  },
  fail(t) { [392, 330, 262].forEach((f, i) => tone(f, t + i * 0.16, 0.45, { gain: 0.12, type: 'triangle' })); },
  error(t) { tone(220, t, 0.09, { gain: 0.13, type: 'triangle' }); tone(196, t + 0.11, 0.12, { gain: 0.13, type: 'triangle' }); },
};
function play(name) {
  if (!enabled || !ctx || ctx.state !== 'running' || document.hidden || !SOUNDS[name]) return;
  try {
    SOUNDS[name](ctx.currentTime + 0.01);
    if (name === 'success' || name === 'fail') duck();
  } catch (e) { /* son indisponible */ }
}

/* ---------- Musique d'ambiance : un petit orchestre de casino de la Côte d'Azur, composé note à note ----------
   Piano électrique, contrebasse, vibraphone et balais sur un rythme de bossa, 96 à la noire.
   Les mesures sont fabriquées au fur et à mesure : aucun fichier audio, ça marche hors ligne. */
const BAR = 60 / 96 * 4, E8 = BAR / 8, LOOP = 48;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
// [note de basse, notes du piano]
const F = [41, [57, 60, 64, 67]], Dm = [38, [53, 57, 60, 64]], Gm = [43, [58, 62, 65, 69]], C13 = [36, [52, 58, 62, 69]], Am = [45, [55, 60, 64, 69]],
  D7 = [38, [54, 60, 63, 69]], Bb = [46, [57, 62, 65, 70]], Eb = [39, [55, 61, 65, 70]], Csus = [36, [53, 58, 62, 67]];
const GRILLE = [F, Dm, Gm, C13, Am, D7, Gm, C13, Bb, Eb, Am, D7, Gm, C13, F, Csus];
// le thème, mesure par mesure : [position en croches, note, durée en croches]
const THEME = [
  [[2, 72, 2], [4, 76, 2], [6, 79, 3]], [[1, 77, 2], [3, 76, 1], [4, 74, 4]], [[2, 70, 2], [4, 74, 2], [6, 77, 3]], [[1, 76, 2], [3, 74, 1], [4, 72, 4]],
  [[2, 69, 2], [4, 72, 2], [6, 76, 3]], [[1, 75, 2], [3, 74, 1], [4, 72, 2], [6, 69, 2]], [[0, 70, 3], [3, 69, 1], [4, 67, 4]], [[4, 69, 2], [6, 70, 2]],
  [[0, 74, 3], [3, 77, 1], [4, 81, 4]], [[1, 79, 2], [3, 77, 1], [4, 73, 4]], [[2, 72, 2], [4, 76, 2], [6, 79, 2]], [[0, 78, 3], [3, 75, 1], [4, 72, 4]],
  [[2, 74, 2], [4, 70, 2], [6, 74, 2]], [[1, 76, 3], [4, 74, 2], [6, 70, 2]], [[2, 72, 2], [4, 76, 4]], [[6, 67, 2]],
];
const COMP = [[0, 3, 6], [2, 5]];                 // accords sur le rythme de la bossa (2 mesures)
const CLAVE = [[0, 3, 6], [2, 5]];
function musicBus(c, dest, level) {
  const out = c.createGain(); out.gain.value = level; out.connect(dest);
  const dry = c.createGain(); dry.gain.value = 1;
  const soft = c.createBiquadFilter(); soft.type = 'lowpass'; soft.frequency.value = 5200;   // son feutré
  dry.connect(soft); soft.connect(out);
  // la salle : une réverbération courte et discrète
  const len = Math.floor(c.sampleRate * 1.3), ir = c.createBuffer(2, len, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
  const room = c.createConvolver(); room.buffer = ir;
  const send = c.createGain(); send.gain.value = 0.16;
  dry.connect(send); send.connect(room); room.connect(soft);
  // le vibrato du vibraphone
  const trem = c.createGain(); trem.gain.value = 0.85; trem.connect(dry);
  const lfo = c.createOscillator(), depth = c.createGain(); lfo.frequency.value = 4.8; depth.gain.value = 0.15;
  lfo.connect(depth); depth.connect(trem.gain); lfo.start();
  return { out, dry, trem, lfo };
}
function voice2(c, dest, f, t, dur, vel, kind) {
  const g = c.createGain(), o = c.createOscillator();
  o.type = kind === 'bass' ? 'triangle' : 'sine';
  o.frequency.value = f;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + (kind === 'bass' ? 0.018 : 0.012));
  g.gain.exponentialRampToValueAtTime(vel * 0.45, t + dur * 0.55);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest);
  o.start(t); o.stop(t + dur + 0.02);
  // l'attaque : la « lame » du piano électrique ou du vibraphone
  if (kind !== 'bass') {
    const o2 = c.createOscillator(), g2 = c.createGain();
    o2.frequency.value = f * (kind === 'vib' ? 4 : 2.003);
    g2.gain.setValueAtTime(vel * (kind === 'vib' ? 0.2 : 0.28), t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
    o2.connect(g2); g2.connect(dest);
    o2.start(t); o2.stop(t + 0.3);
  }
}
function hat(c, dest, buf, t, vel, freq, dur) {
  const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = buf; f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = 0.8;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vel, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(f); f.connect(g); g.connect(dest);
  s.start(t, (t * 7.13) % 0.8, dur + 0.02);
}
// une mesure : n va de 0 à LOOP-1 (3 passages : thème, accompagnement seul, thème plus grave puis aigu)
function musicBar(c, b, buf, t, n) {
  const k = n % 16, pass = Math.floor(n / 16) % 3, [root, chord] = GRILLE[k], two = n % 2;
  // piano électrique
  COMP[two].forEach(p => chord.forEach((m, i) => voice2(c, b.dry, mtof(m), t + p * E8 + i * 0.008, 1.05, 0.035 - (p ? 0.006 : 0), 'ep')));
  // contrebasse : fondamentale et quinte
  const fifth = root + 7 > 48 ? root - 5 : root + 7;
  [[0, root, 3.2], [3, root, 0.9], [4, fifth, 3.2], [7, fifth, 0.9]].forEach(([p, m, d], i) => voice2(c, b.dry, mtof(m), t + p * E8, d * E8 * 1.1, i % 2 ? 0.1 : 0.19, 'bass'));
  // balais et petit bois
  for (let e = 0; e < 8; e++) hat(c, b.dry, buf, t + e * E8, e % 2 ? 0.03 : 0.018, 7200, 0.07);
  CLAVE[two].forEach(p => hat(c, b.dry, buf, t + p * E8, 0.05, 1800, 0.04));
  // le thème au vibraphone
  const notes = pass === 1 ? (k >= 8 && k < 12 ? THEME[k] : []) : THEME[k];
  const shift = pass === 2 && k < 8 ? -12 : 0;
  notes.forEach(([p, m, d]) => voice2(c, b.trem, mtof(m + shift), t + p * E8, Math.max(0.9, d * E8 * 1.8), 0.075, 'vib'));
}
function musicTick() {
  if (!music || ctx.state !== 'running') return;
  const now = ctx.currentTime;
  if (music.next < now) music.next = now + 0.08;
  while (music.next < now + 1.2) {
    try { musicBar(ctx, music.b, noise, music.next, music.n); } catch (e) { /* mesure perdue */ }
    music.next += BAR;
    music.n = (music.n + 1) % LOOP;
  }
}
function startMusic() {
  if (music || !musicLevel || !ctx) return;
  const b = musicBus(ctx, comp, 0.0001);
  b.out.gain.setValueAtTime(0.0001, ctx.currentTime);
  b.out.gain.exponentialRampToValueAtTime(musicLevel, ctx.currentTime + 2.5);   // la musique arrive doucement
  music = { b, next: ctx.currentTime + 0.15, n: 0, timer: setInterval(musicTick, 250) };
  musicTick();
}
function stopMusic() {
  if (!music) return;
  const m = music, g = m.b.out.gain, now = ctx.currentTime;
  music = null;
  clearInterval(m.timer);
  g.cancelScheduledValues(now);
  g.setValueAtTime(Math.max(g.value, 0.0001), now);
  g.exponentialRampToValueAtTime(0.0001, now + 0.5);
  setTimeout(() => { try { m.b.lfo.stop(); m.b.out.disconnect(); } catch (e) { /* déjà arrêté */ } }, 3500);
}
function setMusicLevel() {
  if (!music) return;
  const g = music.b.out.gain, now = ctx.currentTime;
  g.cancelScheduledValues(now);
  g.setValueAtTime(Math.max(g.value, 0.0001), now);
  g.exponentialRampToValueAtTime(musicLevel, now + 0.3);
}
// la petite musique de fin de donne passe devant
function duck() {
  if (!music) return;
  const g = music.b.out.gain, now = ctx.currentTime;
  g.cancelScheduledValues(now);
  g.setValueAtTime(Math.max(g.value, 0.0001), now);
  g.exponentialRampToValueAtTime(musicLevel * 0.3, now + 0.15);
  g.setValueAtTime(musicLevel * 0.3, now + 2);
  g.exponentialRampToValueAtTime(musicLevel, now + 3.5);
}
// appli en arrière-plan : tout se met en pause, et reprend au retour
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => {
  if (!ctx || !unlocked) return;
  try { (document.hidden ? ctx.suspend() : ctx.resume()).catch(() => {}); } catch (e) { /* navigateur ancien */ }
});
function speak(text) {
  if (!voice || !('speechSynthesis' in window) || document.hidden) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'fr-FR'; u.rate = 0.95; u.volume = Math.min(1, volume + 0.25);
  const vs = speechSynthesis.getVoices();
  const v = vs.find(x => /^fr[-_]FR/i.test(x.lang)) || vs.find(x => /^fr/i.test(x.lang));
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}
function configure(s) {
  enabled = s.sound !== false;
  volume = VOL[s.volume] || 0.7;
  voice = !!s.voice;
  musicLevel = MUSIC_VOL[s.music] || 0;
  if (ctx) { if (!musicLevel) stopMusic(); else setMusicLevel(); }
  if (master) master.gain.value = volume;
  if (!voice && 'speechSynthesis' in window) speechSynthesis.cancel();
}
// une enchère dite à voix haute : « deux cœurs », « un sans-atout », « passe »
const LV = ['', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept'];
const DN = { C: ['trèfle', 'trèfles'], D: ['carreau', 'carreaux'], H: ['cœur', 'cœurs'], S: ['pique', 'piques'], N: ['sans-atout', 'sans-atout'] };
function callWords(c) {
  if (c === 'P') return 'passe';
  if (c === 'X') return 'contre';
  if (c === 'XX') return 'surcontre';
  const l = +c[0];
  return LV[l] + ' ' + DN[c[1]][l > 1 ? 1 : 0];
}
return { unlock, play, speak, configure, callWords, musicTest: { BAR, LOOP, musicBus, musicBar, makeNoise, MUSIC_VOL, playing: () => !!music } };
})();
