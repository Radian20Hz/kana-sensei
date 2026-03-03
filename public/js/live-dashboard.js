/**
 * @fileoverview KanaSensei — Live Dashboard (Firebase Realtime Database)
 *
 * Provides real-time global stats and a live activity feed.
 * Works on the Firebase Spark (free) plan — no Cloud Functions needed.
 *
 * Realtime Database schema:
 *   /live/users/{uid}
 *     displayName : string
 *     score       : number
 *     mastered    : number
 *     online      : boolean
 *     lastSeen    : ServerTimestamp
 *
 *   /live/feed/{pushId}
 *     type        : 'answer' | 'levelup' | 'boss_victory' | 'streak' | 'speedrun'
 *     displayName : string
 *     detail      : string
 *     timestamp   : ServerTimestamp
 *
 * @author Wiktor Waryszak
 * @version 5.0
 */

import {
  getDatabase,
  ref,
  set,
  push,
  query,
  onValue,
  serverTimestamp,
  orderByChild,
  limitToLast,
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';
import { app } from './config.js';

const rtdb = getDatabase(app);

/** How long (ms) before an "online" user is considered stale */
const ACTIVE_WINDOW_MS = 5 * 60_000; // 5 minutes

// ─── Write ─────────────────────────────────────────────────────────────────

/**
 * Update the user's presence record.
 * Call on every correct answer so the "active now" counter stays fresh.
 *
 * @param {string} uid
 * @param {string} displayName
 * @param {number} score
 * @param {number} masteredCount
 * @returns {void}
 */
export function recordActivity(uid, displayName, score, masteredCount) {
  if (!uid) return;
  set(ref(rtdb, `live/users/${uid}`), {
    displayName: displayName ?? 'Anon',
    score,
    mastered:  masteredCount,
    online:    true,
    lastSeen:  serverTimestamp(),
  }).catch(() => {});
}

/**
 * Mark the user as offline.
 * Call on beforeunload or sign-out.
 *
 * @param {string} uid
 * @returns {void}
 */
export function markOffline(uid) {
  if (!uid) return;
  set(ref(rtdb, `live/users/${uid}`), {
    online:   false,
    lastSeen: serverTimestamp(),
  }).catch(() => {});
}

/**
 * Append an event to the global activity feed.
 *
 * @param {'answer'|'levelup'|'boss_victory'|'streak'|'speedrun'} type
 * @param {string} displayName
 * @param {string} detail       - Human-readable description, e.g. "answered correctly (+3 XP)"
 * @returns {void}
 */
export function pushFeedEvent(type, displayName, detail) {
  push(ref(rtdb, 'live/feed'), {
    type,
    displayName: displayName ?? 'Anon',
    detail,
    timestamp: serverTimestamp(),
  }).catch(() => {});
}

// ─── Subscribe ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} LiveStats
 * @property {number} activeUsers   - Users active in the last 5 minutes
 * @property {number} totalUsers    - All users ever seen
 * @property {number} totalMastered - Sum of mastered kana across all users
 * @property {number} topScore      - Highest individual score
 */

/**
 * Subscribe to aggregated live stats.
 * Returns an unsubscribe function.
 *
 * @param {(stats: LiveStats) => void} callback
 * @returns {() => void} unsubscribe
 */
export function subscribeToLiveStats(callback) {
  return onValue(ref(rtdb, 'live/users'), (snapshot) => {
    const users = Object.values(snapshot.val() ?? {});
    const now   = Date.now();

    callback({
      activeUsers:   users.filter((u) => u.online && now - u.lastSeen < ACTIVE_WINDOW_MS).length,
      totalUsers:    users.length,
      totalMastered: users.reduce((sum, u) => sum + (u.mastered ?? 0), 0),
      topScore:      users.reduce((max, u) => Math.max(max, u.score ?? 0), 0),
    });
  });
}

/**
 * Subscribe to the last 10 feed events, newest first.
 * Returns an unsubscribe function.
 *
 * @param {(events: Array<Record<string, any>>) => void} callback
 * @returns {() => void} unsubscribe
 */
export function subscribeToActivityFeed(callback) {
  const feedQuery = query(
    ref(rtdb, 'live/feed'),
    orderByChild('timestamp'),
    limitToLast(20),
  );

  return onValue(feedQuery, (snapshot) => {
    const events = Object.values(snapshot.val() ?? {})
      .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
      .slice(0, 10);
    callback(events);
  });
}
