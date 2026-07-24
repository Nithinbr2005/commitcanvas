import React, { useEffect, useRef, useState } from 'react'
import * as PIXI from 'pixi.js'
import { createProgressiveLayout } from '../utils/d3Layout'
import { usePlayback } from '../store/usePlayback'

function clusterCommits(commits, threshold = 1000) {
  if (!commits || commits.length <= threshold) return { type: 'flat', items: commits }

  const map = new Map()
  for (const commit of commits) {
    const day = new Date(commit.timestamp * 1000).toISOString().slice(0, 10)
    const arr = map.get(day) || []
    arr.push(commit)
    map.set(day, arr)
  }

  const items = Array.from(map.entries()).map(([day, arr]) => ({ day, count: arr.length, commits: arr }))
  return { type: 'cluster', items }
}

export default function Visualizer({ parsed }) {
  const wrapperRef = useRef(null)
  const appRef = useRef(null)
  const nodeGRef = useRef(new Map())
  const contribGRef = useRef(new Map())
  const modeRef = useRef('commits')
  const [info, setInfo] = useState(null)
  const [mode, setMode] = useState('commits')

  const setDuration = usePlayback((s) => s.setDuration)
  const setTime = usePlayback((s) => s.setTime)
  const setPlaying = usePlayback((s) => s.setPlaying)

  useEffect(() => {
    try {
      if (!wrapperRef.current || !parsed) return

      let disposed = false
      const width = wrapperRef.current.clientWidth || 900
      const height = 600

      const app = new PIXI.Application({ width, height, backgroundAlpha: 0, antialias: true })
      appRef.current = app
      try { window.__commitCanvas = window.__commitCanvas || {}; window.__commitCanvas.app = app } catch (e) {}

      wrapperRef.current.innerHTML = ''
      wrapperRef.current.appendChild(app.view)

      const tooltip = document.createElement('div')
      tooltip.style.position = 'absolute'
      tooltip.style.pointerEvents = 'none'
      tooltip.style.background = 'rgba(2, 6, 23, 0.9)'
      tooltip.style.color = 'white'
      tooltip.style.padding = '6px 8px'
      tooltip.style.borderRadius = '6px'
      tooltip.style.fontSize = '12px'
      tooltip.style.display = 'none'
      tooltip.style.zIndex = '10'
      wrapperRef.current.style.position = 'relative'
      wrapperRef.current.appendChild(tooltip)

      const commits = parsed.commits || []
      const sorted = [...commits].sort((a, b) => a.timestamp - b.timestamp)
      const timestamps = sorted.map((commit) => commit.timestamp)
      const minTs = timestamps[0] || 0
      const maxTs = timestamps[timestamps.length - 1] || minTs + 1
      setDuration(maxTs - minTs)

      const nodeMap = new Map()
      sorted.forEach((commit, index) => nodeMap.set(commit.sha, { id: commit.sha, index, commit }))

      const links = []
      for (const commit of sorted) {
        if (commit.parents && commit.parents.length) {
          for (const parent of commit.parents) {
            if (nodeMap.has(parent)) links.push({ source: commit.sha, target: parent })
          }
        }
      }

      const merges = new Set(sorted.filter((commit) => commit.parents && commit.parents.length > 1).map((commit) => commit.sha))
      const cluster = clusterCommits(sorted, 1200)

      const layoutNodes = cluster.type === 'flat'
        ? sorted.map((commit) => ({ sha: commit.sha }))
        : cluster.items.map((item, index) => ({ sha: `cluster-${index}`, count: item.count }))

      const layoutLinks = cluster.type === 'flat'
        ? links.map((link) => ({ source: link.source, target: link.target }))
        : Array.from({ length: Math.max(0, layoutNodes.length - 1) }, (_, index) => ({ source: layoutNodes[index + 1].sha, target: layoutNodes[index].sha }))

      const initialPositions = new Map()
      const initialNodes = layoutNodes.map((node, index) => {
        const x = 80 + (index % 14) * 70
        const y = 80 + Math.floor(index / 14) * 70
        const pos = { x, y }
        initialPositions.set(node.sha, pos)
        return { ...node, x: pos.x, y: pos.y }
      })

      const edgeG = new PIXI.Graphics()
      app.stage.addChild(edgeG)

      const nodeContainer = new PIXI.Container()
      nodeContainer.visible = modeRef.current !== 'contributors'
      app.stage.addChild(nodeContainer)

      const contribContainer = new PIXI.Container()
      contribContainer.visible = modeRef.current === 'contributors'
      app.stage.addChild(contribContainer)

      const drawLinks = (positions) => {
        if (disposed || !edgeG || typeof edgeG.clear !== 'function') return
        try {
          edgeG.clear()
          edgeG.lineStyle(1, 0x2b6cb0, 0.6)
          for (const link of layoutLinks) {
            const from = positions.get(link.source)
            const to = positions.get(link.target)
            if (!from || !to) continue
            edgeG.moveTo(from.x, from.y)
            edgeG.lineTo(to.x, to.y)
          }
        } catch (e) {
          console.warn('Visualizer link draw skipped during cleanup', e)
        }
      }

      const updateNodePositions = (positions) => {
        if (!positions || positions.size === 0) return
        for (const child of nodeContainer.children) {
          const id = child.userData?.id
          const pos = positions.get(id)
          if (!pos) continue
          child.x = pos.x
          child.y = pos.y
        }
        drawLinks(positions)
      }

      for (const node of initialNodes) {
        const isCluster = node.sha.startsWith('cluster-')
        const dataNode = layoutNodes.find((item) => item.sha === node.sha)
        const commitRef = isCluster ? null : parsed.commits.find((commit) => commit.sha === node.sha)

        const group = new PIXI.Container()
        const circle = new PIXI.Graphics()
        const radius = isCluster ? Math.max(6, Math.sqrt(dataNode?.count || 1) * 4) : 5

        circle.beginFill(0x7c3aed)
        circle.drawCircle(0, 0, radius)
        circle.endFill()

        if (!isCluster && merges.has(node.sha)) {
          const star = new PIXI.Graphics()
          star.beginFill(0xff7b00)
          const spikes = 5
          const outer = radius + 4
          const inner = Math.max(2, Math.floor(outer * 0.45))
          const points = []
          const step = Math.PI / spikes
          for (let i = 0; i < spikes * 2; i++) {
            const r = i % 2 === 0 ? outer : inner
            const angle = i * step
            points.push(Math.cos(angle) * r, Math.sin(angle) * r)
          }
          star.drawPolygon(points)
          star.endFill()
          star.alpha = 0.95
          group.addChild(star)
        }

        group.addChild(circle)

        const labelText = new PIXI.Text(
          isCluster ? `${dataNode.count} commits` : (commitRef ? commitRef.message.split('\n')[0].slice(0, 40) : ''),
          { fontSize: 10, fill: 0x9ca3af }
        )
        labelText.x = radius + 6
        labelText.y = -6
        labelText.visible = false
        group.addChild(labelText)

        group.x = node.x
        group.y = node.y
        group.interactive = true
        group.buttonMode = true
        group.userData = { id: node.sha }

        group.on('pointerover', (event) => {
          const mouse = event.data.global
          tooltip.style.display = 'block'
          if (isCluster) {
            tooltip.innerText = `${dataNode.count} commits on ${dataNode.sha}`
          } else if (commitRef) {
            tooltip.innerText = `${commitRef.author?.name || 'unknown'}\n${new Date(commitRef.timestamp * 1000).toISOString().split('T')[0]}\n${commitRef.message.split('\n')[0]}`
          }
          tooltip.style.left = `${mouse.x + 12}px`
          tooltip.style.top = `${mouse.y + 12}px`
          labelText.visible = true
        })
        group.on('pointermove', (event) => {
          const mouse = event.data.global
          tooltip.style.left = `${mouse.x + 12}px`
          tooltip.style.top = `${mouse.y + 12}px`
        })
        group.on('pointerout', () => {
          tooltip.style.display = 'none'
          labelText.visible = false
        })
        group.on('pointerdown', () => {
          let targetTs = minTs
          if (!isCluster && commitRef) targetTs = commitRef.timestamp
          else if (isCluster) {
            const index = Number(node.sha.split('-')[1])
            const item = cluster.items[index]
            if (item && item.commits && item.commits.length) targetTs = item.commits[Math.floor(item.commits.length / 2)].timestamp
          }
          setTime(targetTs - minTs)
          setPlaying(false)
        })

        const filesGroup = new PIXI.Container()
        filesGroup.x = -radius
        filesGroup.y = radius + 6
        filesGroup.visible = false
        group.addChild(filesGroup)

        if (commitRef && Array.isArray(commitRef.files)) {
          commitRef.files.slice(0, 6).forEach((_, fileIndex) => {
            const fileGraphic = new PIXI.Graphics()
            fileGraphic.beginFill(0xf59e0b)
            fileGraphic.drawRect(fileIndex * 10, 0, 8, 8)
            fileGraphic.endFill()
            filesGroup.addChild(fileGraphic)
          })
        }

        nodeContainer.addChild(group)
        nodeGRef.current.set(node.sha, { container: group, circle, filesGroup })
      }

      updateNodePositions(initialPositions)

      const contributors = parsed.contributors || []
      const cx = width / 2
      const cy = height / 2
      const radius = Math.min(width, height) / 3
      contributors.forEach((contrib, index) => {
        const angle = (index / Math.max(1, contributors.length)) * Math.PI * 2
        const x = cx + Math.cos(angle) * radius
        const y = cy + Math.sin(angle) * radius
        const group = new PIXI.Container()
        const cRadius = Math.max(8, Math.sqrt(contrib.commits || 1) * 4)
        const cCircle = new PIXI.Graphics()
        cCircle.beginFill(0x22c55e)
        cCircle.drawCircle(0, 0, cRadius)
        cCircle.endFill()
        group.addChild(cCircle)

        const label = new PIXI.Text((contrib.name || '').split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase(), { fontSize: Math.max(10, cRadius), fill: 0x001011, fontWeight: '700' })
        label.anchor.set(0.5)
        group.addChild(label)

        group.x = x
        group.y = y
        group.interactive = true
        group.buttonMode = true
        group.on('pointerover', (event) => {
          tooltip.style.display = 'block'
          tooltip.innerText = `${contrib.name}\n${contrib.commits} commits`
          tooltip.style.left = `${event.data.global.x + 12}px`
          tooltip.style.top = `${event.data.global.y + 12}px`
        })
        group.on('pointerout', () => { tooltip.style.display = 'none' })
        group.on('pointerdown', () => {
          const first = sorted.find((commit) => (commit.author && (commit.author.email === contrib.email || commit.author.name === contrib.name)))
          if (first) {
            setTime(first.timestamp - minTs)
            setPlaying(false)
          }
        })

        contribContainer.addChild(group)
        contribGRef.current.set(contrib.email || contrib.name, { container: group, circle: cCircle })
      })

      let frameCount = 0
      const frameInterval = setInterval(() => {
        try {
          window.__commitCanvas = window.__commitCanvas || {}
          window.__commitCanvas.fps = frameCount
          frameCount = 0
        } catch (e) {}
      }, 1000)

      const ticker = () => {
        if (disposed) return
        frameCount += 1
        const currentTs = minTs + (usePlayback.getState().time || 0)
        let active = null
        for (const commit of sorted) {
          if (commit.timestamp <= currentTs) active = commit
          else break
        }

        nodeGRef.current.forEach((entry, id) => {
          const circle = entry.circle
          if (!circle) return
          if (id === (active && active.sha)) {
            const scale = 1 + 0.25 * Math.sin(Date.now() / 200)
            circle.scale.set(scale)
            circle.alpha = 1
          } else {
            circle.scale.set(1)
            circle.alpha = 0.9
          }

          if (entry.filesGroup) {
            if (active && id === active.sha) {
              entry.filesGroup.visible = true
              entry.filesGroup.children.forEach((fileGraphic, index) => {
                const scale = 1 + 0.4 * Math.sin((Date.now() / 150) + index)
                fileGraphic.scale.set(scale)
              })
            } else {
              entry.filesGroup.visible = false
            }
          }
        })

        if (modeRef.current === 'contributors') {
          const activeAuthor = active ? (active.author && (active.author.email || active.author.name)) : null
          contribGRef.current.forEach((entry, key) => {
            entry.circle.alpha = key === activeAuthor ? 1 : 0.4
          })
        }
      }

      app.ticker.add(ticker)

      const toggleBtn = document.createElement('button')
      toggleBtn.innerText = 'Toggle Contributors'
      toggleBtn.style.position = 'absolute'
      toggleBtn.style.right = '14px'
      toggleBtn.style.top = '14px'
      toggleBtn.className = 'px-3 py-1 bg-slate-700 rounded text-sm'
      toggleBtn.onclick = () => {
        const nextMode = modeRef.current === 'commits' ? 'contributors' : 'commits'
        modeRef.current = nextMode
        setMode(nextMode)
        nodeContainer.visible = nextMode !== 'contributors'
        contribContainer.visible = nextMode === 'contributors'
      }
      wrapperRef.current.appendChild(toggleBtn)

      let layoutController = null
      const startProgressiveLayout = () => {
        if (disposed || !initialNodes.length) return
        layoutController = createProgressiveLayout({
          nodes: initialNodes,
          links: layoutLinks,
          width,
          height,
          tickBatch: 4,
          alphaMin: 0.003,
          alphaDecay: 0.028,
          onTick: (simNodes) => {
            if (disposed) return
            const nextPositions = new Map(simNodes.map((node) => [node.id, { x: node.x, y: node.y }]))
            updateNodePositions(nextPositions)
          },
          onEnd: (simNodes) => {
            if (disposed) return
            const nextPositions = new Map(simNodes.map((node) => [node.id, { x: node.x, y: node.y }]))
            updateNodePositions(nextPositions)
          },
        })
        layoutController.start()
      }

      requestAnimationFrame(startProgressiveLayout)

      setInfo({ commits: commits.length, branches: parsed.branches?.length || 0 })

      const onResize = () => {
        const w = wrapperRef.current?.clientWidth || width
        app.renderer.resize(w, height)
      }
      window.addEventListener('resize', onResize)

      return () => {
        disposed = true
        window.removeEventListener('resize', onResize)
        try { app.ticker.remove(ticker) } catch (e) {}
        try { app.destroy(true, { children: true }) } catch (e) {}
        try { tooltip.remove() } catch (e) {}
        try { wrapperRef.current?.querySelector('button')?.remove() } catch (e) {}
        try { clearInterval(frameInterval) } catch (e) {}
        try { layoutController?.stop() } catch (e) {}
        appRef.current = null
        nodeGRef.current.clear()
        contribGRef.current.clear()
      }
    } catch (err) {
      console.error('Visualizer effect error', err)
    }
  }, [parsed, setDuration, setTime, setPlaying])

  return (
    <div className="mt-6 bg-transparent rounded-md relative">
      <div ref={wrapperRef} className="w-full h-[600px] bg-[rgba(255,255,255,0.02)] rounded-md" />
      {info && <div className="mt-2 text-sm text-slate-400">Commits: {info.commits} • Branches: {info.branches}</div>}
    </div>
  )
}
