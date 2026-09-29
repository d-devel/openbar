// DND/Clear found by style class (not by index); whole walk is null-safe
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Button } from './fixtures/panelMenu.mjs';
import { EXT_UNDER_TEST } from './setup.mjs';
const { default: Openbar } = await import(EXT_UNDER_TEST);

class Actor {
    constructor(name, classes = [], children = [], extra = {}) {
        this.name_ = name; this.cls = new Set(classes); this.children = children; Object.assign(this, extra);
    }
    get_children() { return this.children; }
    get_child_at_index(i) { return this.children[i] ?? null; }
    add_style_class_name(c) { this.cls.add(c); } remove_style_class_name(c) { this.cls.delete(c); }
    has_style_class_name(c) { return this.cls.has(c); }
}
class ClutterActor { constructor(n) { this.name_ = n; this.children = []; } get_children() { return []; } }
const A = (...a) => new Actor(...a);

function dateMenuTree(controls, { missingMsgBox = false } = {}) {
    const view = A('MessageView', ['message-view'], [new ClutterActor('overlay')]);
    const scroll = A('scroll', [], [A('bar'), A('bar'), view], { child: view });
    const msgbox = A('msgbox', [], [scroll, A('ctrls', ['message-list-controls'], controls)]);
    const msgList = A('CalendarMessageList', ['message-list'],
        missingMsgBox ? [A('Placeholder', ['message-list-placeholder'])] : [A('Placeholder', ['message-list-placeholder']), msgbox]);
    const calendar = A('Calendar', ['calendar'], [], { layout_manager: { get_child_at: () => null } });
    Object.defineProperty(calendar, 'constructor', { value: { name: 'Calendar' } });
    const vbox = A('col', ['datemenu-calendar-column'], [A('Today', ['datemenu-today-button']), calendar]);
    const box = A('menu.box', ['popup-menu-content'], [A('bin', [], [A('area', [], [msgList, vbox])])]);
    const dm = Object.assign(new Button(), { visible: true, menu: { box } });
    Object.defineProperty(dm, 'constructor', { value: { name: 'DateMenuButton' } });
    return { dm, find: n => { const st = [box]; while (st.length) { const x = st.pop(); if (x.name_ === n) return x; st.push(...(x.children ?? [])); } } };
}

function runWithTree(tree) {
    const ext = new Openbar({});
    ext.panelBoxes = [[{ child: tree.dm }]];
    ext.addedSignal = 'child-added'; ext.msgListIds = []; ext.msgLists = []; ext.gnomeVersion = 50;
    ext._connections = { connect() {}, disconnect() {}, isConnected: () => false };
    const get = n => tree.find(n)?.cls.has('openmenu') ?? 'absent';
    ext.applyMenuStyles(null, true);
    const on = { clear: get('Clear'), dnd: get('DND'), switch: get('Switch'), label: get('Label') };
    ext.applyMenuStyles(null, false);
    const off = { clear: get('Clear'), dnd: get('DND') };
    clearTimeout(ext.calendarTimeoutId);
    return { on, off };
}

test('GNOME 50 controls [Clear]: Clear found by class (at index 0, not 1)', () => {
    const r = runWithTree(dateMenuTree([A('Clear', ['message-list-clear-button', 'button'])]));
    assert.equal(r.on.clear, true);
    assert.equal(r.off.clear, false);
});

test('GNOME 45-48 controls [Label, DND(switch), Clear]: both DND and Clear found, Label ignored', () => {
    const r = runWithTree(dateMenuTree([
        A('Label'),
        A('DND', ['dnd-button'], [A('Switch', ['toggle-switch'])]),
        A('Clear', ['message-list-clear-button', 'button']),
    ]));
    assert.equal(r.on.clear, true);
    assert.equal(r.on.dnd, true);
    assert.equal(r.on.switch, true);
    assert.equal(r.on.label, false, 'the heading label before DND must not get the openmenu class');
    assert.equal(r.off.clear, false);
    assert.equal(r.off.dnd, false);
});

test('unexpected layout (no message box): enable() does not throw', () => {
    const tree = dateMenuTree([], { missingMsgBox: true });
    assert.doesNotThrow(() => runWithTree(tree));
});
