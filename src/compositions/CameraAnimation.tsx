/**
 * Camera Animation Component for Pan/Zoom Effects
 * Allows smooth camera movements to focus on specific parts of large diagrams
 */

import React from 'react';
import { useCurrentFrame, interpolate, Easing } from 'remotion';
import { AbsoluteFill } from 'remotion';

export interface CameraKeyframe {
  frame: number;
  scale: number; // 1.0 = no zoom, 2.0 = 2x zoom
  x: number; // X position in diagram coordinates (0-100%)
  y: number; // Y position in diagram coordinates (0-100%)
  easing?: (t: number) => number;
}

export interface CameraAnimationProps {
  keyframes: CameraKeyframe[];
  diagramWidth: number;
  diagramHeight: number;
  children: React.ReactNode;
}

/**
 * Camera wrapper that applies pan/zoom transformations
 */
export const CameraAnimation: React.FC<CameraAnimationProps> = ({
  keyframes,
  diagramWidth,
  diagramHeight,
  children,
}) => {
  const frame = useCurrentFrame();

  // Find the current keyframe segment
  let currentScale = 1;
  let currentX = 50; // Center
  let currentY = 50; // Center

  if (keyframes.length === 0) {
    // No keyframes, use default
  } else if (keyframes.length === 1) {
    // Single keyframe
    const kf = keyframes[0];
    currentScale = kf.scale;
    currentX = kf.x;
    currentY = kf.y;
  } else {
    // Multiple keyframes - interpolate between them
    const sortedKeyframes = [...keyframes].sort((a, b) => a.frame - b.frame);

    // Find the two keyframes to interpolate between
    let prevKf = sortedKeyframes[0];
    let nextKf = sortedKeyframes[sortedKeyframes.length - 1];

    for (let i = 0; i < sortedKeyframes.length - 1; i++) {
      if (frame >= sortedKeyframes[i].frame && frame <= sortedKeyframes[i + 1].frame) {
        prevKf = sortedKeyframes[i];
        nextKf = sortedKeyframes[i + 1];
        break;
      }
    }

    if (frame < sortedKeyframes[0].frame) {
      // Before first keyframe
      prevKf = sortedKeyframes[0];
      nextKf = sortedKeyframes[0];
    } else if (frame > sortedKeyframes[sortedKeyframes.length - 1].frame) {
      // After last keyframe
      prevKf = sortedKeyframes[sortedKeyframes.length - 1];
      nextKf = sortedKeyframes[sortedKeyframes.length - 1];
    }

    // Interpolate scale
    const easing = prevKf.easing || Easing.easeInOut;
    const progress = prevKf.frame === nextKf.frame
      ? 0
      : (frame - prevKf.frame) / (nextKf.frame - prevKf.frame);

    const easedProgress = easing(progress);

    currentScale = interpolate(
      easedProgress,
      [0, 1],
      [prevKf.scale, nextKf.scale],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    currentX = interpolate(
      easedProgress,
      [0, 1],
      [prevKf.x, nextKf.x],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );

    currentY = interpolate(
      easedProgress,
      [0, 1],
      [prevKf.y, nextKf.y],
      { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
    );
  }

  // Calculate transform to center the diagram at the specified point
  // The diagram is scaled and positioned so that the focus point (x, y) is at screen center
  const viewportWidth = 1920;
  const viewportHeight = 1080;

  // Convert percentage to pixel coordinates in diagram space
  const focusX = (currentX / 100) * diagramWidth;
  const focusY = (currentY / 100) * diagramHeight;

  // Calculate translation to center the focus point
  const translateX = viewportWidth / 2 - focusX * currentScale;
  const translateY = viewportHeight / 2 - focusY * currentScale;

  return (
    <AbsoluteFill
      style={{
        transform: `translate(${translateX}px, ${translateY}px) scale(${currentScale})`,
        transformOrigin: 'top left',
        width: diagramWidth,
        height: diagramHeight,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

/**
 * Helper function to generate camera keyframes for focusing on diagram regions
 */
export function generateCameraKeyframes(
  regions: Array<{
    startFrame: number;
    endFrame: number;
    x: number; // Percentage (0-100)
    y: number; // Percentage (0-100)
    scale?: number; // Zoom level (default 1.5)
  }>,
  totalFrames: number
): CameraKeyframe[] {
  const keyframes: CameraKeyframe[] = [
    // Start with overview (no zoom, centered)
    {
      frame: 0,
      scale: 1.0,
      x: 50,
      y: 50,
    },
  ];

  regions.forEach((region) => {
    const scale = region.scale || 1.5;
    const transitionDuration = 30; // frames for transition

    // Zoom in
    keyframes.push({
      frame: region.startFrame - transitionDuration / 2,
      scale: 1.0,
      x: 50,
      y: 50,
    });

    keyframes.push({
      frame: region.startFrame,
      scale: scale,
      x: region.x,
      y: region.y,
      easing: Easing.out(Easing.cubic),
    });

    // Hold at zoom
    keyframes.push({
      frame: region.endFrame - transitionDuration / 2,
      scale: scale,
      x: region.x,
      y: region.y,
    });

    // Zoom out
    keyframes.push({
      frame: region.endFrame,
      scale: 1.0,
      x: 50,
      y: 50,
      easing: Easing.in(Easing.cubic),
    });
  });

  // End with overview
  keyframes.push({
    frame: totalFrames - 1,
    scale: 1.0,
    x: 50,
    y: 50,
  });

  return keyframes.sort((a, b) => a.frame - b.frame);
}

