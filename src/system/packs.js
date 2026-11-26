// Game system packs: how a roll is made and read. Generic mechanics only, no game's rules text.
//
// A pack answers:
//   dice      what is rolled for a check                      { count, die }
//   test      'under': the dice total must be at or below the target value (value = skill / attribute)
//             'over':  dice total + value must meet or beat a target number (value = bonus)
//   crit      { mode: 'total' | 'natural' | 'none', success, failure, successMax, failureMin, effect }
//             successMax / failureMin: formulas on {SKILL} (the value rolled with); a roll at or below successMax is a
//             critical success, at or above failureMin a critical failure, on top of the lists (e.g. "4 + min(2, max(0, {SKILL} - 14))")
//             total: the dice sum is checked against the lists; natural: the face of the first die is
//             effect on a critical hit: 'none' | 'double' (damage dice twice) | 'max' (dice at max) | 'nodefense'
//   defense   { model: 'active' | 'passive', names, retreat, passiveName, passiveBase, passiveStat, against }
//             active: the defender rolls one of `names` (matched on the sheet); passive: the attack must reach a
//             fixed number (sheet `ac`, else passiveBase + the stat modifier of passiveStat)
//             against: { melee: [names], ranged: [names] } which defenses work against melee / ranged attacks
//             (weapons and abilities alike; a missing kind = every defense). An ability's own "defended by" wins.
//             perTurn: { name: n } how often each defense can be used between the defender's turns (missing = no limit);
//             again: { name: mod } a defense used past its limit is still allowed at this modifier per extra use (missing = not allowed)
//   armor     'reduce' (armor subtracts from damage) | 'class' (armor adds to the passive defense instead)
//   damage    { multipliers: use wound multipliers from the sheet; bonus: { melee, ranged } stat roles whose modifier adds to damage,
//               weapons: [{ match, stats }]: a weapon whose name or stat text holds the word `match` adds the best modifier of `stats` instead }
//   stats     role → names a sheet may use for it (first = label). A pack that sets `stats` defines exactly its roles:
//             any role names, and no others are added. The engine's own uses (strength, agility, mind, health, will, perception)
//             are only filled in from the built-in pack when the pack leaves `stats` out.
//   statMod   formula on `score` turning an attribute into the number rolled with ('score' = use it as is)
//   checks    { easy, normal, hard }: modifiers (under) or target numbers (over) for plain checks
//   caps      { situation, judge }: the most free-form situation modifiers / an LLM judgement may add, either way
//   aim       bonus for aiming (null = use the Combat rules value)
//   labels    words used in logs and prompts

import { evalSkillFormula } from './formula.js';

export const STAT_ROLES = ['strength', 'agility', 'mind', 'health', 'will', 'perception'];

export const CLASSIC_3D6 = {
    id: 'classic-3d6',
    name: 'Classic 3d6',
    dice: { count: 3, die: 6 },
    test: 'under',
    crit: { mode: 'none', success: '', failure: '', successMax: '', failureMin: '', effect: 'none' },
    defense: { model: 'active', names: ['dodge', 'parry', 'block'], retreat: false, passiveName: 'defense', passiveBase: 10, passiveStat: 'agility' },
    armor: 'reduce',
    damage: { multipliers: true, bonus: { melee: '', ranged: '' } },
    stats: {
        strength: ['Strength', 'Str'],
        agility: ['Agility', 'Agi', 'Dexterity', 'Dex'],
        mind: ['Mind', 'Intellect', 'Int'],
        health: ['Health', 'Body', 'Constitution', 'Con'],
        will: ['Will', 'Resolve'],
        perception: ['Perception', 'Awareness'],
    },
    statMod: 'score',
    checks: { easy: 3, normal: 0, hard: -3 },
    caps: { situation: 6, judge: 4 },
    aim: null,
    labels: { value: 'skill', target: 'target', passive: 'defense' },
};

