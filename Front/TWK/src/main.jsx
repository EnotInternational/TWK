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
      // Уведомляем canvas о возможном обновлении размеров при возврате
      window.dispatchEvent(new Event('resize'));
    }
  };

  return (
    <>
      {/* Футуристичный плавающий HUD-переключатель режимов */}
      <nav style={{
        position: 'fixed',
        top: '12px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 9999,
        display: 'flex',
        gap: '6px',
        background: 'rgba(5, 5, 8, 0.88)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(0, 229, 255, 0.35)',
        borderRadius: '24px',
        padding: '4px 6px',
        boxShadow: '0 0 20px rgba(0, 229, 255, 0.25)',
        userSelect: 'none'
      }}>
        <button
          onClick={() => navigate('main')}
          style={{
            background: route === 'main' ? 'rgba(0, 229, 255, 0.2)' : 'transparent',
            color: route === 'main' ? '#00e5ff' : '#a0aec0',
            border: route === 'main' ? '1px solid #00e5ff' : '1px solid transparent',
            borderRadius: '18px',
            padding: '5px 14px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '700',
            letterSpacing: '0.8px',
            textTransform: 'uppercase',
            transition: 'all 0.2s ease',
            outline: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span>🛰️</span>
          <span>Симуляция</span>
        </button>

        <button
          onClick={() => navigate('stats')}
          style={{
            background: route === 'stats' ? 'rgba(0, 229, 255, 0.2)' : 'transparent',
            color: route === 'stats' ? '#00e5ff' : '#a0aec0',
            border: route === 'stats' ? '1px solid #00e5ff' : '1px solid transparent',
            borderRadius: '18px',
            padding: '5px 14px',
            cursor: 'pointer',
            fontSize: '12px',
            fontWeight: '700',
            letterSpacing: '0.8px',
            textTransform: 'uppercase',
            transition: 'all 0.2s ease',
            outline: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <span>📊</span>
          <span>Статистика</span>
        </button>
      </nav>

      {/* Обе страницы сохраняются в DOM и не размонтируются, 
          чтобы не сбрасывать введённые пользователем настройки терраформирования, 
          положение камеры, зум и состояние панелей */}
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
