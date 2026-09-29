import { LedgerObject } from './ledger.mjs';
import { stub } from './generic.mjs';
import fs from 'node:fs';

// Gio.Settings backed by the REAL openbar schema defaults (+ a few desktop keys). Values are shared per
// schema (like dconf); handlers are per instance; set_*() notifies every instance of that schema.
const schemaXml = fs.readFileSync(process.env.OBAR_SCHEMA, 'utf8');
const openbarDefaults = {};
for (const m of schemaXml.matchAll(/<key type="([^"]+)" name="([^"]+)">\s*<default>([\s\S]*?)<\/default>/g)) {
    const [, type, name, text] = m; const t = text.trim();
    openbarDefaults[name] = type === 's' ? t.replace(/^(['"])([\s\S]*)\1$/, '$2') : type === 'b' ? t === 'true'
        : type === 'as' ? JSON.parse(t.replace(/^@as /, '').replace(/'/g, '"')) : Number(t);
}
const stores = {
    'org.gnome.shell.extensions.openbar': openbarDefaults,
    'org.gnome.desktop.background': { 'picture-uri': 'file:///bg.jpg', 'picture-uri-dark': 'file:///bg-dark.jpg' },
    'org.gnome.desktop.interface': { 'color-scheme': 'default', 'accent-color': 'blue', 'gtk-theme': 'Adwaita', 'icon-theme': 'Adwaita' },
    'org.gnome.desktop.a11y.interface': { 'high-contrast': false },
    'org.gnome.shell': { 'enabled-extensions': ['openbar@ddevel'] },
};
const INITIAL = JSON.parse(JSON.stringify(stores));
const instances = {};
// Reset every store to its initial schema defaults and drop tracked Settings instances.
// Called between tests to guarantee isolation.
export function resetStores() {
    for (const id of Object.keys(stores)) stores[id] = JSON.parse(JSON.stringify(INITIAL[id]));
    for (const id of Object.keys(instances)) instances[id] = [];
}

class Settings extends LedgerObject {
    constructor({ schema_id }) {
        super(`Settings(${schema_id})`);
        if (!stores[schema_id]) throw new Error(`unknown schema ${schema_id}`);
        this._id = schema_id; (instances[schema_id] ??= []).push(this);
    }
    _get(k) { const s = stores[this._id]; if (!(k in s)) throw new Error(`${this._id}: no key '${k}'`); return s[k]; }
    _set(k, v) {
        const s = stores[this._id]; if (this._id.endsWith('openbar') && !(k in s)) throw new Error(`${this._id}: no key '${k}'`);
        s[k] = v;
        for (const inst of instances[this._id]) { inst.emit('changed', k); inst.emit(`changed::${k}`, k); }
    }
    get_string(k) { return this._get(k); } get_boolean(k) { return this._get(k); } get_double(k) { return this._get(k); }
    get_int(k) { return this._get(k); } get_uint(k) { return this._get(k); } get_strv(k) { return [...this._get(k)]; }
    set_string(k, v) { this._set(k, v); } set_boolean(k, v) { this._set(k, v); } set_double(k, v) { this._set(k, v); }
    set_int(k, v) { this._set(k, v); } set_uint(k, v) { this._set(k, v); } set_strv(k, v) { this._set(k, [...v]); }
}
const Gio = new Proxy({ Settings, _promisify() {} }, { get: (t, p) => (p in t ? t[p] : stub()) });
export default Gio;
