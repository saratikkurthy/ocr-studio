import { HashRouter, Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";

import DashboardPage from "./pages/Dashboard/DashboardPage";
import ProjectsPage from "./pages/Projects/ProjectsPage";
import CollectionsPage from "./pages/Collections/CollectionsPage";
import CrossProjectSearchPage from "./pages/Search/CrossProjectSearchPage";
import DuplicateDetectionPage from "./pages/Duplicates/DuplicateDetectionPage";
import ManuscriptAssistantPage from "./pages/Assistant/ManuscriptAssistantPage";
import ResearchCopilotPage from "./pages/Research/ResearchCopilotPage";
import ReviewWorkflowPage from "./pages/Review/ReviewWorkflowPage";
import GovernancePage from "./pages/Governance/GovernancePage";
import KnowledgeGraphPage from "./pages/KnowledgeGraph/KnowledgeGraphPage";
import TimelineNarrativePage from "./pages/Timeline/TimelineNarrativePage";
import CrossProjectGraphPage from "./pages/CrossGraph/CrossProjectGraphPage";
import ResearchWorkbenchPage from "./pages/Workbench/ResearchWorkbenchPage";
import ResearchCanvasPage from "./pages/Canvas/ResearchCanvasPage";
import EvidenceResearchAssistantPage from "./pages/EvidenceAssistant/EvidenceResearchAssistantPage";
import CorpusIntelligencePage from "./pages/Corpus/CorpusIntelligencePage";
import ResearchDiscoveryPage from "./pages/Discovery/ResearchDiscoveryPage";
import EditionManagerPage from "./pages/Editions/EditionManagerPage";
import CriticalTextEditorPage from "./pages/CriticalText/CriticalTextEditorPage";
import PublicationValidatorPage from "./pages/PublicationValidator/PublicationValidatorPage";
import PublicationCenterPage from "./pages/PublicationCenter/PublicationCenterPage";
import ScholarlyLibraryPage from "./pages/ScholarlyLibrary/ScholarlyLibraryPage";
import EditionComparisonPage from "./pages/EditionComparison/EditionComparisonPage";
import ManuscriptCollationPage from "./pages/Manuscripts/ManuscriptCollationPage";
import StemmaWorkbenchPage from "./pages/Stemma/StemmaWorkbenchPage";
import CriticalApparatusPage from "./pages/Apparatus/CriticalApparatusPage";
import ParallelCorpusPage from "./pages/ParallelCorpus/ParallelCorpusPage";
import EntityIntelligencePage from "./pages/EntityIntelligence/EntityIntelligencePage";
import ScholarlyAssistantPage from "./pages/ScholarlyAssistant/ScholarlyAssistantPage";
import IiifManuscriptPage from "./pages/IIIF/IiifManuscriptPage";
import CollaborationHubPage from "./pages/Collaboration/CollaborationHubPage";
import InstitutionalRepositoryPage from "./pages/Repository/InstitutionalRepositoryPage";
import PublicScholarlyPortalPage from "./pages/PublicPortal/PublicScholarlyPortalPage";
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
          <Route path="/review-workflow" element={<ReviewWorkflowPage />} />
          <Route path="/governance" element={<GovernancePage />} />
          <Route path="/knowledge-graph" element={<KnowledgeGraphPage />} />
          <Route path="/entity-intelligence" element={<EntityIntelligencePage />} />
          <Route path="/scholarly-assistant" element={<ScholarlyAssistantPage />} />
          <Route path="/iiif-manuscripts" element={<IiifManuscriptPage />} />
          <Route path="/collaboration" element={<CollaborationHubPage />} />
          <Route path="/institutional-repository" element={<InstitutionalRepositoryPage />} />
          <Route path="/public-portal" element={<PublicScholarlyPortalPage />} />
          <Route path="/timeline-narrative" element={<TimelineNarrativePage />} />
          <Route path="/cross-project-graph" element={<CrossProjectGraphPage />} />
          <Route path="/research-workbench" element={<ResearchWorkbenchPage />} />
          <Route path="/research-canvas" element={<ResearchCanvasPage />} />
          <Route path="/evidence-assistant" element={<EvidenceResearchAssistantPage />} />
          <Route path="/corpus-intelligence" element={<CorpusIntelligencePage />} />
          <Route path="/research-discovery" element={<ResearchDiscoveryPage />} />
          <Route path="/scholarly-library" element={<ScholarlyLibraryPage />} />
          <Route path="/edition-comparison" element={<EditionComparisonPage />} />
          <Route path="/manuscript-collation" element={<ManuscriptCollationPage />} />
          <Route path="/stemma-workbench" element={<StemmaWorkbenchPage />} />
          <Route path="/critical-apparatus" element={<CriticalApparatusPage />} />
          <Route path="/parallel-corpus" element={<ParallelCorpusPage />} />
          <Route path="/editions" element={<EditionManagerPage />} />
          <Route path="/editions/editor" element={<CriticalTextEditorPage />} />
          <Route path="/editions/validator" element={<PublicationValidatorPage />} />
          <Route path="/editions/publication" element={<PublicationCenterPage />} />
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