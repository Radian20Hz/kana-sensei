/**
 * @fileoverview KanaSensei — Firestore data layer
 *
 * All persistence goes through this module so the rest of the app
 * never imports Firestore directly.  Every function is async and
 * returns a sensible default on failure so callers don't need
 * try/catch at the call site.
 *
 * Firestore data model:
 *   /users/{uid}
 *     totalScore      : number
 *     displayName     : string
 *     streak          : number
 *     lastPlayedDate  : string  (ISO date, e.g. "2025-03-01")
 *     userLevel       : number
 *     achievements    : string[]
 *     kanaProgress    : Record<string, { stage: number, nextReview: number }>
 *
 * @author Wiktor Waryszak
 * @version 5.0
 */

import { db } from './config.js';
import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

// ─── Internal helpers ──────────────────────────────────────────────────────

/** @param {string} uid @returns {import('firebase/firestore').DocumentReference} */
const userRef = (uid) => doc(db, 'users', uid);

/** ISO date string for today, e.g. "2025-03-01" */
const today = () => new Date().toISOString().split('T')[0];

// ─── Public API ────────────────────────────────────────────────────────────

/**
 * Persist a player's session summary to Firestore (merge, never overwrite).
 *
 * @param {string}   uid
 * @param {number}   score
 * @param {string}   [displayName]
 * @param {number}   [streak=0]
 * @param {string[]} [achievements=[]]
 * @param {number}   [userLevel=1]
 * @returns {Promise<void>}
 */
export async function saveUserProgress(uid, score, displayName, streak = 0, achievements = [], userLevel = 1) {
  if (!uid) return;
  await setDoc(userRef(uid), {
    totalScore:     score,
    displayName:    displayName ?? 'Anonimowy Samuraj',
    streak,
    lastPlayedDate: today(),
    userLevel,
    achievements,
  }, { merge: true }).catch((e) => console.error('[DB] saveUserProgress:', e));
}

/**
 * Fetch a player's full profile document.
 *
 * @param {string} uid
 * @returns {Promise<Record<string, any>|null>}
 */
export async function getUserProfile(uid) {
  if (!uid) return null;
  const snap = await getDoc(userRef(uid)).catch(() => null);
  return snap?.exists() ? snap.data() : null;
}

/**
 * Fetch the SRS progress map for a player.
 *
 * @param {string} uid
 * @returns {Promise<Record<string, { stage: number, nextReview: number }>>}
 */
export async function getUserKanaProgress(uid) {
  if (!uid) return {};
  const snap = await getDoc(userRef(uid)).catch(() => null);
  return snap?.exists() ? (snap.data().kanaProgress ?? {}) : {};
}

/**
 * Persist the SRS progress map (merge so other fields are untouched).
 *
 * @param {string} uid
 * @param {Record<string, { stage: number, nextReview: number }>} progress
 * @returns {Promise<void>}
 */
export async function saveKanaProgress(uid, progress) {
  if (!uid) return;
  await setDoc(userRef(uid), { kanaProgress: progress }, { merge: true })
    .catch((e) => console.error('[DB] saveKanaProgress:', e));
}

/**
 * Return the top-10 players ordered by totalScore descending.
 *
 * @returns {Promise<Array<Record<string, any>>>}
 */
export async function getTopPlayers() {
  const q   = query(collection(db, 'users'), orderBy('totalScore', 'desc'), limit(10));
  const snap = await getDocs(q).catch(() => null);
  if (!snap) return [];
  return snap.docs.map((d) => d.data());
}
