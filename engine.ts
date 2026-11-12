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

// What the visualizer decides, with no drawing in it: which effect comes next, when it
// changes, how colours move, and what resolution the machine can carry. Pure, so it can be
// tested, and qt/wvengine.cpp is the same in C++.

export type Settings = {
  notice: boolean // has read the notice about flashing
  on: boolean // shows with the full player
  effect: string | null // the last one, or a pinned one when cycling is off
  random: boolean
  cycleSec: number // 0 stays on one effect
  favourites: string[]
  favouritesOnly: boolean
  intensity: number // 0.3 to 1.5
  sensitivity: number // 0.25 to 2
  calm: boolean | null // null follows the system's reduced motion setting
  scale: number // 0 adapts by itself; otherwise the share of full resolution
  stats: boolean
  speed: number // 0.5 to 2: how fast the effects move
  colour: 'effect' | 'theme' // the effects' own colour families, or the theme's accent
}

export const DEFAULT_SETTINGS: Settings = {
  notice: false, on: false, effect: null, random: true, cycleSec: 0, favourites: [], favouritesOnly: false,
  intensity: 1, sensitivity: 1, calm: null, scale: 0, stats: false, speed: 1, colour: 'effect',
}

export const CYCLE_CHOICES = [0, 10, 15, 30, 60, 120, 300]
export const SCALE_CHOICES = [0, 1, 0.75, 0.5, 0.33]

const inRange = (v: unknown, lo: number, hi: number, fallback: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fallback)

// Settings come back from a server and from storage, so they're read with care. The same
// fields arrive from the module's settings (sdui.json, drawn in every app's Settings), whose
// choices are strings and whose amounts are percentages; both forms are read.
const num = (v: unknown) => (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : v)
export function normalizeSettings(v: unknown): Settings {
  const s = (typeof v === 'object' && v !== null ? v : {}) as Record<string, unknown>
  const d = DEFAULT_SETTINGS
  const pct = (k: string) => (typeof s[k] === 'number' ? (s[k] as number) / 100 : undefined)
  const calm = s.calm === 'on' ? true : s.calm === 'off' ? false : s.calm
  return {
    notice: s.notice === true,
    on: s.on === true,
    effect: typeof s.effect === 'string' && s.effect.length <= 40 ? s.effect : d.effect,
    random: typeof s.random === 'boolean' ? s.random : d.random,
    cycleSec: CYCLE_CHOICES.includes(num(s.cycleSec) as number) ? (num(s.cycleSec) as number) : d.cycleSec,
    favourites: Array.isArray(s.favourites) ? s.favourites.filter((f) => typeof f === 'string' && f.length <= 40).slice(0, 64) : [],
    favouritesOnly: s.favouritesOnly === true,
    intensity: inRange(pct('intensityPct') ?? s.intensity, 0.3, 1.5, d.intensity),
    sensitivity: inRange(pct('sensitivityPct') ?? s.sensitivity, 0.25, 2, d.sensitivity),
    calm: typeof calm === 'boolean' ? calm : null,
    scale: SCALE_CHOICES.includes(num(s.scale) as number) ? (num(s.scale) as number) : d.scale,
    stats: s.stats === true,
    speed: inRange(pct('speedPct') ?? s.speed, 0.5, 2, d.speed),
    colour: s.colour === 'theme' ? 'theme' : 'effect',
  }
}

// The fields of the module's settings, in the form its settings rows hold them: what an app
// saves through the module settings route when a choice is made in the visualizer itself.
export function moduleSettingValues(s: Settings): Record<string, unknown> {
  return {
    effect: s.effect ?? 'skyline', random: s.random, cycleSec: String(s.cycleSec), favouritesOnly: s.favouritesOnly,
    calm: s.calm === null ? 'system' : s.calm ? 'on' : 'off', intensityPct: Math.round(s.intensity * 100),
    sensitivityPct: Math.round(s.sensitivity * 100), scale: String(s.scale), stats: s.stats,
    speedPct: Math.round(s.speed * 100), colour: s.colour,
  }
}

export type CycleItem = { id: string; motion: 'gentle' | 'lively'; cost: number }

// The effects that are in the running right now.
export function eligible(all: CycleItem[], s: Pick<Settings, 'favourites' | 'favouritesOnly'>, calm: boolean, weak: boolean) {
  let list = all
  if (calm) list = list.filter((e) => e.motion === 'gentle')
  if (s.favouritesOnly && s.favourites.length) {
    const f = list.filter((e) => s.favourites.includes(e.id))
    if (f.length) list = f
  }
  if (weak) {
    const cheap = list.filter((e) => e.cost < 3)
    if (cheap.length) list = cheap
  }
  return list.length ? list : all
}

// Moves through effects. In random order it plays each one before any comes round again,
// and never the same one twice in a row. A history makes "previous" really go back.
export class Cycle {
  private queue: string[] = []
  private past: string[] = []
  current: string | null = null
  private rand: () => number
  constructor(rand: () => number = Math.random) { this.rand = rand }

