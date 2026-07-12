import { useState, useEffect, useRef, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type { 
  ConnectionState, 
  Message, 
  SystemMessageType, 
  WSMessage
} from '../types';

export function useRealTime() {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const playbackNodeRef = useRef<AudioWorkletNode | null>(null);
  const recorderNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const messageMapRef = useRef<Map<string, Message>>(new Map());
  const currentUserMessageIdRef = useRef<string | null>(null);
  const isSessionCreatedRef = useRef(false);

  const logError = useCallback((message: string, err: unknown) => {
    const errorMessage = `${message} ${err instanceof Error ? err.message : String(err)}`;
    console.error(errorMessage);
    setError(errorMessage);
  }, []);

  const clearPlayback = useCallback(() => {
    if (playbackNodeRef.current) {
      playbackNodeRef.current.port.postMessage(null);
    }
  }, []);

  const playAudio = useCallback(async (buffer: Int16Array) => {
    if (!playbackNodeRef.current || !audioContextRef.current) return;
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    playbackNodeRef.current.port.postMessage(buffer);
  }, []);

  const handleWSMessage = useCallback(async (message: WSMessage) => {
    switch (message.type) {
      case 'transcription':
        if (message.id) {
          const msg = messageMapRef.current.get(message.id);
          if (msg) {
            msg.content = message.text!;
            setMessages(Array.from(messageMapRef.current.values()));
          }
        }
        break;
      case 'text_delta':
        if (message.id) {
          const existingMessage = messageMapRef.current.get(message.id);
          if (existingMessage) {
            existingMessage.content += message.delta!;
          } else {
            const newMessage: Message = {
              id: message.id,
              type: 'assistant',
              content: message.delta!,
            };
            messageMapRef.current.set(message.id, newMessage);
          }
          setMessages(Array.from(messageMapRef.current.values()));
        }
        break;
      case 'control': {
        switch (message.action) {
          case 'function_call_output': {
            if (!message.id || !message.functionCallParams) break;
            messageMapRef.current.clear();
            const userMsg: Message = {
              id: message.id,
              type: message.type!,
              action: message.action,
              content: message.functionCallParams,
            };
            messageMapRef.current.set(userMsg.id, userMsg);
            setMessages([userMsg]);
            break;
          }
          case 'speech_started': {
            clearPlayback();
            const id = uuidv4();
            const userMsg: Message = { id, type: 'user', content: '...' };
            messageMapRef.current.set(id, userMsg);
            currentUserMessageIdRef.current = id;
            setMessages(Array.from(messageMapRef.current.values()));
            break;
          }
          case 'item_created':
            if (message.id && currentUserMessageIdRef.current) {
              const tempId = currentUserMessageIdRef.current;
              const msg = messageMapRef.current.get(tempId);
              // Only swap if it's the pending "..." message
              if (msg && msg.content === '...') {
                messageMapRef.current.delete(tempId);
                msg.id = message.id;
                messageMapRef.current.set(message.id, msg);
                currentUserMessageIdRef.current = message.id;
                setMessages(Array.from(messageMapRef.current.values()));
              }
            }
            break;
          case 'session_created':
            isSessionCreatedRef.current = true;
            setConnectionState('connected');
            break;
          case 'error':
            if (message.error) {
              logError('OpenAI Error:', message.error.message);
            }
            break;
        }
        break;
      }
    }
  }, [clearPlayback, logError]);

  const initAudio = useCallback(async () => {
    if (!audioContextRef.current) {
      const context = new AudioContext({ sampleRate: 24000 });
      
      // Playback Worklet
      const playbackBlob = new Blob([`
        registerProcessor('playback-worklet', class extends AudioWorkletProcessor {
          constructor() { super(); this.port.onmessage = (e) => { if (e.data === null) this.buffer = []; else this.buffer.push(...e.data); }; this.buffer = []; }
          process(inputs, outputs) {
            const output = outputs[0][0];
            if (this.buffer.length > output.length) {
              const toProcess = this.buffer.splice(0, output.length);
              output.set(toProcess.map(v => v / 32768));
            } else {
              output.set(this.buffer.map(v => v / 32768));
              this.buffer = [];
            }
            return true;
          }
        });
      `], { type: 'application/javascript' });
      await context.audioWorklet.addModule(URL.createObjectURL(playbackBlob));
      const playbackNode = new AudioWorkletNode(context, 'playback-worklet');
      playbackNode.connect(context.destination);
      playbackNodeRef.current = playbackNode;

      // Recorder Worklet
      const recorderBlob = new Blob([`
        registerProcessor('recorder-worklet', class extends AudioWorkletProcessor {
          process(inputs) {
            const input = inputs[0];
            if (input.length > 0) {
              const f32 = input[0];
              const i16 = new Int16Array(f32.length);
              for (let i = 0; i < f32.length; i++) {
                let val = Math.floor(f32[i] * 0x7fff);
                i16[i] = Math.max(-0x8000, Math.min(0x7fff, val));
              }
              this.port.postMessage(i16);
            }
            return true;
          }
        });
      `], { type: 'application/javascript' });
      await context.audioWorklet.addModule(URL.createObjectURL(recorderBlob));
      
      audioContextRef.current = context;
    }
  }, []);

  const disconnect = useCallback(async () => {
    if (socketRef.current) {
      socketRef.current.close();
      socketRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }
    if (recorderNodeRef.current) {
      recorderNodeRef.current.disconnect();
      recorderNodeRef.current = null;
    }
    
    messageMapRef.current.clear();
    currentUserMessageIdRef.current = null;
    isSessionCreatedRef.current = false;
    
    setConnectionState('disconnected');
    setMessages([]);
    setIsRecording(false);
  }, []);

  const connect = useCallback(async (systemMessageType: SystemMessageType) => {
    await disconnect();
    setConnectionState('connecting');

    try {
      const isMock = window.location.search.includes('mock=true');
      let socket: any;

      if (isMock) {
        console.log('[MockWS] Initializing mock WebSocket connection...');
        const mockSocket = {
          readyState: 1, // OPEN
          send: (data: any) => {
            console.log('[MockWS] sent data:', data);
          },
          close: () => {
            console.log('[MockWS] closed');
            if (mockSocket.onclose) {
              mockSocket.onclose({} as any);
            }
          },
          onopen: null as any,
          onmessage: null as any,
          onclose: null as any,
          onerror: null as any,
        };
        socket = mockSocket;
        socketRef.current = socket;

        // Trigger connection lifecycle after handlers are assigned
        setTimeout(() => {
          if (socketRef.current !== socket) return;
          if (socket.onopen) socket.onopen();
          
          // Send session_created control message
          if (socket.onmessage) {
            socket.onmessage({
              data: JSON.stringify({
                type: 'control',
                action: 'session_created',
              })
            } as any);
          }

          // Simulate a conversation thread
          const conversationSteps = [
            {
              delay: 1500,
              userText: "Hello, coach! I'd like to practice my presentation skills today.",
              aiText: "Hello! That sounds like a wonderful goal. Let's start with a quick warm-up. What is the topic of your presentation?"
            },
            {
              delay: 8000,
              userText: "It's about our new hands-free AI features. I want to sound natural and confident.",
              aiText: "Excellent topic. Hands-free AI is very relevant. When introducing the core concept, try to keep your voice steady. Let's practice your opening hook."
            },
            {
              delay: 15000,
              userText: "Sounds good. My opening hook is: 'Have you ever wished you could interact with AI using just your voice?'",
              aiText: "That's a very engaging question! Your pacing was good. Try to emphasize 'just your voice' slightly more to make it pop."
            }
          ];

          conversationSteps.forEach(stepData => {
            setTimeout(() => {
              if (socketRef.current !== socket) return;
              
              // 1. Simulate Speech Started (creates the user bubble with '...')
              if (socket.onmessage) {
                socket.onmessage({
                  data: JSON.stringify({
                    type: 'control',
                    action: 'speech_started',
                  })
                } as any);
              }

              // 2. Simulate User Transcription (updates user bubble text)
              setTimeout(() => {
                if (socketRef.current !== socket) return;
                if (socket.onmessage) {
                  socket.onmessage({
                    data: JSON.stringify({
                      type: 'transcription',
                      id: currentUserMessageIdRef.current || undefined,
                      text: stepData.userText,
                    })
                  } as any);
                }
              }, 1000);

              // 3. Simulate AI Delta Responses
              setTimeout(() => {
                if (socketRef.current !== socket) return;
                const aiMsgId = uuidv4();
                
                // Send parts of response in sequence
                const words = stepData.aiText.split(' ');
                let currentText = '';
                words.forEach((word, idx) => {
                  setTimeout(() => {
                    if (socketRef.current !== socket) return;
                    currentText += (idx === 0 ? '' : ' ') + word;
                    if (socket.onmessage) {
                      socket.onmessage({
                        data: JSON.stringify({
                          type: 'text_delta',
                          id: aiMsgId,
                          delta: (idx === 0 ? '' : ' ') + word,
                        })
                      } as any);
                    }
                  }, idx * 100);
                });
              }, 2500);

            }, stepData.delay);
          });

        }, 100);

      } else {
        await initAudio();
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const socketUrl = `${protocol}//${window.location.host}/realtime`;
        socket = new WebSocket(socketUrl);
        socket.binaryType = 'arraybuffer';
        socketRef.current = socket; // Set immediately to allow disconnect() to close it
      }

      socket.onopen = () => {
        if (socketRef.current !== socket) {
          socket.close();
          return;
        }
        if (!isMock) {
          socket.send(JSON.stringify({ type: 'init', systemMessageType }));
        }
      };
      
      socket.onmessage = async (event: MessageEvent) => {
        if (socketRef.current !== socket) return;
        
        if (!isMock && event.data instanceof ArrayBuffer) {
          playAudio(new Int16Array(event.data));
        } else {
          handleWSMessage(JSON.parse(event.data));
        }
      };
      
      socket.onclose = () => {
        if (socketRef.current === socket) {
          setConnectionState('disconnected');
        }
      };
      
      socket.onerror = (e: Event | any) => {
        if (socketRef.current === socket) {
          logError('WebSocket error:', e);
          setConnectionState('disconnected');
        }
      };
    } catch (e) {
      logError('Connection failed:', e);
      setConnectionState('disconnected');
    }
  }, [disconnect, initAudio, handleWSMessage, playAudio, logError]);

  const startRecording = useCallback(async (constraints?: MediaStreamConstraints) => {
    if (isRecording || connectionState !== 'connected' || !audioContextRef.current) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints || { audio: true });
      mediaStreamRef.current = stream;
      
      const source = audioContextRef.current.createMediaStreamSource(stream);
      const recorderNode = new AudioWorkletNode(audioContextRef.current, 'recorder-worklet');
      
      recorderNode.port.onmessage = (e) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(e.data);
        }
      };
      
      source.connect(recorderNode);
      recorderNode.connect(audioContextRef.current.destination);
      recorderNodeRef.current = recorderNode;
      setIsRecording(true);
    } catch (e) {
      logError('Failed to start recording:', e);
    }
  }, [isRecording, connectionState, logError]);

  const stopRecording = useCallback(async () => {
    if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach(t => t.stop());
    if (recorderNodeRef.current) {
      recorderNodeRef.current.disconnect();
      recorderNodeRef.current = null;
    }
    setIsRecording(false);
  }, []);

  useEffect(() => {
    return () => { disconnect(); };
  }, [disconnect]);

  return {
    connectionState,
    messages,
    isRecording,
    error,
    connect,
    disconnect,
    startRecording,
    stopRecording,
  };
}
