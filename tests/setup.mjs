// Prepares a patched copy of extension.js that also exports ConnectManager (some tests need it),
// and exposes the extension directory for loading assets (schema XML, other modules).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const EXT_DIR = path.resolve(here, '..', 'openbar@ddevel');
export const OUT_DIR = path.resolve(here, '.cache');

fs.mkdirSync(OUT_DIR, { recursive: true });
const src = fs.readFileSync(path.join(EXT_DIR, 'extension.js'), 'utf8');
fs.writeFileSync(
    path.join(OUT_DIR, 'extension.js'),
    src.replace('export default class Openbar', 'export { ConnectManager };\nexport default class Openbar'),
);
// Same directory, so the patched extension's './quantize.js' etc. still resolve
for (const f of ['quantize.js', 'autothemes.js', 'stylesheets.js', 'utils.js'])
    fs.copyFileSync(path.join(EXT_DIR, f), path.join(OUT_DIR, f));

// Where the Gio.Settings fixture reads the real schema defaults
process.env.OBAR_SCHEMA ??= path.join(EXT_DIR, 'schemas', 'org.gnome.shell.extensions.openbar.gschema.xml');

export const EXT_UNDER_TEST = path.join(OUT_DIR, 'extension.js');
