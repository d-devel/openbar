import { LedgerObject, LedgerActor } from './ledger.mjs';
import { Button } from './panelMenu.mjs';
import { Calendar } from './calendar.mjs';
import { LayoutManager as LM } from './layout.mjs';
import Meta from './meta.mjs';

const A = (...a) => new LedgerActor(...a);
const named = (cls, name) => { Object.defineProperty(cls, 'name', { value: name }); return cls; };
const mkButton = (name, label, extra = {}) => { const C = named(class extends Button {}, name); return new C(label, ['panel-button'], extra.children ?? [], extra); };
const bin = child => { const b = A(`Bin(${child._label})`); b.child = child; b.add_child(child); return b; };

// ---- DateMenu: structure from the GNOME 50 probe report -----------------------------------------
export const calendar = new Calendar('Calendar', ['calendar'], [], { layout_manager: { get_child_at: () => null } });
export const messageView = A('MessageView', ['message-view'], [A('overlay')]);
const scroll = A('St_ScrollView'); scroll.child = messageView; scroll.add_child(messageView);
const msgList = A('CalendarMessageList', ['message-list'], [
    A('Placeholder', ['message-list-placeholder']),
    A('msgbox', [], [scroll, A('controls', ['message-list-controls'], [A('Clear', ['message-list-clear-button', 'button'])])]),
]);
const column = A('column', ['datemenu-calendar-column'], [
    A('TodayButton', ['datemenu-today-button'], [A('box', [], [A('day-label', ['day-label'])])]),
    calendar,
    A('displays', ['datemenu-displays-section'], [A('bar'), A('bar'),
        A('displays-box', ['datemenu-displays-box'], [A('Events', ['events-button']), A('World', ['world-clocks-button']), A('Weather', ['weather-button'])])]),
]);
const dateMenuBox = A('dateMenu.menu.box', ['popup-menu-content'], [A('bin', [], [A('calendarArea', [], [msgList, column])])]);
export const dateMenu = mkButton('DateMenuButton', 'DateMenuButton', {
    menu: { box: dateMenuBox }, _calendar: calendar,
    children: [A('clock-display-box', [], [A('pad'), A('clock', ['clock'])])],
});

// ---- Quick settings ------------------------------------------------------------------------------
class QuickSettingsMenu {}
const qsMenu = new QuickSettingsMenu();
qsMenu.box = A('qs.menu.box', ['popup-menu-content', 'quick-settings'], [A('grid', ['quick-settings-grid'], [A('toggle', ['quick-toggle'])])]);
export const quickSettings = mkButton('QuickSettings', 'QuickSettings', { menu: qsMenu });
const activities = mkButton('ActivitiesButton', 'ActivitiesButton', { menu: null });

// ---- Panel, layout, tray, overview ---------------------------------------------------------------
export const panel = A('panel', ['panel']);
panel._leftBox = A('panelLeft', [], [bin(activities)]);
panel._centerBox = A('panelCenter', [], [bin(dateMenu)]);
panel._rightBox = A('panelRight', [], [bin(quickSettings)]);
panel.statusArea = { dateMenu, quickSettings };
[panel._leftBox, panel._centerBox, panel._rightBox].forEach(b => panel.add_child(b));

export const layoutManager = new LM('layoutManager');
Object.assign(layoutManager, {
    monitors: [{ x: 0, y: 0, width: 1920, height: 1080, inFullscreen: false }],
    primaryIndex: 0, _startingUp: false,
    panelBox: A('panelBox'), _bgManagers: [new LedgerObject('bgManager[0]')],
    chrome: new Set(),
    addChrome(a) { this.chrome.add(a); }, removeChrome(a) { this.chrome.delete(a); },
});
layoutManager.panelBox.add_child(panel);
export const messageTray = { _bannerBin: A('bannerBin'), _banner: null };
export const overview = new LedgerObject('overview');
export const sessionMode = { currentMode: 'user', isLocked: false, isGreeter: false };

globalThis.global = {
    display: new Meta.Display('global.display'),
    workspace_manager: new Meta.WorkspaceManager('global.workspace_manager'),
    window_group: A('global.window_group'),
    compositor: { get_window_actors: () => [] },
    get_window_actors: () => [],
    stage: {},
};

// ---- resetWorld(): restore every mutable piece of the simulated Shell between tests ----------
import { ledger, errors, timers } from './ledger.mjs';
import { resetStores } from './gio.mjs';
import { ORIGINAL_REBUILD } from './calendar.mjs';

// Snapshot children arrays and classes the extension changes during enable/disable, so each test
// starts against an identical world
const _snapshot = new Map();
function _snap(a) {
    if (_snapshot.has(a)) return;
    _snapshot.set(a, { children: [...(a._children ?? [])], classes: new Set(a._classes ?? []) });
    (a._children ?? []).forEach(_snap);
}
[layoutManager.panelBox, messageTray._bannerBin, messageView, dateMenuBox, qsMenu.box].forEach(_snap);
const _initialMonitors = [...layoutManager.monitors];
const _initialPanelBox = layoutManager.panelBox;
const _initialBgManagers = [...layoutManager._bgManagers];

export function resetWorld() {
    ledger.clear(); errors.length = 0; timers.clear();
    resetStores();
    Calendar.prototype._rebuildCalendar = ORIGINAL_REBUILD;
    layoutManager.chrome.clear();
    layoutManager.monitors = [..._initialMonitors];
    layoutManager.panelBox = _initialPanelBox;
    layoutManager._bgManagers = [..._initialBgManagers];
    layoutManager._startingUp = false;
    messageTray._banner = null;
    for (const [a, snap] of _snapshot) {
        a._children = [...snap.children];
        a._classes = new Set(snap.classes);
        a._pseudo?.clear();
    }
}

// every long-lived object of the simulated Shell (used to look for leftover handlers / classes)
export const longLived = () => {
    const list = [layoutManager, overview, global.display, global.workspace_manager, global.window_group,
        messageTray._bannerBin, layoutManager._bgManagers[0]];
    layoutManager.panelBox.walk(a => list.push(a));
    dateMenuBox.walk(a => list.push(a));
    qsMenu.box.walk(a => list.push(a));
    return [...new Set(list)];
};
