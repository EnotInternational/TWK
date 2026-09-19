import { useState } from 'react';
import styles from './Sidebar.module.css';
import { simulationApi, socket } from '../../api';

export default function Sidebar({ isOpen, onToggle, status = 'stopped', tick = 0 }) {
  const [spawnParams, setSpawnParams] = useState({
    seed: 42,
    width: 60,
    height: 30,
    initialAgents: 40,
    cycleTicks: 200,
    terminatorWidth: 8,
  });
  
  const [speed, setSpeed] = useState(0.2); // seconds per tick
  const [isLoading, setIsLoading] = useState(false);

  const handleSpawn = async () => {
    setIsLoading(true);
    try {
      await simulationApi.init({
        seed: Number(spawnParams.seed),
        width: Number(spawnParams.width),
        height: Number(spawnParams.height),
        initialAgents: Number(spawnParams.initialAgents),
        cycleTicks: Number(spawnParams.cycleTicks),
        terminatorWidth: Number(spawnParams.terminatorWidth)
      });
      socket.emit('request_field');
    } catch (error) {
      console.error("Initialization Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStart = async () => {
    await simulationApi.start(speed);
    socket.emit('request_field');
  };

  const handlePause = async () => {
    await simulationApi.pause();
    socket.emit('request_field');
  };

  const handleStep = async () => {
    await simulationApi.step();
    socket.emit('request_field');
  };

  const handleReset = async () => {
    await simulationApi.reset();
    socket.emit('request_field');
  };

  const handleSpeedChange = async (e) => {
    const val = Number(e.target.value);
    setSpeed(val);
    if (status === 'running') {
      await simulationApi.setSpeed(val);
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
        style={{ 
          marginLeft: isOpen ? '0' : '-260px',
          opacity: isOpen ? 1 : 0
        }}
      >
        <h2>Terra Nova: Mercury</h2>
        <div className={styles.statusBox}>
           <span>Статус: {status}</span>
           <span>Тик: {tick}</span>
        </div>
        
        {/* Панель симуляции */}
        <div className={styles.controlPanel}>
          <h3>Управление</h3>
          <div className={styles.btnGroup}>
            <button className={styles.actionBtn} onClick={handleStart} disabled={status === 'running'}>▶</button>
            <button className={styles.actionBtn} onClick={handlePause} disabled={status !== 'running'}>⏸</button>
            <button className={styles.actionBtn} onClick={handleStep} disabled={status === 'running'}>⏭</button>
            <button className={styles.actionBtn} onClick={handleReset}>🔄</button>
          </div>
          
          <div className={styles.inputGroup}>
            <label>Скорость (сек/тик): {speed}s</label>
            <input 
              type="range" 
              min="0.01" 
              max="1.0" 
              step="0.05" 
              value={speed} 
              onChange={handleSpeedChange} 
            />
          </div>
        </div>

        {/* Терраформирование */}
        <div className={styles.controlPanel}>
          <h3>Терраформирование</h3>
          <div className={styles.inputGroup}>
            <label>Seed:</label>
            <input type="number" name="seed" value={spawnParams.seed} onChange={handleInputChange} />
          </div>
          <div className={styles.inputGroup}>
            <label>Ширина:</label>
            <input type="number" name="width" value={spawnParams.width} onChange={handleInputChange} min="10" />
          </div>
          <div className={styles.inputGroup}>
            <label>Высота:</label>
            <input type="number" name="height" value={spawnParams.height} onChange={handleInputChange} min="10" />
          </div>
          <div className={styles.inputGroup}>
            <label>Нач. Популяция:</label>
            <input type="number" name="initialAgents" value={spawnParams.initialAgents} onChange={handleInputChange} min="1" />
          </div>
          <div className={styles.inputGroup}>
            <label>Цикл (тиков):</label>
            <input type="number" name="cycleTicks" value={spawnParams.cycleTicks} onChange={handleInputChange} min="10" />
          </div>
          <div className={styles.inputGroup}>
            <label>Ширина Терминатора:</label>
            <input type="number" name="terminatorWidth" value={spawnParams.terminatorWidth} onChange={handleInputChange} min="1" />
          </div>
          
          <button 
            className={styles.actionBtn} 
            onClick={handleSpawn} 
            disabled={isLoading}
            style={{marginTop: '10px'}}
          >
            {isLoading ? 'Генерация...' : 'Инициализировать'}
          </button>
          
        </div>
      </aside>
      
      <button 
        className={styles.toggleBtn} 
        style={{ left: isOpen ? '280px' : '20px' }} 
        onClick={onToggle}
      >
        {isOpen ? 'Скрыть' : 'Меню'}
      </button>
    </>
  );
}