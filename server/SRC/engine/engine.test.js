/**
 * Test suite for game engine components
 * Run with: node --test src/engine/*.test.js
 */

import { test } from 'node:test';
import assert from 'node:assert';
import { Deck } from '../engine/Deck.js';
import { HandEvaluator } from '../engine/HandEvaluator.js';
import { BlindManager } from '../engine/BlindManager.js';
import { ActionValidator } from '../engine/ActionValidator.js';
import { SidePotCalculator } from '../engine/SidePotCalculator.js';
import { ShowdownResolver } from '../engine/ShowdownResolver.js';

test('Deck: shuffle and deal', () => {
  const deck = new Deck();
  deck.shuffle('test-seed-123');

  const cards = deck.deal(5);
  assert.strictEqual(cards.length, 5);
  assert.strictEqual(deck.remaining, 47);
});

test('Deck: deterministic shuffle', () => {
  const deck1 = new Deck();
  deck1.shuffle('same-seed');
  const cards1 = deck1.deal(10);

  const deck2 = new Deck();
  deck2.shuffle('same-seed');
  const cards2 = deck2.deal(10);

  assert.deepStrictEqual(cards1, cards2);
});

test('HandEvaluator: pair detection', () => {
  const hand = ['As', 'Ad', 'Kh', 'Qc', 'Jh', 'Th', '9s'];
  const result = HandEvaluator.evaluate(hand);

  assert.strictEqual(result.name, 'One Pair');
  assert.strictEqual(result.rank, 1);
});

test('HandEvaluator: flush detection', () => {
  const hand = ['As', '2s', '3s', '4s', '5s', 'Kh', 'Qd'];
  const result = HandEvaluator.evaluate(hand);

  assert.strictEqual(result.name, 'Flush');
  assert.strictEqual(result.rank, 5);
});

test('HandEvaluator: straight detection', () => {
  const hand = ['9h', '8d', '7c', '6s', '5h', 'Kc', 'Qd'];
  const result = HandEvaluator.evaluate(hand);

  assert.strictEqual(result.name, 'Straight');
  assert.strictEqual(result.rank, 4);
});

test('HandEvaluator: wheel straight', () => {
  const hand = ['As', '2d', '3c', '4h', '5s', 'Kc', 'Qd'];
  const result = HandEvaluator.evaluate(hand);

  assert.strictEqual(result.name, 'Straight');
  assert.strictEqual(result.rank, 4);
});

test('BlindManager: button rotation', () => {
  const blindManager = new BlindManager(50, 100);
  const players = [
    { id: 'p1', stack: 1000, betThisStreet: 0 },
    { id: 'p2', stack: 1000, betThisStreet: 0 },
    { id: 'p3', stack: 1000, betThisStreet: 0 },
  ];

  const result1 = blindManager.postBlinds(players, -1);
  assert.strictEqual(result1.dealerIndex, 0);

  const result2 = blindManager.postBlinds(players, 0);
  assert.strictEqual(result2.dealerIndex, 1);
});

test('ActionValidator: fold always valid', () => {
  const state = {
    players: [{ id: 'p1', folded: false, stack: 100 }],
    activePlayerId: 'p1',
    currentBet: 0,
  };

  const result = ActionValidator.validate(state, 'p1', { type: 'fold' });
  assert.strictEqual(result.valid, true);
});

test('ActionValidator: check requires no bet', () => {
  const state = {
    players: [{ id: 'p1', folded: false, stack: 100, betThisStreet: 0 }],
    activePlayerId: 'p1',
    currentBet: 100,
  };

  const result = ActionValidator.validate(state, 'p1', { type: 'check' });
  assert.strictEqual(result.valid, false);
});

test('SidePotCalculator: simple pot', () => {
  const players = [
    { id: 'p1', totalHandContribution: 100, folded: false },
    { id: 'p2', totalHandContribution: 100, folded: false },
  ];

  const pots = SidePotCalculator.calculate(players);
  assert.strictEqual(pots.length, 1);
  assert.strictEqual(pots[0].amount, 200);
  assert.deepStrictEqual(pots[0].eligiblePlayerIds, ['p1', 'p2']);
});

test('SidePotCalculator: all-in scenario', () => {
  const players = [
    { id: 'p1', totalHandContribution: 50, folded: false },
    { id: 'p2', totalHandContribution: 150, folded: false },
  ];

  const pots = SidePotCalculator.calculate(players);
  assert.strictEqual(pots.length, 2);
  assert.strictEqual(pots[0].amount, 100);
  assert.deepStrictEqual(pots[0].eligiblePlayerIds, ['p1', 'p2']);
});

test('ShowdownResolver: winner determination', () => {
  const players = [
    { id: 'p1', hand: ['As', 'Ad'], folded: false },
    { id: 'p2', hand: ['Ks', 'Kd'], folded: false },
  ];

  const communityCards = ['9h', '8c', '7s', '6d', '5h'];
  const sidePots = [{ amount: 200, eligiblePlayerIds: ['p1', 'p2'] }];

  const result = ShowdownResolver.resolve(players, communityCards, sidePots);

  assert.strictEqual(result.length, 1);
  assert.strictEqual(result[0].winners.length, 1);
  assert.strictEqual(result[0].share, 200);
});
