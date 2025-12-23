import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, Gauge } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

interface VideoPlayerProps {
  src: string;
  poster?: string;
  className?: string;
  autoPlay?: boolean;
  muted?: boolean;
  controls?: boolean; // Use custom controls if true, native if false
  showSpeedControl?: boolean; // Show playback speed control
  onError?: (error: Event) => void;
  onEnded?: () => void;
}

export default function VideoPlayer({
  src,
  poster,
  className,
  autoPlay = false,
  muted = false,
  controls = true,
  showSpeedControl = true,
  onError,
  onEnded,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(muted);
  const [volume, setVolume] = useState(1);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

  const playbackSpeeds = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Set initial playback rate
    video.playbackRate = playbackRate;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('volumechange', handleVolumeChange);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('volumechange', handleVolumeChange);
    };
  }, [playbackRate]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleMouseMove = () => {
      setShowControls(true);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
      controlsTimeoutRef.current = setTimeout(() => {
        if (isPlaying) {
          setShowControls(false);
        }
      }, 3000);
    };

    const handleMouseLeave = () => {
      if (isPlaying) {
        setShowControls(false);
      }
    };

    if (controls) {
      video.addEventListener('mousemove', handleMouseMove);
      video.addEventListener('mouseleave', handleMouseLeave);
    }

    return () => {
      video.removeEventListener('mousemove', handleMouseMove);
      video.removeEventListener('mouseleave', handleMouseLeave);
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [controls, isPlaying]);

  const togglePlayPause = () => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    video.muted = !video.muted;
    setIsMuted(video.muted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const newVolume = parseFloat(e.target.value);
    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const handleSpeedChange = (speed: number) => {
    const video = videoRef.current;
    if (!video) return;

    video.playbackRate = speed;
    setPlaybackRate(speed);
    setShowSpeedMenu(false);
  };

  const toggleFullscreen = () => {
    const video = videoRef.current;
    if (!video) return;

    if (!document.fullscreenElement) {
      video.requestFullscreen().catch((err) => {
        console.error('Error attempting to enable fullscreen:', err);
      });
    } else {
      document.exitFullscreen();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Use native controls if controls prop is false
  if (!controls) {
    return (
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className={className}
        autoPlay={autoPlay}
        muted={muted}
        controls
        playsInline
        onError={onError}
        onEnded={onEnded}
      />
    );
  }

  return (
    <div className={cn("relative group bg-black rounded-lg overflow-hidden", className)}>
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        className="w-full h-full"
        autoPlay={autoPlay}
        muted={isMuted}
        playsInline
        onError={onError}
        onEnded={onEnded}
      />

      {/* Custom Controls Overlay */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent transition-opacity duration-300",
          showControls || !isPlaying ? "opacity-100" : "opacity-0"
        )}
        onClick={togglePlayPause}
        onMouseMove={() => {
          setShowControls(true);
          if (controlsTimeoutRef.current) {
            clearTimeout(controlsTimeoutRef.current);
          }
          controlsTimeoutRef.current = setTimeout(() => {
            if (isPlaying) setShowControls(false);
          }, 3000);
        }}
      >
        {/* Center Play/Pause Button */}
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={(e) => {
                e.stopPropagation();
                togglePlayPause();
              }}
              className="w-16 h-16 rounded-full bg-white/90 hover:bg-white flex items-center justify-center transition-transform hover:scale-110"
            >
              <Play className="w-8 h-8 text-gray-900 ml-1" fill="currentColor" />
            </button>
          </div>
        )}

        {/* Bottom Controls Bar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 space-y-2">
          {/* Progress Bar */}
          <div className="w-full h-1 bg-white/20 rounded-full overflow-hidden cursor-pointer hover:h-1.5 transition-all">
            <div className="h-full bg-white rounded-full" style={{ width: '0%' }} />
          </div>

          {/* Control Buttons */}
          <div className="flex items-center gap-2">
            {/* Play/Pause */}
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                togglePlayPause();
              }}
            >
              {isPlaying ? (
                <Pause className="w-5 h-5" fill="currentColor" />
              ) : (
                <Play className="w-5 h-5" fill="currentColor" />
              )}
            </Button>

            {/* Volume */}
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="text-white hover:bg-white/20"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMute();
                }}
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </Button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={handleVolumeChange}
                onClick={(e) => e.stopPropagation()}
                className="w-20 h-1 accent-white cursor-pointer"
              />
            </div>

            {/* Playback Speed */}
            {showSpeedControl && (
              <div className="relative">
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-white hover:bg-white/20"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSpeedMenu(!showSpeedMenu);
                  }}
                >
                  <Gauge className="w-5 h-5" />
                </Button>
                {showSpeedMenu && (
                  <div
                    className="absolute bottom-full left-0 mb-2 bg-black/90 rounded-lg p-2 min-w-[120px] shadow-lg z-10"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {playbackSpeeds.map((speed) => (
                      <button
                        key={speed}
                        onClick={() => handleSpeedChange(speed)}
                        className={cn(
                          "w-full text-left px-3 py-2 rounded hover:bg-white/10 text-white text-sm transition-colors",
                          playbackRate === speed && "bg-white/20 font-semibold"
                        )}
                      >
                        {speed}x
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Time Display */}
            <span className="text-white text-sm ml-auto">
              {formatTime(videoRef.current?.currentTime || 0)} /{' '}
              {formatTime(videoRef.current?.duration || 0)}
            </span>

            {/* Fullscreen */}
            <Button
              variant="ghost"
              size="icon"
              className="text-white hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation();
                toggleFullscreen();
              }}
            >
              <Maximize2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}


