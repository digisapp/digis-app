import React from 'react';
import MyCollections from '../MyCollections';
import { useApp } from '../../hooks/useApp';

const CollectionsPage = () => {
  const { user } = useApp();
  
  // Check if user is a creator
  const isCreator = user?.is_creator || user?.isCreator || false;

  return <MyCollections user={user} isCreator={isCreator} />;
};

export default CollectionsPage;