# Changelog

What changed in WittyVisualizer, newest first. What changed before it had a repository of its own is in the
[WittyMediaServer changelog](https://github.com/wittywilla/WittyMediaServer/blob/master/CHANGELOG.md).

## 0.4.1

- The first release on module API 5. The tag v0.4.0 was made before these build changes and was never published.


- **Module API 5 (0.4.0):** carries `integration.json` (web host API 5, SDUI catalogue revision 8), and its bundle exports `register(host)`, which claims nothing yet: the audio player's visualizer place has no hook in WittyModule 0.5.4, so the server still draws `VisualizerStage`. The list of effects every app shows is this module's settings page; the server's catalogue no longer carries `music.visualizer`'s presets and controls.
- Built on WittyModule 0.5.4 and module API 5, with its web builder; the module's own copy of `build-bundle.mjs` is gone, and the SDUI kit in `sdui/kit/` and the workflows are WittyModule 0.5.4's.

- **Speed and colour.** A speed for how fast the effects move (50% to 200%), and a colour choice: each effect's own colour families, as before, or the theme's accent. Every effect takes both. In Settings, Modules and saved with the rest.
- **Settings in every app's Settings, under Modules** (`sdui.json`, each profile's own): the effect, from all 18; picking at random; auto-change; only favourites; calm mode, with the flashing notice; intensity, sensitivity, quality and the frame rate. The visualizer reads what those rows save (`normalizeSettings` takes their strings and percentages) and `moduleSettingValues` gives an app what to save when a choice is made in the visualizer itself.
- **Aurora Rings**, a new gentle effect (Design 2). All seventeen earlier effects are unchanged.

- **Module API 4**, for WittyMediaServer 0.8.0-alpha and later: the module carries its own server-driven UI in `sdui.json`, which `wittymodule pack` puts in every archive.
- Carries `sdui.json` with its theme scope. It adds no pages: it is shown inside the audio player.
- **WittyVisualizer 0.3.0:** Fits WittyMediaServer 0.8.x.

- **WittyVisualizer 0.2.1:** A clean install now brings react-dom, which the bundle needs. 0.2.0 was tagged and never released.

- Module API 3 and WittyMediaServer 0.6.0-alpha: this is how a server gets it now, with no copy compiled in.
- WittyVisualizer is now a project of its own, developed and released from this repository.
- **It stays on one effect unless someone chooses otherwise.** It used to change every 30 seconds by default.
- A host can read and steer the running visualizer through `currentSession()`, and list the effects with `BUILTIN_EFFECTS`, for players with controls of their own.
