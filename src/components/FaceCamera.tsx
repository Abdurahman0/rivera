import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { computeFaceDescriptor, detectFaceBox, loadFaceModels } from '../lib/face';

export interface FaceCameraHandle {
  reset: () => void;
  capture: (countdownMs?: number) => Promise<void>;
}

interface FaceCameraProps {
  active: boolean;
  holdMs?: number;
  disabled?: boolean;
  mirrored?: boolean;
  className?: string;
  /** 'auto' triggers a capture on its own once a face holds steady for holdMs. 'manual' only captures when .capture() is called via ref. */
  mode?: 'auto' | 'manual';
  onCapture: (descriptor: number[], photo: Blob) => void;
  onCaptureFail?: () => void;
  children?: ReactNode;
}

const TICK_MS = 200;

export const FaceCamera = forwardRef<FaceCameraHandle, FaceCameraProps>(function FaceCamera(
  { active, holdMs = 2000, disabled = false, mirrored = true, className = 'aspect-[4/3] w-full rounded-[24px]', mode = 'auto', onCapture, onCaptureFail, children },
  ref,
) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const presentSinceRef = useRef<number | null>(null);
  const capturingRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  const [modelsReady, setModelsReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [progress, setProgress] = useState(0);
  const [faceDetected, setFaceDetected] = useState(false);

  async function takeSnapshot() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) { onCaptureFail?.(); return; }
    const descriptor = await computeFaceDescriptor(video);
    if (!descriptor) { onCaptureFail?.(); return; }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(blob => { if (blob) onCapture(descriptor, blob); else onCaptureFail?.(); }, 'image/jpeg', 0.85);
  }

  useImperativeHandle(ref, () => ({
    reset() {
      presentSinceRef.current = null;
      capturingRef.current = false;
      setProgress(0);
      setFaceDetected(false);
    },
    capture(countdownMs = 2000) {
      return new Promise<void>(resolve => {
        const start = performance.now();
        function tick() {
          const elapsed = performance.now() - start;
          setProgress(Math.min(1, elapsed / countdownMs));
          if (elapsed < countdownMs) {
            requestAnimationFrame(tick);
          } else {
            takeSnapshot().finally(() => { setProgress(0); resolve(); });
          }
        }
        tick();
      });
    },
  }));

  useEffect(() => {
    let cancelled = false;
    loadFaceModels()
      .then(() => { if (!cancelled) setModelsReady(true); })
      .catch(() => { if (!cancelled) setCameraError(t('faceCamera.modelsFailed')); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!active) return;
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: 640, height: 480 }, audio: false })
      .then(nextStream => {
        if (cancelled) { nextStream.getTracks().forEach(track => track.stop()); return; }
        stream = nextStream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      })
      .catch(() => setCameraError(t('faceCamera.cameraDenied')));
    return () => {
      cancelled = true;
      stream?.getTracks().forEach(track => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    };
  }, [active]);

  useEffect(() => {
    if (mode !== 'auto' || !active || !modelsReady || disabled) return;
    timerRef.current = window.setInterval(async () => {
      const video = videoRef.current;
      if (!video || video.readyState < 2 || capturingRef.current) return;
      const box = await detectFaceBox(video);
      if (!box) {
        presentSinceRef.current = null;
        setFaceDetected(false);
        setProgress(0);
        return;
      }
      setFaceDetected(true);
      const now = performance.now();
      if (presentSinceRef.current === null) presentSinceRef.current = now;
      const elapsed = now - presentSinceRef.current;
      setProgress(Math.min(1, elapsed / holdMs));
      if (elapsed >= holdMs && !capturingRef.current) {
        capturingRef.current = true;
        await takeSnapshot();
      }
    }, TICK_MS);
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [mode, active, modelsReady, disabled, holdMs, onCapture]);

  return (
    <div className={`relative overflow-hidden bg-black ${className}`}>
      <video ref={videoRef} autoPlay playsInline muted className={`h-full w-full object-cover ${mirrored ? 'scale-x-[-1]' : ''}`} />
      <canvas ref={canvasRef} className="hidden" />
      {!cameraError && mode === 'auto' ? <div
        className="pointer-events-none absolute inset-3 border-4 transition-colors duration-150"
        style={{ borderColor: faceDetected ? '#22c55e' : 'rgba(255,255,255,0.35)' }}
      /> : null}
      {!cameraError ? <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1.5 bg-white/15">
        <div className="h-full bg-success transition-[width] duration-150" style={{ width: `${progress * 100}%` }} />
      </div> : null}
      {!modelsReady && !cameraError ? <div className="absolute inset-0 grid place-items-center bg-black/60 text-sm font-bold text-white">{t('faceCamera.loadingModels')}</div> : null}
      {cameraError ? <div className="absolute inset-0 grid place-items-center bg-black/70 p-4 text-center text-sm font-bold text-white">{cameraError}</div> : null}
      {children ? <div className="absolute inset-0 grid place-items-center bg-black/60 p-4 text-center">{children}</div> : null}
    </div>
  );
});
