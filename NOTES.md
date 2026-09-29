# Development notes

Background and integration notes that are not part of the extension. Nothing
here ships in the release zip.

## Lunar calendar integration

A lunar calendar can be added to the Open Bar calendar pop-up by injecting
messages into GNOME Shell's message list, the same mechanism the extension
already uses for its own calendar styling at `openbar@ddevel/extension.js:1529`
(`InjectionManager.overrideMethod` on `Calendar.prototype._rebuildCalendar`).

Upstream for reference: [Lunar Calendar 农历](https://gitlab.gnome.org/Nei/gnome-shell-extension-lunar-calendar)
(`lunarcal@ailin.nemui`, published on [extensions.gnome.org as 675](https://extensions.gnome.org/extension/675/lunar-calendar/)).

This fork does not bundle any of that code. The upstream project carries no
license file, and none of its mirrors do either, so there is no license to
redistribute it under. A copy of its `extension.js` was briefly present here as
`patches/lunar_extension.js`; it was removed for that reason. If you want this
integration, either implement it yourself against the upstream EGO listing, or
get an explicit license clarification from the author first.

## Historical patches

Earlier revisions kept variants of the extension under `patches/`
(`extension_startupReload.js`, `extension_trilands-crash_63.js`,
`extension_v7patch.js`, `prefs_quickBatteryPatch.js`). None was referenced by
the extension, the tests, or the release build, and none was in the zip, so the
directory has been removed. The git history still has it if you want to see how
the extension evolved.

## Licensing

Open Bar is GPL-3.0-or-later. Upstream declared the individual source files as
`GPL-2.0-or-later` while shipping a GPLv3 `LICENSE` file; this fork settles
that on GPL-3.0-or-later everywhere, which the original "or later" grant
permits.

`openbar@ddevel/quantize.js` is the one exception and stays MIT. It derives
from Nick Rabinowitz's quantize, Copyright 2008, ported to Node.js by Olivier
Lesnicki, and its MIT terms are not ours to change.
