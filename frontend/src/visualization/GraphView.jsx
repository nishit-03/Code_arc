import React, { useRef, useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import SpriteText from 'three-spritetext';
import * as THREE from 'three';

// Colorful iOS-inspired palette
const CLUSTER_COLORS = [
  '#0A84FF', // Blue
  '#30D158', // Green
  '#FF9F0A', // Orange
  '#BF5AF2', // Purple
  '#64D2FF', // Cyan
  '#FF375F', // Pink
  '#FFD60A', // Yellow
  '#5E5CE6', // Indigo
];

const GraphView = forwardRef(({ data, onNodeClick, selectedNode }, ref) => {
  const fgRef = useRef();
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight });

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.d3Force('link').distance(40).strength(0.8);
      fgRef.current.d3Force('charge').strength(-15);
      fgRef.current.d3Force('center').strength(0.5);
    }
  }, [data]);

  const getNodeColor = (node) => {
    const clusterIndex = parseInt(node.cluster || 0) % CLUSTER_COLORS.length;
    return CLUSTER_COLORS[clusterIndex];
  };

  // Smooth easing function (ease-in-out cubic)
  const easeInOutCubic = (t) => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  // Custom smooth camera animation
  const animateCamera = (targetPos, targetLookAt, duration = 1500) => {
    if (!fgRef.current) return;
    
    const camera = fgRef.current.camera();
    const controls = fgRef.current.controls();
    
    const startPos = {
      x: camera.position.x,
      y: camera.position.y,
      z: camera.position.z
    };
    
    const startLookAt = controls.target ? {
      x: controls.target.x,
      y: controls.target.y,
      z: controls.target.z
    } : { x: 0, y: 0, z: 0 };
    
    const startTime = performance.now();
    
    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeInOutCubic(progress);
      
      const newPos = {
        x: startPos.x + (targetPos.x - startPos.x) * easedProgress,
        y: startPos.y + (targetPos.y - startPos.y) * easedProgress,
        z: startPos.z + (targetPos.z - startPos.z) * easedProgress
      };
      
      const newLookAt = {
        x: startLookAt.x + (targetLookAt.x - startLookAt.x) * easedProgress,
        y: startLookAt.y + (targetLookAt.y - startLookAt.y) * easedProgress,
        z: startLookAt.z + (targetLookAt.z - startLookAt.z) * easedProgress
      };
      
      camera.position.set(newPos.x, newPos.y, newPos.z);
      if (controls.target) {
        controls.target.set(newLookAt.x, newLookAt.y, newLookAt.z);
      }
      camera.lookAt(newLookAt.x, newLookAt.y, newLookAt.z);
      
      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    
    requestAnimationFrame(animate);
  };

  // Expose zoomToNode method via ref for search functionality
  const zoomToNode = (node) => {
    if (!node || !node.x) return;
    const distance = 50;
    const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
    animateCamera(
      { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
      { x: node.x, y: node.y, z: node.z },
      1500
    );
  };

  // Zoom to cluster center - adjusts distance based on cluster size
  const zoomToCluster = (center, nodeCount) => {
    if (!center) return;
    // Adjust zoom distance based on number of nodes in cluster
    const baseDistance = 80;
    const distance = baseDistance + Math.min(nodeCount * 5, 100);
    const distRatio = 1 + distance / (Math.hypot(center.x, center.y, center.z) || 1);
    animateCamera(
      { x: center.x * distRatio, y: center.y * distRatio, z: center.z * distRatio },
      { x: center.x, y: center.y, z: center.z },
      1500
    );
  };

  useImperativeHandle(ref, () => ({
    zoomToNode,
    zoomToCluster
  }));

  const handleNodeClick = (node) => {
    if (selectedNode && selectedNode.id === node.id) {
      onNodeClick(null);
      // Smooth zoom out to overview
      animateCamera({ x: 0, y: 0, z: 220 }, { x: 0, y: 0, z: 0 }, 1500);
    } else {
      const distance = 50;
      const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);
      // Smooth zoom in to node
      animateCamera(
        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
        { x: node.x, y: node.y, z: node.z },
        1500
      );
      onNodeClick(node);
    }
  };

  if (!data || !data.nodes || data.nodes.length === 0) {
    return (
      <div className="w-full h-full absolute inset-0 flex items-center justify-center text-white" style={{ background: 'transparent' }}>
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 animate-pulse" />
          <p className="text-lg font-light text-white/60">Loading graph...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full absolute inset-0" style={{ zIndex: 0 }}>
      <ForceGraph3D
        ref={fgRef}
        graphData={data}
        width={dimensions.width}
        height={dimensions.height}
        
        nodeColor={getNodeColor}
        nodeRelSize={5}
        nodeOpacity={0.95}
        nodeResolution={16}
        
        nodeThreeObject={node => {
          const isSelected = selectedNode && selectedNode.id === node.id;
          const color = getNodeColor(node);
          
          const group = new THREE.Group();
          
          // Glowing sphere
          const geometry = new THREE.SphereGeometry(isSelected ? 6 : 4, 16, 16);
          const material = new THREE.MeshBasicMaterial({
            color: isSelected ? '#FF3B30' : color,
            transparent: true,
            opacity: isSelected ? 1 : 0.85
          });
          const sphere = new THREE.Mesh(geometry, material);
          group.add(sphere);
          
          // Glow effect
          const glowGeometry = new THREE.SphereGeometry(isSelected ? 8 : 5.5, 16, 16);
          const glowMaterial = new THREE.MeshBasicMaterial({
            color: isSelected ? '#FF3B30' : color,
            transparent: true,
            opacity: 0.15
          });
          const glow = new THREE.Mesh(glowGeometry, glowMaterial);
          group.add(glow);
          
          // Label
          const sprite = new SpriteText(node.name);
          sprite.color = '#ffffff';
          sprite.textHeight = isSelected ? 3 : 2;
          sprite.position.y = isSelected ? 10 : 7;
          sprite.fontFace = 'SF Pro Display, -apple-system, sans-serif';
          sprite.backgroundColor = 'rgba(0,0,0,0.5)';
          sprite.padding = 1;
          sprite.borderRadius = 2;
          group.add(sprite);
          
          return group;
        }}
        
        linkColor={() => 'rgba(255,255,255,0.15)'}
        linkOpacity={0.25}
        linkWidth={1}
        linkDirectionalArrowLength={4}
        linkDirectionalArrowRelPos={0.9}
        linkDirectionalArrowColor={() => 'rgba(255,255,255,0.4)'}
        linkDirectionalParticles={1}
        linkDirectionalParticleWidth={1}
        linkDirectionalParticleColor={() => 'rgba(255,255,255,0.3)'}
        
        onNodeClick={handleNodeClick}
        
        warmupTicks={120}
        cooldownTicks={80}
        
        backgroundColor="#000000"
        showNavInfo={false}
      />
    </div>
  );
});

export default GraphView;
