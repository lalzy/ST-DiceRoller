// Sheet rolls for the popup: what each tab lists, and the roll each pick makes.
// Every number comes from the character sheet and the chat's game system pack; nothing here is tied to one game.
import { signedAdd } from '../../rolls/dice.js';
import { critLists, statMod, statScore } from '../../system/resolve.js';
import { isExtended, diceText } from '../../system/pool.js';

export const moreOf = (r) => (Array.isArray(r.more) ? r.more.filter(m => Number(m.n) > 0).map(m => `+${m.n}d${m.sides}`).join('') : '');
export const plainName = (ch) => String(ch?.name || '').replace(/ \(you\)$/, '');
const lc = (s) => String(s || '').trim().toLowerCase();

/** The sheet's combat entries tagged with their position (an attack's damage entry follows it). */
const indexed = (ch) => (ch?.combat || []).map((r, i) => ({ ...r, _i: i }));
const isAttack = (r) => r.kind !== 'damage' && (r.group === 'Attack' || (r.group === 'Abilities' && r.attack !== false));

/** Check tab: everything the sheet lists to roll against; with `defenses`, also the parries / blocks only sent for combat. */
export function checkList(ch, defenses) {
    // abilities that work automatically have no level to roll against (the sheet may still list them)
    const auto = new Set(indexed(ch).filter(r => r.hits === 'auto').map(r => lc(r.name)));
    const list = (ch?.rollables || []).filter(r => !auto.has(lc(r.name))).map(r => ({ ...r }));
    if (defenses) {
        const have = new Set(list.map(r => lc(r.name)));
        for (const r of indexed(ch)) if (r.kind === 'roll' && r.group === 'Defense' && !have.has(lc(r.name))) list.push({ ...r });
    }
    return list;
}
export const attackList = (ch) => indexed(ch).filter(isAttack);
export const damageList = (ch) => indexed(ch).filter(r => r.kind === 'damage');

/** The damage entry an attack makes, or null. */
export function damageFor(ch, atk) {
    const next = atk ? ch?.combat?.[atk._i + 1] : null;
    return next && next.kind === 'damage' ? { ...next, _i: atk._i + 1 } : null;
}

export const listFor = (tab, ch, defenses) => (tab === 'attack' ? attackList(ch) : tab === 'damage' ? damageList(ch) : checkList(ch, defenses));

/** "1d+2 cut", "2d6+1d8+3 fire", flat "3". */
export function damageDice(r) {
    const n = Number(r.n);
    return `${n > 0 ? `${n}d${r.sides || 6}${moreOf(r)}${signedAdd(Number(r.add) || 0)}` : `${Number(r.add) || 0}`}${r.type ? ` ${r.type}` : ''}`;
}

/** The value shown beside an entry: a target / bonus for rolls, the dice for damage. */
export function valueText(pack, tab, r) {
    if (tab === 'damage' || r.kind === 'damage') return damageDice(r);
    if (r.hits === 'auto') return 'auto';
    return pack.test === 'over' ? (signedAdd(Number(r.target)) || '+0') : String(r.target);
}

/** Small details shown under an attack: delivery, range or reach, ammo, cost, charges. */
export function attackMeta(r) {
    const out = [];
    if (r.ability) out.push(r.ability);
    if (r.use) out.push(r.use);
    if (Number(r.reach) > 0 && r.use === 'melee') out.push(`reach ${r.reach}`);
    if (Number(r.range) > 0 && r.use !== 'melee' && r.range < 1000) out.push(`range ${r.range}`);
    for (const a of Array.isArray(r.ammo) ? r.ammo : []) out.push(`${a.item} ${a.left}${Number(a.per) > 1 ? ` (${a.per} a shot)` : ''}`);
    if (Number(r.cost) > 0 && !r.charges) out.push(`${r.cost} ${String(r.resource || '').replace(/^[a-z]+:/i, '')}`.trim());
    if (r.charges) out.push(`${r.charges.left} of ${r.charges.max} ${r.charges.pool}`);
    if (r.hits === 'auto') out.push('works automatically');
    return out.join(' · ');
}

/** The group an entry is listed under: its item for attacks and damage, else the sheet's group. */
export const groupOf = (tab, r) => (tab !== 'check' && r.item ? r.item : r.group || '');

