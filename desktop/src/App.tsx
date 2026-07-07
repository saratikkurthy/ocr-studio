import { HashRouter, Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";

import DashboardPage from "./pages/Dashboard/DashboardPage";
import ProjectsPage from "./pages/Projects/ProjectsPage";
import ImportPage from "./pages/Import/ImportPage";
import JobsPage from "./pages/Jobs/JobsPage";
import PipelinesPage from "./pages/Pipelines/PipelinesPage";
import ExportPage from "./pages/Export/ExportPage";
import LogsPage from "./pages/Logs/LogsPage";
import SettingsPage from "./pages/Settings/SettingsPage";

import "./App.css";

function App() {
  return (
    <HashRouter>
      <MainLayout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/pipelines" element={<PipelinesPage />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </MainLayout>
    </HashRouter>
  );
}

export default App;