import { useState, useEffect, useCallback } from 'react'
import { useRealTime } from './hooks/useRealTime'
import type { SystemMessageType } from './types'
import './App.css'

interface PageProps {
  label: string;
  onBack: () => void;
}

function Page({ label, onBack }: PageProps) {
  const [currentMessage, setCurrentMessage] = useState('');
  const [availableMicrophones, setAvailableMicrophones] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicrophoneId, setSelectedMicrophoneId] = useState('');
  
  const systemMessageType: SystemMessageType = 
    label === 'Articulation Coach' ? 'language-coach' :
    label === 'Software Architect Coach' ? 'software-architecture-coach' :
    'agile-scrum-coach';

  const {
    connectionState,
    messages,
    isRecording,
    isAudioOn,
    error,
    connect,
    disconnect,
    startRecording,
    stopRecording,
    sendMessage,
    toggleAudio
  } = useRealTime();

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

  const handleConnect = async () => {
    if (connectionState === 'connected') {
      await disconnect();
    } else {
      await connect(systemMessageType);
    }
  };

  const handleToggleRecording = async () => {
    if (isRecording) {
      await stopRecording();
    } else {
      await startRecording({
        audio: { deviceId: selectedMicrophoneId ? { exact: selectedMicrophoneId } : undefined }
      });
    }
  };

  const handleSendMessage = async () => {
    if (currentMessage.trim()) {
      await sendMessage(currentMessage);
      setCurrentMessage('');
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen p-8 bg-gray-50 dark:bg-gray-900">
      <div className="w-full max-w-4xl flex justify-between items-center mb-8">
        <button
          onClick={onBack}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
        >
          ← Back
        </button>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{label}</h1>
        <div className="w-20"></div> {/* Spacer */}
      </div>

      <div className="w-full max-w-4xl flex flex-col gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-xl">
        {/* Toolbar Logic Implementation */}
        <div className="flex flex-wrap gap-4 items-center justify-between border-b dark:border-gray-700 pb-4">
          <div className="flex gap-2">
            <button
              onClick={handleConnect}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                connectionState === 'connected' 
                  ? 'bg-red-500 hover:bg-red-600 text-white' 
                  : 'bg-green-500 hover:bg-green-600 text-white'
              }`}
            >
              {connectionState === 'connected' ? 'Disconnect' : connectionState === 'connecting' ? 'Connecting...' : 'Connect'}
            </button>

            <button
              onClick={handleToggleRecording}
              disabled={connectionState !== 'connected'}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                isRecording 
                  ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                  : 'bg-blue-500 hover:bg-blue-600 text-white'
              } disabled:opacity-50`}
            >
              {isRecording ? 'Stop Recording' : 'Start Recording'}
            </button>

            <button
              onClick={toggleAudio}
              className={`px-4 py-2 rounded-lg font-semibold transition ${
                isAudioOn ? 'bg-gray-200 dark:bg-gray-700' : 'bg-yellow-500 text-white'
              }`}
            >
              {isAudioOn ? 'Audio On' : 'Audio Off'}
            </button>
          </div>

          {availableMicrophones.length > 1 && (
            <select
              value={selectedMicrophoneId}
              onChange={(e) => setSelectedMicrophoneId(e.target.value)}
              className="px-3 py-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600 dark:text-white"
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
        <div className="flex flex-col gap-4 h-96 overflow-y-auto p-4 bg-gray-50 dark:bg-gray-900 rounded-xl">
          {messages.length === 0 && (
            <div className="text-gray-400 text-center mt-20">No messages yet. Connect to start.</div>
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
        </div>

        {/* Message Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={currentMessage}
            onChange={(e) => setCurrentMessage(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            placeholder="Type a message..."
            disabled={connectionState !== 'connected'}
            className="flex-1 px-4 py-2 rounded-lg border dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
          <button
            onClick={handleSendMessage}
            disabled={connectionState !== 'connected' || !currentMessage.trim()}
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            Send
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">
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
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 bg-gray-50 dark:bg-gray-900">
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
