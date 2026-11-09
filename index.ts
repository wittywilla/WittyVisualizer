// SPDX-License-Identifier: AGPL-3.0-or-later
//
// WittyVisualizer - Light shows that follow the music: spectrum bars, scopes, plasma, tunnels, starfields, feedback and more, full screen.
// Copyright (C) 2026 WittyWilla and contributors
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published
// by the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program. If not, see <https://www.gnu.org/licenses/>.

// WittyVisualizer: music visualizations made of shaders that the web app and the desktop
// app both run. An app gives it a VisualizerHost and a media element; see the README.
export { VisualizerStage, currentSession, type StageProps } from './Stage'
export { BUILTIN_EFFECTS } from './shaders.ts'
export type { VisualizerHost } from './host.ts'
export type { Settings } from './engine.ts'
export type { Place } from './session.ts'
