import "./App.css";

function App() {
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
          <button className="active">⌂ Dashboard</button>
          <button>📁 Projects</button>
          <button>⇧ Import Documents</button>
          <button>⚙ OCR Jobs</button>
          <button>🔱 Pipelines <span>New</span></button>
          <button>⇩ Export</button>
          <button>☷ Logs</button>
          <button>⚙ Settings</button>
        </nav>

        <div className="storage">
          <h3>Storage Usage</h3>
          <div className="circle">42%</div>
          <p>21.4 GB of 50 GB used</p>
          <a>Manage Storage</a>
        </div>

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

        <section className="hero">
          <div>
            <h2>जय श्री कृष्ण 🪶</h2>
            <h1>Welcome to OCR Studio</h1>
            <p>Convert your scanned documents and images into searchable, editable text.</p>

            <div className="actions">
              <button className="primary">＋ New Project</button>
              <button className="secondary">☁ Import Document</button>
            </div>
          </div>

          <div className="krishna">
            <img src="/krishna.png" alt="Lord Krishna" />
          </div>
        </section>

        <section className="stats">
          <div className="stat">
            <div className="icon">📁</div>
            <h3>Projects</h3>
            <strong>12</strong>
            <p>Total Projects</p>
            <a>View all →</a>
          </div>

          <div className="stat">
            <div className="icon blue">◌</div>
            <h3>Running Jobs</h3>
            <strong>2</strong>
            <p>In Progress</p>
            <a>View all →</a>
          </div>

          <div className="stat">
            <div className="icon green">✓</div>
            <h3>Completed</h3>
            <strong>48</strong>
            <p>Successfully Done</p>
            <a>View all →</a>
          </div>

          <div className="stat">
            <div className="icon orange">◷</div>
            <h3>Pending</h3>
            <strong>3</strong>
            <p>Waiting in Queue</p>
            <a>View all →</a>
          </div>

          <div className="stat">
            <div className="icon purple">▣</div>
            <h3>Searchable PDFs</h3>
            <strong>145</strong>
            <p>Generated Files</p>
            <a>View all →</a>
          </div>
        </section>

        <section className="content-grid">
          <div className="panel">
            <div className="panel-header">
              <h2>Recent Projects</h2>
              <button>View All</button>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Project Name</th>
                  <th>Status</th>
                  <th>Last Modified</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Bhagavad Gita", "Completed", "May 31, 2025"],
                  ["Upanishads Collection", "In Progress", "May 31, 2025"],
                  ["Vedic Scriptures", "Completed", "May 30, 2025"],
                  ["Srimad Bhagavatam", "Pending", "May 30, 2025"],
                  ["Ramayana (Valmiki)", "Failed", "May 29, 2025"],
                ].map((row) => (
                  <tr key={row[0]}>
                    <td>{row[0]}<br /><small>108 Pages</small></td>
                    <td><span className={`badge ${row[1].replace(" ", "").toLowerCase()}`}>{row[1]}</span></td>
                    <td>{row[2]}<br /><small>11:30 AM</small></td>
                    <td>⋮</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div>
            <div className="panel">
              <div className="panel-header">
                <h2>Running Jobs</h2>
                <button>View All</button>
              </div>

              {[
                ["Bhagavad Gita.pdf", "42%", "Processing"],
                ["Upanishads.pdf", "63%", "Processing"],
                ["Vedic Mantras.jpg", "24%", "Queued"],
              ].map((job) => (
                <div className="job" key={job[0]}>
                  <div>
                    <strong>{job[0]}</strong>
                    <p>Page 45 of 108</p>
                  </div>
                  <div className="bar"><div style={{ width: job[1] }} /></div>
                  <span>{job[1]}</span>
                  <span className="badge inprogress">{job[2]}</span>
                </div>
              ))}
            </div>

            <div className="quote">
              <h2>“ योगः कर्मसु कौशलम् । ”</h2>
              <p>Yoga is excellence in action.</p>
              <small>— Bhagavad Gita 2.50</small>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;