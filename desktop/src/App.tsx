import { HashRouter, Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";

import DashboardPage from "./pages/Dashboard/DashboardPage";
import ProjectsPage from "./pages/Projects/ProjectsPage";
import CollectionsPage from "./pages/Collections/CollectionsPage";
import CrossProjectSearchPage from "./pages/Search/CrossProjectSearchPage";
import DuplicateDetectionPage from "./pages/Duplicates/DuplicateDetectionPage";
import ManuscriptAssistantPage from "./pages/Assistant/ManuscriptAssistantPage";
import ResearchCopilotPage from "./pages/Research/ResearchCopilotPage";
import ImportPage from "./pages/Import/ImportPage";
import JobsPage from "./pages/Jobs/JobsPage";
import PipelinesPage from "./pages/Pipelines/PipelinesPage";
import ExportPage from "./pages/Export/ExportPage";
import LogsPage from "./pages/Logs/LogsPage";
import SettingsPage from "./pages/Settings/SettingsPage";
import ProjectDetailPage from "./pages/Projects/ProjectDetailPage";

import "./App.css";

function App() {
  return (
    <HashRouter>
      <MainLayout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/collections" element={<CollectionsPage />} />
          <Route path="/search" element={<CrossProjectSearchPage />} />
          <Route path="/duplicates" element={<DuplicateDetectionPage />} />
          <Route path="/assistant" element={<ManuscriptAssistantPage />} />
          <Route path="/research" element={<ResearchCopilotPage />} />
          <Route path="/import" element={<ImportPage />} />
          <Route path="/jobs" element={<JobsPage />} />
          <Route path="/pipelines" element={<PipelinesPage />} />
          <Route path="/export" element={<ExportPage />} />
          <Route path="/logs" element={<LogsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/projects/:id" element={<ProjectDetailPage />} />
        </Routes>
      </MainLayout>
    </HashRouter>
  );
}

export default App;