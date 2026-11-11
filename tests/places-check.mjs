// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 WittyWilla and contributors
// Tries the places and settings around the picture, on a running test server: behind the full
// player, the whole screen, calm mode, adding an effect, and that off is off.
//
//   WV_SERVER=... WV_NAME=... WV_PASS=... node tests/places-check.mjs out-folder
import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launch } from './cdp.mjs'

const server = process.env.WV_SERVER || 'http://127.0.0.1:9962'
const out = process.argv[2] || '.'
mkdirSync(out, { recursive: true })
const wait = (ms) => new Promise((d) => setTimeout(d, ms))
const call = async (method, path, body, token) => {
  const r = await fetch(server + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined })
  return r.json().catch(() => ({}))
}
const { token } = await call('POST', '/api/login', { name: process.env.WV_NAME, password: process.env.WV_PASS })
await call('PUT', '/api/me/ui', {}, token)
const libs = await call('GET', '/api/libraries', null, token)
const list = Array.isArray(libs) ? libs : libs.libraries
const albumOf = async (l) => (await call('GET', `/api/music/albums?library=${l.id}&artist=${encodeURIComponent('Generated Artist')}`, null, token)).length > 0
let music = null
for (const l of list.filter((x) => x.type === 'music')) if (await albumOf(l)) { music = l; break }
const album = `${server}/album/${music.id}?artist=${encodeURIComponent('Generated Artist')}&album=${encodeURIComponent('Generated Album')}`
// The player has two audio elements that take turns: this is whichever is in use.
const AUDIO = `[...document.querySelectorAll('audio')].find((a) => a.src)`

