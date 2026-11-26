// Game system packs: storage (default + custom in settings, choice per chat) and the API other extensions use.
import { MODULE } from '../core/constants.js';
import { BUILT_IN, DEFAULT_PACK, STAT_ROLES, normalizePack } from './packs.js';
import { test, read, describe, chance, statMod, statScore, statRole, evalStatMod, critLists, critBounds } from './resolve.js';
import { isTemplateStore } from '../ui/rulesTemplates.js';

const ctx = () => (typeof SillyTavern !== 'undefined' ? SillyTavern.getContext() : null);

function store() {
    const c = ctx();
    if (!c) return testStore;
    const all = c.extensionSettings;
    all[MODULE] ||= {};
    // saved as written: missing keys are filled, custom packs are normalized only when read
    const s = all[MODULE].system && typeof all[MODULE].system === 'object' ? all[MODULE].system : (all[MODULE].system = {});
    if (s.pack === undefined) s.pack = DEFAULT_PACK.id;
    if (!Array.isArray(s.custom)) s.custom = [];
    if (!isTemplateStore(s.rulesTemplates)) {
        // older settings: custom packs (named by the id / name inside their JSON) become rules templates
        // (s.pack and s.custom stay as they were, for downgrades)
        s.rulesTemplates = migrate(s.custom, s.pack);
        c.saveSettingsDebounced?.();
    }
    return s;
}

const testStore = { pack: DEFAULT_PACK.id, custom: [], rulesTemplates: { active: DEFAULT_PACK.id, items: {} } };

/** A pack without its id and name: those come from the template. */
export function packRules(p) {
    const { id, name, ...rest } = p && typeof p === 'object' ? p : {};
    return structuredClone(rest);
}

function migrate(custom, pack) {
    const items = {};
    for (const raw of custom) {
        const p = normalizePack(raw);
        if (BUILT_IN.some(b => b.id === p.id) || items[p.id]) continue;
        items[p.id] = { name: p.name, rules: packRules(raw), updatedAt: Date.now() };
    }
    const active = BUILT_IN.some(b => b.id === pack) || items[pack] ? String(pack) : DEFAULT_PACK.id;
    return { active, items };
}

/** The rules templates (shared block): { active, items: { [id]: { name, rules } } }. active = the default pack. */
export const templateStore = () => store().rulesTemplates;

const save = () => ctx()?.saveSettingsDebounced?.();

/** Built-in and custom packs: [{ id, name, builtIn }]. */
const customPacks = () => Object.entries(templateStore().items).filter(([id, t]) => t && typeof t === 'object' && !BUILT_IN.some(b => b.id === id))
    .map(([id, t]) => normalizePack({ ...(t.rules && typeof t.rules === 'object' ? t.rules : {}), id, name: t.name }));

export function listPacks() {
    return [...BUILT_IN.map(p => ({ id: p.id, name: p.name, builtIn: true })), ...customPacks().map(p => ({ id: p.id, name: p.name, builtIn: false }))];
}

/** A normalized copy of a pack by id (unknown id: the default pack). */
export function getPack(id) {
    const want = String(id || '');
    const custom = customPacks();
    const hit = BUILT_IN.find(p => p.id === want) || custom.find(p => p.id === want);
    const def = defaultPackId();
    return normalizePack(structuredClone(hit || BUILT_IN.find(p => p.id === def) || custom.find(p => p.id === def) || DEFAULT_PACK));
}

export const defaultPackId = () => templateStore().active || DEFAULT_PACK.id;
export function setDefaultPack(id) {
    const s = store();
    s.rulesTemplates.active = String(id || DEFAULT_PACK.id);
    s.pack = s.rulesTemplates.active; // kept in step for downgrades
    save();
    announce();
}

/** The pack chosen for the open chat ('' = the default). */
export function chatPackId() {
    const md = ctx()?.chatMetadata;
    return md?.[MODULE]?.pack ? String(md[MODULE].pack) : '';
}
export function setChatPack(id) {
    const c = ctx();
    if (!c?.chatMetadata) return;
    c.chatMetadata[MODULE] ||= {};
    if (id) c.chatMetadata[MODULE].pack = String(id); else delete c.chatMetadata[MODULE].pack;
    c.saveMetadata?.();
    announce();
}

/** The pack in use in the open chat. */
export const activePack = () => getPack(chatPackId() || defaultPackId());

/** Add or replace a custom pack (built-in ids can't be replaced). Its name comes from the JSON. Returns the normalized pack. */
export function saveCustomPack(p) {
    const raw = structuredClone(p && typeof p === 'object' ? p : {});
    const pack = normalizePack(raw);
    if (BUILT_IN.some(b => b.id === pack.id)) pack.id = `${pack.id}-custom`;
    templateStore().items[pack.id] = { name: pack.name, rules: packRules(raw), updatedAt: Date.now() };
    save();
    announce();
    return normalizePack({ ...raw, id: pack.id, name: pack.name });
}
export function deleteCustomPack(id) {
    const t = templateStore();
    delete t.items[id];
    if (t.active === id) setDefaultPack(DEFAULT_PACK.id);
    save();
    announce();
}

/** Tell everyone listening that the pack in use may have changed. */
export function announcePack() { announce(); }

function announce() {
    try { document.dispatchEvent(new CustomEvent('rolldice:pack', { detail: activePack() })); } catch { /* outside a browser */ }
}

/** window.RollDice.system */
export function systemApi() {
    return {
        version: 1,
        roles: [...STAT_ROLES], // the roles the built-in packs name; a pack's own roles are the keys of pack.stats
        list: listPacks,
        get: getPack,
        active: activePack,
        activeId: () => chatPackId() || defaultPackId(),
        chatPackId,
        setChatPack,
        defaultPackId,
        setDefaultPack,
        normalize: normalizePack,
        /** test(pack, value, { dc, roll }) → result; roll(sides) lets the caller supply its own dice. */
        test,
        read,
        describe,
        chance,
        critLists,
        critBounds,
        statMod,
        statScore,
        statRole,
        evalStatMod,
    };
}
