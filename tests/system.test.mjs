import test from 'node:test';
import assert from 'node:assert/strict';
import { CLASSIC_3D6, GENERIC_D20, normalizePack } from '../src/system/packs.js';
import { read, test as check, describe, chance, statMod, statScore, statRole, evalStatMod } from '../src/system/resolve.js';
import { buildRollText } from '../src/rolls/rollText.js';

const classic = normalizePack({ ...CLASSIC_3D6, crit: { mode: 'total', success: '3-4', failure: '17-18' } });
const plain = normalizePack(CLASSIC_3D6);
const d20 = normalizePack(GENERIC_D20);

test('classic: roll at or under the value, criticals by total', () => {
    assert.equal(read(classic, [4, 3, 2], 12).success, true);
    assert.equal(read(classic, [4, 3, 2], 12).margin, 3);
    assert.equal(read(classic, [6, 6, 1], 12).success, false);
    assert.equal(read(classic, [1, 1, 2], 2).crit, 'success');
    assert.equal(read(classic, [6, 6, 5], 20).crit, 'failure');
    assert.equal(describe(read(classic, [4, 3, 2], 12), classic), '4 + 3 + 2 = 9 vs 12 · success by 3');
});

test('d20: dice + bonus meets or beats the target, natural 20 / 1', () => {
    const r = read(d20, [12], 5, 15);
    assert.equal(r.total, 17);
    assert.equal(r.success, true);
    assert.equal(r.margin, 2);
    assert.equal(describe(r, d20), '12 + 5 = 17 vs DC 15 · success by 2');
    assert.equal(read(d20, [9], 5, 15).success, false);
    assert.equal(read(d20, [20], -5, 30).crit, 'success');
    assert.equal(read(d20, [1], 30, 5).crit, 'failure');
    assert.equal(read(d20, [10], 0).target, 15, 'no DC: the normal check');
});

test('chance matches the dice', () => {
    assert.ok(Math.abs(chance(classic, 10) - 0.5) < 1e-9);
    assert.ok(Math.abs(chance(d20, 5, 15) - 0.55) < 1e-9);
    assert.ok(Math.abs(chance(d20, 0, 30) - 0.05) < 1e-9, 'only a natural 20');
});

test('test() uses the supplied dice', () => {
    const faces = [5, 5, 5];
    const r = check(classic, 14, { roll: () => faces.shift() });
    assert.equal(r.total, 15);
    assert.equal(r.success, false);
});

test('stat modifiers and names', () => {
    assert.equal(statMod(classic, 14), 14);
    assert.equal(statMod(d20, 14), 2);
    assert.equal(statMod(d20, 9), -1);
    assert.equal(evalStatMod('max(0, score - 10)', 8), 0);
    assert.equal(evalStatMod('process.exit()', 12), 12, 'anything else: the score as is');
    assert.equal(statScore(d20, { Dex: 16 }, 'agility'), 16);
    assert.equal(statScore(classic, { Agility: 12 }, 'agility'), 12);
    assert.equal(read(plain, [1, 1, 1], 2).crit, null, 'the shipped 3d6 pack has no criticals');
    assert.equal(statRole(d20, 'Str'), 'strength');
});

test('normalizePack fills gaps from the closest built-in pack', () => {
    const p = normalizePack({ id: 'My D10', test: 'over', dice: { count: 1, die: 10 } });
    assert.equal(p.id, 'my-d10');
    assert.equal(p.defense.model, 'passive');
    assert.equal(p.dice.die, 10);
    const q = normalizePack({ dice: { count: 2, die: 10 }, crit: { mode: 'natural' } });
    assert.equal(q.crit.mode, 'total', 'natural criticals need a single die');
});

test('roll text with a bonus and natural criticals', () => {
    assert.equal(buildRollText({ skill: 'Stealth', count: 1, die: 20, cmp: '>=', target: 15, bonus: 5, crit: { critSuccess: '20', critFail: '1', natural: true } }, [12]),
        'Stealth Roll (1d20+5 vs >= 15): 12 + 5 = 17 (Success by 2)');
    assert.equal(buildRollText({ count: 1, die: 20, cmp: '>=', target: 40, bonus: 1, crit: { critSuccess: '20', natural: true } }, [20]),
        'Roll (1d20+1 vs >= 40): 20 + 1 = 21 (Critical Success)');
    assert.equal(buildRollText({ skill: 'Sword', count: 3, die: 6, cmp: '<=', target: 12 }, [4, 3, 2]), 'Sword Roll (3d6 vs <= 12): 4 + 3 + 2 = 9 (Success by 3)');
});
