import { NavLink } from "react-router-dom";

type MainLayoutProps = {
  children: React.ReactNode;
};

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <div className="om">ॐ</div>
          <div>
            <h1>OCR Studio</h1>
            <p>Transform Scanned to Divine Text</p>
          </div>
        </div>

        <nav>
          <NavLink to="/">⌂ Dashboard</NavLink>
          <NavLink to="/projects">📁 Projects</NavLink>
          <NavLink to="/collections">📚 Collections</NavLink>
          <NavLink to="/search">🔎 Library Search</NavLink>
          <NavLink to="/duplicates">🧬 Duplicate Detection</NavLink>
          <NavLink to="/assistant">✦ AI Manuscript Assistant</NavLink>
          <NavLink to="/research">📖 Research Copilot</NavLink>
          <NavLink to="/review-workflow">✅ Review Workflow</NavLink>
          <NavLink to="/governance">🛡 Governance & Audit</NavLink>
          <NavLink to="/knowledge-graph">🕸 Knowledge Graph</NavLink>
          <NavLink to="/entity-intelligence">🧭 Entity Intelligence</NavLink>
          <NavLink to="/scholarly-assistant">🧠 Scholarly Copilot</NavLink>
          <NavLink to="/iiif-manuscripts">🖼 IIIF Manuscripts</NavLink>
          <NavLink to="/collaboration">👥 Collaboration Hub</NavLink>
          <NavLink to="/institutional-repository">🏛 Institutional Repository</NavLink>
          <NavLink to="/public-portal">🌍 Public Scholarly Portal</NavLink>
          <NavLink to="/timeline-narrative">🗺 Timeline & Narratives</NavLink>
          <NavLink to="/cross-project-graph">🔗 Manuscript Comparison</NavLink>
          <NavLink to="/research-workbench">📝 Research Workbench</NavLink>
          <NavLink to="/research-canvas">🎨 Research Canvas</NavLink>
          <NavLink to="/evidence-assistant">🧠 Evidence Research Assistant</NavLink>
          <NavLink to="/corpus-intelligence">📊 Corpus Intelligence</NavLink>
          <NavLink to="/research-discovery">💡 Research Discovery</NavLink>
          <NavLink to="/scholarly-library">🏛 Digital Scholarly Library</NavLink>
          <NavLink to="/edition-comparison">⇄ Edition Comparison Lab</NavLink>
          <NavLink to="/manuscript-collation">≋ Witness & Collation</NavLink>
          <NavLink to="/stemma-workbench">🌿 Stemma Workbench</NavLink>
          <NavLink to="/critical-apparatus">⌁ Critical Apparatus</NavLink>
          <NavLink to="/parallel-corpus">🌐 Parallel Corpus</NavLink>
          <NavLink to="/editions">📜 Scholarly Editions</NavLink>
          <NavLink to="/import">⇧ Import Documents</NavLink>
          <NavLink to="/jobs">⚙ OCR Jobs</NavLink>
          <NavLink to="/pipelines">🔱 Pipelines</NavLink>
          <NavLink to="/export">⇩ Export</NavLink>
          <NavLink to="/logs">☷ Logs</NavLink>
          <NavLink to="/settings">⚙ Settings</NavLink>
        </nav>

        <div className="chant">
          <p>हरे कृष्ण हरे कृष्ण</p>
          <p>कृष्ण कृष्ण हरे हरे ॥</p>
          <p>हरे राम हरे राम</p>
          <p>राम राम हरे हरे ॥</p>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="sanskrit">कर्मण्येवाधिकारस्ते मा फलेषु कदाचन ।</div>
          <div className="user">☀️ ॐ Welcome, User⌄</div>
        </header>

        <section className="page-content">{children}</section>

        <footer className="statusbar">
          Ready • Local OCR Engine not connected yet
        </footer>
      </main>
    </div>
  );
}