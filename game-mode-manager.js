/**
 * Game Mode Manager
 * Abstracts differences between local and online multiplayer modes
 */

class GameModeManager {
    static mode = null;
    static database = null;

    static setMode(mode) {
        this.mode = mode;
        localStorage.setItem('gameMode', mode);
        console.log(`🎮 Game mode set to: ${mode}`);
    }

    static getMode() {
        if (!this.mode) {
            this.mode = localStorage.getItem('gameMode') || 'local';
        }
        return this.mode;
    }

    static isLocal() {
        return this.getMode() === 'local';
    }

    static isOnline() {
        return this.getMode() === 'online';
    }

    // Initialize Firebase (only for online mode)
    static async initializeOnlineMode() {
        if (this.isOnline() && !this.database) {
            this.database = initializeFirebase();

            // Sign out any existing session first to ensure fresh anonymous user
            try {
                await firebase.auth().signOut();
                console.log('🔄 Signed out existing session');
            } catch (error) {
                // Ignore if no existing session
            }

            // Authenticate anonymously (creates new user each time)
            try {
                const userCredential = await firebase.auth().signInAnonymously();
                window.currentUserId = userCredential.user.uid;
                console.log('✅ Firebase authenticated:', window.currentUserId);
                return true;
            } catch (error) {
                console.error('❌ Firebase auth error:', error);
                return false;
            }
        }
        return true;
    }

    // State update abstraction
    static async updateGameState(updates) {
        if (this.isLocal()) {
            // Local mode: direct state update
            Object.assign(gameState, updates);
            updateGameUI();
        } else {
            // Online mode: Firebase sync
            const roomCode = localStorage.getItem('currentRoomCode');
            if (!roomCode) {
                console.error('No room code found');
                return;
            }

            const gameStateRef = this.database.ref('games/' + roomCode + '/gameState');
            console.log('🔥 Updating Firebase gameState:', Object.keys(updates));

            // Debug: Check if centerToken is serializable
            if (updates.centerToken) {
                console.log('🔍 centerToken type:', typeof updates.centerToken);
                console.log('🔍 centerToken keys:', Object.keys(updates.centerToken));
                console.log('🔍 centerToken sample:', {
                    id: updates.centerToken.id,
                    name: updates.centerToken.name,
                    hasStats: !!updates.centerToken.stats
                });
            }

            try {
                // Use transaction to ensure atomic update
                const snapshot = await gameStateRef.once('value');
                const currentState = snapshot.val() || {};
                const newState = { ...currentState, ...updates };

                await gameStateRef.set(newState);
                console.log('✅ Firebase gameState updated successfully');
            } catch (error) {
                console.error('❌ Firebase gameState update failed:', error);
                console.error('❌ Failed updates:', updates);
            }
            // UI updates automatically via Firebase subscription
        }
    }

    // Player update abstraction
    static async updatePlayer(playerId, updates) {
        if (this.isLocal()) {
            // Find player in local array by id
            const player = gameState.players.find(p => p.id === playerId);
            if (player) {
                Object.assign(player, updates);
                updateGameUI();
            }
        } else {
            // Online mode: Firebase update
            const roomCode = localStorage.getItem('currentRoomCode');
            if (!roomCode) return;

            const playerRef = this.database.ref('games/' + roomCode + '/players/' + playerId);
            await playerRef.update(updates);
        }
    }

    // Turn check abstraction
    static isMyTurn() {
        if (this.isLocal()) {
            // In local mode, always "your turn" (pass and play)
            return true;
        } else {
            // In online mode, check if it's this user's turn
            if (!window.currentUserId || !gameState.players) {
                return false;
            }

            // Use window.playerIds which has actual Firebase user IDs, not gameState.players array indices
            const playerIds = window.playerIds || Object.keys(gameState.players);
            const currentPlayerId = playerIds[gameState.currentPlayer];
            return currentPlayerId === window.currentUserId;
        }
    }

    // Get current player info
    static getCurrentPlayer() {
        if (this.isLocal()) {
            return gameState.players[gameState.currentPlayer];
        } else {
            const playerIds = Object.keys(gameState.players || {});
            const currentPlayerId = playerIds[gameState.currentPlayer];
            return gameState.players[currentPlayerId];
        }
    }

    // Next turn abstraction
    static async nextTurn() {
        if (this.isLocal()) {
            // Local mode: simple increment
            gameState.currentPlayer = (gameState.currentPlayer + 1) % gameState.players.length;
            updateGameUI();
        } else {
            // Online mode: Firebase update
            const roomCode = localStorage.getItem('currentRoomCode');
            const playerIds = Object.keys(gameState.players || {});
            const nextPlayer = (gameState.currentPlayer + 1) % playerIds.length;

            await this.updateGameState({ currentPlayer: nextPlayer });
        }
    }
}

// Export globally
window.GameModeManager = GameModeManager;
