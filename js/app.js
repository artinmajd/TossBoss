import Home from './views/Home.js';
import Game from './views/Game.js';
import { initGame } from './engine.js';

let destroyGame = null;

function router() {
    const app = document.getElementById('app');
    const hash = window.location.hash || '#home';
    
    // Cleanup old view
    if (destroyGame && hash !== '#game') {
        destroyGame();
        destroyGame = null;
    }
    
    if (hash === '#home') {
        app.innerHTML = Home();
        document.getElementById('btn-play-game').addEventListener('click', () => {
            window.location.hash = '#game';
        });
    } else if (hash === '#game') {
        app.innerHTML = Game();
        document.getElementById('btn-home').addEventListener('click', () => {
            window.location.hash = '#home';
        });
        
        // Wait slightly for DOM to mount before initializing canvas
        requestAnimationFrame(() => {
            destroyGame = initGame();
        });
    }
}

window.addEventListener('hashchange', router);
window.addEventListener('DOMContentLoaded', router);
