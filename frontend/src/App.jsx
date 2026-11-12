import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { ToastProvider } from './hooks/useToast'
import { DashboardLayout } from './layouts/DashboardLayout'
import { DashboardPage } from './pages/DashboardPage'
import { HistoryPage } from './pages/HistoryPage'
import { LandingPage } from './pages/LandingPage'
import { ResultsPage } from './pages/ResultsPage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route element={<DashboardLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/research/:researchId" element={<ResultsPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/settings" element={<SettingsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  )
}
