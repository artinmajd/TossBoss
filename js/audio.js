// Web Audio API sound manager.
// Usage: import audio from './audio.js';
//   audio.unlock()       — call once on first user gesture
//   audio.preload(map)   — { name: 'path/to/file.mp3', ... }
//   audio.play(name)     — fire a one-shot sound
//   audio.setMuted(bool) — persisted to localStorage

const MUTE_KEY = 'tossboss_muted';

function createAudioManager() {
    let ctx = null;
    const buffers = {};
    let muted = localStorage.getItem(MUTE_KEY) === 'true';

    function getCtx() {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        return ctx;
    }

    // Resume the AudioContext on first user gesture — required on iOS/Android.
    function unlock() {
        const c = getCtx();
        if (c.state === 'suspended') c.resume();
    }

    // Fetch and decode every file in { name: url } map.
    async function preload(map) {
        const c = getCtx();
        await Promise.all(Object.entries(map).map(async ([name, url]) => {
            try {
                const resp = await fetch(url);
                const ab   = await resp.arrayBuffer();
                buffers[name] = await c.decodeAudioData(ab);
            } catch (e) {
                console.warn('[audio] failed to load', name, e);
            }
        }));
    }

    // Play a buffered sound. Safe to call even before preload finishes
    // (buffer just won't exist yet and the call silently no-ops).
    function play(name, { volume = 1, rate = 1 } = {}) {
        if (muted) return;
        const buf = buffers[name];
        if (!buf) return;
        const c = getCtx();
        if (c.state === 'suspended') c.resume();
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

    function setMuted(val) {
        muted = val;
        localStorage.setItem(MUTE_KEY, val);
    }

    function isMuted() { return muted; }

    return { unlock, preload, play, setMuted, isMuted };
}

const audio = createAudioManager();
export default audio;
