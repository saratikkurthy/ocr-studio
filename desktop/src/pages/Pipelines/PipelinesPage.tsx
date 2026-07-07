export default function PipelinesPage() {
  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Workflow Pipelines</h2>
        <button>＋ New Pipeline</button>
      </div>

      <div className="pipeline">
        <div>📄 Import</div>
        <span>↓</span>
        <div>🖼 Image Cleanup</div>
        <span>↓</span>
        <div>📝 OCR</div>
        <span>↓</span>
        <div>📚 Searchable PDF</div>
      </div>
    </div>
  );
}