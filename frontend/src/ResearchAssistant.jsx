
import React, { useState } from "react";
import ReactMarkdown from "react-markdown";

import {
  Bot,
  Send,
  Sparkles,
  AlertCircle,
  LoaderCircle
} from "lucide-react";

import "./ResearchAssistant.css";


// ==========================================
// 1. SUGGESTED RESEARCH QUESTIONS
// ==========================================

const SUGGESTED_QUESTIONS = [
  "Why is rNVDA's session correlation so high?",
  "How closely does rTSLA track Tesla?",
  "Explain the difference between UTC and NYSE alignment.",
  "What are the limitations of this research?"
];


// ==========================================
// 2. MAIN AI COMPONENT
// ==========================================

export default function ResearchAssistant() {

  const [question, setQuestion] = useState("");

  const [messages, setMessages] = useState([]);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");


  // ========================================
  // 3. SEND A QUESTION TO FASTAPI
  // ========================================

  async function sendQuestion() {

    const userQuestion = question.trim();

    if (userQuestion.length < 3 || loading) {
      return;
    }

    setError("");
    setLoading(true);
    setQuestion("");

    // Display the user's question
    setMessages((previous) => [
      ...previous,
      {
        role: "user",
        content: userQuestion
      }
    ]);

    try {

      const response = await fetch(
        "/api/ai/chat",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json"
          },

          body: JSON.stringify({
            question: userQuestion
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "AI request failed"
        );
      }

      if (!data.answer) {
        throw new Error(
          "Gemini returned an empty response"
        );
      }

      // Display the AI-generated explanation
      setMessages((previous) => [
        ...previous,
        {
          role: "assistant",
          content: data.answer,
          source: data.source,
          model: data.model
        }
      ]);

    } catch (err) {

      setError(
        err.message || "Unable to reach the AI service"
      );

    } finally {

      setLoading(false);

    }
  }


  // ========================================
  // 4. HANDLE QUESTION SUBMISSION
  // ========================================

  function handleSubmit(event) {

    event.preventDefault();

    sendQuestion();

  }


  // ========================================
  // 5. RENDER AI CHAT INTERFACE
  // ========================================

  return (
    <section
      id="ai-research"
      className="ai-research-container"
    >

      {/* HEADER */}

      <div className="ai-research-header">

        <div className="ai-research-title">

          <div className="ai-research-logo">
            <Bot size={24} />
          </div>

          <div>
            <span className="ai-research-label">
              NEXUS ALPHA INTELLIGENCE
            </span>

            <h2>AI Research Assistant</h2>

            <p>
              Gemini-powered explanations of
              historical cross-market research.
            </p>
          </div>

        </div>

        <span className="ai-research-status">
          <span className="ai-research-status-dot" />
          Gemini Cloud AI
        </span>

      </div>


      {/* EMPTY STATE */}

      {messages.length === 0 && (

        <div className="ai-research-welcome">

          <Sparkles size={30} />

          <h3>Ask about your research</h3>

          <p>
            Explore historical correlations,
            tokenized stock tracking,
            and market-session alignment.
          </p>

          <div className="ai-research-suggestions">

            {SUGGESTED_QUESTIONS.map((item) => (

              <button
                key={item}
                type="button"
                disabled={loading}
                onClick={() => {
                  setQuestion(item);
                }}
              >
                {item}
              </button>

            ))}

          </div>

        </div>

      )}


      {/* CONVERSATION */}

      <div
        className="ai-research-messages"
        aria-live="polite"
      >

        {messages.map((message, index) => (

          <div
            key={index}
            className={
              `ai-research-message ${message.role}`
            }
          >

            <div className="ai-research-avatar">

              {message.role === "assistant" ? (
                <Bot size={18} />
              ) : (
                <span>YOU</span>
              )}

            </div>

            <div className="ai-research-bubble">

              {message.role === "assistant" ? (

                <div className="ai-research-markdown">
                  <ReactMarkdown>
                    {message.content}
                  </ReactMarkdown>
                </div>

              ) : (

                <p>{message.content}</p>

              )}

              {message.role === "assistant" && (
                <small>
                  AI-generated explanation ·
                  {" "}{message.model}
                </small>
              )}

            </div>

          </div>

        ))}


        {/* LOADING MESSAGE */}

        {loading && (

          <div className="ai-research-message assistant">

            <div className="ai-research-avatar">
              <Bot size={18} />
            </div>

            <div className="ai-research-loading">
              <LoaderCircle
                size={18}
                className="ai-research-spinner"
              />

              Analyzing research context...
            </div>

          </div>

        )}

      </div>


      {/* ERROR MESSAGE */}

      {error && (

        <div
          className="ai-research-error"
          role="alert"
        >
          <AlertCircle size={17} />
          {error}
        </div>

      )}


      {/* QUESTION INPUT */}

      <form
        className="ai-research-form"
        onSubmit={handleSubmit}
      >

        <textarea
          value={question}
          onChange={(event) => {
            setQuestion(event.target.value);
          }}
          maxLength={500}
          rows={3}
          placeholder={
            "Ask Gemini about your historical research..."
          }
          aria-label="Research question"
          disabled={loading}
        />

        <div className="ai-research-form-footer">

          <span>
            Historical research only ·
            No trading recommendations
          </span>

          <button
            type="submit"
            disabled={
              loading ||
              question.trim().length < 3
            }
          >
            <Send size={16} />
            Ask Gemini
          </button>

        </div>

      </form>

      <p className="ai-research-disclaimer">
        Responses are AI-generated from NEXUS ALPHA
        research reports. Verify important claims
        against the source data. Each question
        is evaluated independently.
      </p>

    </section>
  );
}
