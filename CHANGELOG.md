# Changelog

What changed in WittyVisualizer, newest first. What changed before it had a repository of its own is in the
[WittyMediaServer changelog](https://github.com/wittywilla/WittyMediaServer/blob/master/CHANGELOG.md).

## Unreleased

- WittyVisualizer is now a project of its own, developed and released from this repository.
- **It stays on one effect unless someone chooses otherwise.** It used to change every 30 seconds by default.
- A host can read and steer the running visualizer through `currentSession()`, and list the effects with `BUILTIN_EFFECTS`, for players with controls of their own.
