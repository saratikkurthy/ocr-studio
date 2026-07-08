import { useState } from "react";
import { OCR_LANGUAGES } from "../services/languageService";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (project: {
    name: string;
    description: string;
    language: string;
    workflow: string;
    workspacePath: string;
    compression: string;
  }) => void;
};

export default function CreateProjectModal({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("tel+san+hin+eng");
  const [workflow, setWorkflow] = useState("Basic OCR");
  const [workspacePath, setWorkspacePath] = useState("");
  const [compression, setCompression] = useState("medium");

  if (!open) return null;

  const chooseWorkspace = async () => {
    if (!window.ocrStudio) {
      alert("Electron preload is not loaded. Restart npm run dev.");
      return;
    }

    const selected = await window.ocrStudio.selectWorkspaceFolder();

    if (selected) {
      setWorkspacePath(selected);
    }
  };

  const handleCreate = () => {
    if (!name.trim()) {
      alert("Project name is required");
      return;
    }

    if (!workspacePath.trim()) {
      alert("Please choose a workspace folder");
      return;
    }

    onCreate({
      name,
      description,
      language,
      workflow,
      workspacePath,
      compression,
    });
    setCompression("medium");
    setName("");
    setDescription("");
    setLanguage("tel+san+hin+eng");
    setWorkflow("Basic OCR");
    setWorkspacePath("");
    onClose();
  };

  return (
    <div className="modal-backdrop">
      <div className="modal">
        <div className="modal-header">
          <h2>Create New Project</h2>
          <button onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          <label>
            Project Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Example: Bhagavad Gita OCR"
            />
          </label>

          <label>
            Description
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional project notes"
            />
          </label>

          <label>
            Workspace Folder
            <div className="path-row">
              <input
                value={workspacePath}
                readOnly
                placeholder="Choose where projects should be created"
              />
              <button className="secondary" onClick={chooseWorkspace}>
                Browse
              </button>
            </div>
          </label>

          <label>
            OCR Language
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              {OCR_LANGUAGES.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            PDF Compression
            <select value={compression} onChange={(e) => setCompression(e.target.value)}>
              <option value="low">Low - Best Quality</option>
              <option value="medium">Medium - Balanced</option>
              <option value="high">High - Smaller PDF</option>
              <option value="maximum">Maximum - Smallest PDF</option>
            </select>
          </label>
          <label>
            Workflow Template
            <select value={workflow} onChange={(e) => setWorkflow(e.target.value)}>
              <option>Basic OCR</option>
              <option>Camera Scan Cleanup</option>
              <option>Book Scan</option>
              <option>Batch OCR</option>
            </select>
          </label>
        </div>

        <div className="modal-footer">
          <button className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" onClick={handleCreate}>
            Create Project
          </button>
        </div>
      </div>
    </div>
  );
}