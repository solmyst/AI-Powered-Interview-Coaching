import { FaceLandmarker, FilesetResolver, DrawingUtils, NormalizedLandmark } from '@mediapipe/tasks-vision';

export interface FaceAnalysisData {
  eyeContact: number;       // 0-100 percentage
  headPose: {
    yaw: number;            // left-right rotation in degrees
    pitch: number;          // up-down rotation in degrees
    roll: number;           // tilt rotation in degrees
  };
  posture: 'poor' | 'good' | 'excellent';
  confidence: number;       // 0-100 composite
  expressions: {
    smile: number;
    browRaise: number;
    jawDrop: number;
  };
  faceDetected: boolean;
}

type FaceAnalysisCallback = (data: FaceAnalysisData) => void;

export class FaceAnalysisService {
  private faceLandmarker: FaceLandmarker | null = null;
  private animationFrameId: number | null = null;
  private callback: FaceAnalysisCallback | null = null;
  private isRunning = false;
  private canvas: HTMLCanvasElement | null = null;
  private canvasCtx: CanvasRenderingContext2D | null = null;
  private drawingUtils: DrawingUtils | null = null;

  // Running averages for smoothing
  private eyeContactHistory: number[] = [];
  private confidenceHistory: number[] = [];
  private readonly SMOOTH_WINDOW = 10;

