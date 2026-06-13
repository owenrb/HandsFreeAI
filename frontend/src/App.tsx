import { useState, useEffect, useCallback, useRef } from 'react'
// Coach App Main Component
import { useRealTime } from './hooks/useRealTime'
import type { SystemMessageType } from './types'
import './App.css'

interface PageProps {
  label: string;
  onBack: () => void;
}

function Page({ label, onBack }: PageProps) {
  const [availableMicrophones, setAvailableMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const systemMessageType: SystemMessageType = 
    label === 'Articulation Coach' ? 'language-coach' :
    label === 'Software Architect Coach' ? 'software-architecture-coach' :
    'agile-scrum-coach';

  const {
    connectionState,
    messages,
    isRecording,
    error,
    connect,
    startRecording,
  } = useRealTime();

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const getMicrophones = useCallback(async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
      const devices = await navigator.mediaDevices.enumerateDevices();
      const mics = devices.filter(device => device.kind === 'audioinput');
      setAvailableMicrophones(mics);
      if (mics.length > 0) {
        const defaultMic = mics.find(mic => mic.deviceId === 'default' || mic.label.toLowerCase().includes('default'));
        setSelectedMicrophoneId(defaultMic ? defaultMic.deviceId : mics[0].deviceId);
      }
    } catch (err) {
      console.error('Error getting microphones:', err);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      await getMicrophones();
    };
    void init();
  }, [getMicrophones]);

  // Auto-connect on mount
  useEffect(() => {
    if (connectionState === 'disconnected') {
      void connect(systemMessageType);
    }
  }, [connectionState, connect, systemMessageType]);

  // Auto-start recording when connected
  useEffect(() => {
    if (connectionState === 'connected' && !isRecording && selectedMicrophoneId) {
      void startRecording({
        audio: { deviceId: { exact: selectedMicrophoneId } }
      });
    }
  }, [connectionState, isRecording, selectedMicrophoneId, startRecording]);

  return (
    <div className="flex-1 w-full flex flex-col items-center pt-8 px-8 pb-2 bg-gray-50 dark:bg-gray-900 overflow-hidden">
      <div className="w-full max-w-4xl flex justify-between items-center mb-4 shrink-0">
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
        >
          ← Back
        </button>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{label}</h1>
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${
            connectionState === 'connected' ? 'bg-green-500 animate-pulse' : 
            connectionState === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-red-500'
          }`} />
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {connectionState === 'connected' ? 'Live' : connectionState === 'connecting' ? 'Connecting...' : 'Disconnected'}
          </span>
        </div>
      </div>

      <div className="w-full max-w-4xl flex-1 flex flex-col gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl overflow-hidden">
        {/* Toolbar - simplified for hands-free */}
        <div className="flex flex-wrap gap-4 items-center justify-between border-b dark:border-gray-700 pb-4 shrink-0">
          <div className="flex items-center gap-4">
            {isRecording && (
              <div className="flex items-center gap-2 px-3 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full text-sm font-bold">
                <div className="w-2 h-2 bg-red-600 rounded-full animate-ping" />
                Listening
              </div>
            )}
          </div>

          {availableMicrophones.length > 1 && (
            <select
              value={selectedMicrophoneId}
              onChange={(e) => setSelectedMicrophoneId(e.target.value)}
              className="px-3 py-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm"
            >
              {availableMicrophones.map(mic => (
                <option key={mic.deviceId} value={mic.deviceId}>
                  {mic.label || `Microphone ${mic.deviceId.slice(0, 5)}`}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Messages Display */}
        <div className="flex flex-col gap-4 flex-1 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900 rounded-xl">
          {messages.length === 0 && connectionState === 'connected' && (
            <div className="text-gray-400 text-center mt-20">Start speaking to begin your session.</div>
          )}
          {messages.length === 0 && connectionState !== 'connected' && (
            <div className="text-gray-400 text-center mt-20">Connecting to coach...</div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] px-4 py-2 rounded-2xl ${
                msg.type === 'user' 
                  ? 'bg-blue-600 text-white rounded-br-none' 
                  : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow rounded-bl-none'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm shrink-0">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}

function App() {
  const [activePage, setActivePage] = useState<string | null>(null)

  if (activePage) {
    return <Page label={activePage} onBack={() => setActivePage(null)} />
  }

  return (
    <div className="flex-1 w-full flex flex-col items-center justify-center gap-6 bg-gray-50 dark:bg-gray-900">
      <div className="flex gap-4">
        <button
          onClick={() => setActivePage('Articulation Coach')}
          className="px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-opacity-75 transition duration-300 transform hover:scale-105"
        >
          Articulation Coach
        </button>
      </div>
      <div className="flex gap-4">
        <button
          onClick={() => setActivePage('Software Architect Coach')}
          className="px-6 py-3 bg-purple-500 text-white font-semibold rounded-lg shadow-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-opacity-75 transition duration-300 transform hover:scale-105"
        >
          Software Architect Coach
        </button>
      </div>
      <div className="flex gap-4">
        <button
          onClick={() => setActivePage('Agile/Scrum Coach')}
          className="px-6 py-3 bg-indigo-500 text-white font-semibold rounded-lg shadow-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:ring-opacity-75 transition duration-300 transform hover:scale-105"
        >
          Agile/Scrum Coach
        </button>
      </div>
    </div>
  )
}

export default App
