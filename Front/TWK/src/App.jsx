import { useState } from 'react';
import Sidebar from './components/Sidebar/Sidebar';
import AgentGrid from './components/AgentGrid/AgentGrid';
import BottomPanel from './components/BottomPanel/BottomPanel';
import RightSidebar from './components/RightSidebar/RightSidebar';
import styles from './App.module.css';

export default function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(true);
  const [isRightMenuOpen, setIsRightMenuOpen] = useState(true);
  
  const [metrics, setMetrics] = useState({});
  const [selectedAgent, setSelectedAgent] = useState(null);

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
          />
        </div>
        <BottomPanel metrics={metrics} />
      </main>

      <RightSidebar 
        isOpen={isRightMenuOpen} 
        agent={selectedAgent} 
        onToggle={() => setIsRightMenuOpen(!isRightMenuOpen)} 
      />
    </div>
  );
}