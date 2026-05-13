import { useState, useEffect } from 'react'

import api from '../services/api'
import './QuizEngine.css'

export default function QuizEngine({ quiz, courseId, lessonIndex, lessonTitle, onBack, quizId }) {

  const [answers, setAnswers] = useState({})
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [currentQ, setCurrentQ] = useState(0)
  const [shuffledQuiz, setShuffledQuiz] = useState([])

  useEffect(() => {
    if (quiz && quiz.length > 0) {
      const shuffled = [...quiz].sort(() => Math.random() - 0.5)
      setShuffledQuiz(shuffled)
    }
  }, [quiz])


  const selectAnswer = (qIndex, optIndex) => {
    if (result) return // locked after submit
    setAnswers(prev => ({ ...prev, [qIndex]: optIndex }))
  }

  const handleSubmit = async () => {
    if (Object.keys(answers).length < quiz.length) {
      alert('Please answer all questions before submitting.')
      return
    }
    setLoading(true)
    try {
      const answersArr = shuffledQuiz.map((_, i) => answers[i] ?? -1)
      
      let endpoint = '/quiz/submit'
      let payload = { courseId, lessonIndex, answers: answersArr }

      if (quizId) {
        endpoint = '/quiz/standalone/submit'
        payload = { quizId, answers: answersArr }
      }

      const { data } = await api.post(endpoint, payload)


      setResult(data)
      setCurrentQ(0)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleRetry = () => {
    setAnswers({})
    setResult(null)
    setCurrentQ(0)
  }

  // Results screen
  if (result) {
    const pct = result.percentage
    const grade = pct >= 80 ? '🏆 Excellent!' : pct >= 60 ? '👍 Good job!' : '📖 Keep learning!'
    return (
      <div className="quiz-engine animate-in fade-in duration-500">
        <div className="quiz-score-header">
          <div className="quiz-score-circle">
            <span className="quiz-score-num">{pct}%</span>
            <span className="quiz-score-label">{result.score}/{result.total}</span>
          </div>
          <h2 className="score-title">{grade}</h2>
          <p className="score-message">You completed <strong>{lessonTitle}</strong></p>
        </div>

        <div className="quiz-results-list">
          {result.results.map((r, i) => (
            <div key={i} className={`quiz-result-item ${r.isCorrect ? 'correct' : 'incorrect'}`}>
              <div className="quiz-result-header">
                <div className="quiz-result-icon">{r.isCorrect ? '✓' : '✗'}</div>
                <div>
                  <span className="quiz-q-num">Question {i + 1}</span>
                  <p className="quiz-q-text">{r.question}</p>
                </div>
              </div>
              <div className="quiz-result-options">
                {r.options.map((opt, oi) => (
                  <div key={oi} className={`result-option ${oi === r.correct ? 'is-correct' : ''} ${oi === r.selected && !r.isCorrect ? 'is-wrong' : ''}`}>
                    {opt}
                  </div>
                ))}
              </div>
              <div className="quiz-explanation">
                <span>💡</span> {r.explanation}
              </div>
            </div>
          ))}
        </div>

        <div className="quiz-actions">
          <button className="btn-quiz btn-secondary-quiz" onClick={handleRetry}>🔄 Retry Quiz</button>
          <button className="btn-quiz btn-primary-quiz" onClick={onBack}>
            {quizId ? 'Back to Quizzes' : 'Back to Lesson'}
          </button>
        </div>
      </div>
    )
  }

  if (shuffledQuiz.length === 0) return null

  // Questions screen
  const q = shuffledQuiz[currentQ]
  const totalAnswered = Object.keys(answers).length

  return (
    <div className="quiz-engine animate-in fade-in duration-500">
      <div className="quiz-top">
        <button className="text-[10px] font-black uppercase tracking-widest text-zinc-400 hover:text-zinc-600" onClick={onBack}>← Back to Course</button>
        <span className="quiz-progress-text">Question {currentQ + 1} of {shuffledQuiz.length}</span>
      </div>

      <div className="quiz-progress-bar">
        <div className="progress-fill" style={{ width: `${((currentQ + 1) / shuffledQuiz.length) * 100}%` }}></div>
      </div>

      <div className="quiz-question-card">
        <h3 className="quiz-question">{q.question}</h3>
        <div className="quiz-options">
          {q.options.map((opt, oi) => (
            <button
              key={oi}
              className={`quiz-option ${answers[currentQ] === oi ? 'selected' : ''}`}
              onClick={() => selectAnswer(currentQ, oi)}
            >
              <span className="option-letter">{String.fromCharCode(65 + oi)}</span>
              <span>{opt}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="quiz-nav">
        <button
          className="btn-quiz btn-secondary-quiz"
          onClick={() => setCurrentQ(q => Math.max(0, q - 1))}
          disabled={currentQ === 0}
        >
          Previous
        </button>

        {currentQ < shuffledQuiz.length - 1 ? (
          <button
            className="btn-quiz btn-primary-quiz"
            onClick={() => setCurrentQ(q => q + 1)}
            disabled={answers[currentQ] === undefined}
          >
            Next Question
          </button>
        ) : (
          <button
            className="btn-quiz btn-primary-quiz"
            onClick={handleSubmit}
            disabled={loading || totalAnswered < shuffledQuiz.length}
          >
            {loading ? 'Analyzing...' : `Finish Quiz (${totalAnswered}/${shuffledQuiz.length})`}
          </button>
        )}
      </div>
    </div>
  )
}

