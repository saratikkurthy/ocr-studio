export default function SettingsPage() {
  return (
    <div className="panel">
      <div className="panel-header">
        <h2>Settings</h2>
      </div>

      <div className="settings-form">
        <label>
          Default OCR Language
          <select defaultValue="tel+san+hin+eng">
            <option value="eng">English</option>
            <option value="tel">Telugu</option>
            <option value="san">Sanskrit</option>
            <option value="hin">Hindi / Devanagari</option>
            <option value="tel+eng">Telugu + English</option>
            <option value="san+hin+eng">Sanskrit Devanagari + English</option>
            <option value="tel+san+hin+eng">Telugu + Sanskrit + Devanagari + English</option>
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