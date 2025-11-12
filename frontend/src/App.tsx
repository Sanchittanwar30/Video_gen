import {useState} from 'react';
import VideoForm from './components/VideoForm';
import VideoResult from './components/VideoResult';
import TLDrawBoard from './components/TLDrawBoard';
import type {GenerateVideoResponse} from './services/api';
import './App.css';

function App() {
  const [result, setResult] = useState<GenerateVideoResponse | null>(null);
  const [showWhiteboard, setShowWhiteboard] = useState(false);

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <h1>🎬 Video Generation App</h1>
          <p>Turn your lesson topics into polished narrated videos with AI-drafted visuals.</p>
        </header>

        {!result ? (
          <VideoForm onResult={setResult} />
        ) : (
          <VideoResult result={result} onReset={() => setResult(null)} />
        )}

        <div className="whiteboard-toggle">
          <button type="button" onClick={() => setShowWhiteboard((open) => !open)}>
            {showWhiteboard ? 'Hide TLDraw Designer' : 'Open TLDraw Designer'}
          </button>
          <p>
            Sketch bespoke diagrams, export the TLDraw JSON, host it somewhere public, and reference the URL via
            <code> diagram.whiteboard.tldrawSceneUrl </code> in your prompts or API payloads.
          </p>
        </div>

        {showWhiteboard ? <TLDrawBoard /> : null}
      </div>
    </div>
  );
}

export default App;

