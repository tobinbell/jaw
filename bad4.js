const Speaker = require('speaker');
const Readable = require('stream').Readable;
const util = require('util');

// Create a range array.
Array.range = (length) => {
  let result = new Array(length);
  for (let i = 0; i < length; i += 1) {
    result[i] = i;
  }
  return result;
};

module.exports.makeAudioOutput = () => new Speaker({
  channels: 1,
  bitDepth: 32,
  sampleRate: 44100,
  signed: true,
  float: true,
});

let out = module.exports.makeAudioOutput()

const Pitch = (str) => {
  str = str.toLowerCase();

  let i = 0;

  // Read in the note name. Use C as the default if it cannot be read.
  let note = i < str.length ? str[i] : null;
  if (['a', 'b', 'c', 'd', 'e', 'f', 'g'].includes(note)) {
    i += 1;
  } else {
    note = 'c';
  }

  // Read in the accidental. Accidentals are optional so only advance the index
  // if we found a valid one.
  let accidental = i < str.length ? str[i] : null;
  if (accidental == '#' || accidental == 'b') {
    i += 1;
  } else {
    accidental = null;
  }

  // Read in the octave, and parse it if present. If it's missing, use a
  // default octave of 4.
  let octave = i < str.length ? parseInt(str[i]) : null;
  if (!octave) {
    octave = 4;
  }

  // Calculate the frequency based on A 440.
  const semitoneOffsets = {
    'b#': -9, 'c': -9,
    'c#': -8, 'db': -8,
    'd': -7,
    'd#': -6, 'eb': -6,
    'e': -5, 'fb': -5,
    'e#': -4, 'f': -4,
    'f#': -3, 'gb': -3,
    'g': -2,
    'g#': -1, 'ab': -1,
    'a': 0,
    'a#': 1, 'bb': 1,
    'b': 2, 'cb': 2
  }
  let noteName = note + (accidental || '');
  let frequency = 440 * Math.pow(2, semitoneOffsets[noteName] / 12);

  // Adjust the frequency for the octave.
  frequency = frequency * Math.pow(2, octave - 4);

  return {
    frequency: frequency
  };
};

const Audio = function (func) {
  Readable.call(this);
  this.buffer = Buffer.alloc(4);
  this.counter = 0;
  this.func = func;
};

util.inherits(Audio, Readable);

Audio.prototype._read = function () {
  this.buffer.writeFloatLE(this.func(this.counter / 44100), 0);
  this.push(this.buffer);
  this.counter += 1;
};

// Wave generators.
const sine = (freq) => (time) => {
  return Math.sin(freq * 2 * Math.PI * time);
};

const square = (freq) => (time) => {
  return (freq * time % 1) < 0.5 ? 1 : 0;
};

const triangle = (freq) => (time) => {
  let x = freq * time % 1;
  return x < 0.5 ? 4 * x - 1 : 4 * (0.5 - x) + 1;
};

const harmonic = (freq) => {
  let components =
    Array.range(10)
      .map(i => i + 1)
      .map(i => freq * i)
      .map(f => sine(f));
  return (time) =>
    components.reduce(
      (result, component, i) => result + component(time) / (i + 1),
    0);
};

const add = (...signals) => (t) => {
  return signals.map(signal => signal(t)).reduce((a, b) => a + b, 0);
};

const sub = (base, ...signals) => (t) => {
  return signals.map(signal => signal(t)).reduce((a, b) => a - b, base(t));
};

const mul = (sig, fac) => (t) => {
  return sig(t) * fac;
};

let chordSources = [
  ['Ab', 'C', 'Eb'],
  ['F', 'Ab', 'C'],
  ['C', 'Eb', 'G'],
  ['Bb', 'D', 'F'],
  ['G', 'Bb', 'D'],
  ['Ab', 'C', 'Eb'],
  ['C', 'Eb', 'G'],
  ['Eb', 'G', 'Bb'],
  ['Ab', 'C', 'Eb'],
  ['G', 'Bb', 'D'],
  ['F', 'Ab', 'C'],
  ['C', 'Eb', 'G'],
  ['Bb', 'D', 'F'],
  ['Ab', 'C', 'Eb'],
  ['Bb', 'D', 'F'],
  ['Eb', 'G', 'Bb'],
];

let chordWaves = chordSources.map((sources) => {
  let pitches = sources.map(Pitch);
  let frequencies = pitches.map(p => p.frequency);
  let waves = frequencies.map(square);
  return t => waves.reduce((sum, wave) => sum + wave(t), 0);
});

let harms = [];
for (let i = 0; i < 20; i += 1) {
  harms.push(harmonic(220 * (i + 1)));
}

let summies = [
  // harmonic(220),
  harmonic(275),
  harmonic(330),
  harmonic(440),
  // harmonic(550)
];

const perfectFifth = (f) => f * 3 / 2;
const perfectFourth = (f) => f * 4 / 3;
const majorThird = (f) => f * 5 / 4;
const minorThird = (f) => f * 6 / 5;
const weird = (f) => f * 7 / 6;
const majorSecond = (f) => f * 9 / 8;
const minorSecond = (f) => f * 17 / 16;
const oct = (f) => f * 2;

const cents = (c) => (
  (f) => f * Math.pow(2, c / 1200)
);

const rat = (r) => (
  (f) => f * r
);

const stack = (start, ...intervals) => {
  const res = [start];
  intervals.forEach(i => {
    start = i(start);
    res.push(start);
  });
  return res;
}

const jm3 = rat(6 / 5);
const j3 = rat(5 / 4);
const j4 = rat(4 / 3);
const j5 = rat(3 / 2);
const j6 = rat(5 / 3);
const js7 = rat(7 / 6 * 3 / 2);

const octave = cents(1200);
const semitone = cents(100);
const et2 = cents(200);
const etm3 = cents(300);
const et3 = cents(400);
const et4 = cents(500);
const et5 = cents(700);
const et6 = cents(900);
const etm7 = cents(1000);
const et7 = cents(1100);

const majorTriad = (f) => (
  stack(f, j3, jm3)
);

const minorTriad = (f) => (
  stack(f, jm3, j3)
);

const invert = (chord) => {
  let inverted = chord.slice(1);
  inverted.push(chord[0] * 2);
  return inverted;
}

let fsm = [220, 220*Math.sqrt(2), 220*2.84424143, 220*Math.PI].map(sine);
// fsm = [220, 440].map(sine)
fsm = mul(add(...fsm), 0.2);

// let thing = add(sine(440), sine(perfectFifth(440)));
let thing = add(
  sine(27.5),
  // triangle(80),
  // triangle(200),
  // sine(et3(220)),
);

let audio = new Audio(fsm);
audio.pipe(out);

// let tuning = equalTemperament(440);
// let a = sine(tuning("Ab"));
// let b = sine(tuning("Bb"));

// let result = mix(a, b)

// new Audio
