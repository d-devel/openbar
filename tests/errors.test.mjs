// Regressions for every JS error fixed in rounds 3, 4 and 5.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { Button } from './fixtures/panelMenu.mjs';
import * as Main from './fixtures/main.mjs';
import { EXT_UNDER_TEST, EXT_DIR } from './setup.mjs';
const { default: Openbar, ConnectManager: CM } = await import(EXT_UNDER_TEST);

test('connectPrimaryBGChanged tolerates an empty _bgManagers', () => {
    const ext = new Openbar({});
    ext._connections = new CM();
    ext._bgSettings = { connect() { return 0; } };
    ext._intSettings = { connect() { return 0; } };
    ext.updateBguri = () => {}; ext.updatePanelStyle = () => {};
    Main.layoutManager._bgManagers = [];               // nested shell: monitor not added yet
    assert.doesNotThrow(() => ext.connectPrimaryBGChanged());
    Main.layoutManager._bgManagers = [{ connect() { return 7; } }];
    assert.doesNotThrow(() => ext.connectPrimaryBGChanged());
});

test('setPanelBoxPosition returns cleanly when the monitor list is empty', () => {
    Main.resetWorld();
    const ext = new Openbar({});
    Main.layoutManager.monitors = [];
    // if the guard did not return early, getPanelMonitor()[0] would be undefined and we would crash
    assert.doesNotThrow(() => ext.setPanelBoxPosition('Top'));
    assert.doesNotThrow(() => ext.setPanelBoxPosition('Bottom', 40, 5, false, 0, 2, 'Floating'));
});

test('enable() skips writing monitor size when no monitor exists', async () => {
    Main.resetWorld();
    Main.layoutManager.monitors = [];            // nested shell situation
    const ext = new Openbar({ uuid: 'openbar@ddevel', version: 50, url: 'x' });
    assert.doesNotThrow(() => ext.enable());
    const Gio = (await import('./fixtures/gio.mjs')).default;
    const settings = new Gio.Settings({ schema_id: 'org.gnome.shell.extensions.openbar' });
    assert.ok(settings.get_int('monitor-width') >= 1000,
        'the schema default (1000) must be kept, not overwritten with 0');
    ext.disable();
});

// The three Fitts callbacks sit inside createFittsWidget. They're tested by extracting them straight
// from extension.js (so we verify the shipped code, not a copy) and invoking them with btn.child = null.
test('Fitts enter/leave/captured event handlers tolerate btn.child = null', () => {
    const src = fs.readFileSync(path.join(EXT_DIR, 'extension.js'), 'utf8').split('\n');
    const start = src.findIndex(l => l.includes('Connect signals for hover'));
    const end = src.findIndex((l, i) => i > start && l.includes('addChrome(btn.FittsWidget'));
    const lambdas = src.slice(start, end).join('\n');

    class FakeWidget { connect(s, fn) { (this.h ??= {})[s] = fn; } }
    const ctx = {
        Clutter: { EVENT_PROPAGATE: 0 },
        btn: { FittsWidget: new FakeWidget(), child: null },
    };
    // Eval the three extracted `btn.FittsWidget.connect(...)` statements in `ctx`
    new Function('Clutter', 'btn', lambdas)(ctx.Clutter, ctx.btn);
    for (const sig of ['enter-event', 'leave-event', 'captured-event']) {
        assert.doesNotThrow(() => ctx.btn.FittsWidget.h[sig]({}, {}), `'${sig}' must tolerate null child`);
    }
});

test('ConnectManager: destroy handler is tracked and disconnected (no accumulation per cycle)', () => {
    const cm = new CM();
    const obj = { _label: 'test', connect(sig) { return ++this._next; }, disconnect(id) { (this._dc ??= []).push(id); }, _next: 0 };
    cm.connect(obj, 'notify::x', () => {});
    assert.equal(obj._next, 2, 'both signal and destroy handlers must be connected');
    assert.ok(cm.isConnected(obj, 'notify::x'));
    cm.disconnectAll();
    assert.equal(obj._dc.length, 2, 'both handlers (signal + destroy) must be disconnected');
});
