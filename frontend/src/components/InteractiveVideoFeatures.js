import React, { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { getAuthToken } from '../utils/auth-helpers';

const LivePoll = ({ user, channel, onClose, isHost }) => {
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [activePoll, setActivePoll] = useState(null);
  const [votes, setVotes] = useState({});
  const [hasVoted, setHasVoted] = useState(false);
  const [loading, setLoading] = useState(false);

  const addOption = () => {
    if (options.length < 6) {
      setOptions([...options, '']);
    }
  };

  const removeOption = (index) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== index);
      setOptions(newOptions);
    }
  };

  const updateOption = (index, value) => {
    const newOptions = [...options];
    newOptions[index] = value;
    setOptions(newOptions);
  };

  const createPoll = async () => {
    if (!question.trim() || options.some(opt => !opt.trim())) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    try {
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/polls/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          channel,
          question: question.trim(),
          options: options.filter(opt => opt.trim()),
          duration: 300 // 5 minutes
        }),
      });

      if (response.ok) {
        const poll = await response.json();
        setActivePoll(poll);
        setQuestion('');
        setOptions(['', '']);
        // toast.success('Poll created! 📊');
      } else {
        toast.error('Failed to create poll');
      }
    } catch (error) {
      console.error('Poll creation error:', error);
      toast.error('Failed to create poll');
    } finally {
      setLoading(false);
    }
  };

  const vote = async (optionIndex) => {
    if (hasVoted) return;

    setLoading(true);
    try {
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/polls/vote`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          pollId: activePoll.id,
          optionIndex
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setVotes(result.votes);
        setHasVoted(true);
        // toast.success('Vote submitted! 🗳️');
      } else {
        toast.error('Failed to vote');
      }
    } catch (error) {
      console.error('Voting error:', error);
      toast.error('Failed to vote');
    } finally {
      setLoading(false);
    }
  };

  const endPoll = async () => {
    try {
      const authToken = await getAuthToken();
      await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/polls/end`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ pollId: activePoll.id }),
      });

      setActivePoll(null);
      setHasVoted(false);
      setVotes({});
      // toast.success('Poll ended');
    } catch (error) {
      toast.error('Failed to end poll');
    }
  };

  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      border: '1px solid #e1e5e9'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          📊 Live Poll
        </h3>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: '#666'
          }}
        >
          ×
        </button>
      </div>

      {!activePoll ? (
        isHost ? (
          <div>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Poll Question
              </label>
              <input
                type="text"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="What would you like to ask?"
                style={{
                  width: '100%',
                  padding: '12px',
                  border: '1px solid #e1e5e9',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}
                maxLength={200}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
                Options
              </label>
              {options.map((option, index) => (
                <div key={index} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                  <input
                    type="text"
                    value={option}
                    onChange={(e) => updateOption(index, e.target.value)}
                    placeholder={`Option ${index + 1}`}
                    style={{
                      flex: 1,
                      padding: '10px',
                      border: '1px solid #e1e5e9',
                      borderRadius: '6px',
                      fontSize: '14px'
                    }}
                    maxLength={100}
                  />
                  {options.length > 2 && (
                    <button
                      onClick={() => removeOption(index)}
                      style={{
                        padding: '10px',
                        backgroundColor: '#dc3545',
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        cursor: 'pointer'
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
              
              {options.length < 6 && (
                <button
                  onClick={addOption}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: '#6c757d',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px'
                  }}
                >
                  + Add Option
                </button>
              )}
            </div>

            <button
              onClick={createPoll}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px',
                backgroundColor: loading ? '#6c757d' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Creating...' : 'Start Poll'}
            </button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', color: '#666', padding: '40px 20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>📊</div>
            <div>Waiting for the host to start a poll...</div>
          </div>
        )
      ) : (
        <div>
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 16px 0', fontSize: '16px' }}>
              {activePoll.question}
            </h4>
            
            {!hasVoted ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activePoll.options.map((option, index) => (
                  <button
                    key={index}
                    onClick={() => vote(index)}
                    disabled={loading}
                    style={{
                      padding: '12px 16px',
                      backgroundColor: '#f8f9fa',
                      border: '1px solid #e1e5e9',
                      borderRadius: '8px',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      textAlign: 'left',
                      fontSize: '14px',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      if (!loading) {
                        e.target.style.backgroundColor = '#e9ecef';
                      }
                    }}
                    onMouseLeave={(e) => {
                      e.target.style.backgroundColor = '#f8f9fa';
                    }}
                  >
                    {option}
                  </button>
                ))}
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: '12px', fontSize: '14px', color: '#28a745', fontWeight: '500' }}>
                  ✅ You voted! Here are the results:
                </div>
                {activePoll.options.map((option, index) => {
                  const voteCount = votes[index] || 0;
                  const totalVotes = Object.values(votes).reduce((sum, count) => sum + count, 0);
                  const percentage = totalVotes > 0 ? (voteCount / totalVotes) * 100 : 0;

                  return (
                    <div key={index} style={{ marginBottom: '8px' }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '4px',
                        fontSize: '14px'
                      }}>
                        <span>{option}</span>
                        <span>{voteCount} votes ({percentage.toFixed(1)}%)</span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '6px',
                        backgroundColor: '#e9ecef',
                        borderRadius: '3px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${percentage}%`,
                          height: '100%',
                          backgroundColor: '#007bff',
                          transition: 'width 0.3s ease'
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {isHost && (
            <button
              onClick={endPoll}
              style={{
                width: '100%',
                padding: '10px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              End Poll
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const QuestionsQueue = ({ user, channel, onClose, isHost }) => {
  const [question, setQuestion] = useState('');
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    try {
      const authToken = await getAuthToken();
      const response = await fetch(
        `${import.meta.env.VITE_BACKEND_URL}/api/questions/${channel}`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setQuestions(data.questions || []);
      }
    } catch (error) {
      console.error('Failed to load questions:', error);
    }
  };

  const submitQuestion = async () => {
    if (!question.trim()) {
      toast.error('Please enter a question');
      return;
    }

    setLoading(true);
    try {
      const authToken = await getAuthToken();
      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/questions/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          channel,
          question: question.trim()
        }),
      });

      if (response.ok) {
        setQuestion('');
        // toast.success('Question submitted! 🙋');
        loadQuestions();
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Failed to submit question');
      }
    } catch (error) {
      console.error('Question submission error:', error);
      toast.error('Failed to submit question');
    } finally {
      setLoading(false);
    }
  };

  const answerQuestion = async (questionId) => {
    try {
      const authToken = await getAuthToken();
      await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/questions/answer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ questionId }),
      });

      // toast.success('Question marked as answered');
      loadQuestions();
    } catch (error) {
      toast.error('Failed to answer question');
    }
  };

  const prioritizeQuestion = async (questionId, priority) => {
    try {
      const authToken = await getAuthToken();
      await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/questions/prioritize`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        body: JSON.stringify({ questionId, priority }),
      });

      loadQuestions();
    } catch (error) {
      toast.error('Failed to prioritize question');
    }
  };

  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      border: '1px solid #e1e5e9',
      maxHeight: '500px',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          🙋 Q&A Queue ({questions.length})
        </h3>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: '#666'
          }}
        >
          ×
        </button>
      </div>

      {!isHost && (
        <div style={{ marginBottom: '20px' }}>
          <div style={{
            display: 'flex',
            gap: '8px'
          }}>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question..."
              style={{
                flex: 1,
                padding: '12px',
                border: '1px solid #e1e5e9',
                borderRadius: '8px',
                fontSize: '14px'
              }}
              maxLength={500}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submitQuestion();
                }
              }}
            />
            <button
              onClick={submitQuestion}
              disabled={loading || !question.trim()}
              style={{
                padding: '12px 16px',
                backgroundColor: loading || !question.trim() ? '#6c757d' : '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: loading || !question.trim() ? 'not-allowed' : 'pointer',
                fontSize: '14px'
              }}
            >
              {loading ? '...' : 'Ask'}
            </button>
          </div>
          <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
            {question.length}/500 characters
          </div>
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {questions.length === 0 ? (
          <div style={{ textAlign: 'center', color: '#666', padding: '40px 20px' }}>
            <div style={{ fontSize: '48px', marginBottom: '16px' }}>🙋</div>
            <div>No questions yet</div>
            {!isHost && <div style={{ fontSize: '14px', marginTop: '8px' }}>Be the first to ask!</div>}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {questions.map((q, index) => (
              <div
                key={q.id}
                style={{
                  padding: '16px',
                  backgroundColor: q.status === 'answered' ? '#f8f9fa' : '#fff',
                  border: `1px solid ${q.priority === 'high' ? '#ffc107' : '#e1e5e9'}`,
                  borderRadius: '8px',
                  position: 'relative'
                }}
              >
                {q.priority === 'high' && (
                  <div style={{
                    position: 'absolute',
                    top: '-6px',
                    left: '12px',
                    backgroundColor: '#ffc107',
                    color: '#000',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: 'bold'
                  }}>
                    PRIORITY
                  </div>
                )}

                <div style={{ marginBottom: '8px' }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>
                    {q.question}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>
                    By: {q.user_name} • {new Date(q.created_at).toLocaleTimeString()}
                    {q.status === 'answered' && (
                      <span style={{ color: '#28a745', marginLeft: '8px' }}>✅ Answered</span>
                    )}
                  </div>
                </div>

                {isHost && q.status !== 'answered' && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => answerQuestion(q.id)}
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Mark Answered
                    </button>
                    {q.priority !== 'high' && (
                      <button
                        onClick={() => prioritizeQuestion(q.id, 'high')}
                        style={{
                          padding: '6px 12px',
                          backgroundColor: '#ffc107',
                          color: '#000',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '12px'
                        }}
                      >
                        Prioritize
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const WhiteboardCollaboration = ({ user, channel, onClose, isHost }) => {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('pen');
  const [color, setColor] = useState('#000000');
  const [brushSize, setBrushSize] = useState(3);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set canvas size
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    
    // Set drawing properties
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, []);

  const startDrawing = (e) => {
    if (!isHost) return; // Only host can draw for now
    setIsDrawing(true);
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!isDrawing || !isHost) return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const ctx = canvas.getContext('2d');
    ctx.lineWidth = brushSize;
    ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    if (!isHost) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      border: '1px solid #e1e5e9'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h3 style={{ margin: 0, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          🎨 Whiteboard
        </h3>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: '#666'
          }}
        >
          ×
        </button>
      </div>

      {isHost && (
        <div style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '16px',
          alignItems: 'center',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => setTool('pen')}
              style={{
                padding: '8px',
                backgroundColor: tool === 'pen' ? '#007bff' : '#f8f9fa',
                color: tool === 'pen' ? 'white' : '#333',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              ✏️
            </button>
            <button
              onClick={() => setTool('eraser')}
              style={{
                padding: '8px',
                backgroundColor: tool === 'eraser' ? '#007bff' : '#f8f9fa',
                color: tool === 'eraser' ? 'white' : '#333',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              🧹
            </button>
          </div>

          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            style={{
              width: '32px',
              height: '32px',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          />

          <input
            type="range"
            min="1"
            max="20"
            value={brushSize}
            onChange={(e) => setBrushSize(e.target.value)}
            style={{ width: '80px' }}
          />
          <span style={{ fontSize: '12px' }}>{brushSize}px</span>

          <button
            onClick={clearCanvas}
            style={{
              padding: '8px 12px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            Clear
          </button>
        </div>
      )}

      <div style={{
        width: '100%',
        height: '400px',
        border: '2px solid #e1e5e9',
        borderRadius: '8px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            cursor: isHost ? (tool === 'pen' ? 'crosshair' : 'pointer') : 'not-allowed'
          }}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
        />
        
        {!isHost && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: '#666',
            fontSize: '14px',
            textAlign: 'center'
          }}>
            Only the host can draw on the whiteboard
          </div>
        )}
      </div>
    </div>
  );
};

const InteractiveVideoFeatures = ({ user, channel, isHost, onClose }) => {
  const [activeFeature, setActiveFeature] = useState(null);

  const features = [
    {
      id: 'poll',
      name: 'Live Poll',
      icon: '📊',
      description: 'Create interactive polls for your audience',
      component: LivePoll
    },
    {
      id: 'qa',
      name: 'Q&A Queue',
      icon: '🙋',
      description: 'Manage audience questions',
      component: QuestionsQueue
    },
    {
      id: 'whiteboard',
      name: 'Whiteboard',
      icon: '🎨',
      description: 'Collaborative drawing and notes',
      component: WhiteboardCollaboration
    }
  ];

  if (activeFeature) {
    const feature = features.find(f => f.id === activeFeature);
    const Component = feature.component;
    
    return (
      <Component
        user={user}
        channel={channel}
        isHost={isHost}
        onClose={() => setActiveFeature(null)}
      />
    );
  }

  return (
    <div style={{
      backgroundColor: '#fff',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
      border: '1px solid #e1e5e9',
      minWidth: '300px'
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <h3 style={{ margin: 0, fontSize: '18px' }}>
          🎮 Interactive Features
        </h3>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            color: '#666'
          }}
        >
          ×
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {features.map(feature => (
          <button
            key={feature.id}
            onClick={() => setActiveFeature(feature.id)}
            style={{
              padding: '16px',
              backgroundColor: '#f8f9fa',
              border: '1px solid #e1e5e9',
              borderRadius: '8px',
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.2s ease'
            }}
            onMouseEnter={(e) => {
              e.target.style.backgroundColor = '#e9ecef';
            }}
            onMouseLeave={(e) => {
              e.target.style.backgroundColor = '#f8f9fa';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ fontSize: '24px' }}>{feature.icon}</div>
              <div>
                <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                  {feature.name}
                </div>
                <div style={{ fontSize: '12px', color: '#666' }}>
                  {feature.description}
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default InteractiveVideoFeatures;