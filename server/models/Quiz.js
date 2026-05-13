import mongoose from "mongoose";

const QuizQuestionSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: [{ type: String }],
  correct: { type: Number, required: true }, // index of correct option
  explanation: { type: String },
});

const QuizSchema = new mongoose.Schema(
  {
    videoId: { type: String, required: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    title: { type: String, required: true },
    questions: [QuizQuestionSchema],
  },
  { timestamps: true }
);

export default mongoose.model("Quiz", QuizSchema);
