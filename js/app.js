import Home from './views/Home.js';
import Game from './views/Game.js';
import Auth from './views/Auth.js';
import Leaderboard from './views/Leaderboard.js';
import Multiplayer from './views/Multiplayer.js';
import MultiplayerWaiting from './views/MultiplayerWaiting.js';
import { initGame } from './engine.js';
import { supabase, getHighScores, getLeaderboard, getUserEntry } from './supabase.js';
import { isTestUser, testerConfig } from './tester_config.js';
import { getPlayerId, storePlayerName, getStoredPlayerName } from './multiplayer/session.js';
import { createRoom, joinRoom, getRoomByCode, subscribeToRoom } from './multiplayer/roomManager.js';

let destroyGame = null;
let destroyMp   = null;   // unsubscribe fn for the active MP room subscription

// Show / hide an .mp-error element.
function showMpError(el, msg) {
    if (!el) return;
    el.textContent = msg;
    el.hidden = false;
}
function hideMpError(el) {
    if (el) el.hidden = true;
}

const medalClass = ['lb-gold', 'lb-silver', 'lb-bronze'];
const medalIcon  = ['🥇', '🥈', '🥉'];

// Builds the inner HTML for a leaderboard list.
// rows      — top-10 array from getLeaderboard (each has user_id)
// userId    — logged-in user's id, or null
// myEntry   — result of getUserEntry, or null
function buildLbHtml(rows, userId, myEntry) {
    const userInTop = userId && rows.some(r => r.user_id === userId);

    const rowsHtml = rows.map((row, i) => {
        const isMe = userId && row.user_id === userId;
        return `
            <div class="lb-row ${medalClass[i] || ''} ${isMe ? 'lb-me' : ''}">
                <span class="lb-rank">${i < 3 ? medalIcon[i] : i + 1}</span>
                <span class="lb-name">${row.display_name}</span>
                <span class="lb-score">${row.score}</span>
                <span class="lb-streak">${row.best_streak ?? '—'}</span>
            </div>`;
    }).join('');

    if (userInTop || !myEntry) return rowsHtml;

    // User exists but is outside the top 10 — append dots + their row.
    return rowsHtml + `
        <div class="lb-dots">• • •</div>
        <div class="lb-row lb-me">
            <span class="lb-rank">${myEntry.rank}</span>
            <span class="lb-name">${myEntry.display_name}</span>
            <span class="lb-score">${myEntry.score}</span>
            <span class="lb-streak">${myEntry.best_streak ?? '—'}</span>
        </div>`;
}

