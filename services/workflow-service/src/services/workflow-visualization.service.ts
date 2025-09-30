import { db } from '@drms/shared-database';
import { UUID, WorkflowDefinition, WorkflowInstance } from '@drms/shared-types';
import { WorkflowExecutionService } from './workflow-execution.service';

export interface WorkflowVisualization {
  nodes: VisualizationNode[];
  edges: VisualizationEdge[];
  layout: LayoutInfo;
  metadata: VisualizationMetadata;
}

export interface VisualizationNode {
  id: string;
  type: 'step' | 'start' | 'end' | 'decision' | 'parallel';
  label: string;
  status?: 'pending' | 'active' | 'completed' | 'failed' | 'skipped';
  position: { x: number; y: number };
  data: {
    stepName: string;
    stepType: string;
    config?: any;
    executionData?: any;
    duration?: number;
    assignee?: string;
    issues?: any[];
  };
  style: NodeStyle;
}

export interface VisualizationEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type: 'default' | 'conditional' | 'parallel';
  conditions?: any[];
  style: EdgeStyle;
}

export interface NodeStyle {
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  borderWidth: number;
  opacity: number;
}

export interface EdgeStyle {
  strokeColor: string;
  strokeWidth: number;
  strokeDasharray?: string;
  opacity: number;
}

export interface LayoutInfo {
  algorithm: 'hierarchical' | 'force' | 'circular' | 'grid';
  direction: 'TB' | 'BT' | 'LR' | 'RL';
  spacing: { x: number; y: number };
  bounds: { width: number; height: number };
}

export interface VisualizationMetadata {
  workflowId: UUID;
  workflowName: string;
  instanceId?: UUID;
  status?: string;
  createdAt: Date;
  totalSteps: number;
  completedSteps: number;
  activeSteps: number;
  failedSteps: number;
}

export class WorkflowVisualizationService {
  private executionService: WorkflowExecutionService;

  constructor() {
    this.executionService = new WorkflowExecutionService();
  }

  /**
   * Generate visualization for workflow definition
   */
  async generateDefinitionVisualization(workflowId: UUID): Promise<WorkflowVisualization> {
    try {
      const workflow = await db.query(`
        SELECT 
          wd.*,
          json_agg(
            json_build_object(
              'id', ws.id,
              'name', ws.name,
              'type', ws.type,
              'position', ws.position,
              'config', ws.config
            ) ORDER BY ws.created_at
          ) as steps,
          json_agg(
            json_build_object(
              'id', wt.id,
              'fromStepId', wt.from_step_id,
              'toStepName', wt.to_step_name,
              'name', wt.name,
              'conditions', wt.conditions,
              'actions', wt.actions
            )
          ) FILTER (WHERE wt.id IS NOT NULL) as transitions
        FROM workflow_definitions wd
        LEFT JOIN workflow_steps ws ON wd.id = ws.workflow_definition_id
        LEFT JOIN workflow_transitions wt ON ws.id = wt.from_step_id
        WHERE wd.id = $1
        GROUP BY wd.id
      `, [workflowId]);

      if (workflow.rows.length === 0) {
        throw new Error('Workflow definition not found');
      }

      const workflowData = workflow.rows[0];
      const steps = workflowData.steps || [];
      const transitions = workflowData.transitions || [];

      const nodes = this.createDefinitionNodes(steps);
      const edges = this.createDefinitionEdges(transitions, steps);
      const layout = this.calculateLayout(nodes, edges);
      const metadata = this.createDefinitionMetadata(workflowData, steps);

      return {
        nodes,
        edges,
        layout,
        metadata
      };
    } catch (error) {
      console.error('Generate definition visualization error:', error);
      throw error;
    }
  }

  /**
   * Generate visualization for workflow instance
   */
  async generateInstanceVisualization(instanceId: UUID): Promise<WorkflowVisualization> {
    try {
      const instance = await this.executionService.getWorkflowInstance(instanceId);
      if (!instance) {
        throw new Error('Workflow instance not found');
      }

      // Get workflow definition
      const definitionViz = await this.generateDefinitionVisualization(instance.workflowDefinitionId);

      // Enhance with instance data
      const enhancedNodes = await this.enhanceNodesWithInstanceData(definitionViz.nodes, instanceId);
      const enhancedEdges = this.enhanceEdgesWithInstanceData(definitionViz.edges, instance);
      const enhancedMetadata = this.createInstanceMetadata(instance);

      return {
        nodes: enhancedNodes,
        edges: enhancedEdges,
        layout: definitionViz.layout,
        metadata: enhancedMetadata
      };
    } catch (error) {
      console.error('Generate instance visualization error:', error);
      throw error;
    }
  }

