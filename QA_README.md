# FourFor4 Integration QA System

## Overview

**Integration QA test suite** for FourFor4 multiplayer game. Tests **actual game functions** (not isolated logic) including pass functionality, turn advancement, scoring, and complete game flows.

## Running Tests

### From UI
1. Open `multiplayer.html` in browser
2. Click **🧪 Run QA Tests** button on mode selection screen
3. View results in console (F12)
4. Summary appears in alert dialog

### From Console
```javascript
// Run all tests
runQATests()

// Create custom test suite
const qa = new QATestSuite();
await qa.runAllTests();
```

## Test Coverage (Integration Tests)

### 1. Pass Function Integration (3 tests)
- ✅ **passRound()** adds player to Set, advances turn, sets first guesser
- ✅ **passRound()** skips passed players when advancing turn
- ✅ **passRound()** handles both players passing (sets last to pass)

### 2. Correct Guess Integration (1 test)
- ✅ **handleCorrectGuess()** adds token to thisRound, increments score, updates centerToken

### 3. Cash Out Integration (1 test)
- ✅ **executeCashOut()** moves tokens to hand, awards points, advances turn

### 4. Turn Advancement Integration (2 tests)
- ✅ **advanceTurn()** normal flow (advances to next player)
- ✅ **advanceTurn()** skips passed players and loops correctly

### 5. Round Management Integration (1 test)
- ✅ **endRound()** clears passedPlayers, increments round, sets first guesser as currentPlayer

### 6. Complete Game Flow (1 test)
- ✅ Multi-round scenario: both pass → round end → new round → one passes
- ✅ Verifies state consistency across complete gameplay cycle

## Test Architecture

### QATestSuite Class
```javascript
class QATestSuite {
    constructor()           // Initialize test suite
    pass(testName, msg)    // Mark test as passed
    fail(testName, msg)    // Mark test as failed
    assertEquals(a, b, name) // Assert equality
    assertTrue(cond, name)   // Assert true
    assertFalse(cond, name)  // Assert false
    resetGameState()        // Reset between tests
    runAllTests()           // Run full suite
    generateReport()        // Output results
}
```

### Test Groups
1. **Pass Functionality** - Core pass mechanic
2. **Turn Advancement** - Turn flow logic
3. **Round Management** - Round lifecycle
4. **Scoring** - Point calculations
5. **Edge Cases** - Boundary conditions
6. **Integration** - End-to-end flows

## Expected Results

All **integration tests** should **PASS** (100% success rate):

```
📊 ========== TEST RESULTS ==========

Total Tests: 9
✅ Passed: 9
❌ Failed: 0
Success Rate: 100.0%

========================================
```

**Key Difference from Old Tests:**
- Old tests: Tested isolated logic (manual calculations)
- New tests: Test actual game functions (real implementations)
- **This catches real bugs like V4.40 pass issue!**

## Troubleshooting

### Tests Fail
1. Check console for specific failures
2. Verify game state is properly initialized
3. Check if GameModeManager is set to 'local'
4. Ensure no Firebase conflicts

### Missing Functions
If tests reference undefined functions:
- Ensure `qa-tests.js` is loaded
- Check browser console for load errors
- Verify script tag in HTML: `<script src="qa-tests.js"></script>`

### Firebase Interference
Tests run in **local mode only**:
```javascript
GameModeManager.setMode('local');
```

## Adding New Tests

### Example Test
```javascript
async testMyNewFeature() {
    this.resetGameState();

    // Setup
    gameState.someValue = 123;

    // Action
    const result = someFunction();

    // Assert
    this.assertEquals(
        result,
        expected,
        'Test name'
    );
}
```

### Register Test
Add to `runAllTests()`:
```javascript
{
    name: 'My Feature',
    tests: [
        () => this.testMyNewFeature()
    ]
}
```

## Key Test Scenarios

### Pass Lock Out Flow
```javascript
// Player 0 passes
gameState.passedPlayers.add(0);

// Player 0 tries to act
const blocked = gameState.passedPlayers.has(0);
// blocked === true ✅
```

### Turn Skip Logic
```javascript
// Player 1 passed, turn at Player 0
gameState.passedPlayers.add(1);
gameState.currentPlayer = 0;

// Advance turn
nextPlayer = (0 + 1) % 2; // = 1
while (gameState.passedPlayers.has(nextPlayer)) {
    nextPlayer = (nextPlayer + 1) % 2; // = 0
}
// nextPlayer === 0 (loops back) ✅
```

### Firebase Array Conversion
```javascript
// To Firebase (Set → Array)
const toFirebase = Array.from(gameState.passedPlayers);

// From Firebase (Array → Set)
const fromFirebase = new Set([0, 1]);
```

## Continuous Testing

### Pre-Deployment Checklist
- [ ] Run QA tests - all pass
- [ ] Test pass functionality manually
- [ ] Test online multiplayer sync
- [ ] Check console for errors
- [ ] Verify version number updated

### Automated CI (Future)
```bash
# Headless browser testing
npm test

# Or with Playwright/Cypress
npx playwright test qa-tests.spec.js
```

## Version History

**V4.41** - Integration test suite
- 9 integration tests calling actual functions
- Tests real `passRound()`, `handleCorrectGuess()`, `executeCashOut()`, etc.
- Catches actual bugs (e.g., V4.40 pass timing issue)
- Complete game flow scenarios

**V4.40** - Initial QA system (deprecated)
- 17 unit tests testing isolated logic
- Did NOT catch V4.40 pass bug (logic was correct, integration was broken)

## Support

For issues or test failures:
1. Check console output
2. Review test assertions
3. Verify game state
4. See `multiplayer.html` game logic
5. Check `game-mode-manager.js` for mode handling

---

**QA Status**: ✅ All Systems Operational
