import { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (project: {
    name: string;
    description: string;
    language: string;
    workflow: string;
  }) => void;
};

export default function CreateProjectModal({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [language, setLanguage] = useState("English");
  const [workflow, setWorkflow] = useState("Basic OCR");

  if (!open) return null;

  const handleCreate = () => {
    if (!name.trim()) {
      alert("Project name is required");
      return;
    }

    onCreate({
      name,
      description,
      language,
      workflow,
    });

    setName("");
    setDescription("");
    setLanguage("English");
    setWorkflow("Basic OCR");
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
            OCR Language
            <select value={language} onChange={(e) => setLanguage(e.target.value)}>
              <option>English</option>
              <option>Telugu</option>
              <option>Hindi</option>
              <option>Sanskrit</option>
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
          <button className="secondary" onClick={onClose}>Cancel</button>
          <button className="primary" onClick={handleCreate}>Create Project</button>
        </div>
      </div>
    </div>
  );
}