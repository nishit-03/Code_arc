import React, { useState, useEffect, useRef, useCallback } from 'react';
import GraphView from './visualization/GraphView';
import ChatPanel from './chat/ChatPanel';
import { Code, Info, Zap, GitBranch, Layers, Search, X, GripVertical } from 'lucide-react';

function App() {
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [clusters, setClusters] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const graphViewRef = useRef();
  
  // Resizable panel states
  const [leftPanelWidth, setLeftPanelWidth] = useState(320);
  const [rightPanelWidth, setRightPanelWidth] = useState(320);
  const [clusterPanelHeight, setClusterPanelHeight] = useState(320);
  const [isResizingLeft, setIsResizingLeft] = useState(false);
  const [isResizingRight, setIsResizingRight] = useState(false);
  const [isResizingVertical, setIsResizingVertical] = useState(false);
  const rightPanelRef = useRef();

  useEffect(() => {
    const fetchData = async () => {
        try {
            const res = await fetch('http://localhost:8005/graph');
            const data = await res.json();
            console.log("Graph data received:", data);
            setGraphData(data);
            
            const clusterRes = await fetch('http://localhost:8005/clusters');
            const clusterData = await clusterRes.json();
            setClusters(clusterData);
        } catch (e) {
            console.error("Backend not ready", e);
        }
    };
    
    fetchData();
  }, []);

  const handleQuery = async (text) => {
    const res = await fetch(`http://localhost:8005/query?q=${encodeURIComponent(text)}`, { method: 'POST' });
    const data = await res.json();
    return data.response;
  };

  // Panel resize handlers
  const handleMouseMove = useCallback((e) => {
    if (isResizingLeft) {
      const newWidth = Math.min(Math.max(200, e.clientX), 500);
      setLeftPanelWidth(newWidth);
    }
    if (isResizingRight) {
      const newWidth = Math.min(Math.max(200, window.innerWidth - e.clientX), 500);
      setRightPanelWidth(newWidth);
    }
    if (isResizingVertical && rightPanelRef.current) {
      const panelRect = rightPanelRef.current.getBoundingClientRect();
      const newHeight = Math.min(Math.max(150, panelRect.bottom - e.clientY), 400);
      setClusterPanelHeight(newHeight);
    }
  }, [isResizingLeft, isResizingRight, isResizingVertical]);

  const handleMouseUp = useCallback(() => {
    setIsResizingLeft(false);
    setIsResizingRight(false);
    setIsResizingVertical(false);
  }, []);

  useEffect(() => {
    if (isResizingLeft || isResizingRight || isResizingVertical) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = isResizingVertical ? 'row-resize' : 'col-resize';
      document.body.style.userSelect = 'none';
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizingLeft, isResizingRight, isResizingVertical, handleMouseMove, handleMouseUp]);

  // Search functionality
  const handleSearchChange = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (query.trim().length > 0) {
      const results = graphData.nodes.filter(node => 
        node.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5);
      setSearchResults(results);
      setShowSearchResults(true);
    } else {
      setSearchResults([]);
      setShowSearchResults(false);
    }
  };

  const handleSelectSearchResult = (node) => {
    setSelectedNode(node);
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
    // Trigger zoom to node via GraphView ref
    if (graphViewRef.current) {
      graphViewRef.current.zoomToNode(node);
    }
  };

  const clearSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchResults(false);
  };

  // Get unique cluster IDs from graph data
  const getUniqueClusters = () => {
    if (!graphData.nodes) return [];
    const clusterSet = new Set(graphData.nodes.map(node => node.cluster).filter(c => c !== undefined && c !== null));
    return Array.from(clusterSet).sort((a, b) => parseInt(a) - parseInt(b));
  };

  // Get count of nodes in a cluster
  const getClusterNodeCount = (clusterId) => {
    if (!graphData.nodes) return 0;
    return graphData.nodes.filter(node => String(node.cluster) === String(clusterId)).length;
  };

  // Handle cluster click - zoom to cluster center
  const handleClusterClick = (clusterId) => {
    if (!graphViewRef.current) return;
    
    // Find all nodes in this cluster
    const clusterNodes = graphData.nodes.filter(node => String(node.cluster) === String(clusterId));
    if (clusterNodes.length === 0) return;
    
    // Calculate cluster center
    const center = clusterNodes.reduce(
      (acc, node) => ({
        x: acc.x + (node.x || 0),
        y: acc.y + (node.y || 0),
        z: acc.z + (node.z || 0)
      }),
      { x: 0, y: 0, z: 0 }
    );
    center.x /= clusterNodes.length;
    center.y /= clusterNodes.length;
    center.z /= clusterNodes.length;
    
    // Zoom to cluster center
    graphViewRef.current.zoomToCluster(center, clusterNodes.length);
  };

  const clusterColors = ['#0A84FF', '#30D158', '#FF9F0A', '#BF5AF2', '#64D2FF', '#FF375F', '#9b8930ff', '#5E5CE6'];

  return (
    <div className="relative w-screen h-screen overflow-hidden text-white" style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif', background: '#000000' }}>
      
      {/* Animated Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>

      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-20 flex justify-center pt-4 sm:pt-5">
        <div className="text-center">
          <h1 className="text-xl sm:text-2xl lg:text-3xl tracking-widest">
            <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent font-bold">CODE ARCHAEOLOGIST</span>
            <span className="text-white/90 font-light ml-2"></span>
          </h1>
          <p className="text-[10px] sm:text-xs text-white/30 tracking-wider mt-1">MVP BUILD v0.1</p>
        </div>
      </div>

      {/* Stats Bar - Responsive */}
      <div className="absolute top-19 left-1/2 -translate-x-1/2 z-20 hidden sm:flex items-center gap-4">
        <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Layers className="w-3.5 h-3.5 text-blue-400" />
          <span className="text-xs text-white/70">{graphData.nodes.length} nodes</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <GitBranch className="w-3.5 h-3.5 text-green-400" />
          <span className="text-xs text-white/70">{graphData.links?.length || 0} links</span>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ background: 'rgba(255,255,255,0.05)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Zap className="w-3.5 h-3.5 text-yellow-400" />
          <span className="text-xs text-white/70">{clusters.length} clusters</span>
        </div>
      </div>

      {/* 3D Graph Layer */}
      <GraphView ref={graphViewRef} data={graphData} onNodeClick={setSelectedNode} selectedNode={selectedNode} />

      {/* UI Overlay Layer */}
      <div className="absolute inset-0 pointer-events-none z-10">
        
        {/* Left: Chat Panel with Resize Handle */}
        <div className="absolute top-4 left-4 bottom-8 flex pointer-events-none" style={{ width: `${leftPanelWidth}px` }}>
          <ChatPanel onQuery={handleQuery} width={leftPanelWidth} />
          {/* Left Panel Resize Handle */}
          <div 
            className="absolute top-0 bottom-0 w-3 cursor-col-resize flex items-center justify-center pointer-events-auto group"
            style={{ right: '-6px' }}
            onMouseDown={() => setIsResizingLeft(true)}
          >
            <div className="w-1 h-16 rounded-full bg-white/10 group-hover:bg-white/30 group-hover:h-24 transition-all" />
          </div>
        </div>

        {/* Right: Split Panel with Resize Handle */}
        <div ref={rightPanelRef} className="absolute top-4 bottom-8 flex pointer-events-none" style={{ right: '16px', width: `${rightPanelWidth}px` }}>
          {/* Right Panel Resize Handle */}
          <div 
            className="absolute top-0 bottom-0 w-3 cursor-col-resize flex items-center justify-center pointer-events-auto group"
            style={{ left: '-6px' }}
            onMouseDown={() => setIsResizingRight(true)}
          >
            <div className="w-1 h-16 rounded-full bg-white/10 group-hover:bg-white/30 group-hover:h-24 transition-all" />
          </div>
          
          <div className="flex-1 flex flex-col gap-3 pointer-events-none">
            
            {/* Top: Artifact Panel */}
            <div 
              className="flex-1 rounded-3xl pointer-events-auto flex flex-col overflow-hidden transition-all duration-300 hover:shadow-2xl"
              style={{
                background: 'linear-gradient(145deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 100%)',
                backdropFilter: 'blur(40px) saturate(180%)',
                WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
              }}
            >
                {selectedNode ? (
                    <div className="p-4 flex flex-col h-full">
                        <div className="flex items-center gap-3 mb-3 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center shadow-lg">
                              <Code className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-sm truncate">{selectedNode.name}</h3>
                              <p className="text-[12px] text-white/40">Function</p>
                            </div>
                        </div>
                        
                        <div className="space-y-3 flex-1 overflow-auto">
                            <div>
                                <label className="text-xs text-white/40 uppercase tracking-wider font-medium">File</label>
                                <p className="text-sm text-white/80 font-mono mt-1 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                    {selectedNode.file?.split(/[/\\]/).pop()}
                                </p>
                            </div>
                            
                            <div>
                                <label className="text-xs text-white/40 uppercase tracking-wider font-medium">Cluster</label>
                                <div className="flex items-center gap-2 mt-1">
                                    <div 
                                      className="w-3 h-3 rounded-full shadow-lg" 
                                      style={{ background: clusterColors[parseInt(selectedNode.cluster || 0) % 8] }}
                                    />
                                    <span className="text-sm text-white/80">Cluster {selectedNode.cluster || "N/A"}</span>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs text-white/40 uppercase tracking-wider font-medium">Source Code</label>
                                <pre 
                                  className="text-xs text-white/85 font-mono mt-1 p-3 rounded-xl overflow-auto max-h-32"
                                  style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)' }}
                                >
                                    <code>{selectedNode.code || "// Source not available"}</code>
                                </pre>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center p-5 text-center">
                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center mb-3 shadow-lg" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                            <Info className="w-5 h-5 text-white/40" />
                        </div>
                        <h3 className="text-md font-medium text-white/90 mb-1">Select an Artifact</h3>
                        <p className="text-[12px] text-white/40 leading-relaxed">
                            Click any node to reveal its secrets.
                        </p>
                    </div>
                )}
            </div>

            {/* Vertical Resize Handle */}
            <div 
              className="w-full h-3 cursor-row-resize flex justify-center items-center pointer-events-auto group"
              onMouseDown={() => setIsResizingVertical(true)}
            >
              <div className="w-12 h-1 rounded-full bg-white/10 group-hover:bg-white/30 group-hover:w-20 transition-all" />
            </div>

            {/* Bottom: Cluster Navigator */}
            <div 
              className="rounded-3xl pointer-events-auto flex flex-col overflow-hidden"
              style={{
                height: `${clusterPanelHeight}px`,
                background: 'linear-gradient(145deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.03) 100%)',
                backdropFilter: 'blur(40px) saturate(180%)',
                WebkitBackdropFilter: 'blur(40px) saturate(180%)',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
              }}
            >
                <div className="p-3 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <Layers className="w-4 h-4 text-purple-400" />
                    <h3 className="font-semibold text-md text-white/90">Clusters</h3>
                    <span className="text-xs text-white/40 ml-auto">{getUniqueClusters().length} groups</span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {getUniqueClusters().map((clusterId) => (
                      <button
                        key={clusterId}
                        onClick={() => handleClusterClick(clusterId)}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl hover:bg-white/10 transition-colors text-left group"
                      >
                        <div 
                          className="w-4 h-4 rounded-full shadow-lg ring-2 ring-white/10 group-hover:ring-white/30 transition-all"
                          style={{ background: clusterColors[parseInt(clusterId) % 8] }}
                        />
                        <div className="flex-1">
                          <p className="text-sm text-white/80 group-hover:text-white transition-colors">Cluster {clusterId}</p>
                          <p className="text-xs text-white/40">{getClusterNodeCount(clusterId)} nodes</p>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-white/50">
                          →
                        </div>
                      </button>
                    ))}
                </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Search Bar */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 w-full max-w-md px-4">
        <div className="relative">
          {/* Search Input */}
          <div 
            className="flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300"
            style={{
              background: 'linear-gradient(145deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.05) 100%)',
              backdropFilter: 'blur(40px) saturate(180%)',
              WebkitBackdropFilter: 'blur(40px) saturate(180%)',
              border: '1px solid rgba(255,255,255,0.15)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
            }}
          >
            <Search className="w-5 h-5 text-white/40" />
            <input
              type="text"
              className="flex-1 bg-transparent text-base text-white placeholder-white/40 focus:outline-none"
              placeholder="Search nodes by name..."
              value={searchQuery}
              onChange={handleSearchChange}
              onFocus={() => searchQuery && setShowSearchResults(true)}
            />
            {searchQuery && (
              <button onClick={clearSearch} className="p-1 hover:bg-white/10 rounded-full transition-colors">
                <X className="w-4 h-4 text-white/50" />
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {showSearchResults && searchResults.length > 0 && (
            <div 
              className="absolute bottom-full left-0 right-0 mb-2 rounded-2xl overflow-hidden"
              style={{
                background: 'linear-gradient(145deg, rgba(30,30,40,0.95) 0%, rgba(20,20,30,0.95) 100%)',
                backdropFilter: 'blur(40px)',
                border: '1px solid rgba(255,255,255,0.12)',
                boxShadow: '0 -8px 32px rgba(0,0,0,0.5)'
              }}
            >
              {searchResults.map((node, index) => (
                <button
                  key={node.id}
                  onClick={() => handleSelectSearchResult(node)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/10 transition-colors text-left"
                  style={{ borderBottom: index < searchResults.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}
                >
                  <div 
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ background: clusterColors[parseInt(node.cluster || 0) % 8] }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white truncate">{node.name}</p>
                    <p className="text-[10px] text-white/40 truncate">{node.file?.split(/[/\\]/).pop()}</p>
                  </div>
                  <span className="text-[10px] text-white/30 px-2 py-1 rounded-full bg-white/5">
                    Cluster {node.cluster}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* No Results */}
          {showSearchResults && searchQuery && searchResults.length === 0 && (
            <div 
              className="absolute bottom-full left-0 right-0 mb-2 px-4 py-3 rounded-2xl text-center"
              style={{
                background: 'rgba(30,30,40,0.95)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
            >
              <p className="text-sm text-white/50">No nodes found</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;




