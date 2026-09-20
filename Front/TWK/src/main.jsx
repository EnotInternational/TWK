import { StrictMode, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.jsx';
import StatisticsPage from './pages/Statistics/StatisticsPage.jsx';

function Root() {
  const [route, setRoute] = useState(() => {
    const hash = window.location.hash;
    const path = window.location.pathname;
    return (hash.includes('stats') || path.includes('stats')) ? 'stats' : 'main';
  });

  useEffect(() => {
    const checkRoute = () => {
      const hash = window.location.hash;
      const path = window.location.pathname;
      if (hash.includes('stats') || path.includes('stats')) {
        setRoute('stats');
      } else {
        setRoute('main');
      }
    };

    window.addEventListener('hashchange', checkRoute);
    window.addEventListener('popstate', checkRoute);
    return () => {
      window.removeEventListener('hashchange', checkRoute);
      window.removeEventListener('popstate', checkRoute);
    };
  }, []);

  const navigate = (to) => {
    setRoute(to);
    window.location.hash = to === 'stats' ? '#/stats' : '#/';
    if (to === 'main') {
      window.dispatchEvent(new Event('resize'));
    }
  };

  return (
    <>
      {/* Строгий научный селектор режимов */}
      <nav style={{
        position: 'fixed',
        top: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        gap: '4px',
        background: 'rgba(10, 13, 20, 0.92)',
        backdropFilter: 'blur(8px)',
        border: '1px solid #1e293b',
        borderRadius: '6px',
        padding: '3px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
        userSelect: 'none',
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
      }}>
        <button
          onClick={() => navigate('main')}
          style={{
            background: route === 'main' ? '#1e293b' : 'transparent',
            color: route === 'main' ? '#38bdf8' : '#94a3b8',
            border: route === 'main' ? '1px solid #38bdf8' : '1px solid transparent',
            borderRadius: '4px',
            padding: '4px 14px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: '600',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            transition: 'all 0.15s ease',
            outline: 'none'
          }}
        >
          Симуляция
        </button>

        <button
          onClick={() => navigate('stats')}
          style={{
            background: route === 'stats' ? '#1e293b' : 'transparent',
            color: route === 'stats' ? '#38bdf8' : '#94a3b8',
            border: route === 'stats' ? '1px solid #38bdf8' : '1px solid transparent',
            borderRadius: '4px',
            padding: '4px 14px',
            cursor: 'pointer',
            fontSize: '11px',
            fontWeight: '600',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            transition: 'all 0.15s ease',
            outline: 'none'
          }}
        >
          Статистика
        </button>
      </nav>

      {/* Обе страницы сохраняются в DOM и не размонтируются */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        visibility: route === 'main' ? 'visible' : 'hidden',
        pointerEvents: route === 'main' ? 'auto' : 'none',
        zIndex: route === 'main' ? 10 : 0
      }}>
        <App />
      </div>

      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        visibility: route === 'stats' ? 'visible' : 'hidden',
        pointerEvents: route === 'stats' ? 'auto' : 'none',
        zIndex: route === 'stats' ? 10 : 0
      }}>
        <StatisticsPage onBack={() => navigate('main')} />
      </div>
    </>
  );
}

import { ToastProvider } from './components/Toast/ToastContext.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ToastProvider>
      <Root />
    </ToastProvider>
  </StrictMode>,
);
