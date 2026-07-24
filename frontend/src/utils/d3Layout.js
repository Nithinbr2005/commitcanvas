import { forceSimulation, forceManyBody, forceCenter, forceLink } from 'd3-force'

export async function computeLayout({ nodes = [], links = [], width = 1200, height = 600, iterations = 300 } = {}) {
  const simNodes = nodes.map((n, i) => ({ ...n, id: n.sha || n.id || String(i) }))
  const simLinks = (links || []).map((l) => ({ source: l.source, target: l.target, value: l.value || 1 }))

  const simulation = forceSimulation(simNodes)
    .force('charge', forceManyBody().strength(-30).distanceMax(200))
    .force('center', forceCenter(width / 2, height / 2))
    .force('link', forceLink(simLinks).id((d) => d.id).distance(40).strength(1))
    .stop()

  for (let i = 0; i < iterations; i++) simulation.tick()

  return simNodes.map((n) => ({ id: n.id, x: n.x, y: n.y }))
}

export function createProgressiveLayout({ nodes = [], links = [], width = 1200, height = 600, tickBatch = 5, alphaMin = 0.002, alphaDecay = 0.022, onTick, onEnd } = {}) {
  const simNodes = nodes.map((n, i) => ({ ...n, id: n.sha || n.id || String(i) }))
  const simLinks = (links || []).map((l) => ({ source: l.source, target: l.target, value: l.value || 1 }))

  const simulation = forceSimulation(simNodes)
    .force('charge', forceManyBody().strength(-30).distanceMax(200))
    .force('center', forceCenter(width / 2, height / 2))
    .force('link', forceLink(simLinks).id((d) => d.id).distance(40).strength(1))
    .alpha(1)
    .alphaDecay(alphaDecay)
    .alphaMin(alphaMin)
    .stop()

  let rafId = null
  const step = () => {
    for (let i = 0; i < tickBatch && simulation.alpha() > alphaMin; i++) {
      simulation.tick()
    }
    if (typeof onTick === 'function') onTick(simNodes)
    if (simulation.alpha() > alphaMin) {
      rafId = requestAnimationFrame(step)
    } else {
      rafId = null
      if (typeof onEnd === 'function') onEnd(simNodes)
    }
  }

  return {
    start() {
      if (rafId === null) step()
    },
    stop() {
      if (rafId !== null) cancelAnimationFrame(rafId)
      rafId = null
    },
    getNodes() {
      return simNodes
    },
    simulation,
  }
}