  /**
   * Generate execution path visualization
   */
  async generateExecutionPathVisualization(instanceId: UUID): Promise<WorkflowVisualization> {
    try {
      const instance = await this.executionService.getWorkflowInstance(instanceId);
      if (!instance) {
        throw new Error('Workflow instance not found');
      }

      // Get execution path
      const executionPath = await db.query(`
        SELECT 
          wsi.*,
          EXTRACT(EPOCH FROM (wsi.completed_at - wsi.activated_at)) as duration_seconds,
          u_activated.full_name as activated_by_name,
          u_completed.full_name as completed_by_name
        FROM workflow_step_instances wsi
        LEFT JOIN users u_activated ON wsi.activated_by = u_activated.id
        LEFT JOIN users u_completed ON wsi.completed_by = u_completed.id
        WHERE wsi.workflow_instance_id = $1
        ORDER BY wsi.activated_at NULLS LAST, wsi.created_at
      `, [instanceId]);

      const nodes = this.createExecutionPathNodes(executionPath.rows);
      const edges = this.createExecutionPathEdges(executionPath.rows);
      const layout = this.calculateTimelineLayout(nodes);
      const metadata = this.createInstanceMetadata(instance);

      return {
        nodes,
        edges,
        layout,
        metadata
      };
    } catch (error) {
      console.error('Generate execution path visualization error:', error);
      throw error;
    }
  }

  /**
   * Generate performance heatmap visualization
   */
  async generatePerformanceHeatmap(workflowId: UUID, timeRange: 'day' | 'week' | 'month' = 'week'): Promise<any> {
    try {
      const timeFilter = this.getTimeFilter(timeRange);

      const performanceData = await db.query(`
        SELECT 
          wsi.step_name,
          COUNT(*) as execution_count,
          AVG(EXTRACT(EPOCH FROM (wsi.completed_at - wsi.activated_at))) as avg_duration,
          MIN(EXTRACT(EPOCH FROM (wsi.completed_at - wsi.activated_at))) as min_duration,
          MAX(EXTRACT(EPOCH FROM (wsi.completed_at - wsi.activated_at))) as max_duration,
          COUNT(CASE WHEN wsi.status = 'failed' THEN 1 END) as failure_count,
          COUNT(CASE WHEN wsi.status = 'completed' THEN 1 END) as success_count
        FROM workflow_step_instances wsi
        JOIN workflow_instances wi ON wsi.workflow_instance_id = wi.id
        WHERE wi.workflow_definition_id = $1
          AND wi.started_at >= NOW() - INTERVAL '${timeFilter}'
          AND wsi.activated_at IS NOT NULL
          AND wsi.completed_at IS NOT NULL
        GROUP BY wsi.step_name
        ORDER BY avg_duration DESC
      `, [workflowId]);

      return {
        steps: performanceData.rows.map(row => ({
          stepName: row.step_name,
          executionCount: parseInt(row.execution_count),
          averageDuration: parseFloat(row.avg_duration) || 0,
          minDuration: parseFloat(row.min_duration) || 0,
          maxDuration: parseFloat(row.max_duration) || 0,
          failureCount: parseInt(row.failure_count),
          successCount: parseInt(row.success_count),
          successRate: parseInt(row.success_count) / parseInt(row.execution_count),
          performanceScore: this.calculatePerformanceScore(row)
        })),
        timeRange,
        generatedAt: new Date()
      };
    } catch (error) {
      console.error('Generate performance heatmap error:', error);
      throw error;
    }
  }

