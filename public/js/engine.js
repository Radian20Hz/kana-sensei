/**
 * @fileoverview KanaSensei — SRS Engine
 *
 * Implements a SuperMemo SM-2–inspired Spaced Repetition System.
 * Cards advance through 8 stages; each stage doubles the review interval.
 * A wrong answer at stage > 4 drops the card back two stages.
 *
 * @author Wiktor Waryszak
 * @version 5.0
 */

/** @type {Record<number, number>} Stage → interval in milliseconds */
export const SRS_INTERVALS = {
  1: 4   * 3_600_000,   //  4 h
  2: 8   * 3_600_000,   //  8 h
  3: 1   * 86_400_000,  //  1 day
  4: 2   * 86_400_000,  //  2 days
  5: 7   * 86_400_000,  //  1 week
  6: 14  * 86_400_000,  //  2 weeks
  7: 30  * 86_400_000,  //  1 month
  8: 120 * 86_400_000,  //  4 months (≈ "mastered")
};

/**
 * @typedef {Object} KanaCard
 * @property {string} kan  - Kana character (e.g. 'あ')
 * @property {string} rom  - Romaji reading (e.g. 'a')
 */

/**
 * @typedef {Object} CardProgress
 * @property {number} stage       - SRS stage 1–8
 * @property {number} nextReview  - Unix timestamp for next due review
 */

/**
 * Compute the new SRS stage and next review timestamp after an answer.
 *
 * @param {number}  currentStage - Current stage (0 = unseen)
 * @param {boolean} isCorrect
 * @returns {CardProgress}
 */
export function calculateNextReview(currentStage, isCorrect) {
  let stage = currentStage || 0;

  if (isCorrect) {
    stage = Math.min(stage + 1, 8);
  } else {
    const penalty = stage > 4 ? 2 : 1;
    stage = Math.max(stage - penalty, 1);
  }

  return {
    stage,
    nextReview: Date.now() + SRS_INTERVALS[stage],
  };
}

/**
 * Core game engine.
 * Manages the active deck, picks the next card using SRS priority,
 * and validates answers.
 */
export class GameEngine {
  constructor() {
    /** @type {number} Cumulative XP for the current session */
    this.score = 0;

    /** @type {KanaCard[]} Active deck */
    this.deck = [];

    /** @type {KanaCard|null} Card currently on screen */
    this.currentCard = null;

    /** @type {Record<string, CardProgress>} Per-character SRS progress */
    this.userProgress = {};
  }

  /**
   * Load a new deck and attach existing SRS progress.
   *
   * @param {KanaCard[]}                   deck
   * @param {Record<string, CardProgress>} [userProgress={}]
   */
  loadDeck(deck, userProgress = {}) {
    if (!Array.isArray(deck)) return;
    this.deck = deck;
    this.userProgress = userProgress;
  }

  /**
   * Pick the next card using SRS priority:
   *   1. Overdue reviews (oldest first)
   *   2. New (unseen) cards
   *   3. Free practice (everything is up to date)
   *
   * @returns {KanaCard|null}
   */
  drawCard() {
    if (!this.deck.length) return null;

    const now = Date.now();
    const overdue = [];
    const unseen  = [];

    for (const card of this.deck) {
      const p = this.userProgress[card.kan];
      if (!p)                        unseen.push(card);
      else if (p.nextReview <= now)  overdue.push(card);
    }

    // Sort overdue by how long they've been waiting (most overdue first)
    overdue.sort((a, b) =>
      (this.userProgress[a.kan].nextReview) - (this.userProgress[b.kan].nextReview)
    );

    const pool = overdue.length ? overdue : unseen.length ? unseen : this.deck;
    this.currentCard = pool[Math.floor(Math.random() * pool.length)];
    return this.currentCard;
  }

  /**
   * Validate the player's romaji input against the current card,
   * update SRS progress, and increment score on correct answers.
   *
   * @param {string} input - Raw user input
   * @returns {boolean}    - Whether the answer was correct
   */
  checkAnswer(input) {
    if (!this.currentCard) return false;

    const normalised = input.toLowerCase().trim();
    const isCorrect  = normalised === this.currentCard.rom;
    const charId     = this.currentCard.kan;
    const prev       = this.userProgress[charId] || { stage: 0 };

    this.userProgress[charId] = calculateNextReview(prev.stage, isCorrect);
    if (isCorrect) this.score += 10;

    return isCorrect;
  }
}
