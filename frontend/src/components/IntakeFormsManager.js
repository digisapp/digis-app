import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  DocumentTextIcon,
  UserIcon,
  CalendarIcon,
  CheckCircleIcon,
  ClockIcon,
  EyeIcon,
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  ArrowDownTrayIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import Button from './ui/Button';
import Card from './ui/Card';
import ClientIntakeModal from './ClientIntakeModal';
import { customToast } from './ui/EnhancedToaster';

const IntakeFormsManager = ({ creatorType = 'general' }) => {
  const [intakeForms, setIntakeForms] = useState([]);
  const [filteredForms, setFilteredForms] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showNewIntakeModal, setShowNewIntakeModal] = useState(false);
  const [selectedForm, setSelectedForm] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // list or analytics
  const [loading, setLoading] = useState(true);

  // Mock data for intake forms
  useEffect(() => {
    const mockForms = [
      {
        id: 1,
        clientName: 'Sarah Johnson',
        clientId: 'client_1',
        submittedAt: '2024-03-20T10:30:00Z',
        status: 'completed',
        primaryGoals: ['Weight Management', 'Stress Reduction'],
        sessionType: 'consultation',
        formData: {
          fullName: 'Sarah Johnson',
          email: 'sarah.j@example.com',
          phone: '(555) 123-4567',
          currentChallenges: 'Struggling with consistent healthy eating habits and stress management.',
          timelineExpectations: '3-months'
        }
      },
      {
        id: 2,
        clientName: 'Michael Chen',
        clientId: 'client_2',
        submittedAt: '2024-03-19T14:15:00Z',
        status: 'completed',
        primaryGoals: ['Flexibility Improvement', 'Stress Relief'],
        sessionType: 'follow-up',
        formData: {
          fullName: 'Michael Chen',
          email: 'mchen@example.com',
          phone: '(555) 987-6543',
          currentChallenges: 'Limited flexibility due to desk job, experiencing lower back pain.',
          timelineExpectations: '6-months'
        }
      },
      {
        id: 3,
        clientName: 'Emma Wilson',
        clientId: 'client_3',
        submittedAt: '2024-03-18T09:00:00Z',
        status: 'pending',
        primaryGoals: ['Business Growth', 'Strategic Planning'],
        sessionType: 'consultation',
        formData: {
          fullName: 'Emma Wilson',
          email: 'emma.w@startup.com',
          phone: '(555) 456-7890',
          currentChallenges: 'Need help scaling my startup and creating sustainable growth strategies.',
          timelineExpectations: '12-months'
        }
      },
      {
        id: 4,
        clientName: 'David Martinez',
        clientId: 'client_4',
        submittedAt: '2024-03-17T16:45:00Z',
        status: 'completed',
        primaryGoals: ['Muscle Building', 'Athletic Performance'],
        sessionType: 'check-in',
        formData: {
          fullName: 'David Martinez',
          email: 'dmartinez@example.com',
          phone: '(555) 234-5678',
          currentChallenges: 'Plateau in muscle growth, need to optimize training program.',
          timelineExpectations: '3-months'
        }
      }
    ];

    setIntakeForms(mockForms);
    setFilteredForms(mockForms);
    setLoading(false);
  }, []);

  // Filter forms based on search and status
  useEffect(() => {
    let filtered = intakeForms;

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(form =>
        form.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        form.formData.email.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Apply status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(form => form.status === filterStatus);
    }

    setFilteredForms(filtered);
  }, [searchQuery, filterStatus, intakeForms]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-100';
      case 'pending':
        return 'text-yellow-600 bg-yellow-100';
      case 'expired':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getFormStats = () => {
    const total = intakeForms.length;
    const completed = intakeForms.filter(f => f.status === 'completed').length;
    const pending = intakeForms.filter(f => f.status === 'pending').length;
    
    const goalFrequency = {};
    intakeForms.forEach(form => {
      form.primaryGoals.forEach(goal => {
        goalFrequency[goal] = (goalFrequency[goal] || 0) + 1;
      });
    });

    const topGoals = Object.entries(goalFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);

    return { total, completed, pending, topGoals };
  };

  const stats = getFormStats();

  const handleViewForm = (form) => {
    setSelectedForm(form);
    // In a real app, this would open a detailed view modal
    customToast.info(`Viewing intake form for ${form.clientName}`);
  };

  const handleExportForms = () => {
    // In a real app, this would export to CSV or PDF
    customToast.success('Intake forms exported successfully!', { icon: '📄' });
  };

  const renderAnalytics = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Forms</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <DocumentTextIcon className="w-8 h-8 text-purple-600" />
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
            </div>
            <CheckCircleIcon className="w-8 h-8 text-green-600" />
          </div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Review</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.pending}</p>
            </div>
            <ClockIcon className="w-8 h-8 text-yellow-600" />
          </div>
        </Card>
      </div>

      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Client Goals</h3>
        <div className="space-y-3">
          {stats.topGoals.map(([goal, count], index) => (
            <div key={goal} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-600">#{index + 1}</span>
                <span className="font-medium text-gray-900">{goal}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-purple-600 h-2 rounded-full"
                    style={{ width: `${(count / stats.total) * 100}%` }}
                  />
                </div>
                <span className="text-sm text-gray-600">{count}</span>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );

  const renderFormsList = () => (
    <div className="space-y-4">
      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto" />
          <p className="mt-2 text-gray-600">Loading intake forms...</p>
        </div>
      ) : filteredForms.length === 0 ? (
        <div className="text-center py-12">
          <DocumentTextIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
          <p className="text-gray-600">No intake forms found</p>
          <Button
            variant="primary"
            size="sm"
            className="mt-4"
            onClick={() => setShowNewIntakeModal(true)}
          >
            Create First Form
          </Button>
        </div>
      ) : (
        filteredForms.map((form) => (
          <motion.div
            key={form.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold">
                    {form.clientName.charAt(0)}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{form.clientName}</h4>
                    <p className="text-sm text-gray-500">{form.formData.email}</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="w-4 h-4" />
                    <span>{new Date(form.submittedAt).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <UserIcon className="w-4 h-4" />
                    <span className="capitalize">{form.sessionType} Session</span>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(form.status)}`}>
                    {form.status}
                  </span>
                </div>

                <div className="mt-2">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Goals:</span> {form.primaryGoals.join(', ')}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<EyeIcon className="w-4 h-4" />}
                  onClick={() => handleViewForm(form)}
                >
                  View
                </Button>
              </div>
            </div>
          </motion.div>
        ))
      )}
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Client Intake Forms</h2>
        <p className="text-gray-600 mt-1">
          Manage and review client intake forms for your {
            creatorType === 'health-coach' ? 'health coaching' :
            creatorType === 'yoga' ? 'yoga' :
            creatorType === 'fitness' ? 'fitness training' :
            creatorType === 'wellness' ? 'wellness' :
            creatorType === 'consultant' ? 'consulting' :
            'professional'
          } sessions
        </p>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
            />
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" />
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <FunnelIcon className="w-5 h-5 text-gray-400" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-purple-500"
              >
                <option value="all">All Status</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
              </select>
            </div>

            <div className="flex items-center gap-2 border-l pl-3">
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-purple-100 text-purple-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <DocumentTextIcon className="w-5 h-5" />
              </button>
              <button
                onClick={() => setViewMode('analytics')}
                className={`p-2 rounded ${viewMode === 'analytics' ? 'bg-purple-100 text-purple-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                <ChartBarIcon className="w-5 h-5" />
              </button>
            </div>

            <Button
              variant="secondary"
              size="sm"
              icon={<ArrowDownTrayIcon className="w-4 h-4" />}
              onClick={handleExportForms}
            >
              Export
            </Button>

            <Button
              variant="primary"
              size="sm"
              icon={<PlusIcon className="w-4 h-4" />}
              onClick={() => setShowNewIntakeModal(true)}
            >
              New Form
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      {viewMode === 'list' ? renderFormsList() : renderAnalytics()}

      {/* New Intake Form Modal */}
      <ClientIntakeModal
        isOpen={showNewIntakeModal}
        onClose={() => setShowNewIntakeModal(false)}
        creatorType={creatorType}
        mode="form" // Force form mode
        onFormSubmitted={(formData) => {
          console.log('New intake form:', formData);
          setShowNewIntakeModal(false);
          customToast.success('Intake form created successfully!');
          // Add the form to the list
          const newForm = {
            id: Date.now(),
            clientName: formData.fullName,
            clientId: `client_${Date.now()}`,
            submittedAt: formData.completedAt,
            status: 'completed',
            primaryGoals: formData.primaryGoals,
            sessionType: 'consultation',
            formData: formData
          };
          setIntakeForms(prev => [newForm, ...prev]);
        }}
      />
    </div>
  );
};

export default IntakeFormsManager;