  /**
   * Export visualization as SVG
   */
  async exportVisualizationAsSVG(visualization: WorkflowVisualization): Promise<string> {
    try {
      const { nodes, edges, layout } = visualization;
      
      let svg = `<svg width="${layout.bounds.width}" height="${layout.bounds.height}" xmlns="http://www.w3.org/2000/svg">`;
      
      // Add styles
      svg += `<defs>
        <style>
          .node-text { font-family: Arial, sans-serif; font-size: 12px; text-anchor: middle; }
          .edge-text { font-family: Arial, sans-serif; font-size: 10px; text-anchor: middle; }
        </style>
      </defs>`;

      // Draw edges first (so they appear behind nodes)
      for (const edge of edges) {
        const sourceNode = nodes.find(n => n.id === edge.source);
        const targetNode = nodes.find(n => n.id === edge.target);
        
        if (sourceNode && targetNode) {
          svg += `<line x1="${sourceNode.position.x}" y1="${sourceNode.position.y}" 
                       x2="${targetNode.position.x}" y2="${targetNode.position.y}"
                       stroke="${edge.style.strokeColor}" 
                       stroke-width="${edge.style.strokeWidth}"
                       opacity="${edge.style.opacity}" />`;
          
          if (edge.label) {
            const midX = (sourceNode.position.x + targetNode.position.x) / 2;
            const midY = (sourceNode.position.y + targetNode.position.y) / 2;
            svg += `<text x="${midX}" y="${midY}" class="edge-text" fill="${edge.style.strokeColor}">
                      ${edge.label}
                    </text>`;
          }
        }
      }

      // Draw nodes
      for (const node of nodes) {
        const { x, y } = node.position;
        const { backgroundColor, borderColor, textColor, borderWidth } = node.style;
        
        // Draw node rectangle
        svg += `<rect x="${x - 60}" y="${y - 20}" width="120" height="40"
                     fill="${backgroundColor}" 
                     stroke="${borderColor}" 
                     stroke-width="${borderWidth}"
                     rx="5" ry="5" />`;
        
        // Draw node text
        svg += `<text x="${x}" y="${y + 5}" class="node-text" fill="${textColor}">
                  ${node.label}
                </text>`;
      }

      svg += '</svg>';
      
      return svg;
    } catch (error) {
      console.error('Export visualization as SVG error:', error);
      throw error;
    }
  }  /
**
   * Private helper methods
   */
  private createDefinitionNodes(steps: any[]): VisualizationNode[] {
    const nodes: VisualizationNode[] = [];

    for (const step of steps) {
      const node: VisualizationNode = {
        id: step.name,
        type: this.mapStepTypeToNodeType(step.type),
        label: step.name,
        position: step.position || { x: 0, y: 0 },
        data: {
          stepName: step.name,
          stepType: step.type,
          config: step.config
        },
        style: this.getDefaultNodeStyle(step.type)
      };

      nodes.push(node);
    }

    return nodes;
  }

  private createDefinitionEdges(transitions: any[], steps: any[]): VisualizationEdge[] {
    const edges: VisualizationEdge[] = [];

    for (const transition of transitions) {
      if (!transition.id) continue;

      const edge: VisualizationEdge = {
        id: `${transition.fromStepId}-${transition.toStepName}`,
        source: this.findStepNameById(transition.fromStepId, steps),
        target: transition.toStepName,
        label: transition.name,
        type: transition.conditions && transition.conditions.length > 0 ? 'conditional' : 'default',
        conditions: transition.conditions,
        style: this.getDefaultEdgeStyle('default')
      };

      if (edge.source) {
        edges.push(edge);
      }
    }

    return edges;
  }

