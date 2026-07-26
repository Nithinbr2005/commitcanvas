import React, { useEffect, useRef, useState, useCallback } from 'react'
import * as PIXI from 'pixi.js'
import { Viewport } from 'pixi-viewport'
import { usePlayback } from '../store/usePlayback'
import { useTheme } from '../theme/ThemeContext'

/* ─────────────────────────────────────────
   Draw Luminous Multi-layer Node using Theme Config
───────────────────────────────────────── */
function drawNode(gfx, commit, state = 'normal', opts = {}, themeColors = {}, intensity = 'balanced') {
  gfx.clear()

  const isHead     = commit.isHead
  const isMerge    = commit.isMerge
  const isTag      = commit.isTag
  const isHovered  = state === 'hover'
  const isSelected = state === 'selected'
  const isCurrent  = state === 'current'
  const isFuture   = state === 'future'

  // Glow intensity multiplier
  const intensityMult = intensity === 'subtle' ? 0.5 : intensity === 'luminous' ? 1.6 : 1.0

  // Radii specification
  let coreRadius  = isHead ? 8 : isMerge ? 7 : 5.5
  let haloRadius  = coreRadius + 4.5
  let glowRadius  = coreRadius + 11.5

  if (isHovered || isSelected || isCurrent) {
    coreRadius += 1.5
    haloRadius += 2.5
    glowRadius += 4
  }

  // Alpha values scaled by intensity
  let outerGlowAlpha = (isFuture ? 0.04 : isCurrent ? 0.45 : isSelected ? 0.4 : isHovered ? 0.35 : 0.18) * intensityMult
  let haloAlpha      = (isFuture ? 0.12 : isCurrent ? 0.6  : isSelected ? 0.5 : isHovered ? 0.45 : 0.28) * intensityMult
  let coreAlpha      = isFuture ? 0.4  : 1.0

  if (isHead) {
    // ── HEAD NODE ──
    const outerColor = themeColors.headGlow || 0x00E5FF
    const haloColor  = themeColors.headHalo || 0x06B6D4
    const coreColor  = themeColors.headCore || 0x22D3EE
    const centerColor = themeColors.headCenter || 0xCFFAFE

    gfx.beginFill(outerColor, Math.min(outerGlowAlpha + 0.05, 0.7))
    gfx.drawCircle(0, 0, glowRadius + 4)
    gfx.endFill()

    gfx.beginFill(haloColor, Math.min(haloAlpha + 0.1, 0.8))
    gfx.drawCircle(0, 0, haloRadius + 2)
    gfx.endFill()

    gfx.beginFill(coreColor, 1)
    gfx.drawCircle(0, 0, coreRadius)
    gfx.endFill()

    gfx.beginFill(centerColor, 0.9)
    gfx.drawCircle(0, 0, coreRadius * 0.4)
    gfx.endFill()

  } else if (isMerge) {
    // ── MERGE NODE ──
    const glowColor = themeColors.mergeGlow || 0xF59E0B
    const coreColor = themeColors.mergeCore || 0xFBBF24

    gfx.beginFill(glowColor, Math.min(outerGlowAlpha + 0.05, 0.6))
    gfx.drawCircle(0, 0, glowRadius)
    gfx.endFill()

    const spikes = 5
    const outer = coreRadius + 2.5
    const inner = Math.max(2, Math.floor(outer * 0.45))
    const step = Math.PI / spikes
    const pts = []
    for (let i = 0; i < spikes * 2; i++) {
      const r = i % 2 === 0 ? outer : inner
      pts.push(Math.cos(i * step - Math.PI / 2) * r, Math.sin(i * step - Math.PI / 2) * r)
    }
    gfx.beginFill(coreColor, coreAlpha)
    gfx.drawPolygon(pts)
    gfx.endFill()

  } else if (isTag) {
    // ── TAG NODE ──
    const glowColor = themeColors.tagGlow || 0x16A34A
    const coreColor = themeColors.tagCore || 0x22C55E

    gfx.beginFill(glowColor, Math.min(outerGlowAlpha, 0.5))
    gfx.drawCircle(0, 0, glowRadius)
    gfx.endFill()

    const s = coreRadius + 1.5
    gfx.beginFill(coreColor, coreAlpha)
    gfx.drawPolygon([0, -s, s, 0, 0, s, -s, 0])
    gfx.endFill()

  } else {
    // ── NORMAL COMMIT NODE — 3 Luminous Layers ──
    const outerColor  = isHovered ? (themeColors.hoverGlow || 0x3B82F6) : (themeColors.normalGlow || 0x0284C7)
    const haloColor   = isHovered ? (themeColors.hoverCore || 0x60A5FA) : (themeColors.normalHalo || 0x0EA5E9)
    const coreColor   = isCurrent || isSelected ? (themeColors.normalCore || 0x38BDF8) : (isHovered ? (themeColors.hoverCore || 0x60A5FA) : (themeColors.normalCore || 0x38BDF8))
    const centerColor = themeColors.normalCenter || 0x7DD3FC

    gfx.beginFill(outerColor, Math.min(outerGlowAlpha, 0.6))
    gfx.drawCircle(0, 0, glowRadius)
    gfx.endFill()

    gfx.beginFill(haloColor, Math.min(haloAlpha, 0.7))
    gfx.drawCircle(0, 0, haloRadius)
    gfx.endFill()

    gfx.beginFill(coreColor, coreAlpha)
    gfx.drawCircle(0, 0, coreRadius)
    gfx.endFill()

    if (!isFuture) {
      gfx.beginFill(centerColor, 0.85)
      gfx.drawCircle(0, 0, coreRadius * 0.38)
      gfx.endFill()
    }
  }

  if (isSelected && opts.ringRadius) {
    gfx.lineStyle(1.5, themeColors.selectedRing || 0x00E5FF, opts.ringAlpha ?? 0.6)
    gfx.drawCircle(0, 0, opts.ringRadius)
    gfx.lineStyle(0)
  }
}