async function router() {
    const app = document.getElementById('app');
    const hash = window.location.hash || '#home';

    if (destroyGame && hash !== '#game') {
        destroyGame();
        destroyGame = null;
    }
    if (destroyMp && hash !== '#mp-waiting') {
        destroyMp();
        destroyMp = null;
    }

    const { data: { session } } = await supabase.auth.getSession();

    if (hash === '#multiplayer') {
        const storedName = getStoredPlayerName();
        app.innerHTML = Multiplayer({ session, storedName });

        const hub         = document.getElementById('mp-hub');
        const createPanel = document.getElementById('mp-create');
        const hubError    = document.getElementById('mp-hub-error');
        const createError = document.getElementById('mp-create-error');

        // ── Back to Home ──────────────────────────────────────────────────
        document.getElementById('btn-mp-back').addEventListener('click', () => {
            window.location.hash = '#home';
        });

        // ── Panel switching ───────────────────────────────────────────────
        document.getElementById('btn-mp-show-create').addEventListener('click', () => {
            hideMpError(hubError);
            hub.hidden = true;
            createPanel.hidden = false;
            // Copy typed name across to create panel (guests only)
            const joinName    = document.getElementById('mp-join-name');
            const createName  = document.getElementById('mp-create-name');
            if (createName?.type === 'text' && joinName?.value.trim()) {
                createName.value = joinName.value.trim();
            }
        });

        document.getElementById('btn-mp-create-back').addEventListener('click', () => {
            hideMpError(createError);
            createPanel.hidden = true;
            hub.hidden = false;
        });

        // ── Target-score slider ───────────────────────────────────────────
        const slider        = document.getElementById('mp-target-slider');
        const targetDisplay = document.getElementById('mp-target-display');
        const syncSlider = () => {
            const min = +slider.min, max = +slider.max, val = +slider.value;
            const pct = ((val - min) / (max - min) * 100).toFixed(1) + '%';
            slider.style.setProperty('--val', pct);
            targetDisplay.textContent = `${val} pts`;
        };
        slider.addEventListener('input', syncSlider);
        syncSlider();   // initialise fill on load

        // ── Game-mode buttons ─────────────────────────────────────────────
        let selectedMode = 'pingpong';
        document.getElementById('mp-mode-pp').addEventListener('click', () => {
            selectedMode = 'pingpong';
            document.getElementById('mp-mode-pp').classList.add('active');
            document.getElementById('mp-mode-bb').classList.remove('active');
        });
        document.getElementById('mp-mode-bb').addEventListener('click', () => {
            selectedMode = 'basketball';
            document.getElementById('mp-mode-bb').classList.add('active');
            document.getElementById('mp-mode-pp').classList.remove('active');
        });

        // ── Join Room ─────────────────────────────────────────────────────
        const doJoin = async () => {
            hideMpError(hubError);
            const name = document.getElementById('mp-join-name').value.trim();
            const code = document.getElementById('mp-code-input').value.trim().toUpperCase();

            if (!name)              { showMpError(hubError, 'Please enter your name.'); return; }
            if (code.length !== 6)  { showMpError(hubError, 'Room code must be 6 characters.'); return; }

            const joinBtn = document.getElementById('btn-mp-join');
            joinBtn.disabled = true;

            const playerId = await getPlayerId();
            storePlayerName(name);

            const { room, error } = await joinRoom({ code, guestId: playerId, guestName: name });
            joinBtn.disabled = false;
            if (error) { showMpError(hubError, error.message); return; }

            sessionStorage.setItem('mp_room_code', room.code);
            sessionStorage.setItem('mp_role', 'guest');
            window.location.hash = '#mp-waiting';
        };

        document.getElementById('btn-mp-join').addEventListener('click', doJoin);
        document.getElementById('mp-code-input').addEventListener('keydown', e => {
            if (e.key === 'Enter') doJoin();
        });

        // ── Create Room ───────────────────────────────────────────────────
        document.getElementById('btn-mp-create-confirm').addEventListener('click', async () => {
            hideMpError(createError);
            const nameInput = document.getElementById('mp-create-name');
            const name = nameInput.value.trim();

            if (!name) { showMpError(createError, 'Please enter your name.'); return; }

            const confirmBtn = document.getElementById('btn-mp-create-confirm');
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Creating…';

            const playerId    = await getPlayerId();
            const targetScore = +document.getElementById('mp-target-slider').value;

            storePlayerName(name);

            const { room, error } = await createRoom({
                hostId: playerId, hostName: name,
                gameMode: selectedMode, targetScore,
            });

            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Create Room';

            if (error) { showMpError(createError, error.message); return; }

            sessionStorage.setItem('mp_room_code', room.code);
            sessionStorage.setItem('mp_role', 'host');
            window.location.hash = '#mp-waiting';
        });

        return;
    }

    if (hash === '#mp-waiting') {
        const code = sessionStorage.getItem('mp_room_code');
        const role = sessionStorage.getItem('mp_role');

        // Guard: no stored room → back to lobby
        if (!code || !role) { window.location.hash = '#multiplayer'; return; }

        const { room, error: roomErr } = await getRoomByCode(code);
        if (roomErr || !room) { window.location.hash = '#multiplayer'; return; }

        app.innerHTML = MultiplayerWaiting({ room, role });

        // ── Realtime subscription ─────────────────────────────────────────
        destroyMp = subscribeToRoom(code, updatedRoom => {
            // Guest joined — update host's waiting screen
            if (updatedRoom.guest_name) {
                const nameEl  = document.getElementById('mp-guest-name-el');
                const dotEl   = document.getElementById('mp-guest-dot');
                const startBtn = document.getElementById('btn-mp-start');
                const msgEl   = document.getElementById('mp-waiting-msg');
                if (nameEl)  nameEl.textContent = updatedRoom.guest_name;
                if (dotEl)   { dotEl.classList.replace('mp-dot-waiting', 'mp-dot-ready'); }
                if (startBtn){ startBtn.disabled = false; }
                if (msgEl && role === 'host')
                    msgEl.textContent = "✅ Both players ready! Start when you're ready.";
                if (msgEl && role === 'guest')
                    msgEl.textContent = '✅ Both players ready! Waiting for host…';
            }

            // Host started the game
            if (updatedRoom.status === 'playing') {
                sessionStorage.setItem('mp_room_data', JSON.stringify(updatedRoom));
                // Phase 2 will navigate to the actual game.
                // For now update the status message on both screens.
                const msgEl   = document.getElementById('mp-waiting-msg');
                const startBtn = document.getElementById('btn-mp-start');
                if (msgEl)   msgEl.textContent = '🎮 Game starting…';
                if (startBtn){ startBtn.disabled = true; startBtn.textContent = 'Starting…'; }
            }
        });

        // ── Copy code to clipboard ────────────────────────────────────────
        document.getElementById('btn-mp-copy').addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(code);
                const btn = document.getElementById('btn-mp-copy');
                btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="#4ade80" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><polyline points="20 6 9 17 4 12"/></svg>';
                setTimeout(() => {
                    btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
                }, 1800);
            } catch { /* clipboard blocked */ }
        });

        // ── Start Game (host only) ────────────────────────────────────────
        if (role === 'host') {
            document.getElementById('btn-mp-start')?.addEventListener('click', async () => {
                const btn = document.getElementById('btn-mp-start');
                btn.disabled = true;
                btn.textContent = 'Starting…';
                const { error } = await supabase
                    .from('rooms')
                    .update({ status: 'playing' })
                    .eq('code', code);
                if (error) {
                    btn.disabled = false;
                    btn.textContent = 'Start Game';
                    console.error('Start failed:', error.message);
                }
            });
        }

        // ── Leave Room ────────────────────────────────────────────────────
        document.getElementById('btn-mp-leave').addEventListener('click', () => {
            if (destroyMp) { destroyMp(); destroyMp = null; }
            sessionStorage.removeItem('mp_room_code');
            sessionStorage.removeItem('mp_role');
            window.location.hash = '#multiplayer';
        });

        return;
    }

    if (hash === '#auth') {
        app.innerHTML = Auth();
        bindAuthForm();
        return;
    }

    if (hash === '#leaderboard') {
        app.innerHTML = Leaderboard();
        document.getElementById('btn-lb-back').addEventListener('click', () => {
            window.location.hash = '#home';
        });
        let currentMode = 'pingpong';
        let lbSortBy = 'score';

        const updateLbSortHeaders = () => {
            document.getElementById('lb-sort-score').classList.toggle('active-sort', lbSortBy === 'score');
            document.getElementById('lb-sort-streak').classList.toggle('active-sort', lbSortBy === 'best_streak');
        };

        const renderList = async (mode) => {
            const list = document.getElementById('leaderboard-list');
            const loadingTimer = setTimeout(() => {
                list.innerHTML = '<div class="lb-loading">Loading...</div>';
            }, 500);
            const [rows, myEntry] = await Promise.all([
                getLeaderboard(mode, lbSortBy),
                getUserEntry(mode, lbSortBy),
            ]);
            clearTimeout(loadingTimer);
            if (rows.length === 0) {
                list.innerHTML = '<div class="lb-loading">No scores yet.</div>';
                return;
            }
            list.innerHTML = buildLbHtml(rows, session?.user?.id ?? null, myEntry);
        };

        document.getElementById('lb-sort-score').addEventListener('click', () => {
            lbSortBy = 'score';
            updateLbSortHeaders();
            renderList(currentMode);
        });

        document.getElementById('lb-sort-streak').addEventListener('click', () => {
            lbSortBy = 'best_streak';
            updateLbSortHeaders();
            renderList(currentMode);
        });

        document.getElementById('tab-pingpong').addEventListener('click', () => {
            currentMode = 'pingpong';
            document.getElementById('tab-pingpong').classList.add('active');
            document.getElementById('tab-basketball').classList.remove('active');
            renderList('pingpong');
        });
        document.getElementById('tab-basketball').addEventListener('click', () => {
            currentMode = 'basketball';
            document.getElementById('tab-basketball').classList.add('active');
            document.getElementById('tab-pingpong').classList.remove('active');
            renderList('basketball');
        });
        renderList(currentMode);
        return;
    }

    if (hash === '#home') {
        app.innerHTML = Home(session);
        document.getElementById('btn-play-game').addEventListener('click', () => {
            window.location.hash = '#game';
        });
        document.getElementById('btn-multiplayer').addEventListener('click', () => {
            window.location.hash = '#multiplayer';
        });
        document.getElementById('btn-leaderboard').addEventListener('click', () => {
            window.location.hash = '#leaderboard';
        });
        if (session) {
            document.getElementById('btn-logout')?.addEventListener('click', async () => {
                await supabase.auth.signOut();
                router();
            });
        } else {
            document.getElementById('btn-signin')?.addEventListener('click', () => {
                window.location.hash = '#auth';
            });
        }
    } else if (hash === '#game') {
        app.innerHTML = Game();
        document.getElementById('btn-home').addEventListener('click', () => {
            window.location.hash = '#home';
        });

        const lbModal = document.getElementById('lb-modal');
        const lbModalList = document.getElementById('lb-modal-list');
        let lbModalMode = 'pingpong';
        let lbModalSortBy = 'score';

        const updateModalSortHeaders = () => {
            document.getElementById('lb-modal-sort-score').classList.toggle('active-sort', lbModalSortBy === 'score');
            document.getElementById('lb-modal-sort-streak').classList.toggle('active-sort', lbModalSortBy === 'best_streak');
        };

        const renderModalList = async (mode) => {
            const loadingTimer = setTimeout(() => {
                lbModalList.innerHTML = '<div class="lb-loading">Loading...</div>';
            }, 500);
            const [rows, myEntry] = await Promise.all([
                getLeaderboard(mode, lbModalSortBy),
                getUserEntry(mode, lbModalSortBy),
            ]);
            clearTimeout(loadingTimer);
            if (rows.length === 0) {
                lbModalList.innerHTML = '<div class="lb-loading">No scores yet.</div>';
                return;
            }
            lbModalList.innerHTML = buildLbHtml(rows, session?.user?.id ?? null, myEntry);
        };

        const lbBtn = document.getElementById('btn-leaderboard-game');
        const setLbModal = (open) => {
            lbModal.style.display = open ? 'flex' : 'none';
            lbBtn.classList.toggle('selected', open);
        };

        lbBtn.addEventListener('click', () => {
            // Sync modal mode to whichever game mode is currently active.
            lbModalMode = document.getElementById('mode-basketball').classList.contains('active')
                ? 'basketball' : 'pingpong';
            const pingTab = document.getElementById('lb-modal-tab-pingpong');
            const bballTab = document.getElementById('lb-modal-tab-basketball');
            pingTab.classList.toggle('active', lbModalMode === 'pingpong');
            bballTab.classList.toggle('active', lbModalMode === 'basketball');
            setLbModal(true);
            renderModalList(lbModalMode);
        });

        document.getElementById('btn-lb-modal-close').addEventListener('click', () => {
            setLbModal(false);
        });

        lbModal.addEventListener('click', (e) => {
            if (e.target === lbModal) setLbModal(false);
        });

        document.getElementById('lb-modal-sort-score').addEventListener('click', () => {
            lbModalSortBy = 'score';
            updateModalSortHeaders();
            renderModalList(lbModalMode);
        });

        document.getElementById('lb-modal-sort-streak').addEventListener('click', () => {
            lbModalSortBy = 'best_streak';
            updateModalSortHeaders();
            renderModalList(lbModalMode);
        });

        document.getElementById('lb-modal-tab-pingpong').addEventListener('click', () => {
            lbModalMode = 'pingpong';
            document.getElementById('lb-modal-tab-pingpong').classList.add('active');
            document.getElementById('lb-modal-tab-basketball').classList.remove('active');
            renderModalList('pingpong');
        });

        document.getElementById('lb-modal-tab-basketball').addEventListener('click', () => {
            lbModalMode = 'basketball';
            document.getElementById('lb-modal-tab-basketball').classList.add('active');
            document.getElementById('lb-modal-tab-pingpong').classList.remove('active');
            renderModalList('basketball');
        });

        const highScores = session
            ? await getHighScores()
            : { pingpong: { score: 0, bestStreak: 0 }, basketball: { score: 0, bestStreak: 0 } };

        // Custom test-user rules (see js/tester_config.js); null for everyone else.
        const testerRules = isTestUser(session) ? testerConfig : null;

        const helpBtn = document.getElementById('btn-help');
        helpBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const bubble = document.getElementById('help-bubble');
            bubble.classList.toggle('visible');
            helpBtn.classList.toggle('selected', bubble.classList.contains('visible'));
        });

        document.addEventListener('click', () => {
            document.getElementById('help-bubble')?.classList.remove('visible');
            helpBtn.classList.remove('selected');
        });

        requestAnimationFrame(() => {
            destroyGame = initGame(highScores, testerRules);
        });
    }
}

