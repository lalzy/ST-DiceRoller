import { MODULE, PRESETS, DEFAULTS } from './constants.js';
import { ctx } from './context.js';
import { clampCount, validDie, validCmp } from './validate.js';

/** Read (and normalize / migrate) this extension's settings. */
export function settings() {
    const all = ctx().extensionSettings;
    const s = all[MODULE] || {};
    // migrate v1/v2 settings ({count, die}) into the skill preset
    if (!s.skill && (s.count || s.die)) s.skill = { count: s.count, die: s.die };
    for (const p of PRESETS) {
        const cur = s[p] || {};
        s[p] = {
            count: clampCount(cur.count ?? DEFAULTS[p].count),
            die: validDie(cur.die) ?? DEFAULTS[p].die,
            cmp: validCmp(cur.cmp) ?? DEFAULTS[p].cmp,
        };
    }
    delete s.count; delete s.die;
    all[MODULE] = s;
    return s;
}

export function saveSettings() {
    ctx().saveSettingsDebounced();
}
