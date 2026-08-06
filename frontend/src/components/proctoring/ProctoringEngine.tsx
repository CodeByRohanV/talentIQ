import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { proctoringAPI } from '@/lib/api';

interface ProctoringEngineProps {
  attemptId: string;
  onViolation: (type: string, metadata?: any) => void;
  isActive: boolean;
}

export default function ProctoringEngine({ attemptId, onViolation, isActive }: ProctoringEngineProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const lastViolationTime = useRef<number>(0);
  const [cameraReady, setCameraReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<cocoSsd.ObjectDetection | null>(null);
  const detectionIntervalRef = useRef<any>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Keep ref in sync
  useEffect(() => {
    sessionIdRef.current = sessionId;
  }, [sessionId]);

  // Initialize camera & session
  useEffect(() => {
    if (!isActive || !attemptId) return;

    let isMounted = true;

    const init = async () => {
      try {
        // 1. Start backend session
        const res = await proctoringAPI.startSession(attemptId) as any;
        if (res?.session && isMounted) {
          setSessionId(res.session.id);
        }
      } catch (err) {
        console.warn('Proctoring session start failed (non-blocking):', err);
      }

      try {
        await tf.ready();
        const loadedModel = await cocoSsd.load();
        if (isMounted) setModel(loadedModel);
      } catch (tfErr) {
        console.warn('TF Model failed to load:', tfErr);
      }

      try {
        // 2. Get Webcam
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: false,
        });

        if (!isMounted) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
        }
      } catch (camErr: any) {
        console.error('Camera access denied:', camErr);
        if (isMounted) {
          setError('Camera access is required for this assessment. Please allow camera permissions and reload.');
        }
      }
    };

    init();

    return () => {
      isMounted = false;
      cleanup();
    };
  }, [isActive, attemptId]); // eslint-disable-line

  // Advanced face and mobile phone detection using TF.js
  useEffect(() => {
    if (!cameraReady || !isActive || !model) return;

    detectionIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;

      try {
        // Lower threshold to 0.25 for maximum sensitivity
        const predictions = await model.detect(videoRef.current, 20, 0.25);
        
        // Filter predictions to ignore low-confidence 'person' detections (like posters/paintings)
        // Keep phones and forbidden objects at the aggressive 0.25 threshold
        const validPredictions = predictions.filter(p => {
          if (p.class === 'person') return p.score >= 0.60;
          return true;
        });

        let persons = 0;
        let phones = 0;
        
        validPredictions.forEach(p => {
          if (p.class === 'person') persons++;
          if (p.class === 'cell phone' || p.class === 'remote' || p.class === 'laptop' || p.class === 'book') phones++;
        });

        // Dynamic visual overlay drawing
        const overlay = canvasRef.current;
        if (overlay) {
          overlay.width = videoRef.current.videoWidth;
          overlay.height = videoRef.current.videoHeight;
          const oCtx = overlay.getContext('2d');
          if (oCtx) {
            oCtx.clearRect(0, 0, overlay.width, overlay.height);
            validPredictions.forEach(p => {
              const [x, y, w, h] = p.bbox;
              const isForbidden = p.class === 'cell phone' || p.class === 'remote' || p.class === 'laptop' || p.class === 'book';
              
              oCtx.strokeStyle = isForbidden ? '#ef4444' : '#10b981';
              oCtx.lineWidth = 4;
              oCtx.strokeRect(x, y, w, h);
              
              oCtx.fillStyle = isForbidden ? '#ef4444' : '#10b981';
              oCtx.font = 'bold 16px sans-serif';
              oCtx.fillText(
                `${isForbidden ? '🔴 FORBIDDEN' : '🟢 CANDIDATE'}: ${p.class} (${Math.round(p.score * 100)}%)`,
                x, 
                y > 25 ? y - 8 : y + 22
              );
            });
          }
        }

        // Debug log
        if (validPredictions.length > 0) {
           console.log('AI Proctoring Detections:', validPredictions.map(p => `${p.class} (${Math.round(p.score * 100)}%)`).join(', '));
        }

        if (persons > 1) {
          handleDetectedViolation('multiple_faces', 'Multiple people detected');
        } else if (persons === 0) {
          handleDetectedViolation('no_face', 'No person detected');
        }

        if (phones > 0) {
          handleDetectedViolation('mobile_phone', 'Mobile phone or forbidden object detected');
        }
      } catch (err) {
        console.error('Detection error:', err);
      }
    }, 1000); // Check every 1 second for instant detection

    return () => {
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
    };
  }, [cameraReady, isActive, model]); // eslint-disable-line

  const handleDetectedViolation = useCallback(async (type: string, description: string) => {
    const now = Date.now();
    if (now - lastViolationTime.current < 5000) return; // Throttle: max 1 per 5 seconds
    lastViolationTime.current = now;

    // Take screenshot (combined video + canvas overlay)
    let screenshotBase64: string | null = null;
    if (videoRef.current && videoRef.current.readyState >= 2) {
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        if (canvasRef.current) {
            ctx.drawImage(canvasRef.current, 0, 0, canvas.width, canvas.height);
        }
        screenshotBase64 = canvas.toDataURL('image/png');
      }
    }

    // Log to backend
    const sid = sessionIdRef.current;
    if (sid) {
      proctoringAPI.logEvent(sid, type, description, screenshotBase64, 'high').catch(console.error);
    }
    
    // Bubble up to TakeTest UI
    onViolation('ai_violation', { reason: description });
  }, [onViolation]);

  const cleanup = useCallback(() => {
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
    }

    // End session without uploading recording
    const sid = sessionIdRef.current;
    if (sid) {
      proctoringAPI.endSession(sid).catch(() => {});
    }
  }, []);

  // Expose screenshot method so TakeTest can capture screenshots on tab switches
  useEffect(() => {
    (window as any).__proctoringCapture = () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return null;
      const sid = sessionIdRef.current;
      if (!sid) return null;

      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth;
      canvas.height = videoRef.current.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        if (canvasRef.current) {
            ctx.drawImage(canvasRef.current, 0, 0, canvas.width, canvas.height);
        }
        return {
          screenshotBase64: canvas.toDataURL('image/png'),
          sessionId: sid,
        };
      }
      return null;
    };
    return () => {
      delete (window as any).__proctoringCapture;
    };
  }, []);

  if (error) {
    return (
      <div style={{
        position: 'fixed', bottom: 20, left: 20, zIndex: 9999,
        width: 260, padding: 12, borderRadius: 12,
        background: 'rgba(239,68,68,0.95)', color: '#fff',
        fontSize: 12, fontWeight: 600, boxShadow: '0 4px 16px rgba(0,0,0,0.3)'
      }}>
        ⚠️ {error}
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', bottom: 20, left: 20, zIndex: 9999,
      width: 220, height: 165, borderRadius: 12, overflow: 'hidden',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      border: '2px solid #ef4444', background: '#000'
    }}>
      <div style={{
        position: 'absolute', top: 6, left: 6, zIndex: 10,
        background: cameraReady ? '#ef4444' : '#94a3b8',
        color: '#fff', fontSize: 9, padding: '2px 8px',
        borderRadius: 4, fontWeight: 700, letterSpacing: '0.05em',
        display: 'flex', alignItems: 'center', gap: 4
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: cameraReady ? '#fff' : '#64748b',
          animation: cameraReady ? 'pulse 1.5s infinite' : 'none',
          display: 'inline-block'
        }} />
        {cameraReady ? 'REC • PROCTORING' : 'INITIALIZING...'}
      </div>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
      />
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          transform: 'scaleX(-1)',
          zIndex: 5
        }}
      />
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }`}</style>
    </div>
  );
}
