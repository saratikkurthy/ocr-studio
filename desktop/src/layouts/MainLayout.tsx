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