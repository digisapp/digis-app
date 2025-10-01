import React from 'react';
import { motion } from 'framer-motion';
import {
  ClockIcon,
  VideoCameraIcon,
  DocumentTextIcon,
  HeartIcon,
  LightBulbIcon,
  CheckCircleIcon,
  WifiIcon,
  ComputerDesktopIcon
} from '@heroicons/react/24/outline';
import Card from './ui/Card';

const PreCallReminder = ({ creatorType = 'general', sessionType = 'video', creatorName = '' }) => {
  const getPreparationTips = () => {
    const baseTips = [
      {
        icon: WifiIcon,
        title: 'Check Your Connection',
        description: 'Ensure you have a stable internet connection for the best experience'
      },
      {
        icon: sessionType === 'video' ? ComputerDesktopIcon : VideoCameraIcon,
        title: sessionType === 'video' ? 'Camera & Audio Setup' : 'Audio Setup',
        description: sessionType === 'video' 
          ? 'Test your camera and microphone before the call'
          : 'Find a quiet space and test your microphone'
      },
      {
        icon: ClockIcon,
        title: 'Be On Time',
        description: 'Join the session 2-3 minutes early to ensure everything works'
      }
    ];

    const specificTips = {
      'health-coach': [
        {
          icon: HeartIcon,
          title: 'Health Information',
          description: 'Think about your current health goals and any concerns you want to discuss'
        },
        {
          icon: DocumentTextIcon,
          title: 'Medical History',
          description: 'Have any relevant medical information handy (medications, conditions)'
        }
      ],
      'yoga': [
        {
          icon: HeartIcon,
          title: 'Physical Comfort',
          description: 'Wear comfortable clothing and have a yoga mat or towel ready'
        },
        {
          icon: DocumentTextIcon,
          title: 'Practice Space',
          description: 'Clear a space where you can move freely and safely'
        }
      ],
      'fitness': [
        {
          icon: HeartIcon,
          title: 'Fitness Goals',
          description: 'Be ready to discuss your fitness objectives and current routine'
        },
        {
          icon: DocumentTextIcon,
          title: 'Health Status',
          description: 'Mention any injuries or physical limitations upfront'
        }
      ],
      'wellness': [
        {
          icon: HeartIcon,
          title: 'Wellness Vision',
          description: 'Reflect on what wellness means to you and areas for improvement'
        },
        {
          icon: DocumentTextIcon,
          title: 'Current Practices',
          description: 'Think about your current self-care and wellness routines'
        }
      ],
      'consultant': [
        {
          icon: HeartIcon,
          title: 'Business Goals',
          description: 'Prepare your key business objectives and challenges'
        },
        {
          icon: DocumentTextIcon,
          title: 'Relevant Materials',
          description: 'Have any relevant documents or data ready to reference'
        }
      ]
    };

    return [...baseTips, ...(specificTips[creatorType] || specificTips['consultant'])];
  };

  const tips = getPreparationTips();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Preparing for Your {sessionType === 'video' ? 'Video' : 'Voice'} Session
        </h2>
        <p className="text-gray-600">
          {creatorName ? `With ${creatorName}` : 'Get ready for a great session'}
        </p>
      </div>

      {/* Main Tips */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {tips.map((tip, index) => (
          <motion.div
            key={tip.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="h-full hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <tip.icon className="w-6 h-6 text-purple-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 mb-1">{tip.title}</h3>
                  <p className="text-sm text-gray-600">{tip.description}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Discussion Points */}
      <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
        <h3 className="font-semibold text-purple-900 mb-3 flex items-center gap-2">
          <LightBulbIcon className="w-5 h-5" />
          What We'll Discuss
        </h3>
        <p className="text-sm text-purple-800 mb-3">
          During our session, we'll have a conversation about:
        </p>
        <ul className="space-y-2">
          {creatorType === 'health-coach' && (
            <>
              <li className="flex items-start gap-2 text-sm text-purple-700">
                <CheckCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Your health goals and what you hope to achieve</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-purple-700">
                <CheckCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Current lifestyle habits and daily routines</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-purple-700">
                <CheckCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Any health concerns or challenges you're facing</span>
              </li>
            </>
          )}
          {creatorType === 'yoga' && (
            <>
              <li className="flex items-start gap-2 text-sm text-purple-700">
                <CheckCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Your experience with yoga and movement</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-purple-700">
                <CheckCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Physical considerations and any limitations</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-purple-700">
                <CheckCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>What you hope to gain from your practice</span>
              </li>
            </>
          )}
          {creatorType === 'fitness' && (
            <>
              <li className="flex items-start gap-2 text-sm text-purple-700">
                <CheckCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Your fitness goals and timeline</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-purple-700">
                <CheckCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Current fitness level and exercise history</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-purple-700">
                <CheckCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Available time and equipment for training</span>
              </li>
            </>
          )}
          {(creatorType === 'consultant' || creatorType === 'general') && (
            <>
              <li className="flex items-start gap-2 text-sm text-purple-700">
                <CheckCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Your main objectives and goals</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-purple-700">
                <CheckCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>Current challenges you're facing</span>
              </li>
              <li className="flex items-start gap-2 text-sm text-purple-700">
                <CheckCircleIcon className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>How we can best work together</span>
              </li>
            </>
          )}
        </ul>
      </Card>

      {/* Footer Note */}
      <div className="text-center text-sm text-gray-600">
        <p>No forms to fill out - we'll discuss everything during our session!</p>
        <p className="mt-1">Looking forward to connecting with you.</p>
      </div>
    </div>
  );
};

export default PreCallReminder;