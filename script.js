document.addEventListener('DOMContentLoaded', () => {
    // --- STATE MANAGEMENT ---
    let state = {
        games: [],
        players: [],
        scores: {},
        currentGame: null,
        gameStartTime: null,
        gameHistory: [],
        endGamePromptShown: false,
        sessionStats: {}, // Tracks wins/losses per game for the session
        lastPlayers: [] // To remember the last set of players
    };

    // DOM ELEMENTS
    const screens = {
        setup: document.getElementById('setup-screen'),
        game: document.getElementById('game-screen'),
        history: document.getElementById('history-screen'),
        koth: document.getElementById('koth-screen')
    };
    const modals = {
        winner: document.getElementById('winner-modal'),
        manageGames: document.getElementById('manage-games-modal'),
        endOfRound: document.getElementById('end-of-round-modal')
    };
    const gameSelect = document.getElementById('game-select');
    const playerNameInputsContainer = document.getElementById('player-inputs');
    const scoreboard = document.getElementById('scoreboard');
    const historyList = document.getElementById('history-list');
    const kothResultsContent = document.getElementById('koth-results-content');

    // --- DATA PERSISTENCE ---
    function saveState() {
        try {
            localStorage.setItem('gameCounterState', JSON.stringify({
                games: state.games,
                gameHistory: state.gameHistory,
                sessionStats: state.sessionStats,
                lastPlayers: state.lastPlayers
            }));
        } catch (e) { console.error("Could not save state", e); }
    }

    function loadState() {
        try {
            const savedState = JSON.parse(localStorage.getItem('gameCounterState'));
            if (savedState) {
                state.games = savedState.games || [];
                state.gameHistory = savedState.gameHistory || [];
                state.sessionStats = savedState.sessionStats || {};
                state.lastPlayers = savedState.lastPlayers || [];
            }
        } catch (e) {
            Object.assign(state, { games: [], gameHistory: [], sessionStats: {}, lastPlayers: [] });
        }
        if (state.games.length === 0) {
            state.games.push({ name: 'Rummikub', winningScore: 100 });
            saveState();
        }
    }

    // --- UI & SCREEN LOGIC ---
    function showScreen(screenName) {
        Object.values(screens).forEach(s => s.classList.remove('active'));
        if (screens[screenName]) screens[screenName].classList.add('active');
    }

    function showModal(modalName, show = true) {
        if (modals[modalName]) modals[modalName].classList.toggle('active', show);
    }

    function updateGameSelect() {
        gameSelect.innerHTML = state.games.map(g => `<option value="${g.name}">${g.name}</option>`).join('');
    }

    function updateManageGamesList() {
        document.getElementById('saved-games-list').innerHTML = state.games.map((game, index) => `<div><span>${game.name} (${game.winningScore} points)</span><button data-index="${index}" class="delete-game-btn">X</button></div>`).join('');
    }

    function renderScoreboard() {
        const game = state.games.find(g => g.name === state.currentGame);
        if (!game) return;
        document.getElementById('game-title').textContent = state.currentGame;
        document.getElementById('winning-score-display').textContent = `First to ${game.winningScore} wins!`;
        scoreboard.innerHTML = state.players.map(player => `<div class="player-score-card" id="player-card-${player.replace(/\s+/g, '-')}"><div class="player-header"><span class="player-name">${player}</span><div class="current-score-container"><div class="current-score">${state.scores[player]}</div><div class="current-score-label">POINTS</div></div></div><div class="score-input-area"><input type="number" class="score-input" placeholder="Add points..."><button class="add-score-btn primary" data-player="${player}">Add</button></div></div>`).join('');
    }

    function renderHistory() {
        historyList.innerHTML = state.gameHistory.map(entry => `<div class="history-entry"><div class="history-summary"><h3>${entry.game}</h3><p>Winner: ${entry.winner || 'Incomplete'} (${new Date(entry.startTime).toLocaleDateString()})</p><p>Duration: ${entry.duration}</p></div></div>`).join('');
    }
    
    function populateLastPlayers() {
        if (state.lastPlayers && state.lastPlayers.length > 0) {
            playerNameInputsContainer.innerHTML = ''; // Clear default inputs
            state.lastPlayers.forEach(name => {
                const input = document.createElement('input');
                input.type = 'text';
                input.placeholder = 'Player Name';
                input.className = 'player-name-input';
                input.value = name;
                playerNameInputsContainer.appendChild(input);
            });
        }
    }

    // --- KING OF THE HILL LOGIC ---
    function renderKingOfTheHill() {
        const totalWins = {};
        for (const gameName in state.sessionStats) {
            const gameData = state.sessionStats[gameName];
            for (const playerName in gameData.wins) {
                totalWins[playerName] = (totalWins[playerName] || 0) + gameData.wins[playerName];
            }
        }

        let kingContent = '<h2>No games played in this session yet.</h2>';
        if (Object.keys(totalWins).length > 0) {
            const sortedTotalWins = Object.entries(totalWins).sort(([, a], [, b]) => b - a);
            const kingHighScore = sortedTotalWins[0][1];
            const kings = sortedTotalWins.filter(([, score]) => score === kingHighScore).map(([name]) => name);
            kingContent = `<div class="koth-winner-card king"><h2>👑 King of the Session</h2><p>${kings.join(' & ')}</p><span>with ${kingHighScore} total win(s)</span></div>`;
        }

        let dukeContent = '';
        for (const gameName in state.sessionStats) {
            const gameData = state.sessionStats[gameName];
            // Create a combined list of all players for this game
            const allPlayersForGame = new Set([...Object.keys(gameData.wins), ...Object.keys(gameData.losses)]);
            const sortedGameWins = Array.from(allPlayersForGame).sort((a, b) => (gameData.wins[b] || 0) - (gameData.wins[a] || 0));

            if (sortedGameWins.length > 0) {
                const dukeHighScore = gameData.wins[sortedGameWins[0]] || 0;
                const dukes = sortedGameWins.filter(player => (gameData.wins[player] || 0) === dukeHighScore);
                
                dukeContent += `<div class="card"><div class="koth-winner-card duke"><h2>Duke of ${gameName}</h2><p>${dukes.join(' & ')}</p><span>with ${dukeHighScore} win(s)</span></div><ul class="koth-player-stats">${sortedGameWins.map(playerName => `<li><span>${playerName}</span><span class="record">${gameData.wins[playerName] || 0}W - ${gameData.losses[playerName] || 0}L</span></li>`).join('')}</ul></div>`;
            }
        }
        kothResultsContent.innerHTML = kingContent + dukeContent;
    }

    // --- GAME LOGIC ---
    function startNewSession() {
        if (confirm('Are you sure you want to start a new session? All King of the Hill stats will be reset.')) {
            state.sessionStats = {};
            saveState();
            kothResultsContent.innerHTML = '';
            alert('New session started. Stats have been reset.');
        }
    }

    function ensureGameObject(gameName) {
        if (!state.sessionStats[gameName]) {
            state.sessionStats[gameName] = { wins: {}, losses: {} };
        }
    }
    
    function startGame() {
        state.players = [...document.querySelectorAll('.player-name-input')].map(input => input.value.trim()).filter(name => name);
        if (state.players.length < 1) { alert('Please enter at least one player name.'); return; }
        
        state.lastPlayers = [...state.players];
        state.currentGame = gameSelect.value;
        if (!state.currentGame) { alert('Please create a game first!'); return; }
        state.scores = {};
        state.players.forEach(p => state.scores[p] = 0);
        state.gameStartTime = new Date().getTime();
        state.endGamePromptShown = false;
        state.gameHistory.unshift({ game: state.currentGame, players: state.players, startTime: state.gameStartTime, endTime: null, duration: 'In Progress', winner: null, pointLog: [] });
        
        saveState();
        renderScoreboard();
        showScreen('game');
    }

    function addScore(player, points) {
        if (isNaN(points)) return;
        state.scores[player] += points;
        state.gameHistory[0].pointLog.push({ player, pointsAdded: points, newScore: state.scores[player] });
        saveState(); // Correctly save state after score change
        renderScoreboard();
        checkAndPromptEndGame();
    }
    
    function checkAndPromptEndGame() {
        if (state.endGamePromptShown) return;
        const game = state.games.find(g => g.name === state.currentGame);
        const someoneReachedWinningScore = state.players.some(p => state.scores[p] >= game.winningScore);
        if (someoneReachedWinningScore) {
            state.endGamePromptShown = true;
            showModal('endOfRound');
        }
    }

    function declareWinner() {
        if (!state.gameStartTime) return;
        let winner = null;
        let highScore = -Infinity;
        state.players.forEach(p => { if (state.scores[p] > highScore) { highScore = state.scores[p]; winner = p; } });
        if (!winner) { winner = state.players[0] || 'N/A'; }

        const gameName = state.currentGame;
        ensureGameObject(gameName);
        state.sessionStats[gameName].wins[winner] = (state.sessionStats[gameName].wins[winner] || 0) + 1;
        state.players.forEach(player => {
            if (player !== winner) {
                state.sessionStats[gameName].losses[player] = (state.sessionStats[gameName].losses[player] || 0) + 1;
            }
        });
        
        document.getElementById('winner-name').textContent = winner;
        
        const endTime = new Date().getTime();
        const durationMs = endTime - state.gameStartTime;
        const minutes = Math.floor(durationMs / 60000);
        const seconds = ((durationMs % 60000) / 1000).toFixed(0);
        
        if (state.gameHistory[0] && state.gameHistory[0].duration === 'In Progress') {
            state.gameHistory[0].endTime = endTime;
            state.gameHistory[0].winner = winner;
            state.gameHistory[0].duration = `${minutes}m ${seconds}s`;
        }
        saveState();
        showModal('winner');
    }
    
    function startNewGame() {
        showModal('winner', false);
        // We don't call populateLastPlayers here, it's done on load.
        // The inputs will retain their values until a new game starts with different names.
        showScreen('setup');
    }

    // --- EVENT LISTENERS ---
    document.getElementById('view-koth-btn').addEventListener('click', () => {
        showScreen('koth');
    });
    document.getElementById('declare-king-btn').addEventListener('click', renderKingOfTheHill);
    document.getElementById('new-session-btn').addEventListener('click', startNewSession);
    document.getElementById('back-to-setup-from-koth-btn').addEventListener('click', () => showScreen('setup'));

    document.getElementById('add-player-field-btn').addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'text'; input.placeholder = `Player Name`; input.className = 'player-name-input';
        playerNameInputsContainer.appendChild(input);
    });
    document.getElementById('start-game-btn').addEventListener('click', startGame);
    scoreboard.addEventListener('click', e => {
        if (e.target.classList.contains('add-score-btn')) {
            const player = e.target.dataset.player; const input = e.target.previousElementSibling; const points = parseInt(input.value, 10);
            addScore(player, points); input.value = '';
        }
    });
    document.getElementById('stop-game-btn').addEventListener('click', () => { if (confirm('Are you sure you want to end the game?')) declareWinner(); });
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
        } else { alert('Please enter a valid name and score.'); }
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
    document.getElementById('round-finished-no').addEventListener('click', () => showModal('endOfRound', false));
    document.getElementById('round-finished-yes').addEventListener('click', () => { showModal('endOfRound', false); declareWinner(); });

    // --- INITIALIZATION ---
    loadState();
    updateGameSelect();
    populateLastPlayers(); // Populate names on first load
    showScreen('setup');

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('service-worker.js').then(reg => console.log('SW registered.', reg)).catch(err => console.error('SW registration failed:', err));
        });
    }
});