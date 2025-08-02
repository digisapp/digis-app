import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XMarkIcon,
  DocumentTextIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  CheckCircleIcon,
  ClockIcon,
  TagIcon,
  MagnifyingGlassIcon
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

const MessageTemplatesModal = ({ isOpen, onClose, onSelectTemplate, user }) => {
  const [templates, setTemplates] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'general',
    tags: []
  });

  const categories = [
    { id: 'all', label: 'All Templates', icon: DocumentTextIcon },
    { id: 'general', label: 'General', icon: DocumentTextIcon },
    { id: 'greeting', label: 'Greetings', icon: '👋' },
    { id: 'announcement', label: 'Announcements', icon: '📢' },
    { id: 'promotion', label: 'Promotions', icon: '🎉' },
    { id: 'faq', label: 'FAQs', icon: '❓' },
    { id: 'schedule', label: 'Scheduling', icon: ClockIcon },
    { id: 'custom', label: 'Custom', icon: TagIcon }
  ];

  useEffect(() => {
    if (isOpen) {
      loadTemplates();
    }
  }, [isOpen, user]);

  const loadTemplates = async () => {
    try {
      // Load from local storage for now
      const savedTemplates = localStorage.getItem(`message_templates_${user.uid}`);
      if (savedTemplates) {
        setTemplates(JSON.parse(savedTemplates));
      } else {
        // Default templates
        setTemplates([
          {
            id: 1,
            title: 'Welcome Message',
            content: 'Hey there! Welcome to my page! 🎉 Thank you so much for joining. Feel free to check out my content and don\'t hesitate to reach out if you have any questions!',
            category: 'greeting',
            tags: ['welcome', 'new fan'],
            usageCount: 0,
            lastUsed: null
          },
          {
            id: 2,
            title: 'Session Reminder',
            content: 'Hi! Just a friendly reminder that our session is coming up in 30 minutes. Make sure you\'re in a quiet space with a stable internet connection. See you soon! 😊',
            category: 'schedule',
            tags: ['reminder', 'session'],
            usageCount: 0,
            lastUsed: null
          },
          {
            id: 3,
            title: 'Thank You Message',
            content: 'Thank you so much for your support! It really means the world to me. I hope you enjoyed our time together and I look forward to connecting with you again soon! 💕',
            category: 'general',
            tags: ['thank you', 'appreciation'],
            usageCount: 0,
            lastUsed: null
          },
          {
            id: 4,
            title: 'New Content Alert',
            content: '🔥 New content just dropped! Check out my latest [content type] - I think you\'re going to love it! Let me know what you think in the comments.',
            category: 'announcement',
            tags: ['new content', 'update'],
            usageCount: 0,
            lastUsed: null
          },
          {
            id: 5,
            title: 'Special Offer',
            content: '🎁 SPECIAL OFFER just for you! For the next 24 hours, get [X]% off on [service/content]. Don\'t miss out - this deal won\'t last long!',
            category: 'promotion',
            tags: ['offer', 'discount'],
            usageCount: 0,
            lastUsed: null
          }
        ]);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  };

  const saveTemplates = (updatedTemplates) => {
    localStorage.setItem(`message_templates_${user.uid}`, JSON.stringify(updatedTemplates));
    setTemplates(updatedTemplates);
  };

  const handleCreateTemplate = () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    const newTemplate = {
      id: Date.now(),
      title: formData.title,
      content: formData.content,
      category: formData.category,
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
      usageCount: 0,
      lastUsed: null,
      createdAt: new Date().toISOString()
    };

    const updatedTemplates = [...templates, newTemplate];
    saveTemplates(updatedTemplates);
    
    setFormData({ title: '', content: '', category: 'general', tags: [] });
    setShowCreateForm(false);
    // toast.success('Template created successfully!');
  };

  const handleUpdateTemplate = () => {
    if (!formData.title.trim() || !formData.content.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    const updatedTemplates = templates.map(template =>
      template.id === editingTemplate.id
        ? {
            ...template,
            title: formData.title,
            content: formData.content,
            category: formData.category,
            tags: typeof formData.tags === 'string' 
              ? formData.tags.split(',').map(tag => tag.trim()).filter(Boolean)
              : formData.tags,
            updatedAt: new Date().toISOString()
          }
        : template
    );

    saveTemplates(updatedTemplates);
    setEditingTemplate(null);
    setFormData({ title: '', content: '', category: 'general', tags: [] });
    // toast.success('Template updated successfully!');
  };

  const handleDeleteTemplate = (templateId) => {
    if (window.confirm('Are you sure you want to delete this template?')) {
      const updatedTemplates = templates.filter(t => t.id !== templateId);
      saveTemplates(updatedTemplates);
      // toast.success('Template deleted');
    }
  };

  const handleUseTemplate = (template) => {
    // Update usage stats
    const updatedTemplates = templates.map(t =>
      t.id === template.id
        ? { ...t, usageCount: t.usageCount + 1, lastUsed: new Date().toISOString() }
        : t
    );
    saveTemplates(updatedTemplates);
    
    // Pass template content to parent
    onSelectTemplate(template.content);
    onClose();
  };

  const filteredTemplates = templates.filter(template => {
    const matchesSearch = template.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         template.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || template.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const TemplateForm = () => (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className="bg-gray-50 rounded-xl p-6 mb-6"
    >
      <h3 className="text-lg font-semibold text-gray-900 mb-4">
        {editingTemplate ? 'Edit Template' : 'Create New Template'}
      </h3>
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="e.g., Welcome Message"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
          <select
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          >
            {categories.filter(c => c.id !== 'all').map(category => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Message Content</label>
          <textarea
            value={formData.content}
            onChange={(e) => setFormData({ ...formData, content: e.target.value })}
            placeholder="Type your template message here..."
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
          />
          <p className="text-xs text-gray-500 mt-1">
            Tip: Use [brackets] for placeholders you'll fill in later
          </p>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tags (comma-separated)</label>
          <input
            type="text"
            value={typeof formData.tags === 'string' ? formData.tags : formData.tags.join(', ')}
            onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
            placeholder="e.g., welcome, greeting, new fan"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        
        <div className="flex gap-3 pt-2">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
          >
            <CheckCircleIcon className="w-4 h-4" />
            {editingTemplate ? 'Update' : 'Create'} Template
          </motion.button>
          <button
            onClick={() => {
              setShowCreateForm(false);
              setEditingTemplate(null);
              setFormData({ title: '', content: '', category: 'general', tags: [] });
            }}
            className="px-4 py-2 text-gray-700 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </motion.div>
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden shadow-xl"
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <DocumentTextIcon className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Message Templates</h2>
                <p className="text-sm text-gray-600">Save time with pre-written messages</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <XMarkIcon className="w-5 h-5 text-gray-500" />
            </button>
          </div>

          {/* Content */}
          <div className="flex h-[calc(90vh-88px)]">
            {/* Sidebar */}
            <div className="w-48 bg-gray-50 p-4 space-y-2 border-r border-gray-200">
              {categories.map((category) => (
                <motion.button
                  key={category.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedCategory(category.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center gap-2 ${
                    selectedCategory === category.id
                      ? 'bg-purple-100 text-purple-700'
                      : 'hover:bg-gray-100 text-gray-700'
                  }`}
                >
                  {typeof category.icon === 'string' ? (
                    <span className="text-lg">{category.icon}</span>
                  ) : (
                    <category.icon className="w-4 h-4" />
                  )}
                  <span className="text-sm font-medium">{category.label}</span>
                </motion.button>
              ))}
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Search and Actions */}
              <div className="flex items-center gap-4 mb-6">
                <div className="flex-1 relative">
                  <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search templates..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowCreateForm(true)}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-2"
                >
                  <PlusIcon className="w-4 h-4" />
                  New Template
                </motion.button>
              </div>

              {/* Create/Edit Form */}
              <AnimatePresence>
                {(showCreateForm || editingTemplate) && <TemplateForm />}
              </AnimatePresence>

              {/* Templates Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredTemplates.map((template) => (
                  <motion.div
                    key={template.id}
                    whileHover={{ y: -2 }}
                    className="bg-white border border-gray-200 rounded-xl p-4 hover:shadow-lg transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-gray-900">{template.title}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full">
                            {categories.find(c => c.id === template.category)?.label}
                          </span>
                          {template.usageCount > 0 && (
                            <span className="text-xs text-gray-500">
                              Used {template.usageCount} times
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={() => {
                            setEditingTemplate(template);
                            setFormData({
                              title: template.title,
                              content: template.content,
                              category: template.category,
                              tags: template.tags.join(', ')
                            });
                            setShowCreateForm(false);
                          }}
                          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <PencilIcon className="w-4 h-4 text-gray-500" />
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <TrashIcon className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-600 mb-3 line-clamp-3">
                      {template.content}
                    </p>
                    
                    {template.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {template.tags.map((tag, index) => (
                          <span
                            key={index}
                            className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded-full"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleUseTemplate(template)}
                      className="w-full py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors text-sm font-medium"
                    >
                      Use Template
                    </motion.button>
                  </motion.div>
                ))}
              </div>

              {filteredTemplates.length === 0 && (
                <div className="text-center py-12">
                  <DocumentTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">
                    {searchQuery ? 'No templates found matching your search' : 'No templates in this category'}
                  </p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MessageTemplatesModal;