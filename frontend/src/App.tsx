import { useState } from 'react'
import './App.css'

interface PageProps {
  label: string;
  onBack: () => void;
}

function Page({ label, onBack }: PageProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4">
      <h1 className="text-5xl font-bold mb-8 text-gray-900 dark:text-white">
        {label}
      </h1>
      <button
        onClick={onBack}
        className="px-8 py-3 bg-gray-600 text-white font-bold rounded-xl shadow-lg hover:bg-gray-800 focus:outline-none focus:ring-4 focus:ring-gray-300 transition duration-300 transform hover:scale-105"
      >
        Back to Home
      </button>
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