  private async enhanceNodesWithInstanceData(nodes: VisualizationNode[], instanceId: UUID): Promise<VisualizationNode[]> {
    const stepInstances = await db.query(`
      SELECT 
        wsi.*,
        EXTRACT(EPOCH FROM (wsi.completed_at - wsi.activated_at)) as duration_seconds,
        u_activated.full_name as activated_by_name,
        u_completed.full_name as completed_by_name
      FROM workflow_step_instances wsi
      LEFT JOIN users u_activated ON wsi.activated_by = u_activated.id
      LEFT JOIN users u_completed ON wsi.completed_by = u_completed.id
      WHERE wsi.workflow_instance_id = $1
    `, [instanceId]);

    const stepInstanceMap = new Map();
    stepInstances.rows.forEach(si => {
      stepInstanceMap.set(si.step_name, si);
    });

    return nodes.map(node => {
      const stepInstance = stepInstanceMap.get(node.data.stepName);
      if (!stepInstance) return node;

      return {
        ...node,
        status: stepInstance.status,
        data: {
          ...node.data,
          executionData: stepInstance.execution_data,
          duration: stepInstance.duration_seconds ? parseFloat(stepInstance.duration_seconds) : undefined,
          assignee: stepInstance.activated_by_name || stepInstance.completed_by_name,
          activatedAt: stepInstance.activated_at,
          completedAt: stepInstance.completed_at,
          comment: stepInstance.comment,
          errorMessage: stepInstance.error_message
        },
        style: this.getNodeStyleByStatus(stepInstance.status)
      };
    });
  }

  private enhanceEdgesWithInstanceData(edges: VisualizationEdge[], instance: WorkflowInstance): VisualizationEdge[] {
    // This could be enhanced to show which transitions were taken
    return edges.map(edge => ({
      ...edge,
      style: this.getDefaultEdgeStyle('default')
    }));
  }

  private createExecutionPathNodes(stepInstances: any[]): VisualizationNode[] {
    const nodes: VisualizationNode[] = [];

    stepInstances.forEach((step, index) => {
      const node: VisualizationNode = {
        id: step.id,
        type: this.mapStepTypeToNodeType(step.step_type),
        label: step.step_name,
        status: step.status,
        position: { x: index * 200, y: 100 }, // Timeline layout
        data: {
          stepName: step.step_name,
          stepType: step.step_type,
          config: step.step_config,
          duration: step.duration_seconds ? parseFloat(step.duration_seconds) : undefined,
          assignee: step.activated_by_name || step.completed_by_name,
          activatedAt: step.activated_at,
          completedAt: step.completed_at,
          comment: step.comment,
          errorMessage: step.error_message
        },
        style: this.getNodeStyleByStatus(step.status)
      };

      nodes.push(node);
    });

    return nodes;
  }

  private createExecutionPathEdges(stepInstances: any[]): VisualizationEdge[] {
    const edges: VisualizationEdge[] = [];

    for (let i = 0; i < stepInstances.length - 1; i++) {
      const current = stepInstances[i];
      const next = stepInstances[i + 1];

      const edge: VisualizationEdge = {
        id: `${current.id}-${next.id}`,
        source: current.id,
        target: next.id,
        type: 'default',
        style: this.getDefaultEdgeStyle('default')
      };

      edges.push(edge);
    }

    return edges;
  }

  private calculateLayout(nodes: VisualizationNode[], edges: VisualizationEdge[]): LayoutInfo {
    // Simple hierarchical layout calculation
    const maxX = Math.max(...nodes.map(n => n.position.x), 0);
    const maxY = Math.max(...nodes.map(n => n.position.y), 0);

    return {
      algorithm: 'hierarchical',
      direction: 'TB',
      spacing: { x: 150, y: 100 },
      bounds: { 
        width: Math.max(maxX + 200, 800), 
        height: Math.max(maxY + 200, 600) 
      }
    };
  }

  private calculateTimelineLayout(nodes: VisualizationNode[]): LayoutInfo {
    return {
      algorithm: 'hierarchical',
      direction: 'LR',
      spacing: { x: 200, y: 100 },
      bounds: { 
        width: nodes.length * 200 + 100, 
        height: 300 
      }
    };
  }

  private createDefinitionMetadata(workflowData: any, steps: any[]): VisualizationMetadata {
    return {
      workflowId: workflowData.id,
      workflowName: workflowData.name,
      createdAt: workflowData.created_at,
      totalSteps: steps.length,
      completedSteps: 0,
      activeSteps: 0,
      failedSteps: 0
    };
  }

  private createInstanceMetadata(instance: WorkflowInstance): VisualizationMetadata {
    const stepCounts = instance.stepInstances.reduce((acc, step) => {
      switch (step.status) {
        case 'completed':
          acc.completed++;
          break;
        case 'active':
          acc.active++;
          break;
        case 'failed':
          acc.failed++;
          break;
      }
      return acc;
    }, { completed: 0, active: 0, failed: 0 });

    return {
      workflowId: instance.workflowDefinitionId,
      workflowName: instance.workflowName,
      instanceId: instance.id,
      status: instance.status,
      createdAt: instance.createdAt,
      totalSteps: instance.stepInstances.length,
      completedSteps: stepCounts.completed,
      activeSteps: stepCounts.active,
      failedSteps: stepCounts.failed
    };
  }