const results = {}
const b = await launch({ width: 1400, height: 900, tmp: process.env.WV_TMP })
try {
  const p = await b.open()
  await p.send('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.__frames = 0
    const raf = window.requestAnimationFrame.bind(window)
    window.requestAnimationFrame = (f) => { window.__frames++; return raf(f) }
    window.__contexts = []
    const AC = window.AudioContext
    window.AudioContext = class extends AC { constructor(o) { super(o); window.__contexts.push(this) } }
  ` })
  await p.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
  await p.go(server + '/')
  await p.eval(`localStorage.setItem('wms.token', ${JSON.stringify(token)}); localStorage.removeItem('wms.visualizer.custom')`)
  await p.go(album)
  await p.until(`[...document.querySelectorAll('button')].some((b) => /^Play/.test(b.textContent.trim()))`, 20000, 'the album')
  await p.eval(`[...document.querySelectorAll('button')].find((b) => /^Play/.test(b.textContent.trim())).click()`)
  await p.until(`${AUDIO}?.currentTime > 0.2`, 15000, 'the music')

  // The full player has the player's own light styles running, with none of this module's.
  const openPlayer = async () => {
    await p.eval(`document.querySelector('.ab-expand').click()`)
    await p.until(`!!document.querySelector('.np')`, 5000, 'the full player')
  }
  await openPlayer()
  await wait(500)
  results.ownStylesFirst = await p.eval(`({ canvas: !!document.querySelector('.np-canvas'), mine: !!document.querySelector('.wv-canvas') })`)

  // Effects are chosen from the player's "More" menu.
  const choose = async (name) => {
    await p.eval(`document.querySelector('[aria-label="More visualizer styles"]').click()`)
    await p.until(`document.querySelectorAll('.np-style-menu button').length > 2`, 15000, 'the list of effects')
    await p.eval(`[...document.querySelectorAll('.np-style-menu button')].find((b) => b.textContent === ${JSON.stringify(name)}).click()`)
  }
  await choose('Molten Glass')
  await p.until(`!!document.querySelector('.wv-dialog')`, 15000, 'the notice')
  results.noticeOnScreen = await p.eval(`(() => { const r = document.querySelector('.wv-dialog').getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth })()`)
  results.calmTickedBySystem = await p.eval(`document.querySelector('.wv-dialog input[type=checkbox]').checked`)
  writeFileSync(join(out, 'notice.png'), await p.shot())

  // Not now means nothing started, and the player goes back to what it had.
  await p.eval(`[...document.querySelectorAll('.wv-dialog button')].find((b) => b.textContent === 'Not now').click()`)
  await wait(400)
  results.afterNotNow = await p.eval(`({ mine: !!document.querySelector('.wv-canvas'), own: !!document.querySelector('.np-canvas'), style: document.querySelector('.np-styles [aria-checked=true]')?.textContent })`)

  await choose('Molten Glass')
  await p.until(`!!document.querySelector('.wv-dialog')`, 5000, 'the notice again')
  await p.eval(`[...document.querySelectorAll('.wv-dialog button')].find((b) => b.textContent === 'Turn on').click()`)
  await p.until(`document.querySelector('.wv-stage.panel')?.dataset.fps > 0`, 15000, 'the picture')
  await wait(3000)
  writeFileSync(join(out, 'behind-player.png'), await p.shot())
  const stage = `document.querySelector('.wv-stage').dataset`
  results.behindPlayer = await p.eval(`({ size: ${stage}.width + 'x' + ${stage}.height, inPlace: !!document.querySelector('.np-shader .wv-canvas'), effect: ${stage}.effect, tap: ${stage}.tap, barHidden: getComputedStyle(document.querySelector('.np-shader .wv-bar')).display === 'none' })`)
  results.keepsPlaying = await p.eval(`!${AUDIO}.paused`)

  // Nothing changes by itself.
  const held = await p.eval(stage + '.effect')
  await wait(12000)
  results.staysPut = (await p.eval(stage + '.effect')) === held

  // Calm mode only shows the gentle ones. Its own controls are hidden behind the player, but
  // they're still what a host's menu ends up calling.
  const gentle = ['skyline', 'phosphor', 'lissajous', 'molten', 'inkdrift', 'sundial', 'lavalamp', 'hearth', 'cascade', 'juliabloom', 'aurora', 'ripple']
  const seen = new Set()
  for (let i = 0; i < 16; i++) {
    await p.eval(`document.querySelector('[aria-label="Next effect"]').click()`)
    await wait(60)
    seen.add(await p.eval(stage + '.effect'))
  }
  results.calmEffects = [...seen]
  results.calmOnlyGentle = [...seen].every((e) => gentle.includes(e))

  // The whole screen and back, on the same picture.
  await p.eval(`document.querySelector('[aria-label="More visualizer styles"]').click()`)
  await p.until(`document.querySelectorAll('.np-style-menu button').length > 2`, 5000, 'the menu')
  await p.eval(`[...document.querySelectorAll('.np-style-menu button')].find((b) => /Effect settings/.test(b.textContent)).click()`)
  await p.until(`!!document.querySelector('.wv-stage.whole .wv-canvas')`, 5000, 'the whole screen')
  await wait(500)
  writeFileSync(join(out, 'whole.png'), await p.shot())
  results.wholeScreen = await p.eval(`({ effect: ${stage}.effect, stages: document.querySelectorAll('.wv-stage').length, behind: !!document.querySelector('.np-shader') })`)

  // The settings, and Escape closes them and nothing else.
  await p.eval(`document.querySelector('[aria-label="Visualizer settings"]').click()`)
  await p.until(`!!document.querySelector('.wv-dialog.wide')`, 3000, 'the settings')
  writeFileSync(join(out, 'settings.png'), await p.shot())

  // Adding an effect: a good one, then bad ones.
  await p.eval(`document.querySelector('.wv-details').open = true`)
  const add = async (name, text) => {
    const file = join(process.env.WV_TMP || tmpdir(), name)
    writeFileSync(file, text)
    const { root } = await p.send('DOM.getDocument')
    const { nodeId } = await p.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.wv-details input[type=file]' })
    await p.send('DOM.setFileInputFiles', { files: [file], nodeId })
    await p.until(`!/Checking/.test(document.querySelector('.wv-btn.file').textContent) && !!document.querySelector('.wv-msg')`, 12000, 'the answer about ' + name)
    await wait(100)
    return p.eval(`document.querySelector('.wv-msg').textContent`)
  }
  const good = `/*wittyvisualizer { "format": 1, "id": "soft-rings", "name": "Soft Rings", "author": "A test", "license": "MIT", "motion": "gentle", "feedback": true } */
vec4 effect(vec2 uv) {
  vec2 p = centred(uv);
  float rings = sin(length(p) * 12.0 - flow * 3.0 + bass * 2.0);
  vec3 c = palette(length(p) * 0.5 + flow * 0.05) * (0.3 + 0.5 * rings);
  return vec4(max(c, prev(uv).rgb * 0.8), 1.0);
}
`
  results.addGood = await add('good.glsl', good)
  results.addLoop = await add('loop.glsl', `/*wittyvisualizer { "format": 1, "id": "spin", "name": "Spin" } */\nvec4 effect(vec2 uv) { while (true) {} return vec4(0.0); }`)
  results.addBadGlsl = await add('bad.glsl', `/*wittyvisualizer { "format": 1, "id": "typo", "name": "Typo" } */\nvec4 effect(vec2 uv) { return vec4(nothingCalledThis, 1.0); }`)
  results.addNotOne = await add('photo.glsl', 'this is not an effect')
  results.addBuiltinName = await add('clash.glsl', `/*wittyvisualizer { "format": 1, "id": "hearth", "name": "Mine" } */\nvec4 effect(vec2 uv) { return vec4(1.0); }`)
  await p.key('Escape')
  await wait(200)
  results.escapeClosedOnlySettings = await p.eval(`({ settings: !!document.querySelector('.wv-dialog.wide'), player: !!document.querySelector('.np'), stage: !!document.querySelector('.wv-stage') })`)
  results.customListed = await p.eval(`[...document.querySelectorAll('.wv-bar select option')].some((o) => o.textContent === 'Soft Rings (yours)')`)
  await p.eval(`(() => { const s = document.querySelector('.wv-bar select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(s, 'soft-rings'); s.dispatchEvent(new Event('change', { bubbles: true })) })()`)
  await wait(3500)
  writeFileSync(join(out, 'custom.png'), await p.shot())
  results.customShowing = await p.eval(stage + '.effect')

  // Out of the whole screen: behind the player again, with a picture.
  await p.key('Escape')
  await p.until(`!document.querySelector('.wv-stage.whole') && !!document.querySelector('.np-shader .wv-canvas')`, 3000, 'the way back')
  await wait(300)
  results.backBehindPlayer = await p.eval(`document.querySelector('.np-shader .wv-stage').dataset.effect`)

  // A hidden page stops by itself.
  await p.eval(`Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange'))`)
  await wait(200)
  const hidden0 = await p.eval('window.__frames')
  await wait(1000)
  results.hidden = { frames: (await p.eval('window.__frames')) - hidden0, contexts: await p.eval(`window.__contexts.map((c) => c.state)`) }
  await p.eval(`delete document.hidden; document.dispatchEvent(new Event('visibilitychange'))`)
  await wait(400)
  const back0 = await p.eval('window.__frames')
  await wait(500)
  results.backFromHidden = (await p.eval('window.__frames')) - back0

  // Off is off: the big button, and neither the picture nor its sound is left running.
  await p.eval(`document.querySelector('.ab-viz-btn').click()`)
  await wait(500)
  results.off = { pressed: await p.eval(`document.querySelector('.ab-viz-btn').getAttribute('aria-pressed')`), contexts: await p.eval(`window.__contexts.map((c) => c.state)`), canvas: await p.eval(`!!document.querySelector('.wv-canvas')`), playing: await p.eval(`!${AUDIO}.paused`) }

  // And on again, in the same page, with a new canvas.
  await p.eval(`document.querySelector('.ab-viz-btn').click()`)
  await p.until(`document.querySelector('.wv-stage')?.dataset.fps > 0`, 8000, 'it to come back')
  await wait(1500)
  results.onAgain = await p.eval(`({ effect: ${stage}.effect, tap: ${stage}.tap, gl: !!document.querySelector('.wv-canvas') })`)

  // Closing the player lets go: it's only ever behind the full player.
  await p.eval(`document.querySelector('.np-close').click()`)
  await p.until(`!document.querySelector('.np')`, 3000, 'it to close')
  await wait(500)
  results.closed = await p.eval(`({ canvas: !!document.querySelector('.wv-canvas'), playing: !${AUDIO}.paused })`)

  // A saved choice comes back when the full player opens, and only then.
  await wait(800)
  await p.go(album)
  await p.until(`[...document.querySelectorAll('button')].some((b) => /^Play/.test(b.textContent.trim()))`, 20000, 'the album')
  await p.eval(`[...document.querySelectorAll('button')].find((b) => /^Play/.test(b.textContent.trim())).click()`)
  await p.until(`${AUDIO}?.currentTime > 0.2`, 15000, 'the music')
  results.afterReload = await p.eval(`({ canvas: !!document.querySelector('.wv-canvas') })`)
  await openPlayer()
  await p.until(`!!document.querySelector('.wv-canvas')`, 6000, 'the saved choice')
  results.savedChoiceOpens = true
  results.customKept = await p.eval(`[...document.querySelectorAll('.wv-bar select option')].some((o) => o.textContent === 'Soft Rings (yours)')`)

  // The Modules page lists it, with its version.
  await p.go(`${server}/settings/modules`)
  await wait(1500)
  writeFileSync(join(out, 'modules.png'), await p.shot())
  const report = await call('GET', '/api/modules', null, token)
  const me = report.modules.find((m) => m.id === 'wittyvisualizer')
  results.modulesApi = { version: me?.version, delivery: me?.delivery, group: me?.group, installed: me?.installed, updatable: me?.updatable }
  results.modulesPage = await p.eval(`document.body.innerText.includes('WittyVisualizer')`)

  results.errors = p.logs.filter((l) => /^(error|exception)/.test(l)).slice(0, 12)
  console.log(JSON.stringify(results, null, 1))
  p.close()
} catch (e) {
  console.log(JSON.stringify(results, null, 1))
  throw e
} finally {
  await b.close()
}
