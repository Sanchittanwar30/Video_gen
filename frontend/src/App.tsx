import { useState } from 'react';
import VideoForm from './components/VideoForm';
import JobStatus from './components/JobStatus';
import './App.css';

function App() {
  const [jobId, setJobId] = useState<string | null>(null);

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <h1>🎬 Video Generator</h1>
          <p>Create dynamic videos with AI-powered content generation</p>
        </header>

        {!jobId ? (
          <VideoForm onJobCreated={setJobId} />
        ) : (
          <JobStatus jobId={jobId} onReset={() => setJobId(null)} />
        )}
      </div>
    </div>
  );
}

export default App;