  private shuffled(ids: string[]) {
    const a = ids.filter((id) => id !== this.current)
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.rand() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t }
    return a
  }

  next(ids: string[], random: boolean): string {
    if (!ids.length) return this.current || ''
    let n: string
    if (random) {
      this.queue = this.queue.filter((id) => ids.includes(id))
      if (!this.queue.length) this.queue = this.shuffled(ids)
      n = this.queue.shift() ?? ids[0]
    } else {
      const i = this.current === null ? -1 : ids.indexOf(this.current)
      n = ids[(i + 1) % ids.length]
    }
    if (this.current !== null) { this.past.push(this.current); if (this.past.length > 32) this.past.shift() }
    this.current = n
    return n
  }

  previous(ids: string[], random: boolean): string {
    if (!ids.length) return this.current || ''
    if (random) {
      while (this.past.length) {
        const p = this.past.pop()!
        if (ids.includes(p) && p !== this.current) { if (this.current) this.queue.unshift(this.current); this.current = p; return p }
      }
    }
    const i = this.current === null ? 0 : ids.indexOf(this.current)
    const n = ids[(Math.max(i, 0) - 1 + ids.length) % ids.length]
    this.current = n
    return n
  }

  select(id: string) {
    if (this.current !== null && this.current !== id) this.past.push(this.current)
    this.current = id
  }
}

// Holds the frame rate: fewer pixels first, and fewer frames only when that isn't enough.
// It watches the time between frames rather than the time a frame takes, as that's the
// only measure every browser and every graphics driver gives honestly.
export class Budget {
  scale: number
  frameGap = 0 // the least seconds between frames, 0 for as fast as the screen goes
  fps = 0
  private avg = 1 / 60
  private held = 0
  private calmFor = 0
  private patience = 6
  private rose = false
  private counted = 0
  private countedFor = 0
  readonly floor: number
  readonly ceiling: number

  constructor(start: number, floor: number, ceiling: number) { this.scale = start; this.floor = floor; this.ceiling = ceiling }

  // Returns true when the resolution or the frame rate changed.
  frame(dt: number): boolean {
    this.counted++
    this.countedFor += dt
    if (this.countedFor >= 1) { this.fps = this.counted / this.countedFor; this.counted = 0; this.countedFor = 0 }
    // A long gap is a tab coming back or a window being dragged, not the visualizer.
    if (dt > 0.5) return false
    this.avg += (dt - this.avg) * 0.08
    this.held += dt
    if (this.held < 1.2) return false
    // Judged against the rate it's aiming for: 30 a second on purpose isn't slow.
    const aim = this.frameGap || 1 / 60
    const slow = this.avg > aim * 1.33, fast = this.avg < aim * 1.11
    if (slow) {
      // If it has just tried more pixels and that failed, it waits longer before the next try.
      if (this.calmFor === 0 && this.rose) this.patience = Math.min(120, this.patience * 2)
      this.rose = false
      this.calmFor = 0
      this.held = 0
      if (this.scale > this.floor + 1e-3) {
        // A bigger step the further behind it is.
        this.scale = Math.max(this.floor, this.scale * (this.avg > 1 / 25 ? 0.7 : 0.85))
        return true
      }
      if (this.frameGap < 1 / 31) { this.frameGap = 1 / 30; return true }
      return false
    }
    if (fast) {
      this.calmFor += dt
      if (this.calmFor > this.patience && this.scale < this.ceiling - 1e-3) {
        this.calmFor = 0
        this.held = 0
        this.rose = true
        this.scale = Math.min(this.ceiling, this.scale * 1.12)
        return true
      }
    }
    return false
  }
}

export type PaletteDef = { id: string; a: number[]; b: number[]; c: number[]; d: number[] }

// A colour family made from one colour (the theme's accent, as #rrggbb): the accent at its middle,
// swinging a little lighter and darker with the music, with a slight shift of hue so the effects
// keep their depth. null for anything that isn't a colour.
export function accentPalette(hex: string): PaletteDef | null {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim())
  if (!m) return null
  const rgb = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255)
  return { id: 'theme', a: rgb.map((v) => 0.1 + 0.5 * v), b: rgb.map((v) => 0.08 + 0.3 * v), c: [1, 1, 1], d: [0, 0.06, 0.12] }
}

// Moves between colour families with the music: a new one every so many beats, or after a
// while without any, always as a slow blend. Calm mode moves less often.
export class Palettes {
  private from: PaletteDef
  private to: PaletteDef
  private t = 1
  private beatsAtChange = 0
  private since = 0
  private list: PaletteDef[]
  private rand: () => number
  readonly out = { a: [0, 0, 0], b: [0, 0, 0], c: [0, 0, 0], d: [0, 0, 0] }
  constructor(list: PaletteDef[], rand: () => number = Math.random) {
    this.list = list
    this.rand = rand
    this.from = this.to = list[Math.floor(rand() * list.length)]
    this.blend()
  }
  private blend() {
    const k = this.t * this.t * (3 - 2 * this.t)
    for (const key of ['a', 'b', 'c', 'd'] as const) {
      for (let i = 0; i < 3; i++) this.out[key][i] = this.from[key][i] + (this.to[key][i] - this.from[key][i]) * k
    }
  }
  step(dt: number, beatCount: number, calm: boolean) {
    this.since += dt
    const everyBeats = calm ? 64 : 24, everySec = calm ? 60 : 25
    if (this.t >= 1 && (beatCount - this.beatsAtChange >= everyBeats || this.since >= everySec)) {
      this.beatsAtChange = beatCount
      this.since = 0
      this.from = this.to
      let n = this.to
      for (let i = 0; i < 8 && n === this.to; i++) n = this.list[Math.floor(this.rand() * this.list.length)]
      this.to = n
      this.t = 0
    }
    if (this.t < 1) {
      this.t = Math.min(1, this.t + dt / (calm ? 6 : 2.5))
      this.blend()
    }
  }
}
