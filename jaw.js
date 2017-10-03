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

const out = new Speaker({
  channels: 1,
  bitDepth: 32,
  sampleRate: 44100,
  signed: true,
  float: true
});

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

const triange = (freq) => (time) => {
  let x = freq * time % 1;
  return x < 0.5 ? 4 * x - 1 : 4 * (0.5 - x) + 1;
};

const harmonic = (freq) => {
  let components =
    Array.range(5)
      .map(i => i + 1)
      .map(i => freq * i)
      .map(f => sine(f));
  return (time) =>
    components.reduce(
      (result, component, i) => result + component(time) / (i + 1),
    0);
};

const mix = (a, b) => (time) => {
  return a(time) + b(time);
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

let audio = new Audio(function (time) {
  let one = sine(440);
  let two = sine(441);
  // return (time % 2 < 1) ? one(time) : two(time);
  return one(time) + two(time);
  // return m(time);
});
audio.pipe(out);
