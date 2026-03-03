/**
 * @fileoverview KanaSensei — Firebase Authentication
 *
 * Handles Google Sign-In / Sign-Out and updates the nav button label
 * reactively via onAuthStateChanged.
 *
 * @author Wiktor Waryszak
 * @version 5.0
 */

import { auth } from './config.js';
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';

const provider = new GoogleAuthProvider();

/**
 * Initialise the auth button in the top navigation.
 * Call once after the DOM is ready.
 */
export function initAuth() {
  const btn = document.getElementById('auth-btn');
  if (!btn) return;

  onAuthStateChanged(auth, (user) => {
    if (user) {
      const firstName = user.displayName?.split(' ')[0] ?? 'User';
      btn.textContent = `Wyloguj (${firstName})`;
      btn.onclick = () => signOut(auth);
    } else {
      btn.textContent = 'Zaloguj z Google';
      btn.onclick = () =>
        signInWithPopup(auth, provider).catch((err) =>
          console.error('[Auth] Sign-in failed:', err.code)
        );
    }
  });
}
