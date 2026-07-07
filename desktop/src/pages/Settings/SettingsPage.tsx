export default function SettingsPage() {
  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Settings</h2>
      </div>

      <div className="settings-form">
        <label>
          Default OCR Language
          <select>
            <option>English</option>
            <option>Telugu</option>
            <option>Hindi</option>
            <option>Sanskrit</option>
          </select>
        </label>

        <label>
          OCR Quality
          <select>
            <option>Balanced</option>
            <option>Fast</option>
            <option>High Quality</option>
          </select>
        </label>
      </div>
    </div>
  );
}