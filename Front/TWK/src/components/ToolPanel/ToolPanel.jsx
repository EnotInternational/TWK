import styles from './ToolPanel.module.css';

export default function ToolPanel({
  selectedDisaster, setSelectedDisaster,
  disasterParams, setDisasterParams,
  onOpenRandomizer
}) {
  const handleDisasterChange = (disaster) => {
    if (selectedDisaster === disaster) {
      setSelectedDisaster(null);
      setDisasterParams({});
      return;
    }
    
    setSelectedDisaster(disaster);
    // Инициализируем дефолтные параметры при смене
    if (disaster === 'wind') {
      setDisasterParams({ strength: 7 });
    } else if (disaster === 'rocks') {
      setDisasterParams({ size: 3 });
    } else if (disaster === 'meteorite') {
      setDisasterParams({ radius: 5, damage: 100 });
    } else if (disaster === 'depression') {
      setDisasterParams({ level: 1, size: 2 });
    } else if (disaster === 'eraser') {
      setDisasterParams({ radius: 2 });
    } else {
      setDisasterParams({});
    }
  };

  const handleParamChange = (e) => {
    const { name, value } = e.target;
    setDisasterParams(prev => ({ ...prev, [name]: isNaN(value) ? value : Number(value) }));
  };

  return (
    <footer className={styles.toolPanel}>
      <div className={styles.disasterSection}>
        <h4 className={styles.title}>Катастрофы и рельеф (Клик по полю)</h4>
        <div className={styles.buttonGroup}>
          <button 
            className={styles.button}
            onClick={onOpenRandomizer}
            style={{ background: 'linear-gradient(135deg, #6a11cb 0%, #2575fc 100%)', color: 'white', border: 'none' }}
          >
            🎲 Рандомайзер
          </button>
          <button 
            className={`${styles.button} ${selectedDisaster === 'wind' ? styles.active : ''}`}
            onClick={() => handleDisasterChange('wind')}
          >
            Ветер
          </button>
          <button 
            className={`${styles.button} ${selectedDisaster === 'rocks' ? styles.active : ''}`}
            onClick={() => handleDisasterChange('rocks')}
          >
            Скалы
          </button>
          <button 
            className={`${styles.button} ${selectedDisaster === 'meteorite' ? styles.active : ''}`}
            onClick={() => handleDisasterChange('meteorite')}
          >
            Метеорит
          </button>
          <button 
            className={`${styles.button} ${selectedDisaster === 'depression' ? styles.active : ''}`}
            onClick={() => handleDisasterChange('depression')}
          >
            Углубление
          </button>
          <button 
            className={`${styles.button} ${selectedDisaster === 'eraser' ? styles.active : ''}`}
            onClick={() => handleDisasterChange('eraser')}
          >
            Ластик
          </button>
        </div>
      </div>

      {selectedDisaster && (
        <div className={styles.paramsSection}>
          <h4 className={styles.title}>
            Параметры: {
              selectedDisaster === 'wind' ? 'Радиальный ветер' :
              selectedDisaster === 'rocks' ? 'Скалы' :
              selectedDisaster === 'meteorite' ? 'Метеорит' :
              selectedDisaster === 'depression' ? 'Углубление' : 'Ластик'
            }
          </h4>
          <div className={styles.inputs}>
            {selectedDisaster === 'wind' && (
              <label>
                Сила (от центра клика):
                <input type="number" name="strength" value={disasterParams.strength ?? 7} onChange={handleParamChange} min="1" max="100" />
              </label>
            )}
            {selectedDisaster === 'rocks' && (
              <label>
                Размер (клетки):
                <input type="number" name="size" value={disasterParams.size || 0} onChange={handleParamChange} min="1" max="10" />
              </label>
            )}
            {selectedDisaster === 'depression' && (
              <>
                <label>
                  Глубина:
                  <select name="level" value={disasterParams.level || 1} onChange={handleParamChange}>
                    <option value={1}>1 (Обычная)</option>
                    <option value={2}>2 (Глубокая)</option>
                  </select>
                </label>
                <label>
                  Размер (клетки):
                  <input type="number" name="size" value={disasterParams.size || 2} onChange={handleParamChange} min="1" max="8" />
                </label>
              </>
            )}
            {selectedDisaster === 'eraser' && (
              <label>
                Радиус удаления:
                <input type="number" name="radius" value={disasterParams.radius || 0} onChange={handleParamChange} min="1" max="10" />
              </label>
            )}
            {selectedDisaster === 'meteorite' && (
              <>
                <label>
                  Радиус:
                  <input type="number" name="radius" value={disasterParams.radius || 0} onChange={handleParamChange} min="1" max="20" />
                </label>
                <label>
                  Урон:
                  <input type="number" name="damage" value={disasterParams.damage || 0} onChange={handleParamChange} min="10" max="1000" />
                </label>
              </>
            )}
          </div>
        </div>
      )}
    </footer>
  );
}
