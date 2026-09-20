import { useState, useCallback } from 'react';
import Sidebar from './components/Sidebar/Sidebar';
import AgentGrid from './components/AgentGrid/AgentGrid';
import ToolPanel from './components/ToolPanel/ToolPanel';
import RightSidebar from './components/RightSidebar/RightSidebar';
import BottomPanel from './components/BottomPanel/BottomPanel';
import Randomizer from './components/Randomizer/Randomizer';
import styles from './App.module.css';

export default function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [isRightMenuOpen, setIsRightMenuOpen] = useState(true);
  const [isBottomPanelOpen, setIsBottomPanelOpen] = useState(true);

  const [metrics, setMetrics] = useState({});
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [activeRightTab, setActiveRightTab] = useState('all'); // 'all' | 'agent'
  const [isRandomizerOpen, setIsRandomizerOpen] = useState(false);

  // Состояния для катастроф
  const [selectedDisaster, setSelectedDisaster] = useState(null); // 'wind' | 'rocks' | 'meteorite' | 'eraser' | null
  const [disasterParams, setDisasterParams] = useState({}); // { ...params }

  const handleAgentSelect = useCallback((agent) => {
    setSelectedAgent(agent);
    if (agent) {
      setActiveRightTab('agent');
      setIsRightMenuOpen(true);
    }
  }, []);

  const handleAgentUpdate = useCallback((agentOrUpdater) => {
    setSelectedAgent(agentOrUpdater);
    // Preserves activeRightTab so user can stay in 'all' mode without being forced back!
  }, []);

  return (
    <div className={styles.appLayout}>
      <Sidebar
        isOpen={isMenuOpen}
        onToggle={() => setIsMenuOpen(!isMenuOpen)}
        status={metrics.status}
        tick={metrics.tick}
      />

      <main className={styles.mainWorkspace}>
        <div className={styles.gridArea}>
          <AgentGrid
            onMetricsUpdate={setMetrics}
            onAgentSelect={handleAgentSelect}
            onAgentUpdate={handleAgentUpdate}
            selectedAgent={selectedAgent}
            selectedDisaster={selectedDisaster}
            disasterParams={disasterParams}
          />
        </div>
        <div style={{ position: 'relative' }}>
          <button
            className={styles.bottomToggleBtn}
            onClick={() => setIsBottomPanelOpen(!isBottomPanelOpen)}
            title="Скрыть/Показать нижнюю панель"
          >
            {isBottomPanelOpen ? 'Скрыть' : 'Инструменты'}
          </button>

          <div
            className={styles.bottomPanelWrapper}
            style={{
              maxHeight: isBottomPanelOpen ? '400px' : '0px',
              opacity: isBottomPanelOpen ? 1 : 0
            }}
          >
            <ToolPanel
              selectedDisaster={selectedDisaster}
              setSelectedDisaster={setSelectedDisaster}
              disasterParams={disasterParams}
              setDisasterParams={setDisasterParams}
              onOpenRandomizer={() => setIsRandomizerOpen(true)}
            />
            <BottomPanel metrics={metrics} />
          </div>
        </div>
      </main>

      <Randomizer isOpen={isRandomizerOpen} onClose={() => setIsRandomizerOpen(false)} metrics={metrics} />

      <RightSidebar
        isOpen={isRightMenuOpen}
        agent={selectedAgent}
        onSelectAgent={handleAgentSelect}
        onToggle={() => setIsRightMenuOpen(!isRightMenuOpen)}
        onClose={() => setIsRightMenuOpen(false)}
        activeTab={activeRightTab}
        setActiveTab={setActiveRightTab}
        metrics={metrics}
      />
    </div>
  );
}