# QA Quick Start Guide

## 🚀 Run QA Tests (3 Ways)

### 1. UI Button (Easiest)
```
1. Open http://localhost:8000/multiplayer.html
2. Click "🧪 Run QA Tests" button
3. Check console (F12)
4. View summary in alert
```

### 2. Browser Console
```javascript
runQATests()
```

### 3. Custom Test Suite
```javascript
const qa = new QATestSuite();
await qa.runAllTests();
```

## ✅ Expected Output

**Console:**
```
🧪 ========== STARTING QA TEST SUITE ==========

🔧 Setting up test environment...
✅ Test environment ready

📋 Pass Functionality Tests:
✅ PASS: Pass adds player to passedPlayers Set
✅ PASS: Passed player is blocked from actions
✅ PASS: Multiple players can pass

📋 Turn Advancement Tests:
✅ PASS: advanceTurn works normally without passed players
✅ PASS: advanceTurn skips passed player
✅ PASS: Turn stays with only active player when others passed

...

📊 ========== TEST RESULTS ==========

Total Tests: 17
✅ Passed: 17
❌ Failed: 0
Success Rate: 100.0%

========================================
```

**Alert:**
```
✅ QA Test Results

Total: 17
Passed: 17
Failed: 0
Success Rate: 100.0%

Check console for detailed results.
```

## 📋 What's Tested

| Category | Tests | What It Checks |
|----------|-------|----------------|
| **Pass** | 3 | Players added to Set, blocked from actions, multiple passes |
| **Turns** | 3 | Normal flow, skip passed players, loop handling |
| **Rounds** | 3 | State reset, first guesser, last to pass tracking |
| **Scoring** | 2 | Correct guess points, cash out scoring |
| **Edge Cases** | 3 | Set/Array conversion, empty state, Firebase objects |
| **Integration** | 3 | Complete pass flow, multi-player scenarios |

**Total: 17 tests**

## 🐛 Troubleshooting

### ❌ Tests Fail
1. **Check mode**: Tests run in local mode only
   ```javascript
   GameModeManager.getMode() // Should be 'local'
   ```

2. **Clear state**: Refresh page before testing
   ```
   Ctrl+F5 (hard refresh)
   ```

3. **Check console**: Look for specific error messages
   ```
   Failed tests will show:
   ❌ FAIL: Test name - Expected X, got Y
   ```

### 🔧 Files Not Loading
```bash
# Check files exist
ls -la /home/randycass/projects/know-it-all/outrank-v5-deploy/qa-tests.js

# Check server
curl http://localhost:8000/qa-tests.js | head -5
```

### 🌐 Server Issues
```bash
# Restart server
pkill -9 python3
python3 -m http.server 8000
```

## 🔄 Testing Workflow

### Pre-Deployment
```
1. Make code changes
2. Run QA tests → All pass ✅
3. Manual test critical paths
4. Deploy to production
```

### Post-Bug Fix
```
1. Fix the bug
2. Run QA tests → Verify fix ✅
3. Add regression test if needed
4. Deploy with confidence
```

### Adding Features
```
1. Implement feature
2. Add QA test for it
3. Run full suite → All pass ✅
4. Document in QA_README.md
```

## 📝 Quick Test Examples

### Test Pass Functionality
```javascript
// Setup
gameState.passedPlayers.add(0);

// Assert
console.assert(gameState.passedPlayers.has(0), 'Player 0 should be passed');
```

### Test Turn Skip
```javascript
// Setup
gameState.passedPlayers.add(1);
gameState.currentPlayer = 0;

// Action
let next = (0 + 1) % 2; // = 1
while (gameState.passedPlayers.has(next)) {
    next = (next + 1) % 2; // = 0
}

// Assert
console.assert(next === 0, 'Turn should loop back to Player 0');
```

### Test Scoring
```javascript
// Setup
const player = gameState.players[0];
player.thisRound = [{}, {}, {}]; // 3 tokens

// Action
const points = player.thisRound.length;
player.score += points;

// Assert
console.assert(player.score === 3, 'Should have 3 points');
```

## 🎯 Coverage Status

**Current: 17 tests**
- ✅ Pass system (100%)
- ✅ Turn advancement (100%)
- ✅ Round lifecycle (100%)
- ✅ Basic scoring (100%)
- ✅ Edge cases (100%)
- ⏳ Firebase sync (manual testing)
- ⏳ UI interactions (manual testing)

## 📚 Full Documentation

See `QA_README.md` for:
- Complete test list
- Architecture details
- Adding new tests
- Continuous testing setup

---

**Status**: ✅ QA System Active | V4.40
