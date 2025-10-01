// Firebase Configuration
// Project: fourfor4-5530a
// Created: October 1, 2025

const firebaseConfig = {
  apiKey: "AIzaSyD5Dpck1MbH_JqWqhFF64OOVJk9Q10geJc",
  authDomain: "fourfor4-5530a.firebaseapp.com",
  databaseURL: "https://fourfor4-5530a-default-rtdb.firebaseio.com",
  projectId: "fourfor4-5530a",
  storageBucket: "fourfor4-5530a.firebasestorage.app",
  messagingSenderId: "859830748539",
  appId: "1:859830748539:web:e098610b6d54b36b6329de"
};

// Initialize Firebase (will be called only in online mode)
function initializeFirebase() {
  if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
    console.log('✅ Firebase initialized');
  }
  return firebase.database();
}

// Export for use in game
window.initializeFirebase = initializeFirebase;
window.firebaseConfig = firebaseConfig;
