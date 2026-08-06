/**
 * shuffleUtils.test.js
 * --------------------
 * Unit tests for the cryptographic shuffle utilities.
 *
 * Run with: npx jest src/utils/shuffleUtils.test.js
 */

import {
    cryptoShuffle,
    buildRandomizedQuestionOrder,
    buildRandomizedOptionOrder,
    applyRandomization,
    resolveOriginalAnswerIndex
} from './shuffleUtils.js';

// ---------------------------------------------------------------------------
// cryptoShuffle
// ---------------------------------------------------------------------------
describe('cryptoShuffle', () => {
    test('returns an array of the same length', () => {
        const input = [1, 2, 3, 4, 5];
        expect(cryptoShuffle(input)).toHaveLength(5);
    });

    test('contains all original elements (no loss, no duplication)', () => {
        const input = ['a', 'b', 'c', 'd'];
        const shuffled = cryptoShuffle(input);
        expect(shuffled.sort()).toEqual([...input].sort());
    });

    test('does not mutate the original array', () => {
        const input = [1, 2, 3];
        const original = [...input];
        cryptoShuffle(input);
        expect(input).toEqual(original);
    });

    test('handles empty array', () => {
        expect(cryptoShuffle([])).toEqual([]);
    });

    test('handles single-element array', () => {
        expect(cryptoShuffle([42])).toEqual([42]);
    });

    test('produces different orderings across multiple calls (statistical)', () => {
        // Run 20 shuffles of [0,1,2,3,4]. If all are identical, something is wrong.
        const input = [0, 1, 2, 3, 4];
        const results = new Set();
        for (let i = 0; i < 20; i++) {
            results.add(JSON.stringify(cryptoShuffle(input)));
        }
        // With 5! = 120 possible permutations, 20 runs should produce > 1 unique result
        expect(results.size).toBeGreaterThan(1);
    });
});

// ---------------------------------------------------------------------------
// buildRandomizedQuestionOrder
// ---------------------------------------------------------------------------
describe('buildRandomizedQuestionOrder', () => {
    const questions = [
        { id: 'q1', question_text: 'Q1', options: ['A', 'B', 'C', 'D'], correct_answer: 0 },
        { id: 'q2', question_text: 'Q2', options: ['A', 'B', 'C', 'D'], correct_answer: 1 },
        { id: 'q3', question_text: 'Q3', options: ['A', 'B', 'C', 'D'], correct_answer: 2 },
    ];

    test('returns an array of question IDs', () => {
        const order = buildRandomizedQuestionOrder(questions);
        expect(order).toHaveLength(3);
        expect(order).toContain('q1');
        expect(order).toContain('q2');
        expect(order).toContain('q3');
    });

    test('returns only IDs, not full question objects', () => {
        const order = buildRandomizedQuestionOrder(questions);
        order.forEach(item => expect(typeof item).toBe('string'));
    });
});

// ---------------------------------------------------------------------------
// buildRandomizedOptionOrder
// ---------------------------------------------------------------------------
describe('buildRandomizedOptionOrder', () => {
    const questions = [
        { id: 'q1', options: ['A', 'B', 'C', 'D'] },
        { id: 'q2', options: ['X', 'Y', 'Z'] },
    ];

    test('returns a map with an entry per question', () => {
        const map = buildRandomizedOptionOrder(questions);
        expect(map).toHaveProperty('q1');
        expect(map).toHaveProperty('q2');
    });

    test('each entry is a permutation of [0..n-1]', () => {
        const map = buildRandomizedOptionOrder(questions);
        expect(map['q1'].sort((a, b) => a - b)).toEqual([0, 1, 2, 3]);
        expect(map['q2'].sort((a, b) => a - b)).toEqual([0, 1, 2]);
    });

    test('each entry has the correct length', () => {
        const map = buildRandomizedOptionOrder(questions);
        expect(map['q1']).toHaveLength(4);
        expect(map['q2']).toHaveLength(3);
    });
});

