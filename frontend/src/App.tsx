import {useState} from 'react';
import VideoForm from './components/VideoForm';
import VideoResult from './components/VideoResult';
import type {GenerateVideoResponse} from './services/api';
import './App.css';

function App() {
  const [result, setResult] = useState<GenerateVideoResponse | null>(null);

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
      </div>
    </div>
  );
}

export default App;

