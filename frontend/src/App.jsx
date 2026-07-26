import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ThemeProvider } from './theme/ThemeContext'
import HomePage              from './pages/HomePage'
import RepositoryPage        from './pages/RepositoryPage'
import RepositoryStoryPage   from './pages/RepositoryStoryPage'
import ContributorStoryPage  from './pages/ContributorStoryPage'
import FileEvolutionPage     from './pages/FileEvolutionPage'
import FilesPage             from './pages/FilesPage'
import FileDetailPage        from './pages/FileDetailPage'
import TimeMachinePage       from './pages/TimeMachinePage'
import PresentationPage      from './pages/PresentationPage'

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/repository/:owner/:repo" element={<RepositoryPage />} />
          {/* Layer 2 — Repository Intelligence */}
          <Route path="/repository/:owner/:repo/story"        element={<RepositoryStoryPage />} />
          <Route path="/repository/:owner/:repo/contributors" element={<ContributorStoryPage />} />
          <Route path="/repository/:owner/:repo/files"        element={<FilesPage />} />
          <Route path="/repository/:owner/:repo/files/detail" element={<FileDetailPage />} />
          <Route path="/repository/:owner/:repo/time-machine"  element={<TimeMachinePage />} />
          <Route path="/repository/:owner/:repo/present"       element={<PresentationPage />} />
          {/* Catch-all → home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  )
}
