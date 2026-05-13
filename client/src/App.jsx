import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage'
import DashboardPage from './pages/DashboardPage'
import CoursePage from './pages/CoursePage'
import Login from './pages/Login'
import Signup from './pages/Signup'
import BYOK from './pages/BYOK'
import QuizzesPage from './pages/QuizzesPage'
import StandaloneQuizPage from './pages/StandaloneQuizPage'

import { AuthProvider, useAuth } from './context/AuthContext'
import { Navigate } from 'react-router-dom'
import World404 from './pages/World404'

const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" />
  return children
}

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/course/:id"
          element={
            <ProtectedRoute>
              <CoursePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/course/:id/quizzes"
          element={
            <ProtectedRoute>
              <QuizzesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/course/:id/quiz/:quizId"
          element={
            <ProtectedRoute>
              <StandaloneQuizPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/byok"
          element={
            <ProtectedRoute>
              <BYOK />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<World404 />} />
      </Routes>
    </AuthProvider>
  )
}

export default App
