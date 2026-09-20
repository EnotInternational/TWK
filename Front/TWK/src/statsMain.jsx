import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import StatisticsPage from './pages/Statistics/StatisticsPage.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <StatisticsPage onBack={() => { window.location.href = '/'; }} />
  </StrictMode>,
);