  async initialize(): Promise<void> {
    try {
      const initPromise = async () => {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.34/wasm'
        );

        this.faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true
        });
      };

      // Add a 15-second timeout so it doesn't hang forever
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('MediaPipe initialization timed out after 15 seconds')), 15000);
      });

      await Promise.race([initPromise(), timeoutPromise]);
      console.log('[FaceAnalysis] MediaPipe Face Landmarker initialized');
    } catch (error) {
      console.error('[FaceAnalysis] Failed to initialize:', error);
      throw error;
    }
  }

  setOverlayCanvas(canvas: HTMLCanvasElement): void {
    this.canvas = canvas;
    this.canvasCtx = canvas.getContext('2d');
    if (this.canvasCtx) {
      this.drawingUtils = new DrawingUtils(this.canvasCtx);
    }
  }

  start(videoElement: HTMLVideoElement, callback: FaceAnalysisCallback): void {
    if (!this.faceLandmarker) {
      console.error('[FaceAnalysis] Not initialized');
      return;
    }

    this.callback = callback;
    this.isRunning = true;
    this.eyeContactHistory = [];
    this.confidenceHistory = [];

    const processFrame = () => {
      if (!this.isRunning || !this.faceLandmarker || !videoElement.videoWidth) {
        if (this.isRunning) {
          this.animationFrameId = requestAnimationFrame(processFrame);
        }
        return;
      }

      try {
        const results = this.faceLandmarker.detectForVideo(videoElement, performance.now());

        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          const landmarks = results.faceLandmarks[0];
          const blendshapes = results.faceBlendshapes?.[0]?.categories || [];

          // Draw landmarks on overlay canvas
          this.drawLandmarks(landmarks, videoElement);

          // Calculate all metrics
          const eyeContact = this.calculateEyeContact(landmarks);
          const headPose = this.calculateHeadPose(landmarks);
          const posture = this.calculatePosture(landmarks, headPose);
          const expressions = this.extractExpressions(blendshapes);
          const confidence = this.calculateConfidence(eyeContact, headPose, expressions);

          const data: FaceAnalysisData = {
            eyeContact: this.smooth(eyeContact, this.eyeContactHistory),
            headPose,
            posture,
            confidence: this.smooth(confidence, this.confidenceHistory),
            expressions,
            faceDetected: true
          };

          this.callback?.(data);
        } else {
          // Clear canvas when no face detected
          if (this.canvas && this.canvasCtx) {
            this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
          }

          this.callback?.({
            eyeContact: 0,
            headPose: { yaw: 0, pitch: 0, roll: 0 },
            posture: 'poor',
            confidence: 0,
            expressions: { smile: 0, browRaise: 0, jawDrop: 0 },
            faceDetected: false
          });
        }
      } catch {
        // Silently handle frame errors (can happen during transitions)
      }

      this.animationFrameId = requestAnimationFrame(processFrame);
    };

    this.animationFrameId = requestAnimationFrame(processFrame);
  }

  stop(): void {
    this.isRunning = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    if (this.canvas && this.canvasCtx) {
      this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }

  destroy(): void {
    this.stop();
    this.faceLandmarker?.close();
    this.faceLandmarker = null;
  }

  private drawLandmarks(
    landmarks: NormalizedLandmark[],
    videoElement: HTMLVideoElement
  ): void {
    if (!this.canvas || !this.canvasCtx || !this.drawingUtils) return;

    // Match canvas size to video
    this.canvas.width = videoElement.videoWidth;
    this.canvas.height = videoElement.videoHeight;
    this.canvasCtx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw face mesh with subtle green connectors
    this.drawingUtils.drawConnectors(
      landmarks,
      FaceLandmarker.FACE_LANDMARKS_TESSELATION,
      { color: '#00FF0022', lineWidth: 0.5 }
    );

    // Draw eye outlines more prominently
    this.drawingUtils.drawConnectors(
      landmarks,
      FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
      { color: '#30FF30', lineWidth: 1.5 }
    );
    this.drawingUtils.drawConnectors(
      landmarks,
      FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
      { color: '#30FF30', lineWidth: 1.5 }
    );

    // Draw iris
    this.drawingUtils.drawConnectors(
      landmarks,
      FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,
      { color: '#FF3030', lineWidth: 2 }
    );
    this.drawingUtils.drawConnectors(
      landmarks,
      FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS,
      { color: '#FF3030', lineWidth: 2 }
    );
  }

  /**
   * Calculate eye contact by measuring how centered the iris is within the eye.
   * When looking directly at the camera, irises are roughly centered.
   */
  private calculateEyeContact(landmarks: NormalizedLandmark[]): number {
    // Left eye: landmarks 33 (outer), 133 (inner), left iris center: 468
    // Right eye: landmarks 362 (outer), 263 (inner), right iris center: 473
    const leftOuter = landmarks[33];
    const leftInner = landmarks[133];
    const leftIris = landmarks[468];

    const rightOuter = landmarks[362];
    const rightInner = landmarks[263];
    const rightIris = landmarks[473];

    if (!leftOuter || !leftInner || !leftIris || !rightOuter || !rightInner || !rightIris) {
      return 50;
    }

    // Calculate how centered the iris is horizontally within the eye
    const leftEyeWidth = Math.abs(leftInner.x - leftOuter.x);
    const leftIrisPosition = (leftIris.x - leftOuter.x) / (leftEyeWidth || 1);
    const leftDeviation = Math.abs(leftIrisPosition - 0.5);

    const rightEyeWidth = Math.abs(rightInner.x - rightOuter.x);
    const rightIrisPosition = (rightIris.x - rightOuter.x) / (rightEyeWidth || 1);
    const rightDeviation = Math.abs(rightIrisPosition - 0.5);

    // Average deviation: 0 = perfect center (looking at camera), 0.5 = looking fully sideways
    const avgDeviation = (leftDeviation + rightDeviation) / 2;

    // Convert to 0-100 score: less deviation = higher score
    // Deviation of 0.15 or less = 100% (natural slight offset is normal)
    const score = Math.max(0, Math.min(100, (1 - (avgDeviation / 0.35)) * 100));

    return Math.round(score);
  }

  /**
   * Estimate head pose from face landmarks geometry.
   */
  private calculateHeadPose(landmarks: NormalizedLandmark[]): {
    yaw: number;
    pitch: number;
    roll: number;
  } {
    // Use nose tip (1), chin (152), left cheek (234), right cheek (454), forehead (10)
    const noseTip = landmarks[1];
    const chin = landmarks[152];
    const leftCheek = landmarks[234];
    const rightCheek = landmarks[454];
    const forehead = landmarks[10];

    if (!noseTip || !chin || !leftCheek || !rightCheek || !forehead) {
      return { yaw: 0, pitch: 0, roll: 0 };
    }

    // Yaw: difference in z-depth between left and right cheek
    const yaw = (rightCheek.z - leftCheek.z) * 300;

    // Pitch: nose tip relative to midpoint of forehead and chin
    const faceCenterY = (forehead.y + chin.y) / 2;
    const pitch = (noseTip.y - faceCenterY) * 200;

    // Roll: angle of the line from chin to forehead
    const roll = Math.atan2(forehead.x - chin.x, forehead.y - chin.y) * (180 / Math.PI);

    return {
      yaw: Math.round(yaw),
      pitch: Math.round(pitch),
      roll: Math.round(roll)
    };
  }

  /**
   * Calculate posture from head position and face angle.
   */
  private calculatePosture(
    landmarks: NormalizedLandmark[],
    headPose: { yaw: number; pitch: number; roll: number }
  ): 'poor' | 'good' | 'excellent' {
    // Nose tip vertical position — if too high or too low, posture is off
    const noseTip = landmarks[1];
    if (!noseTip) return 'good';

    // Check if head is reasonably straight
    const yawDev = Math.abs(headPose.yaw);
    const pitchDev = Math.abs(headPose.pitch);
    const rollDev = Math.abs(headPose.roll);

    const totalDeviation = yawDev + pitchDev + rollDev;

    if (totalDeviation < 15) return 'excellent';
    if (totalDeviation < 35) return 'good';
    return 'poor';
  }

  /**
   * Extract facial expression scores from blendshapes.
   */
  private extractExpressions(
    blendshapes: { categoryName: string; score: number }[]
  ): { smile: number; browRaise: number; jawDrop: number } {
    const getScore = (name: string): number => {
      const shape = blendshapes.find(b => b.categoryName === name);
      return shape ? Math.round(shape.score * 100) : 0;
    };

    return {
      smile: Math.max(getScore('mouthSmileLeft'), getScore('mouthSmileRight')),
      browRaise: Math.max(getScore('browOuterUpLeft'), getScore('browOuterUpRight')),
      jawDrop: getScore('jawOpen')
    };
  }

  /**
   * Calculate composite confidence score.
   */
  private calculateConfidence(
    eyeContact: number,
    headPose: { yaw: number; pitch: number; roll: number },
    expressions: { smile: number; browRaise: number; jawDrop: number }
  ): number {
    // Steadiness bonus: less head movement = more confident appearance
    const totalMovement = Math.abs(headPose.yaw) + Math.abs(headPose.pitch) + Math.abs(headPose.roll);
    const steadiness = Math.max(0, 100 - totalMovement * 2);

    // Engagement bonus from expressions
    const engagement = Math.min(100, expressions.smile * 0.5 + 20);

    // Weighted composite
    const score = (eyeContact * 0.4) + (steadiness * 0.35) + (engagement * 0.25);
    return Math.round(Math.max(0, Math.min(100, score)));
  }

  /**
   * Moving average smoothing.
   */
  private smooth(value: number, history: number[]): number {
    history.push(value);
    if (history.length > this.SMOOTH_WINDOW) {
      history.shift();
    }
    const sum = history.reduce((a, b) => a + b, 0);
    return Math.round(sum / history.length);
  }
}
