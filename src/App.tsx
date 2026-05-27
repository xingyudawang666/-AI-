import React, { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, Maximize2, Eye, EyeOff, Video, StopCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Hands, Results as HandResults } from '@mediapipe/hands';
import { FaceMesh, Results as FaceResults } from '@mediapipe/face_mesh';
import { ParticleSystem } from './ParticleEngine';
import { audioEngine } from './audio';

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(null);
  
  const particleSystemRef = useRef<ParticleSystem | null>(null);
  const smoothedPalmCentersRef = useRef<{x: number, y: number, isGrabbed: boolean}[]>([]);
  
  const [isInitializing, setIsInitializing] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [activeParticlesCount, setActiveParticlesCount] = useState(0);
  const [showUI, setShowUI] = useState(true);

  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordCanvasRef = useRef<HTMLCanvasElement>(null);

  const startRecording = () => {
    if (!videoRef.current || !canvasRef.current || !recordCanvasRef.current) return;
    
    recordCanvasRef.current.width = canvasRef.current.width;
    recordCanvasRef.current.height = canvasRef.current.height;
    
    const stream = recordCanvasRef.current.captureStream(30);
    const ctx = recordCanvasRef.current.getContext('2d');
    if (!ctx) return;
    
    setIsRecording(true);
    recordedChunksRef.current = [];
    
    let options: any = { mimeType: 'video/webm; codecs=vp9' };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: 'video/webm; codecs=vp8' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'video/webm' };
      }
    }
    
    let recorder;
    try {
      recorder = new MediaRecorder(stream, options);
    } catch (e) {
      recorder = new MediaRecorder(stream);
    }
    
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recordedChunksRef.current.push(e.data);
      }
    };
    
    recorder.onstop = () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      document.body.appendChild(a);
      a.style.display = 'none';
      a.href = url;
      a.download = `Aether_Flux_Record_${Date.now()}.webm`;
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      setIsRecording(false);
    };
    
    recorder.start();
    mediaRecorderRef.current = recorder;
    
    const drawRecordFrame = () => {
      if (mediaRecorderRef.current?.state !== 'recording') return;
      
      const width = recordCanvasRef.current!.width;
      const height = recordCanvasRef.current!.height;
      const video = videoRef.current!;
      
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);
      
      if (video.videoWidth && video.videoHeight) {
        const videoRatio = video.videoWidth / video.videoHeight;
        const canvasRatio = width / height;
        let drawWidth, drawHeight, startX, startY;

        if (videoRatio > canvasRatio) {
          drawHeight = height;
          drawWidth = height * videoRatio;
          startX = (width - drawWidth) / 2;
          startY = 0;
        } else {
          drawWidth = width;
          drawHeight = width / videoRatio;
          startX = 0;
          startY = (height - drawHeight) / 2;
        }

        ctx.save();
        ctx.translate(width, 0);
        ctx.scale(-1, 1);
        ctx.drawImage(video, startX, startY, drawWidth, drawHeight);
        ctx.restore();
      }
      
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.drawImage(canvasRef.current!, 0, 0);
      ctx.restore();
      
      requestAnimationFrame(drawRecordFrame);
    };
    drawRecordFrame();
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  // Settings
  const [settings, setSettings] = useState({
    hue: 190,
    size: 1.0,
    speed: 1.0,
    density: 1.0,
    isFireMode: false,
    isSandMode: false,
    isWaterMode: false,
    customColor: ""
  });

  // Interaction Mode (visual only for now, logic relies on gestures)
  const [activeMode, setActiveMode] = useState('Kinetic Pull');
  const [faceMode, setFaceMode] = useState<'none' | 'tears' | 'drool'>('none');
  const faceModeRef = useRef<'none' | 'tears' | 'drool'>('none');

  // Sync settings
  useEffect(() => {
    faceModeRef.current = faceMode;
    // Set water mode in particle settings if face mode is not none
    setSettings(s => ({ ...s, isWaterMode: faceMode !== 'none' }));
  }, [faceMode]);
  useEffect(() => {
    if (particleSystemRef.current) {
      particleSystemRef.current.updateSettings(settings);
    }
  }, [settings]);

  // Audio setup on first interaction
  useEffect(() => {
    const handleInteract = () => {
      audioEngine.init();
      audioEngine.resume();
    };
    window.addEventListener('click', handleInteract);
    window.addEventListener('touchstart', handleInteract);
    return () => {
      window.removeEventListener('click', handleInteract);
      window.removeEventListener('touchstart', handleInteract);
    };
  }, []);

  // Handle Resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current && canvasRef.current) {
        const { clientWidth, clientHeight } = containerRef.current;
        setDimensions({ width: clientWidth, height: clientHeight });
        
        // Update Canvas properly
        canvasRef.current.width = clientWidth;
        canvasRef.current.height = clientHeight;
        
        if (particleSystemRef.current) {
          particleSystemRef.current.resize(clientWidth, clientHeight);
        } else {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            particleSystemRef.current = new ParticleSystem(ctx, clientWidth, clientHeight);
          }
        }
      }
    };

    window.addEventListener('resize', updateDimensions);
    updateDimensions();

    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  // Setup Camera and MediaPipe Hands & FaceMesh
  useEffect(() => {
    let hands: Hands | null = null;
    let faceMesh: FaceMesh | null = null;
    let isActive = true;

    const setupCameraAndHands = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: 640, height: 480 },
        });

        if (videoRef.current && isActive) {
          videoRef.current.srcObject = stream;
        }

        hands = new Hands({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
          },
        });

        hands.setOptions({
          maxNumHands: 2,
          modelComplexity: 1,
          minDetectionConfidence: 0.7,
          minTrackingConfidence: 0.7,
        });

        hands.onResults(onResults);
        
        faceMesh = new FaceMesh({
          locateFile: (file) => {
            return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
          },
        });

        faceMesh.setOptions({
          maxNumFaces: 1,
          refineLandmarks: true,
          minDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5
        });
        
        faceMesh.onResults(onFaceResults);

        if (isActive) {
          // Slight delay to ensure video is painted before processing
          setTimeout(() => {
            setIsInitializing(false);
          }, 1000);
          
          processVideoFrame();
        }
      } catch (err) {
        if (isActive) {
          console.error('Camera/MediaPipe init error:', err);
          setError('Failed to access camera or load AI models. Please ensure you have granted camera permissions.');
          setIsInitializing(false);
        }
      }
    };

    const processVideoFrame = async () => {
      if (!isActive) return;
      if (
        videoRef.current && 
        videoRef.current.readyState >= 2
      ) {
         try {
           if (hands) await hands.send({image: videoRef.current});
           if (faceMesh && faceModeRef.current !== 'none') {
              await faceMesh.send({image: videoRef.current});
           }
         } catch (e) {
           console.warn('Model execution error:', e);
         }
      }
      // Call again on next animation frame
      requestRef.current = requestAnimationFrame(processVideoFrame);
    };

    setupCameraAndHands();

    return () => {
      isActive = false;
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach((track) => track.stop());
      }
      if (hands) {
        hands.close();
      }
      if (faceMesh) {
        faceMesh.close();
      }
    };
  }, []);

  // Frame processing from AI models
  const onResults = (results: HandResults) => {
    const ps = particleSystemRef.current;
    if (!ps) return;
    
    const gravityTargets: Array<{x: number, y: number, isGrabbed: boolean}> = [];
    let newMode = 'Particle Burst';

    if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
      results.multiHandLandmarks.forEach((landmarks, handIndex) => {
        
        const wrist = landmarks[0];
        
        // Helper to check if a finger is extended based on distance from wrist
        const dist = (p1: {x: number, y: number}, p2: {x: number, y: number}) => Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
        const isFingerExtended = (tipIdx: number, mcpIdx: number) => {
          return dist(landmarks[tipIdx], wrist) > dist(landmarks[mcpIdx], wrist) * 1.25;
        };

        const indexUp = isFingerExtended(8, 5);
        const middleUp = isFingerExtended(12, 9);
        const ringUp = isFingerExtended(16, 13);
        const pinkyUp = isFingerExtended(20, 17);

        const isDrawing = indexUp && !middleUp && !ringUp && !pinkyUp;

        // Calculate if hand is closed (grabbed)
        const tips = [landmarks[8], landmarks[12], landmarks[16], landmarks[20]]; // Index, Middle, Ring, Pinky tips
        
        let totalDist = 0;
        tips.forEach(tip => {
           const dx = tip.x - wrist.x;
           const dy = tip.y - wrist.y;
           totalDist += Math.sqrt(dx * dx + dy * dy);
        });
        const avgDist = totalDist / tips.length;
        
        // Threshold for grab vs open (adjust as needed, usually ~0.3-0.4 for open, < 0.2 for grabbed)
        const isGrabbed = avgDist < 0.25;

        // Mirror horizontally for natural interaction
        const mappedLandmarks = landmarks.map(lm => ({
          x: 1 - lm.x, 
          y: lm.y
        }));
        
        // Calculate center of palm for gravity target
        let palmCenter = {
          x: (mappedLandmarks[0].x + mappedLandmarks[9].x) / 2 * ps.width,
          y: (mappedLandmarks[0].y + mappedLandmarks[9].y) / 2 * ps.height
        };
        
        // Temporal smoothing filter (EMA)
        const alpha = 0.4;
        let prevGrabbed = false;
        if (smoothedPalmCentersRef.current[handIndex]) {
           const prev = smoothedPalmCentersRef.current[handIndex];
           prevGrabbed = prev.isGrabbed;
           palmCenter = {
             x: prev.x * (1 - alpha) + palmCenter.x * alpha,
             y: prev.y * (1 - alpha) + palmCenter.y * alpha,
           };
        }
        
        smoothedPalmCentersRef.current[handIndex] = {
           x: palmCenter.x,
           y: palmCenter.y,
           isGrabbed
        };
        
        let triggerExplosion = false;
        if (prevGrabbed && !isGrabbed && settings.isFireMode) {
            triggerExplosion = true;
            ps.emit(palmCenter.x, palmCenter.y, '', 30, false, true); // Explosion
        }
        
        if (triggerExplosion) {
            audioEngine.playSubtleTone('explosion');
        }
        
        gravityTargets.push({
          x: palmCenter.x,
          y: palmCenter.y,
          isGrabbed
        });

        // Draw skeleton connection lines
        ps.drawConnections(mappedLandmarks, 'rgba(255, 255, 255, 0.2)');

        if (isDrawing) {
          newMode = 'Canvas Draw';
          const pt = mappedLandmarks[8];
          ps.emit(pt.x * ps.width, pt.y * ps.height, `hsl(${settings.hue}, 90%, 60%)`, 6, true);
          if (Math.random() < 0.1) audioEngine.playSubtleTone('draw');
        } else if (isGrabbed) {
          newMode = 'Kinetic Pull';
          ps.emit(palmCenter.x, palmCenter.y, `hsl(${settings.hue}, 80%, 60%)`, 6);
          if (Math.random() < 0.05) audioEngine.playSubtleTone('pull');
        } else if (!triggerExplosion) {
           // Finger tip indices: 4 (thumb), 8 (index), 12 (middle), 16 (ring), 20 (pinky)
           const tipIndices = [4, 8, 12, 16, 20];
           tipIndices.forEach((index) => {
             const pt = mappedLandmarks[index];
             // Vary saturation/lightness slightly for a cool effect based on finger
             ps.emit(pt.x * ps.width, pt.y * ps.height, `hsl(${settings.hue + index * 2}, 90%, 60%)`, 2);
           });
           if (Math.random() < 0.05) audioEngine.playSubtleTone('burst');
        }
      });
    } else {
        // Clear smoothed centers if no hands detected to avoid jumps when hands re-enter
        smoothedPalmCentersRef.current = [];
    }
    
    ps.setGravityTargets(gravityTargets);
    setActiveMode(newMode);
  };

  const onFaceResults = (results: FaceResults) => {
    const ps = particleSystemRef.current;
    if (!ps) return;
    
    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
      const landmarks = results.multiFaceLandmarks[0];
      const fm = faceModeRef.current;
      
      const emitFaceWater = (index: number) => {
        const lm = landmarks[index];
        const color = settings.customColor || `rgba(${150 + Math.random() * 50}, ${200 + Math.random() * 55}, 255, 0.6)`;
        ps.emit((1 - lm.x) * ps.width, lm.y * ps.height, color, 1, false, false, 'water');
      };

      if (fm === 'tears') {
         // Left Eye lower: 145; Right Eye lower: 374
         if (Math.random() < 0.4) emitFaceWater(145); 
         if (Math.random() < 0.4) emitFaceWater(374); 
      } else if (fm === 'drool') {
         // Check if mouth is open
         const upperLip = landmarks[13];
         const lowerLip = landmarks[14];
         const mouthOpenDist = Math.abs(upperLip.y - lowerLip.y);
         const faceHeight = Math.abs(landmarks[10].y - landmarks[152].y);
         
         // Mouth is open if distance between lips is significant (e.g., > 3% of face height)
         if (mouthOpenDist > faceHeight * 0.03) {
           // Left mouth corner 61, Right mouth corner 291, Lower lip 14
           if (Math.random() < 0.3) emitFaceWater(61);
           if (Math.random() < 0.3) emitFaceWater(291);
           if (Math.random() < 0.4) emitFaceWater(14);
           // Also somewhere in the middle for a continuous stream
           if (Math.random() < 0.4) {
             const cx = (1 - lowerLip.x) * ps.width;
             const cy = lowerLip.y * ps.height;
             const color = settings.customColor || `rgba(${150 + Math.random() * 50}, ${200 + Math.random() * 55}, 255, 0.6)`;
             ps.emit(cx, cy, color, 1, false, false, 'water');
           }
         }
      }
    }
  };

  // Dedicated Render Loop for Particles (decoupled from AI frame rate)
  useEffect(() => {
    let renderReq: number;
    let lastTime = performance.now();
    
    const renderLoop = (time: number) => {
      if (particleSystemRef.current) {
        particleSystemRef.current.updateAndDraw();
        
        // Limit state updates to ~every half second so we don't spam React
        if (time - lastTime > 500) {
           setActiveParticlesCount(particleSystemRef.current.particles.length);
           lastTime = time;
        }
      }
      renderReq = requestAnimationFrame(renderLoop);
    };
    renderReq = requestAnimationFrame(renderLoop);
    return () => cancelAnimationFrame(renderReq);
  }, []);

  return (
    <div className="w-full h-screen bg-[#050508] text-slate-200 font-sans relative overflow-hidden flex flex-col select-none" ref={containerRef}>
      {/* Background camera feed for immersive feel */}
      <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 w-full h-full object-cover scale-x-[-1] opacity-20 pointer-events-none z-0 mix-blend-screen" />

      {/* Main interaction canvas */}
      <canvas
        ref={canvasRef}
        className="block absolute top-0 left-0 w-full h-full z-10 pointer-events-none mix-blend-screen"
      />

      {/* Hidden Recording Canvas */}
      <canvas ref={recordCanvasRef} className="hidden" />

      {/* Glowing Orbs */}
      <div className="absolute inset-0 pointer-events-none z-0 mix-blend-screen">
        <div className="absolute top-1/4 left-1/3 w-[400px] h-[400px] bg-cyan-500/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-1/4 right-1/4 w-[350px] h-[350px] bg-purple-600/20 rounded-full blur-[100px]"></div>
      </div>

      {/* Toggle UI Button */}
      <button 
        onClick={() => setShowUI(!showUI)}
        className="absolute top-4 right-4 z-50 p-2.5 bg-black/40 hover:bg-black/60 border border-white/10 rounded-xl backdrop-blur-xl text-white/50 hover:text-white transition-colors cursor-pointer pointer-events-auto"
        title="Toggle UI"
      >
        {showUI ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>

      {showUI && (
        <nav className="h-16 border-b border-white/10 flex items-center justify-between px-8 bg-black/40 backdrop-blur-xl z-20 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
              <div className="w-4 h-4 border-2 border-white rounded-full"></div>
            </div>
            <span className="font-bold tracking-widest text-sm uppercase" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
              Aether // Flux
            </span>
          </div>
          <div className="flex items-center gap-8 mr-12">
            <div className="flex flex-col items-end">
              <span className="text-[10px] text-cyan-400 font-mono">
                {isInitializing ? '初始化_AI模型' : '数据流: 活跃'}
              </span>
              <span className="text-[10px] text-slate-500 font-mono">VISION_TRACKING</span>
            </div>
            <div className="h-8 w-px bg-white/10"></div>
            <div className="flex items-center gap-4">
              <div className={`w-2 h-2 rounded-full ${isInitializing ? 'bg-yellow-400' : 'bg-cyan-400 animate-pulse'}`}></div>
              <span className="text-xs font-medium text-slate-400 uppercase tracking-tighter shrink-0 w-32 text-right">
                {isInitializing ? '加载中...' : '摄像头: 活跃'}
              </span>
            </div>
          </div>
        </nav>
      )}

      <main className="flex-1 flex relative overflow-hidden pointer-events-none z-10 w-full">
        {/* Left Sidebar */}
        {showUI && (
          <aside className="w-64 min-w-[16rem] border-r border-white/10 p-6 flex flex-col gap-6 bg-black/20 backdrop-blur-md z-10 pointer-events-auto h-full overflow-y-auto shrink-0">
          <div>
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">交互模式 (Interaction Mode)</h3>
            <div className="space-y-2 pointer-events-auto">
              <button 
                onClick={() => setActiveMode('Particle Burst')}
                className={`w-full py-3 px-4 rounded-xl border text-left text-xs font-semibold flex justify-between items-center group cursor-pointer transition-colors ${activeMode === 'Particle Burst' ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}>
                粒子爆发 (Open)
                <span className={activeMode === 'Particle Burst' ? 'opacity-100' : 'opacity-0'}>●</span>
              </button>
              <button 
                onClick={() => setActiveMode('Kinetic Pull')}
                className={`w-full py-3 px-4 rounded-xl border text-left text-xs font-semibold flex justify-between items-center group cursor-pointer transition-colors ${activeMode === 'Kinetic Pull' ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}>
                动能拉力 (Grab)
                <span className={`transition-opacity ${activeMode === 'Kinetic Pull' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>→</span>
              </button>
              <button 
                onClick={() => setActiveMode('Canvas Draw')}
                className={`w-full py-3 px-4 rounded-xl border text-left text-xs font-semibold flex justify-between items-center group cursor-pointer transition-colors ${activeMode === 'Canvas Draw' ? 'bg-cyan-500/10 border-cyan-500/40 text-cyan-400' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}>
                画板绘制 (Point)
                <span className={`transition-opacity ${activeMode === 'Canvas Draw' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>✎</span>
              </button>
            </div>
          </div>
          <div className="mt-8 pointer-events-auto">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">效果与工具 (Effects & Tools)</h3>
            <div className="space-y-2">
              <button 
                onClick={() => setSettings({...settings, isSandMode: !settings.isSandMode, isFireMode: false})}
                className={`w-full py-3 px-4 rounded-xl border text-left text-xs font-semibold flex justify-between items-center group cursor-pointer transition-colors ${settings.isSandMode ? 'bg-amber-500/20 border-amber-500/40 text-amber-400' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}>
                沙粒模式 (Sand Mode)
                <span className={`transition-opacity ${settings.isSandMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>▼</span>
              </button>
              <button 
                onClick={() => setSettings({...settings, isFireMode: !settings.isFireMode, isSandMode: false})}
                className={`w-full py-3 px-4 rounded-xl border text-left text-xs font-semibold flex justify-between items-center group cursor-pointer transition-colors ${settings.isFireMode ? 'bg-orange-500/20 border-orange-500/40 text-orange-400' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}>
                火焰模式 (Fire Mode)
                <span className={`transition-opacity ${settings.isFireMode ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>🔥</span>
              </button>
              <button 
                onClick={() => {
                   if (particleSystemRef.current) particleSystemRef.current.clear();
                }}
                className={`w-full py-3 px-4 rounded-xl border text-left text-xs font-semibold flex justify-between items-center group cursor-pointer transition-colors bg-white/5 border-white/10 text-slate-300 hover:bg-white/10`}>
                清空画布 (Clear Canvas)
                <span className={`opacity-0 group-hover:opacity-100 transition-opacity`}>✖</span>
              </button>
            </div>
          </div>
          
          <div className="mt-8 pointer-events-auto">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">面部追踪 (Face Tracking)</h3>
            <div className="space-y-2">
              <button 
                onClick={() => setFaceMode(faceMode === 'tears' ? 'none' : 'tears')}
                className={`w-full py-3 px-4 rounded-xl border text-left text-xs font-semibold flex justify-between items-center group cursor-pointer transition-colors ${faceMode === 'tears' ? 'bg-blue-500/20 border-blue-500/40 text-blue-400' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}>
                流眼泪 (Crying)
                <span className={`transition-opacity ${faceMode === 'tears' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>💧</span>
              </button>
              <button 
                onClick={() => setFaceMode(faceMode === 'drool' ? 'none' : 'drool')}
                className={`w-full py-3 px-4 rounded-xl border text-left text-xs font-semibold flex justify-between items-center group cursor-pointer transition-colors ${faceMode === 'drool' ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-400' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'}`}>
                流口水 (Drool)
                <span className={`transition-opacity ${faceMode === 'drool' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>🤤</span>
              </button>
            </div>
          </div>
          
          <div className="mt-8 pointer-events-auto">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">全局参数 (Global Physics)</h3>
            <div className="space-y-6">
              
              <div className="space-y-3 flex flex-col justify-between">
                <div className="flex justify-between text-[10px] text-slate-400 uppercase tracking-wider items-center">
                  <span>Custom Color</span>
                  <button 
                    onClick={() => setSettings({...settings, customColor: ""})}
                    className="text-[10px] text-slate-500 hover:text-cyan-400 uppercase tracking-widest px-2 py-1 bg-white/5 rounded cursor-pointer transition-colors"
                  >
                    Reset (Use Hue)
                  </button>
                </div>
                <div className="flex gap-4 items-center">
                  <input 
                    type="color" 
                    value={settings.customColor || "#00F0FF"}
                    onChange={(e) => setSettings({...settings, customColor: e.target.value})}
                    className="w-full h-8 rounded bg-transparent border-0 cursor-pointer appearance-none"
                  />
                </div>
              </div>

              <div className={`space-y-3 ${settings.customColor || settings.isFireMode || settings.isSandMode ? 'opacity-30 pointer-events-none' : ''}`}>
                <div className="flex justify-between text-[10px] text-slate-400 uppercase tracking-wider"><span>Hue Range</span><span>{settings.hue}°</span></div>
                <input 
                  type="range" min="0" max="360" value={settings.hue}
                  onChange={(e) => setSettings({...settings, hue: Number(e.target.value)})}
                  className="w-full accent-cyan-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-[10px] text-slate-400 uppercase tracking-wider"><span>Density</span><span>{Math.round(settings.density * 100)}%</span></div>
                <input 
                  type="range" min="0.1" max="3.0" step="0.1" value={settings.density}
                  onChange={(e) => setSettings({...settings, density: Number(e.target.value)})}
                  className="w-full accent-cyan-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-[10px] text-slate-400 uppercase tracking-wider"><span>Velocity / Speed</span><span>{settings.speed.toFixed(1)}x</span></div>
                <input 
                  type="range" min="0.1" max="3.0" step="0.1" value={settings.speed}
                  onChange={(e) => setSettings({...settings, speed: Number(e.target.value)})}
                  className="w-full accent-purple-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                />
              </div>

              <div className="space-y-3">
                <div className="flex justify-between text-[10px] text-slate-400 uppercase tracking-wider"><span>Particle Size</span><span>{settings.size.toFixed(1)}x</span></div>
                <input 
                  type="range" min="0.5" max="3.0" step="0.1" value={settings.size}
                  onChange={(e) => setSettings({...settings, size: Number(e.target.value)})}
                  className="w-full accent-blue-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer"
                />
              </div>

            </div>
          </div>
        </aside>
        )}
        
        {/* Center UI Overlay */}
        <div className="flex-1 relative h-full shrink">
          <div className="absolute inset-0 flex items-center justify-center opacity-30">
            <div className="w-[500px] h-[500px] border border-cyan-500/20 rounded-full flex items-center justify-center pointer-events-none">
              <div className="w-[350px] h-[350px] border border-cyan-500/10 rounded-full"></div>
            </div>
          </div>
          {showUI && (
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 bg-white/5 border border-white/10 px-6 py-4 rounded-3xl backdrop-blur-xl shrink-0">
              <span className="text-xs text-cyan-400 uppercase font-bold tracking-widest mb-1">以太 // 粒子引擎 (Aether Engine)</span>
              <div className="text-[10px] text-slate-400 text-center leading-relaxed font-medium">
                基于 MediaPipe 的实时视觉交互引擎。<br/>
                • <b>手势追踪</b>: 张开手掌发射粒子，握紧拳头产生引力。<br/>
                • <b>面部追踪</b>: 在右侧面板开启追踪，张大嘴巴触发流口水特效。
              </div>
              <div className="flex gap-1 items-center h-4 mt-2">
                <div className="w-1 h-2.5 bg-cyan-500"></div>
                <div className="w-1 h-4 bg-cyan-500"></div>
                <div className="w-1 h-1.5 bg-cyan-500 animate-pulse"></div>
                <div className="w-1 h-3.5 bg-cyan-500"></div>
                <div className="w-1 h-2 bg-cyan-500"></div>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar */}
        {showUI && (
          <aside className="w-64 min-w-[16rem] border-l border-white/10 bg-black/20 backdrop-blur-md p-6 flex flex-col gap-8 z-10 pointer-events-none h-full overflow-y-auto shrink-0">
            <div className="space-y-4">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">渲染引擎 (Rendering Engine)</h3>
              <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <div className="text-[10px] text-slate-400 mb-1 uppercase">输出画布 (Output Canvas)</div>
                <div className="text-lg font-light tracking-tight">{dimensions.width} x {dimensions.height}</div>
              </div>
              <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
                <div className="text-[10px] text-slate-400 mb-1 uppercase">活跃粒子 (Active Particles)</div>
                <div className="text-lg font-light tracking-tight text-cyan-400">{activeParticlesCount.toLocaleString()}</div>
              </div>
            </div>
            <div className="space-y-4 flex-1">
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">摄像头画面 (Capture Feed)</h3>
              <div className="aspect-video w-full rounded-xl bg-slate-900 border border-white/10 relative overflow-hidden flex items-center justify-center">
                 <div className="absolute inset-0 flex items-center justify-center">
                   <div className="w-16 h-16 border border-cyan-500/30 rounded-full animate-ping"></div>
                 </div>
                 <Camera className="w-5 h-5 text-cyan-500/50" />
                 <div className="absolute bottom-2 left-2 text-[8px] font-mono text-cyan-500">CAM_01_RAW</div>
              </div>
            </div>
            <button 
              onClick={isRecording ? stopRecording : startRecording}
              className={`w-full py-4 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all cursor-pointer pointer-events-auto flex items-center justify-center gap-2 ${
                isRecording 
                  ? 'bg-red-500/20 text-red-400 border border-red-500/50 shadow-[0_0_20px_rgba(239,68,68,0.3)] animate-pulse' 
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:opacity-90'
              }`}>
              {isRecording ? (
                <>
                  <StopCircle className="w-4 h-4" />
                  停止录制 (Stop)
                </>
              ) : (
                <>
                  <Video className="w-4 h-4" />
                  开始录制 (Record)
                </>
              )}
            </button>
          </aside>
        )}
      </main>

      {showUI && (
        <footer className="h-10 bg-black flex items-center px-8 border-t border-white/5 text-[9px] text-slate-600 font-mono uppercase tracking-[0.2em] justify-between z-20 shrink-0">
          <span>版本 4.8.2 // 实验性实验室</span>
          <div className="flex gap-4">
            <span>系统健康度: 极佳</span>
          </div>
        </footer>
      )}

      {/* Loading & Error States */}
      <AnimatePresence>
        {isInitializing && !error && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#050508]/80 backdrop-blur-md text-white pointer-events-auto"
          >
            <Loader2 className="w-12 h-12 text-cyan-500 animate-spin mb-4" />
            <h2 className="text-xl font-semibold mb-2 tracking-widest uppercase font-mono text-cyan-400">正在加载视觉模型</h2>
            <p className="text-slate-400 text-sm max-w-sm text-center">
              请允许访问摄像头。正在加载 AI 模型以在本地追踪您的手势和面部。
            </p>
          </motion.div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-[#050508]/90 text-white p-6 pointer-events-auto"
          >
            <div className="max-w-md w-full bg-red-950/20 border border-red-500/30 p-6 rounded-2xl text-center backdrop-blur-xl">
              <Camera className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h2 className="text-xl font-bold text-red-50 mb-2 font-mono uppercase tracking-widest">需要摄像头权限</h2>
              <p className="text-red-200/80 text-sm leading-relaxed mb-6">
                {error}
              </p>
              <button 
                onClick={() => window.location.reload()}
                className="px-6 py-2.5 bg-red-500/20 border border-red-500/50 hover:bg-red-500/40 text-red-400 rounded-lg font-medium transition-colors cursor-pointer w-full tracking-widest uppercase text-xs"
              >
                重新加载序列 (Reload Sequence)
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
