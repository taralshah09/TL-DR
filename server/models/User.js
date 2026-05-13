import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const UserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    gemini: {
      apiKey: { type: String, default: "" }
    },
    groq: {
      apiKey: { type: String, default: "" }
    },
    openrouter: {
      apiKey: { type: String, default: "" }
    },
    transcriptCount: { type: Number, default: 0 },
    quizUsage: {
      type: Map,
      of: Number,
      default: {},
    },
  },
  { timestamps: true }
);

// Hash password before saving
UserSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Compare password method
UserSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model("User", UserSchema);