/* ─────────────────────────────────────────
   Draw subtle grid background
───────────────────────────────────────── */
function drawGrid(gfx, width, height, step = 48) {
  gfx.clear()
  gfx.lineStyle(1, 0xffffff, 0.022)
  for (let x = 0; x <= width; x += step) {
    gfx.moveTo(x, 0)
    gfx.lineTo(x, height)
  }
  for (let y = 0; y <= height; y += step) {
    gfx.moveTo(0, y)
    gfx.lineTo(width, y)
  }
  gfx.lineStyle(0)
  for (let x = 0; x <= width; x += step) {
    for (let y = 0; y <= height; y += step) {
      gfx.beginFill(0xffffff, 0.05)
      gfx.drawCircle(x, y, 1)
      gfx.endFill()
    }
  }
}

/* ─────────────────────────────────────────
   Draw bezier edge — Brighter #3B82F6 at 75-85% opacity
───────────────────────────────────────── */
function drawBezierEdge(gfx, from, to, color = COLOR_EDGE, alpha = 0.8, thickness = 1.6, active = false) {
  // Underlying subtle glow for active/main line
  if (active) {
    gfx.lineStyle(thickness + 3, color, 0.25)
    const dx = to.x - from.x
    const dy = to.y - from.y
    if (Math.abs(dy) < 2) {
      gfx.moveTo(from.x, from.y)
      gfx.lineTo(to.x, to.y)
    } else {
      const cx1 = from.x + dx * 0.3
      const cy1 = from.y
      const cx2 = to.x - dx * 0.3
      const cy2 = to.y
      gfx.moveTo(from.x, from.y)
      gfx.bezierCurveTo(cx1, cy1, cx2, cy2, to.x, to.y)
    }
  }

  // Primary sharp edge line
  gfx.lineStyle(active ? thickness + 0.8 : thickness, color, active ? Math.min(alpha + 0.15, 0.95) : alpha)
  const dx = to.x - from.x
  const dy = to.y - from.y

  if (Math.abs(dy) < 2) {
    // Same lane — straight line
    gfx.moveTo(from.x, from.y)
    gfx.lineTo(to.x, to.y)
  } else {
    // Different lane (real merge) — bezier curve
    const cx1 = from.x + dx * 0.3
    const cy1 = from.y
    const cx2 = to.x - dx * 0.3
    const cy2 = to.y
    gfx.moveTo(from.x, from.y)
    gfx.bezierCurveTo(cx1, cy1, cx2, cy2, to.x, to.y)
  }
}

