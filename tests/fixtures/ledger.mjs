// Global bookkeeping for the simulated Shell: every signal handler, timer and error.
export const ledger = new Map();     // id -> { obj, sig, fn }
export const errors = [];            // problems detected (JS errors, invalid disconnects, ...)
let nextId = 1;

export function report(kind, msg) { errors.push(`${kind}: ${msg}`); }

export class LedgerObject {
    constructor(label) { this._label = label; }
    connect(sig, fn) { const id = nextId++; ledger.set(id, { obj: this, sig, fn }); return id; }
    disconnect(id) {
        const h = ledger.get(id);
        // GObject logs a CRITICAL for an id that is not connected to this instance
        if (!h) report('CRITICAL', `disconnect(${id}) on ${this._label}: no such handler`);
        else if (h.obj !== this) report('CRITICAL', `disconnect(${id}) on ${this._label}: handler belongs to ${h.obj._label}`);
        ledger.delete(id);
    }
    emit(sig, ...args) {
        for (const [id, h] of [...ledger]) {
            if (h.obj === this && h.sig === sig && ledger.has(id)) {
                try { h.fn(this, ...args); }
                catch (e) { report('JS ERROR', `in '${sig}' handler of ${this._label}: ${e.message}\n      ${e.stack.split('\n').slice(0, 3).join('\n      ')}`); }
            }
        }
    }
    handlerCount() { let n = 0; for (const h of ledger.values()) if (h.obj === this) n++; return n; }
}

// Clutter/St actor: children, style classes, destroy() semantics (handlers dropped, like GObject dispose)
export class LedgerActor extends LedgerObject {
    constructor(label, classes = [], children = [], extra = {}) {
        super(label);
        this._classes = new Set(classes); this._pseudo = new Set(); this._children = []; this._parent = null;
        this.visible = true; this.x = 0; this.y = 0; this.width = 100; this.height = 30; this.destroyed = false;
        Object.assign(this, extra);
        children.forEach(c => this.add_child(c));
    }
    get_children() { return [...this._children]; }
    get_n_children() { return this._children.length; }
    get_child_at_index(i) { return this._children[i] ?? null; }
    get_first_child() { return this._children[0] ?? null; }
    get_last_child() { return this._children.at(-1) ?? null; }
    get_parent() { return this._parent; }
    [Symbol.iterator]() { return this._children[Symbol.iterator](); }
    add_child(c) { this._children.push(c); c._parent = this; this.emit('child-added', c); }
    insert_child_at_index(c, i) { this._children.splice(i, 0, c); c._parent = this; this.emit('child-added', c); }
    remove_child(c) { this._children = this._children.filter(x => x !== c); c._parent = null; this.emit('child-removed', c); }
    set_child_at_index(c, i) { this._children = this._children.filter(x => x !== c); this._children.splice(i, 0, c); }
    add_style_class_name(c) { this._classes.add(c); }
    remove_style_class_name(c) { this._classes.delete(c); }
    has_style_class_name(c) { return this._classes.has(c); }
    add_style_pseudo_class(c) { this._pseudo.add(c); }
    remove_style_pseudo_class(c) { this._pseudo.delete(c); }
    has_style_pseudo_class(c) { return this._pseudo.has(c); }
    bind_property() { return {}; }
    bind_property_full() { return {}; }
    set_position(x, y) { this.x = x; this.y = y; }
    set_size(w, h) { this.width = w; this.height = h; }
    event() { return false; }
    destroy() {
        if (this.destroyed) return;
        this._children.forEach(c => c.destroy?.());
        this.emit('destroy');
        this.destroyed = true;
        for (const [id, h] of [...ledger]) if (h.obj === this) ledger.delete(id);
        this._parent?.remove_child(this);
    }
    walk(fn) { fn(this); this._children.forEach(c => c.walk ? c.walk(fn) : fn(c)); }
}

// ---- GJS-faithful timers: setTimeout() returns an opaque GLib.Source-like object -----------------
export class FakeSource { constructor(due, fn, label) { this.due = due; this.fn = fn; this.label = label; } }
export const timers = new Set();
let now = 0;
globalThis.setTimeout = (fn, delay = 0, ...args) => {
    const s = new FakeSource(now + delay, () => fn(...args), String(fn).slice(0, 60).replace(/\s+/g, ' '));
    timers.add(s); return s;
};
globalThis.clearTimeout = s => { if (s) timers.delete(s); };     // GJS: clearTimeout(null) is a no-op
export function advance(ms) {
    const target = now + ms;
    for (;;) {
        const due = [...timers].filter(t => t.due <= target).sort((a, b) => a.due - b.due)[0];
        if (!due) break;
        timers.delete(due); now = due.due;
        try { due.fn(); } catch (e) { report('JS ERROR', `in timer (${due.label}...): ${e.message}`); }
    }
    now = target;
}
export const flush = () => new Promise(r => setImmediate(r));
