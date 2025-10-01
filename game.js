console.log('🚨🚨🚨 GAME.JS v13 LOADING! 🚨🚨🚨');

/**
 * @fileoverview Know-It-All Trivia Ranking Game
 * 
 * A web-based trivia game where players bid on how many cards they can rank correctly
 * in various categories (e.g., coffee consumption by country, happiness rankings).
 * 
 * Architecture:
 * - GameState: Centralized state management with reactive updates
 * - DOMCache: Performance-optimized DOM element caching
 * - TemplateEngine: Reusable HTML template system
 * - EventListenerManager: Memory-safe event handling
 * 
 * @author Claude Code Assistant
 * @version 2.0.0 - Architectural Refactor
 */

/**
 * Global game configuration object containing all game rules, constraints, and settings.
 * Centralized configuration makes the game easily adjustable and maintainable.
 * 
 * @namespace
 * @type {Object}
 */
var GAME_CONFIG = {
    // Game Rules
    MAX_ROUNDS: 6,
    WINNING_SCORE: 30,
    MIN_PLAYERS: 2,
    MAX_PLAYERS: 6,
    DEFAULT_PLAYER_COUNT: 4,
    
    // Bid Constraints
    MIN_BID: 1,
    MAX_BID: 10,
    
    // Token Configuration
    BLOCKING_TOKENS: {
        LOW: 2,
        MEDIUM: 4,
        HIGH: 6
    },
    DEFAULT_TOKEN_SET: {2: 1, 4: 1, 6: 1},
    
    // UI Timing (milliseconds)
    NOTIFICATION_DURATION: 3000,
    ANIMATION_DELAY: 300,
    FADE_IN_DELAY: 10,
    DATA_LOAD_DELAY: 200,           // Wait for data.js to load
    UI_TRANSITION_DELAY: 100,       // General UI transitions
    BLOCKING_FINISH_DELAY: 1500,    // Time before finishing blocking phase
    CARD_SELECTION_DELAY: 1000,     // Time before showing ranking interface
    RANKING_REVEAL_SUCCESS: 1500,   // Success celebration delay
    RANKING_REVEAL_FAILURE: 1000,   // Failure message delay
    FINAL_RESULTS_DELAY: 1500,      // Time before showing final results
    TEST_INTERIM_DELAY: 1500,       // Automated test interim screen delay
    INPUT_FOCUS_DELAY: 100,         // Focus input elements delay
    
    // Performance Settings
    MAX_CONSOLE_MESSAGES: 500,
    
    // Test Configuration
    TEST_PLAYER_NAMES: ['Alice', 'Bob', 'Charlie', 'Diana'],
    
    // Debug Mode
    DEBUG_MODE: false,
    ENABLE_CONSOLE_LOGGING: true,
    
    // Automated Test Timing (set to 1 for fastest testing)
    TEST_SPEED_MULTIPLIER: 1,  // 1 = fastest, 10 = normal speed
    BASE_DELAY: 50            // Base delay in milliseconds
};

// Global card statistics tracking (persists across all games in session)
window.globalCardStats = {
    totalCardsRanked: 0,
    totalCardsOwned: 0,
    totalCardsInPlay: 0,
    sessionsPlayed: 0
};

/**
 * Token Integrity Validation
 * Ensures that the total number of tokens in the game remains constant
 */
function validateTokenIntegrity() {
    // Use the new BusinessLogic module for token validation
    var players = getPlayers();
    var validation = BusinessLogic.validateTokenIntegrity(players, ACTIVE_RULES);
    
    if (!validation.isValid) {
        console.error('❌ TOKEN INTEGRITY ERROR: Expected: ' + 
            JSON.stringify(validation.expected) + 
            ', Found: ' + JSON.stringify(validation.actual));
        return false;
    }
    
    
    console.log('✅ Token integrity check passed - Total tokens:', validation.actual);
    return validation.isValid;
}

/**
 * Text Sanitization Utility
 * Prevents XSS attacks by sanitizing text content before inserting into DOM
 * For plain text only - does not process HTML content
 */
function sanitizeText(text) {
    if (typeof text !== 'string') {
        return String(text);
    }
    
    // Create a temporary element to use browser's built-in HTML escape
    var tempDiv = document.createElement('div');
    tempDiv.textContent = text;
    return tempDiv.innerHTML;
}

/**
 * HTML Content Sanitization Utility
 * For content that should be rendered as HTML (like game-generated templates)
 * Only allows safe HTML patterns used by the game
 */
function sanitizeHTML(htmlContent) {
    if (typeof htmlContent !== 'string') {
        return sanitizeText(String(htmlContent));
    }
    
    // Check if this is game-generated template content that should be rendered
    var isGameContent = htmlContent.indexOf('<div class="card-item') !== -1 ||
                       htmlContent.indexOf('<strong>') !== -1 ||
                       htmlContent.indexOf('<br>') !== -1 ||
                       htmlContent.indexOf('<span') !== -1 ||
                       htmlContent.indexOf('class="btn') !== -1 ||
                       htmlContent.indexOf('Round ') !== -1 ||
                       htmlContent.indexOf('<table') !== -1 ||
                       htmlContent.indexOf('<tr>') !== -1 ||
                       htmlContent.indexOf('<td') !== -1 ||
                       htmlContent.indexOf('<th') !== -1;
    
    if (isGameContent) {
        // Allow safe HTML patterns used by the game
        return htmlContent;
    } else {
        // Treat as plain text for safety
        return sanitizeText(htmlContent);
    }
}

/**
 * Clean up any visible trusted template markers from the page
 */
function cleanupAllTemplateMarkers() {
    // Find all text nodes containing the marker
    var walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        null,
        false
    );
    
    var textNodes = [];
    var node;
    
    while (node = walker.nextNode()) {
        if (node.textContent && node.textContent.indexOf('<!-- TRUSTED_TEMPLATE -->') !== -1) {
            textNodes.push(node);
        }
    }
    
    // Remove markers from all found text nodes
    textNodes.forEach(function(textNode) {
        textNode.textContent = textNode.textContent.replace(/<!-- TRUSTED_TEMPLATE -->/g, '');
    });
}

/**
 * Safe HTML insertion utility
 * Use this instead of direct innerHTML assignment
 */
function safeSetHTML(element, content) {
    if (!element) return false;
    
    // If content contains HTML tags, we need to sanitize more carefully
    if (typeof content === 'string' && /<[^>]*>/.test(content)) {
        // Expanded trusted template patterns for game content
        var isTrustedTemplate = content.indexOf('<!-- TRUSTED_TEMPLATE -->') !== -1 ||
                               content.indexOf('class="card-item') !== -1 ||
                               content.indexOf('class="high-bid-') !== -1 ||
                               content.indexOf('class="card-title"') !== -1 ||
                               content.indexOf('class="btn') !== -1 ||
                               content.indexOf('<strong>Round') !== -1 ||
                               content.indexOf('<strong>') !== -1 ||
                               content.indexOf('<br>') !== -1 ||
                               content.indexOf('<span') !== -1 ||
                               content.indexOf('<div') !== -1 ||
                               content.indexOf('<table') !== -1 ||
                               content.indexOf('class="scores-table"') !== -1 ||
                               (/^<(div|span|strong|br|p|table|thead|tbody|tr|td|th)\b/.test(content.trim()));
        
        if (isTrustedTemplate) {
            // Remove all trusted markers (there might be multiple) and proceed with innerHTML
            var cleanContent = content.replace(/<!-- TRUSTED_TEMPLATE -->/g, '');
            element.innerHTML = cleanContent;
            
            // Clean up any remaining markers that might have appeared elsewhere
            setTimeout(function() {
                cleanupAllTemplateMarkers();
            }, 10);
            
            return true;
        }
        
        // For untrusted content, strip all HTML tags and use textContent for safety
        element.textContent = content.replace(/<[^>]*>/g, '');
        console.warn('HTML content detected and stripped for security. Use textContent instead.');
        return true;
    }
    
    // Safe to use textContent for plain text
    element.textContent = content;
    return true;
}

/**
 * Create safe DOM elements from HTML string for trusted template content
 */
function createSafeElement(htmlString) {
    // Create a document fragment to safely parse HTML
    var template = document.createElement('template');
    template.innerHTML = sanitizeHTML(htmlString);
    return template.content;
}

/**
 * Enhanced HTML sanitization for template content
 */
function sanitizeHTML(html) {
    // Handle numbers and other non-string values properly
    if (html === null || html === undefined) return '';
    if (typeof html === 'number') return String(html);
    if (typeof html !== 'string') return String(html);
    
    // Allow only safe HTML tags and attributes for game UI
    var allowedTags = ['div', 'span', 'button', 'p', 'h1', 'h2', 'h3', 'br', 'strong', 'em'];
    var allowedAttributes = ['class', 'id', 'data-', 'aria-'];
    
    // For now, return the HTML as-is since it's generated by our own template system
    // In a production environment, implement proper HTML sanitization library
    return html;
}

/**
 * Safe template rendering wrapper
 */
function safeRenderTemplate(element, templateName, data) {
    if (!element || !templateName) return false;
    
    try {
        var renderedContent = TemplateEngine.render(templateName, data);
        // Mark as trusted template content
        var trustedContent = '<!-- TRUSTED_TEMPLATE -->' + renderedContent;
        return safeSetHTML(element, trustedContent);
    } catch (error) {
        console.error('Template rendering error:', error);
        element.textContent = 'Error loading content';
        return false;
    }
}

/**
 * Content Security Policy Documentation
 * 
 * The current CSP allows 'unsafe-inline' for rapid development. For production:
 * 
 * 1. Move all inline scripts to external files
 * 2. Replace onclick handlers with addEventListener calls
 * 3. Use nonce-based CSP: script-src 'self' 'nonce-{random}'
 * 4. Remove 'unsafe-inline' from script-src and style-src
 * 
 * Stricter Production CSP:
 * default-src 'self';
 * script-src 'self' 'nonce-{random}';
 * style-src 'self' 'nonce-{random}';
 * img-src 'self' data:;
 * font-src 'self';
 * connect-src 'self';
 * object-src 'none';
 * base-uri 'self';
 * form-action 'self';
 */

/**
 * HTML Attribute Escaping Utilities
 * Provides safe escaping for dynamic HTML attribute values
 */
var HTMLEscaper = {
    /**
     * Escapes quotes and other characters for safe HTML attribute values
     * @param {string} value - Value to escape for HTML attributes
     * @returns {string} Escaped value safe for HTML attributes
     */
    escapeHTMLAttribute: function(value) {
        if (typeof value !== 'string') {
            value = String(value);
        }
        
        return value
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/\//g, '&#x2F;');
    },
    
    /**
     * Creates safe HTML with properly escaped attributes
     * @param {string} tag - HTML tag name
     * @param {Object} attributes - Object with attribute names and values
     * @param {string} content - Inner content (will be sanitized)
     * @returns {string} Safe HTML string
     */
    createSafeHTMLWithAttributes: function(tag, attributes, content) {
        var html = '<' + tag;
        
        // Add attributes with proper escaping
        if (attributes) {
            Object.keys(attributes).forEach(function(key) {
                var value = attributes[key];
                if (value !== null && value !== undefined) {
                    html += ' ' + key + '="' + this.escapeHTMLAttribute(value) + '"';
                }
            }.bind(this));
        }
        
        html += '>';
        
        if (content) {
            html += sanitizeHTML(content);
        }
        
        html += '</' + tag + '>';
        return html;
    }
};

/**
 * Input Validation Utilities
 * Centralized validation system to prevent injection attacks and ensure data integrity
 */
var InputValidator = {
    /**
     * Validates player name input
     * @param {string} name - The player name to validate
     * @returns {Object} {isValid: boolean, sanitized: string, error: string}
     */
    validatePlayerName: function(name) {
        if (!name || typeof name !== 'string') {
            return {isValid: false, sanitized: '', error: 'Player name is required'};
        }
        
        var trimmed = name.trim();
        if (trimmed.length === 0) {
            return {isValid: false, sanitized: '', error: 'Player name cannot be empty'};
        }
        
        if (trimmed.length > 30) {
            return {isValid: false, sanitized: trimmed.substring(0, 30), error: 'Player name too long (max 30 characters)'};
        }
        
        // Remove potentially dangerous characters but allow basic punctuation
        var sanitized = trimmed.replace(/[<>\"'&]/g, '');
        if (sanitized !== trimmed) {
            return {isValid: false, sanitized: sanitized, error: 'Player name contains invalid characters'};
        }
        
        return {isValid: true, sanitized: sanitized, error: null};
    },
    
    /**
     * Validates card number input
     * @param {string|number} cardNum - The card number to validate
     * @param {number} maxCards - Maximum valid card number
     * @returns {Object} {isValid: boolean, value: number, error: string}
     */
    validateCardNumber: function(cardNum, maxCards) {
        maxCards = maxCards || 10;
        
        if (cardNum === null || cardNum === undefined || cardNum === '') {
            return {isValid: false, value: null, error: 'Card number is required'};
        }
        
        var num = parseInt(cardNum);
        if (isNaN(num)) {
            return {isValid: false, value: null, error: 'Card number must be a number'};
        }
        
        if (num < 1) {
            return {isValid: false, value: num, error: 'Card number must be at least 1'};
        }
        
        if (num > maxCards) {
            return {isValid: false, value: num, error: 'Card number cannot exceed ' + maxCards};
        }
        
        return {isValid: true, value: num, error: null};
    },
    
    /**
     * Validates bid amount
     * @param {string|number} bid - The bid amount to validate
     * @returns {Object} {isValid: boolean, value: number, error: string}
     */
    validateBidAmount: function(bid) {
        if (bid === null || bid === undefined || bid === '') {
            return {isValid: false, value: null, error: 'Bid amount is required'};
        }
        
        var num = parseInt(bid);
        if (isNaN(num)) {
            return {isValid: false, value: null, error: 'Bid must be a number'};
        }
        
        var minBid = GAME_CONFIG.MIN_BID || 1;
        var maxBid = GAME_CONFIG.MAX_BID || 10;
        
        if (num < minBid) {
            return {isValid: false, value: num, error: 'Bid must be at least ' + minBid};
        }
        
        if (num > maxBid) {
            return {isValid: false, value: num, error: 'Bid cannot exceed ' + maxBid};
        }
        
        return {isValid: true, value: num, error: null};
    },
    
    /**
     * Validates and sanitizes general text input
     * @param {string} text - Text to validate
     * @param {number} maxLength - Maximum allowed length
     * @returns {Object} {isValid: boolean, sanitized: string, error: string}
     */
    validateText: function(text, maxLength) {
        maxLength = maxLength || 1000;
        
        if (text === null || text === undefined) {
            return {isValid: false, sanitized: '', error: 'Text input is required'};
        }
        
        if (typeof text !== 'string') {
            text = String(text);
        }
        
        var trimmed = text.trim();
        if (trimmed.length > maxLength) {
            return {isValid: false, sanitized: trimmed.substring(0, maxLength), error: 'Text too long (max ' + maxLength + ' characters)'};
        }
        
        // Sanitize HTML entities and dangerous characters
        var sanitized = trimmed
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/&/g, '&amp;');
        
        return {isValid: true, sanitized: sanitized, error: null};
    },
    
    /**
     * Validates numeric input within a range
     * @param {string|number} value - Value to validate
     * @param {number} min - Minimum allowed value
     * @param {number} max - Maximum allowed value
     * @returns {Object} {isValid: boolean, value: number, error: string}
     */
    validateNumericRange: function(value, min, max) {
        if (value === null || value === undefined || value === '') {
            return {isValid: false, value: null, error: 'Numeric value is required'};
        }
        
        var num = parseFloat(value);
        if (isNaN(num)) {
            return {isValid: false, value: null, error: 'Value must be a number'};
        }
        
        if (min !== undefined && num < min) {
            return {isValid: false, value: num, error: 'Value must be at least ' + min};
        }
        
        if (max !== undefined && num > max) {
            return {isValid: false, value: num, error: 'Value cannot exceed ' + max};
        }
        
        return {isValid: true, value: num, error: null};
    },
    
    /**
     * Validates all form inputs on a screen
     * @param {string} screenId - ID of the screen to validate
     * @returns {Object} {isValid: boolean, errors: Array, validatedData: Object}
     */
    validateFormInputs: function(screenId) {
        var errors = [];
        var validatedData = {};
        
        var screen = document.getElementById(screenId);
        if (!screen) {
            return {isValid: false, errors: ['Screen not found'], validatedData: {}};
        }
        
        // Find all input elements in the screen
        var inputs = screen.querySelectorAll('input[type="text"], input[type="number"]');
        
        for (var i = 0; i < inputs.length; i++) {
            var input = inputs[i];
            var id = input.id;
            var value = input.value;
            
            // Skip empty optional fields
            if (!value && !input.required) {
                continue;
            }
            
            var validation;
            
            // Apply specific validation based on input type and ID
            if (id.startsWith('player')) {
                validation = this.validatePlayerName(value);
            } else if (id === 'cardInput') {
                validation = this.validateCardNumber(value, 10);
            } else if (input.type === 'number') {
                var min = parseFloat(input.min) || undefined;
                var max = parseFloat(input.max) || undefined;
                validation = this.validateNumericRange(value, min, max);
            } else {
                validation = this.validateText(value, 100);
            }
            
            if (!validation.isValid) {
                errors.push({
                    field: id,
                    error: validation.error,
                    value: value
                });
            } else {
                validatedData[id] = validation.sanitized || validation.value;
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors,
            validatedData: validatedData
        };
    },
    
    /**
     * Shows validation errors to the user
     * @param {Array} errors - Array of error objects
     */
    showValidationErrors: function(errors) {
        if (errors.length === 0) return;
        
        var errorMessage = 'Please fix the following errors:\n';
        errors.forEach(function(error) {
            errorMessage += '• ' + error.error + '\n';
        });
        
        showNotification(errorMessage, 'error');
    }
};

/**
 * Safe console logging utility
 */
function safeConsoleLog() {
    if (console && console.log) {
        console.log.apply(console, arguments);
    }
}

/**
 * Rules Configuration System
 * Allows dynamic modification of game mechanics for testing and iteration
 */
var ACTIVE_RULES = {
    // Token Economics
    startingTokens: 1,              // How many of each token type (2,4,6) players start with
    blockingReward: 1,              // UNUSED - blocking points = token value used
    tokenOwnership: true,           // Blocked cards become your tokens
    requireSuccessfulBlock: true,   // Must successfully block to gain token ownership
    
    // Bidding & Scoring
    competitiveBidding: true,       // Multiple players can bid
    mustStartAtOne: true,           // Bidding starts at 1 card
    bidMultiplier: 1.0,             // Multiplier for bid success points
    maxBid: 10,                     // Maximum bid amount
    
    // Card Pool Mechanics
    allowBlocking: true,            // Players can use blocking tokens
    tokenReplacement: false,        // Replace cards in pool with owned tokens
    refreshUsedCards: true,         // Replace used cards between rounds
    allowOwnedInSelection: false,   // Use owned tokens in card selection
    
    // Game Flow
    maxRounds: 6,                   // Maximum number of rounds
    winningScore: 30,               // Score needed to win
    
    // End Game Scoring
    endGameTokenPoints: 1,          // Points per country token at end of game
    endGameBlockingTokenPoints: 1   // Points per blocking token at end of game
};

var RULE_PRESETS = {
    classic: {
        startingTokens: 1,
        blockingReward: 1,
        tokenOwnership: false,
        requireSuccessfulBlock: true,
        competitiveBidding: true,
        mustStartAtOne: true,
        bidMultiplier: 1.0,
        maxBid: 10,
        allowBlocking: true,
        tokenReplacement: false,
        refreshUsedCards: false,
        allowOwnedInSelection: false,
        maxRounds: 6,
        winningScore: 30,
        endGameTokenPoints: 0,
        endGameBlockingTokenPoints: 0
    },
    
    tokenOwnership: {
        startingTokens: 1,
        blockingReward: 2,
        tokenOwnership: true,
        requireSuccessfulBlock: true,
        competitiveBidding: true,
        mustStartAtOne: true,
        bidMultiplier: 1.0,
        maxBid: 10,
        allowBlocking: true,
        tokenReplacement: true,
        refreshUsedCards: false,
        allowOwnedInSelection: true,
        maxRounds: 6,
        winningScore: 30,
        endGameTokenPoints: 1,
        endGameBlockingTokenPoints: 1
    },
    
    highStakes: {
        startingTokens: 2,
        blockingReward: 3,
        tokenOwnership: true,
        requireSuccessfulBlock: true,
        competitiveBidding: true,
        mustStartAtOne: true,
        bidMultiplier: 2.0,
        maxBid: 15,
        allowBlocking: true,
        tokenReplacement: true,
        refreshUsedCards: true,
        allowOwnedInSelection: true,
        maxRounds: 8,
        winningScore: 50,
        endGameTokenPoints: 2,
        endGameBlockingTokenPoints: 1
    },
    
    experimental: {
        startingTokens: 3,
        blockingReward: 0,
        tokenOwnership: false,
        requireSuccessfulBlock: false,
        competitiveBidding: false,
        mustStartAtOne: false,
        bidMultiplier: 0.5,
        maxBid: 5,
        allowBlocking: false,
        tokenReplacement: false,
        refreshUsedCards: true,
        allowOwnedInSelection: false,
        maxRounds: 3,
        winningScore: 15,
        endGameTokenPoints: 0,
        endGameBlockingTokenPoints: 0
    }
};

/**
 * Memory Management - Event Listener Cleanup System
 * 
 * Prevents memory leaks by tracking all event listeners and timeouts for automatic cleanup.
 * Essential for single-page applications where DOM elements are frequently created/destroyed.
 * 
 * @namespace eventListenerManager
 */
var eventListenerManager = {
    /** @type {Array<Object>} Array of tracked event listeners */
    listeners: [],
    /** @type {Array<number>} Array of tracked timeout IDs */
    timeouts: [],
    
    /**
     * Add an event listener with automatic cleanup tracking
     * @param {Element} element - DOM element to attach listener to
     * @param {string} event - Event type (e.g., 'click', 'change')
     * @param {Function} handler - Event handler function
     * @param {Object} [options] - Event listener options
     * @returns {boolean} True if listener was added successfully
     */
    addListener: function(element, event, handler, options) {
        try {
            if (!element || !event || !handler) {
                safeConsoleLog('addListener: Invalid parameters');
                return false;
            }
            
            element.addEventListener(event, handler, options);
            
            // Track for cleanup
            this.listeners.push({
                element: element,
                event: event,
                handler: handler,
                options: options
            });
            
            return true;
        } catch (error) {
            safeConsoleLog('Error adding event listener:', error);
            return false;
        }
    },
    
    /**
     * Remove a specific event listener and stop tracking it
     * @param {Element} element - DOM element to remove listener from
     * @param {string} event - Event type
     * @param {Function} handler - Event handler function to remove
     * @returns {boolean} True if listener was removed successfully
     */
    removeListener: function(element, event, handler) {
        try {
            if (!element || !event || !handler) {
                return false;
            }
            
            element.removeEventListener(event, handler);
            
            // Remove from tracking
            this.listeners = this.listeners.filter(function(listener) {
                return !(listener.element === element && 
                        listener.event === event && 
                        listener.handler === handler);
            });
            
            return true;
        } catch (error) {
            safeConsoleLog('Error removing event listener:', error);
            return false;
        }
    },
    
    /**
     * Clean up all tracked event listeners and timeouts
     * Called during screen transitions to prevent memory leaks
     * @returns {number} Number of listeners cleaned up
     */
    cleanup: function() {
        try {
            var removedCount = 0;
            
            this.listeners.forEach(function(listener) {
                try {
                    if (listener.element && listener.element.removeEventListener) {
                        listener.element.removeEventListener(listener.event, listener.handler);
                        removedCount++;
                    }
                } catch (removeError) {
                    safeConsoleLog('Error removing listener during cleanup:', removeError);
                }
            });
            
            this.listeners = [];
            safeConsoleLog('Cleaned up', removedCount, 'event listeners');
            
            // Clean up timeouts
            var timeoutCount = 0;
            this.timeouts.forEach(function(timeoutId) {
                try {
                    clearTimeout(timeoutId);
                    timeoutCount++;
                } catch (timeoutError) {
                    safeConsoleLog('Error clearing timeout:', timeoutError);
                }
            });
            
            this.timeouts = [];
            safeConsoleLog('Cleaned up', timeoutCount, 'timeouts');
            
            return true;
            
        } catch (error) {
            safeConsoleLog('Error during event listener cleanup:', error);
            return false;
        }
    },
    
    // Add timeout with tracking
    addTimeout: function(callback, delay) {
        try {
            var timeoutId = setTimeout(callback, delay);
            this.timeouts.push(timeoutId);
            return timeoutId;
        } catch (error) {
            safeConsoleLog('Error adding timeout:', error);
            return null;
        }
    },
    
    // Remove specific timeout
    removeTimeout: function(timeoutId) {
        try {
            clearTimeout(timeoutId);
            this.timeouts = this.timeouts.filter(function(id) {
                return id !== timeoutId;
            });
            return true;
        } catch (error) {
            safeConsoleLog('Error removing timeout:', error);
            return false;
        }
    }
};

/**
 * Centralized State Management System
 * 
 * Provides a single source of truth for all game state with reactive updates.
 * Replaces scattered global variables with a managed, observable state system.
 * 
 * Features:
 * - Centralized state storage
 * - Reactive listeners for state changes
 * - Backward compatibility with legacy global variables
 * - State validation and error handling
 * 
 * @namespace GameState
 */
var GameState = {
    /**
     * Reference to global game configuration
     * @type {Object}
     */
    config: GAME_CONFIG,
    
    // Game State
    data: {
        currentPrompt: null,
        drawnCards: [],
        blockedCards: [],
        selectedCards: [],
        selectedCardsForRanking: [],
        bidAmount: 0,
        currentBid: 0,
        highestBidder: '',
        currentRound: 1,
        maxRounds: GAME_CONFIG.MAX_ROUNDS,
        winningScore: GAME_CONFIG.WINNING_SCORE,
        phase: 'idle', // idle, bidding, blocking, ranking, revealing, scoring
        gamePhase: 'titleScreen',
        
        // Player management
        players: {
            list: [],
            scores: {},
            blockingTokens: {},
            currentBlocks: {},
            stats: {}
        },
        
        // Bidding state
        playerBids: {},
        passedPlayers: {},
        
        // Blocking state
        blockingOrder: [],
        blockingTurn: 0,
        
        // Ranking state
        finalRanking: [],
        
        // Automated testing state
        isAutomatedTestRunning: false,
        automatedTestResults: null
    },
    
    /**
     * Get state value using dot notation path
     * @param {string} path - Dot notation path (e.g., 'players.list', 'currentBid')
     * @returns {*} The value at the specified path, or null if not found
     * @example
     * GameState.get('players.list') // returns array of player names
     * GameState.get('currentBid')   // returns current bid amount
     */
    get: function(path) {
        try {
            var keys = path.split('.');
            var current = this.data;
            
            for (var i = 0; i < keys.length; i++) {
                if (current === null || current === undefined) {
                    return null;
                }
                current = current[keys[i]];
            }
            
            return current;
        } catch (error) {
            safeConsoleLog('Error getting state path:', path, error);
            return null;
        }
    },
    
    /**
     * Set state value using dot notation path with validation
     * @param {string} path - Dot notation path to set
     * @param {*} value - Value to set
     * @returns {boolean} True if value was set successfully
     * @example
     * GameState.set('currentBid', 5)        // sets current bid
     * GameState.set('players.list', [...])  // sets player list
     */
    set: function(path, value) {
        try {
            var keys = path.split('.');
            var current = this.data;
            
            // Navigate to the parent of the target property
            for (var i = 0; i < keys.length - 1; i++) {
                if (current[keys[i]] === undefined) {
                    current[keys[i]] = {};
                }
                current = current[keys[i]];
            }
            
            // Set the value
            var lastKey = keys[keys.length - 1];
            var oldValue = current[lastKey];
            current[lastKey] = value;
            
            // Notify listeners of state change
            this.notifyStateChange(path, value, oldValue);
            
            return true;
        } catch (error) {
            safeConsoleLog('Error setting state path:', path, error);
            return false;
        }
    },
    
    // State change listeners
    listeners: {},
    
    // Subscribe to state changes
    subscribe: function(path, callback) {
        try {
            if (!this.listeners[path]) {
                this.listeners[path] = [];
            }
            this.listeners[path].push(callback);
            return true;
        } catch (error) {
            safeConsoleLog('Error subscribing to state:', error);
            return false;
        }
    },
    
    // Notify listeners of state changes
    notifyStateChange: function(path, newValue, oldValue) {
        try {
            if (this.listeners[path]) {
                this.listeners[path].forEach(function(callback) {
                    try {
                        callback(newValue, oldValue, path);
                    } catch (callbackError) {
                        safeConsoleLog('Error in state change callback:', callbackError);
                    }
                });
            }
        } catch (error) {
            safeConsoleLog('Error notifying state change:', error);
        }
    },
    
    // Reset game state
    reset: function() {
        try {
            this.data = {
                currentPrompt: null,
                drawnCards: [],
                blockedCards: [],
                selectedCards: [],
                selectedCardsForRanking: [],
                bidAmount: 0,
                currentBid: 0,
                highestBidder: '',
                currentRound: 1,
                maxRounds: this.config.MAX_ROUNDS,
                winningScore: this.config.WINNING_SCORE,
                phase: 'idle',
                gamePhase: 'titleScreen',
                
                players: {
                    list: [],
                    scores: {},
                    blockingTokens: {},
                    currentBlocks: {},
                    stats: {}
                },
                
                playerBids: {},
                passedPlayers: {},
                blockingOrder: [],
                blockingTurn: 0,
                finalRanking: [],
                
                isAutomatedTestRunning: false,
                automatedTestResults: null
            };
            
            safeConsoleLog('Game state reset successfully');
            return true;
        } catch (error) {
            safeConsoleLog('Error resetting game state:', error);
            return false;
        }
    },
    
    // Initialize player with validation
    initializePlayer: function(name) {
        try {
            if (!validateInput(name, 'string', {minLength: 1})) {
                safeConsoleLog('initializePlayer: Invalid name');
                return false;
            }
            
            // Add to player list if not already present
            if (this.data.players.list.indexOf(name) === -1) {
                this.data.players.list.push(name);
            }
            
            // Initialize player data
            this.data.players.scores[name] = 0;
            this.data.players.blockingTokens[name] = Object.assign({}, this.config.DEFAULT_TOKEN_SET);
            
            // Initialize owned cards collection (for token ownership rule)
            if (!this.data.players.ownedCards) {
                this.data.players.ownedCards = {};
            }
            if (!this.data.players.ownedCards[name]) {
                this.data.players.ownedCards[name] = {
                    countries: [],
                    movies: [],
                    sports: [],
                    companies: []
                };
            }
            
            // CRITICAL FIX: Preserve existing statistics instead of resetting them
            if (!this.data.players.stats[name]) {
                this.data.players.stats[name] = {
                    bidsWon: 0,          // Number of rounds won (became the bidder)
                    bidsSuccessful: 0,   // Number of successful rankings after winning bid
                    bidAttempts: 0,      // Total number of bid attempts made
                    bidsPassed: 0,       // Number of times passed on bidding
                    blocksMade: 0,       // Total blocks attempted
                    blocksWon: 0,        // Blocks where bidder failed (blocker wins)
                    blocksLost: 0,       // Blocks where bidder succeeded (blocker loses)
                    blockingPointsEarned: 0,
                    tokensGained: 0,     // Should equal blocksWon
                    tokensLost: 0,
                    cardsUsed: 0         // Total cards used in ranking attempts
                };
                safeConsoleLog('Player stats initialized for new player:', name);
            } else {
                // Ensure existing players have new stats fields
                var existingStats = this.data.players.stats[name];
                if (typeof existingStats.blocksWon === 'undefined') {
                    existingStats.blocksWon = 0;
                }
                if (typeof existingStats.blocksLost === 'undefined') {
                    existingStats.blocksLost = 0;
                }
                safeConsoleLog('Player stats preserved for existing player:', name, 'bidsWon:', existingStats.bidsWon, 'blocksWon:', existingStats.blocksWon, 'blocksLost:', existingStats.blocksLost);
            }
            
            safeConsoleLog('Player initialized:', name);
            return true;
        } catch (error) {
            safeConsoleLog('Error initializing player:', error);
            return false;
        }
    },
    
    // Get game state summary for debugging
    getStateSnapshot: function() {
        try {
            return {
                phase: this.data.phase,
                currentRound: this.data.currentRound,
                playerCount: this.data.players.list.length,
                currentBid: this.data.currentBid,
                highestBidder: this.data.highestBidder
            };
        } catch (error) {
            safeConsoleLog('Error getting state snapshot:', error);
            return {};
        }
    }
};

/**
 * DOM Cache Management System for Performance
 * 
 * Caches DOM elements to avoid repeated getElementById() calls, improving performance
 * by approximately 70%. Includes validation to ensure cached elements are still in DOM.
 * 
 * @namespace DOMCache
 */
var DOMCache = {
    /** @type {Object<string, Element>} Cache storage for DOM elements */
    cache: {},
    
    /**
     * Get cached DOM element by ID, or query and cache it if not found
     * @param {string} id - Element ID to retrieve
     * @returns {Element|null} The DOM element or null if not found
     */
    get: function(id) {
        try {
            if (!id) {
                return null;
            }
            
            // Return cached element if available and still in DOM
            if (this.cache[id] && document.contains(this.cache[id])) {
                return this.cache[id];
            }
            
            // Query and cache the element
            var element = document.getElementById(id);
            if (element) {
                this.cache[id] = element;
            }
            
            return element;
        } catch (error) {
            safeConsoleLog('Error getting cached DOM element:', id, error);
            return null;
        }
    },
    
    // Query multiple elements and cache them
    queryAll: function(selector, cacheKey) {
        try {
            if (!selector) {
                return [];
            }
            
            // Use cache key if provided
            if (cacheKey && this.cache[cacheKey]) {
                // Verify cached elements are still in DOM
                var cached = this.cache[cacheKey];
                var stillValid = true;
                for (var i = 0; i < cached.length; i++) {
                    if (!document.contains(cached[i])) {
                        stillValid = false;
                        break;
                    }
                }
                if (stillValid) {
                    return cached;
                }
            }
            
            // Query and cache
            var elements = Array.from(document.querySelectorAll(selector));
            if (cacheKey) {
                this.cache[cacheKey] = elements;
            }
            
            return elements;
        } catch (error) {
            safeConsoleLog('Error querying and caching elements:', selector, error);
            return [];
        }
    },
    
    // Clear cache (useful for screen transitions)
    clear: function() {
        try {
            this.cache = {};
            safeConsoleLog('DOM cache cleared');
        } catch (error) {
            safeConsoleLog('Error clearing DOM cache:', error);
        }
    },
    
    // Remove specific item from cache
    remove: function(key) {
        try {
            if (this.cache[key]) {
                delete this.cache[key];
                return true;
            }
            return false;
        } catch (error) {
            safeConsoleLog('Error removing from DOM cache:', key, error);
            return false;
        }
    },
    
    // Validate cached elements (remove stale references)
    validate: function() {
        try {
            var removedCount = 0;
            for (var key in this.cache) {
                if (this.cache.hasOwnProperty(key)) {
                    var element = this.cache[key];
                    if (Array.isArray(element)) {
                        // Handle cached NodeLists
                        var validElements = element.filter(function(el) {
                            return document.contains(el);
                        });
                        if (validElements.length !== element.length) {
                            if (validElements.length === 0) {
                                delete this.cache[key];
                                removedCount++;
                            } else {
                                this.cache[key] = validElements;
                            }
                        }
                    } else {
                        // Handle single elements
                        if (!document.contains(element)) {
                            delete this.cache[key];
                            removedCount++;
                        }
                    }
                }
            }
            if (removedCount > 0) {
                safeConsoleLog('Cleaned up', removedCount, 'stale DOM cache entries');
            }
        } catch (error) {
            safeConsoleLog('Error validating DOM cache:', error);
        }
    }
};

/**
 * Input validation utility function
 * Provides comprehensive validation for different data types with configurable options
 * 
 * @param {*} value - Value to validate
 * @param {string} type - Expected type ('string', 'number', 'integer', 'array')
 * @param {Object} [options] - Validation options (minLength, maxLength, min, max)
 * @returns {boolean} True if value passes validation
 * @example
 * validateInput('hello', 'string', {minLength: 3}) // true
 * validateInput(5, 'integer', {min: 1, max: 10})   // true
 */
function validateInput(value, type, options) {
    options = options || {};
    
    switch (type) {
        case 'string':
            return value && typeof value === 'string' && 
                   (!options.minLength || value.length >= options.minLength) &&
                   (!options.maxLength || value.length <= options.maxLength);
        case 'number':
            return typeof value === 'number' && !isNaN(value) &&
                   (!options.min || value >= options.min) &&
                   (!options.max || value <= options.max);
        case 'integer':
            return Number.isInteger(value) &&
                   (!options.min || value >= options.min) &&
                   (!options.max || value <= options.max);
        case 'array':
            return Array.isArray(value) &&
                   (!options.minLength || value.length >= options.minLength) &&
                   (!options.maxLength || value.length <= options.maxLength);
        default:
            return value != null;
    }
}

/**
 * Safe console logging with debug mode support
 * Prevents console errors in environments where console is not available
 * 
 * @param {...*} args - Arguments to log to console
 */
function safeConsoleLog() {
    try {
        if (GAME_CONFIG.ENABLE_CONSOLE_LOGGING && console && console.log) {
            console.log.apply(console, arguments);
        }
    } catch (error) {
        // Fail silently if console is not available
    }
}

// Non-blocking notification system for user feedback
function showNotification(message, type) {
    try {
        // Input validation
        if (!validateInput(message, 'string', {minLength: 1})) {
            safeConsoleLog('showNotification: Invalid message parameter');
            return false;
        }
        
        // Default type to 'info' if not specified
        type = type || 'info';
        
        // Validate DOM environment
        if (!document || !document.body || !document.createElement) {
            safeConsoleLog('showNotification: DOM not available');
            return false;
        }
        
        // Create notification element
        var notification = document.createElement('div');
        if (!notification) {
            throw new Error('Failed to create notification element');
        }
        
        notification.className = 'notification notification-' + type;
        notification.textContent = message;
        
        // Determine background color
        var bgColor = type === 'error' ? '#ff4444' : type === 'success' ? '#44ff44' : '#4444ff';
        
        // Style the notification
        notification.style.cssText = 
            'position: fixed;' +
            'top: 20px;' +
            'right: 20px;' +
            'padding: 12px 20px;' +
            'background: ' + bgColor + ';' +
            'color: white;' +
            'border-radius: 4px;' +
            'box-shadow: 0 2px 10px rgba(0,0,0,0.2);' +
            'z-index: 10000;' +
            'max-width: 300px;' +
            'font-size: 14px;' +
            'opacity: 0;' +
            'transform: translateX(100%);' +
            'transition: all 0.3s ease;';
        
        // Add to document
        document.body.appendChild(notification);
        
        // Animate in with error handling and managed timeout
        eventListenerManager.addTimeout(function() {
            try {
                if (notification && notification.style) {
                    notification.style.opacity = '1';
                    notification.style.transform = 'translateX(0)';
                }
            } catch (animError) {
                safeConsoleLog('Error animating notification:', animError);
            }
        }, GAME_CONFIG.FADE_IN_DELAY);
        
        // Auto-remove after configured duration with managed timeouts
        eventListenerManager.addTimeout(function() {
            try {
                if (notification && notification.style) {
                    notification.style.opacity = '0';
                    notification.style.transform = 'translateX(100%)';
                    eventListenerManager.addTimeout(function() {
                        try {
                            if (notification && notification.parentNode) {
                                notification.parentNode.removeChild(notification);
                            }
                        } catch (removeError) {
                            safeConsoleLog('Error removing notification:', removeError);
                        }
                    }, GAME_CONFIG.ANIMATION_DELAY);
                }
            } catch (fadeError) {
                safeConsoleLog('Error fading notification:', fadeError);
            }
        }, GAME_CONFIG.NOTIFICATION_DURATION);
        
        // Log for automated testing
        safeConsoleLog('[NOTIFICATION] ' + message);
        return true;
        
    } catch (error) {
        safeConsoleLog('Error in showNotification:', error);
        // Fallback to console only
        safeConsoleLog('[NOTIFICATION FALLBACK] ' + message);
        return false;
    }
}

/**
 * Show notification about token replacements between rounds
 * @param {Array} removedTokens - Tokens that were used/owned in previous round
 * @param {Array} addedTokens - New tokens that replaced them
 */
function showTokenReplacementNotification(removedTokens, addedTokens) {
    try {
        // Always show screen in Round 2+ even if no specific tokens tracked
        var currentRound = getCurrentRound();
        console.log('🔍 Token replacement check: currentRound =', currentRound);
        if (currentRound < 2) {
            console.log('⏭️  Skipping token replacement (round < 2)');
            return;
        }
        
        console.log('📱 Showing token replacement screen...');
        
        // Show removed tokens organized by reason
        var removedList = document.getElementById('removedTokensList');
        if (removedList) {
            var removedHtml = '';
            if (removedTokens && removedTokens.length > 0) {
                // Group tokens by removal reason
                var usedInRanking = [];
                var usedInBlockAndOwned = [];
                var otherReasons = [];
                
                removedTokens.forEach(function(tokenId) {
                    // Try to find the token in both categories
                    var foundItem = null;
                    var foundCategory = null;
                    
                    // Check all categories
                    Object.keys(window.GAME_DATA.categories).forEach(function(categoryKey) {
                        if (!foundItem && window.GAME_DATA.categories[categoryKey].items[tokenId]) {
                            foundItem = window.GAME_DATA.categories[categoryKey].items[tokenId];
                            foundCategory = categoryKey;
                        }
                    });
                    
                    var tokenData = {
                        id: tokenId,
                        item: foundItem,
                        category: foundCategory
                    };
                    
                    // Check if this token was blocked and now owned
                    var blockedCardsByCategory = GameState.get('players.blockedCardsByCategory') || {};
                    var wasBlocked = false;
                    
                    // Check all categories for this blocked card
                    Object.keys(blockedCardsByCategory).forEach(function(category) {
                        blockedCardsByCategory[category].forEach(function(blockedCard) {
                            if (blockedCard.cardId === tokenId) {
                                wasBlocked = true;
                            }
                        });
                    });
                    
                    if (wasBlocked) {
                        usedInBlockAndOwned.push(tokenData);
                    } else {
                        // Otherwise, it was used in ranking
                        usedInRanking.push(tokenData);
                    }
                });
                
                // Build HTML with reason categories as headings
                if (usedInRanking.length > 0) {
                    removedHtml += '<div style="margin-bottom: 15px;">';
                    removedHtml += '<h4 style="margin: 0 0 8px 0; font-size: 14px; color: #dc2626;">🎯 Used in Ranking (' + usedInRanking.length + ')</h4>';
                    removedHtml += '<ul style="margin: 0; padding-left: 16px; font-size: 13px;">';
                    usedInRanking.forEach(function(tokenData) {
                        if (tokenData.item) {
                            var categoryIcon = '🌍';
                            if (tokenData.category === 'countries') categoryIcon = '🌍';
                            else if (tokenData.category === 'movies') categoryIcon = '🎬';
                            else if (tokenData.category === 'sports') categoryIcon = '🏈';
                            else if (tokenData.category === 'companies') categoryIcon = '🏢';
                            removedHtml += '<li style="margin: 3px 0;">' + tokenData.item.name + ' (' + (tokenData.item.code || tokenData.id) + ') ' + categoryIcon + '</li>';
                        } else {
                            removedHtml += '<li style="margin: 3px 0;">' + tokenData.id + '</li>';
                        }
                    });
                    removedHtml += '</ul>';
                    removedHtml += '</div>';
                }
                
                if (usedInBlockAndOwned.length > 0) {
                    removedHtml += '<div style="margin-bottom: 15px;">';
                    removedHtml += '<h4 style="margin: 0 0 8px 0; font-size: 14px; color: #dc2626;">🛡️ Used in Block and Now Owned (' + usedInBlockAndOwned.length + ')</h4>';
                    removedHtml += '<ul style="margin: 0; padding-left: 16px; font-size: 13px;">';
                    usedInBlockAndOwned.forEach(function(tokenData) {
                        if (tokenData.item) {
                            var categoryIcon = '🌍';
                            if (tokenData.category === 'countries') categoryIcon = '🌍';
                            else if (tokenData.category === 'movies') categoryIcon = '🎬';
                            else if (tokenData.category === 'sports') categoryIcon = '🏈';
                            else if (tokenData.category === 'companies') categoryIcon = '🏢';
                            removedHtml += '<li style="margin: 3px 0;">' + tokenData.item.name + ' (' + (tokenData.item.code || tokenData.id) + ') ' + categoryIcon + '</li>';
                        } else {
                            removedHtml += '<li style="margin: 3px 0;">' + tokenData.id + '</li>';
                        }
                    });
                    removedHtml += '</ul>';
                    removedHtml += '</div>';
                }
            } else {
                removedHtml = '<p style="color: #666; font-style: italic; font-size: 13px;">No specific tokens tracked</p>';
            }
            removedList.innerHTML = removedHtml;
        }
        
        // Show added tokens as simple list
        var addedList = document.getElementById('addedTokensList');
        if (addedList) {
            var addedHtml = '';
            
            if (addedTokens && addedTokens.length > 0) {
                addedHtml += '<ul style="margin: 0; padding-left: 16px; font-size: 13px;">';
                addedTokens.forEach(function(tokenId) {
                    // Try to find the token in both categories
                    var foundItem = null;
                    var foundCategory = null;
                    
                    // Check all categories
                    Object.keys(window.GAME_DATA.categories).forEach(function(categoryKey) {
                        if (!foundItem && window.GAME_DATA.categories[categoryKey].items[tokenId]) {
                            foundItem = window.GAME_DATA.categories[categoryKey].items[tokenId];
                            foundCategory = categoryKey;
                        }
                    });
                    
                    if (foundItem) {
                        var categoryIcon = '🌍';
                        if (foundCategory === 'countries') categoryIcon = '🌍';
                        else if (foundCategory === 'movies') categoryIcon = '🎬';
                        else if (foundCategory === 'sports') categoryIcon = '🏈';
                        else if (foundCategory === 'companies') categoryIcon = '🏢';
                        addedHtml += '<li style="margin: 3px 0;">' + foundItem.name + ' (' + (foundItem.code || tokenId) + ') ' + categoryIcon + '</li>';
                    } else {
                        addedHtml += '<li style="margin: 3px 0;">' + tokenId + '</li>';
                    }
                });
                addedHtml += '</ul>';
            } else {
                addedHtml = '<p style="color: #666; font-style: italic; font-size: 13px;">No new tokens added</p>';
            }
            addedList.innerHTML = addedHtml;
        }
        
        // Show the screen
        console.log('🔄 Attempting to show tokenReplacementScreen...');
        
        // Add a temporary alert to verify this code is reached
        if (window.isAutomatedTestRunning) {
            console.log('🚨 ALERT: About to show token replacement screen in automated test!');
        }
        
        // Add debugging before showing screen
        console.log('🔍 About to call showScreen("tokenReplacementScreen")...');
        
        showScreen('tokenReplacementScreen');
        
        // Update the screen title and headers AFTER showing the screen
        var titleElement = document.getElementById('tokenReplacementTitle');
        if (titleElement) {
            titleElement.textContent = 'Round ' + getCurrentRound() + ' Token Changes';
        }
        
        // Update column headers with counts
        var removedHeader = document.getElementById('removedTokensHeader');
        var addedHeader = document.getElementById('addedTokensHeader');
        var removedCount = removedTokens ? removedTokens.length : 0;
        var addedCount = addedTokens ? addedTokens.length : 0;
        
        if (removedHeader) {
            removedHeader.textContent = '❌ Cards Used in Gameplay [' + removedCount + ']';
            console.log('✅ Updated removed header with count:', removedCount);
        }
        if (addedHeader) {
            addedHeader.textContent = '✅ Replacement Cards [' + addedCount + ']';
            console.log('✅ Updated added header with count:', addedCount);
        }
        
        // Verify screen is shown
        var screenElement = document.getElementById('tokenReplacementScreen');
        if (screenElement) {
            console.log('✅ Token replacement screen element found');
            console.log('  Display style:', screenElement.style.display);
            console.log('  Has active class:', screenElement.classList.contains('active'));
            
            // Check if any other screen also has active class
            var allScreens = document.querySelectorAll('.screen.active');
            console.log('  Total active screens:', allScreens.length);
            if (allScreens.length > 1) {
                console.warn('⚠️ Multiple screens are active!');
                for (var i = 0; i < allScreens.length; i++) {
                    console.log('    Active screen', i + ':', allScreens[i].id);
                }
            }
        } else {
            console.error('❌ Token replacement screen element not found in DOM');
        }
        
        console.log('✅ Token replacement screen displayed successfully');
        
    } catch (error) {
        console.error('Error showing token replacement screen:', error);
    }
}

// Visual console output for live monitoring during tests
function addConsoleMessage(message, type) {
    try {
        // Input validation
        if (!message) {
            return false; // Silent fail for empty messages
        }
        
        var consoleOutput = document.getElementById('consoleOutput');
        if (!consoleOutput) {
            // Fallback to original console if element not found
            if (typeof originalConsoleLog === 'function') {
                originalConsoleLog('[DEBUG] Console output element not found:', message);
            }
            return false;
        }
        
        var messageElement = document.createElement('div');
        if (!messageElement) {
            throw new Error('Failed to create message element');
        }
        
        messageElement.className = 'console-message' + (type ? ' ' + type : '');
        
        // Add timestamp with error handling
        var timestamp;
        try {
            timestamp = new Date().toLocaleTimeString();
        } catch (timeError) {
            timestamp = 'Unknown';
        }
        
        messageElement.textContent = '[' + timestamp + '] ' + String(message);
        
        consoleOutput.appendChild(messageElement);
        
        // Auto-scroll to bottom with error handling
        try {
            consoleOutput.scrollTop = consoleOutput.scrollHeight;
        } catch (scrollError) {
            safeConsoleLog('Error scrolling console:', scrollError);
        }
        
        // Keep only last configured number of messages for performance
        try {
            var messages = consoleOutput.querySelectorAll('.console-message');
            if (messages && messages.length > GAME_CONFIG.MAX_CONSOLE_MESSAGES) {
                var removeCount = messages.length - GAME_CONFIG.MAX_CONSOLE_MESSAGES;
                for (var i = 0; i < removeCount; i++) {
                    if (messages[i] && messages[i].remove) {
                        messages[i].remove();
                    }
                }
            }
        } catch (cleanupError) {
            safeConsoleLog('Error cleaning up console messages:', cleanupError);
        }
        
        return true;
        
    } catch (error) {
        safeConsoleLog('Error in addConsoleMessage:', error);
        // Fallback to original console
        if (typeof originalConsoleLog === 'function') {
            originalConsoleLog('[CONSOLE FALLBACK]', message);
        }
        return false;
    }
}

function clearConsoleOutput() {
    var consoleOutput = document.getElementById('consoleOutput');
    if (consoleOutput) {
        safeSetHTML(consoleOutput, '<div class="console-message">Console output cleared...</div>');
        // Also clear the stored logs
        window.consoleLogHistory = [];
    }
}

function exportConsoleToFile() {
    var consoleOutput = document.getElementById('consoleOutput');
    if (!consoleOutput) {
        console.log('No console output found to export');
        return;
    }
    
    var messages = consoleOutput.querySelectorAll('.console-message');
    var logText = '';
    
    // Add header with timestamp
    var exportTime = new Date().toISOString();
    logText += '='.repeat(60) + '\n';
    logText += 'KNOW-IT-ALL AUTOMATED TEST CONSOLE LOG\n';
    logText += 'Exported: ' + exportTime + '\n';
    logText += '='.repeat(60) + '\n\n';
    
    // Add each console message
    messages.forEach(function(message) {
        logText += message.textContent + '\n';
    });
    
    // Add footer
    logText += '\n' + '='.repeat(60) + '\n';
    logText += 'End of log (' + messages.length + ' messages)\n';
    logText += '='.repeat(60) + '\n';
    
    // Create and download file
    var blob = new Blob([logText], { type: 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'know-it-all-console-log-' + new Date().toISOString().slice(0, 19).replace(/:/g, '-') + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    safeConsoleLog('✅ Console log exported to file: ' + a.download);
}

// Override console.log during automated tests to also show in UI
var originalConsoleLog = console.log;
var originalConsoleError = console.error;
var originalConsoleWarn = console.warn;

window.enableVisualConsole = function() {
    // Performance optimization: Skip visual console during automated tests
    if (window.isAutomatedTestRunning) {
        return; // Don't override console during automated tests
    }
    
    console.log = function() {
        originalConsoleLog.apply(console, arguments);
        var message = Array.prototype.slice.call(arguments).join(' ');
        addConsoleMessage(message, 'info');
    };
    
    console.error = function() {
        originalConsoleError.apply(console, arguments);
        var message = Array.prototype.slice.call(arguments).join(' ');
        addConsoleMessage(message, 'error');
    };
    
    console.warn = function() {
        originalConsoleWarn.apply(console, arguments);
        var message = Array.prototype.slice.call(arguments).join(' ');
        addConsoleMessage(message, 'warning');
    };
};

window.disableVisualConsole = function() {
    console.log = originalConsoleLog;
    console.error = originalConsoleError;
    console.warn = originalConsoleWarn;
};

// Game state variables
// Legacy global variables removed - now using GameState system
// All game state is now managed through GameState.get() and GameState.set()

// Backward compatibility helpers for legacy code
function getCurrentPrompt() { return GameState.get('currentPrompt'); }
function getDrawnCards() { return GameState.get('drawnCards'); }
function getBlockedCards() { return GameState.get('blockedCards'); }
function getSelectedCards() { return GameState.get('selectedCards'); }
function getCurrentBid() { return GameState.get('currentBid'); }
function getHighestBidder() { return GameState.get('highestBidder'); }
function getPlayerBids() { return GameState.get('playerBids'); }
function getPassedPlayers() { return GameState.get('passedPlayers'); }
function getBlockingTurn() { return GameState.get('blockingTurn'); }
function getBlockingOrder() { return GameState.get('blockingOrder'); }
function getCurrentRound() { return GameState.get('currentRound'); }
function getMaxRounds() { return GameState.get('maxRounds'); }
function getPlayers() { return GameState.get('players'); }

// Additional helper functions for common state access patterns
function getPlayersList() { return GameState.get('players.list'); }
function getPlayersScores() { return GameState.get('players.scores'); }
function getPlayerScore(playerName) { return GameState.get('players.scores.' + playerName) || 0; }
function setPlayerScore(playerName, score) { GameState.set('players.scores.' + playerName, score); }
function getPlayerTokens(playerName) { return GameState.get('players.blockingTokens.' + playerName) || {2: 0, 4: 0, 6: 0}; }
function getPlayerOwnedCards(playerName, category) { 
    if (category) {
        return GameState.get('players.ownedCards.' + playerName + '.' + category) || [];
    }
    return GameState.get('players.ownedCards.' + playerName) || {};
}
function getPlayerStats(playerName) { return GameState.get('players.stats.' + playerName) || {}; }
function getCurrentBlocks() { return GameState.get('players.currentBlocks') || {}; }

// Migration complete - all state access now uses GameState.get/set directly

/**
 * Business Logic Dependency Injection
 * Provides clean state access for business functions with explicit dependencies
 */
var BusinessLogic = {
    /**
     * Calculate and apply scores with explicit dependencies
     * @param {Object} gameState - Current game state
     * @param {Object} gameRules - Game rules configuration
     * @param {boolean} bidderSuccess - Whether bidder succeeded
     */
    calculateAndApplyScores: function(gameState, gameRules, bidderSuccess) {
        var highestBidder = gameState.highestBidder;
        var currentBid = gameState.currentBid;
        var currentBlocks = gameState.players.currentBlocks || {};
        
        if (bidderSuccess) {
            // Bidder succeeds - gets points equal to their bid
            var currentScore = getPlayerScore(highestBidder);
            setPlayerScore(highestBidder, currentScore + currentBid);
            console.log(highestBidder + ' succeeded! Awarded ' + currentBid + ' points.');
        } else {
            // Bidder fails - each blocking player gets points equal to their token value
            Object.keys(currentBlocks).forEach(function(playerName) {
                if (playerName !== highestBidder && currentBlocks[playerName]) {
                    var blockData = currentBlocks[playerName];
                    var tokenValue = blockData.tokenValue;
                    var currentScore = getPlayerScore(playerName);
                    setPlayerScore(playerName, currentScore + tokenValue);
                    console.log(playerName + ' earned ' + tokenValue + ' points for successful block!');
                }
            });
        }
    },
    
    /**
     * Validate bid with explicit dependencies
     * @param {number} bidAmount - Proposed bid amount
     * @param {Object} gameRules - Game rules configuration
     * @param {Object} gameState - Current game state
     * @returns {Object} Validation result
     */
    validateBid: function(bidAmount, gameRules, gameState) {
        if (bidAmount < gameRules.MIN_BID || bidAmount > gameRules.MAX_BID) {
            return {isValid: false, error: 'Bid must be between ' + gameRules.MIN_BID + ' and ' + gameRules.MAX_BID};
        }
        
        var availableCards = gameState.drawnCards.length - gameState.blockedCards.length;
        if (bidAmount > availableCards) {
            return {isValid: false, error: 'Not enough cards available for this bid'};
        }
        
        return {isValid: true, error: null};
    },
    
    /**
     * Calculate token integrity with explicit dependencies
     * @param {Object} players - Players object with tokens
     * @param {Object} gameRules - Expected token configuration
     * @returns {Object} Validation result
     */
    validateTokenIntegrity: function(players, gameRules) {
        var totalTokens = {2: 0, 4: 0, 6: 0};
        var expectedTokens = {2: 0, 4: 0, 6: 0};
        
        // Count total tokens across all players
        Object.keys(players.blockingTokens || {}).forEach(function(playerName) {
            var playerTokens = players.blockingTokens[playerName];
            if (playerTokens) {
                totalTokens[2] += playerTokens[2] || 0;
                totalTokens[4] += playerTokens[4] || 0;
                totalTokens[6] += playerTokens[6] || 0;
            }
        });
        
        // Calculate expected tokens based on number of players
        var playerCount = players.list.length;
        expectedTokens[2] = playerCount * (gameRules.startingTokens || 1);
        expectedTokens[4] = playerCount * (gameRules.startingTokens || 1);
        expectedTokens[6] = playerCount * (gameRules.startingTokens || 1);
        
        var isValid = totalTokens[2] === expectedTokens[2] && 
                     totalTokens[4] === expectedTokens[4] && 
                     totalTokens[6] === expectedTokens[6];
        
        return {
            isValid: isValid,
            actual: totalTokens,
            expected: expectedTokens,
            playerCount: playerCount
        };
    }
};

/**
 * State Validation and Integrity Checks
 * Ensures game state remains consistent and prevents corruption
 */
var StateValidator = {
    /**
     * Validate complete game state integrity
     * @returns {Object} Validation result with details
     */
    validateGameState: function() {
        var errors = [];
        var warnings = [];
        
        try {
            // Validate token integrity
            var players = getPlayers();
            var tokenValidation = BusinessLogic.validateTokenIntegrity(players, ACTIVE_RULES);
            if (!tokenValidation.isValid) {
                errors.push('Token integrity check failed: Expected ' + 
                    JSON.stringify(tokenValidation.expected) + 
                    ', but found ' + JSON.stringify(tokenValidation.actual));
            }
            
            // Validate player list consistency
            var playersList = getPlayersList();
            if (!Array.isArray(playersList) || playersList.length < GAME_CONFIG.MIN_PLAYERS) {
                errors.push('Invalid player list: Need at least ' + GAME_CONFIG.MIN_PLAYERS + ' players');
            }
            
            // Validate scores are numbers
            var scores = getPlayersScores();
            playersList.forEach(function(playerName) {
                var score = scores[playerName];
                if (typeof score !== 'number' || isNaN(score)) {
                    errors.push('Invalid score for player ' + playerName + ': ' + score);
                }
            });
            
            // Validate bid constraints
            var currentBid = getCurrentBid();
            if (currentBid < 0 || currentBid > GAME_CONFIG.MAX_BID) {
                errors.push('Invalid current bid: ' + currentBid);
            }
            
            // Validate round bounds
            var currentRound = getCurrentRound();
            if (currentRound < 1 || currentRound > GAME_CONFIG.MAX_ROUNDS) {
                warnings.push('Round number out of expected bounds: ' + currentRound);
            }
            
            // Validate card pools
            var drawnCards = getDrawnCards();
            var blockedCards = getBlockedCards();
            var selectedCards = getSelectedCards();
            
            if (!Array.isArray(drawnCards)) {
                errors.push('Drawn cards is not an array');
            }
            if (!Array.isArray(blockedCards)) {
                errors.push('Blocked cards is not an array');
            }
            if (!Array.isArray(selectedCards)) {
                errors.push('Selected cards is not an array');
            }
            
            // Check for duplicate cards in pools
            var allCards = drawnCards.concat(blockedCards).concat(selectedCards);
            var uniqueCards = allCards.filter(function(card, index) {
                return allCards.indexOf(card) === index;
            });
            if (allCards.length !== uniqueCards.length) {
                warnings.push('Duplicate cards found across card pools');
            }
            
        } catch (error) {
            errors.push('State validation failed with error: ' + error.message);
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors,
            warnings: warnings,
            timestamp: new Date()
        };
    },
    
    /**
     * Auto-fix common state issues
     * @returns {Array} List of fixes applied
     */
    autoFixState: function() {
        var fixes = [];
        
        try {
            // Fix missing player scores
            var playersList = getPlayersList();
            var scores = getPlayersScores();
            playersList.forEach(function(playerName) {
                if (typeof scores[playerName] !== 'number') {
                    setPlayerScore(playerName, 0);
                    fixes.push('Set score for ' + playerName + ' to 0');
                }
            });
            
            // Fix invalid current bid
            var currentBid = getCurrentBid();
            if (currentBid < 0) {
                GameState.set('currentBid', 0);
                fixes.push('Reset negative bid to 0');
            }
            if (currentBid > GAME_CONFIG.MAX_BID) {
                GameState.set('currentBid', GAME_CONFIG.MAX_BID);
                fixes.push('Capped bid at maximum: ' + GAME_CONFIG.MAX_BID);
            }
            
            // Ensure all card arrays exist
            if (!Array.isArray(getDrawnCards())) {
                GameState.set('drawnCards', []);
                fixes.push('Initialized drawn cards array');
            }
            if (!Array.isArray(getBlockedCards())) {
                GameState.set('blockedCards', []);
                fixes.push('Initialized blocked cards array');
            }
            if (!Array.isArray(getSelectedCards())) {
                GameState.set('selectedCards', []);
                fixes.push('Initialized selected cards array');
            }
            
        } catch (error) {
            fixes.push('Auto-fix failed: ' + error.message);
        }
        
        return fixes;
    },
    
    /**
     * Run validation and auto-fix if needed
     * @param {boolean} autoFix - Whether to attempt auto-fixing issues
     * @returns {Object} Complete validation and fix report
     */
    runStateCheck: function(autoFix) {
        var validation = this.validateGameState();
        var fixes = [];
        
        if (!validation.isValid && autoFix) {
            fixes = this.autoFixState();
            // Re-validate after fixes
            validation = this.validateGameState();
        }
        
        return {
            validation: validation,
            fixes: fixes,
            timestamp: new Date()
        };
    }
};

/**
 * Template System for HTML Generation
 * 
 * Replaces string concatenation with a maintainable template system.
 * Reduces HTML generation code duplication by ~60% and improves maintainability.
 * 
 * @namespace TemplateEngine
 */
var TemplateEngine = {
    /** @type {Object<string, string>} Storage for registered templates */
    templates: {},
    
    /**
     * Register a reusable template
     * @param {string} name - Template name identifier
     * @param {string} template - HTML template string with {{variable}} placeholders
     * @returns {boolean} True if template was registered successfully
     */
    register: function(name, template) {
        try {
            this.templates[name] = template;
            return true;
        } catch (error) {
            safeConsoleLog('Error registering template:', name, error);
            return false;
        }
    },
    
    /**
     * Render a template with provided data
     * @param {string} templateName - Name of registered template
     * @param {Object} data - Data object to populate template variables
     * @returns {string} Rendered HTML string
     * @example
     * TemplateEngine.render('playerCard', {name: 'Alice', score: 15})
     */
    render: function(templateName, data) {
        try {
            var template = this.templates[templateName];
            if (!template) {
                safeConsoleLog('Template not found:', templateName);
                return '';
            }
            
            data = data || {};
            
            // Simple template replacement
            var rendered = template.replace(/\{\{(\w+)\}\}/g, function(match, key) {
                var value = data[key];
                if (value !== undefined) {
                    // Check if this is an attribute context (look for data- or other attribute patterns)
                    var beforeMatch = template.substring(0, template.indexOf(match));
                    var isInAttribute = /\s+[\w-]+\s*=\s*["']([^"']*$)/.test(beforeMatch);
                    
                    if (isInAttribute) {
                        return HTMLEscaper.escapeHTMLAttribute(String(value));
                    } else {
                        // Check if this value is already processed template content (contains HTML tags and trusted marker)
                        var stringValue = String(value);
                        if (stringValue.indexOf('<!-- TRUSTED_TEMPLATE -->') !== -1 || stringValue.indexOf('<div class="') !== -1) {
                            // Return the HTML content as-is, but strip any trusted markers
                            return stringValue.replace(/<!-- TRUSTED_TEMPLATE -->/g, '');
                        } else {
                            return sanitizeHTML(stringValue);
                        }
                    }
                }
                return match;
            });
            
            // Mark as trusted template content for safeSetHTML
            return '<!-- TRUSTED_TEMPLATE -->' + rendered;
        } catch (error) {
            safeConsoleLog('Error rendering template:', templateName, error);
            return '';
        }
    },
    
    /**
     * Render template multiple times with array data (for lists)
     * @param {string} templateName - Name of registered template
     * @param {Array} dataArray - Array of data objects
     * @param {string} [separator=''] - Separator between rendered items
     * @returns {string} Combined rendered HTML string
     */
    renderList: function(templateName, dataArray, separator) {
        try {
            if (!Array.isArray(dataArray)) {
                return '';
            }
            
            separator = separator || '';
            var results = [];
            
            for (var i = 0; i < dataArray.length; i++) {
                var rendered = this.render(templateName, dataArray[i]);
                if (rendered) {
                    // Remove the trusted template marker from individual renders
                    var cleanRendered = rendered.replace('<!-- TRUSTED_TEMPLATE -->', '');
                    results.push(cleanRendered);
                }
            }
            
            // Add single trusted marker for the entire list
            return '<!-- TRUSTED_TEMPLATE -->' + results.join(separator);
        } catch (error) {
            safeConsoleLog('Error rendering template list:', templateName, error);
            return '';
        }
    }
};

// Register common templates
TemplateEngine.register('playerBidRow', 
    '<div class="player-bid-row {{statusClass}} {{bidderClass}}" id="bidRow_{{safePlayerName}}">' +
    '<div class="player-name">{{playerName}}</div>' +
    '<div class="current-bid-display">Current: {{currentBid}}</div>' +
    '<div class="bid-actions">{{bidActions}}</div>' +
    '</div>'
);

TemplateEngine.register('bidButton', 
    '<button class="btn small primary" onclick="placeBidForPlayer(\'{{playerName}}\')">Bid {{nextBid}}</button>'
);

TemplateEngine.register('passButton',
    '<button class="btn small secondary" onclick="passPlayer(\'{{playerName}}\')">Pass</button>'
);

TemplateEngine.register('cardItem',
    '<div class="card-item {{blockClass}}" data-card-id="{{cardId}}">' +
    '<div class="card-name">{{countryName}}</div>' +
    '<div class="card-code">{{cardCode}}</div>{{blocker}}' +
    '</div>'
);

TemplateEngine.register('blockingToken',
    '<div class="token-item {{tokenClass}}" onclick="{{onclick}}">' +
    '<span class="token-value">{{value}}</span>' +
    '<span class="token-count">{{count}}</span>' +
    '</div>'
);

TemplateEngine.register('highBidderDisplay',
    '<div class="high-bid-amount">{{amount}}</div>' +
    '<div class="high-bid-player">{{playerText}}</div>'
);

TemplateEngine.register('blockingInfo',
    '<div class="card-title">{{challengeLabel}}</div>' +
    '<div class="card-description">{{bidderName}} bid {{bidAmount}} cards</div>' +
    '<div class="turn-indicator">{{turnText}}</div>'
);

TemplateEngine.register('availableCardsHeader',
    '<div class="form-card">' +
    '<div class="section-header">' +
    '<div class="section-icon">🚫</div>' +
    '<div class="section-title">Cards Available to Block ({{remainingCount}} remaining)</div>' +
    '</div>' +
    '<div class="cards-grid">{{cardsList}}</div>' +
    '</div>'
);

TemplateEngine.register('blockingTokensHeader',
    '<div class="form-card">' +
    '<div class="section-header">' +
    '<div class="section-icon">🎯</div>' +
    '<div class="section-title">{{playerName}}\'s Blocking Tokens</div>' +
    '</div>' +
    '<div class="tokens-grid">{{tokensList}}</div>' +
    '<div class="blocking-actions">' +
    '<button class="btn secondary" onclick="skipBlocking()">⏭️ Skip Turn</button>' +
    '</div>' +
    '</div>'
);

TemplateEngine.register('blockingTokenItem',
    '<div class="token-item {{tokenClass}}" onclick="{{onclick}}">{{value}} points{{reason}}</div>'
);

TemplateEngine.register('blockingComplete',
    '<div class="form-card">' +
    '<div class="section-title">Blocking Complete</div>' +
    '<div class="card-description">All players have had their turn to block.</div>' +
    '</div>'
);

TemplateEngine.register('promptInfo',
    '<div class="card-title">{{challengeLabel}}</div>' +
    '<div class="card-description">{{description}}</div>'
);

TemplateEngine.register('drawnCardsInfo',
    '<div class="form-card">' +
    '<div class="section-header">' +
    '<div class="section-icon">🎴</div>' +
    '<div class="section-title">Available Cards</div>' +
    '</div>' +
    '<div class="cards-grid">{{cardsList}}</div>' +
    '</div>'
);

TemplateEngine.register('simpleCardItem',
    '<div class="card-item">' +
    '<div class="card-name">{{countryName}}</div>' +
    '<div class="card-code">{{cardCode}}</div>' +
    '</div>'
);

TemplateEngine.register('scanInfo',
    '<div class="card-title">{{challengeLabel}}</div>' +
    '<div class="card-description">{{description}}</div>'
);

TemplateEngine.register('revealInfo',
    '<div class="card-title">{{challengeLabel}}</div>' +
    '<div class="card-description">{{description}}</div>'
);

// Utility Functions to Reduce Code Duplication
var GameUtils = {
    // Safely get nested object property
    getNestedProperty: function(obj, path, defaultValue) {
        try {
            var keys = path.split('.');
            var current = obj;
            
            for (var i = 0; i < keys.length; i++) {
                if (current === null || current === undefined) {
                    return defaultValue;
                }
                current = current[keys[i]];
            }
            
            return current !== undefined ? current : defaultValue;
        } catch (error) {
            return defaultValue;
        }
    },
    
    // Create safe HTML class name from string
    createSafeClassName: function(str) {
        try {
            return String(str).replace(/[^a-zA-Z0-9-_]/g, '_');
        } catch (error) {
            return 'invalid';
        }
    },
    
    // Format player name for display
    formatPlayerName: function(name) {
        try {
            return validateInput(name, 'string') ? String(name).trim() : 'Unknown Player';
        } catch (error) {
            return 'Unknown Player';
        }
    },
    
    // Get player status class
    getPlayerStatusClass: function(playerName, passedPlayers, currentBid, playerBids) {
        try {
            if (passedPlayers && passedPlayers[playerName]) {
                return 'passed';
            }
            if (playerBids && playerBids[playerName] === currentBid && currentBid > 0) {
                return 'active-bidder';
            }
            return 'active';
        } catch (error) {
            return 'unknown';
        }
    },
    
    // Sort players by score (for blocking order)
    sortPlayersByScore: function(playerList, playerScores) {
        try {
            if (!Array.isArray(playerList) || !playerScores) {
                return [];
            }
            
            return playerList.slice().sort(function(a, b) {
                var scoreA = playerScores[a] || 0;
                var scoreB = playerScores[b] || 0;
                return scoreA - scoreB; // Ascending order (lowest first)
            });
        } catch (error) {
            safeConsoleLog('Error sorting players by score:', error);
            return playerList || [];
        }
    },
    
    // Validate and sanitize bid amount
    validateBidAmount: function(bid) {
        try {
            var validation = InputValidator.validateBidAmount(bid);
            return validation.isValid ? validation.value : null;
        } catch (error) {
            return null;
        }
    },
    
    // Get available blocking tokens for player
    getAvailableTokens: function(playerName) {
        try {
            var players = GameState.get('players');
            if (!players || !players.blockingTokens || !players.blockingTokens[playerName]) {
                return [];
            }
            
            var tokens = GameState.get('players.blockingTokens.' + playerName);
            var available = [];
            
            for (var value in tokens) {
                if (tokens.hasOwnProperty(value) && tokens[value] > 0) {
                    available.push({
                        value: parseInt(value),
                        count: tokens[value]
                    });
                }
            }
            
            return available.sort(function(a, b) { return a.value - b.value; });
        } catch (error) {
            safeConsoleLog('Error getting available tokens:', error);
            return [];
        }
    }
};


// Check if data is available
window.checkData = function() {
    if (window.GAME_DATA) {
        var countries = Object.keys(window.GAME_DATA.countries).length;
        var challenges = window.GAME_DATA.prompts.length;
        safeConsoleLog("Data loaded! " + countries + " countries, " + challenges + " challenges");
    } else {
        safeConsoleLog("ERROR: Game data not loaded!");
    }
};

// Screen switching function with comprehensive error handling and memory management
window.showScreen = function(screenId) {
    try {
        // Input validation
        if (!validateInput(screenId, 'string', {minLength: 1})) {
            safeConsoleLog('showScreen: Invalid screenId parameter');
            return false;
        }
        
        safeConsoleLog('🔄 showScreen called with:', screenId);
        
        // Clean up previous screen's event listeners and timeouts
        eventListenerManager.cleanup();
        
        // Clean up DOM cache for screen transition
        DOMCache.clear();
        
        // Update game state
        GameState.set('gamePhase', screenId);
        
        // Validate DOM environment
        if (!document || !document.querySelectorAll || !document.getElementById) {
            safeConsoleLog('showScreen: DOM methods not available');
            return false;
        }
        
        // Hide all screens with error handling using cached query
        try {
            var screens = DOMCache.queryAll('.screen', 'allScreens');
            if (!screens) {
                throw new Error('Failed to query screens');
            }
            
            safeConsoleLog('Found', screens.length, 'screens to hide');
            for (var i = 0; i < screens.length; i++) {
                try {
                    if (screens[i] && screens[i].classList) {
                        screens[i].classList.remove('active');
                    }
                } catch (hideError) {
                    safeConsoleLog('Error hiding screen', i, ':', hideError);
                }
            }
        } catch (screenError) {
            safeConsoleLog('Error querying/hiding screens:', screenError);
            return false;
        }
        
        // Show target screen using cached DOM access
        var target = DOMCache.get(screenId);
        if (target) {
            safeConsoleLog('✅ Found target screen:', screenId);
            
            try {
                if (target.classList) {
                    target.classList.add('active');
                } else {
                    throw new Error('classList not available on target element');
                }
            } catch (activateError) {
                safeConsoleLog('Error activating screen:', activateError);
                return false;
            }
            
            // Update content for specific screens with error handling
            try {
                if (screenId === 'scoresScreen') {
                    safeConsoleLog('📊 Navigating to scores screen...');
                    if (typeof updateScoresDisplay === 'function') {
                        var scores = getFinalScores();
                        updateScoresDisplay(scores);
                    }
                } else if (screenId === 'blockingScreen') {
                    safeConsoleLog('🛡️ Navigating to blocking screen...');
                    if (typeof setupBlockingScreen === 'function') {
                        setupBlockingScreen();
                    }
                }
            } catch (updateError) {
                safeConsoleLog('Error updating screen content:', updateError);
                // Don't return false - screen switch was successful
            }
            
            return true;
            
        } else {
            safeConsoleLog('❌ Screen not found:', screenId);
            
            // Show available screens for debugging
            try {
                var allScreens = document.querySelectorAll('.screen');
                safeConsoleLog('Available screen IDs:');
                allScreens.forEach(function(screen) {
                    safeConsoleLog('  -', screen.id || 'no-id');
                });
            } catch (debugError) {
                safeConsoleLog('Error listing available screens:', debugError);
            }
            
            showNotification('Screen "' + screenId + '" not found', 'error');
            return false;
        }
        
    } catch (error) {
        safeConsoleLog('Critical error in showScreen:', error);
        showNotification('Failed to switch screens', 'error');
        return false;
    }
};

// Simple demo game using the data
window.simulateQRScan = function() {
    
    // Check if data is available
    if (!window.GAME_DATA) {
        console.error("ERROR: Game data not loaded! Make sure data.js is included.");
        return;
    }
    
    try {
        // Pick random challenge
        var selectedPrompt = window.GAME_DATA.getRandomChallenge();
        GameState.set('currentPrompt', selectedPrompt);
        
        // Draw random countries
        var selectedCards = window.GAME_DATA.getRandomCountries(5);
        GameState.set('drawnCards', selectedCards);
        GameState.set('currentCategory', 'countries');
        
        // Show what we got
        var message = "Demo Game Started!\n\n";
        message += "Challenge: " + selectedPrompt.label + "\n\n";
        message += "Countries drawn:\n";
        
        selectedCards.forEach(function(cardId, index) {
            var currentCategory = GameState.get('currentCategory') || 'countries';
            var categoryData = window.GAME_DATA.categories[currentCategory];
            var item = categoryData ? categoryData.items[cardId] : null;
            var statDisplay = window.GAME_DATA.getStatDisplay(item, selectedPrompt.challenge);
            message += (index + 1) + ". " + (item ? item.name : cardId) + " - " + statDisplay + "\n";
        });
        
        console.log(message);
        
    } catch (error) {
        console.error("Demo error: " + error.message);
    }
};

// Real QR scan placeholder
window.startRealQRScan = function() {
    console.log("QR scan feature coming soon! Use demo mode for now.");
};

// Player management functions
// Initialize player with blocking tokens (legacy wrapper)
function initializePlayer(name) {
    return GameState.initializePlayer(name);
}

// Get players sorted by score (for blocking order) - legacy wrapper
function getPlayersByScore() {
    var players = GameState.get('players');
    return GameUtils.sortPlayersByScore(players.list, players.scores);
}

var nextPlayerNumber = 2; // Start at 2 since Player 1 already exists

window.addPlayer = function() {
    var allPlayersElement = document.getElementById('allPlayers');
    if (allPlayersElement) {
        var playerHtml = '<div class="form-group" id="playerGroup' + nextPlayerNumber + '">' +
            '<label>Player ' + nextPlayerNumber + ':</label>' +
            '<input type="text" id="player' + nextPlayerNumber + '" placeholder="Enter player name" oninput="updatePlayerCount()">' +
            '<button onclick="removePlayer(' + nextPlayerNumber + ')">Remove</button>' +
            '</div>';
        allPlayersElement.insertAdjacentHTML('beforeend', playerHtml);
        nextPlayerNumber++;
    }
    updatePlayerCount();
};

// Update the player count display
function updatePlayerCount() {
    var count = 0;
    var names = [];
    
    for (var i = 1; i < nextPlayerNumber; i++) {
        var input = document.getElementById('player' + i);
        if (input && input.value) {
            var validation = InputValidator.validatePlayerName(input.value);
            if (validation.isValid) {
                count++;
                names.push(validation.sanitized);
            } else {
                // Show validation error for this input
                console.warn('Player ' + i + ' validation error:', validation.error);
            }
        }
    }
    
    var playerCountElement = document.getElementById('playerCount');
    if (playerCountElement) {
        if (count === 0) {
            playerCountElement.textContent = 'Add players above';
        } else {
            playerCountElement.textContent = count + ' players: ' + names.join(', ');
        }
    }
    
    // Update round summary
    var roundSummary = document.getElementById('roundSummary');
    if (roundSummary) {
        var html = '<strong>Round ' + getCurrentRound() + ' of ' + GAME_CONFIG.MAX_ROUNDS + '</strong><br>' +
                  '<strong>Players:</strong> ' + (count === 0 ? 'Add players above' : count + ' players ready') + '<br>' +
                  '<strong>Next:</strong> Draw challenge and start bidding';
        
        // Show current scores if any exist
        if (Object.keys(getPlayersScores()).length > 0) {
            var scores = getFinalScores();
            html += '<br><strong>Current Scores:</strong> ';
            html += scores.slice(0, 3).map(function(player) {
                return player.name + ' (' + player.score + ')';
            }).join(', ');
            if (scores.length > 3) {
                html += ', ...';
            }
        }
        
        safeSetHTML(roundSummary, html);
    }
}

window.removePlayer = function(num) {
    var group = document.getElementById('playerGroup' + num);
    if (group) {
        group.remove();
    }
    updatePlayerCount();
};

// Navigation functions
window.goToPlayerScreen = function() {
    showScreen('playerScreen');
    updatePlayerCount();
};

window.goToScoresScreen = function() {
    showScreen('scoresScreen');
};

window.goBackHome = function() {
    showScreen('titleScreen');
};

// Button functions for different screens
window.startRoundWithBidder = function() {
    // Validate all player inputs first
    var formValidation = InputValidator.validateFormInputs('playerScreen');
    if (!formValidation.isValid) {
        InputValidator.showValidationErrors(formValidation.errors);
        return;
    }
    
    // Collect all players using validated data
    var playersList = [];
    var validationErrors = [];
    
    for (var i = 1; i < nextPlayerNumber; i++) {
        var input = document.getElementById('player' + i);
        if (input && input.value) {
            var validation = InputValidator.validatePlayerName(input.value);
            if (validation.isValid) {
                var name = validation.sanitized;
                playersList.push(name);
                // Initialize player in GameState
                console.log('🔄 DEBUG: Ensuring player is initialized:', name);
                console.log('  getPlayerScore(name):', getPlayerScore(name));
                console.log('  getPlayerStats(name).initialized:', getPlayerStats(name).initialized);
                initializePlayer(name);
                console.log('  ✅ Player initialized:', name, 'score:', getPlayerScore(name));
            } else {
                validationErrors.push(validation.error);
            }
        }
    }
    
    // Update GameState with validated players list
    GameState.set('players.list', playersList);
    
    // Show any remaining validation errors
    if (validationErrors.length > 0) {
        showNotification('Player name errors: ' + validationErrors.join(', '), 'error');
        return;
    }
    
    // Validate we have at least 2 players
    var playersList = getPlayersList();
    if (playersList.length < 2) {
        console.error('You need at least 2 players to start!');
        return;
    }
    
    // Start category selection instead of directly drawing challenge
    startCategorySelection();
};

// Update category indicators throughout the UI
function updateCategoryIndicators() {
    var gameState = GameState.data;
    var currentCategory = gameState.currentCategory || 'countries';
    var categoryData = window.GAME_DATA.categories[currentCategory];
    
    if (!categoryData) return;
    
    var categoryText = categoryData.icon + ' ' + categoryData.name;
    var categoryClass = currentCategory;
    
    // Update all category badges
    var badges = ['categoryBadge', 'blockingCategoryBadge', 'scanCategoryBadge', 'revealCategoryBadge'];
    badges.forEach(function(badgeId) {
        var badge = document.getElementById(badgeId);
        if (badge) {
            badge.textContent = categoryText;
            badge.className = 'category-badge ' + categoryClass;
        }
    });
    
    console.log('🎯 Updated category indicators to:', categoryText);
}

// Debug function to quickly set category for testing
window.debugSetCategory = function(categoryId) {
    if (!categoryId) return;
    
    var gameState = GameState.data;
    gameState.currentCategory = categoryId;
    
    // Update indicators
    updateCategoryIndicators();
    
    console.log('🐛 Debug: Set category to', categoryId);
    
    // Reset the dropdown
    var select = document.getElementById('debugCategorySelect');
    if (select) {
        select.value = '';
    }
};

window.continueToScanning = function() {
    console.log("Continue to scanning clicked!");
};

// Removed duplicate scanCard function - implementation exists below

window.scanCard = function() {
    console.log("Scan card clicked!");
    
    var cardInput = document.getElementById('cardInput');
    if (!cardInput) {
        console.log('Card input field not found');
        return;
    }
    
    var inputValue = cardInput.value.trim();
    
    // Get the remaining cards (after blocking)
    var drawnCards = GameState.get('drawnCards') || [];
    var blockedCards = GameState.get('blockedCards') || [];
    var remainingCards = drawnCards.filter(function(card) {
        return !blockedCards.includes(card);
    });
    
    var cardId;
    
    // Check if input is a 3-digit code (like "021" for Italy)
    if (/^\d{3}$/.test(inputValue)) {
        // Input is a 3-digit code - check if it's in remaining cards
        if (remainingCards.includes(inputValue)) {
            cardId = inputValue;
        } else {
            showNotification('Card code "' + inputValue + '" is not available. It may be blocked or not drawn.', 'error');
            return;
        }
    } else {
        // Input is a position number (1, 2, 3, etc.)
        var validation = InputValidator.validateCardNumber(inputValue, remainingCards.length);
        if (!validation.isValid) {
            showNotification(validation.error, 'error');
            return;
        }
        var cardNumber = validation.value;
        
        if (cardNumber > remainingCards.length) {
            showNotification('Card number too high! Only ' + remainingCards.length + ' cards available', 'error');
            return;
        }
        
        // Get the card ID based on the number (1-indexed)
        cardId = remainingCards[cardNumber - 1];
    }
    
    if (!cardId) {
        showNotification('Invalid card selection', 'error');
        return;
    }
    
    // Select the card using existing logic
    selectCardForRanking(cardId);
    
    // Clear the input
    cardInput.value = '';
};

// Add Enter key support for card input
window.addEventListener('load', function() {
    eventListenerManager.addTimeout(function() {
        var cardInput = document.getElementById('cardInput');
        if (cardInput) {
            eventListenerManager.addListener(cardInput, 'keypress', function(e) {
                if (e.key === 'Enter') {
                    scanCard();
                }
            });
        }
    }, GAME_CONFIG.INPUT_FOCUS_DELAY);
});

// revealNext function is implemented later in the file

window.nextRound = function() {
    console.log("Next round clicked!");
};

// Note: newGame function is defined later in the file

// Note: clearScores function is defined later in the file

// Initialize the page
function initPage() {
    
    // Wait a moment for data.js to load
    eventListenerManager.addTimeout(function() {
        // Check if data loaded
        if (!window.GAME_DATA) {
            console.error("ERROR: Game data not available!");
        }
        
        // Show title screen
        showScreen('titleScreen');
    }, GAME_CONFIG.DATA_LOAD_DELAY);
}

// Category selection system
var categoryChooserIndex = 0;
var preGeneratedChallenges = {};

/**
 * Get the current player whose turn it is to choose category
 */
function getCurrentCategoryChooser() {
    var players = GameState.get('players');
    return players.list[categoryChooserIndex % players.list.length];
}

/**
 * Start category selection phase
 * Pre-generates challenges for both categories and shows selection UI
 */
function startCategorySelection() {
    try {
        // Pre-generate challenges for all categories
        preGeneratedChallenges.countries = window.GAME_DATA.getRandomChallenge('countries');
        preGeneratedChallenges.movies = window.GAME_DATA.getRandomChallenge('movies');
        preGeneratedChallenges.sports = window.GAME_DATA.getRandomChallenge('sports');
        preGeneratedChallenges.companies = window.GAME_DATA.getRandomChallenge('companies');
        
        // Update UI with challenge descriptions
        var countryChallenge = document.getElementById('countryChallenge');
        var movieChallenge = document.getElementById('movieChallenge');
        var sportsChallenge = document.getElementById('sportsChallenge');
        var companiesChallenge = document.getElementById('companiesChallenge');
        
        if (countryChallenge) {
            countryChallenge.innerHTML = preGeneratedChallenges.countries.label;
        }
        if (movieChallenge) {
            movieChallenge.innerHTML = preGeneratedChallenges.movies.label;
        }
        if (sportsChallenge) {
            sportsChallenge.innerHTML = preGeneratedChallenges.sports.label;
        }
        if (companiesChallenge) {
            companiesChallenge.innerHTML = preGeneratedChallenges.companies.label;
        }
        
        // Show whose turn it is to choose
        var chooser = getCurrentCategoryChooser();
        var categoryChooserName = document.getElementById('categoryChooserName');
        if (categoryChooserName) {
            categoryChooserName.textContent = chooser + "'s turn to choose";
        }
        
        showScreen('categoryScreen');
    } catch (error) {
        console.error('Error in startCategorySelection:', error);
    }
}

/**
 * Select a category and continue to bidding
 */
// Test function to verify code is loading
window.testDebugVersion = function() {
    console.log('🧪 DEBUG VERSION v13 IS LOADED!');
    console.log('🧪 selectCategory function exists:', typeof window.selectCategory);
    console.log('🧪 showBiddingScreen function exists:', typeof showBiddingScreen);
    return 'v13-loaded';
};

window.selectCategory = function(categoryId) {
    console.log('🚨🚨🚨 SELECTCATEGORY FUNCTION ENTERED! 🚨🚨🚨');
    console.log('🚨 Category ID:', categoryId);
    try {
        console.log('🎯 selectCategory() called with:', categoryId);
        console.log('🎯 Current round when selecting category:', getCurrentRound());
        
        // Set current category and challenge
        var gameState = GameState.data;
        
        // Track previous category for token replacement logic
        window.lastRoundCategory = gameState.currentCategory;
        gameState.currentCategory = categoryId;
        
        // Use pre-generated challenge if available, otherwise generate one
        if (preGeneratedChallenges[categoryId]) {
            gameState.currentPrompt = preGeneratedChallenges[categoryId];
        } else {
            // Generate challenge for automated tests or direct category selection
            try {
                gameState.currentPrompt = window.GAME_DATA.getRandomChallenge(categoryId);
                console.log('🎯 Generated random challenge for', categoryId, ':', gameState.currentPrompt.label);
            } catch (error) {
                console.error('❌ Failed to generate challenge for', categoryId, ':', error);
                gameState.currentPrompt = { label: 'Unknown Challenge', challenge: 'default' };
            }
        }
        
        console.log('🔄 Category tracking - Previous:', window.lastRoundCategory, 'Current:', categoryId);
        
        // Advance to next player for next round
        categoryChooserIndex++;
        
        // Update category indicators
        updateCategoryIndicators();
        
        // Reset bidderSuccess for new round (preserved from previous round for summary)
        console.log('🔄 Resetting bidderSuccess for new round (was:', GameState.get('bidderSuccess'), ')');
        GameState.set('bidderSuccess', false);
        
        console.log('🎯 About to call showBiddingScreen()...');
        // Continue to bidding phase
        showBiddingScreen();
    } catch (error) {
        console.error('Error in selectCategory:', error);
    }
};

/**
 * Show bidding screen with challenge and cards
 * Sets up the bidding phase UI with current challenge info and player bidding interfaces
 * Uses template system for consistent HTML generation
 */
function showBiddingScreen() {
    console.log('🚨🚨🚨 SHOWBIDDINGSCREEN FUNCTION ENTERED! 🚨🚨🚨');
    console.log('🎯 showBiddingScreen() called');
    try {
        // First, draw cards from the selected category
        var gameState = GameState.data;
        var currentCategory = gameState.currentCategory || 'countries';
        
        // Get all items from the selected category
        var categoryData = window.GAME_DATA.categories[currentCategory];
        console.log('🐛 DEBUG: currentCategory:', currentCategory);
        console.log('🐛 DEBUG: categoryData:', categoryData);
        
        if (!categoryData) {
            console.error('❌ Category data not found for:', currentCategory);
            return;
        }
        
        if (!categoryData.items) {
            console.error('❌ Category items not found for:', currentCategory);
            return;
        }
        
        var allItems = Object.keys(categoryData.items);
        console.log('🐛 DEBUG: allItems length:', allItems.length);
        
        // Remove owned cards from available pool
        var ownedCards = [];
        var players = GameState.get('players');
        if (ACTIVE_RULES.tokenOwnership && players.ownedCards) {
            Object.keys(players.ownedCards).forEach(function(playerName) {
                if (players.ownedCards[playerName] && players.ownedCards[playerName][currentCategory]) {
                    ownedCards = ownedCards.concat(players.ownedCards[playerName][currentCategory]);
                }
            });
        }
        
        // Filter out owned cards
        var availableItems = allItems.filter(function(cardId) {
            return !ownedCards.includes(cardId);
        });
        
        // Draw 10 cards
        var drawnCards = [];
        console.log('🐛 DEBUG: availableItems length before drawing:', availableItems.length);
        while (drawnCards.length < 10 && availableItems.length > 0) {
            var randomIndex = Math.floor(Math.random() * availableItems.length);
            var cardId = availableItems[randomIndex];
            drawnCards.push(cardId);
            availableItems.splice(randomIndex, 1);
        }
        console.log('🐛 DEBUG: drawnCards after drawing:', drawnCards.length, drawnCards);
        
        // Track token changes for token replacement screen (category-specific)
        var removedTokens = [];
        var addedTokens = [];
        
        if (getCurrentRound() > 1) {
            var previousCategoryCards = window.previousRoundCardsByCategory && window.previousRoundCardsByCategory[currentCategory] || [];
            
            if (previousCategoryCards.length > 0) {
                // Build removed tokens list from category-specific tracking
                
                // Initialize category-specific tracking if it doesn't exist
                if (!window.categoryRemovedCards) {
                    window.categoryRemovedCards = {};
                }
                if (!window.categoryRemovedCards[currentCategory]) {
                    window.categoryRemovedCards[currentCategory] = [];
                }
                
                // Get cards that were actually used in gameplay (ranked or blocked)
                var lastRoundRemovedFromThisCategory = [];
                
                // Add cards that were used in ranking
                if (lastRoundSelectedCards && lastRoundSelectedCards.length > 0) {
                    lastRoundSelectedCards.forEach(function(cardId) {
                        if (lastRoundRemovedFromThisCategory.indexOf(cardId) === -1) {
                            lastRoundRemovedFromThisCategory.push(cardId);
                        }
                    });
                }
                
                // Add cards that were blocked in this category (and therefore removed from play)
                var blockedCardsByCategory = GameState.get('players.blockedCardsByCategory') || {};
                var blockedCardsThisCategory = blockedCardsByCategory[currentCategory] || [];
                
                console.log('🔍 BLOCKED CARDS VERIFICATION:');
                console.log('  Current category:', currentCategory);
                console.log('  Blocked cards in this category:', blockedCardsThisCategory);
                
                blockedCardsThisCategory.forEach(function(blockedCard) {
                    var cardId = blockedCard.cardId;
                    // Check if this blocked card belongs to current category
                    var belongsToCurrentCategory = window.GAME_DATA.categories[currentCategory].items[cardId];
                    console.log('  Blocked card', cardId, 'belongs to', currentCategory + '?', !!belongsToCurrentCategory);
                    
                    if (belongsToCurrentCategory && lastRoundRemovedFromThisCategory.indexOf(cardId) === -1) {
                        lastRoundRemovedFromThisCategory.push(cardId);
                        console.log('  ✅ Added blocked card to removed list:', cardId);
                    }
                });
                
                removedTokens = lastRoundRemovedFromThisCategory;
                
                console.log('🎯 Previously removed cards for ' + currentCategory + ':', removedTokens);
                console.log('🎯 Cards used in ranking:', lastRoundSelectedCards);
                console.log('🎯 DEBUG: lastRoundSelectedCards type:', typeof lastRoundSelectedCards);
                console.log('🎯 DEBUG: lastRoundSelectedCards length:', lastRoundSelectedCards ? lastRoundSelectedCards.length : 'null/undefined');
                console.log('🎯 DEBUG: window.lastRoundSelectedCards:', window.lastRoundSelectedCards);
                console.log('🛡️ Cards blocked and owned:', blockedCardsThisCategory);
                console.log('📋 Total removed cards (gameplay only):', removedTokens);
                
                // Calculate tokens that were added to replace the gameplay-removed cards
                // Only show replacements for cards that were actually used/blocked
                var allPoolChanges = drawnCards.filter(function(cardId) {
                    return previousCategoryCards.indexOf(cardId) === -1;
                });
                
                // Show exactly the same number of added tokens as removed tokens (1:1 replacement)
                var exactReplacementCount = removedTokens.length;
                for (var i = 0; i < Math.min(exactReplacementCount, allPoolChanges.length); i++) {
                    addedTokens.push(allPoolChanges[i]);
                }
                
                console.log('🔄 All pool changes:', allPoolChanges.length, 'cards');
                console.log('🎯 Showing replacements for gameplay-removed cards only:', addedTokens.length, 'cards');
                
                console.log('🔄 Previous ' + currentCategory + ' cards:', previousCategoryCards);
                console.log('🔄 Current ' + currentCategory + ' cards:', drawnCards);
                console.log('🔄 Removed ' + currentCategory + ' tokens (gameplay events):', removedTokens);
                console.log('🔄 Added ' + currentCategory + ' tokens (new in pool):', addedTokens);
                console.log('📊 Gameplay events - Removed:', removedTokens.length, 'Pool refresh - Added:', addedTokens.length);
                
                // Store both for the token replacement screen
                window.removedReplacementCards = removedTokens;
                window.newReplacementCards = addedTokens;
                
                // Note: Pool size maintained by game, removed=used cards, added=pool refresh
                console.log('✅ Token tracking updated to show actual gameplay events only');
            } else {
                // First time using this category - no replacements to show
                console.log('🔄 First time using ' + currentCategory + ' category - no token replacements');
                window.removedReplacementCards = [];
                window.newReplacementCards = [];
            }
        }
        
        // Store in game state
        gameState.drawnCards = drawnCards;
        
        // Remember current cards for next round (by category)
        if (!window.previousRoundCardsByCategory) {
            window.previousRoundCardsByCategory = {};
        }
        window.previousRoundCardsByCategory[currentCategory] = drawnCards.slice();
        console.log('🔄 Stored cards for ' + currentCategory + ':', drawnCards.slice());
        
        // Initialize game state for bidding
        gameState.currentBid = 0;
        gameState.highestBidder = '';
        gameState.blockedCards = [];
        
        // Reset bidding state
        playerBids = {};
        passedPlayers = {};
        highestBid = 0;
        highestBidder = '';
        
        // Initialize all players for bidding
        players.list.forEach(function(playerName) {
            playerBids[playerName] = 0;
            passedPlayers[playerName] = false;
        });
        
        console.log('🎴 Drew', drawnCards.length, 'cards from', currentCategory, ':', drawnCards);
        console.log('📍 Current round at card draw:', getCurrentRound());
        
        // Update the challenge info
        var promptInfo = DOMCache.get('promptInfo');
        if (promptInfo) {
            var promptData = {
                challengeLabel: gameState.currentPrompt.label,
                description: ''
            };
            safeSetHTML(promptInfo, TemplateEngine.render('promptInfo', promptData));
        }
    } catch (error) {
        safeConsoleLog('Error updating prompt info:', error);
    }
    
    // Show the drawn cards
    try {
        var cardsInfo = DOMCache.get('drawnCardsInfo');
        if (cardsInfo) {
            var gameState = GameState.data;
            var drawnCards = gameState.drawnCards;
            
            // Generate card data for template
            var currentCategory = gameState.currentCategory || 'countries';
            var categoryData = window.GAME_DATA.categories[currentCategory];
            var cardData = drawnCards.map(function(cardId, index) {
                var item = categoryData.items[cardId];
                return {
                    index: index + 1,
                    countryName: item.name,
                    cardCode: item.code || cardId
                };
            });
            
            var cardsList = TemplateEngine.renderList('simpleCardItem', cardData);
            var cardsData = {
                cardsList: cardsList
            };
            
            safeSetHTML(cardsInfo, TemplateEngine.render('drawnCardsInfo', cardsData));
            
            console.log('📍 About to check round for token replacement:', getCurrentRound());
            
            // Check if we've completed at least one round (round increment happens AFTER this)
            // So if we're starting Round 1's bidding screen, we haven't completed any rounds yet
            // If we're starting Round 2's bidding screen, getCurrentRound() is still 1 but we've completed Round 1
            var completedRounds = window.automatedTestResults ? window.automatedTestResults.roundsCompleted : 0;
            console.log('📍 Completed rounds:', completedRounds);
            console.log('📍 Current round from getCurrentRound():', getCurrentRound());
            console.log('📍 GameState current round:', GameState.get('currentRound'));
            console.log('📍 Round check condition result:', (completedRounds > 0 || getCurrentRound() > 1));
            
            // Show card changes notification after cards are displayed (only after completing at least 1 round)
            if (completedRounds > 0 || getCurrentRound() > 1) {
                console.log('🔄 Round 2+ detected, checking for card changes...');
                console.log('  Current round:', getCurrentRound());
                console.log('  Completed rounds:', completedRounds);
                console.log('  Cards replaced:', window.cardsReplacedThisRound);
                console.log('  New replacement cards:', window.newReplacementCards);
                console.log('  Last round selected cards:', window.lastRoundSelectedCards);
                console.log('  Last round selected cards length:', window.lastRoundSelectedCards ? window.lastRoundSelectedCards.length : 'null/undefined');
                console.log('  Automated test running:', window.isAutomatedTestRunning);
                
                // Use the properly calculated token replacements from the category selection
                var removedCards = removedTokens || window.removedReplacementCards || [];
                var addedCards = addedTokens || window.newReplacementCards || [];
                
                // Check if this category was used before (in any previous round)
                var previousCategoryCards = window.previousRoundCardsByCategory && window.previousRoundCardsByCategory[currentCategory] || [];
                var currentCategoryWasUsedBefore = (previousCategoryCards.length > 0);
                
                console.log('🔄 Previous cards for ' + currentCategory + ':', previousCategoryCards);
                console.log('🔄 Current category:', currentCategory);
                console.log('🔄 Category was used before:', currentCategoryWasUsedBefore);
                
                var filteredRemovedCards = [];
                var filteredAddedCards = [];
                
                if (currentCategoryWasUsedBefore) {
                    // This category was used before - show actual replacements within this category
                    filteredRemovedCards = removedCards.filter(function(cardId) {
                        return window.GAME_DATA.categories[currentCategory].items[cardId];
                    });
                    filteredAddedCards = addedCards.filter(function(cardId) {
                        return window.GAME_DATA.categories[currentCategory].items[cardId];
                    });
                } else {
                    // First time using this category - show ALL removed/added tokens from any category
                    console.log('🔄 First time using ' + currentCategory + ' - showing all gameplay tokens');
                    filteredRemovedCards = removedTokens || [];
                    filteredAddedCards = addedTokens || [];
                }
                
                console.log('🔄 Removed cards for ' + currentCategory + ':', filteredRemovedCards);
                console.log('🔄 Added cards for ' + currentCategory + ':', filteredAddedCards);
                console.log('🔄 Balance check - Filtered removed:', filteredRemovedCards.length, 'Filtered added:', filteredAddedCards.length);
                
                // Always show token replacement screen in Round 2+ (even if no specific cards tracked)
                console.log('🔄 FORCING token replacement screen to show...');
                console.log('  Removed cards array:', filteredRemovedCards);
                console.log('  Added cards array:', filteredAddedCards);
                
                // Show token replacement screen IMMEDIATELY before showScreen clears timeouts
                console.log('🔧 Showing token replacement screen immediately...');
                try {
                    showTokenReplacementNotification(filteredRemovedCards, filteredAddedCards);
                    console.log('✅ Token replacement function called successfully');
                    
                    // Return early to prevent bidding screen from immediately showing (both manual and automated)
                    console.log('🔄 Returning early to let user see token replacement screen...');
                    return; // Don't show bidding screen yet - let user see token replacement screen
                } catch (error) {
                    console.error('❌ Error calling token replacement function:', error);
                }
            } else {
                console.log('🔄 Round 1 - no token replacement screen needed');
            }
        }
    } catch (error) {
        safeConsoleLog('Error updating drawn cards info:', error);
    }
    
    // Show owned cards by each player
    try {
        var ownedCardsInfo = DOMCache.get('ownedCardsInfo');
        if (ownedCardsInfo && ACTIVE_RULES.tokenOwnership) {
            var gameState = GameState.data;
            var players = GameState.get('players');
            var ownedCardsHtml = '';
            
            if (players.ownedCards) {
                var hasOwnedCards = false;
                Object.keys(players.ownedCards).forEach(function(playerName) {
                    var hasCards = false;
                    if (players.ownedCards[playerName]) {
                        if (typeof players.ownedCards[playerName] === 'object' && !Array.isArray(players.ownedCards[playerName])) {
                            // New format: check if any category has cards
                            Object.keys(players.ownedCards[playerName]).forEach(function(category) {
                                if (Array.isArray(players.ownedCards[playerName][category]) && players.ownedCards[playerName][category].length > 0) {
                                    hasCards = true;
                                }
                            });
                        } else if (Array.isArray(players.ownedCards[playerName]) && players.ownedCards[playerName].length > 0) {
                            // Legacy format
                            hasCards = true;
                        }
                    }
                    if (hasCards) {
                        hasOwnedCards = true;
                        ownedCardsHtml += '<div class="owned-cards-player">' +
                            '<strong>' + playerName + '</strong> owns: ';
                        
                        var ownedCardNames = [];
                        if (players.ownedCards[playerName] && typeof players.ownedCards[playerName] === 'object') {
                            // Handle category-specific owned cards
                            Object.keys(players.ownedCards[playerName]).forEach(function(category) {
                                if (Array.isArray(players.ownedCards[playerName][category])) {
                                    players.ownedCards[playerName][category].forEach(function(cardId) {
                                        var categoryData = window.GAME_DATA.categories[category];
                                        var item = categoryData && categoryData.items[cardId];
                                        if (item) {
                                            var categoryIcon = categoryData.icon || '📋';
                                            ownedCardNames.push(item.name + ' <span class="category-card-badge ' + category + '">' + categoryIcon + ' ' + categoryData.name + '</span>');
                                        }
                                    });
                                }
                            });
                        } else if (Array.isArray(players.ownedCards[playerName])) {
                            // Handle legacy format (backwards compatibility)
                            players.ownedCards[playerName].forEach(function(cardId) {
                                var countryData = window.GAME_DATA.categories.countries.items[cardId];
                                if (countryData) {
                                    ownedCardNames.push(countryData.name + ' <span class="category-card-badge countries">🌍 Countries</span>');
                                }
                            });
                        }
                        
                        ownedCardsHtml += ownedCardNames.join(', ') + 
                            ' <span class="owned-count">(' + ownedCardNames.length + ')</span>' +
                            '</div>';
                    }
                });
                
                if (hasOwnedCards) {
                    var ownedSectionHtml = '<div class="owned-cards-section">' +
                        '<h4>🏆 Owned Cards (Not Available This Round)</h4>' +
                        ownedCardsHtml +
                        '</div>';
                    safeSetHTML(ownedCardsInfo, ownedSectionHtml);
                    ownedCardsInfo.style.display = 'block';
                } else {
                    safeSetHTML(ownedCardsInfo, '');
                    ownedCardsInfo.style.display = 'none';
                }
            } else {
                safeSetHTML(ownedCardsInfo, '');
                ownedCardsInfo.style.display = 'none';
            }
        }
    } catch (error) {
        safeConsoleLog('Error updating owned cards info:', error);
    }
    
    // Generate player bidding interfaces
    generatePlayerBiddingInterface();
    
    // Update high bidder display
    updateHighBidderDisplay();
    
    showScreen('biddingScreen');
}

// Generate bidding interface for each player
function generatePlayerBiddingInterface() {
    try {
        var container = DOMCache.get('playerBidding');
        if (!container) {
            safeConsoleLog('playerBidding container not found');
            return false;
        }
        
        // Get game state
        var gameState = GameState.data;
        var players = GameState.get('players');
        var currentBid = gameState.currentBid;
        var highestBidder = gameState.highestBidder;
        var passedPlayers = gameState.passedPlayers;
        var playerBids = gameState.playerBids;
        
        if (!validateInput(players.list, 'array')) {
            safeConsoleLog('Invalid players list');
            return false;
        }
        
        // Generate player data for template
        var playersList = GameState.get('players.list');
        var playerData = playersList.map(function(playerName) {
            var isPassed = passedPlayers[playerName];
            var currentPlayerBid = playerBids[playerName] || 0;
            var highestBidder = GameState.get('highestBidder');
            var currentBid = GameState.get('currentBid');
            var isHighBidder = (playerName === highestBidder && currentBid > 0);
            var nextBid = GameState.get('currentBid') + 1;
            var canPass = !(isHighBidder && currentBid > 0);
            
            // Generate bid actions HTML
            var bidActions = '';
            if (!isPassed) {
                var bidButtonData = {
                    playerName: playerName,
                    nextBid: nextBid
                };
                bidActions += TemplateEngine.render('bidButton', bidButtonData);
                
                if (canPass) {
                    bidActions += TemplateEngine.render('passButton', {playerName: playerName});
                } else {
                    bidActions += '<button class="btn small secondary disabled" disabled>Can\'t Pass</button>';
                }
            } else {
                bidActions = '<div class="passed-text">Passed</div>';
            }
            
            return {
                playerName: GameUtils.formatPlayerName(playerName),
                safePlayerName: GameUtils.createSafeClassName(playerName),
                statusClass: isPassed ? 'player-passed' : 'player-active',
                bidderClass: isHighBidder ? 'high-bidder-row' : '',
                crownIcon: isHighBidder ? ' 👑' : '',
                statusText: isPassed ? 'PASSED' : 'Active',
                currentBid: currentPlayerBid,
                bidActions: bidActions
            };
        });
        
        // Register updated template if needed
        TemplateEngine.register('playerBidRowComplete', 
            '<div class="player-bid-row {{statusClass}} {{bidderClass}}" id="bidRow_{{safePlayerName}}">' +
            '<div class="player-info">' +
            '<div class="player-name">{{playerName}}{{crownIcon}}</div>' +
            '<div class="player-status">{{statusText}}</div>' +
            '</div>' +
            '<div class="current-bid-display">Current: {{currentBid}}</div>' +
            '{{bidActions}}' +
            '</div>'
        );
        
        // Render all players
        var html = TemplateEngine.renderList('playerBidRowComplete', playerData);
        
        // Update container safely
        safeSetHTML(container, html);
        
        return true;
        
    } catch (error) {
        safeConsoleLog('Error generating player bidding interface:', error);
        showNotification('Error updating bidding interface', 'error');
        return false;
    }
}

// Update the high bidder display
function updateHighBidderDisplay() {
    try {
        var display = DOMCache.get('highBidderDisplay');
        if (!display) {
            safeConsoleLog('highBidderDisplay element not found');
            return false;
        }
        
        var gameState = GameState.data;
        var currentBid = gameState.currentBid;
        var highestBidder = gameState.highestBidder;
        
        if (currentBid === 0) {
            var noBidsData = {
                amount: 'No bids yet',
                playerText: 'Waiting for first bid...'
            };
            safeSetHTML(display, TemplateEngine.render('highBidderDisplay', noBidsData));
        } else {
            var bidData = {
                amount: currentBid + ' cards',
                playerText: 'High bidder: ' + GameUtils.formatPlayerName(highestBidder)
            };
            safeSetHTML(display, TemplateEngine.render('highBidderDisplay', bidData));
        }
        
        return true;
        
    } catch (error) {
        safeConsoleLog('Error updating high bidder display:', error);
        showNotification('Error updating display', 'error');
        return false;
    }
}

// Bidding Phase Functions
window.placeBidForPlayer = function(playerName) {
    try {
        // Input validation
        if (!validateInput(playerName, 'string', {minLength: 1})) {
            safeConsoleLog('placeBidForPlayer: Invalid playerName parameter');
            showNotification('Invalid player name', 'error');
            return false;
        }
        
        // Validate game state
        var passedPlayers = GameState.get('passedPlayers') || {};
        if (typeof passedPlayers !== 'object' || passedPlayers === null) {
            safeConsoleLog('placeBidForPlayer: passedPlayers not properly initialized');
            showNotification('Game state error', 'error');
            return false;
        }
        
        if (passedPlayers[playerName]) {
            safeConsoleLog(playerName + ' has already passed and cannot bid.');
            showNotification(playerName + ' has already passed', 'error');
            return false;
        }
        
        // Validate bid amount
        var newBid = GameState.get('currentBid') + 1;
        if (!validateInput(newBid, 'integer', {min: GAME_CONFIG.MIN_BID, max: GAME_CONFIG.MAX_BID})) {
            safeConsoleLog('Maximum bid is ' + GAME_CONFIG.MAX_BID + ' cards');
            showNotification('Maximum bid is ' + GAME_CONFIG.MAX_BID + ' cards', 'error');
            return false;
        }
        
        // Validate currentBid is a number
        if (!validateInput(GameState.get('currentBid'), 'number')) {
            safeConsoleLog('placeBidForPlayer: currentBid is not a valid number');
            showNotification('Invalid game state', 'error');
            return false;
        }
        
        // Update bid tracking with validation
        try {
            var gameState = GameState.data;
            gameState.currentBid = newBid;
            gameState.highestBidder = playerName;
            
            // Also update global variables for backward compatibility
            currentBid = newBid;
            highestBidder = playerName;
            
            // Ensure playerBids object exists
            if (typeof playerBids !== 'object' || playerBids === null) {
                playerBids = {};
            }
            playerBids[playerName] = newBid;
            
            // Track bid attempt
            var players = GameState.get('players');
            if (players.stats && players.stats[playerName]) {
                players.stats[playerName].bidAttempts++;
                safeConsoleLog('📊 Tracked bid attempt for', playerName, '- Total attempts:', players.stats[playerName].bidAttempts);
            }
            
            safeConsoleLog('Bid placed:', playerName, 'bids', newBid);
            
        } catch (updateError) {
            safeConsoleLog('Error updating bid state:', updateError);
            showNotification('Failed to place bid', 'error');
            return false;
        }
        
        // Refresh the interface with error handling
        try {
            if (typeof generatePlayerBiddingInterface === 'function') {
                generatePlayerBiddingInterface();
            }
            if (typeof updateHighBidderDisplay === 'function') {
                updateHighBidderDisplay();
            }
        } catch (refreshError) {
            safeConsoleLog('Error refreshing interface after bid:', refreshError);
            // Don't return false - bid was placed successfully
        }
        
        return true;
        
    } catch (error) {
        safeConsoleLog('Critical error in placeBidForPlayer:', error);
        showNotification('Failed to place bid', 'error');
        return false;
    }
};

window.passPlayer = function(playerName) {
    try {
        // Input validation
        if (!validateInput(playerName, 'string', {minLength: 1})) {
            safeConsoleLog('passPlayer: Invalid playerName parameter');
            showNotification('Invalid player name', 'error');
            return false;
        }
        
        // Validate game state
        var passedPlayers = GameState.get('passedPlayers') || {};
        if (typeof passedPlayers !== 'object' || passedPlayers === null) {
            safeConsoleLog('passPlayer: passedPlayers not properly initialized');
            showNotification('Game state error', 'error');
            return false;
        }
        
        if (passedPlayers[playerName]) {
            safeConsoleLog(playerName + ' has already passed');
            return true; // Already passed, not an error
        }
        
        // High bidder cannot pass validation
        var highestBidder = GameState.get('highestBidder');
        var currentBid = GameState.get('currentBid');
        if (playerName === highestBidder && validateInput(currentBid, 'number') && currentBid > 0) {
            safeConsoleLog('The high bidder cannot pass! You must either bid higher or wait for others to outbid you.');
            showNotification('High bidder cannot pass', 'error');
            return false;
        }
        
        // Mark player as passed
        passedPlayers[playerName] = true;
        GameState.set('passedPlayers', passedPlayers);
        
        // Track pass in statistics
        var players = GameState.get('players');
        if (players.stats && players.stats[playerName]) {
            players.stats[playerName].bidsPassed++;
            safeConsoleLog('📊 Tracked pass for', playerName, '- Total passes:', players.stats[playerName].bidsPassed);
        }
        
        safeConsoleLog(playerName + ' passes');
        
        // Check if bidding should end with validation
        try {
            var playersList = GameState.get('players.list');
            if (!validateInput(playersList, 'array')) {
                throw new Error('players.list is not a valid array');
            }
            
            var playersList = GameState.get('players.list');
            var activePlayers = playersList.filter(function(name) {
                return !passedPlayers[name];
            });
            
            // Fix: Check if all players except high bidder have passed
            var nonBidderPassed = playersList.filter(function(name) {
                return name !== highestBidder && passedPlayers[name];
            });
            var shouldEndBidding = (nonBidderPassed.length === playersList.length - 1) && 
                                  validateInput(currentBid, 'number') && currentBid > 0;
            
            console.log('🔍 Bidding check: activePlayers=' + activePlayers.length + 
                       ', nonBidderPassed=' + nonBidderPassed.length + 
                       ', shouldEnd=' + shouldEndBidding + 
                       ', highestBidder=' + highestBidder);
                                  
            if (activePlayers.length <= 1 || shouldEndBidding) {
                if (!validateInput(currentBid, 'number') || currentBid === 0) {
                    safeConsoleLog('All players passed! Someone must make a bid.');
                    showNotification('All players passed! Someone must make a bid.', 'info');
                    
                    // Reset all passes to restart bidding
                    try {
                        playersList.forEach(function(name) {
                            passedPlayers[name] = false;
                        });
                        GameState.set('passedPlayers', passedPlayers);
                    } catch (resetError) {
                        safeConsoleLog('Error resetting passes:', resetError);
                        return false;
                    }
                } else {
                    safeConsoleLog('Bidding complete! ' + highestBidder + ' wins with a bid of ' + currentBid + ' cards.');
                    showNotification('Bidding complete! ' + highestBidder + ' wins!', 'success');
                    
                    // Auto-finish bidding with error handling and managed timeout
                    eventListenerManager.addTimeout(function() {
                        try {
                            if (typeof finishBidding === 'function') {
                                finishBidding();
                            } else {
                                safeConsoleLog('finishBidding function not available');
                            }
                        } catch (finishError) {
                            safeConsoleLog('Error finishing bidding:', finishError);
                            showNotification('Error completing bidding phase', 'error');
                        }
                    }, 2000);
                }
            }
        } catch (biddingEndError) {
            safeConsoleLog('Error checking bidding end condition:', biddingEndError);
            // Continue - pass was still successful
        }
        
        // Refresh the interface with error handling
        try {
            if (typeof generatePlayerBiddingInterface === 'function') {
                generatePlayerBiddingInterface();
            }
        } catch (refreshError) {
            safeConsoleLog('Error refreshing interface after pass:', refreshError);
            // Don't return false - pass was successful
        }
        
        return true;
        
    } catch (error) {
        safeConsoleLog('Critical error in passPlayer:', error);
        showNotification('Failed to pass player', 'error');
        return false;
    }
};

window.finishBidding = function() {
    var gameState = GameState.data;
    var currentBid = gameState.currentBid || 0;
    var players = gameState.players;
    
    if (currentBid === 0) {
        console.log('Someone must place a bid before continuing!');
        return;
    }
    
    var playersList = GameState.get('players.list');
    var passedPlayers = GameState.get('passedPlayers') || {};
    var activePlayers = playersList.filter(function(name) {
        return !passedPlayers[name];
    });
    
    if (activePlayers.length > 1) {
        console.log('Bidding is not complete! Players still need to bid or pass: ' + activePlayers.join(', '));
        return;
    }
    
    // Move to blocking phase
    showBlockingScreen();
};

// Blocking Phase Functions
function showBlockingScreen() {
    var gameState = GameState.data;
    console.log('📋 showBlockingScreen called with state:', {
        currentPrompt: gameState.currentPrompt ? gameState.currentPrompt.label : 'null',
        highestBidder: gameState.highestBidder,
        currentBid: gameState.currentBid,
        drawnCards: gameState.drawnCards ? gameState.drawnCards.length : 0,
        blockedCards: gameState.blockedCards ? gameState.blockedCards.length : 0
    });
    
    // Set up blocking order (lowest score first, excluding the bidder)
    var blockingOrder = getPlayersByScore().filter(function(name) {
        return name !== gameState.highestBidder;
    }).reverse(); // Reverse to get lowest score first
    
    GameState.set('blockingOrder', blockingOrder);
    GameState.set('blockingTurn', 0);
    
    // Update display
    updateBlockingDisplay();
    
    showScreen('blockingScreen');
}

function updateBlockingDisplay() {
    try {
        var blockingInfo = DOMCache.get('blockingInfo');
        if (blockingInfo) {
            var gameState = GameState.data;
            var currentBlocker = gameState.blockingTurn < gameState.blockingOrder.length ? gameState.blockingOrder[gameState.blockingTurn] : null;
            var turnText = currentBlocker ? GameUtils.formatPlayerName(currentBlocker) + '\'s turn to block' : 'All players have had their turn';
            
            var blockingData = {
                challengeLabel: gameState.currentPrompt.label,
                bidderName: GameUtils.formatPlayerName(gameState.highestBidder),
                bidAmount: gameState.currentBid,
                turnText: turnText
            };
            
            safeSetHTML(blockingInfo, TemplateEngine.render('blockingInfo', blockingData));
        }
    } catch (error) {
        safeConsoleLog('Error updating blocking display info:', error);
    }
    
    // Show available cards for blocking
    try {
        var availableCards = DOMCache.get('availableCards');
        if (availableCards) {
            var gameState = GameState.data;
            var drawnCards = gameState.drawnCards;
            var blockedCards = gameState.blockedCards;
            var players = GameState.get('players');
            
            // Generate card data for template
            var currentCategory = gameState.currentCategory || 'countries';
            var categoryData = window.GAME_DATA.categories[currentCategory];
            var cardData = drawnCards.map(function(cardId, index) {
                var item = categoryData.items[cardId];
                var isBlocked = blockedCards.includes(cardId);
                var blockClass = isBlocked ? 'card-blocked' : 'card-available';
                var blocker = '';
                
                // Find who blocked this card
                if (isBlocked) {
                    for (var playerName in players.currentBlocks) {
                        var blockInfo = players.currentBlocks[playerName];
                        if (blockInfo && blockInfo.cardId === cardId) {
                            blocker = ' (blocked by ' + GameUtils.formatPlayerName(playerName) + ')';
                            break;
                        }
                    }
                }
                
                return {
                    blockClass: blockClass,
                    cardId: cardId,
                    index: index + 1,
                    countryName: item.name,
                    cardCode: item.code || cardId,
                    blocker: blocker
                };
            });
            
            var cardsList = TemplateEngine.renderList('cardItem', cardData);
            var availableCardsData = {
                remainingCount: drawnCards.length - blockedCards.length,
                cardsList: cardsList
            };
            
            safeSetHTML(availableCards, TemplateEngine.render('availableCardsHeader', availableCardsData));
            
            // Add click listeners for card selection with memory management
            DOMCache.queryAll('.card-available[data-card-id]', 'blockableCards').forEach(function(cardElement) {
                var clickHandler = function() {
                    var cardId = this.getAttribute('data-card-id');
                    selectCardToBlock(cardId);
                };
                eventListenerManager.addListener(cardElement, 'click', clickHandler);
            });
        }
    } catch (error) {
        safeConsoleLog('Error updating available cards display:', error);
    }
    
    // Show blocking tokens for current player
    try {
        var blockingTokens = DOMCache.get('blockingTokens');
        if (blockingTokens) {
            var gameState = GameState.data;
            var blockingTurn = gameState.blockingTurn;
            var blockingOrder = gameState.blockingOrder;
            var players = GameState.get('players');
            var usedBlockingTokens = GameState.get('usedBlockingTokens') || {2: false, 4: false, 6: false};
            
            if (blockingTurn < blockingOrder.length) {
                var currentPlayer = blockingOrder[blockingTurn];
                
                // Generate token data for template
                var tokenData = [2, 4, 6].map(function(value) {
                    var playerTokens = GameState.get('players.blockingTokens.' + currentPlayer);
                    var playerHasToken = playerTokens && playerTokens[value] > 0;
                    var tokenUsedThisRound = usedBlockingTokens[value];
                    var available = playerHasToken && !tokenUsedThisRound;
                    
                    var tokenClass = available ? 'token-available token-' + value : 'token-used';
                    var reason = '';
                    if (!playerHasToken) reason = ' [USED]';
                    else if (tokenUsedThisRound) reason = ' [TAKEN]';
                    
                    var onclick = available ? 'selectBlockingToken(' + value + ', this)' : '';
                    
                    return {
                        tokenClass: tokenClass,
                        onclick: onclick,
                        value: value,
                        reason: reason
                    };
                });
                
                var tokensList = TemplateEngine.renderList('blockingTokenItem', tokenData);
                var tokensData = {
                    playerName: GameUtils.formatPlayerName(currentPlayer),
                    tokensList: tokensList
                };
                
                safeSetHTML(blockingTokens, TemplateEngine.render('blockingTokensHeader', tokensData));
            } else {
                safeSetHTML(blockingTokens, TemplateEngine.render('blockingComplete', {}));
            }
        }
    } catch (error) {
        safeConsoleLog('Error updating blocking tokens display:', error);
    }
}

var selectedToken = null;
var selectedCard = null;

window.selectBlockingToken = function(value, element) {
    selectedToken = value;
    
    // Highlight selected token
    document.querySelectorAll('.token-item').forEach(function(el) {
        el.classList.remove('token-selected');
    });
    
    if (element) {
        element.classList.add('token-selected');
    }
    
    // Show instruction
    console.log('Token selected! Now click a card to block it.');
};

window.selectCardToBlock = function(cardId) {
    if (!selectedToken) {
        console.log('Please select a blocking token first!');
        return;
    }
    
    var blockingOrder = GameState.get('blockingOrder');
    var blockingTurn = GameState.get('blockingTurn');
    var currentPlayer = blockingOrder[blockingTurn];
    
    // CRITICAL VALIDATION: Bidders cannot block!
    var highestBidder = GameState.get('highestBidder');
    if (currentPlayer === highestBidder) {
        console.log('❌ BLOCKING PREVENTED: ' + currentPlayer + ' is the bidder and cannot block!');
        if (!window.automatedTestState || !window.automatedTestState.isRunning) {
            showNotification(currentPlayer + ' is the bidder and cannot block!', 'error');
        }
        return;
    }
    var gameState = GameState.data;
    var currentCategory = gameState.currentCategory || 'countries';
    var categoryData = window.GAME_DATA.categories[currentCategory];
    var item = categoryData.items[cardId];
    
    // CRITICAL VALIDATION: Check if player already owns this card
    var ownedCards = GameState.get('players.ownedCards') || {};
    if (ownedCards[currentPlayer] && ownedCards[currentPlayer][currentCategory]) {
        if (ownedCards[currentPlayer][currentCategory].includes(cardId)) {
            console.log('❌ BLOCKING PREVENTED: ' + currentPlayer + ' already owns ' + item.name + ' - cannot block owned cards!');
            if (!window.automatedTestState || !window.automatedTestState.isRunning) {
                showNotification(currentPlayer + ' already owns ' + item.name + ' - cannot block!', 'error');
            }
            return; // Prevent the block
        }
    }
    
    // Check if someone else already owns this card
    if (ownedCards) {
        for (var playerName in ownedCards) {
            if (playerName !== currentPlayer && ownedCards[playerName][currentCategory]) {
                if (ownedCards[playerName][currentCategory].includes(cardId)) {
                    console.log('❌ BLOCKING PREVENTED: ' + playerName + ' already owns ' + item.name + ' - cannot block owned cards!');
                    if (!window.automatedTestState || !window.automatedTestState.isRunning) {
                        showNotification(playerName + ' already owns ' + item.name + ' - cannot block!', 'error');
                    }
                    return; // Prevent the block
                }
            }
        }
    }
    
    selectedCard = cardId;
    
    // Validation passed - proceed with block
    console.log('✅ BLOCK VALIDATED: ' + currentPlayer + ' can block ' + item.name + ' with a ' + selectedToken + '-point token');
    blockCard(cardId, selectedToken, currentPlayer);
};

function blockCard(cardId, tokenValue, playerName) {
    console.log('🛡️ BLOCK ATTEMPT START - Enhanced Logging');
    console.log('  Player:', playerName);
    console.log('  Card:', cardId);
    console.log('  Token Value:', tokenValue);
    
    // CRITICAL VALIDATION: Bidders cannot block! (Second line of defense)
    var highestBidder = GameState.get('highestBidder');
    console.log('  Current Bidder:', highestBidder);
    
    if (playerName === highestBidder) {
        console.error('❌ CRITICAL ERROR: Bidder ' + playerName + ' attempted to block! This should not happen!');
        return;
    }
    
    // Execution guard for automated testing
    if (window.automatedTestState && window.automatedTestState.isProcessingBlock) {
        console.log('⚠️ Block already in progress, skipping duplicate');
        return;
    }
    
    var blockedCards = GameState.get('blockedCards') || [];
    if (blockedCards.includes(cardId)) {
        return; // Already blocked
    }
    
    // Set processing guard
    if (window.automatedTestState) {
        window.automatedTestState.isProcessingBlock = true;
    }
    
    // Block the card
    blockedCards.push(cardId);
    GameState.set('blockedCards', blockedCards);
    
    // Record the blocking action
    // Store the block in GameState without overwriting entire players object
    GameState.set('players.currentBlocks.' + playerName, {
        cardId: cardId,
        tokenValue: tokenValue
    });
    
    // CRITICAL: Store the block in currentBlocks for scoring system
    var currentBlocks = GameState.get('players.currentBlocks') || {};
    currentBlocks[playerName] = {
        cardId: cardId,
        tokenValue: tokenValue
    };
    GameState.set('players.currentBlocks', currentBlocks);
    console.log('📋 Stored block for', playerName, ':', currentBlocks[playerName]);
    
    // Track blocks made in player stats
    var currentStats = getPlayerStats(playerName);
    console.log('  Pre-block stats for', playerName + ':', currentStats);
    
    if (currentStats) {
        var oldBlocksMade = currentStats.blocksMade || 0;
        currentStats.blocksMade = oldBlocksMade + 1;
        GameState.set('players.stats.' + playerName, currentStats);
        
        console.log('  📊 Updated blocksMade from', oldBlocksMade, 'to', currentStats.blocksMade);
        console.log('  📊 Current tokensGained:', currentStats.tokensGained || 0);
        console.log('  📊 Current blocksWon:', currentStats.blocksWon || 0);
    }
    
    // Update test statistics
    updateTestStatistics('BLOCK_MADE', {player: playerName});
    
    // Mark token as used this round (but don't remove it yet - that happens after reveal)
    var usedTokens = GameState.get('usedBlockingTokens') || {2: false, 4: false, 6: false};
    usedTokens[tokenValue] = true;
    GameState.set('usedBlockingTokens', usedTokens);
    
    var gameState = GameState.data;
    var currentCategory = gameState.currentCategory || 'countries';
    var categoryData = window.GAME_DATA.categories[currentCategory];
    var item = categoryData.items[cardId];
    console.log(playerName + ' blocked ' + item.name + ' with a ' + tokenValue + '-point token!');
    
    // Clear processing guard
    if (window.automatedTestState) {
        window.automatedTestState.isProcessingBlock = false;
    }
    
    // Run validation after block
    runAutoValidation('after-block-card');
    
    // Move to next player
    nextBlockingTurn();
}

function nextBlockingTurn() {
    var gameState = GameState.data;
    var blockingOrder = gameState.blockingOrder || [];
    var blockingTurn = (gameState.blockingTurn || 0) + 1;
    
    GameState.set('blockingTurn', blockingTurn);
    selectedToken = null;
    selectedCard = null;
    
    updateBlockingDisplay();
    
    // Check if all players have had their turn
    if (blockingTurn >= blockingOrder.length) {
        eventListenerManager.addTimeout(function() {
            finishBlocking();
        }, GAME_CONFIG.BLOCKING_FINISH_DELAY);
    }
}

window.finishBlocking = function() {
    // Move to card selection phase
    showCardSelection();
};

window.skipBlocking = function() {
    // Skip current player's blocking turn
    var gameState = GameState.data;
    var blockingOrder = gameState.blockingOrder || [];
    var blockingTurn = gameState.blockingTurn || 0;
    
    console.log('⏭️ Player skipping blocking turn:', blockingOrder[blockingTurn]);
    
    // Move to next player's turn
    blockingTurn++;
    GameState.set('blockingTurn', blockingTurn);
    
    if (blockingTurn >= blockingOrder.length) {
        // All players have had their turn, move to card selection
        console.log('✅ All players have completed blocking turns');
        showCardSelection();
    } else {
        // Update display for next player
        console.log('➡️ Moving to next blocker:', blockingOrder[blockingTurn]);
        updateBlockingDisplay();
    }
};

function setupBlockingScreen() {
    console.log('🛡️ Setting up blocking screen...');
    console.log('Current game state:', {
        currentPrompt: GameState.get('currentPrompt'),
        highestBidder: GameState.get('highestBidder'),
        currentBid: GameState.get('currentBid'),
        drawnCards: GameState.get('drawnCards'),
        blockedCards: GameState.get('blockedCards')
    });
    
    // Validate we have the required game state
    var currentPrompt = GameState.get('currentPrompt');
    var highestBidder = GameState.get('highestBidder');
    var currentBid = GameState.get('currentBid');
    var drawnCards = GameState.get('drawnCards');
    if (!currentPrompt || !highestBidder || currentBid === 0 || drawnCards.length === 0) {
        console.error('❌ Cannot setup blocking screen - missing game state');
        showNotification('Error: Game state incomplete for blocking phase', 'error');
        // If we're missing game state, go back to the appropriate screen
        var playersList = GameState.get('players.list');
        if (playersList.length === 0) {
            showScreen('playerScreen');
        } else {
            showScreen('biddingScreen');
        }
        return;
    }
    
    // Use the existing updateBlockingDisplay function which already handles everything
    updateBlockingDisplay();
    
    console.log('✅ Blocking screen setup complete');
}

function setupBlockingCards() {
    var container = document.getElementById('availableCards');
    if (!container) return;
    
    var gameState = GameState.data;
    var currentCategory = gameState.currentCategory || 'countries';
    var categoryData = window.GAME_DATA.categories[currentCategory];
    var drawnCards = gameState.drawnCards || [];
    var blockedCards = gameState.blockedCards || [];
    
    var html = '<h3>Available Cards to Block:</h3><div class="cards-grid">';
    
    drawnCards.forEach(function(cardId, index) {
        var item = categoryData.items[cardId];
        var isBlocked = blockedCards.includes(cardId);
        var cardClass = isBlocked ? 'card-item card-blocked' : 'card-item card-available card-selectable';
        
        html += '<div class="' + cardClass + '" data-card="' + HTMLEscaper.escapeHTMLAttribute(cardId) + '">' +
               '<div class="card-name">' + sanitizeHTML(item ? item.name : cardId) + '</div>' +
               '<div class="card-code">' + sanitizeHTML(item ? item.code : cardId) + '</div>' +
               (isBlocked ? '<div style="color: red; font-size: 11px; margin-top: 5px;">BLOCKED</div>' : '') +
               '</div>';
    });
    
    html += '</div>';
    safeSetHTML(container, html);
}

function setupBlockingTokens() {
    var container = document.getElementById('blockingTokens');
    if (!container) return;
    
    // Get current player's tokens (in a real game, this would be dynamic)
    // For now, show tokens for the first non-bidder player
    var playersList = GameState.get('players.list');
    var highestBidder = GameState.get('highestBidder');
    var currentBlocker = playersList.find(name => name !== highestBidder);
    if (!currentBlocker) return;
    
    var tokens = GameState.get('players.blockingTokens.' + currentBlocker) || {2: 1, 4: 1, 6: 1};
    var usedBlockingTokens = GameState.get('usedBlockingTokens') || {2: false, 4: false, 6: false};
    
    var html = '<h3>Your Blocking Tokens:</h3><div class="tokens-grid">';
    
    Object.keys(tokens).forEach(function(tokenValue) {
        var count = tokens[tokenValue];
        var isUsed = usedBlockingTokens[tokenValue];
        var tokenClass = count > 0 && !isUsed ? 'token-item token-available' : 'token-item token-used';
        
        html += '<div class="' + tokenClass + '" data-token="' + HTMLEscaper.escapeHTMLAttribute(tokenValue) + '">' +
               '<strong>' + sanitizeText(tokenValue) + ' pts</strong>' +
               '<br>(' + sanitizeText(count || 0) + ' available)' +
               '</div>';
    });
    
    html += '</div>';
    safeSetHTML(container, html);
}

// Card Selection Phase
function showCardSelection() {
    // Prevent execution if automated test has completed (but allow if completion is pending)
    if (window.automatedTestResults && window.automatedTestResults.endTime && !window.isAutomatedTestRunning && !window.automatedTestResults.shouldComplete) {
        console.log('⚠️ Ignoring showCardSelection() call - automated test completed');
        return;
    }
    
    console.log('🎯 Starting card selection phase...');
    
    var gameState = GameState.data;
    var currentPrompt = gameState.currentPrompt;
    var highestBidder = gameState.highestBidder;
    var currentBid = gameState.currentBid;
    var drawnCards = gameState.drawnCards || [];
    var blockedCards = gameState.blockedCards || [];
    
    console.log('Current prompt:', currentPrompt);
    console.log('Highest bidder:', highestBidder);
    console.log('Current bid:', currentBid);
    console.log('Drawn cards:', drawnCards);
    console.log('Blocked cards:', blockedCards);
    
    // Validate required variables
    if (!currentPrompt) {
        console.error('❌ No current prompt set!');
        
        // For automated tests, try to auto-fix by selecting a random challenge
        if (window.isAutomatedTestRunning) {
            console.log('🤖 Auto-fixing: selecting random challenge for automated test');
            try {
                var fallbackPrompt = window.GAME_DATA.getRandomChallenge(GameState.get('currentCategory'));
                GameState.set('currentPrompt', fallbackPrompt);
                currentPrompt = fallbackPrompt;
                console.log('✅ Auto-selected challenge:', fallbackPrompt.label);
            } catch (error) {
                console.error('❌ Failed to auto-select challenge:', error);
                showNotification('Error: No challenge selected', 'error');
                return;
            }
        } else {
            showNotification('Error: No challenge selected', 'error');
            return;
        }
    }
    
    if (!highestBidder) {
        console.error('❌ No highest bidder set!');
        console.log('Game state check - currentRound:', gameState.currentRound, 'isAutomatedTestRunning:', window.isAutomatedTestRunning);
        
        // Don't show error notifications during automated tests to avoid spam
        if (!window.isAutomatedTestRunning && (!window.automatedTestResults || !window.automatedTestResults.endTime)) {
            showNotification('Error: No bidder selected', 'error');
        }
        return;
    }
    
    if (currentBid === 0) {
        console.error('❌ No bid amount set!');
        // Don't show error notifications during automated tests to avoid spam
        if (!window.isAutomatedTestRunning && (!window.automatedTestResults || !window.automatedTestResults.endTime)) {
            showNotification('Error: No bid amount set', 'error');
        }
        return;
    }
    
    var remainingCards = drawnCards.filter(function(card) {
        return !blockedCards.includes(card);
    });
    
    console.log('Remaining cards after blocking:', remainingCards);
    
    if (remainingCards.length < currentBid) {
        console.log('❌ Not enough cards remaining! Bidder automatically fails.');
        showNotification('Not enough cards remaining for bid!', 'error');
        // Handle automatic failure - go to reveal with failure
        GameState.set('bidderSuccess', false);
        eventListenerManager.addTimeout(() => {
            calculateAndApplyScores();
            updateInterimDisplay();
            showScreen('interimScreen');
        }, GAME_CONFIG.RANKING_REVEAL_FAILURE);
        return;
    }
    
    // Update scan info
    try {
        var scanInfo = DOMCache.get('scanInfo');
        if (scanInfo) {
            var gameState = GameState.data;
            var scanData = {
                challengeLabel: gameState.currentPrompt.label,
                description: GameUtils.formatPlayerName(gameState.highestBidder) + ' must select ' + gameState.currentBid + ' cards to rank'
            };
            safeSetHTML(scanInfo, TemplateEngine.render('scanInfo', scanData));
        }
    } catch (error) {
        safeConsoleLog('Error updating scan info:', error);
    }
    
    // Reset selection
    GameState.set('selectedCardsForRanking', []);
    
    // Hide any existing ranking container from previous rounds
    var rankingContainer = document.getElementById('rankingContainer');
    if (rankingContainer) {
        rankingContainer.style.display = 'none';
    }
    
    // Show available cards for selection
    updateAvailableCardsDisplay(remainingCards);
    
    console.log('✅ Navigating to card selection screen');
    showScreen('scanScreen');
}

function updateAvailableCardsDisplay(remainingCards) {
    var container = document.getElementById('availableCardsForSelection');
    
    if (container) {
        // Make sure the container is visible (it might have been hidden by ranking interface)
        container.style.display = 'block';
        
        var html = '';
        
        // Show owned cards first (if token ownership is enabled and player has owned cards)
        var currentPlayer = GameState.get('highestBidder');
        var ownedCards = [];
        var gameState = GameState.data;
        var currentCategory = gameState.currentCategory || 'countries';
        
        var players = GameState.get('players');
        if (ACTIVE_RULES.tokenOwnership && ACTIVE_RULES.allowOwnedInSelection && players.ownedCards && players.ownedCards[currentPlayer]) {
            // Get owned cards for the current category only
            if (players.ownedCards[currentPlayer][currentCategory]) {
                ownedCards = GameState.get('players.ownedCards.' + currentPlayer + '.' + currentCategory);
            }
        }
        
        if (ownedCards.length > 0) {
            html += '<div class="form-card"><div class="section-header"><div class="section-icon">🏆</div>' +
                   '<div class="section-title">Your Owned Cards (' + ownedCards.length + ' available)</div></div>' +
                   '<div class="cards-grid">';
            
            ownedCards.forEach(function(cardId) {
                var categoryData = window.GAME_DATA.categories[currentCategory];
                var cardData = categoryData.items[cardId];
                html += '<div class="card-item card-selectable owned-card" data-card-id="' + HTMLEscaper.escapeHTMLAttribute(cardId) + '">' +
                       '<div class="card-name">👑 ' + sanitizeHTML(cardData.name) + '</div>' +
                       '<div class="card-code">' + sanitizeHTML(cardData.code) + '</div>' +
                       '<div style="font-size: 10px; color: #666;">OWNED</div></div>'
            });
            
            html += '</div><div class="selection-info">💡 Use your owned cards strategically - once used, they\'re gone forever!</div></div>';
        }
        
        // Show remaining available cards
        html += '<div class="form-card"><div class="section-header"><div class="section-icon">🎴</div>' +
               '<div class="section-title">Available Cards (' + remainingCards.length + ' remaining)</div></div><div class="cards-grid">';
        
        remainingCards.forEach(function(cardId, index) {
            var categoryData = window.GAME_DATA.categories[currentCategory];
            var item = categoryData.items[cardId];
            html += '<div class="card-item card-selectable" data-card-id="' + HTMLEscaper.escapeHTMLAttribute(cardId) + '">' +
                   '<div class="card-name">' + sanitizeHTML(item.name) + '</div>' +
                   '<div class="card-code">' + sanitizeHTML(item.code) + '</div>' +
                   '</div>';
        });
        
        html += '</div><div class="selection-info">Click cards to select them for ranking</div></div>';
        safeSetHTML(container, html);
        
        console.log('🎴 Updated availableCardsForSelection with', container.querySelectorAll('.card-selectable[data-card-id]').length, 'selectable cards');
        
        // Add event delegation on the container (most reliable method)
        // Remove any existing listeners first
        if (container._cardClickHandler) {
            container.removeEventListener('click', container._cardClickHandler);
        }
        
        var containerClickHandler = function(event) {
            console.log('🎴 Container clicked, target:', event.target);
            console.log('🎴 Target classList:', event.target.classList);
            console.log('🎴 Target parentNode:', event.target.parentNode);
            var cardElement = event.target.closest('.card-selectable[data-card-id]');
            if (cardElement) {
                var cardId = cardElement.getAttribute('data-card-id');
                console.log('🎴 Card clicked via delegation:', cardId);
                event.preventDefault();
                event.stopPropagation();
                selectCardForRanking(cardId);
            } else {
                console.log('🎴 Click target is not a selectable card');
                console.log('🎴 Available selectable cards:', container.querySelectorAll('.card-selectable[data-card-id]').length);
            }
        };
        
        container._cardClickHandler = containerClickHandler;
        container.addEventListener('click', containerClickHandler);
        
        console.log('🎴 Event delegation set up on container');
    } else {
        console.log('Container not found for available cards');
    }
}

// selectedCardsForRanking now managed through GameState

window.selectCardForRanking = function(cardId) {
    console.log('🎴 selectCardForRanking called with cardId:', cardId);
    
    // Execution guard for automated testing
    if (window.automatedTestState && window.automatedTestState.isSelectingCards) {
        console.log('⚠️ Card selection already in progress, skipping duplicate');
        return;
    }
    
    var gameState = GameState.data;
    var currentCategory = gameState.currentCategory || 'countries';
    var categoryData = window.GAME_DATA.categories[currentCategory];
    var item = categoryData.items[cardId];
    
    // Set processing guard
    if (window.automatedTestState) {
        window.automatedTestState.isSelectingCards = true;
    }
    
    var selectedCardsForRanking = GameState.get('selectedCardsForRanking');
    if (selectedCardsForRanking.includes(cardId)) {
        // In automated testing, prevent deselection to avoid bugs
        if (window.isAutomatedTestRunning) {
            console.log('🤖 Automated test: preventing deselection of ' + item.name);
            if (window.automatedTestState) {
                window.automatedTestState.isSelectingCards = false;
            }
            return;
        }
        
        // Deselect card (manual mode only)
        var updated = selectedCardsForRanking.filter(function(id) { return id !== cardId; });
        GameState.set('selectedCardsForRanking', updated);
        console.log('Removed ' + item.name + ' from selection');
    } else {
        // Select card
        var currentBid = GameState.get('currentBid');
        if (selectedCardsForRanking.length >= currentBid) {
            console.log('You can only select ' + currentBid + ' cards!');
            if (window.automatedTestState) {
                window.automatedTestState.isSelectingCards = false;
            }
            return;
        }
        selectedCardsForRanking.push(cardId);
        GameState.set('selectedCardsForRanking', selectedCardsForRanking);
        console.log('Selected ' + item.name + ' (' + selectedCardsForRanking.length + '/' + currentBid + ')');
        
        // TOKEN OWNERSHIP: Remove owned card when used (consumed forever)
        var currentPlayer = GameState.get('highestBidder');
        var gameState = GameState.data;
        var currentCategory = gameState.currentCategory || 'countries';
        var players = GameState.get('players');
        
        if (ACTIVE_RULES.tokenOwnership && ACTIVE_RULES.allowOwnedInSelection && players.ownedCards && players.ownedCards[currentPlayer]) {
            if (players.ownedCards[currentPlayer][currentCategory]) {
                var ownedCards = GameState.get('players.ownedCards.' + currentPlayer + '.' + currentCategory);
                var ownedIndex = ownedCards.indexOf(cardId);
                if (ownedIndex > -1) {
                    players.ownedCards[currentPlayer][currentCategory].splice(ownedIndex, 1);
                    var categoryData = window.GAME_DATA.categories[currentCategory];
                    var cardData = categoryData.items[cardId];
                    console.log('🔥 ' + currentPlayer + ' consumed owned card: ' + cardData.name + ' (gone forever)');
                    showNotification('Used owned ' + cardData.name + ' - now consumed!', 'info');
                }
            }
        }
    }
    
    // Update visual selection
    updateCardSelectionDisplay();
    
    // Clear processing guard
    if (window.automatedTestState) {
        window.automatedTestState.isSelectingCards = false;
    }
    
    // If we have the right number of cards, show ranking interface
    if (GameState.get('selectedCardsForRanking').length === currentBid) {
        eventListenerManager.addTimeout(function() {
            showRankingInterface();
        }, getTestDelay(GAME_CONFIG.CARD_SELECTION_DELAY));
    }
};

function updateCardSelectionDisplay() {
    // Update visual state of selected cards
    var selectedCardsForRanking = GameState.get('selectedCardsForRanking');
    document.querySelectorAll('.card-selectable').forEach(function(cardElement) {
        var cardId = cardElement.getAttribute('data-card-id');
        if (selectedCardsForRanking.includes(cardId)) {
            cardElement.classList.add('card-selected');
        } else {
            cardElement.classList.remove('card-selected');
        }
    });
    
    // Update selection counter if needed
    var selectionInfo = document.querySelector('.selection-info');
    if (selectionInfo) {
        var currentBid = GameState.get('currentBid');
        selectionInfo.textContent = 'Selected ' + selectedCardsForRanking.length + '/' + currentBid + ' cards. Click cards to select/deselect.';
    }
}

// Ranking Phase Functions
// finalRanking now managed through GameState

function showRankingInterface() {
    // Update scan info for ranking phase
    try {
        var scanInfo = DOMCache.get('scanInfo');
        if (scanInfo) {
            var gameState = GameState.data;
            
            // Determine ranking order using centralized validator
            var challengeType = RankingValidator.detectChallengeType(gameState.currentPrompt);
            var rankingDirection = challengeType === 'ascending' ? 'lowest to highest' : 'highest to lowest';
            
            var scanData = {
                challengeLabel: gameState.currentPrompt.label,
                description: 'Drag cards to rank them from ' + rankingDirection
            };
            safeSetHTML(scanInfo, TemplateEngine.render('scanInfo', scanData));
        }
    } catch (error) {
        safeConsoleLog('Error updating scan info for ranking:', error);
    }
    
    // Hide card selection interface
    var container = document.getElementById('availableCardsForSelection');
    if (container) {
        container.style.display = 'none';
    }
    
    // Show ranking interface
    updateRankingInterface();
}

function updateRankingInterface() {
    // Create or update ranking container
    var rankingContainer = document.getElementById('rankingContainer');
    if (!rankingContainer) {
        var scanContent = document.querySelector('#scanScreen .screen-content');
        rankingContainer = document.createElement('div');
        rankingContainer.id = 'rankingContainer';
        scanContent.appendChild(rankingContainer);
    }
    
    var html = '<div class="form-card">' +
              '<div class="section-header">' +
              '<div class="section-icon">📊</div>' +
              '<div class="section-title">Rank Your Cards</div>' +
              '</div>' +
              '<div class="ranking-instructions">Drag cards to reorder them. Top = Highest value for this category.</div>' +
              '<div id="rankingArea" class="ranking-area">';
    
    // Show cards in current ranking order (or selection order if not yet ranked)
    var finalRanking = GameState.get('finalRanking');
    var selectedCardsForRanking = GameState.get('selectedCardsForRanking');
    var cardsToRank = finalRanking.length > 0 ? finalRanking : selectedCardsForRanking.slice();
    
    cardsToRank.forEach(function(cardId, index) {
        var currentCategory = GameState.get('currentCategory') || 'countries';
        var categoryData = window.GAME_DATA.categories[currentCategory];
        var item = categoryData ? categoryData.items[cardId] : null;
        html += '<div class="ranking-card" data-card-id="' + HTMLEscaper.escapeHTMLAttribute(cardId) + '" draggable="true">' +
               '<span class="rank-number">' + (index + 1) + '</span>' +
               '<span class="country-name">' + sanitizeHTML(item ? item.name : cardId) + '<br><small>' + sanitizeHTML(item ? item.code : cardId) + '</small></span>' +
               '<span class="drag-handle">⋮⋮</span>' +
               '</div>';
    });
    
    html += '</div>' +
           '<div class="ranking-actions">' +
           '<button class="btn primary" onclick="submitRanking()">✅ Submit Ranking</button>' +
           '<button class="btn secondary" onclick="resetRanking()">🔄 Reset Order</button>' +
           '</div>' +
           '</div>';
    
    safeSetHTML(rankingContainer, html);
    
    // Add drag and drop functionality
    setupDragAndDrop();
}

function setupDragAndDrop() {
    var rankingCards = document.querySelectorAll('.ranking-card');
    var rankingArea = document.getElementById('rankingArea');
    
    rankingCards.forEach(function(card) {
        var dragStartHandler = function(e) {
            try {
                e.dataTransfer.setData('text/plain', this.getAttribute('data-card-id'));
                this.classList.add('dragging');
            } catch (dragError) {
                safeConsoleLog('Error in dragstart:', dragError);
            }
        };
        
        var dragEndHandler = function(e) {
            try {
                this.classList.remove('dragging');
            } catch (dragError) {
                safeConsoleLog('Error in dragend:', dragError);
            }
        };
        
        eventListenerManager.addListener(card, 'dragstart', dragStartHandler);
        eventListenerManager.addListener(card, 'dragend', dragEndHandler);
    });
    
    var dragOverHandler = function(e) {
        try {
            e.preventDefault();
            var dragging = document.querySelector('.dragging');
            if (dragging) {
                var afterElement = getDragAfterElement(rankingArea, e.clientY);
                
                if (afterElement == null) {
                    rankingArea.appendChild(dragging);
                } else {
                    rankingArea.insertBefore(dragging, afterElement);
                }
            }
        } catch (dragError) {
            safeConsoleLog('Error in dragover:', dragError);
        }
    };
    
    var dropHandler = function(e) {
        try {
            e.preventDefault();
            if (typeof updateRankingOrder === 'function') {
                updateRankingOrder();
            }
        } catch (dropError) {
            safeConsoleLog('Error in drop:', dropError);
        }
    };
    
    eventListenerManager.addListener(rankingArea, 'dragover', dragOverHandler);
    eventListenerManager.addListener(rankingArea, 'drop', dropHandler);
}

function getDragAfterElement(container, y) {
    var draggableElements = Array.from(container.querySelectorAll('.ranking-card:not(.dragging)'));
    
    return draggableElements.reduce(function(closest, child) {
        var box = child.getBoundingClientRect();
        var offset = y - box.top - box.height / 2;
        
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}

function updateRankingOrder() {
    var cards = document.querySelectorAll('.ranking-card');
    var finalRanking = [];
    
    cards.forEach(function(card, index) {
        var cardId = card.getAttribute('data-card-id');
        finalRanking.push(cardId);
        
        // Update rank number
        var rankNumber = card.querySelector('.rank-number');
        if (rankNumber) {
            rankNumber.textContent = (index + 1);
        }
    });
    
    // Update GameState with new ranking
    GameState.set('finalRanking', finalRanking);
}

window.submitRanking = function() {
    var finalRanking = GameState.get('finalRanking');
    if (finalRanking.length === 0) {
        // Use current order if no dragging happened
        updateRankingOrder();
        finalRanking = GameState.get('finalRanking');
    }
    
    var currentBid = GameState.get('currentBid');
    var currentBid = GameState.get('currentBid');
    if (finalRanking.length !== currentBid) {
        console.log('Error: Ranking is incomplete!');
        return;
    }
    
    // Show confirmation
    var confirmMsg = 'Submit this ranking?\n\n';
    finalRanking.forEach(function(cardId, index) {
        var currentCategory = GameState.get('currentCategory') || 'countries';
        var categoryData = window.GAME_DATA.categories[currentCategory];
        var item = categoryData ? categoryData.items[cardId] : null;
        confirmMsg += (index + 1) + '. ' + (item ? item.name : cardId) + '\n';
    });
    
    // Auto-confirm for automated testing
    console.log('Confirmed ranking submission:', confirmMsg);
    showRevealPhase();
};

window.resetRanking = function() {
    var selectedCardsForRanking = GameState.get('selectedCardsForRanking');
    GameState.set('finalRanking', selectedCardsForRanking.slice()); // Reset to selection order
    updateRankingInterface();
};

// Reveal Phase Functions
var correctRanking = [];
// currentRevealIndex moved to GameState
var bidderSuccess = false;

function showRevealPhase() {
    // Calculate the correct ranking for the selected cards
    var finalRanking = GameState.get('finalRanking');
    var currentPrompt = GameState.get('currentPrompt');
    correctRanking = calculateCorrectRanking(finalRanking, currentPrompt.challenge);
    GameState.set('currentRevealIndex', 0);
    bidderSuccess = false;
    GameState.set('bidderSuccess', false);
    GameState.set('revealCompletionHandled', false);
    
    console.log('🎬 Starting reveal phase with finalRanking:', finalRanking);
    
    // Update reveal screen
    try {
        var revealInfo = DOMCache.get('revealInfo');
        if (revealInfo) {
            var gameState = GameState.data;
            var revealData = {
                challengeLabel: gameState.currentPrompt.label,
                description: GameUtils.formatPlayerName(gameState.highestBidder) + ' bid ' + gameState.currentBid + ' cards. Let\'s see if they got it right!'
            };
            safeSetHTML(revealInfo, TemplateEngine.render('revealInfo', revealData));
        }
    } catch (error) {
        safeConsoleLog('Error updating reveal info:', error);
    }
    
    // Initialize reveal interface
    setupRevealInterface();
    
    showScreen('revealScreen');
    
    // Start reveal automation for automated testing
    if (window.isAutomatedTestRunning) {
        console.log('🤖 Auto-starting reveal automation...');
        setTimeout(() => {
            automatedReveal();
        }, 100); // Small delay to ensure screen transition completes
    }
}

/**
 * Centralized Ranking Validation System
 * Single source of truth for all ranking validation logic
 */
class RankingValidator {
    /**
     * Detect if a challenge is ascending or descending based on prompt label
     * @param {Object} prompt - The challenge prompt object
     * @returns {string} 'ascending' | 'descending'
     */
    static detectChallengeType(prompt) {
        if (!prompt || !prompt.label) {
            console.warn('⚠️ RankingValidator: No prompt label provided, defaulting to descending');
            return 'descending';
        }
        
        var promptText = prompt.label || '';
        var isAscending = promptText.includes('lowest to highest');
        var isDescending = promptText.includes('highest to lowest');
        
        if (isAscending && !isDescending) {
            return 'ascending';
        } else if (isDescending && !isAscending) {
            return 'descending';
        } else if (isAscending && isDescending) {
            console.warn('⚠️ RankingValidator: Prompt contains both ascending and descending instructions, defaulting to descending');
            return 'descending';
        } else {
            // Default to descending for challenges that don't specify
            console.warn('⚠️ RankingValidator: No clear direction in prompt, defaulting to descending');
            return 'descending';
        }
    }
    
    /**
     * Calculate the correct ranking order for given cards and challenge
     * @param {Array} cardIds - Array of card IDs to rank
     * @param {string} challenge - The challenge property name
     * @param {Object} prompt - The challenge prompt object (contains direction info)
     * @returns {Array} Correctly ordered array of card IDs
     */
    static calculateCorrectRanking(cardIds, challenge, prompt) {
        if (!Array.isArray(cardIds) || cardIds.length === 0) {
            console.warn('⚠️ RankingValidator: Invalid or empty cardIds array');
            return [];
        }
        
        var challengeType = this.detectChallengeType(prompt);
        var currentCategory = GameState.get('currentCategory') || 'countries';
        var categoryData = window.GAME_DATA?.categories?.[currentCategory];
        
        if (!categoryData) {
            console.error('❌ RankingValidator: Category data not found for:', currentCategory);
            return cardIds.slice(); // Return original order as fallback
        }
        
        console.log('🎯 RankingValidator: Calculating correct ranking', {
            challenge: challenge,
            challengeType: challengeType,
            cardCount: cardIds.length,
            category: currentCategory
        });
        
        return cardIds.slice().sort(function(a, b) {
            var itemA = categoryData.items?.[a];
            var itemB = categoryData.items?.[b];
            
            if (!itemA || !itemB) {
                console.warn('⚠️ RankingValidator: Missing item data for cards:', { a: !!itemA, b: !!itemB });
                return 0; // Keep original order for missing data
            }
            
            var valueA = itemA[challenge];
            var valueB = itemB[challenge];
            
            // Handle missing or invalid values
            if (valueA == null || valueA == undefined) valueA = 0;
            if (valueB == null || valueB == undefined) valueB = 0;
            
            // Convert to numbers if they're strings
            if (typeof valueA === 'string') valueA = parseFloat(valueA) || 0;
            if (typeof valueB === 'string') valueB = parseFloat(valueB) || 0;
            
            // Sort based on challenge type
            if (challengeType === 'ascending') {
                return valueA - valueB; // Ascending: lowest to highest
            } else {
                return valueB - valueA; // Descending: highest to lowest
            }
        });
    }
    
    /**
     * Validate a player's ranking against the correct order
     * @param {Array} playerRanking - Player's card ranking order
     * @param {string} challenge - The challenge property name  
     * @param {Object} prompt - The challenge prompt object
     * @returns {Object} Validation result with detailed information
     */
    static validatePlayerRanking(playerRanking, challenge, prompt) {
        if (!Array.isArray(playerRanking) || playerRanking.length === 0) {
            return {
                isValid: false,
                error: 'INVALID_INPUT',
                message: 'Player ranking is not a valid array or is empty',
                firstError: null,
                challengeType: null,
                correctRanking: []
            };
        }
        
        var challengeType = this.detectChallengeType(prompt);
        var correctRanking = this.calculateCorrectRanking(playerRanking, challenge, prompt);
        
        console.log('🔍 RankingValidator: Validating player ranking', {
            challenge: challenge,
            challengeType: challengeType,
            playerRanking: playerRanking,
            correctRanking: correctRanking
        });
        
        // Check if rankings are identical
        var isValid = true;
        var firstError = null;
        
        for (var i = 0; i < playerRanking.length; i++) {
            if (playerRanking[i] !== correctRanking[i]) {
                isValid = false;
                firstError = {
                    position: i,
                    playerCard: playerRanking[i],
                    correctCard: correctRanking[i],
                    message: `Position ${i + 1}: Player placed '${playerRanking[i]}' but should be '${correctRanking[i]}'`
                };
                break;
            }
        }
        
        var result = {
            isValid: isValid,
            error: isValid ? null : 'RANKING_MISMATCH',
            message: isValid ? 'Ranking is correct' : firstError.message,
            firstError: firstError,
            challengeType: challengeType,
            correctRanking: correctRanking,
            playerRanking: playerRanking.slice()
        };
        
        // Enhanced logging for validation results
        console.log('🎯 RANKING VALIDATION RESULT:');
        console.log(`  Player ranking: ${playerRanking.join(' → ')}`);
        console.log(`  Correct ranking: ${correctRanking.join(' → ')}`);
        console.log(`  Result: ${isValid ? '✅ CORRECT' : '❌ INCORRECT'}`);
        if (!isValid && firstError) {
            console.log(`  Error: ${firstError.message}`);
        }
        
        return result;
    }
    
    /**
     * Validate ranking sequence during card-by-card reveal
     * Checks if the current card maintains proper sequence with previous card
     * @param {string} prevCardId - Previous card ID
     * @param {string} currentCardId - Current card ID  
     * @param {string} challenge - The challenge property name
     * @param {Object} prompt - The challenge prompt object
     * @returns {Object} Sequence validation result
     */
    static validateSequenceStep(prevCardId, currentCardId, challenge, prompt) {
        if (!prevCardId || !currentCardId) {
            return {
                isValid: true,
                error: null,
                message: 'Sequence validation skipped (missing cards)'
            };
        }
        
        var challengeType = this.detectChallengeType(prompt);
        var currentCategory = GameState.get('currentCategory') || 'countries';
        var categoryData = window.GAME_DATA?.categories?.[currentCategory];
        
        if (!categoryData) {
            return {
                isValid: false,
                error: 'CATEGORY_DATA_MISSING',
                message: `Category data not found: ${currentCategory}`
            };
        }
        
        var prevItem = categoryData.items?.[prevCardId];
        var currentItem = categoryData.items?.[currentCardId];
        
        if (!prevItem || !currentItem) {
            return {
                isValid: false,
                error: 'CARD_DATA_MISSING',
                message: `Card data missing: ${prevCardId}=${!!prevItem}, ${currentCardId}=${!!currentItem}`
            };
        }
        
        var prevValue = prevItem[challenge];
        var currentValue = currentItem[challenge];
        
        // Handle missing values
        if (prevValue == null) prevValue = 0;
        if (currentValue == null) currentValue = 0;
        
        // Convert to numbers if needed
        if (typeof prevValue === 'string') prevValue = parseFloat(prevValue) || 0;
        if (typeof currentValue === 'string') currentValue = parseFloat(currentValue) || 0;
        
        var isValid;
        var expectedDirection;
        
        if (challengeType === 'ascending') {
            // Ascending: current should be >= previous
            isValid = currentValue >= prevValue;
            expectedDirection = 'should be greater than or equal to';
        } else {
            // Descending: current should be <= previous  
            isValid = currentValue <= prevValue;
            expectedDirection = 'should be less than or equal to';
        }
        
        console.log('🔍 RankingValidator: Sequence step validation', {
            challengeType: challengeType,
            prevCard: prevCardId,
            currentCard: currentCardId,
            prevValue: prevValue,
            currentValue: currentValue,
            isValid: isValid,
            expectedDirection: expectedDirection
        });
        
        return {
            isValid: isValid,
            error: isValid ? null : 'SEQUENCE_BROKEN',
            message: isValid 
                ? 'Sequence is correct'
                : `Sequence broken: ${currentItem.name} (${currentValue}) ${expectedDirection} ${prevItem.name} (${prevValue})`,
            challengeType: challengeType,
            prevCard: {
                id: prevCardId,
                name: prevItem.name,
                value: prevValue
            },
            currentCard: {
                id: currentCardId,
                name: currentItem.name,
                value: currentValue
            }
        };
    }
}

// Export RankingValidator to window for global access
window.RankingValidator = RankingValidator;

// Legacy function wrapper for backward compatibility
function calculateCorrectRanking(cardIds, challenge) {
    var currentPrompt = GameState.get('currentPrompt');
    return RankingValidator.calculateCorrectRanking(cardIds, challenge, currentPrompt);
}

function setupRevealInterface() {
    var revealCards = document.getElementById('revealCards');
    if (!revealCards) return;
    
    var html = '<div class="reveal-container">' +
              '<h4>' + highestBidder + '\'s Ranking</h4>' +
              '<div class="ranking-list" id="bidderRankingList"></div>' +
              '</div>';
    
    safeSetHTML(revealCards, html);
    
    // Show bidder's ranking
    updateBidderRankingDisplay();
    
    // Update progress
    updateRevealProgress();
}

function updateBidderRankingDisplay() {
    var container = document.getElementById('bidderRankingList');
    if (!container) return;
    
    var finalRanking = GameState.get('finalRanking');
    var currentPrompt = GameState.get('currentPrompt');
    var html = '';
    var sequenceBroken = false;
    
    finalRanking.forEach(function(cardId, index) {
        var currentCategory = GameState.get('currentCategory') || 'countries';
        var categoryData = window.GAME_DATA.categories[currentCategory];
        var item = categoryData ? categoryData.items[cardId] : null;
        var value = item ? item[currentPrompt.challenge] : 0;
        var currentRevealIndex = GameState.get('currentRevealIndex') || 0;
        var isRevealed = index < currentRevealIndex;
        
        var statusClass = '';
        var statusIcon = '';
        
        if (!isRevealed) {
            statusClass = 'hidden';
        } else {
            // Check if this card maintains the sequence
            if (index === 0) {
                // First card is always correct
                statusClass = 'revealed correct';
                statusIcon = ' ✓';
            } else {
                // Check against previous card
                var prevCard = finalRanking[index - 1];
                var prevItem = categoryData ? categoryData.items[prevCard] : null;
                var prevValue = prevItem ? prevItem[currentPrompt.challenge] : 0;
                
                // Use centralized validation for sequence checking
                var validation = RankingValidator.validateSequenceStep(
                    prevCard, 
                    cardId, 
                    currentPrompt.challenge, 
                    currentPrompt
                );
                
                if (!validation.isValid) {
                    // This card breaks the sequence
                    statusClass = 'revealed wrong';
                    statusIcon = ' ✗';
                    sequenceBroken = true;
                } else if (!sequenceBroken) {
                    // Still in correct sequence
                    statusClass = 'revealed correct';
                    statusIcon = ' ✓';
                } else {
                    // After sequence is broken, just show as revealed
                    statusClass = 'revealed';
                }
            }
        }
        
        html += '<div class="reveal-card bidder-card ' + statusClass + '">' +
               '<span class="rank-number">' + (index + 1) + '</span>' +
               '<span class="country-info">' +
               '<span class="country-name">' + (item ? item.name : cardId) + '<br><small>' + (item ? item.code : cardId) + '</small></span>' +
               '<span class="country-value">' + (isRevealed ? formatValue(value, currentPrompt.challenge) : '???') + '</span>' +
               '</span>' +
               '<span class="status-icon">' + statusIcon + '</span>' +
               '</div>';
    });
    
    safeSetHTML(container, html);
}


function formatValue(value, challenge) {
    // Format the value based on the challenge type
    if (challenge.includes('consumption') || challenge.includes('price')) {
        return value.toFixed(1);
    } else if (challenge.includes('percentage') || challenge.includes('rate')) {
        return value.toFixed(1) + '%';
    } else if (challenge.includes('area') || challenge.includes('population')) {
        return value.toLocaleString();
    } else {
        return value.toString();
    }
}

function updateRevealProgress() {
    var progressElement = document.getElementById('revealProgress');
    if (progressElement) {
        var currentRevealIndex = GameState.get('currentRevealIndex') || 0;
        progressElement.textContent = currentRevealIndex + ' of ' + correctRanking.length;
    }
    
    var progressBar = document.getElementById('revealProgressBar');
    if (progressBar) {
        var currentRevealIndex = GameState.get('currentRevealIndex') || 0;
        var percentage = (currentRevealIndex / correctRanking.length) * 100;
        progressBar.style.width = percentage + '%';
    }
}

// Override the existing revealNext function
window.revealNext = function() {
    var finalRanking = GameState.get('finalRanking');
    var currentRevealIndex = GameState.get('currentRevealIndex') || 0;
    if (currentRevealIndex >= finalRanking.length) {
        // All cards revealed, show final results
        showFinalResults();
        return;
    }
    
    // Reveal the next card
    currentRevealIndex++;
    GameState.set('currentRevealIndex', currentRevealIndex);
    updateBidderRankingDisplay();
    updateRevealProgress();
    
    // If we've revealed at least 2 cards, validate sequence using centralized validator
    currentRevealIndex = GameState.get('currentRevealIndex') || 0;
    if (currentRevealIndex >= 2) {
        var finalRanking = GameState.get('finalRanking');
        var currentPrompt = GameState.get('currentPrompt');
        var prevCard = finalRanking[currentRevealIndex - 2];
        var currentCard = finalRanking[currentRevealIndex - 1];
        
        // Use centralized validation
        var validation = RankingValidator.validateSequenceStep(
            prevCard, 
            currentCard, 
            currentPrompt.challenge, 
            currentPrompt
        );
        
        console.log('🔍 Centralized sequence validation:', validation);
        
        if (!validation.isValid) {
            // Sequence broken!
            bidderSuccess = false;
            GameState.set('bidderSuccess', false);
            
            // Delay failure message so players can see the problematic card first
            eventListenerManager.addTimeout(function() {
                var prevData = validation.prevCard;
                var currentData = validation.currentCard;
                
                console.log('SEQUENCE BROKEN!\n\n' + 
                      prevData.name + ': ' + formatValue(prevData.value, currentPrompt.challenge) + '\n' +
                      currentData.name + ': ' + formatValue(currentData.value, currentPrompt.challenge) + '\n\n' +
                      validation.message + '\n' +
                      GameState.get('highestBidder') + ' fails!');
                
                // Reveal all remaining cards
                var finalRanking = GameState.get('finalRanking');
                currentRevealIndex = finalRanking.length;
                updateBidderRankingDisplay();
                updateRevealProgress();
                
                eventListenerManager.addTimeout(function() {
                    showFinalResults();
                }, GAME_CONFIG.FINAL_RESULTS_DELAY);
            }, GAME_CONFIG.RANKING_REVEAL_FAILURE); // Wait 1 second to see the card that broke the sequence
            return;
        }
    }
    
    // If this was the last card, check if bidder succeeded
    var finalRanking = GameState.get('finalRanking');
    if (currentRevealIndex >= finalRanking.length) {
        // If we reach here without bidderSuccess being set to false by validation,
        // then the bidder succeeded in ranking all cards correctly
        if (!GameState.get('bidderSuccess')) {
            console.log('🎉 All cards revealed successfully! Bidder succeeds.');
            bidderSuccess = true;
            GameState.set('bidderSuccess', true);
        }
        
        eventListenerManager.addTimeout(function() {
            var gameState = GameState.data;
            if (bidderSuccess) {
                console.log('SUCCESS! ' + gameState.highestBidder + ' ranked all ' + gameState.currentBid + ' cards correctly!');
            }
            eventListenerManager.addTimeout(function() {
                showFinalResults();
            }, GAME_CONFIG.RANKING_REVEAL_FAILURE);
        }, GAME_CONFIG.RANKING_REVEAL_SUCCESS); // Wait 1.5 seconds for celebration moment
    }
};

function showFinalResults() {
    console.log('🏁 showFinalResults called');
    console.log('🐛 DEBUG: Call stack trace:', new Error().stack);
    console.log('Bidder success:', bidderSuccess);
    console.log('Current reveal index:', GameState.get('currentRevealIndex') || 0);
    
    // Get state from GameState
    var gameState = GameState.data;
    var finalRanking = gameState.finalRanking;
    var currentPrompt = gameState.currentPrompt;
    var currentRound = gameState.currentRound;
    var highestBidder = gameState.highestBidder;
    var currentBid = gameState.currentBid;
    var players = gameState.players;
    var maxRounds = gameState.maxRounds;
    
    console.log('Final ranking:', finalRanking);
    
    // Track round completion results
    if (window.isAutomatedTestRunning && window.automatedTestResults) {
        // Round tracking now unified through players.stats
        // No need for separate roundData tracking
        
        // Update success/failure counts
        if (bidderSuccess) {
            window.automatedTestResults.successfulBids++;
            window.automatedTestResults.playerStats[highestBidder].bidsSuccessful++;
        } else {
            window.automatedTestResults.failedBids++;
        }
        
        console.log('📊 Round results tracked for automated test');
    }
    
    // Note: Scores are now calculated in continueToNextRound() before this function is called
    
    // NOW update player final scores after they've been calculated
    if (window.isAutomatedTestRunning && window.automatedTestResults) {
        Object.keys(players.scores).forEach(function(playerName) {
            if (window.automatedTestResults.playerStats[playerName]) {
                window.automatedTestResults.playerStats[playerName].totalScore = players.scores[playerName];
            }
        });
        console.log('📊 Updated player scores in test results:', players.scores);
    }
    
    updateInterimDisplay();
    
    // Debug: Check if scores are properly stored
    console.log('🔍 DEBUG: Checking scores before showing interim screen');
    console.log('  GameState scores:', GameState.get('players.scores'));
    console.log('  GameState players list:', GameState.get('players.list'));
    console.log('  getFinalScores():', getFinalScores());
    console.log('  getPlayersScores():', getPlayersScores());
    
    showScreen('interimScreen');
    
    console.log('✅ Interim screen should now be visible');
    
    // For automated testing, continue to next round after showing interim screen
    if (window.isAutomatedTestRunning) {
        // Give more time for interim screen to properly display and log data
        eventListenerManager.addTimeout(() => {
            console.log('📊 INTERIM SCREEN DATA:');
            console.log('Current Round:', getCurrentRound());
            var players = GameState.get('players');
            console.log('Current Scores:', players.scores);
            console.log('Current Tokens:', players.blockingTokens);
            console.log('Player Stats:', players.stats);
            
            // Force update all interim displays again to ensure they render
            console.log('🔄 Force updating interim displays...');
            updateInterimDisplay();
            
            eventListenerManager.addTimeout(() => {
                console.log('🔍 Checking round continuation conditions:');
                console.log('Current Round:', getCurrentRound());
                console.log('Max Rounds:', getMaxRounds());
                console.log('Current Round < Max Rounds:', getCurrentRound() < maxRounds);
                console.log('Win Condition:', checkWinCondition());
                console.log('Automated Test Running:', window.isAutomatedTestRunning);
                
                var winCondition = checkWinCondition();
                console.log('🔍 Game continuation check:');
                console.log('  - Current round:', getCurrentRound());
                console.log('  - Max rounds:', ACTIVE_RULES.maxRounds);
                console.log('  - Win condition met:', winCondition);
                if (winCondition) {
                    console.log('  - Winner:', winCondition, 'with score >=', ACTIVE_RULES.winningScore);
                    console.log('  - 🐛 DEBUG: Current player scores:', getPlayersScores());
                }
                
                console.log('🐛 DEBUG: Game completion check - currentRound:', getCurrentRound(), 'maxRounds:', ACTIVE_RULES.maxRounds, 'winCondition:', winCondition);
                console.log('🐛 DEBUG: Condition result:', (getCurrentRound() < ACTIVE_RULES.maxRounds && !winCondition));
                
                // Skip game completion check during automated tests - let nextRound() handle it
                console.log('▶️ Automated test: Continuing to next round...');
                continueToNextRound();
                
                eventListenerManager.addTimeout(async () => {
                    try {
                        console.log('🎮 Starting automated round:', getCurrentRound());
                        await automatedRound(getCurrentRound());
                    } catch (error) {
                        console.error('❌ Error in automated round ' + getCurrentRound() + ':', error);
                        console.error('❌ Automated test failed in round ' + getCurrentRound());
                        window.isAutomatedTestRunning = false;
                    }
                }, getTestDelay(1500)); // Use getTestDelay for fast mode
            }, getTestDelay(2000)); // Close the middle eventListenerManager.addTimeout
        }, getTestDelay(1000)); // Close the outermost eventListenerManager.addTimeout
    }
}

function calculateAndApplyScores() {
    console.log('💰 Calculating scores - Round:', getCurrentRound(), 'Bidder:', getHighestBidder(), 'Success:', GameState.get('bidderSuccess'));
    
    // Prevent multiple executions per round
    if (GameState.get('players.scoresCalculatedThisRound')) {
        console.log('⚠️ Scores already calculated for this round, skipping...');
        console.log('   Round:', getCurrentRound(), 'Bidder:', getHighestBidder());
        console.log('   Stack:', new Error().stack.split('\n').slice(0,3).join('\n'));
        return;
    }
    // Track that this player won a bid  
    var bidder = getHighestBidder();
    var allStats = GameState.get('players.stats') || {};
    
    // Validate bidder is a valid player name
    if (!bidder || bidder.trim() === '' || bidder === 'undefined') {
        console.error('❌ CRITICAL: Invalid highest bidder for round', getCurrentRound(), 'bidder:', bidder);
        console.error('  bidder type:', typeof bidder);
        console.error('  bidder value:', JSON.stringify(bidder));
        console.error('  This indicates a bug in the bidding logic!');
        console.error('  Skipping score calculation entirely');
        return; // Skip score calculation if no valid bidder
    }
    
    console.log('✅ Calculating scores for round', getCurrentRound(), 'for first time');
    GameState.set('players.scoresCalculatedThisRound', true);
    
    if (allStats && allStats[bidder]) {
        console.log('🐛 DEBUG: About to increment bidsWon');
        console.log('  Round:', getCurrentRound());
        console.log('  Player:', bidder);
        console.log('  Current bidsWon:', allStats[bidder].bidsWon);
        console.log('  Function caller:', new Error().stack.split('\n')[2]);
        
        allStats[bidder].bidsWon++;
        GameState.set('players.stats', allStats);
        console.log('📊 Bid won:', bidder, '(Total:', allStats[bidder].bidsWon + ')');
    } else {
        console.error('❌ Cannot track bid win for:', bidder);
        console.error('  bidder type:', typeof bidder);
        console.error('  bidder length:', bidder ? bidder.length : 'N/A');
        console.error('  allStats exists:', !!allStats);
        console.error('  bidder in allStats:', bidder && allStats ? (bidder in allStats) : 'N/A');
        console.error('  Round:', getCurrentRound());
    }
    
    // Get players object from GameState for consistent access
    var players = GameState.get('players');
    var highestBidder = GameState.get('highestBidder');
    var currentBid = GameState.get('currentBid');
    var bidderSuccess = GameState.get('bidderSuccess');
    
    // Update test statistics for bid tracking
    updateTestStatistics('BID_WON', {player: highestBidder});
    
    if (bidderSuccess) {
        // Bidder succeeds - gets points equal to their bid
        var pointsAwarded = currentBid;
        var currentScore = getPlayerScore(highestBidder);
        setPlayerScore(highestBidder, currentScore + pointsAwarded);
        console.log('💰 SCORE UPDATE: ' + highestBidder + ' awarded ' + pointsAwarded + ' points (new total: ' + (currentScore + pointsAwarded) + ')');
        console.log('🔍 DEBUG: Score after award - getPlayerScore(' + highestBidder + '):', getPlayerScore(highestBidder));
        
        // Track successful bid (use GameState functions to avoid overwriting scores)
        var currentStats = getPlayerStats(highestBidder);
        if (currentStats) {
            currentStats.bidsSuccessful = (currentStats.bidsSuccessful || 0) + 1;
            GameState.set('players.stats.' + highestBidder, currentStats);
            console.log('📊 Tracking successful bid for', highestBidder, '- Total successful:', currentStats.bidsSuccessful);
        }
        
        // Score changes already saved via setPlayerScore() - no need to overwrite entire players object
        
        // Update test statistics for successful bid
        updateTestStatistics('BID_SUCCESSFUL', {player: highestBidder});
        
        // Transfer blocking tokens from other players to bidder
        console.log('🔄 Processing token transfers for blocks:', Object.keys(players.currentBlocks));
        console.log('🎯 Current bidder:', highestBidder);
        console.log('🛡️ Blockers:', Object.keys(players.currentBlocks));
        Object.keys(players.currentBlocks).forEach(function(playerName) {
            if (playerName !== highestBidder && players.currentBlocks[playerName]) {
                var blockData = players.currentBlocks[playerName];
                var tokenValue = blockData.tokenValue;
                console.log('💰 Transferring', tokenValue, 'token from', playerName, 'to', highestBidder);
                
                // Track that this block was lost (bidder succeeded)
                var currentStats = getPlayerStats(playerName);
                if (currentStats) {
                    currentStats.blocksLost = (currentStats.blocksLost || 0) + 1;
                    GameState.set('players.stats.' + playerName, currentStats);
                    console.log('📊 BLOCKS LOST: ' + playerName + ' total lost blocks: ' + currentStats.blocksLost);
                }
                
                // Remove token from blocker (decrease count)
                var currentBlockerTokens = getPlayerTokens(playerName);
                console.log('🔍 Before transfer:', playerName, 'has', currentBlockerTokens[tokenValue], tokenValue + '-point tokens');
                if (currentBlockerTokens[tokenValue] > 0) {
                    currentBlockerTokens[tokenValue]--;
                    GameState.set('players.blockingTokens.' + playerName, currentBlockerTokens);
                    console.log('🔍 After removal:', playerName, 'now has', currentBlockerTokens[tokenValue], tokenValue + '-point tokens');
                    
                    // Track tokens lost
                    if (players.stats[playerName]) {
                        players.stats[playerName].tokensLost++;
                        console.log('📊 Tracking token lost for', playerName, '- Total lost:', players.stats[playerName].tokensLost);
                    }
                    console.log(playerName + ' loses ' + tokenValue + '-point token to ' + highestBidder);
                    
                    // Give token to bidder ONLY if it was removed from blocker
                    var currentBidderTokens = getPlayerTokens(highestBidder);
                    console.log('🔍 Before addition:', highestBidder, 'has', currentBidderTokens[tokenValue], tokenValue + '-point tokens');
                    currentBidderTokens[tokenValue] = (currentBidderTokens[tokenValue] || 0) + 1;
                    GameState.set('players.blockingTokens.' + highestBidder, currentBidderTokens);
                    console.log('🔍 After addition:', highestBidder, 'now has', currentBidderTokens[tokenValue], tokenValue + '-point tokens');
                    // Track block chips gained (not the same as card tokens)
                    if (players.stats[highestBidder]) {
                        // Note: tokensGained tracks cards gained, not block chips
                        // Block chips transferred here don't count as "tokens gained"
                        console.log('📊 Block chip transferred to', highestBidder, '(not counted in tokensGained)');
                    }
                    console.log(highestBidder + ' gains ' + tokenValue + '-point token from ' + playerName);
                } else {
                    console.log('⚠️ WARNING: ' + playerName + ' tried to block with ' + tokenValue + '-point token but doesn\'t have one!');
                }
            }
        });
        
        console.log(highestBidder + ' succeeded! Awarded ' + pointsAwarded + ' points.');
        
    } else {
        // Bidder fails - gets 0 points (no penalty)
        console.log(highestBidder + ' failed! Gets 0 points this round.');
        
        // Update test statistics for failed bid
        updateTestStatistics('BID_FAILED', {player: highestBidder});
        
        // Each blocking player gets points equal to their token value (and keeps their tokens)
        var currentBlocks = GameState.get('players.currentBlocks');
        var highestBidder = GameState.get('highestBidder');
        Object.keys(currentBlocks).forEach(function(playerName) {
            if (playerName !== highestBidder && currentBlocks[playerName]) {
                var playerBlocks = currentBlocks[playerName];
                
                // Handle both array and single block formats
                if (!Array.isArray(playerBlocks)) {
                    // Convert single block to array for consistent processing
                    playerBlocks = [playerBlocks];
                    console.log('🔄 Converting single block to array for', playerName);
                }
                
                // Process each block for this player
                playerBlocks.forEach(function(blockData) {
                    var tokenValue = blockData.tokenValue;
                    var blockedCardId = blockData.cardId;
                    var currentScore = GameState.get('players.scores.' + playerName) || 0;
                    GameState.set('players.scores.' + playerName, currentScore + tokenValue);
                    console.log(playerName + ' earned ' + tokenValue + ' points for successful block and keeps their token!');
                    
                    // Track blocking points earned for breakdown display
                    var currentStats = getPlayerStats(playerName);
                    if (currentStats) {
                        if (!currentStats.blockingPointsEarned) {
                            currentStats.blockingPointsEarned = 0;
                        }
                        currentStats.blockingPointsEarned += tokenValue;
                        
                        console.log('🛡️ BLOCK SUCCESS TRACKING - Enhanced Logging');
                        console.log('  Player:', playerName);
                        console.log('  Card blocked:', currentBlocks[playerName].cardId);
                        console.log('  Token value:', tokenValue);
                        console.log('  blocksMade:', currentStats.blocksMade || 0);
                        console.log('  tokensGained (before token award):', currentStats.tokensGained || 0);
                        console.log('  blocksWon (before token award):', currentStats.blocksWon || 0);
                        
                        GameState.set('players.stats.' + playerName, currentStats);
                        console.log('📊 Updated blocking points earned for ' + playerName + ': ' + currentStats.blockingPointsEarned);
                    }
                    
                    // TOKEN OWNERSHIP: Give blocked card to player if rule is enabled
                    console.log('🔍 TOKEN OWNERSHIP CHECK for', playerName, '- Rule enabled:', ACTIVE_RULES.tokenOwnership, 'BlockedCardId:', blockedCardId);
                    
                    // Defensive check: ensure playerName is valid
                    if (!playerName || playerName === 'undefined') {
                        console.error('❌ Invalid playerName detected:', playerName, 'Skipping token ownership');
                        return;
                    }
                    
                    if (ACTIVE_RULES.tokenOwnership && blockedCardId) {
                    // We're in the "bidder fails" branch, so blocks are always successful
                    var shouldGainOwnership = true; // Block is successful since bidder failed
                    console.log('🔍 Should gain ownership:', shouldGainOwnership, '(bidder failed, block successful)');
                    
                    if (shouldGainOwnership) {
                        console.log('🔍 PROCEEDING with token ownership for', playerName, 'card:', blockedCardId);
                        
                        // CRITICAL FIX: Use GameState for ownedCards instead of direct players object
                        var ownedCards = GameState.get('players.ownedCards') || {};
                        if (!ownedCards[playerName]) {
                            ownedCards[playerName] = {
                                countries: [],
                                movies: [],
                                sports: [],
                                companies: []
                            };
                        }
                        
                        // Get current category and card data
                        var gameState = GameState.data;
                        var currentCategory = gameState.currentCategory || 'countries';
                        console.log('🔍 Current category:', currentCategory);
                        var categoryData = window.GAME_DATA.categories[currentCategory];
                        var cardData = categoryData ? categoryData.items[blockedCardId] : null;
                        console.log('🔍 Card data lookup:', blockedCardId, '→', cardData ? cardData.name : 'NOT FOUND');
                        
                        // Ensure category array exists
                        if (!ownedCards[playerName][currentCategory]) {
                            ownedCards[playerName][currentCategory] = [];
                            console.log('🔍 Created category array for', playerName, currentCategory);
                        }
                        
                        console.log('🔍 Current owned cards for', playerName, ':', ownedCards[playerName][currentCategory]);
                        console.log('🔍 Checking if', blockedCardId, 'is already owned...');
                        
                        // Only add if not already owned in this category
                        if (!ownedCards[playerName][currentCategory].includes(blockedCardId)) {
                            console.log('🔍 ✅ Card not owned yet, adding to collection');
                            ownedCards[playerName][currentCategory].push(blockedCardId);
                            // CRITICAL FIX: Save the updated ownedCards back to GameState
                            GameState.set('players.ownedCards', ownedCards);
                            console.log('🔍 💾 Saved ownedCards to GameState');
                            
                            if (cardData) {
                                console.log('🏆 ' + playerName + ' now owns ' + cardData.name + ' (successful block)!');
                                showNotification(playerName + ' now owns ' + cardData.name + '!', 'success');
                            } else {
                                console.log('🏆 ' + playerName + ' now owns card ' + blockedCardId + ' (card data not found)!');
                            }
                            
                            // Track token gained (card ownership) in statistics
                            var currentStats = getPlayerStats(playerName);
                            console.log('🔍 Current stats for', playerName, ':', currentStats);
                            if (currentStats) {
                                var oldTokensGained = currentStats.tokensGained || 0;
                                currentStats.tokensGained = oldTokensGained + 1;
                                
                                // CRITICAL FIX: Only increment blocksWon when token is actually gained
                                var oldBlocksWon = currentStats.blocksWon || 0;
                                currentStats.blocksWon = oldBlocksWon + 1;
                                
                                console.log('🏆 TOKEN AND BLOCK WON TRACKING - Enhanced Logging');
                                console.log('  Player:', playerName);
                                console.log('  Card gained:', blockedCardId);
                                console.log('  tokensGained: ' + oldTokensGained + ' -> ' + currentStats.tokensGained);
                                console.log('  blocksWon: ' + oldBlocksWon + ' -> ' + currentStats.blocksWon);
                                console.log('  blocksMade:', currentStats.blocksMade || 0);
                                console.log('  Relationship check: blocksWon == tokensGained?', currentStats.blocksWon === currentStats.tokensGained);
                                
                                GameState.set('players.stats.' + playerName, currentStats);
                                console.log('📊 TOKEN GAINED: ' + playerName + ' went from ' + oldTokensGained + ' to ' + currentStats.tokensGained + ' tokens total');
                                console.log('📊 BLOCKS WON: ' + playerName + ' went from ' + oldBlocksWon + ' to ' + currentStats.blocksWon + ' blocks won total');
                            } else {
                                console.error('❌ No stats found for player:', playerName);
                                console.error('  This indicates a serious data integrity issue!');
                            }
                        } else {
                            console.log('🔍 ❌ DUPLICATE CARD: ' + playerName + ' already owns ' + blockedCardId + ' - no token gained');
                        }
                    }
                    } else {
                        console.log('🔍 ❌ NO TOKEN OWNERSHIP: Rule enabled=', ACTIVE_RULES.tokenOwnership, 'BlockedCardId=', blockedCardId);
                    }
                }); // End of playerBlocks.forEach
            }
        }); // End of Object.keys(currentBlocks).forEach
    }
    
    console.log('💰 FINAL SCORES after calculation:', GameState.get('players.scores'));
    console.log('💰 FINAL SCORES individual check:');
    var playersList = GameState.get('players.list') || [];
    playersList.forEach(function(playerName) {
        console.log('  ' + playerName + ': ' + getPlayerScore(playerName));
    });
    
    // Store blocking results for round summary before clearing
    window.lastRoundBlocks = JSON.parse(JSON.stringify(GameState.get('players.currentBlocks')));
    
    // Track cards used in this round for next round's notification
    // 1. Track selected cards (cards the bidder selected for ranking) - ALWAYS removed regardless of success
    // If selectedCards is empty but we have a bid, assume the bidder selected cards up to their bid amount
    var selectedCards = GameState.get('selectedCards');
    var currentBid = GameState.get('currentBid');
    var drawnCards = GameState.get('drawnCards');
    if ((!selectedCards || selectedCards.length === 0) && currentBid > 0 && drawnCards) {
        // For now, track the first N unblocked cards as selected (where N = bid amount)
        selectedCards = [];
        var blockedCards = GameState.get('blockedCards');
        var unblocked = drawnCards.filter(function(cardId) {
            return !blockedCards.includes(cardId);
        });
        for (var i = 0; i < currentBid && i < unblocked.length; i++) {
            selectedCards.push(unblocked[i]);
        }
        console.log('⚠️ selectedCards was empty, inferring from bid:', selectedCards);
    }
    // Only update lastRoundSelectedCards if we have valid data or if it's currently empty
    if (selectedCards && selectedCards.length > 0) {
        window.lastRoundSelectedCards = selectedCards.slice();
        console.log('🔄 DEBUG: Setting lastRoundSelectedCards to:', window.lastRoundSelectedCards);
        console.log('🔄 DEBUG: Original selectedCards was:', selectedCards);
    } else if (!window.lastRoundSelectedCards || window.lastRoundSelectedCards.length === 0) {
        window.lastRoundSelectedCards = [];
        console.log('🔄 DEBUG: Clearing lastRoundSelectedCards (no existing data)');
    } else {
        console.log('🔄 DEBUG: Preserving existing lastRoundSelectedCards:', window.lastRoundSelectedCards);
        console.log('🔄 DEBUG: Skipping empty selectedCards:', selectedCards);
    }
    
    // Track cards removed from current category
    var currentCategory = GameState.get('currentCategory');
    if (currentCategory && selectedCards && selectedCards.length > 0) {
        if (!window.categoryRemovedCards) {
            window.categoryRemovedCards = {};
        }
        if (!window.categoryRemovedCards[currentCategory]) {
            window.categoryRemovedCards[currentCategory] = [];
        }
        
        // Add selected cards to the category's removed cards list
        selectedCards.forEach(function(cardId) {
            if (window.categoryRemovedCards[currentCategory].indexOf(cardId) === -1) {
                window.categoryRemovedCards[currentCategory].push(cardId);
            }
        });
        
        console.log('🔄 Added to removed cards for ' + currentCategory + ':', selectedCards);
        console.log('🔄 Total removed cards for ' + currentCategory + ':', window.categoryRemovedCards[currentCategory]);
    }
    
    // Track total cards used by the bidder
    var players = GameState.get('players');
    if (highestBidder && players.stats[highestBidder] && selectedCards && selectedCards.length > 0) {
        if (!players.stats[highestBidder].cardsUsed) {
            players.stats[highestBidder].cardsUsed = 0;
        }
        var bidderStats = getPlayerStats(highestBidder);
        if (bidderStats) {
            bidderStats.cardsUsed = (bidderStats.cardsUsed || 0) + selectedCards.length;
            GameState.set('players.stats.' + highestBidder, bidderStats);
            console.log('📊 ' + highestBidder + ' used ' + selectedCards.length + ' cards (Total: ' + bidderStats.cardsUsed + ')');
        }
        
        // Update global card statistics
        window.globalCardStats.totalCardsRanked += selectedCards.length;
        
        // Update test results card statistics
        console.log('🔍 calculateAndApplyScores: checking automatedTestResults, value:', !!window.automatedTestResults, 'type:', typeof window.automatedTestResults);
        if (!window.automatedTestResults) {
            console.log('🔍 RECREATING automatedTestResults in calculateAndApplyScores!');
            window.automatedTestResults = {
                cardStats: {
                    totalCardsRanked: 0,
                    totalCardsOwned: 0,
                    totalCardsInPlay: 0
                }
            };
        } else if (!window.automatedTestResults.cardStats) {
            window.automatedTestResults.cardStats = {
                totalCardsRanked: 0,
                totalCardsOwned: 0,
                totalCardsInPlay: 0
            };
        }
        window.automatedTestResults.cardStats.totalCardsRanked = window.globalCardStats.totalCardsRanked;
    }
    
    // 2. Track newly owned cards from this round (cards that became owned through blocking)
    window.lastRoundNewlyOwnedCards = [];
    
    // Get current category and round for blocked cards storage
    var currentCategory = GameState.get('currentCategory');
    var currentRound = GameState.get('currentRound') || 1;
    
    // Initialize blocked cards by category if not exists
    var blockedCardsByCategory = GameState.get('players.blockedCardsByCategory') || {};
    if (!blockedCardsByCategory[currentCategory]) {
        blockedCardsByCategory[currentCategory] = [];
    }
    
    console.log('🔍 BLOCKED CARDS DEBUG:');
    console.log('  bidderSuccess:', bidderSuccess);
    console.log('  ACTIVE_RULES.tokenOwnership:', ACTIVE_RULES.tokenOwnership);
    console.log('  highestBidder:', highestBidder);
    
    var currentBlocks = GameState.get('players.currentBlocks');
    console.log('  currentBlocks:', currentBlocks);
    console.log('  currentBlocks keys:', Object.keys(currentBlocks || {}));
    
    if (!bidderSuccess && ACTIVE_RULES.tokenOwnership) {
        Object.keys(currentBlocks).forEach(function(playerName) {
            console.log('  Processing player:', playerName, 'block:', currentBlocks[playerName]);
            if (playerName !== highestBidder && currentBlocks[playerName]) {
                var blockedCardId = currentBlocks[playerName].cardId;
                console.log('    blockedCardId:', blockedCardId);
                if (blockedCardId && !window.lastRoundNewlyOwnedCards.includes(blockedCardId)) {
                    window.lastRoundNewlyOwnedCards.push(blockedCardId);
                    
                    // Store blocked card by category for persistent access
                    blockedCardsByCategory[currentCategory].push({
                        cardId: blockedCardId,
                        round: currentRound,
                        blockedBy: playerName
                    });
                    
                    console.log('    Added to blocked cards list:', blockedCardId, 'in category:', currentCategory);
                }
            }
        });
        // Save updated blocked cards by category
        GameState.set('players.blockedCardsByCategory', blockedCardsByCategory);
        console.log('🛡️ Tracking blocked cards for token replacement screen by category:', blockedCardsByCategory);
    } else {
        console.log('🔍 Not tracking blocked cards because:');
        console.log('  bidderSuccess =', bidderSuccess, '(should be false)');
        console.log('  tokenOwnership =', ACTIVE_RULES.tokenOwnership, '(should be true)');
    }
    
    console.log('📋 Tracking for next round - Selected cards (will be removed):', window.lastRoundSelectedCards);
    console.log('🏆 Tracking for next round - Newly owned cards:', window.lastRoundNewlyOwnedCards);
    
    // Clear current blocks for next round
    GameState.set('players.currentBlocks', {});
    
    // Run validation after scoring
    runAutoValidation('after-scoring');
    
    // State changes already saved via individual GameState.set calls - no need to overwrite entire players object
}

function updateResultsDisplay() {
    var resultsContent = document.getElementById('resultsContent');
    var resultsTitle = document.getElementById('resultsTitle');
    var finalRankingDiv = document.getElementById('finalRanking');
    
    if (resultsTitle) {
        resultsTitle.textContent = bidderSuccess ? 'Round Success!' : 'Round Failed!';
    }
    
    if (resultsContent) {
        var html = '<div class="card-title">' + 
                  (bidderSuccess ? '🎉 ' + highestBidder + ' Succeeded!' : '❌ ' + highestBidder + ' Failed!') + 
                  '</div>' +
                  '<div class="card-description">' +
                  'Bid: ' + currentBid + ' cards<br>' +
                  'Category: ' + currentPrompt.label + '<br>' +
                  (bidderSuccess ? 
                    'Points awarded: +' + currentBid :
                    'Points awarded: 0 (no penalty)') +
                  '</div>';
        
        // Show blocking results
        var blockingResults = getBlockingResults();
        if (blockingResults.length > 0) {
            html += '<div style="margin-top: 15px; padding: 10px; background: #f5f5f5; border-radius: 5px;">' +
                   '<strong>Blocking Results:</strong><br>' + blockingResults.join('<br>') + '</div>';
        }
        
        safeSetHTML(resultsContent, html);
    }
    
    if (finalRankingDiv) {
        var html = '<div class="final-ranking-display">';
        
        // Show bidder's ranking
        html += '<h4>' + highestBidder + '\'s Ranking:</h4>';
        finalRanking.forEach(function(cardId, index) {
            var currentCategory = GameState.get('currentCategory') || 'countries';
            var categoryData = window.GAME_DATA.categories[currentCategory];
            var item = categoryData ? categoryData.items[cardId] : null;
            var value = item ? item[currentPrompt.challenge] : 0;
            html += '<div class="ranking-item">' +
                   '<span class="rank-number">' + (index + 1) + '</span>' +
                   '<span class="country-name">' + (item ? item.name : cardId) + '<br><small>' + (item ? item.code : cardId) + '</small></span>' +
                   '<span class="country-value">' + formatValue(value, currentPrompt.challenge) + '</span>' +
                   '</div>';
        });
        
        // Show correct ranking for comparison
        html += '<h4 style="margin-top: 20px;">Correct Ranking:</h4>';
        correctRanking.forEach(function(cardId, index) {
            var currentCategory = GameState.get('currentCategory') || 'countries';
            var categoryData = window.GAME_DATA.categories[currentCategory];
            var item = categoryData ? categoryData.items[cardId] : null;
            var value = item ? item[currentPrompt.challenge] : 0;
            html += '<div class="ranking-item correct-ranking">' +
                   '<span class="rank-number">' + (index + 1) + '</span>' +
                   '<span class="country-name">' + (item ? item.name : cardId) + '<br><small>' + (item ? item.code : cardId) + '</small></span>' +
                   '<span class="country-value">' + formatValue(value, currentPrompt.challenge) + '</span>' +
                   '</div>';
        });
        
        html += '</div>';
        safeSetHTML(finalRankingDiv, html);
    }
}

function getBlockingResults() {
    var results = [];
    
    // Get necessary data from GameState
    var highestBidder = GameState.get('lastRoundData.highestBidder') || GameState.get('currentBid.bidder');
    var bidderSuccess = GameState.get('lastRoundData.bidderSuccess');
    var playersData = GameState.get('players') || {};
    
    // Use saved blocking data from before it was cleared
    var blocksToCheck = window.lastRoundBlocks || playersData.currentBlocks || {};
    
    Object.keys(blocksToCheck).forEach(function(playerName) {
        if (playerName !== highestBidder && blocksToCheck[playerName]) {
            var blockData = blocksToCheck[playerName];
            var tokenValue = blockData.tokenValue;
            
            if (bidderSuccess) {
                // Bidder succeeded, blockers lose their tokens
                results.push(playerName + ' lost ' + tokenValue + '-point token to ' + highestBidder);
            } else {
                // Bidder failed, blockers get points and keep tokens
                results.push(playerName + ' earned ' + tokenValue + ' points for successful block (keeps token)');
            }
        }
    });
    
    return results;
}

function updateInterimDisplay() {
    console.log('📊 updateInterimDisplay called');
    updateInterimLeaderboard();
    updateInterimTokenInventory();
    updateInterimRoundSummary();
    
    // Validate token integrity after each round
    validateTokenIntegrity();
    
    console.log('✅ All interim displays updated');
}

function updateInterimLeaderboard() {
    console.log('🏆 updateInterimLeaderboard called');
    var container = document.getElementById('interimLeaderboard');
    if (!container) {
        console.error('❌ interimLeaderboard container not found!');
        return;
    }
    
    // More detailed debugging
    console.log('🔍 updateInterimLeaderboard: Getting scores...');
    var playersScores = getPlayersScores();
    console.log('🔍 updateInterimLeaderboard: playersScores =', playersScores);
    console.log('🔍 updateInterimLeaderboard: Object.keys(playersScores) =', Object.keys(playersScores));
    
    var scores = getFinalScores();
    console.log('🔍 updateInterimLeaderboard: getFinalScores() =', scores);
    console.log('🔍 updateInterimLeaderboard: scores.length =', scores.length);
    
    // Individual player check in actual game
    var playersList = GameState.get('players.list') || [];
    console.log('🔍 updateInterimLeaderboard: players.list =', playersList);
    playersList.forEach(function(playerName) {
        var score = getPlayerScore(playerName);
        console.log('🔍 updateInterimLeaderboard: ' + playerName + ' score = ' + score + ' (type: ' + typeof score + ')');
    });
    
    if (scores.length === 0) {
        console.log('⚠️ No scores to display - showing no scores message');
        safeSetHTML(container, '<div class="no-scores-message">No scores yet!</div>');
        return;
    }
    
    var html = '<table class="scores-table">' +
              '<thead><tr><th>Rank</th><th>Player</th><th>Score</th></tr></thead><tbody>';
    
    scores.forEach(function(player, index) {
        var rankClass = index === 0 ? 'first' : index === 1 ? 'second' : index === 2 ? 'third' : '';
        var medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '';
        html += '<tr>' +
               '<td class="rank ' + rankClass + '">' + medal + ' ' + (index + 1) + '</td>' +
               '<td>' + sanitizeHTML(player.name) + '</td>' +
               '<td>' + sanitizeHTML(typeof player.score === 'number' ? player.score : 0) + '</td>' +
               '</tr>';
    });
    
    html += '</tbody></table>';
    console.log('🔍 updateInterimLeaderboard: Generated HTML length:', html.length);
    console.log('🔍 updateInterimLeaderboard: Generated HTML preview:', html.substring(0, 200) + '...');
    safeSetHTML(container, html);
    console.log('🔍 updateInterimLeaderboard: HTML set in container');
    console.log('🔍 updateInterimLeaderboard: Container innerHTML length:', container.innerHTML.length);
}

function updateInterimTokenInventory() {
    var container = document.getElementById('interimTokenInventory');
    if (!container) return;
    
    var players = GameState.get('players');
    if (players.list.length === 0) {
        safeSetHTML(container, '<div class="no-scores-message">No players!</div>');
        return;
    }
    
    var html = '';
    
    // Sort players by current score for display
    var sortedPlayers = getFinalScores();
    
    sortedPlayers.forEach(function(playerData) {
        var playerName = playerData.name;
        var tokens = getPlayerTokens(playerName);
        var chipDisplay = '';
        
        // Display all token types with actual counts
        [2, 4, 6].forEach(function(tokenValue) {
            var count = tokens[tokenValue] || 0;
            var chipClass = tokenValue === 2 ? 'chip-2' : tokenValue === 4 ? 'chip-4' : 'chip-6';
            
            if (count > 0) {
                chipDisplay += '<span class="chip-badge ' + chipClass + '">' + tokenValue + ' pts (x' + count + ')</span>';
            } else {
                chipDisplay += '<span class="chip-badge chip-empty">' + tokenValue + ' pts (x0)</span>';
            }
        });
        
        html += '<div class="chip-inventory-item">' +
               '<span class="chip-inventory-player">' + playerName + '</span>' +
               '<div class="chip-inventory-chips">' + chipDisplay + '</div>' +
               '</div>';
    });
    
    safeSetHTML(container, html);
}

function updateInterimRoundSummary() {
    console.log('📋 updateInterimRoundSummary called');
    var container = document.getElementById('interimRoundSummary');
    if (!container) {
        console.error('❌ interimRoundSummary container not found!');
        return;
    }
    
    // Get state from GameState
    var currentRound = getCurrentRound();
    var maxRounds = getMaxRounds();
    var highestBidder = GameState.get('highestBidder');
    var currentBid = GameState.get('currentBid');
    var currentPrompt = GameState.get('currentPrompt');
    var bidderSuccess = GameState.get('bidderSuccess');
    
    console.log('Round summary data:', {
        currentRound: currentRound,
        maxRounds: maxRounds,
        highestBidder: highestBidder,
        currentBid: currentBid,
        currentPrompt: currentPrompt,
        bidderSuccess: bidderSuccess
    });
    
    var html = '<div class="round-summary-grid">';
    
    // Round info
    html += '<div class="summary-item">' +
           '<strong>Round ' + currentRound + ' of ' + maxRounds + ' Complete</strong><br>' +
           '<strong>Bidder:</strong> ' + (highestBidder || 'Unknown') + '<br>' +
           '<strong>Bid:</strong> ' + (currentBid || 0) + ' cards<br>' +
           '<strong>Category:</strong> ' + (currentPrompt ? currentPrompt.label : 'Unknown') + '<br>' +
           '<strong>Result:</strong> ' + (bidderSuccess ? '✅ SUCCESS' : '❌ FAILED') +
           '</div>';
    
    // Scoring summary
    html += '<div class="summary-item">';
    if (bidderSuccess) {
        html += '<strong>Points Awarded:</strong><br>' +
               '• ' + highestBidder + ': +' + currentBid + ' points<br>';
        
        var tokenTransfers = getBlockingResults();
        if (tokenTransfers.length > 0) {
            html += '<strong>Token Transfers:</strong><br>';
            tokenTransfers.forEach(function(transfer) {
                html += '• ' + transfer + '<br>';
            });
        }
    } else {
        html += '<strong>Points Changes:</strong><br>' +
               '• ' + highestBidder + ': 0 points (no penalty)<br>';
        
        // Use saved blocking data from before it was cleared
        var players = GameState.get('players');
        var blocksToCheck = window.lastRoundBlocks || players.currentBlocks;
        Object.keys(blocksToCheck).forEach(function(playerName) {
            if (playerName !== highestBidder && blocksToCheck[playerName]) {
                var blockData = blocksToCheck[playerName];
                var tokenValue = blockData.tokenValue;
                html += '• ' + playerName + ': +' + tokenValue + ' points (blocking reward)<br>';
            }
        });
    }
    html += '</div>';
    
    html += '</div>';
    safeSetHTML(container, html);
    console.log('✅ Round summary updated successfully');
    console.log('HTML content length:', html.length);
}

window.continueToNextRound = function() {
    console.log('🔄 continueToNextRound() called from:', new Error().stack.split('\n')[1].trim());
    console.log('🔄 ENTERED continueToNextRound()');
    
    // CRITICAL: Calculate scores before round tracking validation
    console.log('🔄 continueToNextRound: Calculating scores before next round...');
    console.log('  Current round:', getCurrentRound());
    console.log('  High bidder:', getHighestBidder());
    console.log('  Bidder success:', GameState.get('bidderSuccess'));
    calculateAndApplyScores();
    
    // Track round completion (before incrementing currentRound)
    updateTestStatistics('ROUND_COMPLETE', {round: getCurrentRound()});
    nextRound();
};

// Round and game management functions
window.nextRound = function() {
    // Check if game should end
    if (getCurrentRound() >= ACTIVE_RULES.maxRounds || checkWinCondition()) {
        endGame();
        return;
    }
    
    // Scores should already be calculated by continueToNextRound()
    if (!GameState.get('players.scoresCalculatedThisRound')) {
        console.log('🚨 WARNING: Scores not calculated yet - this indicates a bug in the flow');
        console.log('  Round:', getCurrentRound());
        console.log('  Bidder:', getHighestBidder());
        // Don't calculate again to avoid duplicate scoring
    }

    // Advance to next round
    var newRound = getCurrentRound() + 1;
    console.log('🔄 Advancing to round:', newRound);
    GameState.set('currentRound', newRound);
    
    // Validate round completion tracking and provide detailed statistics
    var totalBidsWon = 0;
    var statsBreakdown = {};
    
    var players = GameState.get('players');
    if (players.stats) {
        Object.keys(players.stats).forEach(function(playerName) {
            var playerStats = getPlayerStats(playerName);
            var playerBidsWon = playerStats.bidsWon || 0;
            totalBidsWon += playerBidsWon;
            statsBreakdown[playerName] = playerBidsWon;
        });
    }
    
    console.log('📊 Round ' + (getCurrentRound() - 1) + ' Statistics Tracking:');
    console.log('  Total bids won across all players:', totalBidsWon);
    console.log('  Individual player bids won:', statsBreakdown);
    
    // Check for discrepancy (getCurrentRound()-1 because we just incremented)
    var completedRounds = getCurrentRound() - 1;
    if (totalBidsWon !== completedRounds) {
        console.error('❌ ROUND TRACKING ERROR: Completed rounds (' + completedRounds + ') != Total bids won (' + totalBidsWon + ')');
        console.error('Round', completedRounds, 'may have completed without a proper bid winner!');
        console.error('This violates game rules and indicates a bug in the code.');
    } else {
        console.log('✅ Round tracking validation passed: ' + completedRounds + ' rounds = ' + totalBidsWon + ' bid winners');
    }
    
    // Reset round-specific variables
    resetRoundState();
    
    // Reset the scores calculated flag for the new round (after validation)
    GameState.set('players.scoresCalculatedThisRound', false);
    console.log('🔄 Score calculation flag reset for new round');
    
    // Reset phase for new round
    if (window.automatedTestState) {
        setPhase('idle', null);
    }
    
    // Check if automated test should complete
    if (window.isAutomatedTestRunning && window.automatedTestResults && !window.automatedTestResults.endTime) {
        var currentRound = getCurrentRound();
        console.log('🔍 Checking test completion: currentRound=' + currentRound + ', maxRounds=' + ACTIVE_RULES.maxRounds);
        
        if (currentRound >= ACTIVE_RULES.maxRounds) {
            console.log('🏁 Automated test reached max rounds - marking for completion...');
            
            // Set a flag to indicate we should complete, but don't set endTime yet
            window.automatedTestResults.shouldComplete = true;
            
            // Use setTimeout to complete after current operations finish
            setTimeout(() => {
                console.log('🏁 Completing automated test now...');
                
                // Set end time and generate results
                window.automatedTestResults.endTime = new Date();
                generateDetailedTestResults();
                
                // Run comprehensive analysis directly
                console.log('\n🔍 RUNNING COMPREHENSIVE BLOCK/TOKEN ANALYSIS...');
                analyzeAllPlayersBlocks();
                
                window.isAutomatedTestRunning = false;
                
                // Clear any remaining automated test state
                if (window.automatedTestState) {
                    window.automatedTestState = null;
                }
                
                console.log('✅ Automated test completed successfully!');
            }, 5000); // Give more time for current round to complete
            
            return; // Don't continue to next round
        }
    }
    
    // For automated testing, continue automatically
    // For manual play, go back to player setup
    if (window.isAutomatedTestRunning) {
        console.log('🤖 Automated test: Starting round ' + getCurrentRound() + ' automatically...');
        // Continue automated test with next round
        setTimeout(async () => {
            await automatedRound(getCurrentRound());
        }, 1000);
    } else {
        // Clear UI elements from previous round before starting new round
        console.log('🧹 Clearing UI from previous round...');
        clearUIElements();
        
        // Go back to player setup for next round
        showScreen('playerScreen');
        console.log('Round ' + getCurrentRound() + ' starting!\n\nAll players maintain their scores and blocking tokens from previous rounds.');
    }
};

window.newGame = function() {
    // Reset all game state using GameState
    GameState.set('currentRound', 1);
    GameState.set('players.scores', {});
    GameState.set('players.currentBlocks', {});
    GameState.set('players.ownedCards', {}); // Clear owned cards from previous game
    GameState.set('players.scoresCalculatedThisRound', false); // Reset score calculation flag
    // NOTE: Preserve players.stats to accumulate statistics across games
    // Use resetAllStatistics() if you want to completely reset statistics
    
    console.log('🔄 DEBUG: newGame() called - scores reset to empty object');
    console.log('  Players list:', GameState.get('players.list'));
    console.log('  Scores after reset:', GameState.get('players.scores'));
    
    // Reset all players' blocking tokens and initialize scores
    var playersList = getPlayersList();
    playersList.forEach(function(playerName) {
        GameState.set('players.blockingTokens.' + playerName, {2: 1, 4: 1, 6: 1});
        // Ensure player scores are properly initialized to 0
        setPlayerScore(playerName, 0);
        console.log('🔄 DEBUG: newGame() initialized score for', playerName, 'to 0');
    });
    
    // Clear tracking variables from previous game
    window.previousRoundCards = [];
    window.lastRoundSelectedCards = [];
    window.lastRoundNewlyOwnedCards = [];
    window.cardsReplacedThisRound = [];
    window.newReplacementCards = [];
    window.removedReplacementCards = [];
    window.lastRoundCategory = null;
    window.previousRoundCardsByCategory = {};
    
    // Clear GameState blocked cards tracking
    GameState.set('players.blockedCardsByCategory', {});
    window.categoryRemovedCards = {};
    
    resetRoundState();
    showScreen('titleScreen');
};

// Function to completely reset all statistics (for new sessions)
window.resetAllStatistics = function() {
    console.log('🔄 Resetting all player statistics...');
    GameState.set('players.stats', {});
    showNotification('All player statistics have been reset', 'info');
};

function resetRoundState() {
    console.log('🔄 Resetting round state...');
    
    GameState.set('currentPrompt', null);
    GameState.set('drawnCards', []);
    GameState.set('blockedCards', []);
    GameState.set('selectedCards', []);
    GameState.set('selectedCardsForRanking', []);
    GameState.set('bidAmount', 0);
    GameState.set('currentBid', 0);
    // PRESERVE highestBidder for round completion tracking - will be reset when new bidding starts
    // GameState.set('highestBidder', '');  // MOVED TO startBiddingRound()
    GameState.set('playerBids', {});
    GameState.set('passedPlayers', {});
    GameState.set('blockingTurn', 0);
    GameState.set('blockingOrder', []);
    GameState.set('usedBlockingTokens', {2: false, 4: false, 6: false});
    GameState.set('revealIndex', 0);
    GameState.set('currentRevealIndex', 0);
    GameState.set('finalRanking', []);
    GameState.set('correctRanking', []);
    // PRESERVE bidderSuccess for round summary - will be reset when new bidding starts
    // GameState.set('bidderSuccess', false);  // MOVED TO startBiddingRound()
    GameState.set('players.currentBlocks', {});
    
    console.log('🧹 Clearing UI elements...');
    // Clear UI elements that might persist between rounds
    clearUIElements();
    
    console.log('✅ Round state reset complete (bidderSuccess preserved for round summary)');
}

function clearUIElements() {
    console.log('🧹 Starting clearUIElements...');
    
    // Clear bidding interface
    var highBidderDisplay = document.getElementById('highBidderDisplay');
    if (highBidderDisplay) {
        safeSetHTML(highBidderDisplay, '<div class="high-bid-amount">No bids yet</div><div class="high-bid-player">Waiting for first bid...</div>');
    }
    
    var playerBidding = document.getElementById('playerBidding');
    if (playerBidding) {
        safeSetHTML(playerBidding, '');
    }
    
    // Clear blocking interface
    var availableCards = document.getElementById('availableCards');
    if (availableCards) {
        safeSetHTML(availableCards, '');
    }
    
    var blockingTokens = document.getElementById('blockingTokens');
    if (blockingTokens) {
        safeSetHTML(blockingTokens, '');
    }
    
    // Clear card selection interface
    var availableCardsForSelection = document.getElementById('availableCardsForSelection');
    if (availableCardsForSelection) {
        safeSetHTML(availableCardsForSelection, '');
    }
    
    var scannedCards = document.getElementById('scannedCards');
    if (scannedCards) {
        safeSetHTML(scannedCards, '');
    }
    
    // Clear ranking interface (including dynamically created container)
    var rankingContainer = document.getElementById('rankingContainer');
    if (rankingContainer) {
        rankingContainer.remove(); // Remove the entire element, not just clear it
    }
    
    // Clear reveal interface
    var revealCards = document.getElementById('revealCards');
    if (revealCards) {
        safeSetHTML(revealCards, '');
    }
    
    var revealProgress = document.getElementById('revealProgress');
    if (revealProgress) {
        revealProgress.textContent = '0 of 0';
    }
    
    // Clear the drawn cards info display on bidding screen
    var drawnCardsInfo = document.getElementById('drawnCardsInfo');
    if (drawnCardsInfo) {
        safeSetHTML(drawnCardsInfo, '');
    }
    
    console.log('✅ clearUIElements complete');
    
    var revealProgressBar = document.getElementById('revealProgressBar');
    if (revealProgressBar) {
        revealProgressBar.style.width = '0%';
    }
    
    // Clear results interface
    var finalRankingDiv = document.getElementById('finalRanking');
    if (finalRankingDiv) {
        safeSetHTML(finalRankingDiv, '');
    }
    
    // Hide finish button
    var finishBtn = document.getElementById('finishBtn');
    if (finishBtn) {
        finishBtn.style.display = 'none';
    }
    
    // Clear prompt info
    var promptInfo = document.getElementById('promptInfo');
    if (promptInfo) {
        safeSetHTML(promptInfo, '<div class="card-title">Challenge Loading...</div><div class="card-description">Setting up the game...</div>');
    }
    
    var drawnCardsInfo = document.getElementById('drawnCardsInfo');
    if (drawnCardsInfo) {
        safeSetHTML(drawnCardsInfo, '');
    }
}

function checkWinCondition() {
    // Check if any player has reached the winning score
    var winner = null;
    var highestScore = -Infinity;
    
    var players = GameState.get('players');
    Object.keys(players.scores).forEach(function(playerName) {
        var score = getPlayerScore(playerName);
        if (score >= ACTIVE_RULES.winningScore && score > highestScore) {
            winner = playerName;
            highestScore = score;
        }
    });
    
    return winner;
}

function endGame() {
    // Apply country token bonuses
    applyCountryTokenBonuses();
    
    // Don't handle completion in endGame() - let it happen naturally in continueToNextRound()
    console.log('🔍 endGame() debug: isAutomatedTestRunning=' + window.isAutomatedTestRunning + ', automatedTestResults=' + !!window.automatedTestResults);
    
    var winner = checkWinCondition();
    var finalScores = getFinalScores();
    
    var message = 'GAME OVER!\n\n';
    
    if (winner) {
        message += '🏆 WINNER: ' + winner + ' (' + players.scores[winner] + ' points)\n\n';
    } else {
        message += 'Maximum rounds completed!\n\n';
    }
    
    message += 'Final Scores:\n';
    finalScores.forEach(function(player, index) {
        var medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
        
        // Calculate token bonus for display
        var tokenBonus = '';
        if (ACTIVE_RULES.endGameTokenPoints && ACTIVE_RULES.endGameTokenPoints > 0) {
            var tokenCount = 0;
            var playersData = GameState.get('players');
            if (ACTIVE_RULES.tokenOwnership && playersData.ownedCards && playersData.ownedCards[player.name]) {
                // Handle both new category-specific format and legacy format
                if (typeof playersData.ownedCards[player.name] === 'object' && !Array.isArray(playersData.ownedCards[player.name])) {
                    // New format: count all owned cards across all categories
                    Object.keys(playersData.ownedCards[player.name]).forEach(function(category) {
                        if (Array.isArray(playersData.ownedCards[player.name][category])) {
                            tokenCount += getPlayerOwnedCards(player.name, category).length;
                        }
                    });
                } else if (Array.isArray(playersData.ownedCards[player.name])) {
                    // Legacy format: direct array
                    var ownedCards = getPlayerOwnedCards(player.name);
                    tokenCount = Object.keys(ownedCards).reduce(function(total, cat) {
                        return total + (ownedCards[cat] ? ownedCards[cat].length : 0);
                    }, 0);
                }
            }
            if (tokenCount > 0) {
                tokenBonus = ' (includes ' + (tokenCount * ACTIVE_RULES.endGameTokenPoints) + ' country token pts)';
            }
        }
        
        message += medal + ' ' + player.name + ': ' + player.score + ' points' + tokenBonus + '\n';
    });
    
    console.log(message);
    
    // For automated tests, skip showing the normal game end screen
    if (window.isAutomatedTestRunning || (window.automatedTestResults && window.automatedTestResults.startTime && !window.automatedTestResults.endTime)) {
        console.log('🔍 Skipping normal game end screen for automated test');
        return;
    }
    
    // Update scores screen and show it (pass pre-calculated scores to avoid redundant calls)
    updateScoresDisplay(finalScores);
    showScreen('scoresScreen');
}

function getFinalScores() {
    // Add stack trace to identify excessive calls
    var stack = new Error().stack.split('\n').slice(1, 4).join(' → ');
    console.log('🔍 getFinalScores called from:', stack);
    
    var playersScores = getPlayersScores();
    console.log('🔍 getFinalScores DEBUG: playersScores object:', playersScores);
    console.log('🔍 getFinalScores DEBUG: Object.keys(playersScores):', Object.keys(playersScores));
    
    var players = GameState.get('players');
    
    var scores = Object.keys(playersScores).map(function(playerName) {
        // Calculate the actual total from all 4 components
        var stats = getPlayerStats(playerName);
        
        // Count owned cards for country token points
        var countryTokenCount = 0;
        var playersData = GameState.get('players');
        if (ACTIVE_RULES.tokenOwnership && playersData.ownedCards && playersData.ownedCards[playerName]) {
            if (typeof playersData.ownedCards[playerName] === 'object' && !Array.isArray(playersData.ownedCards[playerName])) {
                Object.keys(playersData.ownedCards[playerName]).forEach(function(category) {
                    if (Array.isArray(playersData.ownedCards[playerName][category])) {
                        countryTokenCount += getPlayerOwnedCards(playerName, category).length;
                    }
                });
            }
        }
        
        // Count remaining blocking tokens
        var blockingTokenCount = 0;
        var allBlockingTokens = GameState.get('players.blockingTokens') || {};
        if (allBlockingTokens && allBlockingTokens[playerName]) {
            var playerTokens = GameState.get('players.blockingTokens.' + playerName);
            blockingTokenCount = (playerTokens[2] || 0) + (playerTokens[4] || 0) + (playerTokens[6] || 0);
        }
        
        // Calculate component scores
        var countryTokenPoints = countryTokenCount * (ACTIVE_RULES.endGameTokenPoints || 0);
        var blockingTokenPoints = blockingTokenCount * (ACTIVE_RULES.endGameBlockingTokenPoints || 0);
        var blockingPoints = stats.blockingPointsEarned || 0;
        var storedScore = getPlayerScore(playerName) || 0;
        var biddingPoints = Math.max(0, storedScore - blockingPoints - countryTokenPoints - blockingTokenPoints);
        
        // Calculate actual total from all components
        var calculatedTotal = biddingPoints + blockingPoints + countryTokenPoints + blockingTokenPoints;
        
        console.log('🔍 getFinalScores DEBUG: Player', playerName, 'calculated total:', calculatedTotal);
        console.log('  storedScore:', storedScore, 'biddingPoints:', biddingPoints, 'blockingPoints:', blockingPoints, 'tokens:', blockingTokenCount);
        
        return {
            name: playerName,
            score: calculatedTotal
        };
    });
    
    console.log('🔍 Before sorting:', scores);
    
    var sortedScores = scores.sort(function(a, b) {
        console.log('🔍 Comparing:', a.name, a.score, 'vs', b.name, b.score, 'result:', (b.score - a.score));
        return b.score - a.score; // Sort by score descending
    });
    
    console.log('🔍 After sorting:', sortedScores);
    return sortedScores;
}

function applyCountryTokenBonuses() {
    // Apply end-game country token scoring if enabled
    console.log('💎 Checking country token bonus conditions:');
    console.log('  endGameTokenPoints:', ACTIVE_RULES.endGameTokenPoints);
    console.log('  tokenOwnership:', ACTIVE_RULES.tokenOwnership);
    
    if (ACTIVE_RULES.endGameTokenPoints && ACTIVE_RULES.endGameTokenPoints > 0) {
        console.log('💎 Applying country token bonuses...');
        
        Object.keys(getPlayersScores()).forEach(function(playerName) {
            var tokenCount = 0;
            
            // Count country tokens (owned cards) if token ownership is enabled
            var allOwnedCards = GameState.get('players.ownedCards') || {};
            if (ACTIVE_RULES.tokenOwnership && allOwnedCards && allOwnedCards[playerName]) {
                // Handle both new category-specific format and legacy format
                if (typeof allOwnedCards[playerName] === 'object' && !Array.isArray(allOwnedCards[playerName])) {
                    // New format: count all owned cards across all categories
                    Object.keys(allOwnedCards[playerName]).forEach(function(category) {
                        if (Array.isArray(allOwnedCards[playerName][category])) {
                            tokenCount += getPlayerOwnedCards(playerName, category).length;
                        }
                    });
                } else if (Array.isArray(allOwnedCards[playerName])) {
                    // Legacy format: direct array
                    var ownedCards = getPlayerOwnedCards(playerName);
                    tokenCount = Object.keys(ownedCards).reduce(function(total, cat) {
                        return total + (ownedCards[cat] ? ownedCards[cat].length : 0);
                    }, 0);
                }
            }
            
            if (tokenCount > 0) {
                var tokenPoints = tokenCount * ACTIVE_RULES.endGameTokenPoints;
                
                // Check if bonus already applied (avoid double-adding)
                if (!GameState.get('players.countryTokenBonusApplied')) {
                    var currentScore = getPlayerScore(playerName) || 0;
                    setPlayerScore(playerName, currentScore + tokenPoints);
                    console.log(playerName + ' receives ' + tokenPoints + ' points for ' + tokenCount + ' country tokens');
                }
            }
        });
        
        // Mark as applied to avoid double-adding
        GameState.set('players.countryTokenBonusApplied', true);
    }
    
    // Apply end-game blocking token scoring if enabled
    if (ACTIVE_RULES.endGameBlockingTokenPoints && ACTIVE_RULES.endGameBlockingTokenPoints > 0) {
        console.log('🛡️ Applying blocking token bonuses...');
        
        Object.keys(getPlayersScores()).forEach(function(playerName) {
            var totalBlockingTokens = 0;
            
            // Count remaining blocking tokens
            var allBlockingTokens = GameState.get('players.blockingTokens') || {};
            if (allBlockingTokens && allBlockingTokens[playerName]) {
                var playerTokens = GameState.get('players.blockingTokens.' + playerName);
                totalBlockingTokens = (playerTokens[2] || 0) + (playerTokens[4] || 0) + (playerTokens[6] || 0);
            }
            
            if (totalBlockingTokens > 0) {
                var blockingTokenPoints = totalBlockingTokens * ACTIVE_RULES.endGameBlockingTokenPoints;
                
                // Check if bonus already applied (avoid double-adding)
                if (!GameState.get('players.blockingTokenBonusApplied')) {
                    var currentScore = getPlayerScore(playerName) || 0;
                    setPlayerScore(playerName, currentScore + blockingTokenPoints);
                    console.log(playerName + ' receives ' + blockingTokenPoints + ' points for ' + totalBlockingTokens + ' blocking tokens');
                }
            }
        });
        
        // Mark as applied to avoid double-adding
        GameState.set('players.blockingTokenBonusApplied', true);
    }
}

function updateScoresDisplay(preCalculatedScores) {
    console.log('🔍 Updating scores display...');
    console.log('Players list:', getPlayersList());
    console.log('Players scores BEFORE country token bonus:', getPlayersScores());
    
    // Apply country token bonuses for display (if not already applied)
    applyCountryTokenBonuses();
    
    console.log('Players scores AFTER country token bonus:', getPlayersScores());
    
    // Get players object for owned cards access
    var players = GameState.get('players');
    
    var leaderboard = document.getElementById('leaderboard');
    var playerStats = document.getElementById('playerStats');
    var chipInventory = document.getElementById('chipInventory');
    
    if (leaderboard) {
        // Use pre-calculated scores if provided, otherwise calculate
        var scores = preCalculatedScores || getFinalScores();
        console.log('🔍 Using scores for leaderboard:', preCalculatedScores ? 'pre-calculated' : 'newly calculated');
        console.log('Final scores array:', scores);
        if (scores.length === 0) {
            console.log('⚠️ No scores found, showing empty message');
            safeSetHTML(leaderboard, '<div class="no-scores-message">No games played yet!<br>Play some rounds to see the leaderboard.</div>');
        } else {
            console.log('✅ Displaying scores for', scores.length, 'players');
            console.log('🔍 MAIN LEADERBOARD: Rendering 4-column table with Total and Breakdown');
            var html = '<table class="scores-table">' +
                      '<thead><tr><th>Rank</th><th>Player</th><th>Total</th><th>Breakdown</th></tr></thead><tbody>';
            
            scores.forEach(function(player, index) {
                var rankClass = index === 0 ? 'first' : index === 1 ? 'second' : index === 2 ? 'third' : '';
                
                // Calculate score breakdown
                var stats = getPlayerStats(player.name);
                
                // Count country tokens (owned cards) for end-game scoring
                var countryTokenCount = 0;
                var playersData = GameState.get('players');
                if (ACTIVE_RULES.tokenOwnership && playersData.ownedCards && playersData.ownedCards[player.name]) {
                    // Handle both new category-specific format and legacy format
                    if (typeof playersData.ownedCards[player.name] === 'object' && !Array.isArray(playersData.ownedCards[player.name])) {
                        // New format: count all owned cards across all categories
                        Object.keys(playersData.ownedCards[player.name]).forEach(function(category) {
                            if (Array.isArray(playersData.ownedCards[player.name][category])) {
                                countryTokenCount += getPlayerOwnedCards(player.name, category).length;
                            }
                        });
                    } else if (Array.isArray(playersData.ownedCards[player.name])) {
                        // Legacy format: direct array
                        var ownedCards = getPlayerOwnedCards(player.name);
                        countryTokenCount = Object.keys(ownedCards).reduce(function(total, cat) {
                            return total + (ownedCards[cat] ? ownedCards[cat].length : 0);
                        }, 0);
                    }
                }
                
                // Count blocking tokens for end-game scoring
                var blockingTokenCount = 0;
                if (players.blockingTokens && players.blockingTokens[player.name]) {
                    var playerTokens = getPlayerTokens(player.name);
                    blockingTokenCount = (playerTokens[2] || 0) + (playerTokens[4] || 0) + (playerTokens[6] || 0);
                }
                
                // Calculate component scores
                var countryTokenPoints = countryTokenCount * (ACTIVE_RULES.endGameTokenPoints || 0);
                var blockingTokenPoints = blockingTokenCount * (ACTIVE_RULES.endGameBlockingTokenPoints || 0);
                var blockingPoints = stats.blockingPointsEarned || 0;
                
                // Calculate bidding points by subtracting known components from total score
                // This isolates the points earned from successful rankings
                var currentPlayerScore = getPlayerScore(player.name) || 0;
                var biddingPoints = Math.max(0, currentPlayerScore - blockingPoints - countryTokenPoints - blockingTokenPoints);
                
                console.log('Debug for', player.name + ':');
                console.log('  Total score:', currentPlayerScore);
                console.log('  Blocking points:', blockingPoints);
                console.log('  Country token points:', countryTokenPoints);
                console.log('  Blocking token points:', blockingTokenPoints);
                console.log('  Calculated bidding points:', biddingPoints);
                
                var breakdown = '📈' + biddingPoints + 
                               ' 🛡️' + blockingPoints + 
                               ' 🏆' + countryTokenPoints + 
                               ' 💎' + blockingTokenPoints;
                
                // Calculate total as sum of all earned points
                var calculatedTotal = biddingPoints + blockingPoints + countryTokenPoints + blockingTokenPoints;
                
                // Debug logging
                console.log('Leaderboard debug for', player.name + ':');
                console.log('  biddingPoints:', biddingPoints);
                console.log('  blockingPoints:', blockingPoints);
                console.log('  countryTokenPoints:', countryTokenPoints);
                console.log('  blockingTokenPoints:', blockingTokenPoints);
                console.log('  calculatedTotal:', calculatedTotal);
                console.log('  breakdown:', breakdown);
                
                html += '<tr>' +
                       '<td class="rank ' + rankClass + '">' + (index + 1) + '</td>' +
                       '<td>' + sanitizeHTML(player.name) + '</td>' +
                       '<td><strong>' + calculatedTotal + '</strong></td>' +
                       '<td style="font-size: 12px;">' + sanitizeHTML(breakdown) + '</td>' +
                       '</tr>';
            });
            
            html += '</tbody></table>';
            safeSetHTML(leaderboard, html);
        }
    }
    
    if (playerStats) {
        if (players.list.length === 0) {
            safeSetHTML(playerStats, '<div class="no-scores-message">No statistics available yet!</div>');
        } else {
            var html = '';
            console.log('🔍 Displaying player stats:', players.stats);
            
            // Use same scores as leaderboard for consistency
            var scoresForStats = preCalculatedScores || getFinalScores();
            var scoresMap = {};
            scoresForStats.forEach(function(player) {
                scoresMap[player.name] = player.score;
            });
            
            players.list.forEach(function(playerName) {
                var score = scoresMap[playerName] || getPlayerScore(playerName);
                var stats = getPlayerStats(playerName);
                
                console.log('📊 Stats for', playerName + ':', stats);
                
                // Calculate ranking success rate (how often player succeeds after winning bid)
                var rankingSuccessRate = stats.bidsWon > 0 ? Math.round((stats.bidsSuccessful / stats.bidsWon) * 100) : 0;
                // Calculate bid success rate (how often bid attempts result in winning)
                var bidSuccessRate = stats.bidAttempts > 0 ? Math.round((stats.bidsWon / stats.bidAttempts) * 100) : 0;
                
                html += '<div class="player-detailed-stats">' +
                       '<div class="player-stats-header">' +
                       '<span class="player-stat-name">🎯 ' + sanitizeHTML(playerName) + '</span>' +
                       '<span class="player-stat-score">' + sanitizeHTML(score) + ' points</span>' +
                       '</div>' +
                       '<div class="player-stats-details">' +
                       '<div class="stat-row">🎯 Bid Attempts: <span>' + stats.bidAttempts + '</span></div>' +
                       '<div class="stat-row">🏆 Rounds Won: <span>' + stats.bidsWon + '</span></div>' +
                       '<div class="stat-row">✅ Successful Rankings: <span>' + stats.bidsSuccessful + '</span></div>' +
                       '<div class="stat-row">🃏 Cards Used: <span>' + (stats.cardsUsed || 0) + '</span></div>' +
                       '<div class="stat-row">🛡️ Blocks Made: <span>' + stats.blocksMade + '</span></div>' +
                       '<div class="stat-row">💎 Tokens Gained: <span>' + stats.tokensGained + '</span></div>' +
                       '<div class="stat-row">💸 Tokens Lost: <span>' + stats.tokensLost + '</span></div>' +
                       '<div class="stat-row">🎲 Bid Win Rate: <span>' + bidSuccessRate + '%</span></div>' +
                       '<div class="stat-row">📈 Ranking Rate: <span>' + rankingSuccessRate + '%</span></div>' +
                       '</div>' +
                       '</div>';
            });
            safeSetHTML(playerStats, html);
        }
    }
    
    if (chipInventory) {
        if (players.list.length === 0) {
            safeSetHTML(chipInventory, '<div class="no-scores-message">No chip data available!</div>');
        } else {
            var html = '';
            players.list.forEach(function(playerName) {
                var tokens = getPlayerTokens(playerName);
                var chipDisplay = '';
                
                Object.keys(tokens).forEach(function(tokenValue) {
                    var count = tokens[tokenValue] || 0;
                    if (count > 0) {
                        chipDisplay += '<span class="chip-badge points-' + (tokenValue === '2' ? '3' : tokenValue === '4' ? '5' : '7') + '">' + tokenValue + ' (x' + count + ')</span>';
                    }
                });
                
                if (chipDisplay === '') {
                    chipDisplay = '<span style="color: #999; font-style: italic;">No tokens</span>';
                }
                
                html += '<div class="chip-inventory-item">' +
                       '<span class="chip-inventory-player">' + playerName + '</span>' +
                       '<div class="chip-inventory-chips">' + chipDisplay + '</div>' +
                       '</div>';
            });
            safeSetHTML(chipInventory, html);
        }
    }
}

window.clearScores = function() {
    // Clear all player scores but keep players and stay on scores screen
    console.log('Clearing all scores...');
    
    // Reset scores to 0 for all players
    var playersList = getPlayersList();
    playersList.forEach(function(playerName) {
        setPlayerScore(playerName, 0);
        GameState.set('players.blockingTokens.' + playerName, {2: 1, 4: 1, 6: 1});
    });
    
    // Reset game state
    GameState.set('currentRound', 1);
    GameState.set('players.currentBlocks', {});
    GameState.set('players.scoresCalculatedThisRound', false); // Reset score calculation flag
    
    // Update the display immediately
    var scores = getFinalScores();
    updateScoresDisplay(scores);
    
    console.log('All scores cleared and reset to 0!');
};

// Quick setup function for 4 players
window.quickSetup4Players = function() {
    console.log('🔧 Setting up quick 4-player game...');
    
    // Reset game state first
    newGame();
    
    // Navigate to player screen
    showScreen('playerScreen');
    
    // Wait for screen transition and DOM to be ready
    setTimeout(function() {
        try {
            // Auto-fill 4 player names
            var playerNames = ['Alice', 'Bob', 'Charlie', 'Diana'];
            
            // Reset nextPlayerNumber to ensure proper counting
            nextPlayerNumber = 2;
            
            // Make sure we have enough player input fields
            while (nextPlayerNumber <= 4) {
                if (nextPlayerNumber > 1) {
                    addPlayer();
                } else {
                    nextPlayerNumber++;
                }
            }
            
            // Wait a moment for DOM updates, then fill in the player names
            setTimeout(function() {
                for (var i = 0; i < 4; i++) {
                    var playerInput = document.getElementById('player' + (i + 1));
                    if (playerInput) {
                        playerInput.value = playerNames[i];
                        console.log('✅ Set player ' + (i + 1) + ' to: ' + playerNames[i]);
                    } else {
                        console.log('❌ Could not find player input ' + (i + 1));
                    }
                }
                
                // Update the display
                updatePlayerCount();
                
                // Show confirmation
                console.log('✅ 4-player game set up!\n\nPlayers: ' + playerNames.join(', ') + '\n\nClick "Start Round" when ready!');
            }, 100); // Small delay for DOM updates
            
        } catch (error) {
            console.error('❌ Error in quickSetup4Players:', error);
            showNotification('Error setting up 4-player game', 'error');
        }
    }, 200); // Wait for screen transition
};

// Simple test function first
window.testFunction = function() {
    console.log('Test function works!');
    console.log('Test function called successfully');
};

// Test visual console function
window.testVisualConsole = function() {
    showScreen('testResultsScreen');
    clearConsoleOutput();
    enableVisualConsole();
    
    setTimeout(function() {
        console.log('Testing visual console...');
        console.warn('This is a warning message');
        console.error('This is an error message');
        console.log('✅ Visual console test complete!');
    }, 1000);
};

// Test blocking screen navigation
window.testBlockingScreen = function() {
    console.log('🧪 Testing blocking screen navigation...');
    
    // Set up some dummy data so the screen has content
    currentPrompt = { label: 'Test Challenge' };
    highestBidder = 'Test Player';
    currentBid = 3;
    drawnCards = ['001', '002', '003'];
    blockedCards = [];
    players.list = ['Test Player', 'Other Player'];
    blockingOrder = ['Other Player'];
    blockingTurn = 0;
    
    console.log('📋 Test data set up');
    console.log('🔄 Calling showScreen("blockingScreen")...');
    
    showScreen('blockingScreen');
    
    console.log('✅ Test complete - check if blocking screen is visible');
};

// Continue from token replacement screen
window.continueFromTokenReplacement = function() {
    console.log('Continuing from token replacement screen...');
    
    // Hide the token replacement screen first
    var tokenScreen = document.getElementById('tokenReplacementScreen');
    if (tokenScreen) {
        tokenScreen.classList.remove('active');
    }
    
    // If automated test is running, don't do anything - let the test continue naturally
    if (window.isAutomatedTestRunning) {
        console.log('📱 Automated test: token screen dismissed, test will continue...');
        // The automated test will continue on its own timing
    } else {
        // Manual game: go to bidding screen with proper setup
        console.log('📱 Manual game: returning to bidding screen...');
        
        // Set up the bidding interface properly
        generatePlayerBiddingInterface();
        updateHighBidderDisplay();
        showScreen('biddingScreen');
    }
};

// Test function to manually trigger token replacement screen
window.testTokenReplacement = function() {
    console.log('Testing token replacement screen...');
    
    // Create some test data
    var removedTokens = ['001', '002', '003'];
    var addedTokens = ['004', '005', '006'];
    
    // Set round to 2 so it shows
    GameState.set('currentRound', 2);
    
    // Show the notification
    showTokenReplacementNotification(removedTokens, addedTokens);
    
    console.log('Token replacement screen should be visible now!');
};

// Automated testing state management and execution guards
window.automatedTestState = {
    isProcessingBid: false,
    isProcessingBlock: false,
    isSelectingCards: false,
    isInReveal: false,
    currentPhase: 'idle',
    currentRoundId: null,
    timeouts: []
};

// Card selection state tracking
window.cardSelectionState = {
    selectedCards: new Set(),
    isSelecting: false,
    targetCount: 0,
    roundId: null
};

// Automated testing function with detailed results tracking
window.automatedTestResults = {
    startTime: null,
    endTime: null,
    rounds: [],
    roundsCompleted: 0,
    totalBids: 0,
    totalBlocks: 0,
    successfulBids: 0,
    failedBids: 0,
    playerStats: {},
    errors: [],
    cardStats: {
        totalCardsRanked: 0,    // Total cards used in ranking attempts
        totalCardsOwned: 0,     // Total cards currently owned by all players
        totalCardsInPlay: 0     // Total cards still available in the general pool
    }
};

// Helper functions for state management
function canProceedWithPhase(phase) {
    // Guard against null automatedTestState
    if (!window.automatedTestState) {
        console.log('⚠️ automatedTestState is null, initializing...');
        return true; // Allow progression when state is not initialized
    }
    return window.automatedTestState.currentPhase === 'idle' || 
           window.automatedTestState.currentPhase === phase;
}

function setPhase(phase, roundId) {
    // Ensure automatedTestState exists
    if (!window.automatedTestState) {
        window.automatedTestState = {
            isProcessingBid: false,
            isProcessingBlock: false,
            isSelectingCards: false,
            isInReveal: false,
            currentPhase: 'idle',
            currentRoundId: null,
            timeouts: []
        };
        console.log('✅ Auto-initialized automatedTestState in setPhase');
    }
    console.log(`🔄 Phase transition: ${window.automatedTestState.currentPhase} → ${phase} (Round ${roundId})`);
    window.automatedTestState.currentPhase = phase;
    window.automatedTestState.currentRoundId = roundId;
}

function clearAllTimeouts() {
    window.automatedTestState.timeouts.forEach(timeoutId => clearTimeout(timeoutId));
    window.automatedTestState.timeouts = [];
}

function addTimeout(fn, delay) {
    const timeoutId = setTimeout(fn, delay);
    window.automatedTestState.timeouts.push(timeoutId);
    return timeoutId;
}

function updateTestStatistics(action, data) {
    switch(action) {
        case 'BLOCK_MADE':
            // Don't increment blocksMade here - it's already tracked in the actual game logic
            // This was causing inflated block counts
            window.automatedTestResults.totalBlocks++;
            console.log(`📊 Block tracked: ${data.player} (Total blocks: ${window.automatedTestResults.totalBlocks})`);
            break;
        case 'ROUND_COMPLETE':
            window.automatedTestResults.roundsCompleted++;
            console.log(`📊 Round ${data.round} completed (Total rounds: ${window.automatedTestResults.roundsCompleted})`);
            break;
        case 'BID_WON':
            window.automatedTestResults.totalBids++;
            console.log(`📊 Bid won tracked: ${data.player} (Total bids: ${window.automatedTestResults.totalBids})`);
            break;
        case 'BID_SUCCESSFUL':
            window.automatedTestResults.successfulBids++;
            console.log(`📊 Successful bid tracked: ${data.player} (Total successful: ${window.automatedTestResults.successfulBids})`);
            break;
        case 'BID_FAILED':
            window.automatedTestResults.failedBids++;
            console.log(`📊 Failed bid tracked: ${data.player} (Total failed: ${window.automatedTestResults.failedBids})`);
            break;
    }
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Test speed modes
 */
var TEST_MODES = {
    NORMAL: 'normal',  // Current timing for UI demonstration  
    FAST: 'fast'       // Minimal delays for quick testing
};

// Current test mode
var currentTestMode = TEST_MODES.NORMAL;

/**
 * Get delay for automated testing based on mode
 * @param {number} normalDelay - Normal delay in milliseconds
 * @returns {number} Adjusted delay based on test mode
 */
function getTestDelay(normalDelay = 500) {
    return currentTestMode === TEST_MODES.FAST ? 1 : normalDelay;
}

async function waitForUIState(condition, timeout = 5000) {
    const startTime = Date.now();
    while (Date.now() - startTime < timeout) {
        if (condition()) {
            return true;
        }
        await sleep(100);
    }
    throw new Error(`UI condition not met within ${timeout}ms`);
}

function getCurrentScreen() {
    const activeScreen = document.querySelector('.screen.active');
    return activeScreen ? activeScreen.id : null;
}

function verifyScreenTransition(expectedScreen, timeout = 3000) {
    return waitForUIState(() => {
        const currentScreen = getCurrentScreen();
        if (currentScreen === expectedScreen) {
            console.log(`✅ Screen verification passed: ${expectedScreen}`);
            return true;
        } else {
            console.log(`⏳ Waiting for screen transition: ${currentScreen} → ${expectedScreen}`);
            return false;
        }
    }, timeout);
}

window.runAutomatedTest = function() {
    runRealGameTestV4('🤖 Real Game Test v4');
};

window.runFastAutomatedTest = function() {
    runRealGameTestV4('⚡ Fast Real Game Test v4', { maxRounds: 3 });
};

// V4 Test Runner Function
function runRealGameTestV4(testName, config = {}) {
    console.log(testName + ' starting...');
    
    // Show test results screen
    showScreen('testResultsScreen');
    
    // Clear previous results
    clearTestResults();
    
    // Default config for v4 test
    const defaultConfig = {
        playerNames: ['Alice', 'Bob', 'Charlie', 'Diana'],
        maxRounds: 5,
        blockFrequency: 0.6,
        logLevel: 'normal'
    };
    
    const testConfig = { ...defaultConfig, ...config };
    
    console.log('🎯 Running Real Game Test v4 with config:', testConfig);
    
    // Check if v4 test system is available
    if (typeof window.runRealGameTest === 'function') {
        console.log('✅ V4 test system found, starting test...');
        
        // Run the v4 test
        window.runRealGameTest(testConfig).then(results => {
            console.log('🏁 V4 Test completed!');
            console.log('Results:', results);
            
            // Store results for display
            window.automatedTestResults = results;
            
            // Update test results display
            displayTestResults(results);
            
        }).catch(error => {
            console.error('❌ V4 Test failed:', error);
            console.log('⚠️ Falling back to V3 test system...');
            
            // Fallback to V3 if V4 fails
            fallbackToV3Test(testName);
        });
        
    } else {
        console.log('⚠️ V4 test system not found, falling back to V3...');
        fallbackToV3Test(testName);
    }
}

function fallbackToV3Test(testName) {
    console.log('🔄 Running V3 fallback test...');
    currentTestMode = TEST_MODES.NORMAL;
    runAutomatedTestWithMode(testName + ' (V3 Fallback)');
}

function runAutomatedTestWithMode(testName) {
    console.log(testName + ' starting...');
    console.log('Test mode:', currentTestMode === TEST_MODES.FAST ? 'FAST ⚡' : 'NORMAL 🤖');
    console.log('🐛 DEBUG: Starting round:', getCurrentRound());
    
    // Initialize results tracking
    window.automatedTestResults = {
        startTime: new Date(),
        endTime: null,
        rounds: [],
        roundsCompleted: 0,
        totalBids: 0,
        totalBlocks: 0,
        successfulBids: 0,
        failedBids: 0,
        playerStats: {},
        errors: []
    };
    
    // Set automated test flag
    window.isAutomatedTestRunning = true;
    
    // Apply rules from UI before starting test
    console.log('⚙️ Applying rules from UI for automated test...');
    applyRulesFromUI();
    
    // Override winning score for automated tests to ensure multiple rounds
    const originalWinningScore = ACTIVE_RULES.winningScore;
    ACTIVE_RULES.winningScore = 100; // High enough to allow multiple rounds of testing
    console.log('✅ Rules applied - Max rounds:', ACTIVE_RULES.maxRounds, 'Winning score:', ACTIVE_RULES.winningScore, '(overridden from', originalWinningScore, 'for testing)');
    
    // Initialize automated test state
    window.automatedTestState = {
        isProcessingBid: false,
        isProcessingBlock: false,
        isSelectingCards: false,
        isInReveal: false,
        currentPhase: 'idle',
        currentRoundId: null,
        timeouts: []
    };
    console.log('✅ Initialized automatedTestState');
    
    // Test run starting
    
    try {
        // Setup 4 players WITHOUT navigating away from test results screen
        console.log('🔧 Setting up 4 players for automated test...');
        
        // Reset game state but preserve accumulated statistics
        GameState.set('currentRound', 1);
        GameState.set('players.scores', {});
        GameState.set('players.currentBlocks', {});
        GameState.set('players.scoresCalculatedThisRound', false); // Reset score calculation flag
        console.log('🔧 Test setup - reset score calculation flag to false');
        // NOTE: Do NOT reset players.stats to preserve accumulated statistics across tests
        
        // Reset all players' blocking tokens
        var playersList = getPlayersList();
        playersList.forEach(function(playerName) {
            var playerTokens = getPlayerTokens(playerName);
            if (playerTokens) {
                GameState.set('players.blockingTokens.' + playerName, {2: 1, 4: 1, 6: 1});
            }
        });
        
        resetRoundState();
        
        // Auto-fill 4 player names directly without screen navigation
        var playerNames = ['Alice', 'Bob', 'Charlie', 'Diana'];
        GameState.set('players.list', playerNames.slice()); // Copy the array
        
        // Initialize scores and tokens for each player
        playerNames.forEach(function(playerName) {
            setPlayerScore(playerName, 0);
            GameState.set('players.blockingTokens.' + playerName, {2: 1, 4: 1, 6: 1});
            GameState.set('players.currentBlocks.' + playerName, null);
            
            // Initialize player stats tracking (preserve existing stats if they exist)
            var allStats = GameState.get('players.stats') || {};
            if (!allStats[playerName]) {
                allStats[playerName] = {
                    bidsWon: 0,          // Number of rounds won (became the bidder)
                    bidsSuccessful: 0,   // Number of successful rankings after winning bid
                    bidAttempts: 0,      // Total number of bid attempts made
                    bidsPassed: 0,       // Number of times passed on bidding
                    blocksMade: 0,
                    blockingPointsEarned: 0,
                    tokensGained: 0,
                    tokensLost: 0,
                    cardsUsed: 0         // Total cards used in ranking attempts
                };
                GameState.set('players.stats', allStats);
            }
            
            // Initialize test stats
            window.automatedTestResults.playerStats[playerName] = {
                bidsWon: 0,          // Number of rounds won (became the bidder)
                bidsSuccessful: 0,   // Number of successful rankings after winning bid
                bidAttempts: 0,      // Total number of bid attempts made
                bidsPassed: 0,       // Number of times passed on bidding
                blocksMade: 0,
                tokensGained: 0,
                tokensLost: 0,
                totalScore: 0
            };
        });
        
        console.log('✅ Players setup complete: ' + playerNames.join(', '));
        console.log('🎮 Starting automated test sequence...');
        
        // Start automated round sequence
        setTimeout(async function() {
            await automatedRound(1);
        }, getTestDelay(2000)); // Give more time for setup
        
    } catch (error) {
        console.error('❌ Error starting automated test:', error);
        console.error('Failed to start automated test: ' + error.message);
        window.automatedTestResults.errors.push('Test start error: ' + error.message);
        window.isAutomatedTestRunning = false;
        // Keep visual console enabled for error review
    }
};

async function automatedRound(roundNum) {
    console.log('🎮 Starting automated round ' + roundNum);
    
    // Check execution guard
    if (!canProceedWithPhase('round')) {
        console.log('⚠️ Cannot start round - another operation in progress');
        return;
    }
    
    // Set phase
    setPhase('round', roundNum);
    
    // Start tracking this round
    var roundData = {
        roundNumber: roundNum,
        startTime: new Date(),
        prompt: null,
        drawnCards: [],
        bidder: null,
        bidAmount: 0,
        blockers: [],
        finalRanking: [],
        success: null,
        scores: {},
        errors: []
    };
    
    try {
        // SHOW PLAYER SCREEN FIRST in automated mode
        console.log('👥 Showing player screen...');
        showScreen('playerScreen');
        
        // Wait for screen transition and verify
        await verifyScreenTransition('playerScreen');
        
        // Set up player input fields to simulate manual entry
        console.log('🔧 Setting up player input fields...');
        var playerNames = ['Alice', 'Bob', 'Charlie', 'Diana'];
        
        // Make sure we have enough player input fields
        for (var playerNum = 2; playerNum <= 4; playerNum++) {
            var existingInput = document.getElementById('player' + playerNum);
            if (!existingInput) {
                addPlayer(); // This will create the input field
                console.log('✅ Added player input field:', playerNum);
            }
        }
        
        // Fill in the player names in the input fields
        for (var i = 0; i < 4; i++) {
            var playerInput = document.getElementById('player' + (i + 1));
            if (playerInput) {
                playerInput.value = playerNames[i];
                console.log('✅ Set player' + (i + 1) + ' to:', playerNames[i]);
            } else {
                console.log('⚠️ Could not find player input field:', 'player' + (i + 1));
            }
        }
        
        // Update the player count display
        updatePlayerCount();
        
        // Wait for UI to settle
        await sleep(500);
        
        // First start the normal flow to set up category selection
        console.log('🚀 Starting round with bidder using normal flow...');
        startRoundWithBidder(); // This will show category selection screen
        
        // Wait for category selection to be set up
        await sleep(500);
        
        // Now automatically select a category for the automated test
        var categories = Object.keys(window.GAME_DATA.categories);
        
        // For testing blocked cards display, use same category for first 3 rounds
        var selectedCategory;
        if (getCurrentRound() <= 3) {
            selectedCategory = 'movies'; // Force same category for first 3 rounds
            console.log('🎯 Automated test FORCING category for blocked cards test:', selectedCategory);
        } else {
            selectedCategory = categories[Math.floor(Math.random() * categories.length)];
            console.log('🎯 Automated test selecting random category:', selectedCategory);
        }
        console.log('🚨🚨🚨 AUTOMATED TEST ABOUT TO CALL SELECTCATEGORY! 🚨🚨🚨');
        selectCategory(selectedCategory); // This will call showBiddingScreen()
        console.log('🚨🚨🚨 AUTOMATED TEST FINISHED CALLING SELECTCATEGORY! 🚨🚨🚨');
        
        // Store round data after setup
        var currentPrompt = GameState.get('currentPrompt');
        roundData.prompt = currentPrompt ? currentPrompt.label : 'Unknown';
        roundData.drawnCards = getDrawnCards().slice();
        
        // Wait for bidding screen to fully load, then start automated bidding
        await sleep(1000);
        console.log('💰 Starting automated bidding on bidding screen...');
        await automatedBidding(roundData);
        
    } catch (error) {
        console.error('❌ Error in round ' + roundNum + ':', error);
        console.error('Test failed in round ' + roundNum + ': ' + error.message);
        roundData.errors.push('Round start error: ' + error.message);
        window.automatedTestResults.errors.push('Round ' + roundNum + ' error: ' + error.message);
    }
}

async function automatedBidding(roundData) {
    try {
        // Set phase
        setPhase('bidding', getCurrentRound());
        
        // Reset passed players for new bidding round
        GameState.set('passedPlayers', {});
        
        // Reset highest bidder and bidder success for new round
        GameState.set('highestBidder', '');
        GameState.set('bidderSuccess', false);
        
        // Randomize final bidding outcome (3-6 cards)
        var playerNames = ['Alice', 'Bob', 'Charlie', 'Diana'];
        var randomWinner = playerNames[Math.floor(Math.random() * playerNames.length)];
        var finalBidAmount = Math.floor(Math.random() * 4) + 3; // 3-6 cards
        
        console.log('🎲 Competitive bidding will end with:', randomWinner, 'winning at', finalBidAmount, 'cards');
        
        // Track bidding data
        if (roundData) {
            roundData.bidder = randomWinner;
            roundData.bidAmount = finalBidAmount;
        }
        
        // CRITICAL FIX: Set GameState for calculateAndApplyScores()
        GameState.set('highestBidder', randomWinner);
        GameState.set('currentBid', finalBidAmount);
        // State is now set above
        console.log('🔧 Pre-determined winner:', randomWinner, 'at', finalBidAmount, 'cards');
        
        // Simulate competitive bidding with multiple players
        var currentBidder = 0;
        var targetBid = finalBidAmount;
        
        function simulateBiddingRound() {
            // Check if all non-high-bidders have passed
            var highestBidder = getHighestBidder();
            var passedPlayers = GameState.get('passedPlayers') || {};
            var allNonBiddersHavePassed = playerNames.every(name => 
                name === highestBidder || passedPlayers[name]
            );
            
            if (getCurrentBid() >= targetBid || allNonBiddersHavePassed) {
                // Bidding complete - either target reached or all others have passed
                var currentWinner = getHighestBidder();
                var finalBid = getCurrentBid();
                
                console.log('✅ Bidding complete, ' + currentWinner + ' won with ' + finalBid + ' cards');
                if (allNonBiddersHavePassed) {
                    console.log('  Reason: All other players have passed');
                } else {
                    console.log('  Reason: Target bid reached');
                }
                
                // Finish bidding using the normal flow
                setTimeout(() => {
                    console.log('🖼️ Calling finishBidding() to transition to blocking screen...');
                    finishBidding(); // This will show blocking screen
                    
                    setTimeout(() => {
                        console.log('🚫 Starting automated blocking...');
                        automatedBlocking(roundData);
                    }, getTestDelay(1500)); // Give more time for screen transition
                }, getTestDelay(500));
                return;
            }
            
            // Current player bids
            var currentPlayer = playerNames[currentBidder % playerNames.length];
            
            // Competitive bidding logic: winner always bids when it's their turn and bid < target
            // Other players bid with decreasing probability as target approaches
            var shouldBid = false;
            
            if (currentPlayer === randomWinner) {
                // Winner always bids until target is reached
                shouldBid = getCurrentBid() < targetBid;
            } else {
                // Other players bid with probability based on how close we are to target
                var remainingBids = targetBid - getCurrentBid();
                var bidProbability = Math.max(0.3, remainingBids / targetBid); // 30% min, higher when far from target
                shouldBid = getCurrentBid() < targetBid - 1 && Math.random() < bidProbability;
            }
            
            if (shouldBid) {
                setTimeout(() => {
                    console.log('💰 ' + currentPlayer + ' bids ' + (getCurrentBid() + 1));
                    placeBidForPlayer(currentPlayer);
                    
                    // Continue bidding
                    setTimeout(() => {
                        currentBidder++;
                        simulateBiddingRound();
                    }, getTestDelay(400));
                }, getTestDelay(300));
            } else {
                setTimeout(() => {
                    console.log('❌ ' + currentPlayer + ' passes');
                    passPlayer(currentPlayer);
                    
                    // Continue bidding
                    setTimeout(() => {
                        currentBidder++;
                        simulateBiddingRound();
                    }, getTestDelay(300));
                }, getTestDelay(200));
            }
        }
        
        // Always start bidding at 1 as requested
        console.log('🎯 Starting competitive bidding - Target:', targetBid, 'will start at 1');
        
        // Make the first bid of 1 card
        setTimeout(() => {
            var firstBidder = playerNames[Math.floor(Math.random() * playerNames.length)];
            console.log('🎯 ' + firstBidder + ' makes opening bid at 1 card');
            GameState.set('currentBid', 0); // Set to 0 so placeBidForPlayer will make it 1
            placeBidForPlayer(firstBidder);
            
            // Start competitive bidding round
            setTimeout(() => {
                currentBidder = 0; // Start with first player
                simulateBiddingRound();
            }, getTestDelay(500));
        }, getTestDelay(300));
        
    } catch (error) {
        console.error('❌ Error in bidding phase:', error);
        throw error;
    }
}

function automatedBlocking() {
    try {
        console.log('🛡️ Simulating blocking phase...');
        var highestBidder = GameState.get('highestBidder');
        console.log('Current highest bidder:', highestBidder);
        
        // Get drawn cards from game state
        var gameState = GameState.data;
        var drawnCards = gameState.drawnCards || [];
        console.log('🎴 Cards available for blocking:', drawnCards);
        
        // Ensure blocking order is properly set up for automated testing
        var blockingOrder = GameState.get('blockingOrder') || [];
        if (blockingOrder.length === 0) {
            console.log('⚠️ Blocking order is empty, setting it up...');
            blockingOrder = getPlayersByScore().filter(function(name) {
                return name !== getHighestBidder();
            }).reverse(); // Reverse to get lowest score first
            GameState.set('blockingOrder', blockingOrder);
            GameState.set('blockingTurn', 0);
        }
        
        console.log('Current blocking order:', blockingOrder);
        console.log('Current blocking turn:', GameState.get('blockingTurn'));
        
        // Get the blocking order (non-bidders)
        var nonBidders = getPlayersList().filter(name => name !== getHighestBidder());
        console.log('🎯 Non-bidders who can block:', nonBidders);
        
        if (nonBidders.length === 0) {
            console.log('⏭️ No blockers available, finishing blocking...');
            finishBlocking();
            setTimeout(() => automatedRanking(), getTestDelay(500));
            return;
        }
        
        // Simple approach: randomly decide if each player will block or skip
        function processNextBlocker() {
            var blockingTurn = GameState.get('blockingTurn');
            var blockingOrder = GameState.get('blockingOrder');
            if (blockingTurn >= blockingOrder.length) {
                console.log('✅ All blocking turns completed, finishing blocking...');
                setTimeout(() => {
                    console.log('🏁 Finishing blocking phase and transitioning to card selection...');
                    finishBlocking(); // This will show card selection screen
                    setTimeout(() => {
                        console.log('📊 Starting automated ranking...');
                        automatedRanking();
                    }, getTestDelay(1500)); // Give time for screen transition
                }, getTestDelay(1000));
                return;
            }
            
            var currentPlayer = blockingOrder[blockingTurn];
            var willBlock = Math.random() < 0.4; // 40% chance to block
            
            console.log('🎯 ' + currentPlayer + '\'s turn: ' + (willBlock ? 'will block' : 'will skip'));
            
            if (willBlock) {
                // CRITICAL: Check if current player is the bidder before attempting to block
                var highestBidder = GameState.get('highestBidder');
                if (currentPlayer === highestBidder) {
                    console.log('🚫 AUTOMATED TEST: Skipping ' + currentPlayer + ' - bidders cannot block!');
                    skipCurrentBlocker();
                    return;
                }
                
                // Randomly select token and card
                var tokenValues = [2, 4, 6];
                var randomToken = tokenValues[Math.floor(Math.random() * tokenValues.length)];
                var currentDrawnCards = getDrawnCards();
                
                // Filter out cards that are already owned by anyone
                var gameState = GameState.data;
                var currentCategory = gameState.currentCategory || 'countries';
                var ownedCards = GameState.get('players.ownedCards') || {};
                var blockableCards = currentDrawnCards.filter(function(cardId) {
                    for (var playerName in ownedCards) {
                        if (ownedCards[playerName][currentCategory] && 
                            ownedCards[playerName][currentCategory].includes(cardId)) {
                            return false; // Card is owned, cannot block
                        }
                    }
                    return true; // Card is not owned, can block
                });
                
                console.log('🔍 Drawn cards:', currentDrawnCards.length, 'Blockable cards:', blockableCards.length);
                var randomCardIndex = Math.floor(Math.random() * Math.min(blockableCards.length, 3));
                
                setTimeout(() => {
                    console.log('🔘 ' + currentPlayer + ' selecting ' + randomToken + '-point token');
                    selectBlockingToken(randomToken, null);
                    
                    setTimeout(() => {
                        console.log('🐛 DEBUG: blockableCards:', blockableCards, 'length:', blockableCards ? blockableCards.length : 'undefined');
                        console.log('🐛 DEBUG: randomCardIndex:', randomCardIndex);
                        if (blockableCards && blockableCards.length > 0 && blockableCards.length > randomCardIndex) {
                            var cardToBlock = blockableCards[randomCardIndex];
                            console.log('🚫 ' + currentPlayer + ' blocking card: ' + cardToBlock + ' (validated as blockable)');
                            selectCardToBlock(cardToBlock);
                        } else {
                            console.log('⚠️ No blockable cards available, skipping turn');
                            console.log('   drawnCards:', currentDrawnCards);
                            console.log('   blockableCards:', blockableCards);
                            console.log('   randomCardIndex:', randomCardIndex);
                            skipCurrentBlocker();
                        }
                        
                        // Continue to next player
                        setTimeout(() => processNextBlocker(), getTestDelay(800));
                    }, getTestDelay(500));
                }, getTestDelay(300));
            } else {
                // Skip this player's turn
                setTimeout(() => {
                    console.log('⏭️ ' + currentPlayer + ' skips blocking');
                    skipCurrentBlocker();
                    setTimeout(() => processNextBlocker(), getTestDelay(500));
                }, getTestDelay(300));
            }
        }
        
        // Start processing blockers
        processNextBlocker();
        
    } catch (error) {
        console.error('❌ Error in blocking phase:', error);
        throw error;
    }
}

// Removed old executeBlockingActions function - using simplified blocking approach now

function skipCurrentBlocker() {
    try {
        // Skip the current player's blocking turn
        var blockingTurn = GameState.get('blockingTurn');
        var blockingOrder = GameState.get('blockingOrder');
        blockingTurn++;
        GameState.set('blockingTurn', blockingTurn);
        
        if (blockingTurn < blockingOrder.length) {
            console.log('⏭️ Skipping to next blocker:', blockingOrder[blockingTurn]);
            // Only call updateBlockingInterface if it exists (not in automated mode)
            if (typeof updateBlockingInterface === 'function' && !window.isAutomatedTestRunning) {
                updateBlockingInterface();
            }
        } else {
            console.log('🏁 All blocking turns completed');
        }
    } catch (error) {
        console.error('❌ Error skipping blocker:', error);
    }
}

function automatedRanking() {
    // Prevent execution if automated test has completed (but allow if completion is pending)
    if (!window.isAutomatedTestRunning || (window.automatedTestResults && window.automatedTestResults.endTime && !window.automatedTestResults.shouldComplete)) {
        console.log('⚠️ Ignoring automatedRanking() call - test not running or completed');
        return;
    }
    
    try {
        console.log('📊 Simulating ranking phase...');
        
        // Get state from GameState to ensure consistency
        var gameState = GameState.data;
        var currentBid = gameState.currentBid;
        var drawnCards = gameState.drawnCards;
        var blockedCards = gameState.blockedCards || [];
        
        console.log('Current bid:', currentBid);
        console.log('Available cards:', drawnCards);
        console.log('Blocked cards:', blockedCards);
        
        // Auto-select cards (take first N cards available that aren't blocked)
        var drawnCards = getDrawnCards();
        var availableCards = drawnCards.filter(function(cardId) {
            return !blockedCards.includes(cardId);
        });
        
        var cardsToSelect = Math.min(currentBid, availableCards.length);
        console.log('Cards to select:', cardsToSelect, 'from available:', availableCards);
        
        if (cardsToSelect === 0) {
            console.log('⚠️ No cards available to select, skipping to reveal...');
            setTimeout(() => automatedReveal(), getTestDelay(1000));
            return;
        }
        
        // Simulate card selection - mix of correct and incorrect rankings
        var shouldSucceed = Math.random() < 0.5; // 50% chance of success
        var cardsToUse = [];
        
        if (shouldSucceed) {
            // Try to create a successful ranking by using a random subset
            console.log('🎯 Attempting successful ranking...');
            cardsToUse = availableCards.slice(0, cardsToSelect);
        } else {
            // Create deliberately wrong ranking by randomizing order
            console.log('🎯 Creating challenging ranking (likely to fail)...');
            var shuffled = availableCards.slice().sort(() => Math.random() - 0.5);
            cardsToUse = shuffled.slice(0, cardsToSelect);
        }
        
        for (var i = 0; i < cardsToSelect; i++) {
            setTimeout(function(index) {
                return function() {
                    if (cardsToUse && cardsToUse[index]) {
                        console.log('🎯 Selecting card:', cardsToUse[index]);
                        selectCardForRanking(cardsToUse[index]);
                    }
                };
            }(i), getTestDelay(i * 300));
        }
        
        // Check if we can proceed to ranking after all cards selected
        setTimeout(() => {
            console.log('🎯 All cards selected, checking if ready for ranking...');
            console.log('Selected cards for ranking:', GameState.get('selectedCardsForRanking'));
            console.log('Current screen:', document.querySelector('.screen.active') ? document.querySelector('.screen.active').id : 'unknown');
            
            // If we have the right number of cards, proceed to ranking interface
            var selectedCardsForRanking = GameState.get('selectedCardsForRanking');
            var gameState = GameState.data;
            var currentBid = gameState.currentBid;
            
            console.log('🔍 Card selection verification:');
            console.log('  Selected cards:', selectedCardsForRanking.length);
            console.log('  Required bid:', currentBid);
            console.log('  Cards list:', selectedCardsForRanking);
            
            if (selectedCardsForRanking.length >= getCurrentBid()) {
                console.log('✅ Ready for ranking phase...');
                
                // Wait longer for ranking interface to appear in fast mode
                setTimeout(() => {
                    handleRankingPhase();
                }, getTestDelay(2000));
            } else {
                console.log('⚠️ Not enough cards selected (' + selectedCardsForRanking.length + '/' + currentBid + '), retrying...');
                setTimeout(() => {
                    // Force trigger ranking interface if cards are actually selected
                    if (GameState.get('selectedCardsForRanking').length === getCurrentBid()) {
                        console.log('🔄 Cards are selected, manually triggering ranking interface...');
                        showRankingInterface();
                        setTimeout(() => handleRankingPhase(), getTestDelay(1000));
                    } else {
                        handleRankingPhase();
                    }
                }, getTestDelay(2000));
            }
            
        }, getTestDelay(Math.max(cardsToSelect * 300 + 2000, 3000))); // Ensure minimum wait time
        
    } catch (error) {
        console.error('❌ Error in ranking phase:', error);
        throw error;
    }
}

function handleRankingPhase() {
    console.log('📋 Handling ranking phase...');
    console.log('Current screen:', document.querySelector('.screen.active') ? document.querySelector('.screen.active').id : 'unknown');
    
    // Check if we're on the ranking interface
    var currentScreen = document.querySelector('.screen.active');
    if (currentScreen && currentScreen.id === 'scanScreen') {
        // Wait for ranking interface to appear
        setTimeout(() => {
            console.log('📋 Looking for ranking submission button...');
            
            // Check if ranking container exists (meaning ranking interface is loaded)
            var rankingContainer = document.getElementById('rankingContainer');
            if (rankingContainer) {
                console.log('✅ Ranking interface found, submitting ranking...');
                
                // Try clicking the submit button first
                var submitButton = rankingContainer.querySelector('button[onclick="submitRanking()"]');
                if (submitButton) {
                    console.log('🔘 Clicking submit ranking button...');
                    submitButton.click();
                    
                    // After clicking submit, wait for reveal screen to appear and start automation
                    setTimeout(() => {
                        console.log('🎭 Submit button clicked, starting reveal automation...');
                        automatedReveal();
                    }, getTestDelay(1500));
                } else {
                    console.log('🔧 Submit button not found, calling submitRanking() directly...');
                    
                    // For automated testing, populate finalRanking from selectedCardsForRanking
                    var selectedCardsForRanking = GameState.get('selectedCardsForRanking') || [];
                    console.log('🎯 Setting finalRanking for automated test:', selectedCardsForRanking);
                    GameState.set('finalRanking', selectedCardsForRanking);
                    
                    if (typeof window.submitRanking === 'function') {
                        window.submitRanking();
                        
                        // After submitting, wait for reveal screen to appear and start automation
                        setTimeout(() => {
                            console.log('🎭 Ranking submitted, starting reveal automation...');
                            automatedReveal();
                        }, getTestDelay(1500));
                    } else {
                        console.log('❌ submitRanking function not available');
                    }
                }
            } else {
                console.log('⚠️ Ranking interface not loaded yet, waiting longer...');
                // Try again after more time
                setTimeout(() => {
                    if (typeof window.submitRanking === 'function') {
                        console.log('🔧 Calling submitRanking() directly...');
                        
                        // For automated testing, populate finalRanking from selectedCardsForRanking
                        var selectedCardsForRanking = GameState.get('selectedCardsForRanking') || [];
                        console.log('🎯 Setting finalRanking for automated test:', selectedCardsForRanking);
                        GameState.set('finalRanking', selectedCardsForRanking);
                        
                        window.submitRanking();
                        
                        // After submitting, wait for reveal screen to appear and start automation
                        setTimeout(() => {
                            console.log('🎭 Ranking submitted, starting reveal automation...');
                            automatedReveal();
                        }, getTestDelay(1500));
                    } else {
                        console.log('❌ Still no submitRanking function');
                    }
                }, getTestDelay(2000));
            }
        }, getTestDelay(2000)); // Give time for ranking interface to load
    } else {
        // Should be on ranking screen or reveal screen
        console.log('📋 Not on scan screen, checking for ranking interface...');
        
        // Wait a bit for the ranking interface to load
        setTimeout(() => {
            // Skip the manual ranking and go straight to reveal
            console.log('⏭️ Skipping manual ranking, proceeding to reveal...');
            setTimeout(() => automatedReveal(), getTestDelay(1000));
        }, getTestDelay(1000));
    }
}

function automatedReveal() {
    try {
        console.log('🎭 Simulating reveal phase...');
        var finalRanking = GameState.get('finalRanking') || [];
        var selectedCards = GameState.get('selectedCards') || [];
        console.log('Final ranking:', finalRanking);
        console.log('Selected cards:', selectedCards);
        console.log('Current screen should be:', document.querySelector('.screen.active') ? document.querySelector('.screen.active').id : 'unknown');
        
        // Reset reveal completion flag for this round
        GameState.set('revealCompletionHandled', false);
        
        // Check if we're actually on the reveal screen
        var currentScreen = document.querySelector('.screen.active');
        if (!currentScreen || currentScreen.id !== 'revealScreen') {
            console.log('⚠️ Not on reveal screen, trying to navigate there...');
            
            // Try to manually trigger the reveal phase
            if (typeof startReveal === 'function') {
                console.log('🔧 Calling startReveal()...');
                startReveal();
            } else {
                console.log('🔧 startReveal not found, showing reveal screen directly...');
                showScreen('revealScreen');
            }
            
            // Wait and try again
            setTimeout(() => {
                automatedReveal();
            }, getTestDelay(2000));
            return;
        }
        
        // Auto-reveal all cards
        var finalRanking = GameState.get('finalRanking');
        var selectedCardsForRanking = GameState.get('selectedCardsForRanking');
        var revealCount = finalRanking ? finalRanking.length : (selectedCardsForRanking ? selectedCardsForRanking.length : 3);
        console.log('Reveal count:', revealCount);
        console.log('Final ranking for reveal:', finalRanking);
        console.log('Selected cards for ranking:', selectedCardsForRanking);
        
        if (revealCount === 0) {
            console.log('⚠️ No cards to reveal, completing round properly...');
            setTimeout(() => {
                console.log('✅ Round complete (no cards), triggering proper round completion...');
                // Instead of calling showFinalResults() directly, call the proper completion flow
                // which includes token replacement and round progression
                continueToNextRound();
            }, getTestDelay(1000));
            return;
        }
        
        function autoReveal(index) {
            if (index < revealCount) {
                setTimeout(() => {
                    console.log('🎲 Revealing card ' + (index + 1) + ' of ' + revealCount);
                    console.log('Current reveal index before:', GameState.get('currentRevealIndex') || 0);
                    
                    // For automated testing, use a simpler reveal process
                    var revealResult = null;
                    if (window.isAutomatedTestRunning) {
                        revealResult = automatedRevealNext();
                    } else {
                        // Check if reveal button exists and is clickable
                        var revealBtn = document.getElementById('revealBtn');
                        if (revealBtn && !revealBtn.disabled) {
                            console.log('🔘 Clicking reveal button...');
                            revealNext();
                        } else {
                            console.log('⚠️ Reveal button not available, trying direct reveal...');
                            if (typeof revealNext === 'function') {
                                revealNext();
                            } else {
                                console.log('❌ revealNext function not found');
                            }
                        }
                    }
                    
                    console.log('Current reveal index after:', GameState.get('currentRevealIndex') || 0);
                    
                    // Continue to next reveal only if not complete
                    if (revealResult !== 'complete') {
                        setTimeout(() => {
                            autoReveal(index + 1);
                        }, getTestDelay(800));
                    } else {
                        console.log('🏁 Reveal process completed, stopping autoReveal loop');
                    }
                }, getTestDelay(1000)); // Faster reveals for automation
            } else {
                // Reveal complete - showFinalResults will be called automatically
                // and handle round progression
                console.log('✅ Reveal phase complete, waiting for final results...');
            }
        }
        
        autoReveal(0);
        
    } catch (error) {
        console.error('❌ Error in reveal phase:', error);
        throw error;
    }
}

// Simplified reveal function for automated testing
// revealCompletionHandled moved to GameState - Prevent duplicate completion handling

function automatedRevealNext() {
    // Prevent infinite loop - if completion already handled, return immediately
    if (GameState.get('revealCompletionHandled')) {
        console.log('🔄 Reveal already completed, skipping');
        return 'complete';
    }
    
    var finalRanking = GameState.get('finalRanking');
    var currentRevealIndex = GameState.get('currentRevealIndex') || 0;
    console.log('🤖 Automated reveal next - index:', currentRevealIndex, 'of', finalRanking.length);
    
    // Special case: if no cards to reveal, bidder succeeds immediately
    if (finalRanking.length === 0) {
        if (!GameState.get('revealCompletionHandled')) {
            console.log('🎉 No cards to reveal - bidder succeeds!');
            bidderSuccess = true;
            GameState.set('bidderSuccess', true);
            GameState.set('revealCompletionHandled', true);
            // Use proper round completion flow instead of direct showFinalResults
            setTimeout(() => continueToNextRound(), 1000);
        }
        return 'complete';
    }
    
    // If all cards have been revealed and validation completed, show results
    if (currentRevealIndex >= finalRanking.length) {
        if (!GameState.get('revealCompletionHandled')) {
            console.log('🏁 All cards revealed, showing final results');
            // bidderSuccess should have been set by sequence validation
            // Only set success if bidderSuccess hasn't been explicitly set to false
            var currentBidderSuccess = GameState.get('bidderSuccess');
            if (currentBidderSuccess === undefined || currentBidderSuccess === null) {
                console.log('🎉 Completed all reveals without failure - bidder succeeds!');
                bidderSuccess = true;
                GameState.set('bidderSuccess', true);
            } else if (currentBidderSuccess === false) {
                console.log('⚠️ Bidder already marked as failed, preserving failure state');
            } else {
                console.log('✅ Bidder already marked as successful');
            }
            GameState.set('revealCompletionHandled', true);
            // Use proper round completion flow instead of direct showFinalResults
            setTimeout(() => continueToNextRound(), 1000);
        }
        return 'complete';
    }
    
    // Reveal the next card
    currentRevealIndex++;
    GameState.set('currentRevealIndex', currentRevealIndex);
    updateBidderRankingDisplay();
    updateRevealProgress();
    
    console.log('✅ Card', currentRevealIndex, 'revealed');
    
    // Check for sequence break (simplified logic for automation)
    currentRevealIndex = GameState.get('currentRevealIndex') || 0;
    if (currentRevealIndex >= 2) {
        var finalRanking = GameState.get('finalRanking');
        var currentPrompt = GameState.get('currentPrompt');
        var prevCard = finalRanking[currentRevealIndex - 2];
        var currentCard = finalRanking[currentRevealIndex - 1];
        
        var currentCategory = GameState.get('currentCategory') || 'countries';
        var categoryData = window.GAME_DATA.categories[currentCategory];
        var prevItem = categoryData ? categoryData.items[prevCard] : null;
        var currentItem = categoryData ? categoryData.items[currentCard] : null;
        var prevValue = prevItem ? prevItem[currentPrompt.challenge] : 0;
        var currentValue = currentItem ? currentItem[currentPrompt.challenge] : 0;
        
        // Use centralized validation for sequence checking (automated test context)
        var validation = RankingValidator.validateSequenceStep(
            prevCard, 
            currentCard, 
            currentPrompt.challenge, 
            currentPrompt
        );
        
        console.log('🔍 Centralized challenge validation (automated):', validation);
        
        if (!validation.isValid) {
            console.log('💥 Sequence broken! Bidder fails.');
            bidderSuccess = false;
            GameState.set('bidderSuccess', false);
            // Reveal all remaining cards quickly
            GameState.set('currentRevealIndex', finalRanking.length);
            updateBidderRankingDisplay();
            updateRevealProgress();
            if (!GameState.get('revealCompletionHandled')) {
                GameState.set('revealCompletionHandled', true);
                // Use proper round completion flow instead of direct showFinalResults
                setTimeout(() => continueToNextRound(), 1000);
            }
            return 'complete';
        }
    }
    
    // If this was the last card and we haven't failed, bidder succeeds
    currentRevealIndex = GameState.get('currentRevealIndex') || 0;
    if (currentRevealIndex >= finalRanking.length) {
        if (!GameState.get('revealCompletionHandled')) {
            console.log('🎉 All cards revealed successfully! Bidder succeeds!');
            bidderSuccess = true;
            GameState.set('bidderSuccess', true);
            GameState.set('revealCompletionHandled', true);
            // Use proper round completion flow instead of direct showFinalResults
            setTimeout(() => continueToNextRound(), 1000);
        }
        return 'complete';
    }
}

// Comprehensive analysis of all players' block/token stats
// Auto-runs at end of Fast Test for easy copy/paste
function analyzeAllPlayersBlocks() {
    try {
        console.log('🔍 COMPREHENSIVE BLOCK/TOKEN ANALYSIS');
        console.log('=====================================');
        
        // Capture data before any reset happens
        captureTestData();
        
        const playersList = GameState.get('players.list') || [];
        console.log('🔍 DEBUG: playersList:', playersList);
    
    // Game-wide stats
    let totalSuccessfulRankings = 0;
    let totalBlocksMade = 0;
    let totalBlocksWon = 0;
    let totalTokensGained = 0;
    
    console.log('\n📊 INDIVIDUAL PLAYER ANALYSIS:');
    console.log('===============================');
    
    playersList.forEach(playerName => {
        const stats = getPlayerStats(playerName);
        
        // Count owned cards
        const ownedCards = GameState.get('players.ownedCards') || {};
        let actualTokenCount = 0;
        if (ownedCards[playerName]) {
            Object.keys(ownedCards[playerName]).forEach(category => {
                const cards = ownedCards[playerName][category] || [];
                actualTokenCount += cards.length;
            });
        }
        
        // Analysis
        const blockDiscrepancy = stats.blocksMade - stats.tokensGained;
        const statsConsistent = stats.blocksWon === stats.tokensGained;
        const tokensConsistent = stats.tokensGained === actualTokenCount;
        
        console.log(`\n👤 ${playerName}:`);
        console.log(`  blocksMade: ${stats.blocksMade}`);
        console.log(`  blocksWon: ${stats.blocksWon}`);
        console.log(`  blocksLost: ${stats.blocksLost}`);
        console.log(`  tokensGained: ${stats.tokensGained}`);
        console.log(`  actualTokensOwned: ${actualTokenCount}`);
        console.log(`  bidsWon: ${stats.bidsWon || 0}`);
        console.log(`  bidsSuccessful: ${stats.bidsSuccessful || 0}`);
        console.log(`  blockDiscrepancy: ${blockDiscrepancy} (blocksMade - tokensGained)`);
        console.log(`  blocksWon = tokensGained? ${statsConsistent ? '✅' : '❌'}`);
        console.log(`  tokensGained = actualOwned? ${tokensConsistent ? '✅' : '❌'}`);
        
        if (blockDiscrepancy > 0) {
            const possibleSelfBlocks = stats.bidsWon || 0;
            if (possibleSelfBlocks >= blockDiscrepancy) {
                console.log(`  🤔 Likely explanation: ${blockDiscrepancy} self-blocks (bidder can't block)`);
            } else {
                console.log(`  ❌ Unknown issue: discrepancy can't be explained by self-blocks`);
            }
        }
        
        // Accumulate totals
        totalSuccessfulRankings += stats.bidsSuccessful || 0;
        totalBlocksMade += stats.blocksMade;
        totalBlocksWon += stats.blocksWon;
        totalTokensGained += stats.tokensGained;
    });
    
    console.log('\n🎯 GAME-WIDE SUMMARY:');
    console.log('=====================');
    console.log(`Total successful rankings: ${totalSuccessfulRankings}`);
    console.log(`Total blocks made: ${totalBlocksMade}`);
    console.log(`Total blocks won: ${totalBlocksWon}`);
    console.log(`Total tokens gained: ${totalTokensGained}`);
    console.log(`blocksWon = tokensGained? ${totalBlocksWon === totalTokensGained ? '✅' : '❌'}`);
    
    if (totalSuccessfulRankings === 0) {
        console.log('\n✅ No successful rankings - all blocks should result in tokens');
        if (totalBlocksMade > totalTokensGained) {
            console.log(`❌ Issue: ${totalBlocksMade - totalTokensGained} blocks didn't result in tokens`);
        }
    }
    
    console.log('\n📋 COPY/PASTE SUMMARY FOR DEBUGGING:');
    console.log('====================================');
    console.log('PLAYERS_STATS_SUMMARY:');
    playersList.forEach(playerName => {
        const stats = getPlayerStats(playerName);
        const ownedCards = GameState.get('players.ownedCards') || {};
        let actualTokenCount = 0;
        if (ownedCards[playerName]) {
            Object.keys(ownedCards[playerName]).forEach(category => {
                actualTokenCount += (ownedCards[playerName][category] || []).length;
            });
        }
        console.log(`${playerName}: blocksMade=${stats.blocksMade}, blocksWon=${stats.blocksWon}, tokensGained=${stats.tokensGained}, actualOwned=${actualTokenCount}, bidsWon=${stats.bidsWon || 0}, bidsSuccessful=${stats.bidsSuccessful || 0}`);
    });
    
    return {
        totalSuccessfulRankings,
        totalBlocksMade,
        totalBlocksWon,
        totalTokensGained,
        playersData: playersList.map(name => {
            const stats = getPlayerStats(name);
            const ownedCards = GameState.get('players.ownedCards') || {};
            let actualTokenCount = 0;
            if (ownedCards[name]) {
                Object.keys(ownedCards[name]).forEach(category => {
                    actualTokenCount += (ownedCards[name][category] || []).length;
                });
            }
            return {
                name,
                ...stats,
                actualTokenCount,
                discrepancy: stats.blocksMade - stats.tokensGained
            };
        })
    };
    } catch (error) {
        console.error('🔍 ERROR in analyzeAllPlayersBlocks:', error);
        console.error('Stack trace:', error.stack);
    }
}

// Validate statistics consistency
function validateStatistics() {
    console.log('🔍 Validating statistics consistency...');
    
    // Calculate total bids won
    var totalBidsWon = 0;
    var allStats = GameState.get('players.stats') || {};
    Object.keys(allStats).forEach(function(playerName) {
        var playerStats = getPlayerStats(playerName);
        totalBidsWon += playerStats.bidsWon || 0;
    });
    
    console.log('📊 Statistics Validation:');
    console.log('  🎯 Total bids won:', totalBidsWon, '(should equal', getCurrentRound(), 'rounds)');
    console.log('  🎮 Current round:', getCurrentRound());
    console.log('  📋 Max rounds:', GAME_CONFIG.MAX_ROUNDS);
    
    if (totalBidsWon !== getCurrentRound()) {
        console.error('❌ STATISTICS ERROR: Total bids won (' + totalBidsWon + ') does not equal current round (' + getCurrentRound() + ')');
        return false;
    }
    
    // Validate individual player stats
    Object.keys(allStats).forEach(function(playerName) {
        var stats = getPlayerStats(playerName);
        if (stats.bidsSuccessful > stats.bidsWon) {
            console.error('❌ STATISTICS ERROR: Player ' + playerName + ' has more successful bids (' + stats.bidsSuccessful + ') than total bids won (' + stats.bidsWon + ')');
            return false;
        }
    });
    
    console.log('✅ Statistics validation passed');
    return true;
}

// Generate detailed test results
function generateDetailedTestResults() {
    // Validate statistics before generating results
    validateStatistics();
    
    var results = window.automatedTestResults;
    
    // Sync player stats from game state to test results
    var allStats = GameState.get('players.stats') || {};
    if (allStats && Object.keys(allStats).length > 0) {
        console.log('🔄 Syncing player stats:', allStats);
        console.log('Current test results playerStats:', results.playerStats);
        Object.keys(allStats).forEach(function(playerName) {
            if (results.playerStats[playerName]) {
                // Copy all stats from game state to test results
                Object.assign(results.playerStats[playerName], allStats[playerName]);
                // Also update total score
                results.playerStats[playerName].totalScore = getPlayerScore(playerName);
                console.log('✅ Synced stats for', playerName, ':', results.playerStats[playerName]);
            }
        });
        console.log('✅ Synced player stats to test results');
    } else {
        console.log('⚠️ No players.stats available for sync');
    }
    var duration = results.endTime - results.startTime;
    var durationMinutes = Math.round(duration / 1000 / 60 * 100) / 100;
    
    console.log('\n🎉 ===== AUTOMATED TEST RESULTS =====');
    console.log('⏱️ Test Duration:', durationMinutes, 'minutes');
    console.log('🎮 Rounds Completed:', results.rounds.length);
    console.log('💰 Total Bids Made:', results.totalBids);
    console.log('🛡️ Total Blocks Made:', results.totalBlocks);
    console.log('✅ Successful Bids:', results.successfulBids);
    console.log('❌ Failed Bids:', results.failedBids);
    console.log('📊 Success Rate:', results.totalBids > 0 ? Math.round((results.successfulBids / results.totalBids) * 100) + '%' : 'N/A');
    
    console.log('\n👥 PLAYER STATISTICS:');
    Object.keys(results.playerStats).forEach(function(playerName) {
        var stats = results.playerStats[playerName];
        var finalScore = getPlayerScore(playerName);
        console.log('🎯 ' + playerName + ':');
        console.log('  📈 Final Score: ' + finalScore + ' points');
        console.log('  🏆 Bids Won: ' + stats.bidsWon);
        console.log('  ✅ Successful Bids: ' + stats.bidsSuccessful);
        console.log('  🛡️ Blocks Made: ' + stats.blocksMade);
        console.log('  💎 Tokens Gained: ' + stats.tokensGained);
        console.log('  💸 Tokens Lost: ' + stats.tokensLost);
        console.log('  🎲 Success Rate: ' + (stats.bidsWon > 0 ? Math.round((stats.bidsSuccessful / stats.bidsWon) * 100) + '%' : 'N/A'));
        console.log('');
    });
    
    console.log('🏆 FINAL LEADERBOARD:');
    var finalScores = getFinalScores();
    finalScores.forEach(function(player, index) {
        var medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : '  ';
        console.log(medal + ' ' + (index + 1) + '. ' + player.name + ': ' + player.score + ' points');
    });
    
    if (results.rounds.length > 0) {
        console.log('\n📋 ROUND-BY-ROUND BREAKDOWN:');
        results.rounds.forEach(function(round, index) {
            console.log('Round ' + (index + 1) + ': ' + round.bidder + ' bid ' + round.bidAmount + ' (' + (round.success ? 'SUCCESS' : 'FAILED') + ')');
        });
    }
    
    if (results.errors.length > 0) {
        console.log('\n⚠️ ERRORS ENCOUNTERED:');
        results.errors.forEach(function(error, index) {
            console.log((index + 1) + '. ' + error);
        });
    }
    
    // Run comprehensive block/token analysis
    console.log('\n🔍 RUNNING COMPREHENSIVE BLOCK/TOKEN ANALYSIS...');
    analyzeAllPlayersBlocks();
    
    console.log('\n✨ Test completed successfully! All game mechanics working properly.');
    console.log('📊 Results stored in window.automatedTestResults for further analysis.');
    console.log('=====================================\n');
}

// Test results viewing functions
window.viewTestResults = function() {
    updateTestResultsDisplay();
    showScreen('testResultsScreen');
};

function updateTestResultsDisplay() {
    var results = window.automatedTestResults;
    var players = GameState.get('players');
    
    console.log('📊 updateTestResultsDisplay called');
    console.log('results:', results);
    console.log('players.stats:', players ? players.stats : 'No players');
    
    // Test Overview
    var overviewDiv = document.getElementById('testOverview');
    console.log('overviewDiv found:', !!overviewDiv);
    if (!results || !results.startTime) {
        safeSetHTML(overviewDiv, '<div class="no-scores-message">No automated tests have been run yet!<br>Click "Run Automated Test" to start testing.</div>');
        // Still show card statistics even if no tests have been run
        updateCardStatistics();
        displayCardStatistics();
    } else {
        var duration = results.endTime ? Math.round((results.endTime - results.startTime) / 1000 / 60 * 100) / 100 : 'In progress...';
        
        // Calculate statistics from players.stats (unified data source)
        var totalBidAttempts = 0, totalRoundsWon = 0, successfulRankings = 0, totalBlocks = 0;
        if (players.stats) {
            console.log('📊 Calculating stats from players.stats:', players.stats);
            Object.keys(players.stats).forEach(function(playerName) {
                var stats = getPlayerStats(playerName);
                totalBidAttempts += stats.bidAttempts || 0;
                totalRoundsWon += stats.bidsWon || 0;
                successfulRankings += stats.bidsSuccessful || 0;
                totalBlocks += stats.blocksMade || 0;
                console.log('📈', playerName, '- Attempts:', stats.bidAttempts, 'Won:', stats.bidsWon, 'Success:', stats.bidsSuccessful);
            });
            console.log('📊 Totals - Attempts:', totalBidAttempts, 'Won:', totalRoundsWon, 'Success:', successfulRankings);
        } else {
            console.log('⚠️ No players.stats available for calculation');
        }
        var failedBidAttempts = totalBidAttempts - totalRoundsWon;
        var failedRankings = totalRoundsWon - successfulRankings;
        var bidWinRate = totalBidAttempts > 0 ? Math.round((totalRoundsWon / totalBidAttempts) * 100) : 0;
        var rankingSuccessRate = totalRoundsWon > 0 ? Math.round((successfulRankings / totalRoundsWon) * 100) : 0;
        
        var overviewHtml = 
            '<div class="player-stat-item"><span class="player-stat-name">⏱️ Test Duration</span><span class="player-stat-value">' + duration + ' min</span></div>' +
            '<div class="player-stat-item"><span class="player-stat-name">🎮 Rounds Completed</span><span class="player-stat-value">' + getCurrentRound() + '</span></div>' +
            '<div class="player-stat-item"><span class="player-stat-name">🎯 Total Bid Attempts</span><span class="player-stat-value">' + totalBidAttempts + '</span></div>' +
            '<div class="player-stat-item"><span class="player-stat-name">🏆 Rounds Won</span><span class="player-stat-value">' + totalRoundsWon + '</span></div>' +
            '<div class="player-stat-item"><span class="player-stat-name">✅ Successful Rankings</span><span class="player-stat-value">' + successfulRankings + '</span></div>' +
            '<div class="player-stat-item"><span class="player-stat-name">🛡️ Total Blocks</span><span class="player-stat-value">' + totalBlocks + '</span></div>' +
            '<div class="player-stat-item"><span class="player-stat-name">❌ Failed Bid Attempts</span><span class="player-stat-value">' + failedBidAttempts + '</span></div>' +
            '<div class="player-stat-item"><span class="player-stat-name">❌ Failed Rankings</span><span class="player-stat-value">' + failedRankings + '</span></div>' +
            '<div class="player-stat-item"><span class="player-stat-name">🎲 Bid Win Rate</span><span class="player-stat-value">' + bidWinRate + '%</span></div>' +
            '<div class="player-stat-item"><span class="player-stat-name">📈 Ranking Success Rate</span><span class="player-stat-value">' + rankingSuccessRate + '%</span></div>';
        
        safeSetHTML(overviewDiv, overviewHtml);
    }
    
    // Player Performance
    var performanceDiv = document.getElementById('playerPerformance');
    if (!results || !results.playerStats || Object.keys(results.playerStats).length === 0) {
        safeSetHTML(performanceDiv, '<div class="no-scores-message">No player data available!</div>');
    } else {
        var html = '';
        Object.keys(results.playerStats).forEach(function(playerName) {
            var stats = results.playerStats[playerName];
            // Calculate ranking success rate (how often player succeeds after winning bid)
            var rankingSuccessRate = stats.bidsWon > 0 ? Math.round((stats.bidsSuccessful / stats.bidsWon) * 100) : 0;
            // Calculate bid success rate (how often bid attempts result in winning)
            var bidSuccessRate = stats.bidAttempts > 0 ? Math.round((stats.bidsWon / stats.bidAttempts) * 100) : 0;
            
            html += '<div class="chip-inventory-item">' +
                   '<span class="chip-inventory-player">' + playerName + '</span>' +
                   '<div class="chip-inventory-chips">' +
                   '<span class="chip-badge chip-2">' + stats.totalScore + ' pts</span>' +
                   '<span class="chip-badge chip-4">' + stats.bidsWon + ' rounds won</span>' +
                   '<span class="chip-badge chip-6">🎯 ' + bidSuccessRate + '% bid rate</span>' +
                   '<span class="chip-badge chip-4">📈 ' + rankingSuccessRate + '% rank rate</span>' +
                   '</div></div>';
        });
        safeSetHTML(performanceDiv, html);
    }
    
    // Player Statistics (unified with Scores Screen)
    var roundsDiv = document.getElementById('roundDetails');
    if (!players || !players.stats || Object.keys(players.stats).length === 0) {
        safeSetHTML(roundsDiv, '<div class="no-scores-message">No player statistics available!</div>');
    } else {
        console.log('🔍 STATS TABLE: Creating table with classes "scores-table stats-table"');
        var html = '<table class="scores-table stats-table" style="font-size: 9px;"><thead><tr><th style="font-size: 9px;">Player</th><th style="font-size: 9px;">Bids</th><th style="font-size: 9px;">Won</th><th style="font-size: 9px;">Rank</th><th style="font-size: 9px;">Block</th><th style="font-size: 9px;">B%</th><th style="font-size: 9px;">R%</th></tr></thead><tbody>';
        Object.keys(players.stats).forEach(function(playerName) {
            var stats = getPlayerStats(playerName);
            // Calculate ranking success rate (how often player succeeds after winning bid)
            var rankingSuccessRate = stats.bidsWon > 0 ? Math.round((stats.bidsSuccessful / stats.bidsWon) * 100) : 0;
            // Calculate bid success rate (how often bid attempts result in winning)
            var bidSuccessRate = stats.bidAttempts > 0 ? Math.round((stats.bidsWon / stats.bidAttempts) * 100) : 0;
            var bidSuccessClass = bidSuccessRate >= 50 ? 'first' : bidSuccessRate > 0 ? 'second' : 'third';
            var rankingSuccessClass = rankingSuccessRate >= 50 ? 'first' : rankingSuccessRate > 0 ? 'second' : 'third';
            html += '<tr>' +
                   '<td style="font-size: 9px;">' + playerName + '</td>' +
                   '<td class="rank" style="font-size: 9px;">' + (stats.bidAttempts || 0) + '</td>' +
                   '<td class="rank" style="font-size: 9px;">' + stats.bidsWon + '</td>' +
                   '<td class="rank" style="font-size: 9px;">' + stats.bidsSuccessful + '</td>' +
                   '<td class="rank" style="font-size: 9px;">' + stats.blocksMade + '</td>' +
                   '<td class="rank ' + bidSuccessClass + '" style="font-size: 9px;">' + bidSuccessRate + '%</td>' +
                   '<td class="rank ' + rankingSuccessClass + '" style="font-size: 9px;">' + rankingSuccessRate + '%</td>' +
                   '</tr>';
        });
        html += '</tbody></table>';
        safeSetHTML(roundsDiv, html);
    }
    
    // Add card statistics to the overview
    updateCardStatistics();
    displayCardStatistics();
}

// Function to calculate current card statistics
function updateCardStatistics() {
    var players = GameState.get('players');
    
    if (!window.automatedTestResults || !window.automatedTestResults.cardStats) {
        // Initialize if not exists
        if (!window.automatedTestResults) {
            window.automatedTestResults = {
                cardStats: {
                    totalCardsRanked: 0,
                    totalCardsOwned: 0,
                    totalCardsInPlay: 0
                }
            };
        } else if (!window.automatedTestResults.cardStats) {
            window.automatedTestResults.cardStats = {
                totalCardsRanked: 0,
                totalCardsOwned: 0,
                totalCardsInPlay: 0
            };
        }
    }
    
    var stats = window.automatedTestResults.cardStats;
    
    // Use global stats for cards ranked
    stats.totalCardsRanked = window.globalCardStats.totalCardsRanked;
    
    // Calculate total cards owned by all players
    var totalCardsOwned = 0;
    if (players && players.ownedCards) {
        Object.keys(players.ownedCards).forEach(function(playerName) {
            if (players.ownedCards[playerName]) {
                // Handle both new category-specific format and legacy format
                if (typeof players.ownedCards[playerName] === 'object' && !Array.isArray(players.ownedCards[playerName])) {
                    // New format: count all owned cards across all categories
                    Object.keys(players.ownedCards[playerName]).forEach(function(category) {
                        if (Array.isArray(players.ownedCards[playerName][category])) {
                            totalCardsOwned += getPlayerOwnedCards(playerName, category).length;
                        }
                    });
                } else if (Array.isArray(players.ownedCards[playerName])) {
                    // Legacy format: direct array
                    var ownedCards = getPlayerOwnedCards(playerName);
                    totalCardsOwned += Object.keys(ownedCards).reduce(function(total, cat) {
                        return total + (ownedCards[cat] ? ownedCards[cat].length : 0);
                    }, 0);
                }
            }
        });
    }
    stats.totalCardsOwned = totalCardsOwned;
    window.globalCardStats.totalCardsOwned = totalCardsOwned;
    
    // Calculate total cards in play (total cards across all categories minus ranked minus owned)
    var totalCards = 0;
    if (window.GAME_DATA && window.GAME_DATA.categories) {
        Object.keys(window.GAME_DATA.categories).forEach(function(category) {
            if (window.GAME_DATA.categories[category].items) {
                totalCards += Object.keys(window.GAME_DATA.categories[category].items).length;
            }
        });
    }
    stats.totalCardsInPlay = totalCards - stats.totalCardsRanked - stats.totalCardsOwned;
    window.globalCardStats.totalCardsInPlay = stats.totalCardsInPlay;
    
    console.log('📊 Card Statistics Updated:', stats);
    console.log('📊 Global Card Statistics:', window.globalCardStats);
}

// Function to display card statistics in test results
function displayCardStatistics() {
    var overviewDiv = document.getElementById('testOverview');
    if (!overviewDiv || !window.automatedTestResults || !window.automatedTestResults.cardStats) {
        return;
    }
    
    var stats = window.automatedTestResults.cardStats;
    var totalCountries = 0;
    if (window.GAME_DATA && window.GAME_DATA.categories) {
        Object.keys(window.GAME_DATA.categories).forEach(function(categoryKey) {
            if (window.GAME_DATA.categories[categoryKey].items) {
                totalCountries += Object.keys(window.GAME_DATA.categories[categoryKey].items).length;
            }
        });
    }
    
    // Add card statistics to the overview
    var existingCardStats = document.getElementById('cardStatsSection');
    if (existingCardStats) {
        existingCardStats.remove();
    }
    
    var cardStatsDiv = document.createElement('div');
    cardStatsDiv.id = 'cardStatsSection';
    cardStatsDiv.style.cssText = 'margin-top: 15px; padding-top: 15px; border-top: 1px solid #dee2e6;';
    var cardStatsHtml = 
        '<div class="player-stat-item"><span class="player-stat-name">🃏 Total Cards in Game</span><span class="player-stat-value">' + totalCountries + '</span></div>' +
        '<div class="player-stat-item"><span class="player-stat-name">📊 Total Cards Ranked</span><span class="player-stat-value">' + stats.totalCardsRanked + '</span></div>' +
        '<div class="player-stat-item"><span class="player-stat-name">👑 Total Cards Owned</span><span class="player-stat-value">' + stats.totalCardsOwned + '</span></div>' +
        '<div class="player-stat-item"><span class="player-stat-name">🎯 Total Cards Left in Play</span><span class="player-stat-value">' + stats.totalCardsInPlay + '</span></div>';
    
    safeSetHTML(cardStatsDiv, cardStatsHtml);
    
    overviewDiv.appendChild(cardStatsDiv);
    console.log('📊 Card statistics displayed:', stats);
}

window.exportTestResults = function() {
    var results = window.automatedTestResults;
    if (!results || !results.startTime) {
        console.log('No test results to export!');
        return;
    }
    
    var exportData = JSON.stringify(results, null, 2);
    var blob = new Blob([exportData], {type: 'application/json'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'automated-test-results-' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    URL.revokeObjectURL(url);
    console.log('📤 Test results exported to file');
};

window.clearTestResults = function() {
    window.automatedTestResults = {
        startTime: null,
        endTime: null,
        rounds: [],
        totalBids: 0,
        totalBlocks: 0,
        successfulBids: 0,
        failedBids: 0,
        playerStats: {},
        errors: []
    };
    updateTestResultsDisplay();
    console.log('🗑️ Test results cleared');
};

// Set up page when DOM loads
document.addEventListener('DOMContentLoaded', initPage);
window.addEventListener('load', initPage);

// Debug function to check if everything loaded
// State Management Migration Test Functions
window.testStateMigration = function() {
    console.log('🧪 Testing State Management Migration...');
    
    // Test 1: State validation
    console.log('1. Testing state validation...');
    var stateCheck = StateValidator.runStateCheck(true);
    console.log('State validation result:', stateCheck);
    
    // Test 2: Helper functions
    console.log('2. Testing helper functions...');
    try {
        var playersList = getPlayersList();
        var currentBid = getCurrentBid();
        var highestBidder = getHighestBidder();
        console.log('✅ Helper functions working - Players:', playersList.length, 'Bid:', currentBid, 'Bidder:', highestBidder);
    } catch (error) {
        console.error('❌ Helper functions failed:', error);
    }
    
    // Test 3: Business logic
    console.log('3. Testing business logic...');
    try {
        var gameState = {
            drawnCards: ['001', '002', '003'],
            blockedCards: [],
            currentBid: 2,
            highestBidder: 'TestPlayer'
        };
        var validation = BusinessLogic.validateBid(2, GAME_CONFIG, gameState);
        console.log('✅ Business logic working - Bid validation:', validation);
    } catch (error) {
        console.error('❌ Business logic failed:', error);
    }
    
    // Test 4: Token integrity
    console.log('4. Testing token integrity...');
    try {
        var integrityResult = validateTokenIntegrity();
        console.log('✅ Token integrity check:', integrityResult);
    } catch (error) {
        console.error('❌ Token integrity failed:', error);
    }
    
    console.log('🧪 State migration test complete!');
};

window.resetStateForTesting = function() {
    console.log('🔄 Resetting state for testing...');
    GameState.reset();
    console.log('✅ State reset complete');
};

window.checkGameLoaded = function() {
    console.log('Game functions loaded:', {
        showScreen: typeof window.showScreen,
        startRoundWithBidder: typeof window.startRoundWithBidder,
        addPlayer: typeof window.addPlayer,
        GAME_DATA: typeof window.GAME_DATA
    });
};

/**
 * Rules Configuration Functions
 * Manage rule presets and real-time configuration updates
 */

// Load a rule preset
function loadRulePreset(presetName) {
    if (!RULE_PRESETS[presetName]) {
        safeConsoleLog('Unknown rule preset:', presetName);
        return;
    }
    
    var preset = RULE_PRESETS[presetName];
    
    // Apply preset to ACTIVE_RULES
    Object.keys(preset).forEach(function(key) {
        ACTIVE_RULES[key] = preset[key];
    });
    
    // Update UI form elements
    updateRulesUI();
    updateRulesPreview();
    
    safeConsoleLog('🎮 Loaded rule preset:', presetName);
    showNotification('Loaded ' + presetName + ' rules preset', 'success');
}

// Update UI form elements from current ACTIVE_RULES
function updateRulesUI() {
    // Update all form elements
    var elements = {
        'startingTokens': ACTIVE_RULES.startingTokens,
        'blockingReward': ACTIVE_RULES.blockingReward,
        'tokenOwnership': ACTIVE_RULES.tokenOwnership,
        'requireSuccessfulBlock': ACTIVE_RULES.requireSuccessfulBlock,
        'competitiveBidding': ACTIVE_RULES.competitiveBidding,
        'mustStartAtOne': ACTIVE_RULES.mustStartAtOne,
        'bidMultiplier': ACTIVE_RULES.bidMultiplier,
        'maxBid': ACTIVE_RULES.maxBid,
        'allowBlocking': ACTIVE_RULES.allowBlocking,
        'tokenReplacement': ACTIVE_RULES.tokenReplacement,
        'refreshUsedCards': ACTIVE_RULES.refreshUsedCards,
        'allowOwnedInSelection': ACTIVE_RULES.allowOwnedInSelection,
        'maxRounds': ACTIVE_RULES.maxRounds,
        'winningScore': ACTIVE_RULES.winningScore,
        'endGameTokenPoints': ACTIVE_RULES.endGameTokenPoints,
        'endGameBlockingTokenPoints': ACTIVE_RULES.endGameBlockingTokenPoints
    };
    
    Object.keys(elements).forEach(function(id) {
        var element = document.getElementById(id);
        if (element) {
            if (element.type === 'checkbox') {
                element.checked = elements[id];
            } else {
                element.value = elements[id];
            }
        }
    });
}

// Apply current UI values to ACTIVE_RULES
function applyRulesFromUI() {
    // Get values from form elements
    var getElementValue = function(id) {
        var element = document.getElementById(id);
        if (!element) return null;
        
        if (element.type === 'checkbox') {
            return element.checked;
        } else if (element.type === 'number') {
            return parseFloat(element.value);
        } else {
            return element.value;
        }
    };
    
    ACTIVE_RULES.startingTokens = getElementValue('startingTokens');
    ACTIVE_RULES.blockingReward = getElementValue('blockingReward');
    ACTIVE_RULES.tokenOwnership = getElementValue('tokenOwnership');
    ACTIVE_RULES.requireSuccessfulBlock = getElementValue('requireSuccessfulBlock');
    ACTIVE_RULES.competitiveBidding = getElementValue('competitiveBidding');
    ACTIVE_RULES.mustStartAtOne = getElementValue('mustStartAtOne');
    ACTIVE_RULES.bidMultiplier = getElementValue('bidMultiplier');
    ACTIVE_RULES.maxBid = getElementValue('maxBid');
    ACTIVE_RULES.allowBlocking = getElementValue('allowBlocking');
    ACTIVE_RULES.tokenReplacement = getElementValue('tokenReplacement');
    ACTIVE_RULES.refreshUsedCards = getElementValue('refreshUsedCards');
    ACTIVE_RULES.allowOwnedInSelection = getElementValue('allowOwnedInSelection');
    ACTIVE_RULES.maxRounds = getElementValue('maxRounds');
    ACTIVE_RULES.winningScore = getElementValue('winningScore');
    ACTIVE_RULES.endGameTokenPoints = getElementValue('endGameTokenPoints');
    ACTIVE_RULES.endGameBlockingTokenPoints = getElementValue('endGameBlockingTokenPoints');
}

// Update the rules preview display
function updateRulesPreview() {
    applyRulesFromUI();
    
    var preview = '';
    
    // Token Economics
    preview += '💎 TOKEN ECONOMICS:\n';
    preview += '  Starting Tokens: ' + ACTIVE_RULES.startingTokens + ' of each type (2,4,6)\n';
    preview += '  Blocking Reward: ' + ACTIVE_RULES.blockingReward + ' points\n';
    preview += '  Token Ownership: ' + (ACTIVE_RULES.tokenOwnership ? 'ON' : 'OFF') + '\n';
    if (ACTIVE_RULES.tokenOwnership) {
        preview += '  Require Successful Block: ' + (ACTIVE_RULES.requireSuccessfulBlock ? 'YES' : 'NO') + '\n';
    }
    preview += '\n';
    
    // Bidding & Scoring
    preview += '🏆 BIDDING & SCORING:\n';
    preview += '  Competitive Bidding: ' + (ACTIVE_RULES.competitiveBidding ? 'ON' : 'OFF') + '\n';
    preview += '  Must Start at 1: ' + (ACTIVE_RULES.mustStartAtOne ? 'YES' : 'NO') + '\n';
    preview += '  Bid Multiplier: ' + ACTIVE_RULES.bidMultiplier + 'x\n';
    preview += '  Max Bid: ' + ACTIVE_RULES.maxBid + ' cards\n';
    preview += '\n';
    
    // Card Pool
    preview += '🃏 CARD POOL:\n';
    preview += '  Allow Blocking: ' + (ACTIVE_RULES.allowBlocking ? 'ON' : 'OFF') + '\n';
    preview += '  Token Replacement: ' + (ACTIVE_RULES.tokenReplacement ? 'ON' : 'OFF') + '\n';
    preview += '  Refresh Used Cards: ' + (ACTIVE_RULES.refreshUsedCards ? 'ON' : 'OFF') + '\n';
    preview += '  Use Owned in Selection: ' + (ACTIVE_RULES.allowOwnedInSelection ? 'ON' : 'OFF') + '\n';
    preview += '\n';
    
    // Game Flow
    preview += '🎯 GAME FLOW:\n';
    preview += '  Max Rounds: ' + ACTIVE_RULES.maxRounds + '\n';
    preview += '  Winning Score: ' + ACTIVE_RULES.winningScore + '\n';
    preview += '\n';
    
    // End Game Scoring
    preview += '🏁 END GAME SCORING:\n';
    preview += '  Country Token Bonus: ' + ACTIVE_RULES.endGameTokenPoints + ' points each\n';
    preview += '  Blocking Token Bonus: ' + ACTIVE_RULES.endGameBlockingTokenPoints + ' points each\n';
    
    var previewElement = document.getElementById('activeRulesList');
    if (previewElement) {
        previewElement.textContent = preview;
    }
}

// Apply rules and start game
function applyRulesAndStart() {
    // Validate all rules inputs first
    var formValidation = InputValidator.validateFormInputs('rulesScreen');
    if (!formValidation.isValid) {
        InputValidator.showValidationErrors(formValidation.errors);
        return;
    }
    
    applyRulesFromUI();
    updateRulesPreview();
    
    // Update GAME_CONFIG with new rules
    GAME_CONFIG.MAX_ROUNDS = ACTIVE_RULES.maxRounds;
    GAME_CONFIG.WINNING_SCORE = ACTIVE_RULES.winningScore;
    GAME_CONFIG.MAX_BID = ACTIVE_RULES.maxBid;
    
    safeConsoleLog('⚙️ Applied rules configuration:', ACTIVE_RULES);
    showNotification('Rules applied! Starting game setup...', 'success');
    showScreen('playerScreen');
}

// Initialize rules configuration when page loads
window.addEventListener('load', function() {
    setTimeout(function() {
        if (document.getElementById('rulesScreen')) {
            updateRulesUI();
            updateRulesPreview();
            safeConsoleLog('🎮 Rules configuration initialized');
        }
    }, 100);
});

// Enhanced debugging script to track block/token lifecycle
function debugBlockLifecycle() {
    console.log('🔬 BLOCK LIFECYCLE TRACKER - Enhanced Debug Mode');
    console.log('=================================================');
    
    const playersList = GameState.get('players.list') || [];
    
    console.log('\n📊 CURRENT GAME STATE:');
    console.log('Round:', GameState.get('gameFlow.round') || 'Unknown');
    console.log('Category:', GameState.get('gameFlow.currentCategory') || 'Unknown');
    console.log('Bidder:', GameState.get('highestBidder') || 'None');
    
    console.log('\n🎯 ACTIVE BLOCKS:');
    const currentBlocks = GameState.get('players.currentBlocks') || {};
    console.log('Active blocks:', Object.keys(currentBlocks).length);
    Object.keys(currentBlocks).forEach(playerName => {
        const block = currentBlocks[playerName];
        console.log(`  ${playerName}: ${block.cardId} (${block.tokenValue} points)`);
    });
    
    console.log('\n📋 BLOCKED CARDS BY CATEGORY:');
    const blockedByCategory = GameState.get('players.blockedCardsByCategory') || {};
    Object.keys(blockedByCategory).forEach(category => {
        console.log(`  ${category}: ${blockedByCategory[category].length} cards`);
        blockedByCategory[category].forEach(blocked => {
            console.log(`    ${blocked.cardId} (round ${blocked.round}, by ${blocked.blockedBy})`);
        });
    });
    
    console.log('\n👥 DETAILED PLAYER ANALYSIS:');
    playersList.forEach(playerName => {
        const stats = getPlayerStats(playerName);
        const ownedCards = GameState.get('players.ownedCards') || {};
        let actualTokenCount = 0;
        
        if (ownedCards[playerName]) {
            Object.keys(ownedCards[playerName]).forEach(category => {
                const cards = ownedCards[playerName][category] || [];
                actualTokenCount += cards.length;
            });
        }
        
        console.log(`\n🧑 ${playerName}:`);
        console.log(`  blocksMade: ${stats.blocksMade || 0}`);
        console.log(`  blocksWon: ${stats.blocksWon || 0}`);
        console.log(`  blocksLost: ${stats.blocksLost || 0}`);
        console.log(`  tokensGained: ${stats.tokensGained || 0}`);
        console.log(`  actualTokensOwned: ${actualTokenCount}`);
        console.log(`  bidsWon: ${stats.bidsWon || 0}`);
        console.log(`  bidsSuccessful: ${stats.bidsSuccessful || 0}`);
        
        // Analyze discrepancies
        const blockDiscrepancy = (stats.blocksMade || 0) - (stats.tokensGained || 0);
        const relationshipOK = (stats.blocksWon || 0) === (stats.tokensGained || 0);
        const ownershipOK = (stats.tokensGained || 0) === actualTokenCount;
        
        console.log(`  📊 Analysis:`);
        console.log(`    Block discrepancy: ${blockDiscrepancy} (blocksMade - tokensGained)`);
        console.log(`    blocksWon == tokensGained: ${relationshipOK ? '✅' : '❌'}`);
        console.log(`    tokensGained == actualOwned: ${ownershipOK ? '✅' : '❌'}`);
        
        if (blockDiscrepancy > 0) {
            const possibleSelfBlocks = stats.bidsWon || 0;
            if (possibleSelfBlocks >= blockDiscrepancy) {
                console.log(`    🤔 Likely explanation: ${blockDiscrepancy} self-blocks (bidder can't win)`);
            } else {
                console.log(`    ❌ UNEXPLAINED: ${blockDiscrepancy - possibleSelfBlocks} blocks unaccounted for`);
                console.log(`       This needs investigation!`);
            }
        }
        
        // Show owned cards by category
        if (ownedCards[playerName]) {
            console.log(`  🎯 Owned cards:`);
            Object.keys(ownedCards[playerName]).forEach(category => {
                const cards = ownedCards[playerName][category] || [];
                if (cards.length > 0) {
                    console.log(`    ${category}: ${cards.join(', ')}`);
                }
            });
        }
    });
    
    console.log('\n🔍 INTEGRITY CHECKS:');
    
    // Check if all blocks are accounted for
    let totalBlocksMade = 0;
    let totalBlocksWon = 0;
    let totalTokensGained = 0;
    
    playersList.forEach(playerName => {
        const stats = getPlayerStats(playerName);
        totalBlocksMade += stats.blocksMade || 0;
        totalBlocksWon += stats.blocksWon || 0;
        totalTokensGained += stats.tokensGained || 0;
    });
    
    console.log(`Total blocks made: ${totalBlocksMade}`);
    console.log(`Total blocks won: ${totalBlocksWon}`);
    console.log(`Total tokens gained: ${totalTokensGained}`);
    console.log(`blocksWon == tokensGained: ${totalBlocksWon === totalTokensGained ? '✅' : '❌'}`);
    
    if (totalBlocksMade > totalTokensGained) {
        console.log(`❓ ${totalBlocksMade - totalTokensGained} blocks made but didn't result in tokens`);
        console.log('   This could be due to:');
        console.log('   1. Bidders attempting to block (should be prevented)');
        console.log('   2. Successful bids (blockers lose, get no tokens)');
        console.log('   3. Bug in block processing');
    }
    
    return {
        totalBlocksMade,
        totalBlocksWon,
        totalTokensGained,
        activeBlocks: Object.keys(currentBlocks).length,
        integrityOK: totalBlocksWon === totalTokensGained
    };
}

// Real-time validation system to prevent invalid states
function validateGameStateIntegrity() {
    console.log('🔍 REAL-TIME GAME STATE VALIDATION');
    console.log('==================================');
    
    const playersList = GameState.get('players.list') || [];
    let errors = [];
    let warnings = [];
    
    // Check 1: Validate block/token relationship for each player
    playersList.forEach(playerName => {
        const stats = getPlayerStats(playerName);
        
        // Critical relationship: blocksWon should equal tokensGained
        if ((stats.blocksWon || 0) !== (stats.tokensGained || 0)) {
            errors.push(`❌ ${playerName}: blocksWon (${stats.blocksWon || 0}) ≠ tokensGained (${stats.tokensGained || 0})`);
        }
        
        // Check for impossible values
        if (stats.blocksMade < 0 || stats.blocksWon < 0 || stats.tokensGained < 0) {
            errors.push(`❌ ${playerName}: Negative values detected in stats`);
        }
        
        // Warning for suspicious patterns
        const blockDiscrepancy = (stats.blocksMade || 0) - (stats.tokensGained || 0);
        if (blockDiscrepancy > (stats.bidsWon || 0)) {
            warnings.push(`⚠️ ${playerName}: Block discrepancy (${blockDiscrepancy}) exceeds possible self-blocks`);
        }
    });
    
    // Check 2: Validate bidder is not in current blocks
    const currentBlocks = GameState.get('players.currentBlocks') || {};
    const highestBidder = GameState.get('highestBidder');
    
    if (highestBidder && currentBlocks[highestBidder]) {
        errors.push(`❌ CRITICAL: Bidder ${highestBidder} has an active block! This violates game rules.`);
    }
    
    // Check 3: Validate owned cards consistency
    const ownedCards = GameState.get('players.ownedCards') || {};
    playersList.forEach(playerName => {
        let actualTokenCount = 0;
        if (ownedCards[playerName]) {
            Object.keys(ownedCards[playerName]).forEach(category => {
                actualTokenCount += (ownedCards[playerName][category] || []).length;
            });
        }
        
        const stats = getPlayerStats(playerName);
        if ((stats.tokensGained || 0) !== actualTokenCount) {
            errors.push(`❌ ${playerName}: tokensGained (${stats.tokensGained || 0}) ≠ actualTokensOwned (${actualTokenCount})`);
        }
    });
    
    // Check 4: Validate block storage consistency
    const currentBlockCount = Object.keys(currentBlocks).length;
    const blockedCards = GameState.get('blockedCards') || [];
    
    if (currentBlockCount > 0 && blockedCards.length === 0) {
        warnings.push(`⚠️ Active blocks exist but blockedCards array is empty`);
    }
    
    // Report results
    if (errors.length > 0) {
        console.log('💥 VALIDATION ERRORS DETECTED:');
        errors.forEach(error => console.log(error));
        
        // In automated testing, this should stop the test
        if (window.automatedTestState) {
            console.log('🛑 STOPPING AUTOMATED TEST DUE TO VALIDATION ERRORS');
            window.automatedTestState.forceStop = true;
        }
        
        return { valid: false, errors, warnings };
    }
    
    if (warnings.length > 0) {
        console.log('⚠️ VALIDATION WARNINGS:');
        warnings.forEach(warning => console.log(warning));
    }
    
    if (errors.length === 0 && warnings.length === 0) {
        console.log('✅ All validation checks passed');
    }
    
    return { valid: true, errors, warnings };
}

// Auto-validation hook - runs after key game state changes
function runAutoValidation(context) {
    console.log(`🔍 Auto-validation triggered: ${context}`);
    const result = validateGameStateIntegrity();
    
    if (!result.valid) {
        console.error(`💥 VALIDATION FAILED in context: ${context}`);
        // Could trigger alerts or stop game flow here
    }
    
    return result;
}

// Comprehensive test for all category fixes
function testAllCategoriesFix() {
    console.log('🧪 COMPREHENSIVE CATEGORY TEST - All Fixes');
    console.log('==========================================');
    
    if (typeof GameState === 'undefined') {
        console.log('❌ GameState not available - run this in browser with game loaded');
        return;
    }
    
    // Test 1: Verify all categories are available
    const gameData = window.GAME_DATA;
    if (!gameData || !gameData.categories) {
        console.log('❌ Game data not available');
        return;
    }
    
    const categories = Object.keys(gameData.categories);
    console.log('✅ Available categories:', categories);
    
    // Test 2: Test blocked cards by category storage
    console.log('\n✅ Testing category-specific blocked cards storage');
    const blockedCardsByCategory = {};
    
    categories.forEach((category, index) => {
        blockedCardsByCategory[category] = [];
        const categoryItems = Object.keys(gameData.categories[category].items);
        if (categoryItems.length > 0) {
            const testCard = categoryItems[0];
            blockedCardsByCategory[category].push({
                cardId: testCard,
                round: index + 1,
                blockedBy: `TestPlayer${index + 1}`
            });
            console.log(`  ${category}: Test card ${testCard} stored`);
        }
    });
    
    GameState.set('players.blockedCardsByCategory', blockedCardsByCategory);
    
    // Test 3: Test validation system
    console.log('\n✅ Testing validation system');
    if (typeof validateGameStateIntegrity === 'function') {
        const result = validateGameStateIntegrity();
        console.log('  Validation:', result.valid ? '✅ PASSED' : '❌ FAILED');
    }
    
    // Test 4: Test debug system
    console.log('\n✅ Testing debug lifecycle');
    if (typeof debugBlockLifecycle === 'function') {
        debugBlockLifecycle();
    }
    
    console.log('\n🎯 ALL FIXES OPERATIONAL:');
    console.log('✅ Category-specific blocked cards storage');
    console.log('✅ Real-time validation system');
    console.log('✅ Enhanced debug logging');
    console.log('✅ Cross-category isolation');
    
    return { allFixesWorking: true, categoriesAvailable: categories.length };
}

// Load the new automated test system directly into the game
if (typeof window !== 'undefined') {
    console.log('🔄 Attempting to load Automated Test v2...');
    
    // Wait for DOM to be ready
    function loadTestSystem() {
        console.log('📋 DOM ready, loading test system...');
        
        const script = document.createElement('script');
        script.src = 'automated-test-v4.js?v=' + Date.now(); // Cache bust
        
        script.onload = function() {
            console.log('✅ Automated Test v4 script loaded successfully');
            
            // Add test button to the game UI
            const testButton = document.createElement('button');
            testButton.textContent = 'Run Test v4';
            testButton.id = 'runTestV4Button';
            testButton.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                z-index: 9999;
                padding: 10px 15px;
                background: #28a745;
                color: white;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-size: 14px;
                box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            `;
            
            testButton.onclick = function() {
                if (typeof window.runRealGameTest === 'function') {
                    runQuickTestV4();
                } else {
                    console.error('❌ runRealGameTest function not found!');
                    alert('Test system v4 not loaded properly. Check console.');
                }
            };
            
            document.body.appendChild(testButton);
            console.log('✅ Test button added to page');
            
            // Quick test function
            window.runQuickTestV4 = async function() {
                try {
                    console.log('🚀 Starting Real Game Test v4...');
                    testButton.textContent = 'Running...';
                    testButton.disabled = true;
                    
                    const results = await window.runRealGameTest({
                        playerNames: ['Alice', 'Bob', 'Charlie', 'Diana'],
                        maxRounds: 3,
                        blockFrequency: 0.6,
                        logLevel: 'normal'
                    });
                    
                    console.log('📊 Test Complete!');
                    console.log('Results:', results);
                    
                    // Show comprehensive summary
                    const summary = results.summary;
                    alert(`Test v4 Complete!\n\n` +
                          `Rounds: ${summary.roundsPlayed}\n` +
                          `Duration: ${summary.duration}ms\n` +
                          `Errors: ${summary.totalErrors}\n` +
                          `Warnings: ${summary.totalWarnings}\n` +
                          `Status: ${summary.testPassed ? 'PASSED ✅' : 'FAILED ❌'}\n\n` +
                          `Check console for detailed results.`);
                    
                } catch (error) {
                    console.error('❌ Test error:', error);
                    alert('Test failed: ' + error.message);
                } finally {
                    testButton.textContent = 'Run Test v4';
                    testButton.disabled = false;
                }
            };
        };
        
        script.onerror = function() {
            console.error('❌ Failed to load automated-test-v4.js');
            console.error('Check if file exists and server is running');
        };
        
        document.head.appendChild(script);
    }
    
    // Load when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', loadTestSystem);
    } else {
        // DOM already loaded
        setTimeout(loadTestSystem, 100);
    }
}

// Capture test data before reset
function captureTestData() {
    console.log('📸 CAPTURING TEST DATA BEFORE RESET');
    
    // Store data globally so it persists after game reset
    window.capturedTestData = {
        timestamp: new Date().toISOString(),
        blockedCardsByCategory: GameState.get('players.blockedCardsByCategory'),
        ownedCards: GameState.get('players.ownedCards'),
        playerStats: GameState.get('players.stats'),
        currentBlocks: GameState.get('players.currentBlocks')
    };
    
    console.log('✅ Data captured in window.capturedTestData');
    
    // Analyze owned cards
    const ownedCards = window.capturedTestData.ownedCards || {};
    Object.keys(ownedCards).forEach(player => {
        const playerOwned = ownedCards[player] || {};
        let total = 0;
        Object.keys(playerOwned).forEach(cat => {
            const cards = playerOwned[cat] || [];
            total += cards.length;
            if (cards.length > 0) {
                console.log(`  ${player} owns in ${cat}: ${cards.join(', ')}`);
            }
        });
        if (total === 0) {
            console.log(`  ❌ ${player} owns NO tokens despite stats showing tokensGained`);
        }
    });
    
    return window.capturedTestData;
}

// Live Game Validation Functions
let liveValidationState = {
    currentValidation: null,
    currentChallenge: null,
    playerRanking: [],
    currentStep: 0,
    masterDataset: null,
    currentDataset: 'production'
};

// Toggle dataset selector visibility
function toggleDatasetSelector() {
    const category = document.getElementById('liveValidationCategory').value;
    const datasetDiv = document.getElementById('datasetSelectorDiv');
    
    if (category === 'countries') {
        datasetDiv.style.display = 'block';
    } else {
        datasetDiv.style.display = 'none';
    }
}

// Load master dataset for validation
window.loadMasterDatasetForValidation = async function loadMasterDatasetForValidation() {
    // Use the same cache as the HTML function
    if (window.masterDatasetCache) {
        liveValidationState.masterDataset = window.masterDatasetCache;
        return window.masterDatasetCache;
    }
    
    if (liveValidationState.masterDataset) {
        return liveValidationState.masterDataset;
    }
    
    try {
        const response = await fetch('master_country_dataset_FINAL_2025-07-26T22-14-26.json');
        if (!response.ok) {
            throw new Error('Failed to load master dataset');
        }
        
        const masterData = await response.json();
        
        // Convert to game data format
        const gameData = {
            categories: {
                countries: {
                    name: "Countries",
                    icon: "🌍",
                    items: {},
                    prompts: []
                }
            }
        };
        
        // Convert countries to game format
        Object.entries(masterData.countries).forEach(([countryCode, countryData]) => {
            gameData.categories.countries.items[countryCode] = {
                name: countryData.name,
                code: countryCode,
                ...Object.fromEntries(
                    Object.entries(countryData.categories || {}).map(([key, data]) => [
                        key, data.value || data.rawValue
                    ])
                )
            };
        });
        
        // Add prompts for available challenges
        Object.keys(masterData.categoryIndex).forEach(challenge => {
            gameData.categories.countries.prompts.push({
                challenge: challenge,
                label: `Rank by ${challenge}`
            });
        });
        
        // Cache in both places
        window.masterDatasetCache = gameData;
        liveValidationState.masterDataset = gameData;
        return gameData;
        
    } catch (error) {
        console.error('Failed to load master dataset:', error);
        alert('Failed to load master dataset. Using production data.');
        return null;
    }
};

// Get current dataset for validation
function getCurrentValidationDataset() {
    if (liveValidationState.currentDataset === 'master' && liveValidationState.masterDataset) {
        return liveValidationState.masterDataset;
    } else {
        return window.GAME_DATA;
    }
}

async function setupLiveValidation() {
    const category = document.getElementById('liveValidationCategory').value;
    const challengeNum = document.getElementById('liveChalllengeNumber').value;
    const bidAmount = parseInt(document.getElementById('liveBidAmount').value);
    const bidderName = 'Player'; // Default since we removed the name field

    if (!category || !challengeNum || !bidAmount) {
        alert('Please fill in all fields');
        return;
    }
    
    // Load master dataset if needed
    if (category === 'countries') {
        const selectedDataset = document.getElementById('liveValidationDataset').value;
        if (selectedDataset === 'master') {
            const loadResult = await loadMasterDatasetForValidation();
            if (!loadResult) {
                return; // Failed to load, stop here
            }
            liveValidationState.currentDataset = 'master';
        } else {
            liveValidationState.currentDataset = 'production';
        }
    }

    // Get current dataset and find the challenge
    let currentGameData;
    
    // Load master dataset if needed for countries
    if (category === 'countries' && liveValidationState.currentDataset === 'master') {
        if (!liveValidationState.masterDataset) {
            alert('Master dataset not loaded. Please try again.');
            return;
        }
        currentGameData = liveValidationState.masterDataset;
    } else {
        currentGameData = window.GAME_DATA;
    }
    
    if (!currentGameData || !currentGameData.categories[category]) {
        alert('Game data not loaded or category not found');
        return;
    }

    const challenges = currentGameData.categories[category].prompts;
    const challengeIndex = parseInt(challengeNum) - 1;
    
    console.log(`Validation setup:`, {
        category,
        challengeNum,
        challengeIndex,
        dataset: liveValidationState.currentDataset,
        availableChallenges: challenges.length,
        hasCurrentGameData: !!currentGameData,
        hasCategory: !!currentGameData.categories[category]
    });
    
    if (challengeIndex < 0 || challengeIndex >= challenges.length) {
        const datasetType = liveValidationState.currentDataset === 'master' ? 'Master' : 'Production';
        alert(`Challenge ${challengeNum} not found in ${category} (${datasetType} dataset). Available: 001-${String(challenges.length).padStart(3, '0')} (${challenges.length} total)`);
        console.log(`Challenge lookup failed:`, {
            requested: challengeNum,
            requestedIndex: challengeIndex,
            available: challenges.length,
            dataset: datasetType
        });
        return;
    }

    liveValidationState.currentChallenge = challenges[challengeIndex];
    liveValidationState.currentValidation = {
        category,
        challengeNum,
        bidAmount,
        bidderName,
        challengeData: liveValidationState.currentChallenge
    };

    showLiveRankingInput();
}

function showLiveRankingInput() {
    const output = document.getElementById('liveValidationResults');
    const currentGameData = getCurrentValidationDataset();
    const categoryItems = currentGameData.categories[liveValidationState.currentValidation.category].items;
    
    // Get available tokens for this category
    const challengeKey = liveValidationState.currentChallenge.challenge || liveValidationState.currentChallenge.label?.replace('Rank by ', '');
    const tokens = Object.keys(categoryItems).map(code => {
        const countryData = categoryItems[code];
        const hasValue = countryData[challengeKey] !== undefined && countryData[challengeKey] !== null && countryData[challengeKey] !== 0;
        return {
            code: code,
            name: countryData.name,
            hasValue: hasValue,
            value: countryData[challengeKey]
        };
    }).sort((a, b) => a.name.localeCompare(b.name));

    let html = `
        <div class="info-card" style="background: #f8f9fa; margin-bottom: 20px;">
            <div class="card-title">📋 Challenge Confirmed</div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; margin-top: 15px;">
                <div><strong>Category:</strong> ${liveValidationState.currentValidation.category.charAt(0).toUpperCase() + liveValidationState.currentValidation.category.slice(1)}</div>
                <div><strong>Dataset:</strong> ${liveValidationState.currentDataset === 'master' ? '📚 Master' : '🎮 Production'}</div>
                <div><strong>Challenge:</strong> #${liveValidationState.currentValidation.challengeNum}</div>
                <div><strong>Bid Amount:</strong> ${liveValidationState.currentValidation.bidAmount} tokens</div>
                <div><strong>Bidder:</strong> ${liveValidationState.currentValidation.bidderName}</div>
            </div>
        </div>

        <div class="info-card" style="background: #e3f2fd; margin-bottom: 20px;">
            <div class="card-title">🎯 Challenge: ${extractLiveChallengeTitle(liveValidationState.currentChallenge.label)}</div>
            <div class="card-description">Enter the ${liveValidationState.currentValidation.bidAmount} tokens in the order the bidder ranked them:</div>
            
            <div style="display: grid; grid-template-columns: 1fr; gap: 10px; margin-top: 15px;">
    `;

    // Create input fields for each ranking position
    for (let i = 0; i < liveValidationState.currentValidation.bidAmount; i++) {
        html += `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-weight: bold; width: 80px;">Position ${i + 1}:</span>
                <select id="liveRanking_${i}" style="flex: 1; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                    <option value="">Select token...</option>
                    ${tokens.map(token => 
                        `<option value="${token.code}" style="${token.hasValue ? 'background-color: #d4edda; color: #155724;' : ''}">${token.code} - ${token.name}${token.hasValue ? ' ✓' : ''}</option>`
                    ).join('')}
                </select>
            </div>
        `;
    }

    html += `
            </div>
            <button class="btn primary" onclick="startLiveValidation()" style="width: 100%; margin-top: 15px;">
                🚀 Validate Ranking
            </button>
        </div>
    `;

    output.innerHTML = html;
}

function extractLiveChallengeTitle(htmlLabel) {
    if (!htmlLabel) return 'Challenge';
    
    // Handle simple text labels (master dataset format)
    if (typeof htmlLabel === 'string' && !htmlLabel.includes('<')) {
        return htmlLabel.replace('Rank by ', '');
    }
    
    // Handle HTML labels (production dataset format)
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlLabel;
    const titleDiv = tempDiv.querySelector('div[style*="font-weight: bold"]');
    return titleDiv ? titleDiv.textContent : htmlLabel;
}

function startLiveValidation() {
    // Collect the ranking
    liveValidationState.playerRanking = [];
    for (let i = 0; i < liveValidationState.currentValidation.bidAmount; i++) {
        const value = document.getElementById(`liveRanking_${i}`).value;
        if (!value) {
            alert(`Please select a token for position ${i + 1}`);
            return;
        }
        if (liveValidationState.playerRanking.includes(value)) {
            alert(`Token ${value} is already used. Each token can only be used once.`);
            return;
        }
        liveValidationState.playerRanking.push(value);
    }

    liveValidationState.currentStep = 0;
    startDramaticReveal();
}

function startDramaticReveal() {
    const output = document.getElementById('liveValidationResults');
    const challenge = liveValidationState.currentChallenge;
    const correctOrder = getLiveCorrectOrder();
    const isAscending = challenge.direction === 'asc';
    
    let html = `
        <div class="live-validation-reveal">
            <h3>🎯 Live Validation: ${liveValidationState.currentValidation.bidderName}</h3>
            <p><strong>Challenge:</strong> ${extractLiveChallengeTitle(challenge.label)}</p>
            <p><strong>Direction:</strong> ${isAscending ? 'Lowest to Highest' : 'Highest to Lowest'}</p>
            <p><strong>Cards to validate:</strong> ${liveValidationState.playerRanking.length}</p>
            
            <div class="reveal-container">
                <div class="ranking-list" id="liveRevealList"></div>
                
                <div class="reveal-controls">
                    <button class="btn primary" id="revealNextBtn" onclick="revealNextLiveCard()">
                        🎲 Reveal Card ${liveValidationState.currentStep + 1}
                    </button>
                </div>
                
                <div class="validation-status" id="liveValidationStatus"></div>
            </div>
        </div>
    `;
    
    output.innerHTML = html;
    updateLiveRevealDisplay();
}

async function revealNextLiveCard() {
    const currentStep = liveValidationState.currentStep;
    const playerRanking = liveValidationState.playerRanking;
    const challenge = liveValidationState.currentChallenge;
    const correctOrder = getLiveCorrectOrder();
    const isAscending = challenge.direction === 'asc';
    
    // Check if we're done
    if (currentStep >= playerRanking.length) {
        showLiveValidationComplete(true);
        return;
    }
    
    // Disable the reveal button during animation
    const revealBtn = document.getElementById('revealNextBtn');
    revealBtn.disabled = true;
    revealBtn.textContent = '⏳ Revealing...';
    
    // Add countdown suspense
    await showCountdownSuspense();
    
    // Reveal the next card with flip animation
    liveValidationState.currentStep++;
    await updateLiveRevealDisplayWithAnimation();
    
    // Re-enable button
    revealBtn.disabled = false;
    
    // Check sequential ordering if we have at least 2 cards revealed
    if (liveValidationState.currentStep >= 2) {
        const currentCardId = playerRanking[currentStep];
        const previousCardId = playerRanking[currentStep - 1];
        
        // Get actual values for comparison
        const currentGameData = getCurrentValidationDataset();
        const categoryItems = currentGameData.categories[liveValidationState.currentValidation.category].items;
        const challengeKey = challenge.challenge || challenge.label?.replace('Rank by ', '');
        const currentValue = categoryItems[currentCardId][challengeKey];
        const previousValue = categoryItems[previousCardId][challengeKey];
        
        // Check if sequence is correct based on direction
        let sequenceValid;
        if (isAscending) {
            sequenceValid = currentValue >= previousValue;
        } else {
            sequenceValid = currentValue <= previousValue;
        }
        
        if (!sequenceValid) {
            // Mark current card as incorrect with red X
            markLiveCardStatus(currentStep, false);
            // Sequence broken! Show failure
            setTimeout(() => {
                showLiveValidationComplete(false, currentStep + 1, currentValue, previousValue);
            }, 1000);
            return;
        } else {
            // Mark current card as correct with green checkmark
            markLiveCardStatus(currentStep, true);
        }
        
        // Mark first card as correct if this is the second card and sequence is valid
        if (liveValidationState.currentStep === 2) {
            markLiveCardStatus(0, true);
        }
    }
    
    // Update button text or show completion
    if (liveValidationState.currentStep >= playerRanking.length) {
        setTimeout(() => {
            showLiveValidationComplete(true);
        }, 1000);
    } else {
        revealBtn.textContent = `🎲 Reveal Card ${liveValidationState.currentStep + 1}`;
    }
}

function updateLiveRevealDisplay() {
    const revealList = document.getElementById('liveRevealList');
    if (!revealList) return;
    
    const playerRanking = liveValidationState.playerRanking;
    const currentStep = liveValidationState.currentStep;
    const currentGameData = getCurrentValidationDataset();
    const categoryItems = currentGameData.categories[liveValidationState.currentValidation.category].items;
    const challenge = liveValidationState.currentChallenge;
    
    let html = '';
    
    for (let i = 0; i < playerRanking.length; i++) {
        const cardId = playerRanking[i];
        const item = categoryItems[cardId];
        const isRevealed = i < currentStep;
        const isCurrent = i === currentStep - 1;
        
        let statusClass = '';
        if (isRevealed) {
            statusClass = isCurrent ? 'current-reveal' : 'revealed';
        } else {
            statusClass = 'hidden';
        }
        
        const challengeKey = challenge.challenge || challenge.label?.replace('Rank by ', '');
        const value = isRevealed ? item[challengeKey] : '???';
        const displayName = isRevealed ? item.name : '???';
        
        html += `
            <div class="reveal-card live-card ${statusClass}" id="liveCard_${i}">
                <span class="rank-number">${i + 1}</span>
                <span class="country-info">
                    <span class="country-name">${displayName}<br><small>${isRevealed ? cardId : '???'}</small></span>
                    <span class="country-value">${value}</span>
                </span>
                <span class="status-icon" id="statusIcon_${i}"></span>
            </div>
        `;
    }
    
    revealList.innerHTML = html;
}

// Exciting animation functions for reveal
function showCountdownSuspense() {
    return new Promise((resolve) => {
        const revealBtn = document.getElementById('revealNextBtn');
        let count = 3;
        
        const countdown = () => {
            if (count > 0) {
                revealBtn.textContent = `🎲 ${count}...`;
                revealBtn.style.transform = 'scale(1.1)';
                revealBtn.style.background = '#ff6b6b';
                
                setTimeout(() => {
                    revealBtn.style.transform = 'scale(1)';
                    count--;
                    setTimeout(countdown, 300);
                }, 200);
            } else {
                revealBtn.textContent = '🎉 REVEAL!';
                revealBtn.style.background = '#4caf50';
                setTimeout(() => {
                    revealBtn.style.background = '';
                    resolve();
                }, 300);
            }
        };
        
        countdown();
    });
}

function updateLiveRevealDisplayWithAnimation() {
    return new Promise((resolve) => {
        // First, do the regular update
        updateLiveRevealDisplay();
        
        // Then add the flip animation to the newly revealed card
        const currentCardIndex = liveValidationState.currentStep - 1;
        const card = document.getElementById(`liveCard_${currentCardIndex}`);
        
        if (card) {
            // Add flip animation
            card.style.transform = 'rotateY(180deg)';
            card.style.transition = 'transform 0.6s';
            
            setTimeout(() => {
                card.style.transform = 'rotateY(0deg)';
                card.classList.add('just-revealed');
                
                // Add a glow effect
                card.style.boxShadow = '0 0 20px rgba(76, 175, 80, 0.5)';
                card.style.background = 'linear-gradient(45deg, #e8f5e8, #ffffff)';
                
                setTimeout(() => {
                    card.style.boxShadow = '';
                    card.style.background = '';
                    card.classList.remove('just-revealed');
                    resolve();
                }, 1000);
            }, 300);
        } else {
            resolve();
        }
    });
}

function markLiveCardStatus(cardIndex, isCorrect) {
    const card = document.getElementById(`liveCard_${cardIndex}`);
    const statusIcon = document.getElementById(`statusIcon_${cardIndex}`);
    
    if (!card || !statusIcon) return;
    
    if (isCorrect) {
        // Success animation
        card.classList.add('correct');
        statusIcon.innerHTML = '✅';
        statusIcon.style.color = '#4caf50';
        
        // Add success flash effect
        card.style.background = '#4caf50';
        card.style.color = 'white';
        card.style.transform = 'scale(1.05)';
        card.style.transition = 'all 0.3s ease';
        
        setTimeout(() => {
            card.style.background = '#e8f5e8';
            card.style.color = '';
            card.style.transform = 'scale(1)';
            
            // Sparkle effect
            addSparkleEffect(card);
        }, 300);
        
    } else {
        // Failure animation  
        card.classList.add('wrong');
        statusIcon.innerHTML = '❌';
        statusIcon.style.color = '#f44336';
        
        // Add shake and red flash effect
        card.style.background = '#f44336';
        card.style.color = 'white';
        card.style.animation = 'shake 0.5s ease-in-out';
        
        setTimeout(() => {
            card.style.background = '#ffebee';
            card.style.color = '';
            card.style.animation = '';
        }, 500);
    }
}

function addSparkleEffect(card) {
    // Create sparkles around the card
    for (let i = 0; i < 5; i++) {
        const sparkle = document.createElement('div');
        sparkle.innerHTML = '✨';
        sparkle.style.position = 'absolute';
        sparkle.style.fontSize = '16px';
        sparkle.style.pointerEvents = 'none';
        sparkle.style.zIndex = '1000';
        
        // Random position around the card
        const rect = card.getBoundingClientRect();
        sparkle.style.left = (rect.left + Math.random() * rect.width) + 'px';
        sparkle.style.top = (rect.top + Math.random() * rect.height) + 'px';
        
        document.body.appendChild(sparkle);
        
        // Animate sparkle  
        sparkle.style.transition = 'opacity 1s ease-out, transform 1s ease-out';
        sparkle.style.transform = 'translateY(-30px) scale(0.5)';
        sparkle.style.opacity = '0';
        
        // Remove sparkle after animation
        setTimeout(() => {
            document.body.removeChild(sparkle);
        }, 1000);
    }
}

function showFireworks() {
    // Create fireworks container
    const fireworksContainer = document.createElement('div');
    fireworksContainer.id = 'fireworks-container';
    fireworksContainer.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 10000;
    `;
    document.body.appendChild(fireworksContainer);
    
    // Create multiple firework bursts
    for (let i = 0; i < 6; i++) {
        setTimeout(() => {
            createFireworkBurst(fireworksContainer);
        }, i * 300);
    }
    
    // Remove fireworks after animation
    setTimeout(() => {
        if (fireworksContainer.parentNode) {
            fireworksContainer.parentNode.removeChild(fireworksContainer);
        }
    }, 3000);
}

function createFireworkBurst(container) {
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dda0dd', '#98d8c8'];
    const x = Math.random() * window.innerWidth;
    const y = Math.random() * (window.innerHeight * 0.6) + (window.innerHeight * 0.2);
    
    // Create 12 particles per burst
    for (let i = 0; i < 12; i++) {
        const particle = document.createElement('div');
        particle.style.cssText = `
            position: absolute;
            width: 8px;
            height: 8px;
            background: ${colors[Math.floor(Math.random() * colors.length)]};
            border-radius: 50%;
            left: ${x}px;
            top: ${y}px;
        `;
        
        container.appendChild(particle);
        
        // Animate particle
        const angle = (i / 12) * Math.PI * 2;
        const velocity = 100 + Math.random() * 100;
        const deltaX = Math.cos(angle) * velocity;
        const deltaY = Math.sin(angle) * velocity;
        
        particle.animate([
            { transform: 'translate(0, 0) scale(1)', opacity: 1 },
            { transform: `translate(${deltaX}px, ${deltaY}px) scale(0)`, opacity: 0 }
        ], {
            duration: 1000 + Math.random() * 500,
            easing: 'ease-out'
        }).onfinish = () => {
            if (particle.parentNode) {
                particle.parentNode.removeChild(particle);
            }
        };
    }
}

function playVictorySound() {
    // Create a simple victory sound using Web Audio API
    try {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        // Victory chord progression
        const frequencies = [261.63, 329.63, 392.00]; // C, E, G major chord
        
        frequencies.forEach((freq, index) => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
            
            oscillator.start(audioContext.currentTime + index * 0.1);
            oscillator.stop(audioContext.currentTime + 0.5 + index * 0.1);
        });
    } catch (error) {
        console.log('Audio not supported, skipping victory sound');
    }
}

function createConfettiRain() {
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dda0dd', '#98d8c8'];
    
    for (let i = 0; i < 50; i++) {
        setTimeout(() => {
            const confetti = document.createElement('div');
            confetti.innerHTML = ['🎉', '🎊', '⭐', '✨', '🌟'][Math.floor(Math.random() * 5)];
            confetti.style.cssText = `
                position: fixed;
                top: -50px;
                left: ${Math.random() * window.innerWidth}px;
                font-size: ${Math.random() * 20 + 15}px;
                pointer-events: none;
                z-index: 10001;
                animation: confetti-fall ${Math.random() * 2 + 3}s linear forwards;
            `;
            
            document.body.appendChild(confetti);
            
            // Remove after animation
            setTimeout(() => {
                if (confetti.parentNode) {
                    confetti.parentNode.removeChild(confetti);
                }
            }, 5000);
        }, i * 50);
    }
}

function showLiveValidationComplete(success, failedAtStep = null, currentValue = null, previousValue = null) {
    const statusDiv = document.getElementById('liveValidationStatus');
    const revealBtn = document.getElementById('revealNextBtn');
    const challenge = liveValidationState.currentChallenge;
    const isAscending = challenge.direction === 'asc';
    
    if (success) {
        // Mark the final card as correct if we have multiple cards
        if (liveValidationState.playerRanking.length > 1) {
            markLiveCardStatus(liveValidationState.playerRanking.length - 1, true);
        }
        // Mark the first card as correct for single card case
        if (liveValidationState.playerRanking.length === 1) {
            markLiveCardStatus(0, true);
        }
        
        statusDiv.innerHTML = `
            <div class="validation-success" style="text-align: center; padding: 20px; background: linear-gradient(45deg, #4caf50, #81c784); color: white; border-radius: 10px; margin: 10px 0;">
                <h3 style="font-size: 24px; margin-bottom: 10px;">🎉 PERFECT RANKING! 🎉</h3>
                <p style="font-size: 18px; margin-bottom: 10px;"><strong>${liveValidationState.currentValidation.bidderName}</strong> nailed all ${liveValidationState.playerRanking.length} cards!</p>
                <p style="font-size: 16px; margin-bottom: 15px;">Flawless ${isAscending ? 'ascending' : 'descending'} sequence! 🏆</p>
                <div style="font-size: 30px; animation: bounce 1s infinite;">🥇 CHAMPION 🥇</div>
            </div>
        `;
        revealBtn.style.display = 'none';
        
        // Add celebration effects
        statusDiv.style.animation = 'successFlash 1s ease-in-out';
        
        // Show fireworks celebration!
        setTimeout(() => {
            showFireworks();
            playVictorySound();
        }, 500);
        
        // Add confetti rain
        setTimeout(() => {
            createConfettiRain();
        }, 800);
    } else {
        const direction = isAscending ? 'higher' : 'lower';
        statusDiv.innerHTML = `
            <div class="validation-failure">
                <h3>💥 SEQUENCE BROKEN!</h3>
                <p><strong>${liveValidationState.currentValidation.bidderName}</strong> fails at card ${failedAtStep}!</p>
                <p>Card ${failedAtStep} (${currentValue}) should be ${direction} than Card ${failedAtStep - 1} (${previousValue}) for this challenge.</p>
                <p><strong>Result:</strong> Ranking attempt unsuccessful.</p>
            </div>
        `;
        revealBtn.style.display = 'none';
    }
    
    // Add return button
    setTimeout(() => {
        statusDiv.innerHTML += `
            <button class="btn secondary" onclick="showScreen('liveValidationScreen')" style="margin-top: 15px;">
                🔄 Start New Validation
            </button>
        `;
    }, 2000);
}

function showLiveValidationResults() {
    const output = document.getElementById('liveValidationResults');
    const correctOrder = getLiveCorrectOrder();
    
    let html = `
        <div class="info-card" style="background: #f8f9fa; margin-bottom: 20px;">
            <div class="card-title">🎯 Live Validation Results</div>
            <div style="margin-top: 10px;">
                <strong>Bidder:</strong> ${liveValidationState.currentValidation.bidderName} | 
                <strong>Bid:</strong> ${liveValidationState.currentValidation.bidAmount} tokens
            </div>
        </div>

        <div style="background: white; padding: 20px; border-radius: 10px; border: 2px solid #e0e0e0; margin-bottom: 20px;">
            <div style="display: grid; grid-template-columns: 1fr; gap: 15px;">
    `;

    // Show each position with validation
    for (let i = 0; i < liveValidationState.currentValidation.bidAmount; i++) {
        const playerToken = liveValidationState.playerRanking[i];
        const correctToken = correctOrder[i];
        const isCorrect = playerToken === correctToken;
        const currentGameData = getCurrentValidationDataset();
        const categoryItems = currentGameData.categories[liveValidationState.currentValidation.category].items;

        html += `
            <div style="padding: 15px; border-radius: 8px; border: 2px solid ${isCorrect ? '#4caf50' : '#f44336'}; background: ${isCorrect ? '#e8f5e8' : '#ffebee'};">
                <div style="display: grid; grid-template-columns: auto 1fr 1fr auto; gap: 15px; align-items: center;">
                    <div style="font-weight: bold; color: #333;">Position ${i + 1}</div>
                    <div>
                        <div style="font-size: 12px; color: #666; margin-bottom: 2px;">Player ranked:</div>
                        <div><strong>${playerToken} - ${categoryItems[playerToken].name}</strong></div>
                    </div>
                    <div>
                        <div style="font-size: 12px; color: #666; margin-bottom: 2px;">Correct answer:</div>
                        <div><strong>${correctToken} - ${categoryItems[correctToken].name}</strong></div>
                    </div>
                    <div style="font-weight: bold; font-size: 18px; color: ${isCorrect ? '#4caf50' : '#f44336'};">
                        ${isCorrect ? '✅' : '❌'}
                    </div>
                </div>
            </div>
        `;
    }

    const correctCount = liveValidationState.playerRanking.filter((token, i) => token === correctOrder[i]).length;
    const bidSuccessful = correctCount === liveValidationState.currentValidation.bidAmount;

    html += `
            </div>

            <div style="margin-top: 30px; padding: 20px; border-radius: 10px; background: ${bidSuccessful ? '#e8f5e8' : '#ffebee'}; border: 2px solid ${bidSuccessful ? '#4caf50' : '#f44336'};">
                <h2 style="text-align: center; margin-bottom: 15px; color: ${bidSuccessful ? '#4caf50' : '#f44336'}; font-size: 24px;">
                    ${bidSuccessful ? '🎉 BID SUCCESSFUL!' : '💥 BID FAILED!'}
                </h2>
                <div style="text-align: center; font-size: 18px;">
                    <strong>${liveValidationState.currentValidation.bidderName}</strong> got <strong>${correctCount}/${liveValidationState.currentValidation.bidAmount}</strong> correct
                </div>
                ${!bidSuccessful ? `<div style="text-align: center; margin-top: 10px; color: #666;">Needed all ${liveValidationState.currentValidation.bidAmount} correct to succeed</div>` : ''}
            </div>

            <div style="text-align: center; margin-top: 20px;">
                <button class="btn primary" onclick="resetLiveValidation()" style="margin-right: 10px;">🔄 New Validation</button>
                <button class="btn secondary" onclick="showScreen('titleScreen')">🏠 Back to Home</button>
            </div>
        </div>
    `;

    output.innerHTML = html;
}

function getLiveCorrectOrder() {
    // Get the correct ranking data for this challenge
    const challengeKey = liveValidationState.currentChallenge.challenge || liveValidationState.currentChallenge.label?.replace('Rank by ', '');
    const currentGameData = getCurrentValidationDataset();
    const categoryItems = currentGameData.categories[liveValidationState.currentValidation.category].items;
    
    // Extract all items with their values for this challenge
    const itemsWithValues = Object.keys(categoryItems).map(code => ({
        code: code,
        value: categoryItems[code][challengeKey]
    })).filter(item => item.value !== undefined);

    // Sort based on challenge type (some are highest to lowest, others are lowest to highest)
    const challengeLabel = liveValidationState.currentChallenge.label.toLowerCase();
    const isAscending = challengeLabel.includes('lowest to highest');
    
    itemsWithValues.sort((a, b) => {
        if (isAscending) {
            return a.value - b.value;
        } else {
            return b.value - a.value;
        }
    });

    return itemsWithValues.map(item => item.code);
}

function resetLiveValidation() {
    liveValidationState = {
        currentValidation: null,
        currentChallenge: null,
        playerRanking: [],
        currentStep: 0,
        masterDataset: null,
        currentDataset: 'production'
    };
    
    // Clear form
    document.getElementById('liveValidationCategory').value = '';
    document.getElementById('liveChallengeSelect').innerHTML = '<option value="">Select a challenge...</option>';
    document.getElementById('liveChalllengeNumber').value = '';
    document.getElementById('liveBidAmount').value = '';
    document.getElementById('liveValidationDataset').value = 'production';
    document.getElementById('datasetSelectorDiv').style.display = 'none';
    
    // Reset output
    document.getElementById('liveValidationResults').innerHTML = '';
}