/** The passive number an attack must reach against `vs` (sheet AC, else the pack's base + stat modifier). */
function passiveOf(pack, vs) {
    if (!vs) return null;
    if (vs.ac !== null && vs.ac !== undefined && Number.isFinite(Number(vs.ac))) return Number(vs.ac);
    const score = statScore(pack, vs.attrs, pack.defense.passiveStat);
    return pack.defense.passiveBase + (score !== null ? Math.floor(statMod(pack, score)) : 0);
}

/** The default target number of a check or attack in an 'over' pack. */
export function defaultDc(pack, tab, vs) {
    if (pack.test !== 'over') return null;
    if (tab === 'attack' && pack.defense.model === 'passive') return passiveOf(pack, vs) ?? pack.checks.normal;
    return pack.checks.normal;
}

/**
 * buildRollText arguments for a check or an attack, read through the pack.
 * under: the dice must come in at or under the value; over: dice + value must meet the target number (dc).
 * @returns {{ args: object, info: string }}
 */
export function testRoll(pack, ch, r, { mod = 0, dc = null, vs = null, tab = 'check' } = {}) {
    const prefix = ch.prefix ? `${ch.prefix} ` : '';
    const modTxt = mod ? ` ${signedAdd(mod)}` : '';
    const value = (Number(r.target) || 0) + mod;
    const cl = critLists(pack, value);
    const crit = pack.crit.mode === 'none' ? { critSuccess: '', critFail: '' } : { critSuccess: cl.success, critFail: cl.failure, natural: pack.crit.mode === 'natural' };
    const at = tab === 'attack' && vs ? ` at ${plainName(vs)}` : '';
    const skill = `${prefix}${r.name}${modTxt}${at}`;
    const args = { skill, count: pack.dice.count, die: pack.dice.die, crit };
    // custom faces, pools, kept dice, mixed kinds: the pack rolls it (buildRollText hands it to the game system)
    if (isExtended(pack)) {
        const target = pack.test === 'over' ? (Number.isFinite(Number(dc)) && dc !== '' && dc !== null ? Number(dc) : defaultDc(pack, tab, vs)) : null;
        Object.assign(args, { system: { pack, value, dc: target } });
        return { args, info: `${r.name} ${pack.test === 'over' ? signedAdd(value) || '+0' : value} · ${diceText(pack)}${target !== null ? ` vs ${pack.labels.target} ${target}` : ''}` };
    }
    if (pack.test === 'over') {
        const target = Number.isFinite(Number(dc)) && dc !== '' && dc !== null ? Number(dc) : defaultDc(pack, tab, vs);
        Object.assign(args, { cmp: '>=', bonus: value, target: String(target) });
        return { args, info: `${r.name} ${signedAdd(Number(r.target)) || '+0'}${mod ? `${modTxt} = ${signedAdd(value) || '+0'}` : ''} vs ${tab === 'attack' && pack.defense.model === 'passive' ? pack.defense.passiveName : pack.labels.target} ${target}` };
    }
    Object.assign(args, { cmp: '<=', bonus: 0, target: String(value) });
    const defends = tab === 'attack' && vs && pack.defense.model === 'active' ? ` · ${plainName(vs)} may defend` : '';
    return { args, info: `${r.name} ${r.target}${mod ? `${modTxt} = ${value}` : ''}${defends}` };
}

/**
 * buildRollText arguments for a damage roll. Armor is taken off only when the pack's armor soaks damage
 * (armor 'reduce'); wound multipliers only when the pack uses them.
 */
export function damageRoll(pack, ch, r, { mod = 0, vs = null, minDamage = '', minInjury = '' } = {}) {
    const prefix = ch.prefix ? `${ch.prefix} ` : '';
    const soak = pack.armor === 'reduce' && vs;
    const flat = !(Number(r.n) > 0);
    const add = (Number(r.add) || 0) + mod;
    const damage = {
        add, more: Array.isArray(r.more) ? r.more : [], type: r.type, mult: pack.damage.multipliers ? (r.mult ?? 1) : 1,
        dr: soak ? Number(vs.dr) || 0 : 0, vs: soak ? plainName(vs) : '', minDamage, minInjury,
    };
    const args = { skill: `${prefix}${r.name}`, count: flat ? 1 : r.n, die: Number(r.sides) || 6, damage, flat };
    const info = `${flat ? `flat ${add}` : `${r.n}d${args.die}${moreOf(r)}${signedAdd(add)}`}${r.type ? ` ${r.type}` : ''}${soak ? ` vs armor ${damage.dr}` : ''}`;
    return { args, info };
}