/* ─────────────────────────────────────────
   Compute git layout
───────────────────────────────────────── */
function computeGitLayout(commits, width, height) {
  if (!commits || !commits.length) {
    return { positions: new Map(), bounds: { w: 800, h: 400, cx: 400, cy: 200 } }
  }

  const safeWidth  = Number.isFinite(width)  && width  > 0 ? width  : 900
  const safeHeight = Number.isFinite(height) && height > 0 ? height : 540

  const LANE_SPACING = 80
  const commitLane  = new Map()

  for (const c of commits) {
    commitLane.set(c.sha, c.isMerge ? 1 : 0)
  }

  const maxLane = Math.max(...[...commitLane.values()])
  const totalLanesH = maxLane * LANE_SPACING
  const centerY = safeHeight / 2
  const yStart = Math.max(60, centerY - totalLanesH / 2)

  const X_STEP  = 90
  const START_X = 80

  const positions = new Map()
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity

  commits.forEach((c, i) => {
    const lane = commitLane.get(c.sha) ?? 0
    const x = START_X + i * X_STEP
    const y = yStart + lane * LANE_SPACING

    const safeX = Number.isFinite(x) ? x : START_X + i * 90
    const safeY = Number.isFinite(y) ? y : safeHeight / 2

    if (safeX < minX) minX = safeX
    if (safeX > maxX) maxX = safeX
    if (safeY < minY) minY = safeY
    if (safeY > maxY) maxY = safeY

    positions.set(c.sha, { x: safeX, y: safeY, lane })
  })

  const padX = 80
  const padY = 60
  const boundsW = Math.max(safeWidth, maxX + padX)
  const boundsH = Math.max(safeHeight, maxY + padY)

  return {
    positions,
    bounds: {
      w: boundsW,
      h: boundsH,
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
    },
  }
}

