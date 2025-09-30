import React, { useCallback, useEffect, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  addEdge,
  Connection,
  useNodesState,
  useEdgesState,
  Controls,
  Background,
  MiniMap,
  ReactFlowProvider,
  Position,
} from 'react-flow-renderer';
import dagre from 'dagre';
import {
  Box,
  Paper,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  Stop,
  Info,
  CheckCircle,
  Error,
  Schedule,
  Person,
} from '@mui/icons-material';

interface WorkflowStep {
  id: string;
  name: string;
  type: 'manual' | 'automatic' | 'approval' | 'system';
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  assignedTo?: string;
  estimatedDuration?: number;
  actualDuration?: number;
  requiredDocuments?: string[];
  requiredTools?: string[];
  completedAt?: Date;
  notes?: string;
}

interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  steps: WorkflowStep[];
  transitions: Array<{
    from: string;
    to: string;
    condition?: string;
    label?: string;
  }>;
}

interface WorkflowInstance {
  id: string;
  definitionId: string;
  currentStepId: string;
  status: 'running' | 'completed' | 'failed' | 'paused';
  startedAt: Date;
  completedAt?: Date;
  variables: Record<string, any>;
}

interface WorkflowVisualizationProps {
  definition: WorkflowDefinition;
  instance?: WorkflowInstance;
  onStepClick?: (step: WorkflowStep) => void;
  onExecuteStep?: (stepId: string) => void;
  interactive?: boolean;
  height?: number;
}

const nodeTypes = {
  workflowStep: WorkflowStepNode,
};

function WorkflowStepNode({ data }: { data: WorkflowStep & { onClick?: () => void } }) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return '#4caf50';
      case 'in_progress': return '#ff9800';
      case 'failed': return '#f44336';
      case 'pending': return '#9e9e9e';
      default: return '#e0e0e0';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return <CheckCircle />;
      case 'in_progress': return <Schedule />;
      case 'failed': return <Error />;
      default: return null;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'manual': return '#2196f3';
      case 'automatic': return '#4caf50';
      case 'approval': return '#ff9800';
      case 'system': return '#9c27b0';
      default: return '#757575';
    }
  };

  return (
    <Paper
      elevation={3}
      sx={{
        padding: 2,
        minWidth: 200,
        border: `2px solid ${getStatusColor(data.status)}`,
        cursor: data.onClick ? 'pointer' : 'default',
        '&:hover': data.onClick ? { boxShadow: 6 } : {},
      }}
      onClick={data.onClick}
    >
      <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
        <Chip
          label={data.type}
          size="small"
          sx={{ backgroundColor: getTypeColor(data.type), color: 'white' }}
        />
        {getStatusIcon(data.status)}
      </Box>
      
      <Typography variant="subtitle2" fontWeight="bold" mb={1}>
        {data.name}
      </Typography>
      
      {data.assignedTo && (
        <Box display="flex" alignItems="center" mb={1}>
          <Person fontSize="small" sx={{ mr: 0.5 }} />
          <Typography variant="caption">{data.assignedTo}</Typography>
        </Box>
      )}
      
      {data.estimatedDuration && (
        <Typography variant="caption" color="textSecondary">
          Est: {data.estimatedDuration}h
          {data.actualDuration && ` | Actual: ${data.actualDuration}h`}
        </Typography>
      )}
    </Paper>
  );
}

const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'TB') => {
  const nodeWidth = 220;
  const nodeHeight = 120;

  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  nodes.forEach((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    node.targetPosition = Position.Top;
    node.sourcePosition = Position.Bottom;
    node.position = {
      x: nodeWithPosition.x - nodeWidth / 2,
      y: nodeWithPosition.y - nodeHeight / 2,
    };
  });

  return { nodes, edges };
};

