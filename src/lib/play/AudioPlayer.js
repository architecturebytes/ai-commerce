// src/lib/play/AudioPlayer.js

export class AudioPlayer {
  constructor() {
    this.audioContext = null;
    this.workletNode = null;
    this.isInitialized = false;
  }

  /**
   * Initializes the AudioPlayer with a given AudioContext.
   * This must be called before playing any audio.
   * @param {AudioContext} context The AudioContext to use for playback.
   */
  async init(context) {
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
      this.isInitialized = false;
    }
  }

  /**
   * Plays a chunk of audio data.
   * @param {Float32Array} data The audio data to play.
   */
  playAudio(data) {
    if (!this.isInitialized || !this.workletNode) {
      // This can happen if the worklet fails to load. An error is already logged in init.
      return;
    }
    this.workletNode.port.postMessage({
      type: "audio",
      audioData: data
    });
  }

  /**
   * Stops audio playback.
   */
  stop() {
    // The worklet processes audio as it comes in, so there's no internal buffer to clear from here.
    // The audio context is managed by the component that creates it.
  }
}