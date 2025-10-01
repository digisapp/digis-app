import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  QuestionMarkCircleIcon,
  CheckIcon,
  ClockIcon,
  HandRaisedIcon,
  MicrophoneIcon,
  SpeakerWaveIcon,
  XMarkIcon,
  ArrowUpIcon,
  ChatBubbleLeftEllipsisIcon,
  HeartIcon,
  StarIcon
} from '@heroicons/react/24/outline';
import { HeartIcon as HeartIconSolid } from '@heroicons/react/24/solid';

const LiveStreamQA = ({ 
  websocket, 
  channelId, 
  isCreator = false, 
  user,
  sessionId 
}) => {
  const [questions, setQuestions] = useState([]);
  const [newQuestion, setNewQuestion] = useState('');
  const [filter, setFilter] = useState('all'); // 'all', 'pending', 'answered'
  const [showAskQuestion, setShowAskQuestion] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const [answerText, setAnswerText] = useState('');
  const [upvotedQuestions, setUpvotedQuestions] = useState(new Set());
  
  const inputRef = useRef(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (websocket) {
      setupWebSocketListeners();
    }
  }, [websocket]);

  useEffect(() => {
    if (showAskQuestion && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showAskQuestion]);

  const setupWebSocketListeners = () => {
    websocket.addEventListener('message', handleWebSocketMessage);
  };

  const handleWebSocketMessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case 'question_asked':
          if (data.question.channelId === channelId) {
            addQuestion(data.question);
          }
          break;
        case 'question_answered':
          if (data.question.channelId === channelId) {
            updateQuestion(data.question);
          }
          break;
        case 'question_upvoted':
          if (data.channelId === channelId) {
            updateQuestionUpvotes(data.questionId, data.upvotes);
          }
          break;
        case 'question_highlighted':
          if (data.channelId === channelId) {
            highlightQuestion(data.questionId);
          }
          break;
        default:
          break;
      }
    } catch (error) {
      console.error('Error parsing Q&A WebSocket message:', error);
    }
  };

  const addQuestion = (questionData) => {
    setQuestions(prev => [questionData, ...prev]);
    scrollToTop();
  };

  const updateQuestion = (updatedQuestion) => {
    setQuestions(prev => prev.map(q => 
      q.questionId === updatedQuestion.questionId ? updatedQuestion : q
    ));
  };

  const updateQuestionUpvotes = (questionId, upvotes) => {
    setQuestions(prev => prev.map(q => 
      q.questionId === questionId ? { ...q, upvotes } : q
    ));
  };

  const highlightQuestion = (questionId) => {
    setQuestions(prev => prev.map(q => 
      q.questionId === questionId ? { ...q, highlighted: true } : q
    ));
    
    // Remove highlight after 5 seconds
    setTimeout(() => {
      setQuestions(prev => prev.map(q => 
        q.questionId === questionId ? { ...q, highlighted: false } : q
      ));
    }, 5000);
  };

  const askQuestion = () => {
    if (!newQuestion.trim()) return;

    const questionData = {
      type: 'ask_question',
      channelId,
      question: newQuestion.trim()
    };

    websocket.send(JSON.stringify(questionData));
    setNewQuestion('');
    setShowAskQuestion(false);
  };

  const answerQuestion = (questionId) => {
    if (!answerText.trim()) return;

    const answerData = {
      type: 'answer_question',
      channelId,
      questionId,
      answer: answerText.trim()
    };

    websocket.send(JSON.stringify(answerData));
    setAnswerText('');
    setSelectedQuestion(null);
  };

  const upvoteQuestion = (questionId) => {
    if (upvotedQuestions.has(questionId)) return;

    const upvoteData = {
      type: 'upvote_question',
      channelId,
      questionId
    };

    websocket.send(JSON.stringify(upvoteData));
    setUpvotedQuestions(prev => new Set([...prev, questionId]));
  };

  const highlightQuestionForAnswer = (questionId) => {
    if (!isCreator) return;

    const highlightData = {
      type: 'highlight_question',
      channelId,
      questionId
    };

    websocket.send(JSON.stringify(highlightData));
  };

  const scrollToTop = () => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  };

  const formatTimeAgo = (timestamp) => {
    const now = new Date();
    const questionTime = new Date(timestamp);
    const diffMs = now - questionTime;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return questionTime.toLocaleDateString();
  };

  const filteredQuestions = questions.filter(question => {
    switch (filter) {
      case 'pending':
        return question.status === 'pending';
      case 'answered':
        return question.status === 'answered';
      default:
        return true;
    }
  });

  const sortedQuestions = [...filteredQuestions].sort((a, b) => {
    // Highlighted questions first
    if (a.highlighted && !b.highlighted) return -1;
    if (!a.highlighted && b.highlighted) return 1;
    
    // Then by upvotes
    const aUpvotes = a.upvotes || 0;
    const bUpvotes = b.upvotes || 0;
    if (aUpvotes !== bUpvotes) return bUpvotes - aUpvotes;
    
    // Finally by time (newest first)
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  const pendingCount = questions.filter(q => q.status === 'pending').length;
  const answeredCount = questions.filter(q => q.status === 'answered').length;

  return (
    <motion.div
      className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden h-full flex flex-col"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <QuestionMarkCircleIcon className="w-6 h-6" />
            <div>
              <h3 className="font-bold text-lg">Live Q&A</h3>
              <p className="text-white/80 text-sm">
                {isCreator ? 'Answer audience questions' : 'Ask questions to the creator'}
              </p>
            </div>
          </div>
          
          {!isCreator && (
            <motion.button
              onClick={() => setShowAskQuestion(true)}
              className="flex items-center gap-2 bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <HandRaisedIcon className="w-5 h-5" />
              <span className="hidden sm:inline">Ask Question</span>
            </motion.button>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 mt-3 text-sm text-white/80">
          <div className="flex items-center gap-1">
            <ClockIcon className="w-4 h-4" />
            <span>{pendingCount} pending</span>
          </div>
          <div className="flex items-center gap-1">
            <CheckIcon className="w-4 h-4" />
            <span>{answeredCount} answered</span>
          </div>
          <div className="flex items-center gap-1">
            <ChatBubbleLeftEllipsisIcon className="w-4 h-4" />
            <span>{questions.length} total</span>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex border-b border-gray-200 bg-gray-50">
        {[
          { key: 'all', label: 'All Questions', count: questions.length },
          { key: 'pending', label: 'Pending', count: pendingCount },
          { key: 'answered', label: 'Answered', count: answeredCount }
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-all ${
              filter === tab.key
                ? 'text-emerald-600 border-b-2 border-emerald-600 bg-white'
                : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Questions List */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {sortedQuestions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <QuestionMarkCircleIcon className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-lg font-medium mb-1">
              {filter === 'pending' ? 'No pending questions' : 
               filter === 'answered' ? 'No answered questions yet' : 
               'No questions yet'}
            </p>
            <p className="text-sm">
              {isCreator 
                ? 'Questions from your audience will appear here'
                : 'Be the first to ask a question!'
              }
            </p>
          </div>
        ) : (
          <AnimatePresence>
            {sortedQuestions.map((question, index) => (
              <motion.div
                key={question.questionId}
                className={`border rounded-xl p-4 transition-all ${
                  question.highlighted 
                    ? 'border-yellow-400 bg-yellow-50 shadow-lg' 
                    : question.status === 'answered'
                    ? 'border-green-200 bg-green-50'
                    : 'border-gray-200 bg-white hover:border-emerald-200 hover:bg-emerald-50'
                }`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                layout
              >
                {/* Question Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">
                        {question.askerUsername}
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatTimeAgo(question.createdAt)}
                      </span>
                      {question.highlighted && (
                        <span className="bg-yellow-200 text-yellow-800 px-2 py-1 rounded-full text-xs font-medium">
                          ⭐ Highlighted
                        </span>
                      )}
                    </div>
                    
                    <p className="text-gray-800 font-medium mb-2">
                      {question.question}
                    </p>
                  </div>

                  {/* Status Badge */}
                  <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                    question.status === 'answered'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {question.status === 'answered' ? (
                      <div className="flex items-center gap-1">
                        <CheckIcon className="w-3 h-3" />
                        Answered
                      </div>
                    ) : (
                      <div className="flex items-center gap-1">
                        <ClockIcon className="w-3 h-3" />
                        Pending
                      </div>
                    )}
                  </div>
                </div>

                {/* Answer */}
                {question.status === 'answered' && question.answer && (
                  <motion.div
                    className="bg-white border border-emerald-200 rounded-lg p-3 mb-3"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.3 }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <SpeakerWaveIcon className="w-4 h-4 text-emerald-600" />
                      <span className="text-sm font-medium text-emerald-600">
                        Creator's Answer
                      </span>
                      <span className="text-xs text-gray-500">
                        {formatTimeAgo(question.answeredAt)}
                      </span>
                    </div>
                    <p className="text-gray-800">{question.answer}</p>
                  </motion.div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {/* Upvote Button */}
                    <motion.button
                      onClick={() => upvoteQuestion(question.questionId)}
                      disabled={upvotedQuestions.has(question.questionId)}
                      className={`flex items-center gap-1 px-3 py-1 rounded-full text-sm transition-all ${
                        upvotedQuestions.has(question.questionId)
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-700'
                      }`}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <ArrowUpIcon className="w-4 h-4" />
                      <span>{question.upvotes || 0}</span>
                    </motion.button>

                    {/* Like Button */}
                    <motion.button
                      className="flex items-center gap-1 px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-600 transition-all"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <HeartIcon className="w-4 h-4" />
                      <span>{question.likes || 0}</span>
                    </motion.button>
                  </div>

                  {/* Creator Actions */}
                  {isCreator && question.status === 'pending' && (
                    <div className="flex items-center gap-2">
                      <motion.button
                        onClick={() => highlightQuestionForAnswer(question.questionId)}
                        className="px-3 py-1 bg-yellow-100 text-yellow-700 rounded-lg text-sm font-medium hover:bg-yellow-200 transition-all"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        ⭐ Highlight
                      </motion.button>
                      <motion.button
                        onClick={() => setSelectedQuestion(question)}
                        className="px-3 py-1 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200 transition-all"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        Answer
                      </motion.button>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Ask Question Modal */}
      <AnimatePresence>
        {showAskQuestion && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl p-6 w-full max-w-md"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">Ask a Question</h3>
                <button
                  onClick={() => setShowAskQuestion(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              <textarea
                ref={inputRef}
                value={newQuestion}
                onChange={(e) => setNewQuestion(e.target.value)}
                placeholder="What would you like to ask the creator?"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl resize-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                rows="4"
                maxLength={500}
              />

              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-gray-500">
                  {newQuestion.length}/500 characters
                </span>
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowAskQuestion(false)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={askQuestion}
                    disabled={!newQuestion.trim()}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Ask Question
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Answer Question Modal */}
      <AnimatePresence>
        {selectedQuestion && isCreator && (
          <motion.div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="bg-white rounded-2xl p-6 w-full max-w-md"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">Answer Question</h3>
                <button
                  onClick={() => {
                    setSelectedQuestion(null);
                    setAnswerText('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <XMarkIcon className="w-6 h-6" />
                </button>
              </div>

              {/* Question */}
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <div className="text-sm text-gray-600 mb-1">
                  Question from {selectedQuestion.askerUsername}:
                </div>
                <p className="font-medium text-gray-900">
                  {selectedQuestion.question}
                </p>
              </div>

              {/* Answer Input */}
              <textarea
                value={answerText}
                onChange={(e) => setAnswerText(e.target.value)}
                placeholder="Type your answer here..."
                className="w-full px-4 py-3 border border-gray-300 rounded-xl resize-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                rows="4"
                maxLength={1000}
              />

              <div className="flex items-center justify-between mt-4">
                <span className="text-sm text-gray-500">
                  {answerText.length}/1000 characters
                </span>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setSelectedQuestion(null);
                      setAnswerText('');
                    }}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => answerQuestion(selectedQuestion.questionId)}
                    disabled={!answerText.trim()}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  >
                    Send Answer
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default LiveStreamQA;