export const WorkflowVisualization: React.FC<WorkflowVisualizationProps> = ({
  definition,
  instance,
  onStepClick,
  onExecuteStep,
  interactive = false,
  height = 600,
}) => {
  const [selectedStep, setSelectedStep] = useState<WorkflowStep | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  // Convert workflow definition to React Flow nodes and edges
  const initialNodes: Node[] = definition.steps.map((step) => ({
    id: step.id,
    type: 'workflowStep',
    data: {
      ...step,
      onClick: () => {
        setSelectedStep(step);
        if (onStepClick) onStepClick(step);
        if (interactive) setDetailsOpen(true);
      },
    },
    position: { x: 0, y: 0 },
  }));

  const initialEdges: Edge[] = definition.transitions.map((transition, index) => ({
    id: `edge-${index}`,
    source: transition.from,
    target: transition.to,
    label: transition.label,
    animated: instance?.currentStepId === transition.from,
    style: {
      stroke: instance?.currentStepId === transition.from ? '#ff9800' : '#e0e0e0',
      strokeWidth: instance?.currentStepId === transition.from ? 3 : 1,
    },
  }));

  const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
    initialNodes,
    initialEdges
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  const onConnect = useCallback(
    (params: Connection) => setEdges((eds) => addEdge(params, eds)),
    [setEdges]
  );

  // Update node status based on instance
  useEffect(() => {
    if (instance) {
      setNodes((nds) =>
        nds.map((node) => {
          const step = definition.steps.find((s) => s.id === node.id);
          if (step) {
            return {
              ...node,
              data: {
                ...node.data,
                status: node.id === instance.currentStepId ? 'in_progress' : 
                        step.status || 'pending',
              },
            };
          }
          return node;
        })
      );
    }
  }, [instance, definition.steps, setNodes]);

  const handleExecuteStep = () => {
    if (selectedStep && onExecuteStep) {
      onExecuteStep(selectedStep.id);
      setDetailsOpen(false);
    }
  };

  return (
    <Box sx={{ height, width: '100%' }}>
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          attributionPosition="bottom-left"
        >
          <Controls />
          <MiniMap />
          <Background />
        </ReactFlow>
      </ReactFlowProvider>

      {/* Step Details Dialog */}
      <Dialog
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" justifyContent="space-between">
            <Typography variant="h6">{selectedStep?.name}</Typography>
            <Chip
              label={selectedStep?.status}
              color={selectedStep?.status === 'completed' ? 'success' : 
                     selectedStep?.status === 'in_progress' ? 'warning' : 'default'}
            />
          </Box>
        </DialogTitle>
        
        <DialogContent>
          {selectedStep && (
            <Box>
              <Typography variant="body2" color="textSecondary" mb={2}>
                Type: {selectedStep.type} | 
                {selectedStep.assignedTo && ` Assigned to: ${selectedStep.assignedTo}`}
              </Typography>

              {selectedStep.requiredDocuments && selectedStep.requiredDocuments.length > 0 && (
                <Box mb={2}>
                  <Typography variant="subtitle2" mb={1}>Required Documents:</Typography>
                  <List dense>
                    {selectedStep.requiredDocuments.map((doc, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <Info />
                        </ListItemIcon>
                        <ListItemText primary={doc} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {selectedStep.requiredTools && selectedStep.requiredTools.length > 0 && (
                <Box mb={2}>
                  <Typography variant="subtitle2" mb={1}>Required Tools:</Typography>
                  <List dense>
                    {selectedStep.requiredTools.map((tool, index) => (
                      <ListItem key={index}>
                        <ListItemIcon>
                          <Info />
                        </ListItemIcon>
                        <ListItemText primary={tool} />
                      </ListItem>
                    ))}
                  </List>
                </Box>
              )}

              {selectedStep.notes && (
                <Box mb={2}>
                  <Typography variant="subtitle2" mb={1}>Notes:</Typography>
                  <Typography variant="body2">{selectedStep.notes}</Typography>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setDetailsOpen(false)}>Close</Button>
          {interactive && selectedStep?.status === 'pending' && onExecuteStep && (
            <Button
              variant="contained"
              startIcon={<PlayArrow />}
              onClick={handleExecuteStep}
            >
              Execute Step
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default WorkflowVisualization;

// Export types
export type { WorkflowDefinition, WorkflowInstance, WorkflowStep };