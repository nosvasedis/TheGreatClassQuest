/**
 * The Torn Map content for every league: five map adventures of six story riddles each, plus a
 * reserve of single riddles for retries. Pure data; lazy-loaded by features/trainingGrounds.js.
 * Tests: tests/training-grounds-content.test.mjs (every clue rules out exactly one wrong answer).
 */

import * as prejunior from './map/prejunior.mjs';
import * as juniorA from './map/juniorA.mjs';
import * as juniorB from './map/juniorB.mjs';
import * as a from './map/a.mjs';
import * as b from './map/b.mjs';
import * as c from './map/c.mjs';
import * as d from './map/d.mjs';

const BY_LEAGUE = { prejunior, juniorA, juniorB, a, b, c, d };

export const MAP_ADVENTURES = Object.freeze(Object.fromEntries(Object.entries(BY_LEAGUE).map(([k, m]) => [k, Object.freeze(m.ADVENTURES)])));
export const MAP_RESERVE = Object.freeze(Object.fromEntries(Object.entries(BY_LEAGUE).map(([k, m]) => [k, Object.freeze(m.RESERVE)])));

/** Sentence frames for pooling the clues, built on each league's grammar. */
export const MAP_FRAMES = Object.freeze({
    prejunior: ['It is…', 'Not the…', 'Yes!', 'No!'],
    juniorA: ['Our clue says…', 'It isn’t the…', 'I think it’s the…', 'Do you agree?'],
    juniorB: ['Our clue said…', 'So it wasn’t the…', 'I think it was the…', 'Do you agree?'],
    a: ['Our scrap says that…', 'That means it can’t be the…', 'It was bigger / smaller than…', 'Does everyone agree?'],
    b: ['Our scrap says…, so…', 'It can’t be the … because…', 'If we put our clues together…', 'Does everyone agree?'],
    c: ['According to our scrap…', 'That rules out the…, which…', 'We have already ruled out…', 'Is anyone unsure? Let’s check.'],
    d: ['Our scrap suggests that…', 'It can’t have been the…', 'Unless we’ve missed something, it must be…', 'Had we chosen the…, we would have been wrong.']
});
