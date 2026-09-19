import { useState } from 'react';
import styles from './Sidebar.module.css';
import { api } from '../../api';

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
  const width = Number(spawnParams.width);
  const height = Number(spawnParams.height);
  const count = Number(spawnParams.count);
  const maxPopulation = width * height;

  if (count > maxPopulation) {
    alert(`Критическая ошибка энтропии: максимум агентов для поля ${width}x${height} — ${maxPopulation}.`);
    return;
  }

  setIsLoading(true);
  try {
    // Вызываем новый научный эндпоинт инициализации[cite: 22]
    await api.simulation.init({
      width: width,
      height: height,
      initial_agents: count,
      base_metabolism: 1.0,
      cycle_ticks: 200,
      max_ticks: 1000,
      penalty_cold: 3.0,
      penalty_hot: 3.0,
      penalty_terminator: 0.0,
      reproduction_cost: 50.0,
      reproduction_threshold: 140.0,
      require_partner: true,
      seed: 42,
      starting_energy: 100,
      terminator_width: 4
    });
    
    // Сразу запускаем автоматическое выполнение симуляции без паузы[cite: 18]
    await api.simulation.start(0.5);

    onGridUpdate({ width, height });
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