function bindAuthForm() {
    const errorEl = document.getElementById('auth-error');

    const showError = (msg) => {
        errorEl.textContent = msg;
        errorEl.style.display = 'block';
    };

    const hideError = () => { errorEl.style.display = 'none'; };

    const show = (id) => document.getElementById(id).style.display = 'block';
    const hide = (id) => document.getElementById(id).style.display = 'none';

    // Choice buttons
    document.getElementById('btn-show-signin').addEventListener('click', () => {
        hideError();
        hide('auth-choice');
        show('auth-signin-form');
    });

    document.getElementById('btn-show-signup').addEventListener('click', () => {
        hideError();
        hide('auth-choice');
        show('auth-signup-form');
    });

    document.getElementById('btn-guest').addEventListener('click', () => {
        window.location.hash = '#home';
    });

    // Back buttons
    document.getElementById('btn-back-signin').addEventListener('click', () => {
        hideError();
        hide('auth-signin-form');
        show('auth-choice');
    });

    document.getElementById('btn-back-signup').addEventListener('click', () => {
        hideError();
        hide('auth-signup-form');
        show('auth-choice');
    });

    // Sign In submit
    document.getElementById('btn-login').addEventListener('click', async (e) => {
        e.preventDefault();
        const email = document.getElementById('signin-email').value;
        const password = document.getElementById('signin-password').value;
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) return showError(error.message);
        window.location.hash = '#home';
    });

    // Create Account submit
    document.getElementById('btn-signup').addEventListener('click', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value.trim();
        const email = document.getElementById('signup-email').value;
        const password = document.getElementById('signup-password').value;
        const { error } = await supabase.auth.signUp({
            email,
            password,
            options: { data: { name: name || null } }
        });
        if (error) return showError(error.message);
        window.location.hash = '#home';
    });
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);
