const map = {
    'gi://Gio': 'gio.mjs', 'gi://Meta': 'meta.mjs', 'gi://St': 'st.mjs',
    'resource:///org/gnome/shell/ui/main.js': 'main.mjs',
    'resource:///org/gnome/shell/ui/panelMenu.js': 'panelMenu.mjs',
    'resource:///org/gnome/shell/ui/calendar.js': 'calendar.mjs',
    'resource:///org/gnome/shell/ui/layout.js': 'layout.mjs',
    'resource:///org/gnome/shell/misc/config.js': 'config.mjs',
    'resource:///org/gnome/shell/extensions/extension.js': 'extension-api.mjs',
};
export async function resolve(spec, ctx, next) {
    const f = map[spec] ?? ((spec.startsWith('gi://') || spec.startsWith('resource://')) ? 'generic.mjs' : null);
    if (f) return { url: new URL(f, import.meta.url).href, shortCircuit: true };
    return next(spec, ctx);
}
