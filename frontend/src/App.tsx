import GenerateVideoDemo from './components/GenerateVideoDemo';
import PenSketchTest from './components/PenSketchTest';
import './App.css';

function App() {
  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <h1>🎬 Video Generation App</h1>
          <p>Turn your lesson topics into polished narrated videos with AI-drafted visuals.</p>
        </header>
        <GenerateVideoDemo />
        <div style={{ marginTop: '40px', borderTop: '2px solid #e5e7eb', paddingTop: '40px' }}>
          <h2 style={{ marginBottom: '20px' }}>🖊️ Pen Sketch Animation Test</h2>
          <PenSketchTest />
        </div>
      </div>
    </div>
  );
}

export default App;

