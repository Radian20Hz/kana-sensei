/**
 * @fileoverview KanaSensei — Firebase configuration & SDK initialisation
 *
 * Replace the placeholder values below with your own project credentials
 * from the Firebase Console → Project settings → Your apps.
 *
 * @author Wiktor Waryszak
 * @version 5.0
 */

import { initializeApp }  from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getAuth }        from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore }   from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

/** @type {import('firebase/app').FirebaseOptions} */
export const firebaseConfig = {
  apiKey:            'YOUR_API_KEY',
  authDomain:        'YOUR_PROJECT.firebaseapp.com',
  projectId:         'YOUR_PROJECT',
  storageBucket:     'YOUR_PROJECT.firebasestorage.app',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId:             'YOUR_APP_ID',
  measurementId:     'G-XXXXXXXXXX',
};

export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
