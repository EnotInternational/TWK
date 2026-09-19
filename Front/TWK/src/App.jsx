import { useState } from 'react';
import Sidebar from './components/Sidebar/Sidebar';
import AgentGrid from './components/AgentGrid/AgentGrid';
import BottomPanel from './components/BottomPanel/BottomPanel';
import RightSidebar from './components/RightSidebar/RightSidebar';
import styles from './App.module.css';

export default function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [isRightMenuOpen, setIsRightMenuOpen] = useState(true); // Состояние правой панели
  
  const [metrics, setMetrics] = useState({ power: 0, latency: 0, efficiency: 0, entropy: 0 });
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [gridConfig, setGridConfig] = useState({ width: 50, height: 50 });

  return (
    <div className={styles.appLayout}>
      {/* Левая панель (Терраформирование) */}
      <Sidebar 
        isOpen={isMenuOpen} 
        onGridUpdate={setGridConfig}
        onToggle={() => setIsMenuOpen(!isMenuOpen)} 
      />
      
      {/* Центральная рабочая зона[cite: 11] */}
      <main className={styles.mainWorkspace}>
        <div className={styles.gridArea}>
          <AgentGrid 
            onMetricsUpdate={setMetrics} 
            onAgentSelect={setSelectedAgent} 
            gridWidth={gridConfig.width}   
            gridHeight={gridConfig.height} 
          />
        </div>
        <BottomPanel metrics={metrics} />
      </main>

      {/* Правая панель (Анализ агента) */}
      <RightSidebar 
        isOpen={isRightMenuOpen} 
        agent={selectedAgent} 
        onToggle={() => setIsRightMenuOpen(!isRightMenuOpen)} 
      />
    </div>
  );
}