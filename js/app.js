import Home from './views/Home.js';
import Game from './views/Game.js';
import Auth from './views/Auth.js';
import Leaderboard from './views/Leaderboard.js';
import Multiplayer from './views/Multiplayer.js';
import MultiplayerWaiting, { renderWaitingPlayers, waitingStatus } from './views/MultiplayerWaiting.js';
import MultiplayerGame from './views/MultiplayerGame.js';
import MultiplayerResult from './views/MultiplayerResult.js';
import { initGame } from './engine.js';
import { supabase, getHighScores, getLeaderboard, getUserEntry } from './supabase.js';
import { isTestUser, testerConfig } from './tester_config.js';
import { getPlayerId, storePlayerName, getStoredPlayerName } from './multiplayer/session.js';
import { createRoom, joinRoom, getRoomByCode, subscribeToRoom, getRoomBroadcastChannel, makePlayer } from './multiplayer/roomManager.js';

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

    // Engine lives on #game and #mp-game only — clean it up on all other routes.
    if (destroyGame && hash !== '#game' && hash !== '#mp-game') {
        destroyGame();
        destroyGame = null;
    }
    // MP subscription (waiting room Postgres sub OR game broadcast channel)
    // lives on #mp-waiting and #mp-game; the #mp-game handler explicitly
    // re-creates it, so the old waiting-room sub is cleaned up by this guard
    // on transition.
    if (destroyMp && hash !== '#mp-waiting' && hash !== '#mp-game') {
        destroyMp();
        destroyMp = null;
    }

    const { data: { session } } = await supabase.auth.getSession();

    if (hash === '#multiplayer') {
        const storedName = getStoredPlayerName();
        // Consume replay code set by "Play Again" (guest path)
        const replayCode = sessionStorage.getItem('mp_replay_code') || '';
        if (replayCode) sessionStorage.removeItem('mp_replay_code');
        app.innerHTML = Multiplayer({ session, storedName, replayCode });

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

            const { room, error } = await joinRoom({ code, playerId, playerName: name });
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

            // max_players defaults to 8 (the hard cap) in createRoom — the
            // lobby grows dynamically as players join, no up-front choice.
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

        // Game already started before this player refreshed — skip the waiting
        // screen and go straight to the game.
        if (room.status === 'playing') {
            sessionStorage.setItem('mp_room_data', JSON.stringify(room));
            window.location.hash = '#mp-game';
            return;
        }

        // Game is over — send to results if we have them, else back to lobby.
        if (room.status === 'finished') {
            const resultStr = sessionStorage.getItem('mp_result');
            window.location.hash = resultStr ? '#mp-result' : '#multiplayer';
            return;
        }

        app.innerHTML = MultiplayerWaiting({ room, role });

        // ── Realtime subscription ─────────────────────────────────────────
        destroyMp = subscribeToRoom(code, updatedRoom => {
            // Host started the game — save room data and navigate to game screen.
            if (updatedRoom.status === 'playing') {
                sessionStorage.setItem('mp_room_data', JSON.stringify(updatedRoom));
                window.location.hash = '#mp-game';
                return;
            }
            // Room was reset/deleted out from under us — bail to lobby.
            if (updatedRoom.status === 'finished') {
                window.location.hash = '#multiplayer';
                return;
            }

            // Re-render the players list (someone joined / left).
            const players    = Array.isArray(updatedRoom.players) ? updatedRoom.players : [];
            const maxPlayers = updatedRoom.max_players ?? 8;
            const canStart   = players.length >= 2;
            const full       = players.length >= maxPlayers;

            const listEl   = document.getElementById('mp-players-list');
            const chipEl   = document.getElementById('mp-count-chip');
            const startBtn = document.getElementById('btn-mp-start');
            const msgEl    = document.getElementById('mp-waiting-msg');
            const infoRow  = chipEl?.parentElement;

            if (listEl)  listEl.innerHTML = renderWaitingPlayers(updatedRoom);
            if (chipEl)  chipEl.textContent = `👥 ${players.length}/${maxPlayers}`;
            if (startBtn) startBtn.disabled = !canStart;
            if (msgEl)   msgEl.textContent = waitingStatus(updatedRoom, role === 'host');

            // Add / remove the "🔒 Full" chip as the room fills or empties.
            let fullChip = document.getElementById('mp-full-chip');
            if (full && !fullChip && infoRow) {
                fullChip = document.createElement('span');
                fullChip.className = 'mp-info-chip mp-chip-full';
                fullChip.id = 'mp-full-chip';
                fullChip.textContent = '🔒 Full';
                infoRow.appendChild(fullChip);
            } else if (!full && fullChip) {
                fullChip.remove();
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

                // Fetch the latest room row so we have the full players[] list.
                const { room: freshRoom } = await getRoomByCode(code);
                const { error } = await supabase
                    .from('rooms')
                    .update({ status: 'playing' })
                    .eq('code', code);

                if (error) {
                    btn.disabled = false;
                    btn.textContent = 'Start Game';
                    console.error('Start failed:', error.message);
                    return;
                }

                // Store room data and navigate directly (don't rely on echo).
                if (freshRoom) {
                    sessionStorage.setItem('mp_room_data', JSON.stringify({ ...freshRoom, status: 'playing' }));
                }
                window.location.hash = '#mp-game';
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

    // ─────────────────────────────────────────────────────────────────────
    //  #mp-game  — turn-based multiplayer game
    // ─────────────────────────────────────────────────────────────────────
    if (hash === '#mp-game') {
        const code         = sessionStorage.getItem('mp_room_code');
        const role         = sessionStorage.getItem('mp_role');
        const roomDataStr  = sessionStorage.getItem('mp_room_data');

        if (!code || !role || !roomDataStr) { window.location.hash = '#multiplayer'; return; }

        // Always fetch the freshest room row in case we reloaded the page.
        const { room: liveRoom } = await getRoomByCode(code);
        const room = liveRoom ?? JSON.parse(roomDataStr);

        // Room is finished (or gone) — redirect to results if available, else lobby.
        if (!liveRoom || liveRoom.status === 'finished') {
            const resultStr = sessionStorage.getItem('mp_result');
            window.location.hash = resultStr ? '#mp-result' : '#multiplayer';
            return;
        }

        const targetScore = room.target_score;
        const myId        = await getPlayerId();

        // ── Local mirror of players[] (turn order = array order) ───────────
        // DB-persisted score/throws are kept so a refresh restores state.
        const players = (Array.isArray(room.players) ? room.players : []).map(p => ({
            id:       p.id,
            name:     p.name,
            score:    p.score    ?? 0,
            streak:   p.streak   ?? 0,
            lives:    p.lives    ?? 2,
            maxLives: p.maxLives ?? 2,
            throws:   p.throws   ?? 0,
        }));

        const myIndex = players.findIndex(p => p.id === myId);
        if (myIndex === -1) { window.location.hash = '#multiplayer'; return; }
        let currentTurn = room.current_turn ?? 0;

        const myPlayer    = () => players[myIndex];
        const pIndexById  = id => players.findIndex(p => p.id === id);
        const escHtml = s => String(s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        const heartImgs = n => Array.from({ length: n },
            () => '<img src="assets/heart.webp?v=2" alt="" class="mp-opp-heart">').join('');

        // multiplayerConfig is passed into initGame.
        // isMyTurn starts false — the countdown overlay enables it.
        const multiplayerConfig = {
            gameMode:        room.game_mode,
            isMyTurn:        false,
            initialScore:    myPlayer().score,
            onThrowComplete: null,   // wired below
        };

        app.innerHTML = MultiplayerGame({ myName: myPlayer().name, targetScore, gameMode: room.game_mode });

        // ── Build opponent cards — one per other player, in turn order ─────
        const oppCardsRow = document.getElementById('mp-opp-cards');
        let lastScrolledTurn = -1;  // only auto-scroll when the active turn changes
        const buildOppCards = () => {
            if (!oppCardsRow) return;
            oppCardsRow.innerHTML = players
                .filter(p => p.id !== myId)
                .map(p => `
                    <div class="mp-player-card" data-pid="${p.id}">
                        <span class="mp-hud-pname">${escHtml(p.name)}</span>
                        <div class="mp-card-score-row">
                            <span class="mp-hud-pscore mp-card-score">${p.score}</span>
                            <span class="mp-card-target">/ ${targetScore}</span>
                            <div class="mp-opp-hearts mp-card-hearts">${heartImgs(p.maxLives)}</div>
                        </div>
                        <div class="mp-hud-stats">
                            <span class="mp-hud-throws mp-card-throws">shots: ${p.throws}</span>
                            <span class="mp-hud-streak-val mp-card-streak"></span>
                        </div>
                    </div>`).join('');
        };
        buildOppCards();

        // ── HUD helpers ──────────────────────────────────────────────────

        // Sync the mini hearts inside a given container to a player's state.
        const syncHearts = (container, { lives, maxLives = 2, onStreak = false }) => {
            if (!container) return;
            if (container.querySelectorAll('.mp-opp-heart').length !== maxLives) {
                container.innerHTML = heartImgs(maxLives);
            }
            container.querySelectorAll('.mp-opp-heart').forEach((h, i) => {
                const lit = i < lives;
                h.classList.toggle('mp-opp-heart-dim',  !lit);
                h.classList.toggle('mp-opp-heart-fire', onStreak && lit);
            });
        };

        const updateMpHud = () => {
            const gameScreen = document.getElementById('game-screen');

            // Own card
            const me = myPlayer();
            const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
            setTxt('mp-score-mine',  me.score);
            setTxt('mp-throws-mine', `shots: ${me.throws}`);
            setTxt('mp-streak-mine', `streak: ${me.streak ?? 0}`);
            syncHearts(document.getElementById('mp-mine-hearts'),
                { lives: me.lives, maxLives: me.maxLives, onStreak: (me.streak ?? 0) >= 3 });

            // Opponent cards
            players.forEach((p, idx) => {
                if (p.id === myId) return;
                const card = oppCardsRow?.querySelector(`[data-pid="${p.id}"]`);
                if (!card) return;
                const sc = card.querySelector('.mp-card-score');
                const th = card.querySelector('.mp-card-throws');
                const st = card.querySelector('.mp-card-streak');
                if (sc) sc.textContent = p.score;
                if (th) th.textContent = `shots: ${p.throws}`;
                if (st) st.textContent = `streak: ${p.streak ?? 0}`;
                syncHearts(card.querySelector('.mp-card-hearts'),
                    { lives: p.lives, maxLives: p.maxLives, onStreak: (p.streak ?? 0) >= 3 });
                card.classList.toggle('mp-card-active', idx === currentTurn);
            });

            // Own card active state + wrapper scale (so the timer ring scales too)
            const isMine = currentTurn === myIndex;
            const myCard = document.getElementById('mp-card-mine');
            if (myCard) myCard.classList.toggle('mp-card-active', isMine);
            const myWrap = document.getElementById('mp-card-mine-wrap');
            if (myWrap) myWrap.classList.toggle('mp-wrap-active', isMine);

            // Red border while input is locked (someone else's turn, not spectating).
            const locked = !multiplayerConfig.isMyTurn && !isSpectating;
            if (gameScreen) gameScreen.classList.toggle('mp-locked', locked);

            // Auto-scroll the opponents row to the active player's card (smooth),
            // but only when the active turn actually changes — so we don't fight
            // the user's manual scrolling on every HUD refresh. The own card is
            // always visible on the left, so only opponent turns need scrolling.
            if (currentTurn !== lastScrolledTurn) {
                lastScrolledTurn = currentTurn;
                scrollActiveCardIntoView();
            }
        };

        // Centre the active opponent card in the scroll row. Computed from
        // bounding rects (reliable regardless of flex layout / scroll range)
        // rather than scrollIntoView, which mis-behaves on horizontal flex rows.
        const scrollActiveCardIntoView = () => {
            const activeOpp = oppCardsRow?.querySelector('.mp-player-card.mp-card-active');
            if (!activeOpp || !oppCardsRow) return;
            const rowRect  = oppCardsRow.getBoundingClientRect();
            const cardRect = activeOpp.getBoundingClientRect();
            const delta = (cardRect.left + cardRect.width / 2) - (rowRect.left + rowRect.width / 2);
            oppCardsRow.scrollTo({ left: oppCardsRow.scrollLeft + delta, behavior: 'smooth' });
        };

        // Desktop: translate vertical wheel into horizontal scroll over the row.
        oppCardsRow?.addEventListener('wheel', (e) => {
            if (e.deltaY === 0) return;
            oppCardsRow.scrollLeft += e.deltaY;
            e.preventDefault();
        }, { passive: false });

        // ── Small helper: show a toast inside the game canvas area ──────
        // Pass high=true for system/event toasts (tiebreaker, time's up)
        // so they appear above score toasts that may fire simultaneously.
        const showGameToast = (msg, type = 'bonus-up', high = false) => {
            const container = document.getElementById('toast-container');
            if (!container) return;
            const el = document.createElement('div');
            el.className = `game-toast toast-${type}${high ? ' toast-high' : ''}`;
            el.textContent = msg;
            container.appendChild(el);
            setTimeout(() => el.remove(), 2500);
        };

        // ── 15-second turn timer ─────────────────────────────────────────
        const TURN_SECONDS = 15;
        let turnTimer     = null;
        let turnTimeLeft  = TURN_SECONDS;
        let timerRaf      = null;
        let timerStartedAt = null; // performance.now() when current turn started

        const clearTurnTimer = () => {
            if (turnTimer) { clearInterval(turnTimer); turnTimer = null; }
            if (timerRaf)  { cancelAnimationFrame(timerRaf); timerRaf = null; }
            timerStartedAt = null;
            const wrap = document.getElementById('mp-card-mine-wrap');
            if (wrap) wrap.classList.remove('timer-running', 'timer-warning', 'timer-danger');
        };

        // Called once per second — only updates warning/danger state classes.
        const updateTimerState = () => {
            const wrap = document.getElementById('mp-card-mine-wrap');
            if (!wrap) return;
            wrap.classList.toggle('timer-warning', turnTimeLeft <= 6 && turnTimeLeft > 3);
            wrap.classList.toggle('timer-danger',  turnTimeLeft <= 3);
        };

        // Colour lerp helpers
        const TIMER_GREEN  = [74,  222, 128];
        const TIMER_ORANGE = [251, 146, 60 ];
        const TIMER_RED    = [239, 68,  68 ];
        const lerpRgb = ([r1,g1,b1], [r2,g2,b2], t) =>
            `rgb(${Math.round(r1+(r2-r1)*t)},${Math.round(g1+(g2-g1)*t)},${Math.round(b1+(b2-b1)*t)})`;

        // Builds a rounded-rect path that starts at the TOP-CENTER and goes
        // clockwise.  This means stroke-dasharray visibleLen shrinks the tail
        // back toward the head (top-center), so the bar always ends there.
        let timerPerimeter = 0;
        const initTimerSvg = () => {
            const svg   = document.getElementById('mp-card-timer-svg');
            const track = document.getElementById('mp-card-timer-track');
            const fill  = document.getElementById('mp-card-timer-fill');
            if (!svg || !track || !fill) return;

            const W  = svg.clientWidth;
            const H  = svg.clientHeight;
            const sw = 4;
            const r  = 20;     // card border-radius (14px) + SVG inset (6px)
            const p  = sw / 2; // half stroke-width inset from SVG edge
            const L = p, R = W - p, T = p, B = H - p;
            const cx = W / 2;

            // Clockwise path starting at top-center
            const d = [
                `M ${cx} ${T}`,
                `H ${R - r}`,
                `A ${r} ${r} 0 0 1 ${R} ${T + r}`,
                `V ${B - r}`,
                `A ${r} ${r} 0 0 1 ${R - r} ${B}`,
                `H ${L + r}`,
                `A ${r} ${r} 0 0 1 ${L} ${B - r}`,
                `V ${T + r}`,
                `A ${r} ${r} 0 0 1 ${L + r} ${T}`,
                `H ${cx}`,
            ].join(' ');

            [track, fill].forEach(el => el.setAttribute('d', d));

            const sW = Math.max(0, W - sw - 2 * r);
            const sH = Math.max(0, H - sw - 2 * r);
            timerPerimeter = 2 * sW + 2 * sH + 2 * Math.PI * r;

            // Track shows the full path as a dim guide
            track.setAttribute('stroke-dasharray', `${timerPerimeter} ${timerPerimeter}`);
        };

        // rAF loop — shrinks the visible dash length and lerps the colour.
        const smoothTimerTick = (now) => {
            if (!timerStartedAt) return;
            const fill = document.getElementById('mp-card-timer-fill');
            if (!fill || timerPerimeter === 0) return;

            const elapsed     = (now - timerStartedAt) / 1000;
            const remaining   = Math.max(0, TURN_SECONDS - elapsed);
            const visibleLen  = (timerPerimeter * (remaining / TURN_SECONDS)).toFixed(2);

            // Two-value dasharray: visible dash then a gap large enough to hide the rest
            fill.style.strokeDasharray = `${visibleLen} ${timerPerimeter}`;
            fill.style.strokeDashoffset = 0;

            let color;
            if (remaining >= 6) {
                color = lerpRgb(TIMER_GREEN, TIMER_ORANGE, 0);
            } else if (remaining >= 3) {
                color = lerpRgb(TIMER_GREEN, TIMER_ORANGE, 1 - (remaining - 3) / 3);
            } else {
                color = lerpRgb(TIMER_ORANGE, TIMER_RED, 1 - remaining / 3);
            }
            fill.style.stroke = color;

            if (remaining > 0) timerRaf = requestAnimationFrame(smoothTimerTick);
        };

        const startTurnTimer = () => {
            clearTurnTimer();
            turnTimeLeft   = TURN_SECONDS;
            timerStartedAt = performance.now();
            initTimerSvg();
            const wrap = document.getElementById('mp-card-mine-wrap');
            if (wrap) wrap.classList.add('timer-running');
            updateTimerState();
            timerRaf = requestAnimationFrame(smoothTimerTick);
            turnTimer = setInterval(() => {
                turnTimeLeft--;
                updateTimerState();
                if (turnTimeLeft <= 0) {
                    clearTurnTimer();
                    handleTurnTimeout();
                }
            }, 1000);
        };

        // Called when timer hits 0 — end the turn as a miss.
        const handleTurnTimeout = () => {
            if (!multiplayerConfig.isMyTurn || resultPending) return;

            // ── Ball already in the air ───────────────────────────────────
            // The player threw before time ran out. Stop the visual timer and
            // wait — the engine will call onThrowComplete when the ball lands,
            // applying the real result (score or miss) with full consequences.
            if (multiplayerConfig.isBallInFlight?.()) {
                clearTurnTimer();
                showGameToast("⏰ Time's up!", 'bonus-up', true);
                return;
            }

            // ── Ball resting or mid-aim ───────────────────────────────────
            // Cancel any drag, then trigger a proper miss in the engine.
            // handleMiss resets streak/lives/bonus-mode and calls
            // onThrowComplete, which handles broadcast + DB + checkWin.
            multiplayerConfig.cancelAim?.();
            showGameToast("⏰ Time's up!", 'bonus-up', true);
            multiplayerConfig.forceMiss?.();
        };

        // ── Spectate state (Phase 3b) ────────────────────────────────────
        // isSpectating  — true while we are replaying the opponent's throw
        //                 live on our canvas; suppresses the wait overlay.
        // spectateSettled — throw replay finished but turn_end not yet received.
        // pendingTurnEnd  — turn_end payload buffered while throw is in flight.
        let isSpectating    = false;
        let spectateSettled = false;
        let pendingTurnEnd  = null;

        // ── Win-check + animated game-over overlay ────────────────────────
        let resultPending  = false; // prevent double-fire
        let tiebreakActive = false; // true once a tiebreaker round has started

        // Players ranked by score (desc). Used for the overlay + result screen.
        const computeStandings = () =>
            [...players]
                .sort((a, b) => b.score - a.score)
                .map((p, i) => ({ id: p.id, name: p.name, score: p.score, rank: i + 1 }));

        // End the game. Idempotent. `broadcast` = also tell everyone else
        // (the detector broadcasts; receivers of game_over call with false).
        const finishGame = (broadcast = true) => {
            if (resultPending) return;
            resultPending = true;

            multiplayerConfig.isMyTurn = false;
            isSpectating    = false;
            spectateSettled = false;
            pendingTurnEnd  = null;
            clearTurnTimer();
            updateMpHud();

            // Mark room finished so any refresh lands on the result screen.
            supabase.from('rooms').update({ status: 'finished' }).eq('code', code).then(() => {});

            const standings = computeStandings();
            const topScore  = standings[0].score;
            const leaders   = standings.filter(p => p.score === topScore);
            const myScore   = myPlayer().score;
            // win = sole top scorer; tie = tied at the top; else lose.
            const outcome = (myScore === topScore)
                ? (leaders.length > 1 ? 'tie' : 'win')
                : 'lose';

            if (broadcast) {
                // Send the authoritative final players[] so everyone agrees.
                bcChannel.send({ type: 'broadcast', event: 'game_over', payload: { players } });
            }

            const bannerText = { win: '🏆 You Win!', lose: '💀 You Lose…', tie: "🤝 It's a Tie!" };
            const textEl   = document.getElementById('mp-gameover-text');
            const scoresEl = document.getElementById('mp-gameover-scores');
            const overlay  = document.getElementById('mp-gameover-overlay');
            if (textEl)   textEl.textContent = bannerText[outcome] ?? bannerText.tie;
            if (scoresEl) scoresEl.textContent =
                standings.map(p => `${p.name}: ${p.score}`).join('   ·   ');
            if (overlay)  overlay.classList.remove('hidden');

            setTimeout(() => {
                sessionStorage.setItem('mp_result', JSON.stringify({
                    outcome, standings, myId,
                    myName: myPlayer().name, role, code,
                }));
                window.location.hash = '#mp-result';
            }, 2500);
        };

        const checkWin = () => {
            // A round is complete only when every player has thrown equally.
            const throwsArr = players.map(p => p.throws);
            if (Math.min(...throwsArr) !== Math.max(...throwsArr)) return;

            const topScore = Math.max(...players.map(p => p.score));
            // Before any tiebreaker: at least one player must have reached target.
            if (!tiebreakActive && topScore < targetScore) return;

            const leaders = players.filter(p => p.score === topScore);
            if (leaders.length === 1) { finishGame(true); return; }

            // Multiple players tied for the lead — play another round.
            tiebreakActive = true;
            showGameToast('🔥 TIEBREAKER! Keep playing!', 'bonus-up', true);
        };

        // ── Broadcast channel setup ──────────────────────────────────────
        if (destroyMp) { destroyMp(); destroyMp = null; }

        const bcChannel = getRoomBroadcastChannel(code);

        // Announce our real ball position so spectators show their ghost exactly
        // where we'll throw from (the spawn-park is only an instant placeholder
        // until this arrives). Called whenever it becomes our turn.
        const announceMyTurn = () => {
            const pos = multiplayerConfig.getBallPos?.();
            if (pos) bcChannel.send({
                type:    'broadcast',
                event:   'turn_ready',
                payload: { senderId: myId, x: pos.x, y: pos.y },
            });
        };

        // Apply a player's finished turn to local state and advance the turn.
        // `spectated` = true means we watched the throw live, so the unlock
        // pause is shorter and spectate state is cleared on unlock.
        const processTurnEnd = (payload, spectated = false) => {
            const idx = pIndexById(payload.senderId);
            if (idx !== -1) {
                players[idx].score    = payload.score    ?? players[idx].score;
                players[idx].streak   = payload.streak   ?? 0;
                players[idx].lives    = payload.lives    ?? 2;
                players[idx].maxLives = payload.maxLives ?? 2;
                players[idx].throws   = payload.throws   ?? players[idx].throws + 1;
            }
            currentTurn = payload.nextTurn ?? ((currentTurn + 1) % players.length);
            // Park the ghost at the launch spot as an instant placeholder for
            // every spectator; if the new turn is ours, broadcast our real ball
            // position so spectators correct their ghost to where we'll throw.
            multiplayerConfig.parkGhostAtSpawn?.();
            if (currentTurn === myIndex) announceMyTurn();
            updateMpHud();

            setTimeout(() => {
                if (spectated) { isSpectating = false; spectateSettled = false; }
                checkWin();
                if (resultPending) return; // game over — don't unlock
                if (currentTurn === myIndex) {
                    multiplayerConfig.isMyTurn = true;
                    startTurnTimer();
                }
                updateMpHud();
            }, spectated ? 600 : 1000);
        };

        bcChannel.on('broadcast', { event: 'turn_end' }, ({ payload }) => {
            if (payload.senderId === myId) return; // ignore own echo

            if (isSpectating && !spectateSettled) {
                // Throw still in flight on our canvas — buffer and process
                // once onSpectateComplete fires.
                pendingTurnEnd = payload;
                return;
            }
            if (spectateSettled) {
                spectateSettled = false;
                processTurnEnd(payload, true);
                return;
            }
            processTurnEnd(payload, false);
        });

        // Someone detected the game is over — apply authoritative standings.
        bcChannel.on('broadcast', { event: 'game_over' }, ({ payload }) => {
            if (resultPending) return;
            (payload.players || []).forEach(fp => {
                const i = pIndexById(fp.id);
                if (i !== -1) players[i] = { ...players[i], ...fp };
            });
            updateMpHud();
            finishGame(false); // already broadcast by the detector
        });

        // The active player announced their resting position — move our ghost
        // there so it sits exactly where they'll throw from (not the generic
        // spawn placeholder). Only relevant while it's not our turn.
        bcChannel.on('broadcast', { event: 'turn_ready' }, ({ payload }) => {
            if (payload.senderId === myId) return;
            multiplayerConfig.setGhost?.(payload.x, payload.y);
        });

        // A thrower's scored ball has a confirmed return destination — start
        // the ghost arc to that exact position.  startReturn() suppresses any
        // local auto-scheduled arc while in spectate mode.
        bcChannel.on('broadcast', { event: 'ball_returned' }, ({ payload }) => {
            if (payload.senderId === myId) return; // ignore own echo
            multiplayerConfig.startGhostReturn?.(payload);
        });

        // A thrower's fast-forward state changed — mirror it so our spectate
        // physics run at the same speed as theirs.
        bcChannel.on('broadcast', { event: 'ff_change' }, ({ payload }) => {
            if (payload.senderId === myId) return; // ignore own echo
            multiplayerConfig.spectateFF = payload.active;
        });

        // The active player released the ball — replay their throw live.
        bcChannel.on('broadcast', { event: 'throw_start' }, ({ payload }) => {
            if (resultPending) return;
            if (payload.senderId === myId) return; // ignore own echo
            isSpectating    = true;
            spectateSettled = false;
            pendingTurnEnd  = null;
            updateMpHud(); // hides the locked state immediately
            multiplayerConfig.spectateThrow?.(payload);
        });

        bcChannel.subscribe();
        destroyMp = () => supabase.removeChannel(bcChannel);

        // ── onThrowStart — ball just released; broadcast so others can replay ─
        multiplayerConfig.onThrowStart = ({ vx, vy, x, y }) => {
            bcChannel.send({
                type:    'broadcast',
                event:   'throw_start',
                payload: { senderId: myId, vx, vy, x, y },
            });
        };

        // ── onBallReturned — our scored ball's arc endpoints; tell spectators ─
        multiplayerConfig.onBallReturned = ({ fromX, fromY, toX, toY }) => {
            bcChannel.send({
                type:    'broadcast',
                event:   'ball_returned',
                payload: { senderId: myId, fromX, fromY, toX, toY },
            });
        };

        // ── onFFChange — fast-forward state changed; spectators mirror it ─
        multiplayerConfig.onFFChange = (active) => {
            bcChannel.send({
                type:    'broadcast',
                event:   'ff_change',
                payload: { senderId: myId, active },
            });
        };

        // ── onSpectateComplete — engine signals the replayed throw settled ─
        multiplayerConfig.onSpectateComplete = () => {
            if (pendingTurnEnd) {
                const p = pendingTurnEnd;
                pendingTurnEnd = null;
                processTurnEnd(p, true);
            } else {
                spectateSettled = true;
            }
        };

        // ── onThrowComplete — called by engine after each of OUR throws ───
        multiplayerConfig.onThrowComplete = async ({ scored, points, totalScore, streak, lives, maxLives }) => {
            multiplayerConfig.isMyTurn = false;
            clearTurnTimer();

            const me = myPlayer();
            me.score    = totalScore;
            me.streak   = streak ?? 0;
            me.lives    = lives ?? 2;
            me.maxLives = maxLives ?? 2;
            me.throws  += 1;

            const nextTurn = (currentTurn + 1) % players.length;
            currentTurn = nextTurn;
            // Park the ghost at the launch spot for the next player (shown to us
            // too until they throw; hidden again only once it's our turn).
            multiplayerConfig.parkGhostAtSpawn?.();
            updateMpHud();

            // Broadcast our finished turn (stats + whose turn is next).
            bcChannel.send({
                type:    'broadcast',
                event:   'turn_end',
                payload: {
                    senderId: myId,
                    score:    me.score,
                    streak:   me.streak,
                    lives:    me.lives,
                    maxLives: me.maxLives,
                    throws:   me.throws,
                    nextTurn,
                },
            });

            // Persist the full players[] + new turn index (one writer at a time,
            // so writing the whole array is safe). Await — Supabase is lazy.
            await supabase.from('rooms')
                .update({ players, current_turn: nextTurn })
                .eq('code', code);

            checkWin();
            // After my throw the turn moves on; my client re-enables only when a
            // future turn_end rotates back to me (handled in processTurnEnd).
        };

        // ── Start engine ─────────────────────────────────────────────────
        const highScores = session
            ? await getHighScores()
            : { pingpong: { score: 0, bestStreak: 0 }, basketball: { score: 0, bestStreak: 0 } };

        requestAnimationFrame(() => {
            destroyGame = initGame(highScores, null, multiplayerConfig);
        });

        // ── Countdown 3 → 2 → 1 → GO! ─────────────────────────────────────
        const countdownEl = document.getElementById('mp-countdown-num');
        const countdownOv = document.getElementById('mp-countdown-overlay');
        let countdownVal  = 3;

        const countdownTick = () => {
            countdownVal--;
            if (countdownVal > 0) {
                if (countdownEl) countdownEl.textContent = countdownVal;
                setTimeout(countdownTick, 1000);
            } else {
                if (countdownEl) countdownEl.textContent = 'GO!';
                setTimeout(() => {
                    if (countdownOv) countdownOv.classList.add('hidden');
                    if (currentTurn === myIndex) {
                        multiplayerConfig.isMyTurn = true;
                        startTurnTimer();
                        announceMyTurn(); // tell spectators where our ball starts
                    }
                    updateMpHud();
                }, 700);
            }
        };
        setTimeout(countdownTick, 1000);

        // ── Quit button — delete room and go back to lobby ─────────────────
        document.getElementById('mp-btn-quit')?.addEventListener('click', async () => {
            clearTurnTimer();
            if (destroyMp)   { destroyMp();   destroyMp   = null; }
            if (destroyGame) { destroyGame(); destroyGame = null; }
            await supabase.from('rooms').delete().eq('code', code);
            sessionStorage.removeItem('mp_room_code');
            sessionStorage.removeItem('mp_role');
            sessionStorage.removeItem('mp_room_data');
            window.location.hash = '#multiplayer';
        });

        updateMpHud();
        return;
    }

    // ─────────────────────────────────────────────────────────────────────
    //  #mp-result  — post-game result screen
    // ─────────────────────────────────────────────────────────────────────
    if (hash === '#mp-result') {
        const resultStr = sessionStorage.getItem('mp_result');
        if (!resultStr) { window.location.hash = '#multiplayer'; return; }

        const result = JSON.parse(resultStr);
        app.innerHTML = MultiplayerResult(result);

        // ── Play Again ─────────────────────────────────────────────────────
        document.getElementById('btn-mp-play-again')?.addEventListener('click', async () => {
            sessionStorage.removeItem('mp_result');
            sessionStorage.removeItem('mp_room_data');

            if (result.role === 'host') {
                // Host: reset the room to just the host in the lobby. Everyone
                // else re-joins with the (still valid) code.
                await supabase.from('rooms').update({
                    players:      [makePlayer(result.myId, result.myName)],
                    status:       'waiting',
                    current_turn: 0,
                }).eq('code', result.code);
                // mp_room_code and mp_role are still set to host's values
                window.location.hash = '#mp-waiting';
            } else {
                // Guest: pre-fill the code on the multiplayer hub so they can
                // quickly re-join once the host resets the room.
                sessionStorage.setItem('mp_replay_code', result.code);
                sessionStorage.removeItem('mp_room_code');
                sessionStorage.removeItem('mp_role');
                window.location.hash = '#multiplayer';
            }
        });

        // ── Home — delete the room before leaving ──────────────────────────
        document.getElementById('btn-mp-result-home')?.addEventListener('click', async () => {
            await supabase.from('rooms').delete().eq('code', result.code);
            sessionStorage.removeItem('mp_room_code');
            sessionStorage.removeItem('mp_role');
            sessionStorage.removeItem('mp_room_data');
            sessionStorage.removeItem('mp_result');
            window.location.hash = '#home';
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
