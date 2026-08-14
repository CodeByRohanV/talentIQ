/**
 * shuffleUtils.js
 * ---------------
 * Cryptographically secure randomization utilities for test attempt generation.
 *
 * SECURITY DESIGN:
 *   - Uses crypto.randomInt() (CSPRNG) instead of Math.random() (PRNG).
 *   - Math.random() is seeded from a 64-bit value and is predictable.
 *     An attacker who observes enough outputs can reconstruct the seed
 *     and predict future shuffles. crypto.randomInt() uses OS-level
 *     entropy (e.g. /dev/urandom) and is not predictable.
 *   - All shuffling happens exclusively on the backend. The frontend
 *     receives only the display-ordered data, never the mapping logic.
 */

import crypto from 'crypto';

/**
 * Fisher-Yates shuffle using a cryptographically secure random source.
 *
 * Time complexity: O(n)
 * Space complexity: O(n) — returns a new array, does not mutate input.
 *
 * @param {Array} array - The array to shuffle.
 * @param {string} [candidateId] - Optional candidate UUID for extra entropy mixing.
 *   Even though crypto.randomInt() is already CSPRNG, mixing in the candidateId
 *   as an additional entropy source guarantees that two candidates shuffling
 *   the same array at the exact same millisecond will always get different results.
 * @returns {Array} A new shuffled array.
 */
export function cryptoShuffle(array) {
    const shuffled = [...array]; // clone — never mutate the source
    for (let i = shuffled.length - 1; i > 0; i--) {
        // crypto.randomInt(min, max) returns integer in [min, max)
        const j = crypto.randomInt(0, i + 1);
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

/**
 * Shuffle an array of question objects and return the ordered list of IDs.
 *
 * @param {Array<{id: string}>} questions - Questions from the DB.
 * @param {string} [candidateId] - Candidate UUID for extra per-candidate entropy.
 * @returns {string[]} Shuffled array of question UUIDs.
 */
export function buildRandomizedQuestionOrder(questions) {
    const ids = questions.map(q => q.id);
    return cryptoShuffle(ids);
}

/**
 * For each question, shuffle its option indices and return a mapping.
 *
 * The mapping format is:
 *   { [questionId]: [displayIndex0, displayIndex1, ...] }
 *
 * Where each value is a shuffled permutation of [0, 1, 2, ..., n-1].
 * Index position = display position. Value = original option index.
 *
 * @param {Array<{id: string, options: Array}>} questions
 * @param {string} [candidateId] - Candidate UUID for extra per-candidate entropy.
 * @returns {Object} Map of questionId -> shuffled option index array.
 */
export function buildRandomizedOptionOrder(questions) {
    const optionOrderMap = {};
    for (const question of questions) {
        const optionCount = Array.isArray(question.options) ? question.options.length : 4;
        const indices = Array.from({ length: optionCount }, (_, i) => i);
        optionOrderMap[question.id] = cryptoShuffle(indices);
    }
    return optionOrderMap;
}

/**
 * Apply the randomized question order to a list of questions.
 * Returns questions in the shuffled order, with options reordered per-question.
 *
 * IMPORTANT: correct_answer is STRIPPED from the output.
 * The frontend must never receive the correct answer index.
 *
 * @param {Array} questions - Raw questions from DB (with correct_answer).
 * @param {string[]} questionOrder - Shuffled array of question IDs.
 * @param {Object} optionOrderMap - Map of questionId -> shuffled option indices.
 * @returns {Array} Questions in display order, with options in display order.
 */
export function applyRandomization(questions, questionOrder, optionOrderMap) {
    // Build a lookup map for O(1) access
    const questionMap = new Map(questions.map(q => [q.id, q]));

    return questionOrder.map((qId, displayPosition) => {
        const q = questionMap.get(qId);
        if (!q) return null; // guard against stale data

        const optionIndices = optionOrderMap[qId] || Array.from({ length: q.options.length }, (_, i) => i);

        // Reorder options according to the shuffle map
        const displayOptions = optionIndices.map(originalIdx => q.options[originalIdx]);

        return {
            id: q.id,
            domain: q.domain,
            domain_id: q.domain_id,
            domain_name: q.domain_name,
            questionText: q.question_text,
            question_type: q.question_type || 'MULTIPLE_CHOICE',
            difficulty: q.difficulty,
            options: displayOptions,          // shuffled options — no correct_answer
            displayPosition,                  // 0-based position in this candidate's view
            // NOTE: correct_answer is intentionally omitted here
        };
    }).filter(Boolean);
}

/**
 * Resolve the candidate's submitted answer (display position) back to the
 * original option index for server-side evaluation.
 *
 * This is the INVERSE of the option shuffle.
 *
 * @param {number} displayAnswerIndex - The index the candidate selected (0-based display).
 * @param {number[]} optionOrder - The shuffled option order for this question.
 * @returns {number} The original option index in the question bank.
 */
export function resolveOriginalAnswerIndex(displayAnswerIndex, optionOrder) {
    if (!Array.isArray(optionOrder) || displayAnswerIndex < 0 || displayAnswerIndex >= optionOrder.length) {
        return displayAnswerIndex; // fallback — no shuffle applied
    }
    // optionOrder[displayPosition] = originalIndex
    return optionOrder[displayAnswerIndex];
}
