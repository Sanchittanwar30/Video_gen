import GenerateVideoDemo from './components/GenerateVideoDemo';
import PenSketchTest from './components/PenSketchTest';
import './App.css';

function App() {
  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <h1>🎬 Video Generation Studio</h1>
          <p>Transform your lesson topics into polished narrated videos with AI-powered visuals and animations</p>
        </header>
        <GenerateVideoDemo />
        <div className="pen-sketch-section">
          <h2 className="pen-sketch-title">🖊️ Pen Sketch Animation</h2>
          <p className="pen-sketch-description">Test the enhanced pen sketch animation with your own images</p>
          <PenSketchTest />
        </div>
      </div>
    </div>
  );
}

export default App;

