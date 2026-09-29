// Enable/disable lifecycle: handlers, timers, calendar injection, style classes, monitor guards.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ledger, errors, timers, advance, flush, LedgerActor } from './fixtures/ledger.mjs';
import * as Main from './fixtures/main.mjs';
import { Calendar, ORIGINAL_REBUILD } from './fixtures/calendar.mjs';
import Gio from './fixtures/gio.mjs';
import { EXT_UNDER_TEST } from './setup.mjs';

const { default: Openbar } = await import(EXT_UNDER_TEST);

// A single enable -> run -> disable cycle and return a snapshot of everything we want to assert on
async function runCycle({ runMs = 10_000, emitLiveEvents = true, monitorsAtEnable = true } = {}) {
    ledger.clear(); errors.length = 0;
    // Reset the simulated world
    Main.resetWorld();
    const removed = !monitorsAtEnable ? Main.layoutManager.monitors.splice(0, 1)[0] : null;

    const ext = new Openbar({ uuid: 'openbar@ddevel', version: 50, url: 'x' });
    ext.enable(); await flush(); advance(Math.min(runMs, 4000));

    if (!monitorsAtEnable) {                                // the virtual monitor appears later
        Main.layoutManager.monitors.push(removed);
        Main.layoutManager.emit('monitors-changed');
        await flush();
    }
    advance(runMs);

    if (emitLiveEvents) {
        Main.messageTray._bannerBin.add_child(new LedgerActor('banner', ['message']));
        Main.messageView.add_child(new LedgerActor('group', ['message-notification-group'],
            [new LedgerActor('msg', ['message'])]));
        Main.calendar._rebuildCalendar();
        Main.layoutManager.emit('monitors-changed');
    }
    await flush();
    const peak = { handlers: ledger.size, fitts: Main.layoutManager.chrome.size };

    ext.disable(); await flush();
    const pendingRightAfterDisable = timers.size;
    advance(20_000); await flush();               // stale timers would fire here

    const settings = new Gio.Settings({ schema_id: 'org.gnome.shell.extensions.openbar' });
    return {
        errors: [...errors],
        peak,
        pendingRightAfterDisable,
        leftoverHandlers: [...ledger.values()].filter(h => Main.longLived().includes(h.obj)).length,
        calendarInjectionRestored:
            Calendar.prototype._rebuildCalendar === ORIGINAL_REBUILD &&
            !Object.hasOwn(Main.calendar, '_rebuildCalendar'),
        leftoverStyleClasses:
            Main.longLived().filter(a => ['openbar', 'openmenu', 'candybar', 'trilands']
                .some(c => a.has_style_class_name?.(c))).length,
        padRestored: Main.dateMenu.get_first_child().get_first_child()?._label === 'pad',
        fittsLeft: Main.layoutManager.chrome.size,
        storedMonitorWidth: settings.get_int('monitor-width'),
    };
}

test('single enable/disable: no errors, nothing left behind', async () => {
    const r = await runCycle();
    assert.equal(r.errors.length, 0, r.errors.join('\n'));
    assert.equal(r.pendingRightAfterDisable, 0, 'all timers must be cancelled in disable()');
    assert.equal(r.leftoverHandlers, 0, 'every signal handler on Shell objects must be disconnected');
    assert.ok(r.calendarInjectionRestored, 'Calendar._rebuildCalendar must be restored');
    assert.equal(r.leftoverStyleClasses, 0, "no 'openbar'/'openmenu'/... class must remain");
    assert.ok(r.padRestored, 'the DateMenu padding widget must be put back');
    assert.equal(r.fittsLeft, 0, 'all Fitts chrome widgets must be removed');
    assert.ok(r.peak.handlers > 30, 'sanity check: the simulated Shell did connect many handlers');
    assert.ok(r.peak.fitts > 0, 'sanity check: Fitts widgets were actually created');
});

test('three lock/unlock cycles: no cumulative handler leak', async () => {
    const a = await runCycle();
    const b = await runCycle();
    const c = await runCycle();
    for (const r of [a, b, c]) assert.equal(r.errors.length, 0, r.errors.join('\n'));
    // the step-4 fix: destroy-handler IDs are now tracked and disconnected, so they don't accumulate
    assert.equal(c.leftoverHandlers, 0);
});

test('quick cycles (disable 0.5 s after enable): stale timers do not fire after disable', async () => {
    for (let i = 0; i < 3; i++) {
        const r = await runCycle({ runMs: 500, emitLiveEvents: false });
        assert.equal(r.pendingRightAfterDisable, 0,
            `cycle ${i + 1}: GJS setTimeout() returns a GLib.Source, so 'id > 0' in disable() failed silently before step 4`);
        assert.equal(r.errors.length, 0, r.errors.join('\n'));
        assert.equal(r.leftoverStyleClasses, 0, 'stale timers would re-apply menu styles here');
    }
});

test('monitor appears after enable() (nested shell): no bogus 0 written to monitor-width', async () => {
    const r = await runCycle({ monitorsAtEnable: false });
    assert.equal(r.errors.length, 0);
    // schema default is 1000; a stale 0 would make prefs compute -100 and trigger Gtk-CRITICAL
    assert.ok(r.storedMonitorWidth >= 1000,
        `expected the schema default to be kept (>= 1000), got ${r.storedMonitorWidth}`);
});
