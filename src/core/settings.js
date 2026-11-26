import { MODULE, PRESETS, DEFAULTS, DAMAGE_DEFAULTS } from './constants.js';
import { ctx } from './context.js';


/** This extension's settings. The user's values always win: only missing keys get a default. */
export function settings() {
    const all = ctx().extensionSettings;
    const s = all[MODULE] || {};
    // very old settings ({count, die} at the top): use them for the skill preset when it has none
    if (!s.skill && (s.count || s.die)) s.skill = { count: s.count, die: s.die };
    for (const p of PRESETS) {
        s[p] = s[p] && typeof s[p] === 'object' ? s[p] : {};
        for (const [k, v] of Object.entries(DEFAULTS[p])) if (s[p][k] === undefined || s[p][k] === null) s[p][k] = v;
    }
    s.damage = s.damage && typeof s.damage === 'object' ? s.damage : {};
    for (const [k, v] of Object.entries(DAMAGE_DEFAULTS)) if (s.damage[k] === undefined) s.damage[k] = v;
    all[MODULE] = s;
    return s;
}

export function saveSettings() {
    ctx().saveSettingsDebounced();
}
