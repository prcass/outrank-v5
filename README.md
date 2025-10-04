# Outrank V5 - Multiplayer Edition

Strategic token drafting and guessing game with **local and online multiplayer** support.

## 🎮 Play Now

**Live Demo:** https://prcass.github.io/outrank-v5/

## ✨ Features

### Dual Mode Gameplay
- **🏠 Local Multiplayer** - Pass-and-play on the same device (no internet required)
- **🌐 Online Multiplayer** - Play with friends on different devices anywhere

### Game Mechanics
- **4 Token Categories:** Movies, Countries, Companies, Sports Teams
- **Strategic Drafting:** Build your hand by guessing higher or lower
- **Push Your Luck:** Cash out for points or risk it all
- **Challenge Cards:** 40 unique ranking challenges per category
- **Token Persistence:** Keep your tokens across rounds

### Online Features
- Room-based matchmaking with 6-character codes
- Real-time player lobby
- 2-6 players per game
- Anonymous authentication (no login required)
- Live game state synchronization

## 🚀 Getting Started

### Play Locally
1. Clone this repository
2. Open `index.html` in your browser
3. Choose "Local Multiplayer"

### Play Online
1. Open the live demo
2. Choose "Online Multiplayer"
3. Create a game or join with a room code
4. Share the room code with friends

## 🛠️ Technology Stack

- **Frontend:** Vanilla JavaScript, HTML5, CSS3
- **Backend:** Firebase Realtime Database
- **Authentication:** Firebase Anonymous Auth
- **Deployment:** GitHub Pages

## 📋 Game Rules

1. **First Guesser** selects a challenge card (e.g., "Box Office Earnings")
2. **Draft Phase:** 13 tokens drawn for the category
3. **Center Token** is revealed - players guess if next token is higher or lower
4. **Correct Guess:** Keep the token, continue playing
5. **Wrong Guess:** Lose all tokens from this round
6. **Cash Out:** Bank your tokens for points (2/5/8 points for 2/3/4+ tokens)
7. **Last Standing Bonus:** +1 point if you're the last to pass
8. **5 Rounds Total** - Most points wins!

## 🎯 Scoring

- **+1 point** per correct guess
- **+2 points** for cashing out 2 tokens
- **+5 points** for cashing out 3 tokens
- **+8 points** for cashing out 4+ tokens
- **+1 point** last standing bonus

## 📝 Version History

### V5.0 (October 2025)
- ✅ Dual-mode architecture (Local + Online)
- ✅ Firebase real-time multiplayer
- ✅ Room-based matchmaking
- ✅ Anonymous authentication
- ✅ Live lobby with player list
- ✅ Game state synchronization

### V4.0 (Earlier)
- Complete single-device multiplayer
- 40 tokens per category (160 total)
- Perfect tag distribution
- Token persistence system
- Challenge tracking

## 🔧 Development

```bash
# Clone repository
git clone https://github.com/prcass/outrank-v5.git

# Serve locally
python3 -m http.server 8000
# or
npx http-server

# Open browser
http://localhost:8000
```

### Version Update Checklist

**When updating version numbers, update ALL of the following:**

1. **`multiplayer.html`** - Page title tag (line ~6):
   ```html
   <title>4f4 VX.XX - Multiplayer</title>
   ```

2. **`multiplayer.html`** - Mode selection header (line ~699):
   ```html
   <h1>4f4 VX.XX</h1>
   ```

3. **`multiplayer.html`** - Online setup header (line ~753):
   ```html
   <h1>4f4 VX.XX - Online</h1>
   ```

4. **`multiplayer.html`** - Game screen header (line ~939):
   ```html
   <h1>4f4 VX.XX</h1>
   ```

5. **`index.html`** - Version badge (line ~134):
   ```html
   <span class="badge">VX.XX</span>
   ```

**Quick command to verify all versions:**
```bash
grep -n "V4\.[0-9][0-9]" multiplayer.html index.html
```

## 📄 License

MIT License - Feel free to use and modify!

## 🙏 Credits

Created by Randy Cass
Built with ❤️ for game night
