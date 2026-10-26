/**
 * Whisper Web Worker
 * Runs OpenAI Whisper speech-to-text model entirely in the browser
 * via @xenova/transformers (WASM/WebGPU).
 *
 * Communication protocol:
 *   Main → Worker:
 *     { type: 'load' }                — load the model
 *     { type: 'transcribe', audio }   — transcribe Float32Array audio
 *
 *   Worker → Main:
 *     { type: 'loading', progress }   — model download progress
 *     { type: 'ready' }               — model loaded
 *     { type: 'result', text }        — transcription result
 *     { type: 'error', error }        — error message
 */

import { pipeline, env, type Pipeline } from '@xenova/transformers';

// Disable local model loading — always fetch from HF Hub
env.allowLocalModels = false;

let transcriber: Pipeline | null = null;

interface ProgressUpdate {
  status: string;
  progress?: number;
  file?: string;
}

self.onmessage = async (event: MessageEvent) => {
  const { type, audio } = event.data;

  if (type === 'load') {
    try {
      self.postMessage({ type: 'loading', progress: 0, status: 'Downloading Whisper model...' });

      transcriber = await pipeline(
        'automatic-speech-recognition',
        'Xenova/whisper-tiny.en',
        {
          progress_callback: (progress: ProgressUpdate) => {
            if (progress.status === 'progress' && progress.progress !== undefined) {
              self.postMessage({
                type: 'loading',
                progress: Math.round(progress.progress),
                status: `Downloading: ${progress.file || 'model'}`,
              });
            } else if (progress.status === 'done') {
              self.postMessage({
                type: 'loading',
                progress: 100,
                status: 'Model loaded!',
              });
            }
          },
        }
      );

      self.postMessage({ type: 'ready' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load Whisper model';
      self.postMessage({ type: 'error', error: message });
    }
  }

  if (type === 'transcribe') {
    if (!transcriber) {
      self.postMessage({ type: 'error', error: 'Model not loaded' });
      return;
    }

    try {
      const result = await (transcriber as (audio: Float32Array, options: object) => Promise<{ text: string }>)(audio, {
        language: 'english',
        task: 'transcribe',
        chunk_length_s: 30,
        stride_length_s: 5,
        return_timestamps: false,
      });

      const text = result.text?.trim() || '';
      self.postMessage({ type: 'result', text });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Transcription failed';
      self.postMessage({ type: 'error', error: message });
    }
  }
};
