# Changelog

What changed in WittyVisualizer, newest first. What changed before it had a repository of its own is in the
[WittyMediaServer changelog](https://github.com/wittywilla/WittyMediaServer/blob/master/CHANGELOG.md).

## Unreleased

- **Module API 4**, for WittyMediaServer 0.8.0-alpha and later: the module carries its own server-driven UI in `sdui.json`, which `wittymodule pack` puts in every archive.
- Carries `sdui.json` with its theme scope. It adds no pages: it is shown inside the audio player.
- **WittyVisualizer 0.3.0:** Fits WittyMediaServer 0.8.x.

- **WittyVisualizer 0.2.1:** A clean install now brings react-dom, which the bundle needs. 0.2.0 was tagged and never released.

- Module API 3 and WittyMediaServer 0.6.0-alpha: this is how a server gets it now, with no copy compiled in.
- WittyVisualizer is now a project of its own, developed and released from this repository.
- **It stays on one effect unless someone chooses otherwise.** It used to change every 30 seconds by default.
- A host can read and steer the running visualizer through `currentSession()`, and list the effects with `BUILTIN_EFFECTS`, for players with controls of their own.
