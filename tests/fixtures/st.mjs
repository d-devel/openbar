import { LedgerActor } from './ledger.mjs';
import { stub } from './generic.mjs';
class Widget extends LedgerActor { constructor(params = {}) { super('St.Widget(Fitts)'); Object.assign(this, params); } }
export default new Proxy({ Widget }, { get: (t, p) => (p in t ? t[p] : stub()) });
