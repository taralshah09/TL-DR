import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../services/api'
import Navbar from '../components/Navbar'
import './CoursePage.css' // Reuse some styles

export default function QuizzesPage() {
  const { id } = useParams() // course id
  const [quizzes, setQuizzes] = useState([])
  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchData = useCallback(async () => {
    try {
      const courseRes = await api.get(`/courses/${id}`)
      setCourse(courseRes.data.course)
      
      const quizRes = await api.get(`/quiz/video/${courseRes.data.course.videoId}`)
      setQuizzes(quizRes.data.quizzes)
    } catch (err) {
      console.error('Error fetching quizzes:', err)
    } finally {
      setLoading(false)
    }
  }, [id])

  const handleDelete = async (quizId) => {
    if (!window.confirm("Are you sure you want to delete this quiz?")) return;
    try {
      await api.delete(`/quiz/${quizId}`);
      setQuizzes(quizzes.filter(q => q._id !== quizId));
    } catch (err) {
      console.error('Delete failed:', err);
      alert('Failed to delete quiz.');
    }
  }

  const handleEditTitle = async (quizId, currentTitle) => {
    const newTitle = window.prompt("Enter new quiz title:", currentTitle);
    if (!newTitle || newTitle === currentTitle) return;
    try {
      const { data } = await api.put(`/quiz/${quizId}/title`, { title: newTitle });
      setQuizzes(quizzes.map(q => q._id === quizId ? data.quiz : q));
    } catch (err) {
      console.error('Update failed:', err);
      alert('Failed to update title.');
    }
  }


  useEffect(() => {
    fetchData()
  }, [fetchData])

  if (loading) return (
    <div className="min-h-screen bg-surface flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin w-10 h-10 border-4 border-primary border-t-transparent rounded-full"></div>
      </div>
    </div>
  )

  return (
    <div className="bg-surface text-accent min-h-screen flex flex-col font-sans">
      <Navbar />
      
      <main className="max-w-4xl mx-auto w-full p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <Link to={`/course/${id}`} className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-primary transition-colors flex items-center gap-2">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
              Back to Course
            </Link>
            <h1 className="font-display text-4xl font-extrabold tracking-tighter uppercase mt-2">All Quizzes</h1>
            <p className="text-zinc-500 font-medium">{course?.title}</p>
          </div>
        </div>

        <div className="grid gap-4">
          {quizzes.length === 0 ? (
            <div className="bg-white border border-zinc-200 rounded-[32px] p-12 text-center space-y-4">
              <div className="text-4xl">📝</div>
              <p className="font-bold text-zinc-400 uppercase tracking-widest text-sm">No standalone quizzes created yet.</p>
            </div>
          ) : (
            quizzes.map((quiz) => (
              <div key={quiz._id} className="bg-white border border-zinc-200 rounded-[32px] p-6 flex items-center justify-between hover:border-primary transition-all shadow-sm">
                <div className="flex-1">
                  <h3 className="font-display font-black text-xl uppercase tracking-tight">{quiz.title}</h3>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase">{quiz.questions.length} Questions • {new Date(quiz.createdAt).toLocaleDateString()}</p>
                  <div className="flex gap-4 mt-2">
                    <button 
                      onClick={() => handleEditTitle(quiz._id, quiz.title)}
                      className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-600 transition-colors"
                    >
                      Edit Title
                    </button>
                    <button 
                      onClick={() => handleDelete(quiz._id)}
                      className="text-[10px] font-black uppercase tracking-widest text-red-300 hover:text-red-500 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <Link 
                  to={`/course/${id}/quiz/${quiz._id}`}
                  className="px-6 py-3 bg-primary text-black font-black uppercase text-[10px] tracking-widest rounded-full hover:brightness-105 transition-all"
                >
                  Take Quiz
                </Link>

              </div>
            ))
          )}
        </div>
      </main>
    </div>
  )
}
