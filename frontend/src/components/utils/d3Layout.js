import { forceSimulation, forceManyBody, forceCenter, forceLink } from 'd3-force'

// Compute 2D layout (x,y for each commit node) using a force simulation.
// This is a pure function: given nodes and links, returns a Promise resolving to positions.
export function computeLayout({ nodes = [], links = [], width = 1200, height = 600, iterations = 300 } = {}) {
  return new Promise((resolve) => {
    // copy nodes so we don't mutate originals
    const simNodes = nodes.map((n, i) => ({ ...n, id: n.sha || n.id || String(i) }))
    const simLinks = (links || []).map((l) => ({ source: l.source, target: l.target, value: l.value || 1 }))

    const simulation = forceSimulation(simNodes)
      .force('charge', forceManyBody().strength(-30).distanceMax(200))
      .force('center', forceCenter(width / 2, height / 2))
      .force('link', forceLink(simLinks).id((d) => d.id).distance(30).strength(1))
      .stop()

    // run synchronously for 'iterations' steps
    for (let i = 0; i < iterations; i++) simulation.tick()

    // collect positions
    const result = simNodes.map((n) => ({ id: n.id, x: n.x, y: n.y }))
    resolve(result)
  })
}
