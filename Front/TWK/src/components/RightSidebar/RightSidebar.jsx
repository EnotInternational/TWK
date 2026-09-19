import styles from '../Sidebar/Sidebar.module.css';

export default function RightSidebar({ isOpen, agent, onToggle }) {
  return (
    <aside
      className={styles.sidebar}
      style={{
        // Во Flexbox скрываем панель, физически утягивая её за экран через margin
        marginRight: isOpen ? '0' : '-320px',
        borderRight: 'none',
        borderLeft: '2px solid #00e5ff',
        color: '#ffffff',
        position: 'relative' // Обязательно для позиционирования кнопки
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

      <button
        className={styles.toggleBtn}
        style={{
          position: 'absolute',
          left: '-85px', // Вытаскиваем кнопку влево из панели в рабочую зону
          top: '20px',
          right: 'auto',
          width: '85px'  // Фиксируем ширину, чтобы кнопка не дергалась при смене текста
        }}
        onClick={onToggle}
      >
        {isOpen ? 'Скрыть' : 'Инфо'}
      </button>
    </aside>
  );
}