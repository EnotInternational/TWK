import styles from './ToolPanel.module.css';

export default function ToolPanel({
  mouseMode, setMouseMode,
  selectedDisaster, setSelectedDisaster,
  disasterParams, setDisasterParams
}) {
  const handleDisasterChange = (disaster) => {
    setSelectedDisaster(disaster);
    // Инициализируем дефолтные параметры при смене
    if (disaster === 'wind') {
      setDisasterParams({ direction: 'east', strength: 50 });
    } else if (disaster === 'rocks') {
      setDisasterParams({ size: 3 });
    } else if (disaster === 'meteorite') {
      setDisasterParams({ radius: 5, damage: 100 });
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
      <div className={styles.modeSection}>
        <h4 className={styles.title}>Режим мыши</h4>
        <div className={styles.buttonGroup}>
          <button 
            className={`${styles.button} ${mouseMode === 'drag' ? styles.active : ''}`}
            onClick={() => setMouseMode('drag')}
          >
            Перетаскивание
          </button>
          <button 
            className={`${styles.button} ${mouseMode === 'select' ? styles.active : ''}`}
            onClick={() => setMouseMode('select')}
          >
            Выбор клетки
          </button>
        </div>
      </div>

      <div className={`${styles.disasterSection} ${mouseMode === 'drag' ? styles.disabled : ''}`}>
        <h4 className={styles.title}>Катастрофы (Клик по полю)</h4>
        <div className={styles.buttonGroup}>
          <button 
            className={`${styles.button} ${selectedDisaster === 'wind' ? styles.active : ''}`}
            onClick={() => handleDisasterChange('wind')}
            disabled={mouseMode === 'drag'}
          >
            Ветер
          </button>
          <button 
            className={`${styles.button} ${selectedDisaster === 'rocks' ? styles.active : ''}`}
            onClick={() => handleDisasterChange('rocks')}
            disabled={mouseMode === 'drag'}
          >
            Скалы
          </button>
          <button 
            className={`${styles.button} ${selectedDisaster === 'meteorite' ? styles.active : ''}`}
            onClick={() => handleDisasterChange('meteorite')}
            disabled={mouseMode === 'drag'}
          >
            Метеорит
          </button>
        </div>
      </div>

      {mouseMode === 'select' && selectedDisaster && (
        <div className={styles.paramsSection}>
          <h4 className={styles.title}>Параметры: {selectedDisaster}</h4>
          <div className={styles.inputs}>
            {selectedDisaster === 'wind' && (
              <>
                <label>
                  Направление:
                  <select name="direction" value={disasterParams.direction || 'east'} onChange={handleParamChange}>
                    <option value="north">Север</option>
                    <option value="south">Юг</option>
                    <option value="east">Восток</option>
                    <option value="west">Запад</option>
                  </select>
                </label>
                <label>
                  Сила:
                  <input type="number" name="strength" value={disasterParams.strength || 0} onChange={handleParamChange} min="1" max="100" />
                </label>
              </>
            )}
            {selectedDisaster === 'rocks' && (
              <label>
                Размер (клетки):
                <input type="number" name="size" value={disasterParams.size || 0} onChange={handleParamChange} min="1" max="10" />
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
