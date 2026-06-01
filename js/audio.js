// Web Audio API sound manager.
// Usage: import audio from './audio.js';
//   audio.unlock()            — call once on first user gesture
//   audio.preload(map)        — { name: 'path/to/file.mp3', ... }
//   audio.play(name)          — fire a one-shot sound
//   audio.playBg(name, opts)  — start/switch looping background track
//   audio.stopBg()            — fade out and stop background track
//   audio.setMuted(bool)      — persisted to localStorage

const MUTE_KEY = 'tossboss_muted';
const BG_FADE_MS = 800; // crossfade duration in ms

function createAudioManager() {
    let ctx = null;
    const buffers = {};
    let muted = localStorage.getItem(MUTE_KEY) === 'true';

    // Background music state
    let bgSource   = null;
    let bgGain     = null;
    let bgName     = null;
    let bgVolume   = 0.3;  // remembered so unlock() can retry the pending track

    function getCtx() {
        if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
        return ctx;
    }

    // Resume the AudioContext on first user gesture — required on iOS/Android.
    // If background music was requested before a gesture unblocked audio,
    // retry it now that the context is running.
    function unlock() {
        const c = getCtx();
        if (c.state === 'suspended') {
            c.resume().then(() => {
                // Retry the pending bg track if nothing is currently playing.
                if (bgName && !bgSource) {
                    const pending = bgName;
                    bgName = null; // reset so playBg doesn't no-op
                    playBg(pending, { volume: bgVolume });
                }
            });
        } else if (bgName && !bgSource) {
            const pending = bgName;
            bgName = null;
            playBg(pending, { volume: bgVolume });
        }
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

    // Pick and play a random sound from an array of names.
    function playOneOf(names, opts) {
        play(names[Math.floor(Math.random() * names.length)], opts);
    }

    // Start a looping background track, crossfading from whatever is playing.
    // If the same track is already playing, does nothing.
    function playBg(name, { volume = 0.3 } = {}) {
        bgVolume = volume; // remember in case unlock() needs to retry
        if (bgName === name) return;
        const c = getCtx();
        if (c.state === 'suspended') c.resume();
        const fadeS = BG_FADE_MS / 1000;

        // Fade out current track then stop it.
        if (bgGain && bgSource) {
            const oldGain = bgGain;
            const oldSrc  = bgSource;
            oldGain.gain.setTargetAtTime(0, c.currentTime, fadeS / 3);
            setTimeout(() => {
                try { oldSrc.stop(); } catch (_) {}
                oldGain.disconnect();
            }, BG_FADE_MS);
        }

        bgName = name;
        const buf = buffers[name];
        if (!buf) { bgSource = null; bgGain = null; return; }

        const src  = c.createBufferSource();
        src.buffer = buf;
        src.loop   = true;

        const gain = c.createGain();
        // Start silent, fade in.
        gain.gain.setValueAtTime(muted ? 0 : 0, c.currentTime);
        if (!muted) gain.gain.setTargetAtTime(volume, c.currentTime, fadeS / 3);

        src.connect(gain);
        gain.connect(c.destination);
        src.start(0);

        bgSource = src;
        bgGain   = gain;
    }

    // Fade out and stop the current background track.
    function stopBg() {
        if (!bgSource) return;
        const c = getCtx();
        const fadeS = BG_FADE_MS / 1000;
        const oldGain = bgGain;
        const oldSrc  = bgSource;
        bgSource = null; bgGain = null; bgName = null;
        oldGain.gain.setTargetAtTime(0, c.currentTime, fadeS / 3);
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

    return { unlock, preload, play, playOneOf, playBg, stopBg, setMuted, isMuted };
}

const audio = createAudioManager();
export default audio;
