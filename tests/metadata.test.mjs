// metadata.json validity + shell-version list + schema is in sync
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { EXT_DIR } from './setup.mjs';

const metadata = JSON.parse(fs.readFileSync(path.join(EXT_DIR, 'metadata.json'), 'utf8'));

test('metadata.json is valid and its uuid matches the directory name', () => {
    assert.equal(metadata.uuid, path.basename(EXT_DIR));
});

test('shell-version lists "50" (this PR adds GNOME 50 support)', () => {
    assert.ok(Array.isArray(metadata['shell-version']));
    assert.ok(metadata['shell-version'].includes('50'));
});

test('shell-version keeps the previously supported releases (45-49)', () => {
    for (const v of ['45', '46', '47', '48', '49'])
        assert.ok(metadata['shell-version'].includes(v), `version ${v} must still be supported`);
});

test('schemas/gschemas.compiled matches the XML (when glib-compile-schemas is available)', (t) => {
    try { execFileSync('glib-compile-schemas', ['--version'], { stdio: 'ignore' }); }
    catch { t.skip('glib-compile-schemas not installed'); return; }
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'obar-schema-'));
    for (const f of fs.readdirSync(path.join(EXT_DIR, 'schemas')).filter(x => x.endsWith('.gschema.xml')))
        fs.copyFileSync(path.join(EXT_DIR, 'schemas', f), path.join(tmp, f));
    execFileSync('glib-compile-schemas', ['--strict', tmp], { stdio: 'pipe' });
    const a = fs.readFileSync(path.join(tmp, 'gschemas.compiled'));
    const b = fs.readFileSync(path.join(EXT_DIR, 'schemas', 'gschemas.compiled'));
    assert.deepEqual(a, b, 'schemas/gschemas.compiled is out of date with the XML - rebuild it');
});
