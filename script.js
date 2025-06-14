document.addEventListener('DOMContentLoaded', () => {
    // --- CONFIGURATION ---
    const ROUNDS_TO_WIN = 2; // Must hold the lead for this many consecutive rounds to win.

    // --- STATE MANAGEMENT ---
    let state = {
        games: [], players: [], scores: {}, currentGame: null, gameStartTime: null, gameHistory: [], isFinalRound: false, potentialWinner: null, consecutiveWinRounds: 0
    };

    // DOM ELEMENTS
    const screens = {
        setup: document.getElementById('setup-screen'), game: document.getElementById('game-screen'), history: document.getElementById('history-screen')
    };
    const modals = {
        winner: document.getElementById('winner-modal'), manageGames: document.getElementById('manage-games-modal'), endOfRound: document.getElementById('end-of-round-modal')
    };
    const gameSelect = document.getElementById('game-select');
    const playerNameInputsContainer = document.getElementById('player-inputs');
    const scoreboard = document.getElementById('scoreboard');
    const historyList = document.getElementById('history-list');

    // --- DATA PERSISTENCE ---
    function saveState() {
        try {
            localStorage.setItem('gameCounterState', JSON.stringify({ games: state.games, gameHistory: state.gameHistory }));
        } catch (e) { console.error("Could not save state to localStorage", e); }
    }

    function loadState() {
        try {
            const savedState = JSON.parse(localStorage.getItem('gameCounterState'));
            if (savedState) {
                state.games = savedState.games || [];
                state.gameHistory = savedState.gameHistory || [];
            }
        } catch (e) {
            console.error("Could not parse saved state, starting fresh.", e);
            state.games = []; state.gameHistory = [];
        }
        if (state.games.length === 0) {
            state.games.push({ name: 'Rummikub', winningScore: 100 });
            saveState();
        }
    }

    // --- UI & SCREEN LOGIC ---
    function showScreen(screenName) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        screens[screenName].classList.add('active');
    }

    function showModal(modalName, show = true) {
        if (modals[modalName]) {
            modals[modalName].classList.toggle('active', show);
        } else {
            console.error(`Modal with name "${modalName}" not found.`);
        }
    }

    function updateGameSelect() {
        gameSelect.innerHTML = state.games.map(g => `<option value="${g.name}">${g.name}</option>`).join('');
    }
    
    function updateManageGamesList() {
        const listEl = document.getElementById('saved-games-list');
        listEl.innerHTML = state.games.map((game, index) => `<div><span>${game.name} (${game.winningScore} points)</span><button data-index="${index}" class="delete-game-btn">X</button></div>`).join('');
    }

    function renderScoreboard() {
        const game = state.games.find(g => g.name === state.currentGame);
        if (!game) return;
        document.getElementById('game-title').textContent = state.currentGame;
        document.getElementById('winning-score-display').textContent = `First to ${game.winningScore} wins!`;
        scoreboard.innerHTML = state.players.map(player => `<div class="player-score-card" id="player-card-${player.replace(/\s+/g, '-')}"><div class="player-header"><span class="player-name">${player}</span><div class="current-score-container"><div class="current-score">${state.scores[player]}</div><div class="current-score-label">POINTS</div></div></div><div class="score-input-area"><input type="number" class="score-input" placeholder="Add points..."><button class="add-score-btn primary" data-player="${player}">Add</button></div></div>`).join('');
    }
    
    function renderHistory() {
        historyList.innerHTML = state.gameHistory.map((entry, index) => `<div class="history-entry"><div class="history-summary" data-index="${index}"><h3>${entry.game}</h3><p>Winner: ${entry.winner || 'Incomplete'} (${new Date(entry.startTime).toLocaleDateString()})</p><p>Duration: ${entry.duration}</p></div><div class="history-details" id="details-${index}"><p><strong>Players:</strong> ${entry.players.join(', ')}</p><p><strong>Point Log:</strong></p><ul>${entry.pointLog.map(log => `<li>${log.player} scored ${log.pointsAdded} (New Total: ${log.newScore})</li>`).join('')}</ul></div></div>`).join('');
    }

    // --- GAME LOGIC ---
    function startGame() {
        state.players = [...document.querySelectorAll('.player-name-input')].map(input => input.value.trim()).filter(name => name);
        if (state.players.length < 2) { alert('Please enter at least two player names.'); return; }
        state.currentGame = gameSelect.value;
        if (!state.currentGame) { alert('Please create a game first in "Manage Games"!'); return; }
        state.scores = {};
        state.players.forEach(p => state.scores[p] = 0);
        state.gameStartTime = new Date().getTime();
        state.isFinalRound = false; state.potentialWinner = null; state.consecutiveWinRounds = 0;
        state.gameHistory.unshift({ game: state.currentGame, players: state.players, startTime: state.gameStartTime, endTime: null, duration: 'In Progress', winner: null, pointLog: [] });
        renderScoreboard();
        showScreen('game');
    }

    function addScore(player, points) {
        if (isNaN(points) || points === 0) return;
        state.scores[player] += points;
        state.gameHistory[0].pointLog.push({ player, pointsAdded: points, newScore: state.scores[player], timestamp: new Date().getTime() });
        saveState();
        renderScoreboard();
        checkGameState();
    }

    function checkGameState() {
        if (state.isFinalRound) return;
        const game = state.games.find(g => g.name === state.currentGame);
        const someoneReachedWinningScore = state.players.some(p => state.scores[p] >= game.winningScore);
        if (someoneReachedWinningScore) {
            state.isFinalRound = true;
            showModal('endOfRound');
        }
    }

    function evaluateEndOfRound() {
        let highScore = -Infinity;
        state.players.forEach(p => { if (state.scores[p] > highScore) { highScore = state.scores[p]; } });
        const leaders = state.players.filter(p => state.scores[p] === highScore);
        if (leaders.length > 1) {
            state.potentialWinner = null; state.consecutiveWinRounds = 0;
            alert(`Tie for the lead at ${highScore} points! The game continues. Start the next round.`);
        } else {
            const soleLeader = leaders[0];
            if (state.potentialWinner === soleLeader) { state.consecutiveWinRounds++; } else { state.potentialWinner = soleLeader; state.consecutiveWinRounds = 1; }
            if (state.consecutiveWinRounds >= ROUNDS_TO_WIN) {
                declareWinner(soleLeader);
            } else {
                const roundsRemaining = ROUNDS_TO_WIN - state.consecutiveWinRounds;
                alert(`${soleLeader} has the lead with ${highScore} points! They must hold the lead for ${roundsRemaining} more round(s) to win. Start the next round.`);
            }
        }
    }

    function declareWinner(winner) {
        document.getElementById(`player-card-${winner.replace(/\s+/g, '-')}`).classList.add('winner');
        document.getElementById('winner-name').textContent = winner;
        const endTime = new Date().getTime();
        const durationMs = endTime - state.gameHistory[0].startTime;
        const minutes = Math.floor(durationMs / 60000);
        const seconds = ((durationMs % 60000) / 1000).toFixed(0);
        state.gameHistory[0].endTime = endTime; state.gameHistory[0].winner = winner; state.gameHistory[0].duration = `${minutes}m ${seconds}s`;
        saveState();
        showModal('winner');
    }
    
    function startNewGame() {
        showModal('winner', false);
        playerNameInputsContainer.innerHTML = `<input type="text" placeholder="Player 1 Name" class="player-name-input"><input type="text" placeholder="Player 2 Name" class="player-name-input">`;
        showScreen('setup');
    }

    // --- EVENT LISTENERS ---
    document.getElementById('add-player-field-btn').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'text'; input.placeholder = `Player ${playerNameInputsContainer.children.length + 1} Name`; input.className = 'player-name-input';
        playerNameInputsContainer.appendChild(input);
    });
    document.getElementById('start-game-btn').addEventListener('click', startGame);
    scoreboard.addEventListener('click', e => {
        if (e.target.classList.contains('add-score-btn')) {
            const player = e.target.dataset.player; const input = e.target.previousElementSibling; const points = parseInt(input.value, 10);
            addScore(player, points); input.value = '';
        }
    });
    document.getElementById('new-game-from-winner-btn').addEventListener('click', startNewGame);
    document.getElementById('new-game-from-game-btn').addEventListener('click', startNewGame);
    document.getElementById('manage-games-btn').addEventListener('click', () => { updateManageGamesList(); showModal('manageGames'); });
    document.getElementById('close-manage-games-btn').addEventListener('click', () => showModal('manageGames', false));
    document.getElementById('save-new-game-btn').addEventListener('click', () => {
        const nameInput = document.getElementById('new-game-name'); const scoreInput = document.getElementById('new-game-score');
        const name = nameInput.value.trim(); const score = parseInt(scoreInput.value, 10);
        if (name && score > 0) {
            state.games.push({ name, winningScore: score }); saveState(); updateGameSelect(); updateManageGamesList();
            nameInput.value = ''; scoreInput.value = '';
        } else { alert('Please enter a valid name and winning score.'); }
    });
    document.getElementById('saved-games-list').addEventListener('click', e => {
        if (e.target.classList.contains('delete-game-btn')) {
            const index = e.target.dataset.index;
            if (confirm(`Are you sure you want to delete ${state.games[index].name}?`)) {
                state.games.splice(index, 1); saveState(); updateGameSelect(); updateManageGamesList();
            }
        }
    });
    document.getElementById('view-history-btn').addEventListener('click', () => { renderHistory(); showScreen('history'); });
    document.getElementById('back-to-setup-btn').addEventListener('click', () => showScreen('setup'));
    historyList.addEventListener('click', e => {
        if (e.target.closest('.history-summary')) {
            const index = e.target.closest('.history-summary').dataset.index;
            const details = document.getElementById(`details-${index}`);
            details.style.display = details.style.display === 'block' ? 'none' : 'block';
        }
    });
    document.getElementById('round-finished-no').addEventListener('click', () => { showModal('endOfRound', false); });
    document.getElementById('round-finished-yes').addEventListener('click', () => {
        showModal('endOfRound', false); evaluateEndOfRound();
    });

    // --- INITIALIZATION ---
    loadState();
    updateGameSelect();
    showScreen('setup');

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('service-worker.js').then(reg => {
                console.log('Service worker registered.', reg);
            }).catch(err => {
                console.error('Service worker registration failed:', err);
            });
        });
    }
});