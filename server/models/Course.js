import mongoose from "mongoose";

const QuizQuestionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: [{ type: String }],
  correct: { type: Number, required: true }, // index of correct option
  explanation: { type: String },
});

const LessonSchema = new mongoose.Schema({
  title: { type: String, required: true },
  summary: { type: String },
  concepts: [{ type: String }],
  explanation: { type: String },
  examples: [{ type: String }],
  transcript: { type: String }, // raw transcript chunk for this lesson
  quiz: [QuizQuestionSchema],
});

const CourseSchema = new mongoose.Schema(
  {
    videoId: { type: String, required: true },
    courseKey: { type: String, required: true, index: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, required: true },
    url: { type: String, required: true },
    thumbnail: { type: String },
    description: { type: String },
    lessons: [LessonSchema],
    status: {
      type: String,
      enum: ["processing", "ready", "error"],
      default: "processing",
    },
    errorMessage: { type: String },
    warningMessage: { type: String },
    quizCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model("Course", CourseSchema);
