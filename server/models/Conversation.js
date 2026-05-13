import mongoose from "mongoose";

const ConversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: false, // Optional for global chats
    },
    title: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Conversation", ConversationSchema);
