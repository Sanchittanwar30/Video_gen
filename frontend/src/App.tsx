import GenerateVideoDemo from './components/GenerateVideoDemo';
// import PenSketchTest from './components/PenSketchTest';
import ShowcaseGallery from './components/ShowcaseGallery';
import './App.css';

function App() {
  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <h1>🎬 Video Generation Studio</h1>
          <p>Transform your ideas into professional videos with AI-powered visuals and animations</p>
        </header>
        
        {/* Showcase Gallery - Hero Section */}
        <ShowcaseGallery />
        
        {/* AI Storyboard Generator */}
        <div style={{ marginTop: '60px' }}>
          <div style={{ 
            textAlign: 'center', 
            marginBottom: '30px',
            padding: '20px',
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-primary)',
          }}>
            <h2 style={{ 
              fontSize: '28px', 
              marginBottom: '10px',
              color: 'var(--text-primary)',
            }}>
              🤖 AI Storyboard Generator
            </h2>
            <p style={{ 
              color: 'var(--text-secondary)',
              fontSize: '16px',
            }}>
              Generate educational videos from any topic - AI creates visuals, voiceovers, and animations
            </p>
          </div>
          <GenerateVideoDemo />
        </div>
        
        {/* Pen Sketch Animation - Temporarily Hidden */}
        {/* <div className="pen-sketch-section" style={{ marginTop: '60px' }}>
          <div style={{ 
            textAlign: 'center', 
            marginBottom: '30px',
            padding: '20px',
            background: 'var(--bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-primary)',
          }}>
            <h2 className="pen-sketch-title" style={{ 
              fontSize: '28px', 
              marginBottom: '10px',
              color: 'var(--text-primary)',
            }}>
              🖊️ Pen Sketch Animation
            </h2>
            <p className="pen-sketch-description" style={{ 
              color: 'var(--text-secondary)',
              fontSize: '16px',
            }}>
              Transform images into hand-drawn whiteboard animations with smooth stroke-by-stroke drawing
            </p>
          </div>
          <PenSketchTest />
        </div> */}
      </div>
    </div>
  );
}

export default App;

