// Web Audio API sound manager.
// Usage: import audio from './audio.js';
//   audio.unlock()            — call once on first user gesture
//   audio.preload(map)        — { name: 'path/to/file.mp3', ... }
//   audio.play(name)          — fire a one-shot sound
//   audio.playBg(name, opts)  — start/switch looping background track
//   audio.stopBg()            — fade out and stop background track
//   audio.setMuted(bool)      — persisted to localStorage
//
// iOS-safe design: the AudioContext is created ONLY inside unlock(), which
// must be called from a user gesture. preload() only fetches raw bytes —
// decoding happens after unlock() so iOS never sees a pre-gesture context.

const MUTE_KEY    = 'tossboss_muted';
const BG_MUTE_KEY = 'tossboss_bg_muted';
const BG_FADE_MS  = 800;

function createAudioManager() {
    let ctx     = null;
    let unlocked = false;

    // Raw bytes fetched during preload, keyed by name.
    const rawBuffers = {};
    // Decoded AudioBuffers, populated after unlock().
    const buffers = {};

    let muted   = localStorage.getItem(MUTE_KEY)    === 'true';
    let bgMuted = localStorage.getItem(BG_MUTE_KEY) === 'true';

    // Background music state
    let bgSource      = null;
    let bgGain        = null;
    let bgName        = null;
    let bgVolume      = 0.3;
    let bgTargetVolume = 0.3;

    function getCtx() {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        return ctx;
    }

    // Decode all fetched raw buffers using the (now live) AudioContext.
    async function decodeAll() {
        const c = getCtx();
        await Promise.all(Object.entries(rawBuffers).map(async ([name, ab]) => {
            if (buffers[name]) return;
            try {
                // slice() because decodeAudioData transfers/consumes the buffer
                buffers[name] = await c.decodeAudioData(ab.slice(0));
            } catch (e) {
                console.warn('[audio] failed to decode', name, e);
            }
        }));
    }

    // Must be called from a user gesture (touchstart / click / pointerdown).
    // Creates the AudioContext, decodes all pre-fetched buffers, then starts
    // any pending background track.
    async function unlock() {
        if (unlocked) return;
        unlocked = true;
        const c = getCtx();
        if (c.state === 'suspended') await c.resume();
        await decodeAll();
        if (bgName && !bgSource) {
            const pending = bgName;
            bgName = null;
            playBg(pending, { volume: bgVolume });
        }
    }

    // Fetch all files immediately (no gesture needed — just HTTP).
    // Decoding is deferred to unlock() so iOS never sees a pre-gesture context.
    async function preload(map) {
        await Promise.all(Object.entries(map).map(async ([name, url]) => {
            try {
                const resp = await fetch(url);
                rawBuffers[name] = await resp.arrayBuffer();
            } catch (e) {
                console.warn('[audio] failed to fetch', name, e);
            }
        }));
        // If the user already tapped before preload finished, decode now and
        // start any pending background track.
        if (unlocked) {
            await decodeAll();
            if (bgName && !bgSource) {
                const pending = bgName;
                bgName = null;
                playBg(pending, { volume: bgVolume });
            }
        }
    }

    function play(name, { volume = 1, rate = 1 } = {}) {
        if (muted) return;
        const buf = buffers[name];
        if (!buf) return;
        const c = getCtx();
        const src = c.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = rate;
        if (volume !== 1) {
            const gain = c.createGain();
            gain.gain.value = volume;
            src.connect(gain);
            gain.connect(c.destination);
        } else {
            src.connect(c.destination);
        }
        src.start(0);
    }

    function playOneOf(names, opts) {
        play(names[Math.floor(Math.random() * names.length)], opts);
    }

    function playBg(name, { volume = 0.3 } = {}) {
        bgVolume = volume;
        if (bgName === name) return;
        const fadeS = BG_FADE_MS / 1000;

        // Fade out current track.
        if (bgGain && bgSource) {
            const oldGain = bgGain;
            const oldSrc  = bgSource;
            if (ctx) oldGain.gain.setTargetAtTime(0, ctx.currentTime, fadeS / 3);
            setTimeout(() => {
                try { oldSrc.stop(); } catch (_) {}
                oldGain.disconnect();
            }, BG_FADE_MS);
        }

        bgName = name;
        bgTargetVolume = volume;
        const buf = buffers[name];
        if (!buf) { bgSource = null; bgGain = null; return; }

        const c   = getCtx();
        const src = c.createBufferSource();
        src.buffer = buf;
        src.loop   = true;

        const gain = c.createGain();
        gain.gain.setValueAtTime(0, c.currentTime);
        if (!bgMuted) gain.gain.setTargetAtTime(volume, c.currentTime, fadeS / 3);

        src.connect(gain);
        gain.connect(c.destination);
        src.start(0);

        bgSource = src;
        bgGain   = gain;
    }

    function stopBg() {
        if (!bgSource || !ctx) return;
        const fadeS = BG_FADE_MS / 1000;
        const oldGain = bgGain, oldSrc = bgSource;
        bgSource = null; bgGain = null; bgName = null;
        oldGain.gain.setTargetAtTime(0, ctx.currentTime, fadeS / 3);
        setTimeout(() => {
            try { oldSrc.stop(); } catch (_) {}
            oldGain.disconnect();
        }, BG_FADE_MS);
    }

    function setMuted(val) {
        muted = val;
        localStorage.setItem(MUTE_KEY, val);
    }

    function isMuted() { return muted; }

    function setBgMuted(val) {
        bgMuted = val;
        localStorage.setItem(BG_MUTE_KEY, val);
        if (!bgGain || !ctx) return;
        bgGain.gain.setTargetAtTime(
            val ? 0 : bgTargetVolume,
            ctx.currentTime, 0.1
        );
    }

    function isBgMuted() { return bgMuted; }

    return { unlock, preload, play, playOneOf, playBg, stopBg, setMuted, isMuted, setBgMuted, isBgMuted };
}

const audio = createAudioManager();
export default audio;