  private mapStepTypeToNodeType(stepType: string): VisualizationNode['type'] {
    switch (stepType) {
      case 'decision':
        return 'decision';
      case 'parallel':
        return 'parallel';
      default:
        return 'step';
    }
  }

  private getDefaultNodeStyle(stepType: string): NodeStyle {
    const baseStyle = {
      borderWidth: 2,
      opacity: 1,
      textColor: '#333333'
    };

    switch (stepType) {
      case 'manual':
        return {
          ...baseStyle,
          backgroundColor: '#E3F2FD',
          borderColor: '#2196F3'
        };
      case 'automatic':
        return {
          ...baseStyle,
          backgroundColor: '#E8F5E8',
          borderColor: '#4CAF50'
        };
      case 'decision':
        return {
          ...baseStyle,
          backgroundColor: '#FFF3E0',
          borderColor: '#FF9800'
        };
      case 'parallel':
        return {
          ...baseStyle,
          backgroundColor: '#F3E5F5',
          borderColor: '#9C27B0'
        };
      case 'wait':
        return {
          ...baseStyle,
          backgroundColor: '#FAFAFA',
          borderColor: '#757575'
        };
      default:
        return {
          ...baseStyle,
          backgroundColor: '#F5F5F5',
          borderColor: '#9E9E9E'
        };
    }
  }

  private getNodeStyleByStatus(status: string): NodeStyle {
    const baseStyle = {
      borderWidth: 2,
      opacity: 1,
      textColor: '#333333'
    };

    switch (status) {
      case 'active':
        return {
          ...baseStyle,
          backgroundColor: '#FFF9C4',
          borderColor: '#FBC02D'
        };
      case 'completed':
        return {
          ...baseStyle,
          backgroundColor: '#C8E6C9',
          borderColor: '#4CAF50'
        };
      case 'failed':
        return {
          ...baseStyle,
          backgroundColor: '#FFCDD2',
          borderColor: '#F44336'
        };
      case 'skipped':
        return {
          ...baseStyle,
          backgroundColor: '#E0E0E0',
          borderColor: '#757575',
          opacity: 0.7
        };
      case 'suspended':
        return {
          ...baseStyle,
          backgroundColor: '#FFECB3',
          borderColor: '#FF8F00'
        };
      default:
        return {
          ...baseStyle,
          backgroundColor: '#F5F5F5',
          borderColor: '#9E9E9E',
          opacity: 0.5
        };
    }
  }

  private getDefaultEdgeStyle(type: string): EdgeStyle {
    switch (type) {
      case 'conditional':
        return {
          strokeColor: '#FF9800',
          strokeWidth: 2,
          strokeDasharray: '5,5',
          opacity: 1
        };
      case 'parallel':
        return {
          strokeColor: '#9C27B0',
          strokeWidth: 3,
          opacity: 1
        };
      default:
        return {
          strokeColor: '#666666',
          strokeWidth: 2,
          opacity: 1
        };
    }
  }

  private findStepNameById(stepId: string, steps: any[]): string {
    const step = steps.find(s => s.id === stepId);
    return step ? step.name : '';
  }

  private calculatePerformanceScore(row: any): number {
    const avgDuration = parseFloat(row.avg_duration) || 0;
    const failureRate = parseInt(row.failure_count) / parseInt(row.execution_count);
    
    // Lower is better for duration, higher is better for success rate
    const durationScore = Math.max(0, 100 - (avgDuration / 60)); // Normalize to minutes
    const successScore = (1 - failureRate) * 100;
    
    return (durationScore + successScore) / 2;
  }

  private getTimeFilter(timeRange: 'day' | 'week' | 'month'): string {
    switch (timeRange) {
      case 'day':
        return '1 day';
      case 'week':
        return '1 week';
      case 'month':
        return '1 month';
      default:
        return '1 week';
    }
  }
}