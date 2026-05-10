"use client";
import {
  ReactFlow,
  Background,
  Controls,
  BackgroundVariant,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

const nodeStyle: React.CSSProperties = {
  background: "#1a1a1a",
  border: "1px solid #facc15",
  borderRadius: 8,
  color: "#f0f0f0",
  padding: "8px 20px",
  fontWeight: "bold",
  fontSize: 13,
  minWidth: 110,
  textAlign: "center",
};

const nodes: Node[] = [
  { id: "main",       data: { label: "Main" },       position: { x: 270, y: 0   }, style: nodeStyle },
  { id: "reader",     data: { label: "Reader" },     position: { x: 270, y: 100 }, style: nodeStyle },
  { id: "profiler",   data: { label: "Profiler" },   position: { x: 50,  y: 220 }, style: nodeStyle },
  { id: "cleaner",    data: { label: "Cleaner" },    position: { x: 270, y: 220 }, style: nodeStyle },
  { id: "validator",  data: { label: "Validator" },  position: { x: 490, y: 220 }, style: nodeStyle },
  { id: "normalizer", data: { label: "Normalizer" }, position: { x: 270, y: 340 }, style: nodeStyle },
  { id: "metadata",   data: { label: "Metadata" },   position: { x: 270, y: 440 }, style: nodeStyle },
  { id: "reporter",   data: { label: "Reporter" },   position: { x: 130, y: 560 }, style: nodeStyle },
  { id: "notifier",   data: { label: "Notifier" },   position: { x: 410, y: 560 }, style: nodeStyle },
  { id: "loader",     data: { label: "Loader" },     position: { x: 270, y: 680 }, style: nodeStyle },
];

const edgeDefaults = { animated: true, style: { stroke: "#4ade80", strokeWidth: 2 } };

const edges: Edge[] = [
  { id: "e-main-reader",          source: "main",       target: "reader",     ...edgeDefaults },
  { id: "e-reader-profiler",      source: "reader",     target: "profiler",   ...edgeDefaults },
  { id: "e-reader-cleaner",       source: "reader",     target: "cleaner",    ...edgeDefaults },
  { id: "e-reader-validator",     source: "reader",     target: "validator",  ...edgeDefaults },
  { id: "e-profiler-normalizer",  source: "profiler",   target: "normalizer", ...edgeDefaults },
  { id: "e-cleaner-normalizer",   source: "cleaner",    target: "normalizer", ...edgeDefaults },
  { id: "e-validator-normalizer", source: "validator",  target: "normalizer", ...edgeDefaults },
  { id: "e-normalizer-metadata",  source: "normalizer", target: "metadata",   ...edgeDefaults },
  { id: "e-metadata-reporter",    source: "metadata",   target: "reporter",   ...edgeDefaults },
  { id: "e-metadata-notifier",    source: "metadata",   target: "notifier",   ...edgeDefaults },
  { id: "e-reporter-loader",      source: "reporter",   target: "loader",     ...edgeDefaults },
  { id: "e-notifier-loader",      source: "notifier",   target: "loader",     ...edgeDefaults },
];

export function PipelineFlow() {
  return (
    <div style={{ height: 520, background: "#0d0d0d", borderRadius: 8, border: "1px solid #2a2a2a" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background variant={BackgroundVariant.Dots} color="#2a2a2a" gap={20} size={1} />
        <Controls
          showInteractive={false}
          style={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: 6 }}
        />
      </ReactFlow>
    </div>
  );
}
