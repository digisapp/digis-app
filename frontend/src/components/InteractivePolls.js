import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../hooks/useTheme';
import { 
  ChartBarIcon, 
  QuestionMarkCircleIcon,
  PlusIcon,
  XMarkIcon,
  CheckIcon,
  ClockIcon,
  UserGroupIcon,
  TrophyIcon,
  HandRaisedIcon
} from '@heroicons/react/24/outline';
import Button from './ui/Button';
import Input from './ui/Input';
import Card from './ui/Card';
import Modal from './ui/Modal';
import { getAuthToken } from '../utils/auth-helpers';

const InteractivePolls = ({ 
  user, 
  channel, 
  isCreator = false, 
  isHost = false,
  className = '' 
}) => {
  const { animations } = useTheme();
  const [activeTab, setActiveTab] = useState('polls');
  const [polls, setPolls] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [showCreateQ, setShowCreateQ] = useState(false);
  const [newPoll, setNewPoll] = useState({
    question: '',
    options: ['', ''],
    duration: 60,
    allowMultiple: false,
    anonymous: true
  });
  const [newQuestion, setNewQuestion] = useState('');
  const [userVotes, setUserVotes] = useState(new Map());
  // eslint-disable-next-line no-unused-vars
  const [questionLikes, setQuestionLikes] = useState(new Map());
  const [isConnected, setIsConnected] = useState(false);

  const rtmChannelRef = useRef(null);

  // Define callback functions before they're used in handleRTMMessage
  const updatePollVotes = useCallback((pollId, _optionIndex, votes) => {
    setPolls(prev => prev.map(poll => 
      poll.id === pollId 
        ? { ...poll, votes, voters: [...poll.voters, user.id] }
        : poll
    ));
  }, [user.id]);

  const endPoll = useCallback(async (pollId) => {
    try {
      const authToken = await getAuthToken();
      await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/polls/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ pollId, channel })
      });

      // Update local state
      setPolls(prev => prev.map(poll => 
        poll.id === pollId ? { ...poll, status: 'ended' } : poll
      ));

      // Broadcast poll end
      if (rtmChannelRef.current) {
        await rtmChannelRef.current.sendMessage({
          text: JSON.stringify({
            type: 'poll_ended',
            pollId
          })
        });
      }
    } catch (error) {
      console.error('Error ending poll:', error);
    }
  }, [user, channel]);

  const updateQuestionLikes = useCallback((questionId, likes) => {
    setQuestions(prev => prev.map(question => 
      question.id === questionId 
        ? { ...question, likes, likedBy: [...question.likedBy, user.id] }
        : question
    ));
  }, [user.id]);

  const markQuestionAnswered = useCallback((questionId, answer) => {
    setQuestions(prev => prev.map(question => 
      question.id === questionId 
        ? { ...question, status: 'answered', answer, answeredAt: Date.now() }
        : question
    ));
  }, []);

  const handleRTMMessage = useCallback((message, memberId) => {
    try {
      const data = JSON.parse(message.text);
      
      switch (data.type) {
        case 'poll_created':
          setPolls(prev => [data.poll, ...prev]);
          break;
        case 'poll_voted':
          updatePollVotes(data.pollId, data.optionIndex, data.votes);
          break;
        case 'poll_ended':
          endPoll(data.pollId);
          break;
        case 'question_submitted':
          setQuestions(prev => [data.question, ...prev]);
          break;
        case 'question_liked':
          updateQuestionLikes(data.questionId, data.likes);
          break;
        case 'question_answered':
          markQuestionAnswered(data.questionId, data.answer);
          break;
        default:
          console.warn('Unknown RTM message type:', data.type);
          break;
      }
    } catch (error) {
      console.error('Error handling RTM message:', error);
    }
  }, [updatePollVotes, endPoll, updateQuestionLikes, markQuestionAnswered]);

  const loadExistingContent = useCallback(async () => {
    try {
      const authToken = await getAuthToken();
      // Load existing polls and questions for this channel
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/live/polls?channel=${channel}`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        setPolls(data.polls || []);
        setQuestions(data.questions || []);
      }
    } catch (error) {
      console.error('Error loading existing content:', error);
    }
  }, [user, channel]);

  const initializeRTM = useCallback(async () => {
    if (!channel || !user || !window.AgoraRTM) return;

    try {
      const rtmClient = window.AgoraRTM.createInstance(import.meta.env.VITE_AGORA_APP_ID);
      
      const authToken = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/agora/rtm-token?uid=${user.id}`,
        {
          headers: { Authorization: `Bearer ${authToken}` }
        }
      );

      if (response.ok) {
        const data = await response.json();
        await rtmClient.login({ token: data.rtmToken, uid: user.id });
        
        const rtmChannel = rtmClient.createChannel(`${channel}_polls`);
        rtmChannelRef.current = rtmChannel;
        await rtmChannel.join();
        
        rtmChannel.on('ChannelMessage', handleRTMMessage);
        setIsConnected(true);
        
        // Load existing polls and questions
        loadExistingContent();
      }
    } catch (error) {
      console.error('RTM initialization error:', error);
    }
  }, [channel, user, handleRTMMessage, loadExistingContent]);

  useEffect(() => {
    // Connect to RTM for real-time updates
    initializeRTM();
    return () => cleanup();
  }, [channel, user, initializeRTM]);

  const cleanup = () => {
    if (rtmChannelRef.current) {
      rtmChannelRef.current.leave();
      rtmChannelRef.current = null;
    }
    setIsConnected(false);
  };

  const createPoll = async () => {
    if (!newPoll.question.trim() || newPoll.options.some(opt => !opt.trim())) {
      alert('Please fill in all fields');
      return;
    }

    try {
      const pollData = {
        id: `poll_${Date.now()}`,
        question: newPoll.question.trim(),
        options: newPoll.options.filter(opt => opt.trim()).map(opt => opt.trim()),
        duration: newPoll.duration,
        allowMultiple: newPoll.allowMultiple,
        anonymous: newPoll.anonymous,
        createdBy: user.id,
        creatorName: user.displayName || user.email.split('@')[0],
        createdAt: Date.now(),
        expiresAt: Date.now() + (newPoll.duration * 1000),
        votes: new Array(newPoll.options.filter(opt => opt.trim()).length).fill(0),
        voters: [],
        status: 'active'
      };

      // Save to backend
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/polls/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ ...pollData, channel })
      });

      if (response.ok) {
        // Broadcast to RTM
        if (rtmChannelRef.current) {
          await rtmChannelRef.current.sendMessage({
            text: JSON.stringify({
              type: 'poll_created',
              poll: pollData
            })
          });
        }

        // Reset form
        setNewPoll({
          question: '',
          options: ['', ''],
          duration: 60,
          allowMultiple: false,
          anonymous: true
        });
        setShowCreatePoll(false);

        // Auto-end poll after duration
        setTimeout(() => {
          endPoll(pollData.id);
        }, pollData.duration * 1000);
      }
    } catch (error) {
      console.error('Error creating poll:', error);
      alert('Failed to create poll');
    }
  };

  const votePoll = async (pollId, optionIndex) => {
    const poll = polls.find(p => p.id === pollId);
    if (!poll || poll.status !== 'active') return;

    // Check if user already voted
    if (!poll.allowMultiple && poll.voters.includes(user.id)) {
      alert('You have already voted in this poll');
      return;
    }

    try {
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/polls/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          pollId,
          optionIndex,
          userId: user.id,
          channel
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update local state
        setUserVotes(prev => new Map(prev).set(pollId, optionIndex));
        
        // Broadcast vote update
        if (rtmChannelRef.current) {
          await rtmChannelRef.current.sendMessage({
            text: JSON.stringify({
              type: 'poll_voted',
              pollId,
              optionIndex,
              votes: data.votes
            })
          });
        }
      }
    } catch (error) {
      console.error('Error voting:', error);
      alert('Failed to vote');
    }
  };

  const submitQuestion = async () => {
    if (!newQuestion.trim()) return;

    try {
      const questionData = {
        id: `question_${Date.now()}`,
        question: newQuestion.trim(),
        submittedBy: user.id,
        submitterName: user.displayName || user.email.split('@')[0],
        submittedAt: Date.now(),
        likes: 0,
        likedBy: [],
        status: 'pending',
        answer: null,
        answeredBy: null,
        answeredAt: null
      };

      // Save to backend
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/questions/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({ ...questionData, channel })
      });

      if (response.ok) {
        // Broadcast to RTM
        if (rtmChannelRef.current) {
          await rtmChannelRef.current.sendMessage({
            text: JSON.stringify({
              type: 'question_submitted',
              question: questionData
            })
          });
        }

        setNewQuestion('');
        setShowCreateQ(false);
      }
    } catch (error) {
      console.error('Error submitting question:', error);
      alert('Failed to submit question');
    }
  };

  const likeQuestion = async (questionId) => {
    const question = questions.find(q => q.id === questionId);
    if (!question || question.likedBy.includes(user.id)) return;

    try {
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/questions/like`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          questionId,
          userId: user.id,
          channel
        })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update local state
        setQuestionLikes(prev => new Map(prev).set(questionId, data.likes));
        
        // Broadcast like update
        if (rtmChannelRef.current) {
          await rtmChannelRef.current.sendMessage({
            text: JSON.stringify({
              type: 'question_liked',
              questionId,
              likes: data.likes
            })
          });
        }
      }
    } catch (error) {
      console.error('Error liking question:', error);
    }
  };

  const answerQuestion = async (questionId, answer) => {
    if (!isCreator && !isHost) return;

    try {
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/questions/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`
        },
        body: JSON.stringify({
          questionId,
          answer: answer.trim(),
          answeredBy: user.id,
          channel
        })
      });

      if (response.ok) {
        // Broadcast answer
        if (rtmChannelRef.current) {
          await rtmChannelRef.current.sendMessage({
            text: JSON.stringify({
              type: 'question_answered',
              questionId,
              answer: answer.trim()
            })
          });
        }
      }
    } catch (error) {
      console.error('Error answering question:', error);
    }
  };

  const addPollOption = () => {
    if (newPoll.options.length < 6) {
      setNewPoll(prev => ({
        ...prev,
        options: [...prev.options, '']
      }));
    }
  };

  const removePollOption = (index) => {
    if (newPoll.options.length > 2) {
      setNewPoll(prev => ({
        ...prev,
        options: prev.options.filter((_, i) => i !== index)
      }));
    }
  };

  const updatePollOption = (index, value) => {
    setNewPoll(prev => ({
      ...prev,
      options: prev.options.map((opt, i) => i === index ? value : opt)
    }));
  };

  const PollCard = ({ poll }) => {
    const isActive = poll.status === 'active';
    const hasVoted = userVotes.has(poll.id) || poll.voters.includes(user.id);
    const totalVotes = poll.votes.reduce((sum, count) => sum + count, 0);
    const timeRemaining = Math.max(0, poll.expiresAt - Date.now());

    return (
      <Card className="space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-2">{poll.question}</h3>
            <div className="flex items-center gap-4 text-sm text-neutral-600 dark:text-neutral-400">
              <span className="flex items-center gap-1">
                <UserGroupIcon className="w-4 h-4" />
                {totalVotes} votes
              </span>
              {isActive && (
                <span className="flex items-center gap-1">
                  <ClockIcon className="w-4 h-4" />
                  {Math.ceil(timeRemaining / 1000)}s left
                </span>
              )}
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {isActive ? 'Active' : 'Ended'}
              </span>
            </div>
          </div>
          
          {(isCreator || isHost) && isActive && (
            <Button
              size="xs"
              variant="ghost"
              onClick={() => endPoll(poll.id)}
              icon={<XMarkIcon className="w-4 h-4" />}
            />
          )}
        </div>

        <div className="space-y-3">
          {poll.options.map((option, index) => {
            const voteCount = poll.votes[index] || 0;
            const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;
            const userVoted = userVotes.get(poll.id) === index;

            return (
              <motion.div
                key={index}
                className={`relative p-3 rounded-lg border cursor-pointer transition-all ${
                  hasVoted
                    ? userVoted
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-neutral-200 dark:border-neutral-700'
                    : isActive
                    ? 'border-neutral-200 dark:border-neutral-700 hover:border-primary-300'
                    : 'border-neutral-200 dark:border-neutral-700 opacity-60'
                }`}
                onClick={() => isActive && !hasVoted && votePoll(poll.id, index)}
                whileHover={animations && isActive && !hasVoted ? { scale: 1.02 } : {}}
                whileTap={animations && isActive && !hasVoted ? { scale: 0.98 } : {}}
              >
                <div className="flex items-center justify-between relative z-10">
                  <span className="font-medium">{option}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{voteCount}</span>
                    <span className="text-xs text-neutral-500">({percentage.toFixed(1)}%)</span>
                    {userVoted && <CheckIcon className="w-4 h-4 text-primary-500" />}
                  </div>
                </div>
                
                {hasVoted && (
                  <motion.div
                    className="absolute inset-0 bg-primary-100 dark:bg-primary-900/30 rounded-lg"
                    initial={{ width: 0 }}
                    animate={{ width: `${percentage}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                  />
                )}
              </motion.div>
            );
          })}
        </div>

        <div className="text-xs text-neutral-500 dark:text-neutral-400">
          Created by {poll.creatorName} • {new Date(poll.createdAt).toLocaleTimeString()}
        </div>
      </Card>
    );
  };

  const QuestionCard = ({ question }) => {
    const hasLiked = question.likedBy?.includes(user.id);
    const [showAnswerInput, setShowAnswerInput] = useState(false);
    const [answerText, setAnswerText] = useState('');

    return (
      <Card className="space-y-3">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-lg mb-2">{question.question}</h3>
            <div className="flex items-center gap-4 text-sm text-neutral-600 dark:text-neutral-400">
              <span>by {question.submitterName}</span>
              <span>{new Date(question.submittedAt).toLocaleTimeString()}</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                question.status === 'answered' 
                  ? 'bg-green-100 text-green-800'
                  : 'bg-yellow-100 text-yellow-800'
              }`}>
                {question.status === 'answered' ? 'Answered' : 'Pending'}
              </span>
            </div>
          </div>
        </div>

        {question.answer && (
          <div className="bg-primary-50 dark:bg-primary-900/20 p-4 rounded-lg">
            <h4 className="font-semibold text-sm mb-2 flex items-center gap-2">
              <TrophyIcon className="w-4 h-4 text-primary-500" />
              Answer:
            </h4>
            <p className="text-sm">{question.answer}</p>
            <p className="text-xs text-neutral-500 mt-2">
              Answered at {new Date(question.answeredAt).toLocaleTimeString()}
            </p>
          </div>
        )}

        <div className="flex items-center justify-between">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => likeQuestion(question.id)}
            disabled={hasLiked}
            className="flex items-center gap-2"
          >
            <HandRaisedIcon className={`w-4 h-4 ${hasLiked ? 'text-primary-500' : ''}`} />
            {question.likes || 0}
          </Button>

          {(isCreator || isHost) && question.status !== 'answered' && (
            <Button
              size="sm"
              onClick={() => setShowAnswerInput(!showAnswerInput)}
            >
              Answer
            </Button>
          )}
        </div>

        {showAnswerInput && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="space-y-3"
          >
            <Input
              value={answerText}
              onChange={(e) => setAnswerText(e.target.value)}
              placeholder="Type your answer..."
              multiline
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  answerQuestion(question.id, answerText);
                  setAnswerText('');
                  setShowAnswerInput(false);
                }}
                disabled={!answerText.trim()}
              >
                Submit Answer
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAnswerInput(false)}
              >
                Cancel
              </Button>
            </div>
          </motion.div>
        )}
      </Card>
    );
  };

  return (
    <div className={`flex flex-col h-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-xl ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          <ChartBarIcon className="w-5 h-5 text-primary-500" />
          <h3 className="font-semibold text-lg">Interactive Features</h3>
          <div className="flex items-center gap-1 text-xs text-neutral-500">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span>{isConnected ? 'Live' : 'Offline'}</span>
          </div>
        </div>

        {(isCreator || isHost) && (
          <div className="flex gap-2">
            <Button
              size="xs"
              onClick={() => setShowCreatePoll(true)}
              icon={<PlusIcon className="w-4 h-4" />}
            >
              Poll
            </Button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-200 dark:border-neutral-800">
        <button
          onClick={() => setActiveTab('polls')}
          className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
            activeTab === 'polls'
              ? 'border-b-2 border-primary-500 text-primary-600'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          <ChartBarIcon className="w-4 h-4 inline mr-2" />
          Polls ({polls.length})
        </button>
        <button
          onClick={() => setActiveTab('qa')}
          className={`flex-1 py-3 px-4 text-sm font-medium transition-colors ${
            activeTab === 'qa'
              ? 'border-b-2 border-primary-500 text-primary-600'
              : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200'
          }`}
        >
          <QuestionMarkCircleIcon className="w-4 h-4 inline mr-2" />
          Q&A ({questions.length})
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'polls' ? (
          <div className="space-y-4">
            {polls.length === 0 ? (
              <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
                <ChartBarIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No polls yet</p>
                {(isCreator || isHost) && (
                  <Button
                    className="mt-4"
                    onClick={() => setShowCreatePoll(true)}
                  >
                    Create First Poll
                  </Button>
                )}
              </div>
            ) : (
              polls.map((poll) => (
                <PollCard key={poll.id} poll={poll} />
              ))
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Submit Question */}
            <Card className="bg-neutral-50 dark:bg-neutral-800/50">
              <div className="flex gap-3">
                <Input
                  value={newQuestion}
                  onChange={(e) => setNewQuestion(e.target.value)}
                  placeholder="Ask a question..."
                  className="flex-1"
                  onKeyPress={(e) => e.key === 'Enter' && submitQuestion()}
                />
                <Button
                  onClick={submitQuestion}
                  disabled={!newQuestion.trim()}
                  size="sm"
                >
                  Submit
                </Button>
              </div>
            </Card>

            {questions.length === 0 ? (
              <div className="text-center py-8 text-neutral-500 dark:text-neutral-400">
                <QuestionMarkCircleIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>No questions yet</p>
                <p className="text-sm">Be the first to ask a question!</p>
              </div>
            ) : (
              questions
                .sort((a, b) => (b.likes || 0) - (a.likes || 0))
                .map((question) => (
                  <QuestionCard key={question.id} question={question} />
                ))
            )}
          </div>
        )}
      </div>

      {/* Create Poll Modal */}
      <Modal
        isOpen={showCreatePoll}
        onClose={() => setShowCreatePoll(false)}
        title="Create Poll"
        size="md"
      >
        <div className="space-y-6">
          <Input
            label="Poll Question"
            value={newPoll.question}
            onChange={(e) => setNewPoll(prev => ({ ...prev, question: e.target.value }))}
            placeholder="What would you like to ask?"
          />

          <div>
            <label className="block text-sm font-medium mb-3">Options</label>
            <div className="space-y-2">
              {newPoll.options.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    value={option}
                    onChange={(e) => updatePollOption(index, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    className="flex-1"
                  />
                  {newPoll.options.length > 2 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => removePollOption(index)}
                      icon={<XMarkIcon className="w-4 h-4" />}
                    />
                  )}
                </div>
              ))}
              {newPoll.options.length < 6 && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={addPollOption}
                  icon={<PlusIcon className="w-4 h-4" />}
                >
                  Add Option
                </Button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Duration (seconds)</label>
              <Input
                type="number"
                value={newPoll.duration}
                onChange={(e) => setNewPoll(prev => ({ ...prev, duration: parseInt(e.target.value) }))}
                min="10"
                max="300"
              />
            </div>
            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newPoll.allowMultiple}
                  onChange={(e) => setNewPoll(prev => ({ ...prev, allowMultiple: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm">Allow multiple votes</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={newPoll.anonymous}
                  onChange={(e) => setNewPoll(prev => ({ ...prev, anonymous: e.target.checked }))}
                  className="rounded"
                />
                <span className="text-sm">Anonymous voting</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3">
            <Button onClick={createPoll} className="flex-1">
              Create Poll
            </Button>
            <Button variant="ghost" onClick={() => setShowCreatePoll(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default InteractivePolls;