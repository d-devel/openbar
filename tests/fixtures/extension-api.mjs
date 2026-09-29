import Gio from './gio.mjs';
export const gettext = s => s;
export class Extension {
    constructor(metadata) { this.metadata = metadata; this.uuid = metadata.uuid; this.path = process.env.OBAR_EXT_DIR; }
    getSettings() { return new Gio.Settings({ schema_id: 'org.gnome.shell.extensions.openbar' }); }
}
// Same semantics as js/extensions/extension.js (GNOME 45+): save the original, install the override,
// restore the saved original (or delete if there was none) on restoreMethod()/clear().
export class InjectionManager {
    #saved = new Map();
    overrideMethod(proto, name, createOverrideFunc) {
        let methods = this.#saved.get(proto);
        if (!methods) { methods = new Map(); this.#saved.set(proto, methods); }
        const original = proto[name];
        methods.set(name, original);
        proto[name] = createOverrideFunc(original);
    }
    restoreMethod(proto, name) {
        const methods = this.#saved.get(proto); if (!methods) return;
        const original = methods.get(name);
        if (original === undefined) delete proto[name]; else proto[name] = original;
        methods.delete(name); if (methods.size === 0) this.#saved.delete(proto);
    }
    clear() { for (const [proto, methods] of this.#saved) for (const name of [...methods.keys()]) this.restoreMethod(proto, name); }
}
