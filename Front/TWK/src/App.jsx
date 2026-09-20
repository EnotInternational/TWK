import { useState } from 'react';
import Sidebar from './components/Sidebar/Sidebar';
import AgentGrid from './components/AgentGrid/AgentGrid';
import ToolPanel from './components/ToolPanel/ToolPanel';
import RightSidebar from './components/RightSidebar/RightSidebar';
import BottomPanel from './components/BottomPanel/BottomPanel';
import styles from './App.module.css';

export default function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [isRightMenuOpen, setIsRightMenuOpen] = useState(true);
  
  const [metrics, setMetrics] = useState({});
  const [selectedAgent, setSelectedAgent] = useState(null);

  // Состояния для катастроф
  const [selectedDisaster, setSelectedDisaster] = useState(null); // 'wind' | 'rocks' | 'meteorite' | 'eraser' | null
  const [disasterParams, setDisasterParams] = useState({}); // { ...params }

  // We rely on AgentGrid to render the environment and fetch the agents via sockets

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
            onAgentSelect={setSelectedAgent}
            selectedDisaster={selectedDisaster}
            disasterParams={disasterParams}
          />
        </div>
        <ToolPanel
          selectedDisaster={selectedDisaster}
          setSelectedDisaster={setSelectedDisaster}
          disasterParams={disasterParams}
          setDisasterParams={setDisasterParams}
        />
        <BottomPanel metrics={metrics} />
      </main>

      <RightSidebar 
        isOpen={isRightMenuOpen} 
        agent={selectedAgent} 
        onToggle={() => setIsRightMenuOpen(!isRightMenuOpen)}
        metrics={metrics}
      />
    </div>
  );
}