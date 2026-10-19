import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { VotersMode } from './modes/vote';
import { PlanningMode, PlanningDashboard } from './modes/plan';
import { HostMode } from './modes/host';
import { ViewMode, GeneralViewDashboard } from './modes/view';
import { PopupProvider } from './components/ui/PopupProvider';

function App() {
  return (
    <PopupProvider>
      <BrowserRouter>
        {/* 
          The app is in Hebrew, so we set the direction to RTL at the root level.
          We also ensure it takes up the full minimum height of the screen.
        */}
        <div dir="rtl" className="min-h-screen flex flex-col">
          <Routes>
            {/* Landing redirects to Planning Dashboard as requested */}
            <Route path="/" element={<Navigate to="/planning" replace />} />

            {/* Planning Routes */}
            <Route path="/planning" element={<PlanningDashboard />} />
            <Route path="/planning/:eventId" element={<PlanningMode />} />
            <Route path="/planning/:eventId/:tab" element={<PlanningMode />} />
            <Route path="/planning/:eventId/:tab/:subTab" element={<PlanningMode />} />

            {/* Host Routes (both selector and event-specific) */}
            <Route path="/host" element={<HostMode />} />
            <Route path="/host/:eventId" element={<HostMode />} />

            {/* Event-specific Routes */}
            <Route path="/:eventId" element={<VotersMode />} />
            <Route path="/view" element={<GeneralViewDashboard />} />
            <Route path="/view/:eventId" element={<ViewMode />} />
            <Route path="/:eventId/view" element={<ViewMode />} />
          </Routes>
        </div>
      </BrowserRouter>
    </PopupProvider>
  );
}

export default App;
