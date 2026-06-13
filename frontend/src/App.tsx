import { useState, useEffect, useCallback, useRef } from 'react'
// Coach App Main Component
import { useRealTime } from './hooks/useRealTime'
import type { SystemMessageType, User } from './types'
import './App.css'

declare global {
  interface Window {
    google: any;
    GOOGLE_CLIENT_ID: string;
  }
}

interface PageProps {
  label: string;
  onBack: () => void;
  user: User;
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

function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const [googleLoaded, setGoogleLoaded] = useState(false);

  useEffect(() => {
    const checkGoogle = () => {
      if (window.google) {
        setGoogleLoaded(true);
      } else {
        setTimeout(checkGoogle, 100);
      }
    };
    checkGoogle();
  }, []);

  useEffect(() => {
    const handleCredentialResponse = async (response: any) => {
      console.log('Google credential received, authenticating with backend...');
      try {
        const res = await fetch(`/auth/google`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: response.credential }),
          credentials: 'include',
        });

        const data = await res.json();
        console.log('Backend auth response:', data);

        if (res.ok) {
          console.log('Login successful, calling onLogin...');
          onLogin(data.user);
        } else {
          console.error('Login failed:', data.error);
          alert(data.error || 'Login failed');
        }
      } catch (err) {
        console.error('Network error during login:', err);
        alert('Connection error during login');
      }
    };

    if (googleLoaded && googleButtonRef.current) {
      if (!window.GOOGLE_CLIENT_ID) {
        console.error('GOOGLE_CLIENT_ID is missing');
        return;
      }

      window.google.accounts.id.initialize({
        client_id: window.GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        theme: 'outline',
        size: 'large',
      });
    }
  }, [onLogin, googleLoaded]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="p-8 bg-white dark:bg-gray-800 rounded-2xl shadow-xl flex flex-col items-center gap-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white text-center">
          Welcome to Hands-Free AI Coach
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-center">
          Please sign in with your Google account to continue.
        </p>
        {!window.GOOGLE_CLIENT_ID && (
          <p className="text-red-500 text-sm font-medium">
            Error: GOOGLE_CLIENT_ID is not configured. 
            Please check your environment variables or .env file.
          </p>
        )}
        <div ref={googleButtonRef} />
      </div>
    </div>
  );
}

function App() {
  const [activePage, setActivePage] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  console.log('App State - User:', user, 'Loading:', loading, 'ActivePage:', activePage);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('Checking existing session...');
        const res = await fetch(`/auth/me`, {
          credentials: 'include',
        });
        const data = await res.json();
        console.log('Session check response:', data);
        if (data.authenticated) {
          setUser(data.user);
        }
      } catch (err) {
        console.error('Auth check failed', err);
      } finally {
        setLoading(false);
      }
    };
    void checkAuth();
  }, []);

  const handleLogout = async () => {
    await fetch(`/auth/logout`, { 
      method: 'POST',
      credentials: 'include',
    });
    setUser(null);
    setActivePage(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  if (activePage) {
    return <Page label={activePage} onBack={() => setActivePage(null)} user={user} />
  }

  return (
    <div className="flex-1 w-full flex flex-col items-center justify-center gap-6 bg-gray-50 dark:bg-gray-900">
      <div className="absolute top-4 right-4 flex items-center gap-4">
        <span className="text-gray-600 dark:text-gray-400">{user.email}</span>
        <button
          onClick={handleLogout}
          className="px-3 py-1 bg-gray-200 dark:bg-gray-700 text-sm rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition"
        >
          Logout
        </button>
      </div>
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
