import Home from './views/Home.js';
import Game from './views/Game.js';
import Auth from './views/Auth.js';
import Leaderboard from './views/Leaderboard.js';
import Multiplayer from './views/Multiplayer.js';
import { initGame } from './engine.js';
import { supabase, getHighScores, getLeaderboard, getUserEntry } from './supabase.js';
import { isTestUser, testerConfig } from './tester_config.js';

let destroyGame = null;

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

    const { data: { session } } = await supabase.auth.getSession();

    if (hash === '#multiplayer') {
        app.innerHTML = Multiplayer();
        document.getElementById('btn-mp-back').addEventListener('click', () => {
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