// ---------------------------------------------------------------------------
// applyRandomization
// ---------------------------------------------------------------------------
describe('applyRandomization', () => {
    const questions = [
        { id: 'q1', domain: 'arithmetic', question_text: 'Q1', difficulty: 'easy', options: ['A', 'B', 'C', 'D'], correct_answer: 2 },
        { id: 'q2', domain: 'logical', question_text: 'Q2', difficulty: 'medium', options: ['X', 'Y', 'Z'], correct_answer: 1 },
    ];

    const questionOrder = ['q2', 'q1']; // q2 first
    const optionOrderMap = {
        'q1': [2, 0, 3, 1], // display: C, A, D, B
        'q2': [1, 2, 0],    // display: Y, Z, X
    };

    let result;
    beforeEach(() => {
        result = applyRandomization(questions, questionOrder, optionOrderMap);
    });

    test('returns questions in the specified order', () => {
        expect(result[0].id).toBe('q2');
        expect(result[1].id).toBe('q1');
    });

    test('reorders options according to the option map', () => {
        // q2: optionOrder [1,2,0] → display: Y, Z, X
        expect(result[0].options).toEqual(['Y', 'Z', 'X']);
        // q1: optionOrder [2,0,3,1] → display: C, A, D, B
        expect(result[1].options).toEqual(['C', 'A', 'D', 'B']);
    });

    test('NEVER includes correct_answer in output', () => {
        result.forEach(q => {
            expect(q).not.toHaveProperty('correct_answer');
        });
    });

    test('includes displayPosition', () => {
        expect(result[0].displayPosition).toBe(0);
        expect(result[1].displayPosition).toBe(1);
    });

    test('handles unknown question IDs in order gracefully', () => {
        const orderWithUnknown = ['q99', 'q1'];
        const output = applyRandomization(questions, orderWithUnknown, optionOrderMap);
        // q99 should be filtered out
        expect(output).toHaveLength(1);
        expect(output[0].id).toBe('q1');
    });
});

// ---------------------------------------------------------------------------
// resolveOriginalAnswerIndex — the CRITICAL evaluation function
// ---------------------------------------------------------------------------
describe('resolveOriginalAnswerIndex', () => {
    // optionOrder[displayPos] = originalIndex
    // q1: [2, 0, 3, 1] → display pos 0 = original 2, pos 1 = original 0, etc.
    const optionOrder = [2, 0, 3, 1];

    test('correctly maps display position 0 → original index 2', () => {
        expect(resolveOriginalAnswerIndex(0, optionOrder)).toBe(2);
    });

    test('correctly maps display position 1 → original index 0', () => {
        expect(resolveOriginalAnswerIndex(1, optionOrder)).toBe(0);
    });

    test('correctly maps display position 2 → original index 3', () => {
        expect(resolveOriginalAnswerIndex(2, optionOrder)).toBe(3);
    });

    test('correctly maps display position 3 → original index 1', () => {
        expect(resolveOriginalAnswerIndex(3, optionOrder)).toBe(1);
    });

    test('falls back to identity mapping when optionOrder is null', () => {
        expect(resolveOriginalAnswerIndex(2, null)).toBe(2);
    });

    test('falls back to identity mapping when optionOrder is not an array', () => {
        expect(resolveOriginalAnswerIndex(1, 'invalid')).toBe(1);
    });

    test('falls back when displayAnswerIndex is out of bounds', () => {
        expect(resolveOriginalAnswerIndex(99, optionOrder)).toBe(99);
    });

    // ── CRITICAL INTEGRITY TEST ──────────────────────────────────────────────
    // Simulate a full round-trip: shuffle options, candidate selects the
    // correct answer by display position, verify server resolves it correctly.
    test('round-trip: candidate selects correct answer → server evaluates correctly', () => {
        const originalOptions = ['Wrong A', 'Wrong B', 'Correct C', 'Wrong D'];
        const correctAnswerOriginalIndex = 2; // 'Correct C'

        // Simulate a shuffle: display order is [2, 0, 3, 1]
        // Display: ['Correct C', 'Wrong A', 'Wrong D', 'Wrong B']
        const shuffleMap = [2, 0, 3, 1];

        // Candidate sees 'Correct C' at display position 0 and selects it
        const candidateDisplaySelection = 0;

        // Server resolves to original index
        const resolved = resolveOriginalAnswerIndex(candidateDisplaySelection, shuffleMap);

        // Must equal the correct answer's original index
        expect(resolved).toBe(correctAnswerOriginalIndex);
    });

    test('round-trip: candidate selects wrong answer → server evaluates as wrong', () => {
        const correctAnswerOriginalIndex = 2;
        const shuffleMap = [2, 0, 3, 1];

        // Candidate selects display position 1 ('Wrong A' = original index 0)
        const candidateDisplaySelection = 1;
        const resolved = resolveOriginalAnswerIndex(candidateDisplaySelection, shuffleMap);

        expect(resolved).not.toBe(correctAnswerOriginalIndex);
        expect(resolved).toBe(0); // original index of 'Wrong A'
    });
});
