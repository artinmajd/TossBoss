import Home from './views/Home.js';
import Game from './views/Game.js';
import Auth from './views/Auth.js';
import Leaderboard from './views/Leaderboard.js';
import { initGame } from './engine.js';
import { supabase, getHighScores, getLeaderboard } from './supabase.js';

let destroyGame = null;

async function router() {
    const app = document.getElementById('app');
    const hash = window.location.hash || '#home';

    if (destroyGame && hash !== '#game') {
        destroyGame();
        destroyGame = null;
    }

    const { data: { session } } = await supabase.auth.getSession();

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
        const renderList = async (mode) => {
            const list = document.getElementById('leaderboard-list');
            const loadingTimer = setTimeout(() => {
                list.innerHTML = '<div class="lb-loading">Loading...</div>';
            }, 500);
            const rows = await getLeaderboard(mode);
            clearTimeout(loadingTimer);
            if (rows.length === 0) {
                list.innerHTML = '<div class="lb-loading">No scores yet.</div>';
                return;
            }
            const medalClass = ['lb-gold', 'lb-silver', 'lb-bronze'];
            const medalIcon  = ['🥇', '🥈', '🥉'];
            list.innerHTML = rows.map((row, i) => `
                <div class="lb-row ${medalClass[i] || ''}">
                    <span class="lb-rank">${i < 3 ? medalIcon[i] : i + 1}</span>
                    <span class="lb-name">${row.display_name}</span>
                    <span class="lb-score">${row.score}</span>
                    <span class="lb-streak">${row.best_streak ?? '—'}</span>
                </div>
            `).join('');
        };
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

        const renderModalList = async (mode) => {
            const loadingTimer = setTimeout(() => {
                lbModalList.innerHTML = '<div class="lb-loading">Loading...</div>';
            }, 500);
            const rows = await getLeaderboard(mode);
            clearTimeout(loadingTimer);
            if (rows.length === 0) {
                lbModalList.innerHTML = '<div class="lb-loading">No scores yet.</div>';
                return;
            }
            const medalClass = ['lb-gold', 'lb-silver', 'lb-bronze'];
            const medalIcon  = ['🥇', '🥈', '🥉'];
            lbModalList.innerHTML = rows.map((row, i) => `
                <div class="lb-row ${medalClass[i] || ''}">
                    <span class="lb-rank">${i < 3 ? medalIcon[i] : i + 1}</span>
                    <span class="lb-name">${row.display_name}</span>
                    <span class="lb-score">${row.score}</span>
                    <span class="lb-streak">${row.best_streak ?? '—'}</span>
                </div>
            `).join('');
        };

        document.getElementById('btn-leaderboard-game').addEventListener('click', () => {
            lbModal.style.display = 'flex';
            renderModalList(lbModalMode);
        });

        document.getElementById('btn-lb-modal-close').addEventListener('click', () => {
            lbModal.style.display = 'none';
        });

        lbModal.addEventListener('click', (e) => {
            if (e.target === lbModal) lbModal.style.display = 'none';
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

        document.getElementById('btn-help').addEventListener('click', (e) => {
            e.stopPropagation();
            const bubble = document.getElementById('help-bubble');
            bubble.classList.toggle('visible');
        });

        document.addEventListener('click', () => {
            document.getElementById('help-bubble')?.classList.remove('visible');
        });

        requestAnimationFrame(() => {
            destroyGame = initGame(highScores);
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
