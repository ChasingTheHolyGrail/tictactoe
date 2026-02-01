// Sound Manager Class
class SoundManager {
    constructor() {
        this.soundsEnabled = this.loadSoundSettings();
        this.volume = this.loadVolume();
        this.audioContext = null;
        this.initAudioContext();
    }
    
    initAudioContext() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }
    
    playTone(frequency, duration, type = 'sine') {
        if (!this.soundsEnabled || !this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = type;
        
        gainNode.gain.setValueAtTime(0, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(this.volume, this.audioContext.currentTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }
    
    playMove() {
        this.playTone(440, 0.1, 'sine');
    }
    
    playWin() {
        // Victory fanfare
        const notes = [523.25, 659.25, 783.99, 1046.50]; // C, E, G, C
        notes.forEach((freq, i) => {
            setTimeout(() => {
                this.playTone(freq, 0.2, 'sine');
            }, i * 100);
        });
    }
    
    playLose() {
        // Sad sound
        const notes = [392, 349.23, 311.13]; // G, F, Eb descending
        notes.forEach((freq, i) => {
            setTimeout(() => {
                this.playTone(freq, 0.3, 'sine');
            }, i * 150);
        });
    }
    
    playDraw() {
        this.playTone(330, 0.3, 'sine');
    }
    
    playError() {
        this.playTone(200, 0.15, 'square');
    }
    
    playClick() {
        this.playTone(800, 0.05, 'sine');
    }
    
    toggleSounds() {
        this.soundsEnabled = !this.soundsEnabled;
        this.saveSoundSettings();
        if (this.soundsEnabled) {
            this.playClick();
        }
    }
    
    setVolume(vol) {
        this.volume = Math.max(0, Math.min(1, vol));
        this.saveVolume();
    }
    
    loadSoundSettings() {
        try {
            const saved = localStorage.getItem('ticTacToeSounds');
            return saved !== 'false';
        } catch (e) {
            return true;
        }
    }
    
    saveSoundSettings() {
        try {
            localStorage.setItem('ticTacToeSounds', this.soundsEnabled);
        } catch (e) {
            console.error('Error saving sound settings:', e);
        }
    }
    
    loadVolume() {
        try {
            const saved = localStorage.getItem('ticTacToeVolume');
            return saved ? parseFloat(saved) : 0.5;
        } catch (e) {
            return 0.5;
        }
    }
    
    saveVolume() {
        try {
            localStorage.setItem('ticTacToeVolume', this.volume);
        } catch (e) {
            console.error('Error saving volume:', e);
        }
    }
}

class TicTacToe {
    constructor() {
        this.board = Array(9).fill('');
        this.currentPlayer = 'X'; // Player is always X
        this.gameActive = true;
        this.winningLine = null;
        this.moveHistory = [];
        this.moveCount = 0;
        this.isPlayerTurn = true; // Track if it's player's turn
        this.aiPlayer = 'O'; // AI is always O
        this.aiDifficulty = this.loadDifficulty(); // Load AI difficulty level
        this.soundManager = new SoundManager(); // Initialize sound manager
        this.gameHistory = this.loadGameHistory(); // Load saved game history
        this.isReplayMode = false;
        this.replayIndex = 0;
        this.replayGame = null;
        
        // Load scores from localStorage or initialize
        this.scores = this.loadScores();
        this.stats = this.loadStats();
        this.darkMode = this.loadTheme();
        
        this.winningConditions = [
            [0, 1, 2],
            [3, 4, 5],
            [6, 7, 8],
            [0, 3, 6],
            [1, 4, 7],
            [2, 5, 8],
            [0, 4, 8],
            [2, 4, 6]
        ];
        
        this.init();
    }
    
    init() {
        try {
            this.cells = document.querySelectorAll('.cell');
            this.playerIndicator = document.getElementById('player-indicator');
            this.message = document.getElementById('message');
            this.resetBtn = document.getElementById('reset-btn');
            this.resetScoreBtn = document.getElementById('reset-score-btn');
            
            if (!this.cells || !this.playerIndicator || !this.message) {
                throw new Error('Required DOM elements not found');
            }
            
            // Use event delegation for better performance
            const gameBoard = document.getElementById('game-board');
            if (gameBoard) {
                gameBoard.addEventListener('click', (e) => {
                    if (e.target.classList.contains('cell')) {
                        this.handleCellClick(e);
                    }
                });
                
                // Touch support with passive listeners
                gameBoard.addEventListener('touchend', (e) => {
                    if (e.target.classList.contains('cell')) {
                        e.preventDefault();
                        this.handleCellClick(e);
                    }
                }, { passive: false });
            }
            
            this.cells.forEach((cell, index) => {
                cell.setAttribute('role', 'gridcell');
                cell.setAttribute('aria-label', `Zelle ${index + 1}, leer`);
                cell.setAttribute('tabindex', this.isPlayerTurn ? '0' : '-1');
                cell.setAttribute('aria-disabled', 'false');
                cell.addEventListener('keydown', (e) => {
                    if ((e.key === 'Enter' || e.key === ' ') && this.isPlayerTurn) {
                        e.preventDefault();
                        this.handleCellClick(e);
                    }
                });
            });
            
            this.undoBtn = document.getElementById('undo-btn');
            this.moveCounter = document.getElementById('move-counter');
            this.themeToggle = document.getElementById('theme-toggle');
            this.soundToggle = document.getElementById('sound-toggle');
            this.volumeSlider = document.getElementById('volume-slider');
            this.volumeValue = document.getElementById('volume-value');
            this.volumeControl = document.getElementById('volume-control');
            this.helpBtn = document.getElementById('help-btn');
            this.helpModal = document.getElementById('help-modal');
            this.closeModal = document.querySelector('.close');
            this.difficultySelect = document.getElementById('difficulty-select');
            this.historyBtn = document.getElementById('history-btn');
            this.replayControls = document.getElementById('replay-controls');
            this.replayPrevBtn = document.getElementById('replay-prev');
            this.replayPlayPauseBtn = document.getElementById('replay-play-pause');
            this.replayNextBtn = document.getElementById('replay-next');
            this.replayCloseBtn = document.getElementById('replay-close');
            this.replayInterval = null;
            
            this.resetBtn.addEventListener('click', () => this.resetGame());
            this.resetScoreBtn.addEventListener('click', () => this.resetScore());
            if (this.undoBtn) {
                this.undoBtn.addEventListener('click', () => this.undoMove());
            }
            if (this.difficultySelect) {
                this.difficultySelect.value = this.aiDifficulty;
                this.difficultySelect.addEventListener('change', (e) => {
                    if (!this.gameActive || this.moveCount === 0) {
                        this.aiDifficulty = e.target.value;
                        this.saveDifficulty();
                    } else {
                        // Revert selection if game is in progress
                        e.target.value = this.aiDifficulty;
                        this.message.textContent = 'Schwierigkeit kann nur vor Spielbeginn geändert werden!';
                        setTimeout(() => {
                            if (this.message) this.message.textContent = '';
                        }, 2000);
                    }
                });
            }
            if (this.themeToggle) {
                this.themeToggle.addEventListener('click', () => this.toggleTheme());
            }
            if (this.soundToggle) {
                this.soundToggle.addEventListener('click', () => this.toggleSounds());
                this.updateSoundButton();
            }
            if (this.volumeSlider) {
                this.volumeSlider.value = this.soundManager.volume * 100;
                if (this.volumeValue) {
                    this.volumeValue.textContent = Math.round(this.soundManager.volume * 100) + '%';
                }
                this.volumeSlider.addEventListener('input', (e) => {
                    const vol = e.target.value / 100;
                    this.soundManager.setVolume(vol);
                    if (this.volumeValue) {
                        this.volumeValue.textContent = e.target.value + '%';
                    }
                    this.soundManager.playClick();
                });
            }
            if (this.helpBtn) {
                this.helpBtn.addEventListener('click', () => this.showHelp());
            }
            if (this.closeModal) {
                this.closeModal.addEventListener('click', () => this.hideHelp());
            }
            if (this.helpModal) {
                this.helpModal.addEventListener('click', (e) => {
                    if (e.target === this.helpModal) {
                        this.hideHelp();
                    }
                });
            }
            if (this.historyBtn) {
                this.historyBtn.addEventListener('click', () => this.showGameHistory());
            }
            if (this.replayPrevBtn) {
                this.replayPrevBtn.addEventListener('click', () => this.replayPreviousMove());
            }
            if (this.replayPlayPauseBtn) {
                this.replayPlayPauseBtn.addEventListener('click', () => this.toggleReplay());
            }
            if (this.replayNextBtn) {
                this.replayNextBtn.addEventListener('click', () => this.replayNextMove());
            }
            if (this.replayCloseBtn) {
                this.replayCloseBtn.addEventListener('click', () => this.closeReplay());
            }
            
            // Keyboard shortcuts
            document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
            
            // Apply saved theme
            this.applyTheme();
            
            this.updateDisplay();
            this.updateScore();
            this.updateMoveCounter();
        } catch (error) {
            console.error('Initialization error:', error);
            this.message.textContent = 'Fehler beim Laden des Spiels';
        }
    }
    
    handleKeyboardShortcuts(e) {
        // Prevent shortcuts when typing in inputs
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            return;
        }
        
        // Ctrl+Z or Cmd+Z for undo
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            this.undoMove();
        }
        // R for reset
        else if (e.key === 'r' || e.key === 'R') {
            e.preventDefault();
            this.resetGame();
        }
        // H for help
        else if (e.key === 'h' || e.key === 'H') {
            e.preventDefault();
            this.showHelp();
        }
        // Escape to close modal
        else if (e.key === 'Escape' && this.helpModal && this.helpModal.style.display === 'block') {
            e.preventDefault();
            this.hideHelp();
        }
        // Number keys 1-9 for quick cell selection (only during player's turn)
        else if (e.key >= '1' && e.key <= '9' && this.gameActive && this.isPlayerTurn) {
            e.preventDefault();
            const index = parseInt(e.key) - 1;
            if (index >= 0 && index <= 8 && this.cells[index]) {
                const fakeEvent = { target: this.cells[index] };
                this.handleCellClick(fakeEvent);
            }
        }
    }
    
    handleCellClick(e) {
        const cell = e.target;
        if (!cell || !cell.classList.contains('cell')) {
            return;
        }
        
        // Only allow player (X) to make moves
        if (!this.isPlayerTurn || this.currentPlayer !== 'X') {
            cell.classList.add('invalid-move');
            setTimeout(() => {
                cell.classList.remove('invalid-move');
            }, 300);
            return;
        }
        
        const index = parseInt(cell.getAttribute('data-index'));
        
        if (isNaN(index) || index < 0 || index > 8) {
            console.error('Invalid cell index:', index);
            return;
        }
        
        if (this.board[index] !== '' || !this.gameActive) {
            // Visual feedback for invalid move
            cell.classList.add('invalid-move');
            this.soundManager.playError();
            setTimeout(() => {
                cell.classList.remove('invalid-move');
            }, 300);
            return;
        }
        
        // Make player move
        this.makeMove(index, 'X', cell);
        this.soundManager.playMove();
        
        // Check for game end
        if (!this.checkGameEnd()) {
            // If game continues, AI makes move
            this.isPlayerTurn = false;
            this.updateDisplay();
            this.disableBoard();
            setTimeout(() => {
                this.makeAIMove();
            }, 500); // Small delay for better UX
        }
    }
    
    makeMove(index, player, cellElement = null) {
        // Validate move
        if (index < 0 || index > 8 || this.board[index] !== '' || !this.gameActive) {
            console.error('Invalid move attempted:', { index, player, cellOccupied: this.board[index] });
            return false;
        }
        
        // Validate player
        if (player !== 'X' && player !== 'O') {
            console.error('Invalid player:', player);
            return false;
        }
        
        // Save move to history
        this.moveHistory.push({
            index: index,
            player: player,
            board: [...this.board]
        });
        
        this.board[index] = player;
        
        // Update UI if cell element provided
        if (cellElement) {
            cellElement.textContent = player;
            cellElement.classList.add('occupied', player.toLowerCase());
            const playerName = player === 'X' ? 'Du' : 'Computer';
            cellElement.setAttribute('aria-label', `Zelle ${index + 1}, ${player} von ${playerName}`);
            cellElement.setAttribute('tabindex', '-1');
            cellElement.setAttribute('aria-disabled', 'true');
            cellElement.classList.add('animate-mark');
        } else {
            // Update UI for AI moves
            const cell = this.cells[index];
            if (cell) {
                cell.textContent = player;
                cell.classList.add('occupied', player.toLowerCase());
                cell.setAttribute('aria-label', `Zelle ${index + 1}, ${player} von Computer`);
                cell.setAttribute('tabindex', '-1');
                cell.setAttribute('aria-disabled', 'true');
                cell.classList.add('animate-mark');
            }
        }
        
        this.moveCount++;
        this.updateMoveCounter();
        this.updateUndoButton();
        return true;
    }
    
    checkGameEnd() {
        // Check for winner first
        const winnerResult = this.checkWinner();
        if (winnerResult && winnerResult.length === 3) {
            const winner = this.board[winnerResult[0]];
            // Validate winner is valid
            if (winner === 'X' || winner === 'O') {
                this.gameActive = false;
                this.isPlayerTurn = false;
                this.winningLine = winnerResult;
                this.highlightWinningLine();
                this.celebrateWin();
                if (winner === 'X') {
                    this.message.textContent = 'Du hast gewonnen!';
                    this.soundManager.playWin();
                } else {
                    this.message.textContent = 'Der Computer hat gewonnen!';
                    this.soundManager.playLose();
                }
                this.message.classList.add('win');
                this.scores[winner] = (this.scores[winner] || 0) + 1;
                this.stats.gamesPlayed = (this.stats.gamesPlayed || 0) + 1;
                if (!this.stats.wins) this.stats.wins = { X: 0, O: 0 };
                this.stats.wins[winner] = (this.stats.wins[winner] || 0) + 1;
                this.saveScores();
                this.saveStats();
                this.updateScore();
                this.finalizeGameHistory(winner);
                return true;
            }
        }
        
        // Check for draw (board full and no winner)
        if (this.checkDraw() && !winnerResult) {
            this.gameActive = false;
            this.isPlayerTurn = false;
            this.message.textContent = 'Unentschieden!';
            this.message.classList.add('draw');
            this.soundManager.playDraw();
            this.scores.draw = (this.scores.draw || 0) + 1;
            this.stats.gamesPlayed = (this.stats.gamesPlayed || 0) + 1;
            this.stats.draws = (this.stats.draws || 0) + 1;
            this.saveScores();
            this.saveStats();
            this.updateScore();
            this.finalizeGameHistory('draw');
            return true;
        }
        
        return false;
    }
    
    saveMoveToHistory(index, player) {
        if (!this.currentGameHistory) {
            this.currentGameHistory = {
                moves: [],
                difficulty: this.aiDifficulty,
                startTime: Date.now(),
                result: null
            };
        }
        this.currentGameHistory.moves.push({
            index: index,
            player: player,
            moveNumber: this.moveCount
        });
    }
    
    finalizeGameHistory(result) {
        if (this.currentGameHistory) {
            this.currentGameHistory.result = result;
            this.currentGameHistory.endTime = Date.now();
            this.currentGameHistory.duration = this.currentGameHistory.endTime - this.currentGameHistory.startTime;
            this.currentGameHistory.board = [...this.board];
            this.currentGameHistory.winningLine = this.winningLine;
            
            // Add to game history (keep last 50 games)
            this.gameHistory.unshift(this.currentGameHistory);
            if (this.gameHistory.length > 50) {
                this.gameHistory = this.gameHistory.slice(0, 50);
            }
            
            this.saveGameHistory();
            this.currentGameHistory = null;
        }
    }
    
    makeAIMove() {
        if (!this.gameActive || this.isPlayerTurn) {
            this.enableBoard();
            return;
        }
        
        // Safety check: ensure game is still active and board has space
        if (this.checkGameEnd() || this.isBoardFull(this.board)) {
            this.enableBoard();
            return;
        }
        
        const bestMove = this.getBestMove();
        if (bestMove !== -1 && bestMove >= 0 && bestMove < 9 && this.board[bestMove] === '') {
            this.makeMove(bestMove, this.aiPlayer);
            this.soundManager.playMove();
            
            // Save move to game history
            this.saveMoveToHistory(bestMove, this.aiPlayer);
            
            // Check for game end
            if (!this.checkGameEnd()) {
                // Game continues, player's turn
                this.isPlayerTurn = true;
                this.currentPlayer = 'X';
                this.enableBoard();
                this.updateDisplay();
            } else {
                // Game ended, ensure board is enabled for visual consistency
                this.enableBoard();
            }
        } else {
            // Fallback: if no valid move found, enable board and end turn
            console.warn('AI could not find a valid move');
            this.isPlayerTurn = true;
            this.currentPlayer = 'X';
            this.enableBoard();
            this.updateDisplay();
        }
    }
    
    getBestMove() {
        // Safety check: ensure there are available moves
        const availableMoves = [];
        for (let i = 0; i < 9; i++) {
            if (this.board[i] === '') {
                availableMoves.push(i);
            }
        }
        
        if (availableMoves.length === 0) {
            return -1; // No moves available
        }
        
        // Different AI strategies based on difficulty
        switch (this.aiDifficulty) {
            case 'easy':
                return this.getEasyMove(availableMoves);
            case 'medium':
                return this.getMediumMove(availableMoves);
            case 'hard':
            default:
                return this.getHardMove(availableMoves);
        }
    }
    
    getEasyMove(availableMoves) {
        // Easy: Random moves with occasional smart moves (30% chance of best move)
        if (Math.random() < 0.3) {
            // Sometimes make a good move
            return this.getMediumMove(availableMoves);
        }
        // Most of the time, make a random move
        return availableMoves[Math.floor(Math.random() * availableMoves.length)];
    }
    
    getMediumMove(availableMoves) {
        // Medium: Try to win or block, otherwise make strategic moves
        
        // 1. Check if AI can win in one move
        for (const move of availableMoves) {
            this.board[move] = this.aiPlayer;
            if (this.evaluateBoard(this.board) === this.aiPlayer) {
                this.board[move] = '';
                return move;
            }
            this.board[move] = '';
        }
        
        // 2. Check if player can win next move - block it
        for (const move of availableMoves) {
            this.board[move] = 'X';
            if (this.evaluateBoard(this.board) === 'X') {
                this.board[move] = '';
                return move;
            }
            this.board[move] = '';
        }
        
        // 3. Take center if available
        if (availableMoves.includes(4)) {
            return 4;
        }
        
        // 4. Take a corner if available
        const corners = [0, 2, 6, 8];
        const availableCorners = corners.filter(c => availableMoves.includes(c));
        if (availableCorners.length > 0) {
            return availableCorners[Math.floor(Math.random() * availableCorners.length)];
        }
        
        // 5. Take any edge
        const edges = [1, 3, 5, 7];
        const availableEdges = edges.filter(e => availableMoves.includes(e));
        if (availableEdges.length > 0) {
            return availableEdges[Math.floor(Math.random() * availableEdges.length)];
        }
        
        // Fallback: random move
        return availableMoves[Math.floor(Math.random() * availableMoves.length)];
    }
    
    getHardMove(availableMoves) {
        // Hard: Use minimax algorithm (unbeatable)
        let bestScore = -Infinity;
        let bestMove = -1;
        
        for (let i = 0; i < 9; i++) {
            if (this.board[i] === '') {
                this.board[i] = this.aiPlayer;
                let score = this.minimax(this.board, 0, false);
                this.board[i] = '';
                
                if (score > bestScore) {
                    bestScore = score;
                    bestMove = i;
                }
            }
        }
        
        // Fallback: if no best move found, pick first available
        if (bestMove === -1 && availableMoves.length > 0) {
            return availableMoves[0];
        }
        
        return bestMove;
    }
    
    minimax(board, depth, isMaximizing) {
        // Check for terminal states
        const winner = this.evaluateBoard(board);
        if (winner === this.aiPlayer) {
            return 10 - depth; // Prefer faster wins
        } else if (winner === 'X') {
            return depth - 10; // Prefer slower losses
        } else if (this.isBoardFull(board)) {
            return 0; // Draw
        }
        
        if (isMaximizing) {
            let bestScore = -Infinity;
            for (let i = 0; i < 9; i++) {
                if (board[i] === '') {
                    board[i] = this.aiPlayer;
                    let score = this.minimax(board, depth + 1, false);
                    board[i] = '';
                    bestScore = Math.max(score, bestScore);
                    // Alpha-beta pruning optimization (though minimal impact on 3x3)
                    if (bestScore >= 10) break;
                }
            }
            return bestScore;
        } else {
            let bestScore = Infinity;
            for (let i = 0; i < 9; i++) {
                if (board[i] === '') {
                    board[i] = 'X';
                    let score = this.minimax(board, depth + 1, true);
                    board[i] = '';
                    bestScore = Math.min(score, bestScore);
                    // Alpha-beta pruning optimization
                    if (bestScore <= -10) break;
                }
            }
            return bestScore;
        }
    }
    
    evaluateBoard(board) {
        for (const condition of this.winningConditions) {
            const [a, b, c] = condition;
            if (board[a] !== '' &&
                board[a] === board[b] &&
                board[a] === board[c]) {
                return board[a];
            }
        }
        return null;
    }
    
    isBoardFull(board) {
        return board.every(cell => cell !== '');
    }
    
    disableBoard() {
        // Add visual feedback that board is disabled
        const gameBoard = document.getElementById('game-board');
        if (gameBoard) {
            gameBoard.classList.add('ai-thinking');
            gameBoard.setAttribute('aria-busy', 'true');
        }
        this.cells.forEach(cell => {
            cell.style.pointerEvents = 'none';
            cell.setAttribute('tabindex', '-1');
            cell.setAttribute('aria-disabled', 'true');
            if (cell.textContent === '') {
                cell.style.opacity = '0.4';
            } else {
                cell.style.opacity = '0.7';
            }
        });
        
        // Update message
        if (this.message) {
            this.message.textContent = 'Computer ist am Zug...';
            this.message.classList.remove('win', 'draw');
        }
    }
    
    enableBoard() {
        // Re-enable board for player
        const gameBoard = document.getElementById('game-board');
        if (gameBoard) {
            gameBoard.classList.remove('ai-thinking');
            gameBoard.setAttribute('aria-busy', 'false');
        }
        this.cells.forEach((cell, index) => {
            if (cell.textContent === '') {
                cell.style.pointerEvents = 'auto';
                cell.style.opacity = '1';
                cell.setAttribute('tabindex', this.isPlayerTurn ? '0' : '-1');
                cell.setAttribute('aria-disabled', 'false');
            } else {
                cell.style.opacity = '1';
                cell.setAttribute('tabindex', '-1');
                cell.setAttribute('aria-disabled', 'true');
            }
        });
        
        // Clear thinking message if game is still active
        if (this.message && this.gameActive && !this.message.classList.contains('win') && !this.message.classList.contains('draw')) {
            this.message.textContent = '';
        }
    }
    
    checkWinner() {
        for (const condition of this.winningConditions) {
            const [a, b, c] = condition;
            if (this.board[a] !== '' &&
                this.board[a] === this.board[b] &&
                this.board[a] === this.board[c]) {
                return condition; // Return winning line indices
            }
        }
        return null;
    }
    
    highlightWinningLine() {
        if (!this.winningLine) return;
        
        this.winningLine.forEach(index => {
            const cell = this.cells[index];
            if (cell) {
                cell.classList.add('winning-cell');
            }
        });
    }
    
    checkDraw() {
        return this.board.every(cell => cell !== '');
    }
    
    resetGame() {
        // Finalize current game history if exists
        if (this.currentGameHistory && this.moveCount > 0) {
            this.finalizeGameHistory('abandoned');
        }
        this.currentGameHistory = null;
        
        this.board = Array(9).fill('');
        this.currentPlayer = 'X';
        this.gameActive = true;
        this.isPlayerTurn = true;
        this.winningLine = null;
        this.moveHistory = [];
        this.moveCount = 0;
        this.message.textContent = '';
        this.message.classList.remove('win', 'draw');
        
        this.cells.forEach((cell, index) => {
            cell.textContent = '';
            cell.classList.remove('occupied', 'x', 'o', 'winning-cell', 'animate-mark');
            cell.setAttribute('aria-label', `Zelle ${index + 1}, leer`);
            cell.setAttribute('tabindex', '0');
            cell.setAttribute('aria-disabled', 'false');
            cell.style.pointerEvents = 'auto';
            cell.style.opacity = '1';
        });
        
        this.enableBoard();
        this.updateDisplay();
        this.updateMoveCounter();
        this.updateUndoButton();
    }
    
    undoMove() {
        if (this.moveHistory.length === 0 || !this.gameActive || !this.isPlayerTurn) {
            return;
        }
        
        // Remove last move (player's move)
        if (this.moveHistory.length > 0) {
            const lastMove = this.moveHistory.pop();
            this.board[lastMove.index] = '';
            const cell = this.cells[lastMove.index];
            cell.textContent = '';
            cell.classList.remove('occupied', 'x', 'o', 'animate-mark');
            cell.setAttribute('aria-label', `Zelle ${lastMove.index + 1}, leer`);
            this.moveCount--;
        }
        
        // Remove AI move if exists
        if (this.moveHistory.length > 0) {
            const aiMove = this.moveHistory.pop();
            this.board[aiMove.index] = '';
            const cell = this.cells[aiMove.index];
            cell.textContent = '';
            cell.classList.remove('occupied', 'x', 'o', 'animate-mark');
            cell.setAttribute('aria-label', `Zelle ${aiMove.index + 1}, leer`);
            this.moveCount--;
        }
        
        // Ensure it's player's turn
        this.currentPlayer = 'X';
        this.isPlayerTurn = true;
        this.updateDisplay();
        this.updateMoveCounter();
        this.updateUndoButton();
        
        // Clear any win state
        if (this.winningLine) {
            this.winningLine.forEach(index => {
                const winCell = this.cells[index];
                if (winCell) {
                    winCell.classList.remove('winning-cell');
                }
            });
            this.winningLine = null;
        }
        
        this.message.textContent = '';
        this.message.classList.remove('win', 'draw');
    }
    
    celebrateWin() {
        // Simple celebration effect
        const container = document.querySelector('.container');
        if (container) {
            container.classList.add('celebrate');
            setTimeout(() => {
                container.classList.remove('celebrate');
            }, 1000);
        }
    }
    
    updateMoveCounter() {
        if (this.moveCounter) {
            this.moveCounter.textContent = `Züge: ${this.moveCount}`;
        }
    }
    
    updateUndoButton() {
        if (this.undoBtn) {
            this.undoBtn.disabled = this.moveHistory.length === 0 || !this.gameActive || !this.isPlayerTurn;
        }
    }
    
    resetScore() {
        this.scores = { X: 0, O: 0, draw: 0 };
        this.saveScores();
        this.updateScore();
    }
    
    updateDisplay() {
        if (this.playerIndicator) {
            if (this.isPlayerTurn && this.gameActive) {
                this.playerIndicator.textContent = 'X (Du)';
                this.playerIndicator.style.color = '#e74c3c';
            } else if (!this.isPlayerTurn && this.gameActive) {
                this.playerIndicator.textContent = 'O (Computer denkt...)';
                this.playerIndicator.style.color = '#3498db';
            } else if (!this.gameActive) {
                // Game ended
                if (this.winningLine) {
                    const winner = this.board[this.winningLine[0]];
                    if (winner === 'X') {
                        this.playerIndicator.textContent = 'X (Du) - Gewinner!';
                        this.playerIndicator.style.color = '#2ecc71';
                    } else {
                        this.playerIndicator.textContent = 'O (Computer) - Gewinner!';
                        this.playerIndicator.style.color = '#e74c3c';
                    }
                } else {
                    this.playerIndicator.textContent = 'Unentschieden';
                    this.playerIndicator.style.color = '#f39c12';
                }
            } else {
                this.playerIndicator.textContent = this.currentPlayer;
            }
        }
    }
    
    updateScore() {
        try {
            const scoreX = document.getElementById('score-x');
            const scoreO = document.getElementById('score-o');
            const scoreDraw = document.getElementById('score-draw');
            
            if (scoreX) scoreX.textContent = this.scores.X;
            if (scoreO) scoreO.textContent = this.scores.O;
            if (scoreDraw) scoreDraw.textContent = this.scores.draw;
        } catch (error) {
            console.error('Error updating score:', error);
        }
    }
    
    loadScores() {
        try {
            const saved = localStorage.getItem('ticTacToeScores');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            console.error('Error loading scores:', error);
        }
        return { X: 0, O: 0, draw: 0 };
    }
    
    saveScores() {
        try {
            localStorage.setItem('ticTacToeScores', JSON.stringify(this.scores));
        } catch (error) {
            console.error('Error saving scores:', error);
        }
    }
    
    loadStats() {
        try {
            const saved = localStorage.getItem('ticTacToeStats');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
        return { gamesPlayed: 0, wins: { X: 0, O: 0 }, draws: 0 };
    }
    
    saveStats() {
        try {
            localStorage.setItem('ticTacToeStats', JSON.stringify(this.stats));
        } catch (error) {
            console.error('Error saving stats:', error);
        }
    }
    
    loadTheme() {
        try {
            const saved = localStorage.getItem('ticTacToeTheme');
            return saved === 'dark';
        } catch (error) {
            console.error('Error loading theme:', error);
            return false;
        }
    }
    
    saveTheme() {
        try {
            localStorage.setItem('ticTacToeTheme', this.darkMode ? 'dark' : 'light');
        } catch (error) {
            console.error('Error saving theme:', error);
        }
    }
    
    loadDifficulty() {
        try {
            const saved = localStorage.getItem('ticTacToeDifficulty');
            return saved || 'hard'; // Default to hard
        } catch (error) {
            console.error('Error loading difficulty:', error);
            return 'hard';
        }
    }
    
    saveDifficulty() {
        try {
            localStorage.setItem('ticTacToeDifficulty', this.aiDifficulty);
        } catch (error) {
            console.error('Error saving difficulty:', error);
        }
    }
    
    toggleTheme() {
        this.darkMode = !this.darkMode;
        this.applyTheme();
        this.saveTheme();
    }
    
    applyTheme() {
        const body = document.body;
        const container = document.querySelector('.container');
        if (this.darkMode) {
            body.classList.add('dark-mode');
            if (this.themeToggle) {
                this.themeToggle.textContent = '☀️';
            }
        } else {
            body.classList.remove('dark-mode');
            if (this.themeToggle) {
                this.themeToggle.textContent = '🌙';
            }
        }
    }
    
    showHelp() {
        if (this.helpModal) {
            this.helpModal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        }
    }
    
    hideHelp() {
        if (this.helpModal) {
            this.helpModal.style.display = 'none';
            document.body.style.overflow = '';
        }
    }
    
    toggleSounds() {
        this.soundManager.toggleSounds();
        this.updateSoundButton();
    }
    
    updateSoundButton() {
        if (this.soundToggle) {
            this.soundToggle.textContent = this.soundManager.soundsEnabled ? '🔊' : '🔇';
        }
    }
    
    loadGameHistory() {
        try {
            const saved = localStorage.getItem('ticTacToeGameHistory');
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            console.error('Error loading game history:', e);
            return [];
        }
    }
    
    saveGameHistory() {
        try {
            localStorage.setItem('ticTacToeGameHistory', JSON.stringify(this.gameHistory));
        } catch (e) {
            console.error('Error saving game history:', e);
        }
    }
    
    showGameHistory() {
        if (this.gameHistory.length === 0) {
            this.message.textContent = 'Keine Spielhistorie vorhanden!';
            setTimeout(() => {
                if (this.message) this.message.textContent = '';
            }, 2000);
            return;
        }
        
        // Create history modal
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'history-modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px;">
                <span class="close" id="history-close">&times;</span>
                <h2>Spielhistorie</h2>
                <div class="history-list" id="history-list"></div>
            </div>
        `;
        document.body.appendChild(modal);
        
        const list = document.getElementById('history-list');
        this.gameHistory.forEach((game, index) => {
            const item = document.createElement('div');
            item.className = 'history-item';
            const resultText = game.result === 'X' ? 'Gewonnen' : game.result === 'O' ? 'Verloren' : game.result === 'draw' ? 'Unentschieden' : 'Abgebrochen';
            const resultClass = game.result === 'X' ? 'win' : game.result === 'O' ? 'lose' : game.result === 'draw' ? 'draw' : 'abandoned';
            const date = new Date(game.startTime).toLocaleString('de-DE');
            const duration = Math.round(game.duration / 1000);
            
            item.innerHTML = `
                <div class="history-item-header">
                    <span class="history-number">#${index + 1}</span>
                    <span class="history-result ${resultClass}">${resultText}</span>
                    <span class="history-difficulty">${this.getDifficultyLabel(game.difficulty)}</span>
                </div>
                <div class="history-item-details">
                    <span>${date}</span>
                    <span>${duration}s</span>
                    <span>${game.moves.length} Züge</span>
                    <button class="replay-game-btn" data-index="${index}">▶ Abspielen</button>
                </div>
            `;
            list.appendChild(item);
        });
        
        document.getElementById('history-close').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
        
        document.querySelectorAll('.replay-game-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const index = parseInt(e.target.getAttribute('data-index'));
                document.body.removeChild(modal);
                this.startReplay(this.gameHistory[index]);
            });
        });
        
        modal.style.display = 'block';
    }
    
    getDifficultyLabel(difficulty) {
        const labels = { easy: 'Leicht', medium: 'Mittel', hard: 'Schwer' };
        return labels[difficulty] || difficulty;
    }
    
    startReplay(game) {
        this.isReplayMode = true;
        this.replayGame = game;
        this.replayIndex = 0;
        this.gameActive = false;
        this.isPlayerTurn = false;
        
        // Reset board
        this.board = Array(9).fill('');
        this.winningLine = null;
        this.moveCount = 0;
        this.cells.forEach((cell, index) => {
            cell.textContent = '';
            cell.classList.remove('occupied', 'x', 'o', 'winning-cell', 'animate-mark');
            cell.setAttribute('aria-label', `Zelle ${index + 1}, leer`);
            cell.style.pointerEvents = 'none';
        });
        
        // Show replay controls
        if (this.replayControls) {
            this.replayControls.style.display = 'flex';
        }
        
        this.message.textContent = `Wiedergabe: ${this.getDifficultyLabel(game.difficulty)} - ${game.result === 'X' ? 'Gewonnen' : game.result === 'O' ? 'Verloren' : 'Unentschieden'}`;
        this.updateReplayControls();
    }
    
    replayNextMove() {
        if (!this.isReplayMode || !this.replayGame) return;
        
        if (this.replayIndex < this.replayGame.moves.length) {
            const move = this.replayGame.moves[this.replayIndex];
            this.board[move.index] = move.player;
            const cell = this.cells[move.index];
            cell.textContent = move.player;
            cell.classList.add('occupied', move.player.toLowerCase());
            cell.setAttribute('aria-label', `Zelle ${move.index + 1}, ${move.player}`);
            cell.classList.add('animate-mark');
            this.moveCount++;
            this.replayIndex++;
            
            // Check if game ended
            if (this.replayIndex === this.replayGame.moves.length) {
                if (this.replayGame.winningLine) {
                    this.winningLine = this.replayGame.winningLine;
                    this.highlightWinningLine();
                }
            }
            
            this.updateReplayControls();
        }
    }
    
    replayPreviousMove() {
        if (!this.isReplayMode || !this.replayGame || this.replayIndex === 0) return;
        
        this.replayIndex--;
        const move = this.replayGame.moves[this.replayIndex];
        this.board[move.index] = '';
        const cell = this.cells[move.index];
        cell.textContent = '';
        cell.classList.remove('occupied', 'x', 'o', 'winning-cell', 'animate-mark');
        cell.setAttribute('aria-label', `Zelle ${move.index + 1}, leer`);
        this.moveCount--;
        
        // Clear winning line if we go back
        if (this.winningLine) {
            this.winningLine.forEach(index => {
                const winCell = this.cells[index];
                if (winCell) {
                    winCell.classList.remove('winning-cell');
                }
            });
            this.winningLine = null;
        }
        
        this.updateReplayControls();
    }
    
    toggleReplay() {
        if (!this.isReplayMode) return;
        
        if (this.replayInterval) {
            clearInterval(this.replayInterval);
            this.replayInterval = null;
            if (this.replayPlayPauseBtn) {
                this.replayPlayPauseBtn.textContent = '▶ Abspielen';
            }
        } else {
            this.replayInterval = setInterval(() => {
                if (this.replayIndex < this.replayGame.moves.length) {
                    this.replayNextMove();
                } else {
                    this.toggleReplay();
                }
            }, 800);
            if (this.replayPlayPauseBtn) {
                this.replayPlayPauseBtn.textContent = '⏸ Pausieren';
            }
        }
    }
    
    closeReplay() {
        this.isReplayMode = false;
        this.replayGame = null;
        this.replayIndex = 0;
        if (this.replayInterval) {
            clearInterval(this.replayInterval);
            this.replayInterval = null;
        }
        if (this.replayControls) {
            this.replayControls.style.display = 'none';
        }
        this.resetGame();
    }
    
    updateReplayControls() {
        if (!this.isReplayMode) return;
        
        if (this.replayPrevBtn) {
            this.replayPrevBtn.disabled = this.replayIndex === 0;
        }
        if (this.replayNextBtn) {
            this.replayNextBtn.disabled = this.replayIndex >= this.replayGame.moves.length;
        }
        if (this.replayPlayPauseBtn) {
            this.replayPlayPauseBtn.disabled = this.replayIndex >= this.replayGame.moves.length;
        }
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new TicTacToe();
});