export const GENERIC_D20 = {
    id: 'generic-d20',
    name: 'Generic d20',
    dice: { count: 1, die: 20 },
    test: 'over',
    crit: { mode: 'natural', success: '20', failure: '1', successMax: '', failureMin: '', effect: 'double' },
    defense: { model: 'passive', names: [], retreat: false, passiveName: 'AC', passiveBase: 10, passiveStat: 'agility' },
    armor: 'class',
    damage: { multipliers: false, bonus: { melee: 'strength', ranged: 'agility' } },
    stats: {
        strength: ['Strength', 'Str'],
        agility: ['Agility', 'Agi', 'Dexterity', 'Dex'],
        mind: ['Mind', 'Intellect', 'Int'],
        health: ['Health', 'Body', 'Constitution', 'Con'],
        will: ['Will', 'Resolve'],
        perception: ['Perception', 'Awareness'],
    },
    statMod: 'floor((score - 10) / 2)',
    checks: { easy: 10, normal: 15, hard: 20 },
    caps: { situation: 5, judge: 4 },
    aim: 2,
    labels: { value: 'bonus', target: 'DC', passive: 'AC' },
};

/**
 * The default pack: made to match the character sheet's "Generic (default)" rule set (attributes Body / Agility / Mind /
 * Spirit as target numbers, 10 = average; Dodge, Parry and Block as defenses; armor that soaks damage; wound multipliers).
 * Every value is meant to be edited: duplicate it in Rules templates.
 */
export const GENERIC = {
    id: 'generic-default',
    name: 'Generic (default)',
    dice: { count: 3, die: 6 },
    test: 'under',
    crit: { mode: 'total', success: '3-4', failure: '17-18', successMax: '', failureMin: '', effect: 'none' },
    defense: { model: 'active', names: ['dodge', 'parry', 'block'], retreat: false, passiveName: 'defense', passiveBase: 10, passiveStat: 'agility',
        against: { melee: ['dodge', 'parry', 'block'], ranged: ['dodge', 'block'] } },
    armor: 'reduce',
    damage: { multipliers: true, bonus: { melee: '', ranged: '' } },
    stats: {
        strength: ['Body', 'BOD'],
        agility: ['Agility', 'AGI'],
        mind: ['Mind', 'MND'],
        spirit: ['Spirit', 'SPI'],
        health: ['Body', 'BOD'],
        will: ['Will', 'Mind', 'MND'],
        perception: ['Perception', 'Mind', 'MND'],
    },
    statMod: 'score',
    checks: { easy: 3, normal: 0, hard: -3 },
    caps: { situation: 6, judge: 4 },
    aim: null,
    labels: { value: 'skill', target: 'target', passive: 'defense' },
};

/** The pack new installs start with. */
export const DEFAULT_PACK = GENERIC;

export const BUILT_IN = [GENERIC, CLASSIC_3D6, GENERIC_D20];

const num = (v, d) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? d : Number(v));
const str = (v, d) => (v === null || v === undefined ? d : String(v));
const oneOf = (v, list, d) => (list.includes(v) ? v : d);

/** A critical-range formula that reads ('' when empty or broken). */
function critFormula(v) {
    const s = v === null || v === undefined ? '' : String(v).trim();
    return s && evalSkillFormula(s, 10) !== null ? s : '';
}

/** Fill and validate a pack (custom JSON or a saved copy). Missing keys come from the built-in pack it is closest to. */
/** { name: number } with lower-case names; values that aren't numbers are dropped (min: the smallest allowed, null = any). */
function countMap(m, min) {
    if (!m || typeof m !== 'object' || Array.isArray(m)) return {};
    return Object.fromEntries(Object.entries(m).filter(([k, v]) => String(k).trim() && v !== '' && v !== null && Number.isFinite(Number(v)))
        .map(([k, v]) => [String(k).toLowerCase().trim(), min === null ? Number(v) : Math.max(min, Math.floor(Number(v)))]));
}

