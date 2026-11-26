// Critical ranges that move with skill: pack crit.successMax / crit.failureMin, formulas on {SKILL}.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizePack } from '../src/system/packs.js';
import { read, chance, critLists } from '../src/system/resolve.js';

const P = normalizePack({ id: 'skill-crits', base: 'classic-3d6', crit: { mode: 'total', success: '', failure: '',
    successMax: '4 + min(2, max(0, {SKILL} - 14))', failureMin: 'min(17 + min(1, max(0, {SKILL} - 15)), {SKILL} + 10)' } });
const crit = (sum, skill) => read(P, [sum], skill).crit;

test('critical success range grows with skill', () => {
    assert.equal(crit(4, 8), 'success');
    assert.equal(crit(5, 14), null);
    assert.equal(crit(5, 15), 'success');
    assert.equal(crit(6, 15), null);
    assert.equal(crit(6, 16), 'success');
});

test('critical failure range shrinks with skill, and a roll 10 over skill is one', () => {
    assert.equal(crit(17, 15), 'failure');
    assert.equal(crit(17, 16), null);
    assert.equal(crit(18, 20), 'failure');
    assert.equal(crit(16, 6), 'failure');
    assert.equal(crit(15, 6), null);
});

test('critLists resolves the ranges for one value (for the roll popup); chance counts them', () => {
    assert.deepEqual(critLists(P, 16), { success: '3-6', failure: '18-18' });
    assert.deepEqual(critLists(P, 6), { success: '3-4', failure: '16-18' });
    // skill 2 can't succeed except on a critical success (3 or 4 on 3d6: 4 of 216)
    assert.equal(Math.round(chance(P, 2) * 216), 4);
});

test('broken or missing formulas are ignored', () => {
    const p = normalizePack({ crit: { mode: 'total', successMax: 'nope(' } });
    assert.equal(p.crit.successMax, '');
    assert.equal(normalizePack({}).crit.failureMin, '');
});
