import React, { useState, useRef, useEffect, useCallback } from 'react';
import './style.css';
import { AudioPlayer } from './lib/play/AudioPlayer';
import { target } from './lib/sdk/events_proxy';
import { DefaultAudioInputConfiguration, SHOW_CHAT_TRANSCRIPT } from './lib/sdk/consts';
import { DUMMY_PRODUCTS, Product } from './lib/data';
import ChatContainer from './components/ChatContainer';
import StatusIndicator from './components/StatusIndicator';
import MicrophoneButton from './components/MicrophoneButton';
import ProductList from './components/ProductList';
import ShoppingCart, { CartItem } from './components/ShoppingCart';

const App: React.FC = () => {
  // E-commerce state
  const [products, setProducts] = useState<Product[]>(DUMMY_PRODUCTS);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isOrderConfirmed, setIsOrderConfirmed] = useState(false);

  // Chat and connection state
  const [chat, setChat] = useState<{ history: any[] }>({ history: [] });
  const [isStreaming, setIsStreaming] = useState(false);
  const [status, setStatus] = useState({ text: "Disconnected", className: "disconnected" });
  const [waitingForUserTranscription, setWaitingForUserTranscription] = useState(false);
  const [waitingForAssistantResponse, setWaitingForAssistantResponse] = useState(false);

  // Refs for audio processing and session management
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioPlayerRef = useRef<AudioPlayer>(new AudioPlayer());
  const sessionInitializedRef = useRef(false);
  const isStreamingRef = useRef(isStreaming);
  const streamTimerRef = useRef<number | null>(null);
  const sessionIdRef = useRef<string | null>(null);

  // Create a ref to hold the latest cart state for tool actions
  const cartRef = useRef(cart);
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  useEffect(() => {
    isStreamingRef.current = isStreaming;
  }, [isStreaming]);

  const initAudio = useCallback(async () => {
    try {
      setStatus({ text: "Requesting microphone...", className: "connecting" });
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioStreamRef.current = stream;
      // Use the sample rate from the single source of truth
      const audioContext = new AudioContext({ sampleRate: DefaultAudioInputConfiguration.sampleRateHertz });
      audioContextRef.current = audioContext;
      // Correctly initialize the audio player with the context
      await audioPlayerRef.current.init(audioContext);
      setStatus({ text: "Microphone ready", className: "ready" });
    } catch (error: any) {
      console.error("Error accessing microphone:", error);
      setStatus({ text: `Mic Error: ${error.message}`, className: "error" });
    }
  }, []);

  const initializeSession = useCallback((): Promise<void> => {
    if (sessionInitializedRef.current) return Promise.resolve();

    return new Promise((resolve) => {
      const handleSessionCreated = (e: Event) => {
        const sessionId = (e as CustomEvent).detail;
        sessionIdRef.current = sessionId; // Store the session ID
        
        // --- E-commerce Tool Definitions ---

        const findProductsTool = {
          toolname: 'find_products',
          definition: {
            name: 'find_products',
            description: 'Searches for products by category or shows all products.',
            inputSchema: {
              json: JSON.stringify({
                type: 'object',
                properties: {
                  category: {
                    type: 'string',
                    description: 'The category of products to find (e.g., "Laptops", "Audio"). If omitted, all products are shown.',
                  },
                },
              }),
            },
          },
          action: async (_sessionId: string, inputFromNovaSonic: string) => {
            const input = JSON.parse(JSON.parse(inputFromNovaSonic).content);
            const category = input.category;
            if (category && typeof category === 'string') {
              const filteredProducts = DUMMY_PRODUCTS.filter(p => p.category.toLowerCase() === category.toLowerCase());
              setProducts(filteredProducts);
              return JSON.stringify({ success: true, found: filteredProducts.length });
            } else {
              setProducts(DUMMY_PRODUCTS); // Show all if no category
              return JSON.stringify({ success: true, found: DUMMY_PRODUCTS.length });
            }
          },
        };

        const findBestProductMatch = (query: string): Product | undefined => {
          if (!query) return undefined;

          const lowerCaseQuery = query.toLowerCase();
          const queryWords = lowerCaseQuery.split(' ').filter(w => w);

          let bestMatch: Product | undefined = undefined;
          let highScore = 0;

          DUMMY_PRODUCTS.forEach(product => {
            const lowerCaseName = product.name.toLowerCase();
            let score = 0;

            // 1. Exact match (highest score)
            if (lowerCaseName === lowerCaseQuery) {
              score = 100;
            }
            // 2. Starts with query
            else if (lowerCaseName.startsWith(lowerCaseQuery)) {
              score = 90;
            }
            // 3. Includes query
            else if (lowerCaseName.includes(lowerCaseQuery)) {
              score = 80;
            }
            // 4. All query words are present
            else {
              const nameWords = lowerCaseName.split(' ');
              const allWordsFound = queryWords.every(qw => nameWords.some(nw => nw.includes(qw)));
              if (allWordsFound) {
                score = 70;
              }
            }
            
            // Simple bonus for being a substring to help differentiate
            if (score > 0 && score < 100) {
                score += (lowerCaseQuery.length / lowerCaseName.length) * 10;
            }

            if (score > highScore) {
              highScore = score;
              bestMatch = product;
            }
          });

          // Only return a match if the score is reasonably high
          return highScore >= 70 ? bestMatch : undefined;
        };

        const addToCartTool = {
          toolname: 'add_to_cart',
          definition: {
            name: 'add_to_cart',
            description: 'Adds a specified product to the shopping cart.',
            inputSchema: {
              json: JSON.stringify({
                type: 'object',
                properties: {
                  productName: {
                    type: 'string',
                    description: 'The name of the product to add to the cart. Should be a close match to the actual product name.',
                  },
                  quantity: {
                    type: 'number',
                    description: 'The number of units to add.',
                    default: 1,
                  },
                },
                required: ['productName'],
              }),
            },
          },
          action: async (_sessionId: string, inputFromNovaSonic: string) => {
            const input = JSON.parse(JSON.parse(inputFromNovaSonic).content);
            const productName = input.productName;
            const quantity = input.quantity || 1;
            
            const productToAdd = findBestProductMatch(productName);

            if (productToAdd) {
              setCart(prevCart => {
                const existingItem = prevCart.find(item => item.id === productToAdd.id);
                if (existingItem) {
                  return prevCart.map(item =>
                    item.id === productToAdd.id ? { ...item, quantity: item.quantity + quantity } : item
                  );
                } else {
                  return [...prevCart, { ...productToAdd, quantity }];
                }
              });
              return JSON.stringify({ success: true, productName: productToAdd.name });
            }
            return JSON.stringify({ success: false, error: `Could not find a close match for product "${productName}".` });
          },
        };

        const checkoutTool = {
          toolname: 'checkout',
          definition: {
            name: 'checkout',
            description: 'Completes the purchase, confirms the order, and clears the cart.',
            inputSchema: { json: JSON.stringify({ type: 'object', properties: {} }) },
          },
          action: async (_sessionId: string, _inputFromNovaSonic: string) => {
            // Use the ref to get the current cart state, avoiding the stale closure issue
            const currentCart = cartRef.current;
            if (currentCart.length === 0) {
              return JSON.stringify({ success: false, error: "The cart is empty." });
            }
            setIsOrderConfirmed(true);
            setCart([]);
            // Return the number of items that were in the cart before clearing
            return JSON.stringify({ success: true, totalItems: currentCart.length });
          },
        };

        target.dispatchEvent(new CustomEvent("initiateSession", {
          detail: {
            sessionId: sessionId,
            tools: [findProductsTool, addToCartTool, checkoutTool]
          }
        }));
      };

      const handleSessionInitiated = () => {
        const systemPrompt = `You are a helpful e-commerce assistant. You can help users find products, add items to their shopping cart, and checkout.
        Available product categories are: ${[...new Set(DUMMY_PRODUCTS.map(p => p.category))].join(', ')}.
        When a user asks to add an item, use the exact product name from the list.`;
        
        target.dispatchEvent(new Event("promptStart"));
        target.dispatchEvent(new CustomEvent("systemPrompt", { detail: systemPrompt }));
        target.dispatchEvent(new Event("audioStart"));
        sessionInitializedRef.current = true;
        setStatus({ text: "Session initialized", className: "ready" });
        resolve();
      };

      target.addEventListener("sessionCreated", handleSessionCreated, { once: true });
      target.addEventListener("sessionInitiated", handleSessionInitiated, { once: true });

      setStatus({ text: "Initializing session...", className: "connecting" });
      target.dispatchEvent(new Event("createSession"));
    });
  }, []); 

  const arrayBufferToBase64 = (buffer: ArrayBuffer): string => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  };

  const stopStreaming = useCallback((isAutoRestart = false) => {
    if (!isStreamingRef.current) return;

    // Clear the session timeout timer if it exists
    if (streamTimerRef.current) {
      clearTimeout(streamTimerRef.current);
      streamTimerRef.current = null;
    }

    setIsStreaming(false);
    sessionInitializedRef.current = false;
    setWaitingForUserTranscription(false);
    setWaitingForAssistantResponse(false);

    if (processorRef.current && sourceNodeRef.current) {
      processorRef.current.disconnect();
      sourceNodeRef.current.disconnect();
    }

    if (!isAutoRestart) {
      setStatus({ text: "Processing...", className: "processing" });
    }
    
    audioPlayerRef.current.stop();
    // Dispatch the specific session ID to be stopped
    if (sessionIdRef.current) {
      target.dispatchEvent(new CustomEvent("stopAudio", { detail: { sessionId: sessionIdRef.current } }));
    }
  }, []);

  const startStreaming = useCallback(async (isAutoRestart = false) => {
    if (isStreamingRef.current && !isAutoRestart) return;
    
    if (!isAutoRestart) {
      setChat({ history: [] });
      setIsOrderConfirmed(false);
      setProducts(DUMMY_PRODUCTS);
    }

    try {
      if (!sessionInitializedRef.current) {
        await initializeSession();
      }
      if (!audioContextRef.current || !audioStreamRef.current) {
        throw new Error("Audio not initialized");
      }

      const sourceNode = audioContextRef.current.createMediaStreamSource(audioStreamRef.current);
      sourceNodeRef.current = sourceNode;
      const processor = audioContextRef.current.createScriptProcessor(512, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!isStreamingRef.current) return;
        const inputData = e.inputBuffer.getChannelData(0);
        const pcmData = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          pcmData[i] = Math.max(-1, Math.min(1, inputData[i])) * 0x7fff;
        }
        const base64Data = arrayBufferToBase64(pcmData.buffer);
        target.dispatchEvent(new CustomEvent("audioInput", { detail: base64Data }));
      };

      sourceNode.connect(processor);
      processor.connect(audioContextRef.current.destination);

      setIsStreaming(true);
      setWaitingForUserTranscription(true);
      if (isAutoRestart) {
        setStatus({ text: "Session restarted due to time limit.", className: "ready" });
      } else {
        setStatus({ text: "Listening...", className: "recording" });
      }

      // Set a wall-clock timer to automatically stop and restart the stream.
      // This is now accurate because the client and server sample rates are aligned.
      const STREAM_TIME_LIMIT = 595000; // 9 minutes and 55 seconds
      streamTimerRef.current = window.setTimeout(() => {
        console.log(`[Auto-Restart] Stream time limit reached. Restarting session to prevent disconnection.`);
        stopStreaming(true);
        startStreaming(true);
      }, STREAM_TIME_LIMIT);

    } catch (error: any) {
      console.error("Error starting streaming:", error);
      setStatus({ text: `Error: ${error.message}`, className: "error" });
    }
  }, [initializeSession, stopStreaming]);

  const toggleStreaming = useCallback(() => {
    isStreaming ? stopStreaming() : startStreaming();
  }, [isStreaming, startStreaming, stopStreaming]);

  const base64ToFloat32Array = (base64String: string): Float32Array => {
    const binaryString = window.atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const int16Array = new Int16Array(bytes.buffer);
    const float32Array = new Float32Array(int16Array.length);
    for (let i = 0; i < int16Array.length; i++) {
      float32Array[i] = int16Array[i] / 32768.0;
    }
    return float32Array;
  };

  useEffect(() => {
    const handleTextOutput = (e: Event) => {
      const data = (e as CustomEvent).detail;
      setChat(prev => ({ history: [...prev.history, { role: data.role, message: data.content }] }));
      if (data.role === 'USER') {
        setWaitingForUserTranscription(false);
        setWaitingForAssistantResponse(true);
      }
    };

    const handleAudioOutput = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (data.content) {
        audioPlayerRef.current.playAudio(base64ToFloat32Array(data.content));
      }
    };

    const handleContentEnd = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (data.type === "TEXT" && data.role === "ASSISTANT") {
        setWaitingForAssistantResponse(false);
      }
    };
    
    const handleStreamComplete = () => {
      if (isStreamingRef.current) stopStreaming();
      setStatus({ text: "Ready", className: "ready" });
    };

    const handleError = (e: Event) => {
      const error = (e as CustomEvent).detail;
      setStatus({ text: `Error: ${error.message || 'Unknown error'}`, className: "error" });
      if (isStreamingRef.current) stopStreaming();
    };

    const handleModelTimeout = () => {
      console.log(`[Auto-Restart] Model timed out. Restarting session.`);
      setStatus({ text: "Model timed out. Restarting session...", className: "connecting" });
      stopStreaming(true);
      startStreaming(true);
    };

    target.addEventListener("textOutput", handleTextOutput);
    target.addEventListener("audioOutput", handleAudioOutput);
    target.addEventListener("contentEnd", handleContentEnd);
    target.addEventListener("streamComplete", handleStreamComplete);
    target.addEventListener("error", handleError);
    target.addEventListener("modelTimedOut", handleModelTimeout); // Register new handler

    initAudio();

    return () => {
      target.removeEventListener("textOutput", handleTextOutput);
      target.removeEventListener("audioOutput", handleAudioOutput);
      target.removeEventListener("contentEnd", handleContentEnd);
      target.removeEventListener("streamComplete", handleStreamComplete);
      target.removeEventListener("error", handleError);
      target.removeEventListener("modelTimedOut", handleModelTimeout); // Unregister new handler
    };
  }, [initAudio, stopStreaming, startStreaming]);

  return (
    <div className="app-container">
      <div className="app-header">
        <div className="app-title">
          <h1>aiCommerce</h1>
        </div>
      </div>
      <div className="ecomm-container">
        <div className="left-panel">
          <ProductList products={products} />
        </div>
        <div className="right-panel">
          <div className="status-controls-row">
            <StatusIndicator status={status} />
            <MicrophoneButton
              isStreaming={isStreaming}
              onToggleStreaming={toggleStreaming}
              disabled={status.className === "disconnected" || status.className === "error"}
            />
          </div>
          <div className={`chat-cart-container ${!SHOW_CHAT_TRANSCRIPT ? 'chat-hidden' : ''}`}>
            {SHOW_CHAT_TRANSCRIPT && (
              <ChatContainer
                chat={chat}
                waitingForUserTranscription={waitingForUserTranscription}
                waitingForAssistantResponse={waitingForAssistantResponse}
              />
            )}
            <ShoppingCart items={cart} isOrderConfirmed={isOrderConfirmed} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;