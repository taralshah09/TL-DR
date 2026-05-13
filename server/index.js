import "dotenv/config";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";


// Controllers
import {
  generateCourse,
  getAllCourses,
  getCourseById,
  getCourseStatus,
  deleteCourse,
} from "./controllers/courseController.js";
import { chat, getChatHistory } from "./controllers/chatController.js";
import { submitQuiz, createStandaloneQuiz, getQuizzesByVideo, submitStandaloneQuiz, getQuizById, deleteQuiz, updateQuizTitle } from "./controllers/quizController.js";




import {
  sendSignupOTP,
  registerUser,
  authUser,
  getUserProfile,
  logoutUser,
  updateApiKeys,
} from "./controllers/authController.js";
import { protect } from "./middlewares/authMiddleware.js";

const app = express();
app.set("trust proxy", 1);

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(
  cors({
    origin: ["http://localhost:5173", "https://do-tldr.vercel.app", "https://dotldr.app", "https://www.dotldr.app"],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

// DB
mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch((err) => console.error("❌ MongoDB error:", err));

// Rate Limiter for OTP requests
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 OTP requests per window
  message: "Too many OTP requests from this IP, please try again after 15 minutes",
});

// Routes
app.get("/", (req, res) => res.json({ message: "TL;DR API 🚀" }));

// Auth
app.post("/api/auth/send-otp", otpLimiter, sendSignupOTP);
app.post("/api/auth/register", registerUser);
app.post("/api/auth/login", authUser);
app.post("/api/auth/logout", logoutUser);
app.get("/api/auth/profile", protect, getUserProfile);
app.put("/api/auth/api-keys", protect, updateApiKeys);

// Courses
app.post("/api/courses/generate", protect, generateCourse);
app.get("/api/courses", protect, getAllCourses);
app.get("/api/courses/status/:id", protect, getCourseStatus);
app.get("/api/courses/:id", protect, getCourseById);
app.delete("/api/courses/:id", protect, deleteCourse);

// Chat
app.post("/api/chat", protect, chat);
app.get("/api/chat/:courseId", protect, getChatHistory);

// Quiz
app.post("/api/quiz/submit", protect, submitQuiz);
app.post("/api/quiz/create", protect, createStandaloneQuiz);
app.get("/api/quiz/video/:videoId", protect, getQuizzesByVideo);
app.get("/api/quiz/:id", protect, getQuizById);
app.delete("/api/quiz/:id", protect, deleteQuiz);
app.put("/api/quiz/:id/title", protect, updateQuizTitle);
app.post("/api/quiz/standalone/submit", protect, submitStandaloneQuiz);





const PORT = process.env.PORT || 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server running on http://localhost:${PORT}`)
);