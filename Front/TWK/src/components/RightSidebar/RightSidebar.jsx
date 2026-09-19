import styles from '../Sidebar/Sidebar.module.css'; // Можно переиспользовать стили левого меню

export default function RightSidebar({ isOpen, agent, onToggle }) {
  return (
    <>
      <aside 
        className={styles.sidebar}
        // Выезжает справа, а не слева
        style={{ 
          right: 0, 
          left: 'auto', 
          borderRight: 'none', 
          borderLeft: '2px solid #00e5ff',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)' 
        }}
      >
        <h2>Анализ субъекта</h2>
        <div className={styles.agentInfo}>
          {agent ? (
            <div className={styles.statsPanel}>
              <p><span>ID:</span> {agent.id || 'Неизвестно'}</p>
              <p><span>X:</span> {agent.x} <span>Y:</span> {agent.y}</p>
              <p><span>Здоровье:</span> {agent.hp || 100}/100</p>
              <p><span>Энергия:</span> {agent.energy || 0}</p>
              <p><span>Мутация:</span> {agent.mutation || 0}%</p>
            </div>
          ) : (
            <div className={styles.emptyState}>
              Выберите объект на карте.
            </div>
          )}
        </div>
      </aside>
      
      {/* Кнопка тоже позиционируется справа */}
      <button 
        className={styles.toggleBtn} 
        style={{ right: '20px', left: 'auto' }} 
        onClick={onToggle}
      >
        {isOpen ? 'Скрыть' : 'Инфо'}
      </button>
    </>
  );
}