import './VideoResult.css';
import type {GenerateVideoResponse} from '../services/api';

interface VideoResultProps {
  result: GenerateVideoResponse;
  onReset: () => void;
}

export default function VideoResult({result, onReset}: VideoResultProps) {
  return (
    <div className="video-result-card">
      <div className="result-header">
        <h2>Your lesson is ready</h2>
        <button onClick={onReset} className="reset-button">
          Create Another
        </button>
      </div>

      <div className="video-player-wrapper">
        <video src={result.videoUrl} controls className="video-player">
          Your browser does not support the video tag.
        </video>
      </div>

      <div className="result-actions">
        <a href={result.videoUrl} target="_blank" rel="noopener noreferrer" className="primary-button">
          Open in new tab
        </a>
        <a href={result.videoUrl} download className="secondary-button">
          Download video
        </a>
        {result.transcriptUrl ? (
          <a href={result.transcriptUrl} target="_blank" rel="noopener noreferrer" className="secondary-button">
            Transcript
          </a>
        ) : null}
      </div>

      <div className="meta">
        <div>
          <span className="meta-label">Job ID</span>
          <span className="meta-value">{result.jobId}</span>
        </div>
        <div>
          <span className="meta-label">Storage Path</span>
          <span className="meta-value">{result.remotePath}</span>
        </div>
      </div>
    </div>
  );
}

