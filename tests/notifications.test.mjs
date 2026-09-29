// GNOME 48+ MessageView styling + the legacy GNOME 45-47 section path kept unchanged
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ledger, errors } from './fixtures/ledger.mjs';
import { Button } from './fixtures/panelMenu.mjs';
import { EXT_UNDER_TEST } from './setup.mjs';
const { default: Openbar, ConnectManager } = await import(EXT_UNDER_TEST);

// ---- minimal actor model with signals (mirrors Clutter.Actor's child-added/destroy) -------------
let idSeq = 1;
class A {
    constructor(name, classes = [], children = []) {
        this.name_ = name; this.cls = new Set(classes); this.children = []; this.handlers = new Map();
        children.forEach(c => this.add_child(c));
    }
    get_children() { return [...this.children]; }
    get_child_at_index(i) { return this.children[i] ?? null; }
    add_child(c) { this.children.push(c); this.emit('child-added', c); }
    add_style_class_name(c) { this.cls.add(c); } remove_style_class_name(c) { this.cls.delete(c); }
    has_style_class_name(c) { return this.cls.has(c); }
    connect(sig, fn) { const id = idSeq++; this.handlers.set(id, [sig, fn]); return id; }
    disconnect(id) { this.handlers.delete(id); }
    emit(sig, ...args) { for (const [s, fn] of [...this.handlers.values()]) if (s === sig) fn(this, ...args); }
    countListeners(sig) { return [...this.handlers.values()].filter(([s]) => s === sig).length; }
}
class PlainClutterActor extends A { constructor(n) { super(n); delete this.add_style_class_name; } }
PlainClutterActor.prototype.has_style_class_name = undefined;
PlainClutterActor.prototype.add_style_class_name = undefined;

const msg = (label) => new A(label, ['message'], [new A(label + '-header', ['message-header']), new A(label + '-body', ['message-body'])]);

// Build a minimal DateMenu tree around a given `sectionList`, wire the extension and return it
function buildExt(sectionList) {
    const scroll = new A('scroll'); scroll.child = sectionList; scroll.children = [sectionList];
    const msgbox = new A('msgbox', [], [scroll, new A('controls', ['message-list-controls'], [new A('Clear', ['message-list-clear-button'])])]);
    const msgList = new A('msgList', ['message-list'], [new A('placeholder', ['message-list-placeholder']), msgbox]);
    const box = new A('box', [], [new A('bin', [], [new A('hbox', [], [msgList, new A('vbox')])])]);
    const dm = Object.assign(new Button(), { visible: true, menu: { box } });
    Object.defineProperty(dm, 'constructor', { value: { name: 'DateMenuButton' } });
    const ext = new Openbar({});
    ext.panelBoxes = [[{ child: dm }]]; ext.addedSignal = 'child-added'; ext.msgListIds = []; ext.msgLists = [];
    ext._connections = new ConnectManager();
    return ext;
}
const styled = a => a.cls.has('openmenu');

test('GNOME 50 MessageView: messages in a group are styled; group/header are not', () => {
    const m1 = msg('m1'), m2 = msg('m2'), media = msg('media');
    const group = new A('group1', ['message-notification-group'], [new A('cover'), new A('header', ['message-header']), m1, m2]);
    const view = new A('MessageView', ['message-view'], [new PlainClutterActor('overlay'), group, media]);
    const ext = buildExt(view);
    ext.applyMenuStyles(null, true);
    assert.ok(styled(m1) && styled(m2), 'existing messages in a group must be styled');
    assert.ok(styled(media), 'media messages (direct child of the view) must be styled');
    assert.ok(!styled(m1.children[0]), 'message internals reached by descendant selectors, not by class');
    assert.ok(!styled(group) && !styled(group.children[1]), 'group and header must NOT be styled');
    clearTimeout(ext.calendarTimeoutId);
});

test('GNOME 50 MessageView: new messages and new groups are caught live', () => {
    const view = new A('MessageView', ['message-view'], [new PlainClutterActor('overlay')]);
    const ext = buildExt(view);
    ext.applyMenuStyles(null, true);

    const group1 = new A('g1', ['message-notification-group'], [msg('a')]); view.add_child(group1);
    assert.ok(styled(group1.children[0]), 'message in a new group must be styled');

    const later = msg('b'); group1.add_child(later);
    assert.ok(styled(later), 'message added to an existing group must be styled (group.child-added)');

    ext.applyMenuStyles(null, true); ext.applyMenuStyles(null, true);   // idempotent: no duplicate handlers
    assert.equal(group1.countListeners('child-added'), 1, 'only one child-added handler per group');
    clearTimeout(ext.calendarTimeoutId);
});

test('menu styles off: messages unstyled, group handlers disconnected, no late styling', () => {
    const view = new A('MessageView', ['message-view'], [new PlainClutterActor('overlay')]);
    const ext = buildExt(view);
    ext.applyMenuStyles(null, true);
    const group = new A('g', ['message-notification-group'], [msg('x')]); view.add_child(group);

    ext.applyMenuStyles(null, false);
    assert.ok(!styled(group.children[0]));
    assert.equal(group.countListeners('child-added'), 0, 'group handlers must be disconnected');

    const late = msg('late'); group.add_child(late);
    assert.ok(!styled(late), 'after disable, new messages must stay unstyled');
    clearTimeout(ext.calendarTimeoutId);
});

test('repeated applyMenuStyles(true) does not leak child-added handlers on the MessageView', () => {
    const view = new A('MessageView', ['message-view'], [new PlainClutterActor('overlay')]);
    const ext = buildExt(view);
    for (let i = 0; i < 5; i++) ext.applyMenuStyles(null, true);
    assert.equal(view.countListeners('child-added'), 1, 'exactly one handler after 5 calls');
    const late = msg('late'); view.add_child(new A('g', ['message-notification-group'], [late]));
    assert.ok(styled(late), 'the sole handler must still be alive');
    clearTimeout(ext.calendarTimeoutId);
});

test('GNOME 45-47 legacy section path: existing and newly added messages styled via section._list', () => {
    const wrap = m => { const w = new A('wrap', [], [m]); w.child = m; return w; };
    const lm = msg('legacy');
    const section = new A('section', ['message-list-section']); section._list = new A('list', [], [wrap(lm)]);
    const ext = buildExt(new A('sections', [], [section]));
    ext.applyMenuStyles(null, true);
    assert.ok(styled(lm), 'legacy: existing message styled through section._list');

    const lm2 = msg('legacy2'); section._list.add_child(wrap(lm2));
    assert.ok(styled(lm2), 'legacy: newly added message styled by the original section handler');

    assert.equal(section.countListeners('child-added'), 0, "legacy: no handler installed on the section itself (MessageView path must not be used)");

    ext.applyMenuStyles(null, false);
    assert.ok(!styled(lm) && !styled(lm2));
    clearTimeout(ext.calendarTimeoutId);
});
