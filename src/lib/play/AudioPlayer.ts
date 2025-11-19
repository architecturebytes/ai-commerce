// src/lib/play/AudioPlayer.ts

export class AudioPlayer {
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private isInitialized = false;

  // Initialize the AudioPlayer with the main AudioContext
  public async init(context: AudioContext) {
    if (this.isInitialized) return;
    this.audioContext = context;
    try {
      // The path must be relative to the current module for Vite to handle it.
      const workletUrl = new URL('./AudioPlayerProcessor.worklet.js', import.meta.url).toString();
      await this.audioContext.audioWorklet.addModule(workletUrl);
      this.workletNode = new AudioWorkletNode(this.audioContext, 'audio-player-processor');
      this.workletNode.connect(this.audioContext.destination);
      this.isInitialized = true;
      console.log("AudioPlayer initialized successfully.");
    } catch (error) {
      console.error("Error initializing AudioPlayer or loading worklet:", error);
      // Fallback to ScriptProcessorNode if AudioWorklet fails
      this.isInitialized = false;
    }
  }

  // Play a chunk of audio data
  public playAudio(data: Float32Array) {
    if (!this.isInitialized || !this.workletNode) {
      // This warning is expected if the worklet failed to load.
      // The app will still function using the older audio processing method.
      return;
    }
    this.workletNode.port.postMessage(data);
  }

  // Stop playback
  public stop() {
    // The worklet processes audio as it comes in, so there's no buffer to clear.
    // We can add more complex logic here if needed (e.g., fading out).
  }
}
