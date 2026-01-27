import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import OITasks from './pages/OITasks';
import KeyTasks from './pages/KeyTasks';
import NotificationDashboard from './pages/NotificationDashboard';
import AIReport from './pages/AIReport';
import Layout from './components/Layout';
import ScrollToTop from './components/ScrollToTop';
import './App.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router>
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Login />} />
          <Route path="/dashboard" element={<Layout><Dashboard /></Layout>} />
          <Route path="/oi-tasks" element={<Layout><OITasks /></Layout>} />
          <Route path="/key-tasks" element={<Layout><KeyTasks /></Layout>} />
          <Route path="/notifications" element={<Layout><NotificationDashboard /></Layout>} />
          <Route path="/ai-report" element={<Layout><AIReport /></Layout>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </QueryClientProvider>
  );
}

export default App;
