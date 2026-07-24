import axios from 'axios'
import { computeLayout } from './src/utils/d3Layout.js'

async function run() {
  const r = await axios.post('http://localhost:4000/api/repo/fetch', { repoUrl: 'https://github.com/Nithinbr2005/Expense--Tracker-website' })
  const data = r.data.data
  console.log('commits', data.commits.length)
  const commits = data.commits
  const layoutNodes = commits.map(c=>({ sha: c.sha }))
  const layoutLinks = commits.flatMap(c => (c.parents||[]).filter(p=>commits.some(x=>x.sha===p)).map(p=>({ source: c.sha, target: p })))
  const positions = await computeLayout({ nodes: layoutNodes, links: layoutLinks, width: 1200, height: 600, iterations: 100 })
  console.log('positions length', positions.length)
  console.log(positions.slice(0,5))
}

run().catch(e=>{ console.error(e); process.exit(1) })
