export const MODULE = 'roll_dice';
export const DIE_TYPES = [1, 2, 3, 4, 6, 8, 10, 12, 20, 100];
export const COMPARATORS = ['>', '>=', '<', '<='];
export const PRESETS = ['skill', 'combat'];
export const PRESET_LABEL = { skill: 'Skill', combat: 'Combat' };
export const DEFAULTS = {
    skill: { count: 3, die: 6, cmp: '<=' },   // GURPS-style: roll under skill
    combat: { count: 1, die: 20, cmp: '>=' }, // D&D-style: meet or beat AC/DC
};