/* ─────────────────────────────────────────
   Main Visualizer component
───────────────────────────────────────── */
export default function Visualizer({ parsed, onCommitSelect, filteredShas, selectedSha }) {
  const wrapperRef   = useRef(null)
  const appRef       = useRef(null)
  const viewportRef  = useRef(null)
  const nodeMapRef   = useRef(new Map())
  const edgeGRef     = useRef(null)
  const tooltipRef   = useRef(null)
  const [canvasReady, setCanvasReady] = useState(false)

  const { dashboardTheme, graphTheme, intensity } = useTheme()
  
  const latestGraphTheme = useRef(graphTheme)
  const latestDashboardTheme = useRef(dashboardTheme)
  const latestIntensity = useRef(intensity)

  useEffect(() => {
    latestGraphTheme.current = graphTheme
    latestDashboardTheme.current = dashboardTheme
    latestIntensity.current = intensity
  }, [graphTheme, dashboardTheme, intensity])

  const setDuration = usePlayback(s => s.setDuration)
  const setTime     = usePlayback(s => s.setTime)
  const setPlaying  = usePlayback(s => s.setPlaying)

  const buildScene = useCallback(() => {
    if (!wrapperRef.current || !parsed || !parsed.commits) return

    const wrapper = wrapperRef.current
    const width   = wrapper.clientWidth  || 900
    const height  = wrapper.clientHeight || 540

    const commits = parsed.commits || []
    const tags    = new Set((parsed.tags || []).map(t => t.sha || t.commit?.sha))

    const taggedCommits = commits.map(c => ({ ...c, isTag: tags.has(c.sha) }))

    const minTs = commits[0]?.timestamp || 0
    const maxTs = commits[commits.length - 1]?.timestamp || minTs + 1

    const { positions, bounds } = computeGitLayout(taggedCommits, width, height)

    if (appRef.current) {
      try { appRef.current.destroy(true, { children: true }) } catch (e) {}
      appRef.current = null
    }
    wrapper.innerHTML = ''

    let isCancelled = false

    const app = new PIXI.Application({
      width,
      height,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    })

    if (isCancelled) {
      app.destroy(true, { children: true })
      return
    }

    appRef.current = app
    wrapper.appendChild(app.view)
    app.view.style.width  = '100%'
    app.view.style.height = height + 'px'

    // ── Viewport ──
    const viewport = new Viewport({
      screenWidth:  width,
      screenHeight: height,
      worldWidth:   bounds.w,
      worldHeight:  bounds.h,
      events: app.renderer.events,
    })
    viewportRef.current = viewport
    app.stage.addChild(viewport)

    viewport
      .drag({ mouseButtons: 'left' })
      .pinch()
      .wheel({ smooth: 5 })
      .decelerate({ friction: 0.93 })
      .clampZoom({ minScale: 0.08, maxScale: 5 })

    // ── Grid ──
    const gridG = new PIXI.Graphics()
    app.stage.addChildAt(gridG, 0)
    drawGrid(gridG, width * 4, height * 4, 48)

    // ── Edges ──
    const edgeG = new PIXI.Graphics()
    viewport.addChild(edgeG)
    edgeGRef.current = edgeG

    const drawEdges = (activeSha = null, currentTs = Infinity) => {
      if (!edgeG || isCancelled) return
      edgeG.clear()

      for (const c of taggedCommits) {
        const isFuture = c.timestamp > currentTs
        const from = positions.get(c.sha)
        if (!from) continue

        const themeColors = latestGraphTheme.current
        const edgeHighlight = c.isMerge ? themeColors.mergeCore : c.isHead ? themeColors.headCore : themeColors.normalCore

        for (const pSha of c.parents) {
          const to = positions.get(pSha)
          if (!to) continue
          const pCommit = taggedCommits.find(x => x.sha === pSha)
          const isFutureEdge = isFuture || (pCommit && pCommit.timestamp > currentTs)
          const isActive = (c.sha === activeSha || pSha === activeSha) && !isFutureEdge

          const baseColor = isFutureEdge
            ? themeColors.edgeDim
            : c.isMerge ? themeColors.mergeCore : themeColors.edge
          const baseAlpha = isFutureEdge ? 0.25 : c.isMerge ? 0.75 : 0.80

          drawBezierEdge(
            edgeG, from, to,
            isActive ? edgeHighlight : baseColor,
            isActive ? 0.95 : baseAlpha,
            c.isMerge ? 1.8 : 1.6,
            isActive
          )
        }
      }
    }

    drawEdges(null, Infinity)

    // ── Tooltip ──
    const tooltip = document.createElement('div')
    Object.assign(tooltip.style, {
      position: 'absolute', pointerEvents: 'none', display: 'none', zIndex: '50',
      background: 'rgba(10,13,26,0.97)', border: `1px solid rgba(255,255,255,0.1)`,
      borderRadius: '12px', padding: '10px 14px', fontSize: '12px', color: 'white',
      backdropFilter: 'blur(16px)', boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
      maxWidth: '240px', lineHeight: '1.65',
    })
    
    // We will update tooltip border color dynamically in pointerover
    wrapper.style.position = 'relative'
    wrapper.appendChild(tooltip)
    tooltipRef.current = tooltip

    // ── Nodes ──
    const nodeMap = new Map()
    nodeMapRef.current = nodeMap

    for (const commit of taggedCommits) {
      const pos = positions.get(commit.sha)
      if (!pos) continue

      const container = new PIXI.Container()
      container.x = pos.x
      container.y = pos.y
      container.eventMode = 'static'
      container.cursor    = 'pointer'

      const gfx = new PIXI.Graphics()
      // Note: first draw is fine to use the ref, the ticker updates it anyway.
      drawNode(gfx, commit, 'normal', {}, latestGraphTheme.current, latestIntensity.current)
      container.addChild(gfx)

      // Hover
      container.on('pointerover', (event) => {
        if (isCancelled) return
        const isSel = nodeMap.get(commit.sha)?.selected
        drawNode(gfx, commit, isSel ? 'selected' : 'hover', {}, latestGraphTheme.current, latestIntensity.current)

        const mouse = event.data.global
        const typeLabel = commit.isHead ? '⬤ HEAD' : commit.isMerge ? '★ Merge' : commit.isTag ? '◆ Tag' : '● Commit'
        
        const toHex = (num) => '#' + num.toString(16).padStart(6, '0')
        const tGraph = latestGraphTheme.current
        const typeColor = commit.isHead ? toHex(tGraph.headCore) : commit.isMerge ? toHex(tGraph.mergeCore) : commit.isTag ? '#22C55E' : toHex(tGraph.normalCenter)
        const relDate   = (() => {
          const diff = Math.floor(Date.now() / 1000) - commit.timestamp
          if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`
          if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`
          if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
          return new Date(commit.timestamp * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        })()

        tooltip.innerHTML = `
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px">
            <span style="font-family:monospace;font-weight:700;color:${typeColor};font-size:11px">${commit.shortSha}</span>
            <span style="font-size:10px;color:${typeColor};opacity:0.7">${typeLabel}</span>
          </div>
          <div style="margin-bottom:5px;font-size:12px;color:rgba(255,255,255,0.85);line-height:1.4">${commit.message.split('\n')[0].slice(0, 72)}</div>
          <div style="color:rgba(255,255,255,0.45);font-size:11px">${commit.authorName}</div>
          <div style="color:rgba(255,255,255,0.35);font-size:10px;margin-top:2px">${relDate}</div>
        `
        tooltip.style.borderColor = latestDashboardTheme.current.colors.border
        tooltip.style.display = 'block'
        const tx = mouse.x + 16
        const ty = mouse.y + 16
        tooltip.style.left = `${tx}px`
        tooltip.style.top  = `${ty}px`
      })

      container.on('pointermove', (event) => {
        const mouse = event.data.global
        tooltip.style.left = `${mouse.x + 16}px`
        tooltip.style.top  = `${mouse.y + 16}px`
      })

      container.on('pointerout', () => {
        if (isCancelled) return
        const isSel = nodeMap.get(commit.sha)?.selected
        drawNode(gfx, commit, isSel ? 'selected' : 'normal', {}, latestGraphTheme.current, latestIntensity.current)
        tooltip.style.display = 'none'
      })

      container.on('pointerdown', () => {
        if (isCancelled) return
        setTime(commit.timestamp - minTs)
        setPlaying(false)
        onCommitSelect?.(commit)
        drawEdges(commit.sha)

        // Reset all nodes
        for (const [, entry] of nodeMap) {
          entry.selected = false
          drawNode(entry.gfx, entry.commit, 'normal', {}, latestGraphTheme.current, latestIntensity.current)
        }
        // Highlight selected
        const nodeEntry = nodeMap.get(commit.sha)
        if (nodeEntry) {
          nodeEntry.selected = true
          nodeEntry.ringTime = 0 // trigger expanding ring animation
          drawNode(gfx, commit, 'selected', {}, latestGraphTheme.current, latestIntensity.current)
        }
        tooltip.style.display = 'none'
      })

      viewport.addChild(container)
      nodeMap.set(commit.sha, { container, gfx, commit, selected: false, ringTime: -1 })
    }

    // ── Ticker (animations + playback state) ──
    let animT = 0
    const ticker = () => {
      if (isCancelled) return
      animT += 0.04

      const pbState   = usePlayback.getState()
      const currentTs = (pbState.time === 0 && !pbState.playing)
        ? Infinity
        : minTs + pbState.time

      let active = null
      for (const c of taggedCommits) {
        if (c.timestamp <= currentTs) active = c
        else break
      }
      const activeSha = active?.sha || null

      drawEdges(activeSha, currentTs)

      // Slow smooth breathing pulse for HEAD (1.0 -> 1.15 -> 1.0 around 2.0s)
      const headPulse = 1.0 + 0.15 * (0.5 + 0.5 * Math.sin(animT * 2.8))

      for (const [sha, entry] of nodeMap) {
        const isCompleted = entry.commit.timestamp <= currentTs
        const isFuture = !isCompleted
        const isCurrentPlaying = pbState.playing && sha === activeSha

        entry.container.visible = true

        // State determination for drawing
        if (entry.selected) {
          let ringRadius = 0
          let ringAlpha = 0
          if (entry.ringTime >= 0 && entry.ringTime < 1.0) {
            entry.ringTime += 0.03
            ringRadius = 10 + entry.ringTime * 18
            ringAlpha = (1 - entry.ringTime) * 0.7
          }
          drawNode(entry.gfx, entry.commit, 'selected', { ringRadius, ringAlpha }, latestGraphTheme.current, latestIntensity.current)
          entry.container.scale.set(1.08)
        } else if (entry.commit.isHead) {
          drawNode(entry.gfx, entry.commit, 'normal', {}, latestGraphTheme.current, latestIntensity.current)
          entry.container.scale.set(headPulse)
        } else if (isCurrentPlaying) {
          drawNode(entry.gfx, entry.commit, 'current', {}, latestGraphTheme.current, latestIntensity.current)
          const pulse = 1.0 + 0.14 * Math.sin(animT * 8)
          entry.container.scale.set(pulse)
        } else if (isFuture) {
          drawNode(entry.gfx, entry.commit, 'future', {}, latestGraphTheme.current, latestIntensity.current)
          entry.container.scale.set(1.0)
        } else {
          drawNode(entry.gfx, entry.commit, 'normal', {}, latestGraphTheme.current, latestIntensity.current)
          entry.container.scale.set(1.0)
        }
      }
    }
    app.ticker.add(ticker)

    // ── Initial fit ──
    setTimeout(() => {
      if (isCancelled || !viewport) return
      try {
        if (Number.isFinite(bounds.cx) && Number.isFinite(bounds.cy) && bounds.w > 0) {
          viewport.fit(true)
          viewport.moveCenter(bounds.cx, bounds.cy)
        } else {
          viewport.setZoom(1)
          viewport.moveCenter(width / 2, height / 2)
        }
      } catch (e) {}
    }, 60)

    setCanvasReady(true)

    // ── Resize ──
    const onResize = () => {
      if (!wrapper || !app.renderer || isCancelled) return
      const w = wrapper.clientWidth
      try { app.renderer.resize(w, height) } catch (e) {}
    }
    window.addEventListener('resize', onResize)

    return () => {
      isCancelled = true
      window.removeEventListener('resize', onResize)
      try { app.ticker.remove(ticker) } catch (e) {}
      try { app.destroy(true, { children: true }) } catch (e) {}
      try { tooltip?.remove() } catch (e) {}
      appRef.current = null
      nodeMapRef.current.clear()
    }
  }, [parsed, onCommitSelect, setDuration, setPlaying, setTime])

  useEffect(() => {
    const cleanup = buildScene()
    return () => { cleanup?.() }
  }, [buildScene])

  // Filter highlight
  useEffect(() => {
    if (!nodeMapRef.current.size) return
    for (const [sha, entry] of nodeMapRef.current) {
      entry.container.alpha = !filteredShas || filteredShas.has(sha) ? 1 : 0.12
    }
  }, [filteredShas])

  // Zoom controls
  const handleFitGraph = () => {
    const vp = viewportRef.current
    if (!vp) return
    try {
      vp.fit(true)
      const app = appRef.current
      if (app) vp.moveCenter(vp.worldWidth / 2, vp.worldHeight / 2)
    } catch (e) {}
  }
  const handleZoomIn  = () => viewportRef.current?.zoomPercent(0.3, true)
  const handleZoomOut = () => viewportRef.current?.zoomPercent(-0.3, true)

  return (
    <div className="relative flex-1 min-w-0">
      <div
        ref={wrapperRef}
        className="graph-canvas-wrap"
        style={{ height: 540, background: 'rgba(8,11,22,0.5)' }}
      />

      {canvasReady && (
        <>
          {/* Zoom controls */}
          <div className="absolute bottom-4 right-4 flex flex-col gap-1.5 z-40">
            {[
              { label: '⊞', title: 'Fit graph',    action: handleFitGraph },
              { label: '+', title: 'Zoom in',       action: handleZoomIn },
              { label: '−', title: 'Zoom out',      action: handleZoomOut },
              { label: '↺', title: 'Reset camera',  action: handleFitGraph },
            ].map(btn => (
              <button
                key={btn.title}
                title={btn.title}
                onClick={btn.action}
                className="w-8 h-8 rounded-lg glass border border-white/10 text-white/50 hover:text-white hover:border-white/40 transition-all text-sm font-mono flex items-center justify-center"
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Dynamic Legend */}
          <div className="absolute bottom-4 left-4 glass rounded-xl px-3 py-2 flex items-center gap-3 z-40">
            {[
              { color: '#' + graphTheme.normalCore.toString(16).padStart(6, '0'), label: '● Normal' },
              { color: '#' + graphTheme.headCore.toString(16).padStart(6, '0'), label: '⬤ HEAD' },
              { color: '#' + graphTheme.mergeCore.toString(16).padStart(6, '0'), label: '★ Merge' },
              { color: '#22C55E', label: '◆ Tag' },
            ].map(item => (
              <div key={item.label} className="flex items-center gap-1">
                <span className="text-xs font-medium" style={{ color: item.color }}>{item.label}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
