/**
 * Room Manager
 * Handles creation and joining of game rooms
 */

class RoomManager {
    static database = null;

    static initialize(database) {
        this.database = database;
    }

    // Generate 6-character room code
    static generateRoomCode() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let code = '';
        for (let i = 0; i < 6; i++) {
            code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return code;
    }

    // Check if room exists
    static async roomExists(roomCode) {
        const snapshot = await this.database.ref('games/' + roomCode).once('value');
        return snapshot.exists();
    }

    // Generate unique room code
    static async generateUniqueRoomCode() {
        let code;
        let exists;
        let attempts = 0;
        do {
            code = this.generateRoomCode();
            exists = await this.roomExists(code);
            attempts++;
            if (attempts > 10) {
                throw new Error('Could not generate unique room code');
            }
        } while (exists);
        return code;
    }

    // Create new game room
    static async createRoom(hostName) {
        if (!window.currentUserId) {
            throw new Error('Not authenticated');
        }

        const roomCode = await this.generateUniqueRoomCode();
        const roomRef = this.database.ref('games/' + roomCode);

        // Initialize room with basic structure
        await roomRef.set({
            config: {
                maxRounds: 5,
                maxPlayers: 6,
                createdAt: firebase.database.ServerValue.TIMESTAMP,
                hostId: window.currentUserId
            },
            players: {
                [window.currentUserId]: {
                    name: hostName,
                    joinedAt: firebase.database.ServerValue.TIMESTAMP,
                    connected: true,
                    isHost: true,
                    score: 0,
                    correctGuesses: 0,
                    wrongGuesses: 0,
                    cashOuts: 0,
                    hand: [],
                    thisRound: []
                }
            },
            gameState: {
                phase: 'lobby',
                round: 0,
                maxRounds: 5,
                currentPlayer: 0,
                firstGuesser: 0,
                selectedCategory: null,
                previousCategory: null,
                playedChallenges: [],
                drawnChallengeCards: [],
                draftPool: [],
                centerToken: null,
                passedPlayers: [],
                selectedDraftToken: null
            }
        });

        console.log('✅ Room created:', roomCode);
        return roomCode;
    }

    // Join existing room
    static async joinRoom(roomCode, playerName) {
        if (!window.currentUserId) {
            throw new Error('Not authenticated');
        }

        const roomRef = this.database.ref('games/' + roomCode);
        const snapshot = await roomRef.once('value');

        if (!snapshot.exists()) {
            throw new Error('Room not found');
        }

        const roomData = snapshot.val();

        // Check if room is full
        const playerCount = Object.keys(roomData.players || {}).length;
        if (playerCount >= (roomData.config.maxPlayers || 6)) {
            throw new Error('Room is full');
        }

        // Check if game already started
        if (roomData.gameState.phase === 'playing') {
            throw new Error('Game already in progress');
        }

        // Add player to room
        await roomRef.child('players/' + window.currentUserId).set({
            name: playerName,
            joinedAt: firebase.database.ServerValue.TIMESTAMP,
            connected: true,
            isHost: false,
            score: 0,
            correctGuesses: 0,
            wrongGuesses: 0,
            cashOuts: 0,
            hand: [],
            thisRound: []
        });

        console.log('✅ Joined room:', roomCode);
        return roomCode;
    }

    // Leave room
    static async leaveRoom(roomCode) {
        if (!window.currentUserId) return;

        const playerRef = this.database.ref('games/' + roomCode + '/players/' + window.currentUserId);
        await playerRef.remove();

        console.log('👋 Left room:', roomCode);
    }

    // Set up presence tracking
    static setupPresence(roomCode) {
        if (!window.currentUserId) return;

        const playerPresenceRef = this.database.ref(
            'games/' + roomCode + '/players/' + window.currentUserId + '/connected'
        );

        // Set to false when disconnected
        playerPresenceRef.onDisconnect().set(false);

        // Set to true when connected
        playerPresenceRef.set(true);
    }
}

// Export globally
window.RoomManager = RoomManager;
