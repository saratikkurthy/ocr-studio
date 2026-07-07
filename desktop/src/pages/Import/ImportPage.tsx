export default function ImportPage() {
  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Import Documents</h2>
      </div>

      <div className="dropzone">
        <h2>Drop scanned PDF or images here</h2>
        <p>Supported: PDF, JPG, PNG, TIFF</p>
        <button className="primary">Browse Files</button>
      </div>
    </div>
  );
}