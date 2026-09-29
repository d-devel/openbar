// MMCQ: the gval/bval implicit-global bug (',' instead of ';') made cmap.map() throw in strict mode
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { EXT_DIR, OUT_DIR } from './setup.mjs';

const { quantize } = await import(path.join(EXT_DIR, 'quantize.js'));

function pixels() {
    const px = [];
    for (let i = 0; i < 500; i++) px.push([i % 256, (i * 7) % 256, (i * 13) % 256]);
    return px;
}

test('quantize(pixels, N) returns a palette of <= N colors, each an [r,g,b] triple', () => {
    const cmap = quantize(pixels(), 4);
    const palette = cmap.palette();
    assert.ok(palette.length > 0 && palette.length <= 4);
    for (const c of palette) {
        assert.equal(c.length, 3);
        for (const ch of c) assert.ok(ch >= 0 && ch <= 255);
    }
});

test('cmap.map(color) works in strict mode (the gval/bval fix)', () => {
    const cmap = quantize(pixels(), 4);
    // Before the fix, `contains()` referenced undeclared `gval`/`bval` and threw in strict mode
    assert.doesNotThrow(() => cmap.map([10, 70, 130]));
    const mapped = cmap.map([10, 70, 130]);
    assert.equal(mapped.length, 3);
});

test('baseline (old buggy code) throws ReferenceError in strict mode', async () => {
    // Simulate the pre-fix code by rewriting the , -> ; on two lines and re-loading as a module
    const fs = await import('node:fs');
    const src = fs.readFileSync(path.join(EXT_DIR, 'quantize.js'), 'utf8');
    const buggy = src.replace(
        'rval = pixel[0] >> rshift,\n            gval = pixel[1] >> rshift,\n            bval = pixel[2] >> rshift;',
        'rval = pixel[0] >> rshift;\n            gval = pixel[1] >> rshift;\n            bval = pixel[2] >> rshift;');
    assert.notEqual(buggy, src, 'the regex must have matched the current (fixed) code');
    const p = path.join(OUT_DIR, 'quantize.baseline.js');
    fs.writeFileSync(p, buggy);
    const { quantize: buggyQuantize } = await import(p);
    assert.throws(() => buggyQuantize(pixels(), 4).map([10, 70, 130]), ReferenceError);
});
