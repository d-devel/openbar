// Installs fake timers (side effect of fixtures/ledger.mjs) and the loader hook that redirects
// gi://* and resource:///* imports to our simulated modules. Loaded via node --import.
import { register } from 'node:module';
import './setup.mjs';               // prepares the patched copy of extension.js
import './fixtures/ledger.mjs';     // must run in the main thread too (installs setTimeout etc.)
register('./fixtures/hooks.mjs', import.meta.url);
