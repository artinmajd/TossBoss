// Web Audio API sound manager.
// iOS-safe: AudioContext is created synchronously inside unlock() (a user
// gesture handler). preload() only fetches raw bytes — no context needed.
// Decoding happens after the gesture, so iOS never sees a pre-gesture context.

const MUTE_KEY    = 'tossboss_muted';
const BG_MUTE_KEY = 'tossboss_bg_muted';
const BG_FADE_MS  = 800;

function createAudioManager() {
    let ctx      = null;
    let unlocked = false;

    const rawBuffers = {}; // name → ArrayBuffer (fetched, not decoded)
    const buffers    = {}; // name → AudioBuffer  (decoded, ready to play)

    let muted   = localStorage.getItem(MUTE_KEY)    === 'true';
    let bgMuted = localStorage.getItem(BG_MUTE_KEY) === 'true';

    let bgSource       = null;
    let bgGain         = null;
    let bgName         = null;
    let bgVolume       = 0.3;
    let bgTargetVolume = 0.3;

    // Decode all fetched raw buffers. Safe to call multiple times — skips
    // anything already decoded. Returns a Promise that resolves when done.
    function decodeAll() {
        if (!ctx) return Promise.resolve();
        return Promise.all(
            Object.entries(rawBuffers).map(([name, ab]) => {
                if (buffers[name]) return Promise.resolve();
                return ctx.decodeAudioData(ab.slice(0))
                    .then(decoded => { buffers[name] = decoded; })
                    .catch(e => console.warn('[audio] decode failed:', name, e.message));
            })
        );
    }

    function tryStartBg() {
        if (bgName && !bgSource) {
            const pending = bgName;
            bgName = null;
            playBg(pending, { volume: bgVolume });
        }
    }

    // Call synchronously from a user-gesture handler. Creates the AudioContext
    // and calls resume() in-gesture (required by iOS). Decoding is async after.
    function unlock() {
        if (unlocked) return;
        unlocked = true;
        // Synchronous: both of these must happen within the gesture call stack.
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        ctx.resume();
        // Async: decode then start any pending bg track.
        decodeAll().then(tryStartBg);
    }

    // Fetch all files (no gesture needed — pure HTTP). Decode after unlock().
    async function preload(map) {
        await Promise.all(Object.entries(map).map(async ([name, url]) => {
            try {
                const resp = await fetch(url);
                rawBuffers[name] = await resp.arrayBuffer();
            } catch (e) {
                console.warn('[audio] fetch failed:', name, e.message);
            }
        }));
        // If the user already tapped before preload finished, decode now.
        if (unlocked && ctx) {
            decodeAll().then(tryStartBg);
        }
    }

    function play(name, { volume = 1, rate = 1 } = {}) {
        if (muted || !ctx) return;
        const buf = buffers[name];
        if (!buf) return;
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = rate;
        if (volume !== 1) {
            const gain = ctx.createGain();
            gain.gain.value = volume;
            src.connect(gain);
            gain.connect(ctx.destination);
        } else {
            src.connect(ctx.destination);
        }
        src.start(0);
    }

    function playOneOf(names, opts) {
        play(names[Math.floor(Math.random() * names.length)], opts);
    }

    function playBg(name, { volume = 0.3 } = {}) {
        bgVolume = volume;
        if (bgName === name && bgSource) return;
        const fadeS = BG_FADE_MS / 1000;

        if (bgGain && bgSource && ctx) {
            const oldGain = bgGain, oldSrc = bgSource;
            oldGain.gain.setTargetAtTime(0, ctx.currentTime, fadeS / 3);
            setTimeout(() => {
                try { oldSrc.stop(); } catch (_) {}
                oldGain.disconnect();
            }, BG_FADE_MS);
        }

        bgName         = name;
        bgTargetVolume = volume;
        const buf = buffers[name];
        if (!buf || !ctx) { bgSource = null; bgGain = null; return; }

        const src  = ctx.createBufferSource();
        src.buffer = buf;
        src.loop   = true;

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, ctx.currentTime);
        if (!bgMuted) gain.gain.setTargetAtTime(volume, ctx.currentTime, fadeS / 3);

        src.connect(gain);
        gain.connect(ctx.destination);
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
