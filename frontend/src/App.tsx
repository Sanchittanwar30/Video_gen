import GenerateVideoDemo from './components/GenerateVideoDemo';
// import PenSketchTest from './components/PenSketchTest';
import ShowcaseGallery from './components/ShowcaseGallery';
import './App.css';

function App() {
  return (
    <div className="app">
      <div className="container">
        <header className="header" style={{
          textAlign: 'center',
          padding: '40px 20px',
          background: 'linear-gradient(135deg, #667eea22 0%, #764ba222 100%)',
          borderRadius: 'var(--radius-lg)',
          marginBottom: '40px',
          animation: 'fadeIn 0.6s ease-out',
        }}>
          <h1 style={{
            fontSize: '42px',
            fontWeight: 'bold',
            marginBottom: '12px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            animation: 'slideDown 0.6s ease-out',
          }}>
            🎬 Video Generation Studio
          </h1>
          <p style={{
            fontSize: '18px',
            color: 'var(--text-secondary)',
            maxWidth: '600px',
            margin: '0 auto',
            animation: 'slideUp 0.6s ease-out 0.2s both',
          }}>
            Transform your ideas into professional videos with AI-powered visuals and animations
          </p>
        </header>
        
        <style>{`
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          @keyframes slideDown {
            from { transform: translateY(-20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `}</style>
        
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

