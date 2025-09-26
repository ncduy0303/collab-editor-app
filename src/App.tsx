import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import HomePage from './pages/HomePage';
import RoomPage from './pages/RoomPage';
import './App.css'

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <div className="app">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/room/:id" element={<RoomPage />} />
          </Routes>
        </div>
      </Router>
    </ErrorBoundary>
  )
}

export default App
