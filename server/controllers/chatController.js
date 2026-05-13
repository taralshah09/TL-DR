import Chat from "../models/Chat.js";
import Course from "../models/Course.js";
import Conversation from "../models/Conversation.js";
import { answerQuestion } from "../ai/ContentGenerator.js";
import { retrieve } from "../ai/RAGService.js";

// GET /api/conversations
export async function getConversations(req, res) {
  try {
    const conversations = await Conversation.find({ userId: req.user._id })
      .sort({ updatedAt: -1 })
      .lean();
    res.json({ conversations });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/conversations
export async function createConversation(req, res) {
  try {
    const { title, courseId } = req.body;
    const conversation = await Conversation.create({
      userId: req.user._id,
      courseId: courseId || null,
      title: title || "New Chat",
    });
    res.json({ conversation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// DELETE /api/conversations/:id
export async function deleteConversation(req, res) {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    // Delete all messages belonging to this conversation
    await Chat.deleteMany({ conversationId: req.params.id });
    await Conversation.deleteOne({ _id: req.params.id });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// PUT /api/conversations/:id/title
export async function renameConversation(req, res) {
  try {
    const { title } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: "Title is required" });

    const conversation = await Conversation.findOneAndUpdate(
      { _id: req.params.id, userId: req.user._id },
      { title: title.trim() },
      { new: true }
    );
    if (!conversation) return res.status(404).json({ error: "Conversation not found" });

    res.json({ conversation });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// POST /api/chat
export async function chat(req, res) {
  try {
    const { courseId, conversationId, message } = req.body;
    if (!message) {
      return res.status(400).json({ error: "message is required" });
    }

    let transcriptContext = "";
    
    // If courseId is provided, load context for RAG
    if (courseId) {
      const course = await Course.findOne({ _id: courseId, userId: req.user._id });
      if (course) {
        // Build chunk list from lesson transcripts for RAG retrieval
        const chunks = course.lessons
          .filter((l) => l.transcript || l.summary)
          .map((l, i) => ({
            chunkIndex: i,
            text: `[Lesson ${i + 1}: ${l.title}]\n${l.transcript || l.summary}`,
          }));

        // Use RAG to retrieve only the most relevant chunks
        try {
          transcriptContext = await retrieve(message, courseId, chunks, 3);
        } catch (ragErr) {
          console.warn("[Chat] RAG retrieval failed, using fallback context:", ragErr.message);
          transcriptContext = chunks
            .slice(0, 3)
            .map((c) => c.text)
            .join("\n\n---\n\n");
        }
      }
    }

    // Load recent chat history
    let historyQuery = { userId: req.user._id };
    if (conversationId) {
      historyQuery.conversationId = conversationId;
    } else if (courseId) {
      historyQuery.courseId = courseId;
      historyQuery.conversationId = { $exists: false }; // fallback for legacy chats
    }

    const history = await Chat.find(historyQuery)
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    const historyOrdered = history.reverse();

    // Save user message
    await Chat.create({
      conversationId: conversationId || null,
      courseId: courseId || null,
      userId: req.user._id,
      role: "user",
      content: message,
    });

    let warning = null;
    let userKeyFailed = false;
    const onUserKeyFailure = async (reason) => {
      if (userKeyFailed) return;
      userKeyFailed = true;
      await import("../models/User.js").then(({ default: User }) => 
        User.findByIdAndUpdate(req.user._id, { $unset: { "gemini.apiKey": "" } })
      ).catch(e => console.error("User key unset error:", e.message));
      warning = `⚠️ **Notice:** Your personal API key failed (${reason}). We've fallen back to the system default key.`;
    };

    // Get answer from AI
    const answer = await answerQuestion(message, transcriptContext, historyOrdered, req.user, onUserKeyFailure);

    // Save assistant message
    await Chat.create({
      conversationId: conversationId || null,
      courseId: courseId || null,
      userId: req.user._id,
      role: "assistant",
      content: answer,
    });

    // Update conversation title if it's the first message
    if (conversationId && history.length === 0) {
      await Conversation.findByIdAndUpdate(conversationId, { title: message.substring(0, 50) });
    }
    // Update conversation timestamp
    if (conversationId) {
      await Conversation.findByIdAndUpdate(conversationId, { updatedAt: new Date() });
    }

    res.json({ answer, warning });
  } catch (err) {
    console.error("Chat error:", err.message);
    res.status(500).json({ error: err.message });
  }
}

// GET /api/chat/:id  — load chat history (id can be courseId or conversationId)
export async function getChatHistory(req, res) {
  try {
    const { id } = req.params;
    let query = { userId: req.user._id };

    // Try finding by conversationId first
    const isConversation = await Conversation.exists({ _id: id });
    if (isConversation) {
      query.conversationId = id;
    } else {
      query.courseId = id;
      query.conversationId = { $exists: false }; // Legacy chats
    }

    const messages = await Chat.find(query)
      .sort({ createdAt: 1 })
      .lean();
    res.json({ messages });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
