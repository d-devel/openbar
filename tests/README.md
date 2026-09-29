# Tests

Unit and lifecycle tests for the extension, run with Node's built-in test runner. No
dependencies to install, and no GNOME Shell needed: `extension.js` runs against a small
simulated Shell in `fixtures/`, shaped after the GNOME 50 widget tree. In that simulation:

- a ledger records every signal handler, so leaks left after `disable()` are detected;
- `setTimeout()` returns an opaque object, like GJS's `GLib.Source`;
- `Gio.Settings` is backed by the real defaults from the extension's schema XML.

```bash
cd tests && npm test          # requires Node.js 20.6 or newer; CI runs Node 24
```

The script expands `./*.test.mjs`, so a new test file is picked up automatically. Note that
`node --test` exits 0 when a file named on the command line does not exist, as long as
another file runs — a hard-coded file list can therefore report success while a test file
is missing or renamed.

CI runs the same command on every push and pull request (`.github/workflows/tests.yml`).
The schema test also needs `glib-compile-schemas`, and is skipped when it is not installed.

| File | Covers |
|---|---|
| `lifecycle.test.mjs` | enable/disable leaves no handlers, timers, classes, injections or widgets behind |
| `notifications.test.mjs` | GNOME 48+ notification list styling, and the GNOME 45-47 path |
| `datemenu.test.mjs` | Clear/DND buttons found by style class; unexpected layouts do not throw |
| `errors.test.mjs` | regressions for the JS errors fixed for GNOME 50 |
| `quantize.test.mjs` | colour palette code works in strict mode |
| `metadata.test.mjs` | `metadata.json` lists GNOME 45-50; compiled schema matches the XML |

## Layout

- `register.mjs` — loaded by `--import`; installs the fake timers and the loader hook that
  redirects `gi://*` and `resource:///*` to the simulated modules.
- `setup.mjs` — writes a patched copy of `extension.js` into `.cache/` (also exporting
  `ConnectManager`, which some tests need) and points `Gio.Settings` at the real schema XML.
  `.cache/` is generated and git-ignored.
- `fixtures/` — the simulated Shell. `ledger.mjs` records signal handlers and timer sources,
  `gio.mjs` parses the schema defaults, `main.mjs` owns the panel/messageTray/calendar world.

