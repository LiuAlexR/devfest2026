import React from 'react';
import { Outlet } from 'react-router';
import { Header } from '../components/Header';
import { Toaster } from '../components/ui/sonner';

export const RootLayout: React.FC = () => {
  return (
    <div className="min-h-screen">
      <Header />
      <Outlet />
      <Toaster />
    </div>
  );
};
