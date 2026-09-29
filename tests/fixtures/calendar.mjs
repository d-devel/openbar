import { LedgerActor } from './ledger.mjs';
export class Calendar extends LedgerActor {
    _rebuildCalendar() { this.rebuilds = (this.rebuilds ?? 0) + 1; }   // returns undefined, like the Shell's
}
export const ORIGINAL_REBUILD = Calendar.prototype._rebuildCalendar;