export function normalizePack(p) {
    const src = p && typeof p === 'object' ? p : {};
    const base = src.test === 'over' || src.base === GENERIC_D20.id ? GENERIC_D20 : CLASSIC_3D6;
    const d = src.dice || {};
    const c = src.crit || {};
    const df = src.defense || {};
    const dm = src.damage || {};
    const out = {
        id: str(src.id, base.id).trim().toLowerCase().replace(/\s+/g, '-') || base.id,
        name: str(src.name, base.name).trim() || base.name,
        dice: { count: Math.min(20, Math.max(1, Math.floor(num(d.count, base.dice.count)))), die: Math.min(1000, Math.max(2, Math.floor(num(d.die, base.dice.die)))) },
        test: oneOf(src.test, ['under', 'over'], base.test),
        crit: {
            mode: oneOf(c.mode, ['total', 'natural', 'none'], base.crit.mode),
            success: str(c.success, base.crit.success),
            failure: str(c.failure, base.crit.failure),
            successMax: critFormula(c.successMax),
            failureMin: critFormula(c.failureMin),
            effect: oneOf(c.effect, ['none', 'double', 'max', 'nodefense'], base.crit.effect),
        },
        defense: {
            model: oneOf(df.model, ['active', 'passive'], base.defense.model),
            names: (Array.isArray(df.names) ? df.names : base.defense.names).map(x => String(x).toLowerCase().trim()).filter(Boolean),
            retreat: typeof df.retreat === 'boolean' ? df.retreat : base.defense.retreat,
            passiveName: str(df.passiveName, base.defense.passiveName),
            passiveBase: num(df.passiveBase, base.defense.passiveBase),
            passiveStat: str(df.passiveStat, base.defense.passiveStat).trim(),
            against: Object.fromEntries(['melee', 'ranged'].filter(k => Array.isArray(df.against?.[k]))
                .map(k => [k, df.against[k].map(x => String(x).toLowerCase().trim()).filter(Boolean)])),
            perTurn: countMap(df.perTurn, 1),
            again: countMap(df.again, null),
        },
        armor: oneOf(src.armor, ['reduce', 'class'], base.armor),
        damage: {
            multipliers: typeof dm.multipliers === 'boolean' ? dm.multipliers : base.damage.multipliers,
            bonus: {
                melee: str(dm.bonus?.melee, base.damage.bonus.melee).trim(),
                ranged: str(dm.bonus?.ranged, base.damage.bonus.ranged).trim(),
                weapons: (Array.isArray(dm.bonus?.weapons) ? dm.bonus.weapons : [])
                    .filter(w => w && String(w.match || '').trim())
                    .map(w => ({ match: String(w.match).trim().toLowerCase(), stats: (Array.isArray(w.stats) ? w.stats : [w.stats]).map(x => String(x || '').trim()).filter(Boolean) }))
                    .filter(w => w.stats.length),
            },
        },
        stats: {},
        statMod: str(src.statMod, base.statMod).trim() || 'score',
        checks: {
            easy: num(src.checks?.easy, base.checks.easy),
            normal: num(src.checks?.normal, base.checks.normal),
            hard: num(src.checks?.hard, base.checks.hard),
        },
        caps: { situation: Math.max(0, num(src.caps?.situation, base.caps.situation)), judge: Math.max(0, num(src.caps?.judge, base.caps.judge)) },
        aim: src.aim === null ? null : num(src.aim, base.aim),
        labels: { ...base.labels, ...(src.labels && typeof src.labels === 'object' ? src.labels : {}) },
    };
    // the pack's own roles, exactly as it defines them; only a pack without `stats` gets the built-in ones
    const own = src.stats && typeof src.stats === 'object' && !Array.isArray(src.stats) ? src.stats : null;
    for (const [role, names] of Object.entries(own || base.stats)) {
        const key = String(role).trim().toLowerCase();
        if (!key) continue;
        out.stats[key] = (Array.isArray(names) ? names : [names]).map(x => String(x ?? '').trim()).filter(Boolean);
    }
    if (out.dice.count > 1 && out.crit.mode === 'natural') out.crit.mode = 'total';
    return out;
}
