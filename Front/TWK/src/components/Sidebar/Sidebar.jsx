import { useState } from 'react';
import styles from './Sidebar.module.css';
import { agentApi } from '../../api';

export default function Sidebar({ isOpen, metrics, selectedAgent, onGridUpdate, onToggle }) {
  // Локальное состояние для формы спавна
  const [spawnParams, setSpawnParams] = useState({
    width: 50,
    height: 50,
    count: 100
  });
  const [isLoading, setIsLoading] = useState(false);

  // Обработчик инициализации поля
  const handleSpawn = async () => {
    setIsLoading(true);
    try {
      // Инициализируем поле случайными агентами[cite: 8]
      await agentApi.initField(
        Number(spawnParams.width), 
        Number(spawnParams.height), 
        Number(spawnParams.count)
      );
      
      // Если запрос успешен, обновляем сетку во фронтенде
      onGridUpdate({
        width: Number(spawnParams.width),
        height: Number(spawnParams.height)
      });
    } catch (error) {
      console.error("Ошибка при спавне:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSpawnParams(prev => ({ ...prev, [name]: value }));
  };

  return (
    <>
      <aside 
        className={styles.sidebar}
        style={{ transform: isOpen ? 'translateX(0)' : 'translateX(-100%)' }}
      >
        <h2>Система выбора</h2>
        
        {/* Новый блок: Терраформирование (Спавн) */}
        <div className={styles.controlPanel}>
          <h3>Терраформирование</h3>
          <div className={styles.inputGroup}>
            <label>Ширина (X):</label>
            <input type="number" name="width" value={spawnParams.width} onChange={handleInputChange} min="10" />
          </div>
          <div className={styles.inputGroup}>
            <label>Высота (Y):</label>
            <input type="number" name="height" value={spawnParams.height} onChange={handleInputChange} min="10" />
          </div>
          <div className={styles.inputGroup}>
            <label>Популяция:</label>
            <input type="number" name="count" value={spawnParams.count} onChange={handleInputChange} min="1" />
          </div>
          
          <button 
            className={styles.actionBtn} 
            onClick={handleSpawn} 
            disabled={isLoading}
          >
            {isLoading ? 'Генерация...' : 'Инициализировать поле'}
          </button>
        </div>

        <div className={styles.metrics}>
          {/* ... ваш существующий код вывода метрик ... */}
        </div>

        <div className={styles.agentInfo}>
          {/* ... ваш существующий код вывода выбранного агента ... */}
        </div>
      </aside>
      
      <button className={styles.toggleBtn} onClick={onToggle}>
        {isOpen ? 'Скрыть' : 'Меню'}
      </button>
    </>
  );
}