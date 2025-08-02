import React from 'react';
import { useSearchParams } from 'react-router-dom';
import Auth from '../components/Auth';

const AuthPage = () => {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode') || 'signin';
  const type = searchParams.get('type') || 'fan';

  return <Auth mode={mode} accountType={type} />;
};

export default AuthPage;