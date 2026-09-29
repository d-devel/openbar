import { LedgerObject } from './ledger.mjs';
import { stub } from './generic.mjs';
export class Display extends LedgerObject {}
export class WorkspaceManager extends LedgerObject {
    get_active_workspace() { return { list_windows: () => [] }; }
}
export default new Proxy({ Display, WorkspaceManager, WindowType: { DESKTOP: 7 } }, { get: (t, p) => (p in t ? t[p] : stub()) });
