import Home from './views/Home.js';
import Game from './views/Game.js';
import Auth from './views/Auth.js';
import Leaderboard from './views/Leaderboard.js';
import Multiplayer from './views/Multiplayer.js';
import MultiplayerWaiting from './views/MultiplayerWaiting.js';
import MultiplayerGame from './views/MultiplayerGame.js';
import MultiplayerResult from './views/MultiplayerResult.js';
import { initGame } from './engine.js';
import { supabase, getHighScores, getLeaderboard, getUserEntry } from './supabase.js';
import { isTestUser, testerConfig } from './tester_config.js';
import { getPlayerId, storePlayerName, getStoredPlayerName } from './multiplayer/session.js';
import { createRoom, joinRoom, getRoomByCode, subscribeToRoom, getRoomBroadcastChannel } from './multiplayer/roomManager.js';

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

            // Host started the game — save room data and navigate to game screen.
            if (updatedRoom.status === 'playing') {
                sessionStorage.setItem('mp_room_data', JSON.stringify(updatedRoom));
                window.location.hash = '#mp-game';
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

                // Fetch the latest room row so we have the guest fields too.
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

        const myName      = role === 'host' ? room.host_name  : room.guest_name;
        const oppName     = role === 'host' ? room.guest_name : room.host_name;
        const targetScore = room.target_score;

        // Mutable scores/stats — shared with the engine via closure.
        const mpScores = {
            mine:      role === 'host' ? (room.host_score  || 0) : (room.guest_score || 0),
            opp:       role === 'host' ? (room.guest_score || 0) : (room.host_score  || 0),
            myStreak:  0,
            oppStreak: 0,
        };

        // Always start at 0/0. checkWin only needs equality, not absolute
        // values, so this is correct for both fresh game-start and refresh:
        // the counts naturally reach parity again after the current round
        // completes, at which point win detection fires correctly.
        mpScores.myThrows  = 0;
        mpScores.oppThrows = 0;

        // multiplayerConfig is passed into initGame.
        // isMyTurn starts false — the countdown overlay enables it.
        // initialScore restores the DB-persisted score after a refresh.
        const multiplayerConfig = {
            gameMode:        room.game_mode,
            isMyTurn:        false,
            initialScore:    mpScores.mine,
            onThrowComplete: null,   // wired below
        };

        app.innerHTML = MultiplayerGame({ myName, oppName, targetScore, gameMode: room.game_mode });

        // ── HUD helpers ──────────────────────────────────────────────────
        const updateMpHud = () => {
            const myScoreEl   = document.getElementById('mp-score-mine');
            const oppScoreEl  = document.getElementById('mp-score-theirs');
            const turnEl      = document.getElementById('mp-turn-indicator');
            const gameScreen  = document.getElementById('game-screen');
            const myThrowsEl  = document.getElementById('mp-throws-mine');
            const oppThrowsEl = document.getElementById('mp-throws-theirs');
            const myStreakEl  = document.getElementById('mp-streak-mine');
            const oppStreakEl = document.getElementById('mp-streak-theirs');

            if (myScoreEl)   myScoreEl.textContent   = mpScores.mine;
            if (oppScoreEl)  oppScoreEl.textContent   = mpScores.opp;
            if (myThrowsEl)  myThrowsEl.textContent   = `${mpScores.myThrows} shots`;
            if (oppThrowsEl) oppThrowsEl.textContent  = `${mpScores.oppThrows} shots`;
            if (myStreakEl)  myStreakEl.textContent    = mpScores.myStreak  > 0 ? `streak ${mpScores.myStreak}`  : '';
            if (oppStreakEl) oppStreakEl.textContent   = mpScores.oppStreak > 0 ? `streak ${mpScores.oppStreak}` : '';
            if (turnEl) turnEl.textContent = multiplayerConfig.isMyTurn
                ? '🎯 Your Turn!'
                : `⏳ ${oppName}'s Turn…`;
            // Glow the border red while input is locked (opponent's turn).
            // Cleared on our turn AND during live spectate (ball is flying —
            // no need to remind the player they're locked, they're watching).
            const locked = !multiplayerConfig.isMyTurn && !isSpectating;
            if (gameScreen) gameScreen.classList.toggle('mp-locked', locked);
        };

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
        let turnTimer    = null;
        let turnTimeLeft = TURN_SECONDS;

        const clearTurnTimer = () => {
            if (turnTimer) { clearInterval(turnTimer); turnTimer = null; }
            const el = document.getElementById('mp-turn-timer');
            if (el) el.classList.add('hidden');
        };

        const updateTimerDisplay = () => {
            const el  = document.getElementById('mp-turn-timer');
            const val = document.getElementById('mp-timer-value');
            const arc = document.getElementById('mp-timer-arc');
            if (!el || !val) return;
            val.textContent = turnTimeLeft;
            // Deplete the ring: offset 0 = full circle, 56.55 = empty
            if (arc) {
                const circumference = 56.55;
                arc.style.strokeDashoffset =
                    (circumference * (1 - turnTimeLeft / TURN_SECONDS)).toFixed(2);
            }
            el.classList.remove('hidden', 'warning', 'danger');
            if      (turnTimeLeft <= 3) el.classList.add('danger');
            else if (turnTimeLeft <= 6) el.classList.add('warning');
        };

        const startTurnTimer = () => {
            clearTurnTimer();
            turnTimeLeft = TURN_SECONDS;
            updateTimerDisplay();
            turnTimer = setInterval(() => {
                turnTimeLeft--;
                updateTimerDisplay();
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

        const goToResult = (outcome) => {
            if (resultPending) return;
            resultPending = true;

            // Block all input; clear spectate state so the wait overlay
            // (which might be hidden for spectate) is properly ignored.
            multiplayerConfig.isMyTurn = false;
            isSpectating    = false;
            spectateSettled = false;
            pendingTurnEnd  = null;
            clearTurnTimer();
            updateMpHud();

            // Mark room finished so any refresh lands on the result screen, not
            // back in the game. Fire-and-forget — no need to await.
            supabase.from('rooms').update({ status: 'finished' }).eq('code', code).then(() => {});

            // Explicitly notify the opponent the game is over, in case they are
            // stuck on the wait overlay and never independently reach checkWin.
            // Payload uses the OPPONENT's perspective so they can blindly apply it.
            const oppOutcome = outcome === 'win' ? 'lose' : outcome === 'lose' ? 'win' : 'tie';
            bcChannel.send({
                type:    'broadcast',
                event:   'game_over',
                // myScore / oppScore are FROM THE RECEIVER'S perspective
                payload: { outcome: oppOutcome, myScore: mpScores.opp, oppScore: mpScores.mine },
            });

            // Show in-game flash overlay
            const bannerText = { win: '🏆 You Win!', lose: '💀 You Lose…', tie: "🤝 It's a Tie!" };
            const textEl    = document.getElementById('mp-gameover-text');
            const scoresEl  = document.getElementById('mp-gameover-scores');
            const overlay   = document.getElementById('mp-gameover-overlay');
            if (textEl)   textEl.textContent   = bannerText[outcome] ?? bannerText.tie;
            if (scoresEl) scoresEl.textContent = `${mpScores.mine} — ${mpScores.opp}`;
            if (overlay)  overlay.classList.remove('hidden');

            setTimeout(() => {
                sessionStorage.setItem('mp_result', JSON.stringify({
                    outcome,
                    myScore:  mpScores.mine,
                    oppScore: mpScores.opp,
                    myName, oppName, role, code,
                }));
                window.location.hash = '#mp-result';
            }, 2500);
        };

        const checkWin = () => {
            if (mpScores.myThrows !== mpScores.oppThrows) return; // round not complete yet

            const myS = mpScores.mine, oppS = mpScores.opp;

            // Before any tiebreaker: at least one player must have reached target.
            if (!tiebreakActive && myS < targetScore && oppS < targetScore) return;

            if (myS > oppS) { goToResult('win');  return; }
            if (oppS > myS) { goToResult('lose'); return; }

            // Scores are equal after equal throws — start (or extend) a tiebreaker.
            tiebreakActive = true;
            showGameToast('🔥 TIEBREAKER! Keep playing!', 'bonus-up', true);
            // Game continues normally; checkWin will fire again after the next round.
        };

        // ── Broadcast channel setup ──────────────────────────────────────
        if (destroyMp) { destroyMp(); destroyMp = null; }

        const bcChannel = getRoomBroadcastChannel(code);

        // Shared handler for opponent's turn ending — called either directly
        // from the broadcast or deferred via pendingTurnEnd after spectate.
        // `spectated` = true means the player watched the throw live; in that
        // case isSpectating stays true until the timeout so the wait overlay
        // does not flash back between the replay end and "Your Turn!".
        const processTurnEnd = (payload, spectated = false) => {
            mpScores.opp       = payload.totalScore;
            mpScores.oppStreak = payload.streak ?? 0;
            mpScores.oppThrows++;
            updateMpHud(); // isSpectating still true if spectated → wait overlay hidden

            // Brief pause so both players see the updated score, then check for
            // a winner before unlocking. Shorter after a live replay since both
            // players already watched the ball settle.
            setTimeout(() => {
                if (spectated) {
                    isSpectating    = false;
                    spectateSettled = false;
                }
                checkWin();
                if (resultPending) return; // game over — don't unlock
                multiplayerConfig.isMyTurn = true;
                startTurnTimer();
                updateMpHud();
            }, spectated ? 600 : 1000);
        };

        bcChannel.on('broadcast', { event: 'turn_end' }, ({ payload }) => {
            if (payload.role === role) return; // ignore own echo

            if (isSpectating && !spectateSettled) {
                // Throw still in flight on our canvas — buffer and process
                // once onSpectateComplete fires.
                pendingTurnEnd = payload;
                return;
            }

            if (spectateSettled) {
                // Replay finished before turn_end arrived — process now
                // with the spectated flag so the wait overlay stays hidden.
                spectateSettled = false;
                processTurnEnd(payload, true);
                return;
            }

            // Normal (non-spectate) path
            processTurnEnd(payload, false);
        });

        // Opponent called goToResult on their side — sync us to the result screen.
        // This is the authoritative path for the player stuck on wait overlay.
        bcChannel.on('broadcast', { event: 'game_over' }, ({ payload }) => {
            if (resultPending) return; // already heading to result, ignore echo
            // Apply authoritative final scores from the sender's data.
            mpScores.mine = payload.myScore;
            mpScores.opp  = payload.oppScore;
            updateMpHud();
            goToResult(payload.outcome);
        });

        // Opponent's scored ball has a confirmed return destination — start
        // the ghost arc to that exact position.  startReturn() suppresses any
        // local auto-scheduled arc while in spectate mode, so this broadcast
        // is the one and only arc trigger.
        bcChannel.on('broadcast', { event: 'ball_returned' }, ({ payload }) => {
            if (multiplayerConfig) multiplayerConfig.startGhostReturn?.(payload);
        });

        // Opponent's fast-forward state changed — mirror it so our spectate
        // physics run at the same speed as theirs.
        bcChannel.on('broadcast', { event: 'ff_change' }, ({ payload }) => {
            if (payload.role === role) return; // ignore own echo
            if (multiplayerConfig) multiplayerConfig.spectateFF = payload.active;
        });

        // Opponent just released the ball — replay their throw live instead of
        // showing the spinner.  The wait overlay is already hidden by
        // updateMpHud() (isSpectating gate).  When the ball settles on our
        // canvas, onSpectateComplete fires and the turn is handed back.
        bcChannel.on('broadcast', { event: 'throw_start' }, ({ payload }) => {
            if (resultPending) return;
            isSpectating    = true;
            spectateSettled = false;
            pendingTurnEnd  = null;
            updateMpHud(); // hides wait overlay immediately
            multiplayerConfig.spectateThrow?.(payload);
        });

        bcChannel.subscribe();
        destroyMp = () => supabase.removeChannel(bcChannel);

        // ── onThrowStart — ball just released; broadcast so opponent can replay ─
        multiplayerConfig.onThrowStart = ({ vx, vy, x, y }) => {
            bcChannel.send({
                type:    'broadcast',
                event:   'throw_start',
                payload: { vx, vy, x, y },
            });
        };

        // ── onBallReturned — our scored ball's arc endpoints; tell opponent ─
        // fromX/Y = ball position when arc starts; toX/Y = arc destination.
        // Both must match so the ghost arc is pixel-identical on both screens.
        multiplayerConfig.onBallReturned = ({ fromX, fromY, toX, toY }) => {
            bcChannel.send({
                type:    'broadcast',
                event:   'ball_returned',
                payload: { fromX, fromY, toX, toY },
            });
        };

        // ── onFFChange — fast-forward state changed; opponent should mirror it ─
        multiplayerConfig.onFFChange = (active) => {
            bcChannel.send({
                type:    'broadcast',
                event:   'ff_change',
                payload: { role, active },
            });
        };

        // ── onSpectateComplete — engine signals the replayed throw settled ─
        multiplayerConfig.onSpectateComplete = () => {
            if (pendingTurnEnd) {
                // turn_end arrived while ball was still in flight — process now
                const p = pendingTurnEnd;
                pendingTurnEnd = null;
                processTurnEnd(p, true);
            } else {
                // turn_end hasn't arrived yet; mark settled so the broadcast
                // handler knows to use the spectated path when it does arrive.
                spectateSettled = true;
            }
        };

        // ── onThrowComplete — called by engine after each of our throws ───
        multiplayerConfig.onThrowComplete = async ({ scored, points, totalScore, streak }) => {
            multiplayerConfig.isMyTurn = false;
            clearTurnTimer();
            mpScores.mine     = totalScore;
            mpScores.myStreak = streak;
            mpScores.myThrows++;
            updateMpHud();

            // Broadcast to opponent
            bcChannel.send({
                type:    'broadcast',
                event:   'turn_end',
                payload: { role, scored, points, totalScore, streak },
            });

            // Persist score + flip turn in DB (must be awaited — Supabase v2
            // queries are lazy and won't execute without await / .then()).
            const scoreCol = role === 'host' ? 'host_score' : 'guest_score';
            const nextTurn = role === 'host' ? 'guest'      : 'host';
            await supabase.from('rooms').update({
                [scoreCol]:   totalScore,
                current_turn: nextTurn,
            }).eq('code', code);

            checkWin();
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
                    if (room.current_turn === role) {
                        multiplayerConfig.isMyTurn = true;
                        startTurnTimer();
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
                // Host: reset room scores/status and return to waiting screen.
                await supabase.from('rooms').update({
                    host_score:   0,
                    guest_score:  0,
                    status:       'waiting',
                    current_turn: 'host',
                    guest_id:     null,
                    guest_name:   null,
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
