import Home from './views/Home.js';
import Game from './views/Game.js';
import Auth from './views/Auth.js';
import { initGame } from './engine.js';
import { supabase, getHighScores } from './supabase.js';

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

    if (hash === '#home') {
        app.innerHTML = Home(session);
        document.getElementById('btn-play-game').addEventListener('click', () => {
            window.location.hash = '#game';
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

        const highScores = session ? await getHighScores() : { pingpong: 0, basketball: 0 };

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
