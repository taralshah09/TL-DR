import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import api from '../services/api'
import Navbar from '../components/Navbar'
import QuizEngine from '../components/QuizEngine'
import './CoursePage.css'

export default function StandaloneQuizPage() {
  const { id, quizId } = useParams() // course id, quiz id
  const navigate = useNavigate()
  const [quiz, setQuiz] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchQuiz = useCallback(async () => {
    try {
      const { data } = await api.get(`/quiz/${quizId}`)
      setQuiz(data.quiz)
    } catch (err) {
      console.error('Error fetching quiz:', err)
    } finally {
      setLoading(false)
    }
  }, [quizId])

  useEffect(() => {
    fetchQuiz()
  }, [fetchQuiz])

  if (loading) return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    </div>
  )

  if (!quiz) return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Navbar />
      <div className="flex-1 flex flex-col items-center justify-center space-y-4">
        <p className="font-bold text-zinc-400 uppercase tracking-widest">Quiz not found</p>
        <button onClick={() => navigate(`/course/${id}/quizzes`)} className="px-6 py-2 bg-primary rounded-full font-bold uppercase text-[10px]">Back to Quizzes</button>
      </div>
    </div>
  )

  return (
    <div className="bg-surface text-accent min-h-screen flex flex-col font-sans">
      <Navbar />
      
      <main className="max-w-4xl mx-auto w-full p-8">
        <div className="bg-white border border-zinc-200 rounded-[32px] overflow-hidden shadow-xl p-8">
            <QuizEngine 
              quiz={quiz.questions}
              quizId={quizId}
              lessonTitle={quiz.title}
              onBack={() => navigate(`/course/${id}/quizzes`)}
            />
        </div>
      </main>
    </div>
  )
}
