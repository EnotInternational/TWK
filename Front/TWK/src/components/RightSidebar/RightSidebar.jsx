import styles from './RightSidebar.module.css';

export default function RightSidebar({ isOpen, agent, onToggle }) {
  if (!agent && isOpen) {
    return (
      <>
        <aside className={styles.rightSidebar} style={{ transform: 'translateX(0)' }}>
          <div className={styles.emptyState}>
             <h3>Анализ агента</h3>
             <p>Выберите агента на сетке для просмотра характеристик.</p>
          </div>
        </aside>
        <button className={styles.rightToggleBtn} onClick={onToggle}>
          Закрыть
        </button>
      </>
    );
  }

  return (
    <>
      <aside 
        className={styles.rightSidebar}
        style={{ transform: isOpen ? 'translateX(0)' : 'translateX(100%)' }}
      >
        <h2>Данные агента</h2>
        <div className={styles.agentCard}>
          <div className={styles.dataRow}>
            <span>ID:</span>
            <strong>{agent?.id || '—'}</strong>
          </div>
          <div className={styles.dataRow}>
            <span>Координаты:</span>
            <strong>X: {agent?.x || 0}, Y: {agent?.y || 0}</strong>
          </div>
          <div className={styles.dataRow}>
            <span>Энергия:</span>
            <strong style={{ color: agent?.energy > 120 ? '#00ff88' : agent?.energy < 60 ? '#ff3344' : '#ffd000' }}>
              {agent?.energy ? agent.energy.toFixed(1) : '0.0'}
            </strong>
          </div>
          <div className={styles.dataRow}>
            <span>Возраст:</span>
            <strong>{agent?.age || 0} тиков</strong>
          </div>
          <div className={styles.dataRow}>
            <span>Поколение:</span>
            <strong>{agent?.generation || 0}</strong>
          </div>
          <div className={styles.dataRow}>
            <span>Предок:</span>
            <strong>{agent?.parent_id || 'Первичное'}</strong>
          </div>
          <div className={styles.dataRow}>
            <span>Темп. зона:</span>
            <strong style={{textTransform: 'capitalize'}}>{agent?.zone || 'unknown'}</strong>
          </div>
          
          {agent?.death_reason && (
            <div className={`${styles.dataRow} ${styles.deadRow}`}>
              <span>Причина смерти:</span>
              <strong>{agent.death_reason}</strong>
            </div>
          )}
        </div>
      </aside>
      
      <button className={styles.rightToggleBtn} onClick={onToggle}>
        {isOpen ? 'Закрыть' : 'Агент'}
      </button>
    </>
  );
}