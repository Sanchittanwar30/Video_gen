import GenerateVideoDemo from './components/GenerateVideoDemo';
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
      </div>
    </div>
  );
}

export default App;

