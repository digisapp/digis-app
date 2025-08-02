import React, { createContext, useState, useContext } from 'react';

const ContentContext = createContext();

export const useContent = () => {
  const context = useContext(ContentContext);
  if (!context) {
    throw new Error('useContent must be used within a ContentProvider');
  }
  return context;
};

export const ContentProvider = ({ children }) => {
  const [creatorContent, setCreatorContent] = useState({});

  const addCreatorContent = (creatorId, content) => {
    setCreatorContent(prev => ({
      ...prev,
      [creatorId]: content
    }));
  };

  const getCreatorContent = (creatorId) => {
    return creatorContent[creatorId] || [];
  };

  const value = {
    creatorContent,
    addCreatorContent,
    getCreatorContent
  };

  return (
    <ContentContext.Provider value={value}>
      {children}
    </ContentContext.Provider>
  );
};

export default ContentContext;