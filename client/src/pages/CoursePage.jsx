import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import api from '../services/api'
import Navbar from '../components/Navbar'
import QuizEngine from '../components/QuizEngine'
import ChatWidget from '../components/ChatWidget'
import MarkdownRenderer from '../components/MarkdownRenderer'
import Loader from '../components/Loader'
import Modal from '../components/Modal'
import './CoursePage.css'

export default function CoursePage() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [course, setCourse] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showErrorModal, setShowErrorModal] = useState(false)
  const [activeLesson, setActiveLesson] = useState(0)
  const [view, setView] = useState('lesson') // 'lesson' | 'quiz'
  const [isCreatingQuiz, setIsCreatingQuiz] = useState(false)


  const fetchCourse = useCallback(async () => {
    try {
      const { data } = await api.get(`/courses/${id}`)
      setCourse(data.course)
      if (data.course.status === 'error') {
        setError(data.course.errorMessage || 'Course generation failed.')
        setShowErrorModal(true)
      }
    } catch {
      setError('Course not found.')
      setShowErrorModal(true)
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    fetchCourse()
  }, [fetchCourse])

  useEffect(() => {
    if (!course || course.status !== 'processing') return
    const interval = setInterval(fetchCourse, 5000)
    return () => clearInterval(interval)
  }, [course, fetchCourse])

  const handleCreateQuiz = async () => {
    if (!window.confirm("Create a new AI-generated quiz for this video?")) return;
    setIsCreatingQuiz(true);
    try {
      const { data } = await api.post('/quiz/create', { 
        videoId: course.videoId
      });

      alert('Quiz created successfully!');
      navigate(`/course/${id}/quizzes`);
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.error || 'Failed to create quiz.';
      alert(msg);
    } finally {
      setIsCreatingQuiz(false);
    }

  }


  if (loading) return <>
    <Navbar />
    <div className="flex-1 flex items-center justify-center p-20">
      <div className="text-center space-y-6">
        <div className="w-16 h-16 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
        <p className="text-lg font-bold uppercase tracking-widest text-gray-400">Loading Course...</p>
      </div>
    </div>
  </>

  if (error) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <Modal
        isOpen={showErrorModal}
        title="Oops! Something went wrong"
        message={error}
        onButtonClick={() => navigate('/')}
        buttonText="Back to Home"
      />
      <div className="max-w-2xl mx-auto mt-20 p-8 bg-white rounded-3xl border border-red-100 shadow-xl text-center">
        <h2 className="text-2xl font-black text-red-500 mb-4 uppercase tracking-tighter">⚠️ {error}</h2>
        <p className="text-gray-500 mb-8 font-medium">We encountered an issue while loading your course.</p>
        <Link to="/" className="inline-block px-10 py-4 bg-dark text-white rounded-full font-bold uppercase tracking-widest text-xs hover:bg-gray-800 transition-all">
          Back to Home
        </Link>
      </div>
    </div>
  )

  if (course.status === 'processing') return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <div className="flex-1 flex items-center justify-center p-10">
        <div className="max-w-md w-full bg-white p-12 rounded-[32px] shadow-2xl border border-white text-center space-y-8">
           <div className="relative">
              <div className="w-24 h-24 border-[6px] border-primary/20 border-t-primary rounded-full animate-spin mx-auto"></div>
              <div className="absolute inset-0 flex items-center justify-center text-2xl">✨</div>
           </div>
           <div>
              <h2 className="text-3xl font-black text-dark tracking-tighter uppercase mb-2">Generating...</h2>
              <p className="text-sm font-medium text-gray-400 leading-relaxed">Our AI is reading the transcript and building your curriculum. This usually takes 30-60 seconds.</p>
           </div>
           <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
             <div className="h-full bg-primary animate-[shimmer_2s_infinite_linear]" style={{ width: '60%' }}></div>
           </div>
        </div>
      </div>
    </div>
  )

  const lesson = course.lessons[activeLesson]

  return (
    <div className="bg-surface text-accent min-h-screen flex flex-col font-sans lg:h-screen lg:overflow-hidden">
      <Navbar />
      
      <main className="course-layout-v2">
        {/* Column 1: Curriculum & Concepts */}
        <section className="col-left">
          {/* Lessons List */}
          <div className="bg-white border border-zinc-200 rounded-custom flex flex-col overflow-hidden shadow-sm lg:h-1/2">
            <div className="p-6 border-b border-zinc-100">
              <h2 className="font-display font-extrabold text-xl uppercase italic tracking-tight">Curriculum</h2>
              <p className="text-[10px] font-bold text-zinc-400 uppercase mt-1 truncate">{course.title}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 scrollbar-thin scrollbar-thumb-zinc-200">
              {course.lessons.map((l, i) => (
                <div 
                  key={i}
                  onClick={() => { setActiveLesson(i); setView('lesson') }}
                  className={`p-4 rounded-2xl cursor-pointer transition-all border ${
                    activeLesson === i 
                    ? 'bg-primary border-black/5 shadow-sm' 
                    : 'bg-zinc-50 border-transparent hover:border-zinc-200'
                  }`}
                >
                  <span className={`text-[10px] font-black block mb-1 ${activeLesson === i ? 'opacity-50' : 'text-zinc-400'}`}>
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className={`font-bold text-sm ${activeLesson === i ? 'text-black' : 'text-zinc-600'}`}>{l.title}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Concept Cards (Examples) */}
          {lesson.examples?.length > 0 && (
            <div className="bg-white border border-zinc-200 rounded-custom flex flex-col overflow-hidden shadow-sm lg:h-1/2">
              <div className="p-6 border-b border-zinc-100">
                <h4 className="font-display font-black text-xs uppercase tracking-[0.2em] text-zinc-400">Concept Cards</h4>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-zinc-200">
                {lesson.examples.map((ex, i) => (
                  <div key={i} className="p-4 bg-zinc-50 border border-zinc-100 rounded-2xl flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-white border border-zinc-200 flex items-center justify-center text-[10px] font-black shrink-0 shadow-sm">{i + 1}</span>
                    <p className="text-zinc-600 font-medium text-xs leading-relaxed">{ex}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-4 bg-white border border-zinc-200 rounded-custom shadow-sm">
            <button 
              onClick={async () => {
                if (window.confirm("Delete this course?")) {
                  await api.delete(`/courses/${id}`);
                  navigate('/');
                }
              }}
              className="w-full py-3 text-[10px] font-bold uppercase tracking-widest text-red-400 hover:text-red-500 hover:bg-red-50 transition-all rounded-xl"
            >
              Delete Course
            </button>
          </div>
        </section>

        {/* Column 2: Content Area */}
        <section className="col-middle relative">
          {/* Header with Video Link and Quiz Actions */}
          <div className="p-4 bg-white border-b border-zinc-100 flex items-center justify-between sticky top-0 z-10">
            <a 
              href={course.url} 
              target="_blank" 
              rel="noreferrer" 
              className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 hover:opacity-80"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
              Watch Original Video
            </a>
            
            <div className="flex flex-col items-end gap-1">
              <div className="flex gap-2">
                <button 
                  onClick={handleCreateQuiz}
                  disabled={isCreatingQuiz}
                  className="px-4 py-2 bg-zinc-900 text-white text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-zinc-800 transition-all disabled:opacity-50"
                >
                  {isCreatingQuiz ? 'Generating...' : 'Create New Quiz'}
                </button>
                <Link 
                  to={`/course/${id}/quizzes`}
                  className="px-4 py-2 bg-primary text-black text-[10px] font-black uppercase tracking-widest rounded-full hover:brightness-105 transition-all"
                >
                  View Quizzes
                </Link>
              </div>
              <p className="text-[8px] font-bold text-zinc-400 uppercase tracking-tighter mr-2">Limit: 3 quizzes per video</p>
            </div>
          </div>


          <div className="flex-1 overflow-y-auto p-8 pb-32 scrollbar-thin scrollbar-thumb-zinc-200">

            {view === 'lesson' ? (
              <div className="space-y-8 animate-in fade-in duration-500">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 bg-primary text-accent text-[10px] font-black rounded-full uppercase tracking-tighter">Lesson {activeLesson + 1}</span>
                    {course.lessons[activeLesson].quiz?.length > 0 && (
                      <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest">Quiz Available</span>
                    )}
                  </div>
                  <h1 className="font-display text-4xl md:text-5xl font-extrabold tracking-tighter uppercase leading-none text-accent">
                    {lesson.title}
                  </h1>
                  {lesson.summary && (
                    <div className="p-6 bg-zinc-50 border-l-4 border-primary rounded-r-3xl">
                      <p className="text-zinc-600 italic font-medium">{lesson.summary}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-6 text-accent font-medium text-lg leading-relaxed prose prose-zinc max-w-none prose-headings:text-accent prose-headings:font-black prose-headings:tracking-tighter prose-headings:uppercase prose-p:text-zinc-600">
                  <MarkdownRenderer content={lesson.explanation} />
                </div>
              </div>
            ) : (
              <div className="h-full">
                <QuizEngine
                  quiz={lesson.quiz}
                  courseId={id}
                  lessonIndex={activeLesson}
                  lessonTitle={lesson.title}
                  onBack={() => setView('lesson')}
                />
              </div>
            )}
          </div>


        </section>

        {/* Column 3: AI Chat Interface */}
        <section className="col-right">
          <ChatWidget courseId={id} />
        </section>

      </main>
    </div>
  )
}
