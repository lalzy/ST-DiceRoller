export const MODULE = 'roll_dice';
export const DIE_TYPES = [1, 2, 3, 4, 6, 8, 10, 12, 20, 100];
export const COMPARATORS = ['>', '>=', '<', '<='];
export const PRESETS = ['skill', 'combat'];
export const PRESET_LABEL = { skill: 'Skill', combat: 'Combat' };
/**
 * Default dice per preset. critSuccess / critFail are optional lists of dice totals
 * ("3-4, 18") that the user fills in for their own game system. They ship empty.
 */
export const DEFAULTS = {
    skill: { count: 3, die: 6, cmp: '<=', critSuccess: '', critFail: '' },  // roll under a target
    combat: { count: 1, die: 20, cmp: '>=', critSuccess: '', critFail: '' }, // meet or beat a target
};
/** Optional damage floors, user-filled. Empty = 0. */
export const DAMAGE_DEFAULTS = { minDamage: '', minInjury: '' };
