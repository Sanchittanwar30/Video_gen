import { useState } from 'react';
import DashboardLayout from './components/DashboardLayout';
import HomePage from './components/HomePage';
import GenerateVideo from './components/GenerateVideo';
import Diagrams from './components/Diagrams';
import VideoLibrary from './components/VideoLibrary';
import PhotoLibrary from './components/PhotoLibrary';

function App() {
  const [currentPage, setCurrentPage] = useState('home');

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <HomePage onNavigate={setCurrentPage} />;
      case 'generate':
        return <GenerateVideo />;
      case 'diagrams':
        return <Diagrams />;
      case 'videos':
        return <VideoLibrary />;
      case 'photos':
        return <PhotoLibrary />;
      default:
        return <HomePage onNavigate={setCurrentPage} />;
    }
  };

  return (
    <DashboardLayout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
    </DashboardLayout>
  );
}

export default App;
