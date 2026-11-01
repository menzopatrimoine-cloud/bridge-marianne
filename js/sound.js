/* Bridge — sons du jeu fabriqués par le navigateur (aucun fichier audio, marche hors ligne)
   et annonces vocales des enchères (voix française de l'iPad). */
var B = globalThis.B = globalThis.B || {};
B.sound = (function () {
'use strict';
let ctx = null, master = null, noise = null, unlocked = false, voiceUnlocked = false;
let enabled = true, volume = 0.7, voice = false;
const VOL = { faible: 0.35, moyen: 0.7, fort: 1 };

function init() {
  if (ctx) return true;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return false;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = volume;
  // compresseur léger : aucun son ne doit surprendre par sa force
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14; comp.ratio.value = 4;
  master.connect(comp); comp.connect(ctx.destination);
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const d = noise.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return true;
}
// L'iPad n'autorise le son qu'après un toucher : on « déverrouille » au premier toucher
function unlock() {
  if (enabled && init()) {
    if (ctx.state !== 'running') ctx.resume();
    if (!unlocked) {
      const s = ctx.createBufferSource();
      s.buffer = ctx.createBuffer(1, 1, 22050);
      s.connect(ctx.destination); s.start(0);
      unlocked = true;
    }
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
  try { SOUNDS[name](ctx.currentTime + 0.01); } catch (e) { /* son indisponible */ }
}
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
return { unlock, play, speak, configure, callWords };
})();
