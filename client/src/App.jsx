import { useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import DemoNotice from './components/DemoNotice.jsx'
import { Loading, ErrorState } from './components/AsyncState.jsx'
import { useAppData } from './lib/useAppData.js'
import { dismissAlert } from './api/index.js'

import Dashboard from './pages/Dashboard.jsx'
import Announcements from './pages/Announcements.jsx'
import CalendarPage from './pages/Calendar.jsx'
import OverloadAnalysis from './pages/OverloadAnalysis.jsx'
import Subjects from './pages/Subjects.jsx'

// No router library here on purpose — five pages, no deep links needed yet,
// and the template starts dependency-light. Swap in react-router later if
// the project grows shareable URLs per page.

export default function App() {
  const [activePage, setActivePage] = useState('dashboard')
  const { status, data, error, slow, reload } = useAppData()

  async function handleDismissAlert(id) {
    await dismissAlert(id)
    await reload()
  }

  return (
    <div className="app-shell">
      <Sidebar activePage={activePage} onNavigate={setActivePage} />

      <main className="main-panel">
        <DemoNotice />

        {status === 'loading' && (
          <div className="page-content">
            <Loading label={slow ? 'Loading. The server may be waking up, which can take up to a minute' : 'Loading'} />
          </div>
        )}

        {status === 'error' && (
          <div className="page-content">
            <ErrorState error={error} onRetry={reload} />
          </div>
        )}

        {status === 'ready' && activePage === 'dashboard' && (
          <Dashboard data={data} onDismissAlert={handleDismissAlert} onNavigate={setActivePage} />
        )}
        {status === 'ready' && activePage === 'announcements' && (
          <Announcements data={data} onReload={reload} />
        )}
        {status === 'ready' && activePage === 'calendar' && (
          <CalendarPage data={data} onReload={reload} />
        )}
        {status === 'ready' && activePage === 'overload' && (
          <OverloadAnalysis data={data} onReload={reload} />
        )}
        {status === 'ready' && activePage === 'subjects' && (
          <Subjects data={data} onReload={reload} />
        )}
      </main>
    </div>
  )
}
