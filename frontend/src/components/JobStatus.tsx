import { useEffect, useState } from 'react';
import { api, JobStatus as JobStatusType } from '../services/api';
import './JobStatus.css';

interface JobStatusProps {
  jobId: string;
  onReset: () => void;
}

export default function JobStatus({ jobId, onReset }: JobStatusProps) {
  const [status, setStatus] = useState<JobStatusType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const jobStatus = await api.getJobStatus(jobId);
        setStatus(jobStatus);
        setLoading(false);

        // If job is still processing, poll every 2 seconds
        if (jobStatus.status === 'active' || jobStatus.status === 'waiting') {
          setTimeout(fetchStatus, 2000);
        }
      } catch (error) {
        console.error('Error fetching job status:', error);
        setLoading(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);

    return () => clearInterval(interval);
  }, [jobId]);

  if (loading) {
    return <div className="job-status loading">Loading job status...</div>;
  }

  if (!status) {
    return <div className="job-status error">Job not found</div>;
  }

  const getStatusColor = () => {
    switch (status.status) {
      case 'completed':
        return '#4caf50';
      case 'failed':
        return '#f44336';
      case 'active':
        return '#2196f3';
      default:
        return '#ff9800';
    }
  };

  return (
    <div className="job-status">
      <div className="status-header">
        <h2>Video Generation Status</h2>
        <button onClick={onReset} className="reset-button">
          Create New Video
        </button>
      </div>

      <div className="status-info">
        <div className="status-badge" style={{ backgroundColor: getStatusColor() }}>
          {status.status.toUpperCase()}
        </div>
        <div className="job-id">Job ID: {jobId}</div>
      </div>

      {status.status === 'active' || status.status === 'waiting' ? (
        <div className="progress-section">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${status.progress || 0}%` }}
            />
          </div>
          <div className="progress-text">{status.progress || 0}%</div>
        </div>
      ) : null}

      {status.status === 'completed' && status.result?.videoUrl && (
        <div className="video-result">
          <h3>Your video is ready!</h3>
          <video
            src={status.result.videoUrl}
            controls
            className="video-player"
          >
            Your browser does not support the video tag.
          </video>
          <div className="video-actions">
            <a
              href={status.result.videoUrl}
              download
              className="download-button"
            >
              Download Video
            </a>
            <a
              href={status.result.videoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="open-button"
            >
              Open in New Tab
            </a>
          </div>
        </div>
      )}

      {status.status === 'completed' && status.result?.transcript && (
        <div className="transcript-section">
          <h3>Transcript</h3>
          <pre className="transcript-text">{status.result.transcript}</pre>
          {status.result.transcriptUrl && (
            <div className="video-actions">
              <a
                href={status.result.transcriptUrl}
                download
                className="download-button"
              >
                Download Transcript
              </a>
              <a
                href={status.result.transcriptUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="open-button"
              >
                Open Transcript
              </a>
            </div>
          )}
        </div>
      )}

      {status.status === 'failed' && status.error && (
        <div className="error-section">
          <h3>Generation Failed</h3>
          <p className="error-text">{status.error}</p>
        </div>
      )}
    </div>
  );
}

