# CommitCanvas — Living Git History Visualizer (Scaffold)

This repository contains a scaffold for CommitCanvas: a web app that visualizes a repository's commit history as an animated, scrubbable timeline.

This scaffold includes:
- server/ — Express backend with scaffolded endpoints: /api/repo/fetch, /api/repo/narrate, /api/repo/export
- client/ — Vite + React frontend scaffold with a repo input screen and a placeholder visualizer

Quick start (development):

Prerequisites
- Node.js 18+ (LTS)
- npm
- git (optional, required for full cloning behavior)
- ffmpeg (optional, required for server-side export)

1) Install server dependencies
   cd "C:\\Users\\Nithin\\Downloads\\commit canvas\\server"
   npm install

2) Install client dependencies
   cd "C:\\Users\\Nithin\\Downloads\\commit canvas\\client"
   npm install

3) Run server and client in separate terminals
   # Terminal 1 - backend
   cd server
   npm run dev

   # Terminal 2 - frontend
   cd client
   npm run dev

Environment variables
- Copy server/.env.example to server/.env and set ANTHROPIC_API_KEY and optionally GITHUB_TOKEN if you want real narration and higher GitHub rate limits.

Notes
- The current scaffold returns sample parsed repo data for demo/testing. The full git cloning (isomorphic-git) and server-side ffmpeg export are TODO but the endpoints and client wiring exist for iterative development.
- Example preset repo keys in the client: "example:small" to use the bundled sample data.

Next steps to complete the project (suggested):
1. Implement isomorphic-git shallow clone in /api/repo/fetch, with a GitHub API fallback for very large repos.
2. Integrate Anthropic/Claude in /api/repo/narrate for real narrated summaries.
3. Implement server-side export using fluent-ffmpeg or client-side capture as fallback.
4. Build PixiJS renderer and D3 layout integration in the client.

Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
