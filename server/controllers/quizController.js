import Course from "../models/Course.js";
import Quiz from "../models/Quiz.js";
import { generateQuiz } from "../ai/ContentGenerator.js";
import { fetchTranscript, joinTranscript } from "../services/transcriptService.js";


// POST /api/quiz/submit
export async function submitQuiz(req, res) {
  try {
    const { courseId, lessonIndex, answers } = req.body;
    // answers: array of selected option indices [0,2,1,3,0]

    if (!courseId || lessonIndex === undefined || !Array.isArray(answers)) {
      return res.status(400).json({ error: "courseId, lessonIndex, and answers are required" });
    }

    const course = await Course.findById(courseId);
    if (!course) return res.status(404).json({ error: "Course not found" });

    const lesson = course.lessons[lessonIndex];
    if (!lesson) return res.status(404).json({ error: "Lesson not found" });

    const quiz = lesson.quiz;
    let score = 0;
    const results = quiz.map((q, i) => {
      const selected = answers[i] ?? -1;
      const isCorrect = selected === q.correct;
      if (isCorrect) score++;
      return {
        question: q.question,
        options: q.options,
        selected,
        correct: q.correct,
        isCorrect,
        explanation: q.explanation,
      };
    });

    res.json({
      score,
      total: quiz.length,
      percentage: Math.round((score / quiz.length) * 100),
      results,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/quiz/create
export async function createStandaloneQuiz(req, res) {
  try {
    const { videoId, title } = req.body;
    if (!videoId) return res.status(400).json({ error: "videoId is required" });

    // Rate limit: Max 3 quizzes per video per user
    const count = await Quiz.countDocuments({ videoId, userId: req.user._id });
    if (count >= 3) {
      return res.status(403).json({ error: "You've reached the limit of 3 quizzes for this video." });
    }

    // Fetch transcript to generate quiz

    const transcriptData = await fetchTranscript(videoId);
    const fullText = joinTranscript(transcriptData.items);

    const questions = await generateQuiz(title || "Quiz", fullText, req.user);

    // Create a unique name if no title provided
    const finalTitle = title || `Quiz #${count + 1}`;



    const quiz = new Quiz({
      videoId,
      userId: req.user._id,
      title: finalTitle,
      questions,
    });


    await quiz.save();
    res.status(201).json({ quiz });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/quiz/video/:videoId
export async function getQuizzesByVideo(req, res) {
  try {
    const { videoId } = req.params;
    const quizzes = await Quiz.find({ videoId, userId: req.user._id }).sort({ createdAt: -1 });
    res.json({ quizzes });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// GET /api/quiz/:id
export async function getQuizById(req, res) {
  try {
    const quiz = await Quiz.findOne({ _id: req.params.id, userId: req.user._id });
    if (!quiz) return res.status(404).json({ error: "Quiz not found" });
    res.json({ quiz });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/quiz/standalone/submit
export async function submitStandaloneQuiz(req, res) {
  try {
    const { quizId, answers } = req.body;
    if (!quizId || !Array.isArray(answers)) {
      return res.status(400).json({ error: "quizId and answers are required" });
    }

    const quiz = await Quiz.findById(quizId);
    if (!quiz) return res.status(404).json({ error: "Quiz not found" });

    let score = 0;
    const results = quiz.questions.map((q, i) => {
      const selected = answers[i] ?? -1;
      const isCorrect = selected === q.correct;
      if (isCorrect) score++;
      return {
        question: q.question,
        options: q.options,
        selected,
        correct: q.correct,
        isCorrect,
        explanation: q.explanation,
      };
    });

    res.json({
      score,
      total: quiz.questions.length,
      percentage: Math.round((score / quiz.questions.length) * 100),
      results,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// DELETE /api/quiz/:id
export async function deleteQuiz(req, res) {
  try {
    const quiz = await Quiz.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    if (!quiz) return res.status(404).json({ error: "Quiz not found" });
    res.json({ message: "Quiz deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PUT /api/quiz/:id/title
export async function updateQuizTitle(req, res) {
  try {
    const { title } = req.body;
    if (!title) return res.status(400).json({ error: "Title is required" });

    const quiz = await Quiz.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { title },
      { new: true }
    );
    if (!quiz) return res.status(404).json({ error: "Quiz not found" });
    res.json({ quiz });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
