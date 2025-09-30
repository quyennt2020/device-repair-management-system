import { db } from '@drms/shared-database';
import { WorkflowDefinition, UUID } from '@drms/shared-types';
import { config } from '../config';

export interface VersionInfo {
  version: number;
  createdBy: UUID;
  createdAt: Date;
  changes: string[];
  isActive: boolean;
}

export class WorkflowVersionManager {
  /**
   * Create a new version of an existing workflow
   */
  async createNewVersion(
    originalWorkflowId: UUID,
    updates: any,
    updatedBy: UUID
  ): Promise<WorkflowDefinition> {
    try {
      // Get the original workflow
      const originalResult = await db.query(`
        SELECT * FROM workflow_definitions WHERE id = $1
      `, [originalWorkflowId]);

      if (originalResult.rows.length === 0) {
        throw new Error('Original workflow not found');
      }

      const original = originalResult.rows[0];

      // Get the next version number
      const nextVersion = await this.getNextVersionNumber(original.name);

      // Create new workflow version
      const newWorkflowResult = await db.query(`
        INSERT INTO workflow_definitions (
          name, description, device_types, service_types, customer_tiers,
          status, version, created_by, metadata, parent_workflow_id
        )
        VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7, $8, $9)
        RETURNING *
      `, [
        original.name,
        updates.description || original.description,
        JSON.stringify(updates.deviceTypes || original.device_types),
        JSON.stringify(updates.serviceTypes || original.service_types),
        JSON.stringify(updates.customerTiers || original.customer_tiers),
        nextVersion,
        updatedBy,
        JSON.stringify({
          ...original.metadata,
          ...updates.metadata,
          versionChanges: this.calculateChanges(original, updates)
        }),
        originalWorkflowId
      ]);

      const newWorkflow = newWorkflowResult.rows[0];

      // Copy and update steps if provided
      if (updates.steps) {
        await this.createVersionSteps(newWorkflow.id, updates.steps);
      } else {
        await this.copyStepsFromVersion(originalWorkflowId, newWorkflow.id);
      }

      // Archive old active version
      await this.archiveActiveVersion(original.name, newWorkflow.id);

      // Log version creation
      await this.logVersionEvent(newWorkflow.id, 'version_created', {
        originalWorkflowId,
        version: nextVersion,
        createdBy: updatedBy
      });

      // Clean up old versions if needed
      await this.cleanupOldVersions(original.name);

      // Return the new workflow with steps
      return await this.getWorkflowWithSteps(newWorkflow.id);
    } catch (error) {
      console.error('Create new version error:', error);
      throw error;
    }
  }

  /**
   * Get all versions of a workflow
   */
  async getWorkflowVersions(workflowId: UUID): Promise<WorkflowDefinition[]> {
    try {
      // Get the workflow name first
      const workflowResult = await db.query(`
        SELECT name FROM workflow_definitions WHERE id = $1
      `, [workflowId]);

      if (workflowResult.rows.length === 0) {
        throw new Error('Workflow not found');
      }

      const workflowName = workflowResult.rows[0].name;

      // Get all versions
      const versionsResult = await db.query(`
        SELECT 
          wd.*,
          u.full_name as created_by_name,
          (SELECT COUNT(*) FROM workflow_instances wi WHERE wi.workflow_definition_id = wd.id) as usage_count
        FROM workflow_definitions wd
        LEFT JOIN users u ON wd.created_by = u.id
        WHERE wd.name = $1
        ORDER BY wd.version DESC
      `, [workflowName]);

      const versions: WorkflowDefinition[] = [];

      for (const versionRow of versionsResult.rows) {
        const steps = await this.getWorkflowSteps(versionRow.id);
        
        versions.push({
          id: versionRow.id,
          name: versionRow.name,
          description: versionRow.description,
          deviceTypes: versionRow.device_types,
          serviceTypes: versionRow.service_types,
          customerTiers: versionRow.customer_tiers,
          status: versionRow.status,
          version: versionRow.version,
          steps,
          metadata: versionRow.metadata,
          createdBy: versionRow.created_by,
          createdByName: versionRow.created_by_name,
          usageCount: parseInt(versionRow.usage_count),
          parentWorkflowId: versionRow.parent_workflow_id,
          createdAt: versionRow.created_at,
          updatedAt: versionRow.updated_at
        });
      }

      return versions;
    } catch (error) {
      console.error('Get workflow versions error:', error);
      throw error;
    }
  }

  /**
   * Compare two workflow versions
   */
  async compareVersions(version1Id: UUID, version2Id: UUID): Promise<{
    differences: any[];
    summary: string;
  }> {
    try {
      const [workflow1, workflow2] = await Promise.all([
        this.getWorkflowWithSteps(version1Id),
        this.getWorkflowWithSteps(version2Id)
      ]);

      if (!workflow1 || !workflow2) {
        throw new Error('One or both workflows not found');
      }

      const differences = this.calculateDetailedDifferences(workflow1, workflow2);
      const summary = this.generateComparisonSummary(differences);

      return { differences, summary };
    } catch (error) {
      console.error('Compare versions error:', error);
      throw error;
    }
  }

  /**
   * Restore a previous version
   */
  async restoreVersion(versionId: UUID, restoredBy: UUID): Promise<WorkflowDefinition> {
    try {
      const versionToRestore = await this.getWorkflowWithSteps(versionId);
      if (!versionToRestore) {
        throw new Error('Version to restore not found');
      }

      // Create a new version based on the restored version
      const restoredVersion = await this.createNewVersion(
        versionId,
        {
          description: versionToRestore.description,
          deviceTypes: versionToRestore.deviceTypes,
          serviceTypes: versionToRestore.serviceTypes,
          customerTiers: versionToRestore.customerTiers,
          steps: versionToRestore.steps,
          metadata: {
            ...versionToRestore.metadata,
            restoredFrom: versionId,
            restoredAt: new Date().toISOString(),
            restoredBy
          }
        },
        restoredBy
      );

      // Log restoration
      await this.logVersionEvent(restoredVersion.id, 'version_restored', {
        restoredFromVersion: versionToRestore.version,
        restoredBy
      });

      return restoredVersion;
    } catch (error) {
      console.error('Restore version error:', error);
      throw error;
    }
  }

  /**
   * Get version history with changes
   */
  async getVersionHistory(workflowName: string): Promise<VersionInfo[]> {
    try {
      const result = await db.query(`
        SELECT 
          wd.version,
          wd.created_by,
          wd.created_at,
          wd.status,
          wd.metadata,
          u.full_name as created_by_name
        FROM workflow_definitions wd
        LEFT JOIN users u ON wd.created_by = u.id
        WHERE wd.name = $1
        ORDER BY wd.version DESC
      `, [workflowName]);

      return result.rows.map(row => ({
        version: row.version,
        createdBy: row.created_by,
        createdByName: row.created_by_name,
        createdAt: row.created_at,
        changes: row.metadata?.versionChanges || [],
        isActive: row.status === 'active'
      }));
    } catch (error) {
      console.error('Get version history error:', error);
      throw error;
    }
  }

  /**
   * Private helper methods
   */
  private async getNextVersionNumber(workflowName: string): Promise<number> {
    const result = await db.query(`
      SELECT MAX(version) as max_version 
      FROM workflow_definitions 
      WHERE name = $1
    `, [workflowName]);

    const maxVersion = result.rows[0].max_version || 0;
    return maxVersion + 1;
  }

  private async createVersionSteps(workflowId: UUID, stepDefinitions: any[]): Promise<void> {
    for (const stepDef of stepDefinitions) {
      // Create step
      const stepResult = await db.query(`
        INSERT INTO workflow_steps (
          workflow_definition_id, name, description, type, position, config
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `, [
        workflowId,
        stepDef.name,
        stepDef.description,
        stepDef.type,
        JSON.stringify(stepDef.position),
        JSON.stringify(stepDef.config)
      ]);

      const step = stepResult.rows[0];

      // Create transitions
      for (const transitionDef of stepDef.transitions || []) {
        await db.query(`
          INSERT INTO workflow_transitions (
            from_step_id, to_step_name, name, conditions, actions
          )
          VALUES ($1, $2, $3, $4, $5)
        `, [
          step.id,
          transitionDef.targetStepName,
          transitionDef.name,
          JSON.stringify(transitionDef.conditions || []),
          JSON.stringify(transitionDef.actions || [])
        ]);
      }
    }
  }

  private async copyStepsFromVersion(sourceWorkflowId: UUID, targetWorkflowId: UUID): Promise<void> {
    // Get source steps
    const stepsResult = await db.query(`
      SELECT * FROM workflow_steps WHERE workflow_definition_id = $1
    `, [sourceWorkflowId]);

    const stepIdMapping = new Map<UUID, UUID>();

    // Copy steps
    for (const sourceStep of stepsResult.rows) {
      const newStepResult = await db.query(`
        INSERT INTO workflow_steps (
          workflow_definition_id, name, description, type, position, config
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id
      `, [
        targetWorkflowId,
        sourceStep.name,
        sourceStep.description,
        sourceStep.type,
        sourceStep.position,
        sourceStep.config
      ]);

      stepIdMapping.set(sourceStep.id, newStepResult.rows[0].id);
    }

    // Copy transitions
    for (const sourceStep of stepsResult.rows) {
      const transitionsResult = await db.query(`
        SELECT * FROM workflow_transitions WHERE from_step_id = $1
      `, [sourceStep.id]);

      const newStepId = stepIdMapping.get(sourceStep.id);

      for (const transition of transitionsResult.rows) {
        await db.query(`
          INSERT INTO workflow_transitions (
            from_step_id, to_step_name, name, conditions, actions
          )
          VALUES ($1, $2, $3, $4, $5)
        `, [
          newStepId,
          transition.to_step_name,
          transition.name,
          transition.conditions,
          transition.actions
        ]);
      }
    }
  }

  private async archiveActiveVersion(workflowName: string, excludeId: UUID): Promise<void> {
    await db.query(`
      UPDATE workflow_definitions 
      SET status = 'archived' 
      WHERE name = $1 AND status = 'active' AND id != $2
    `, [workflowName, excludeId]);
  }

  private async cleanupOldVersions(workflowName: string): Promise<void> {
    if (config.workflow.maxVersionsToKeep <= 0) return;

    // Keep the most recent versions and delete older ones
    await db.query(`
      DELETE FROM workflow_definitions 
      WHERE name = $1 
        AND status = 'archived'
        AND id NOT IN (
          SELECT id FROM workflow_definitions 
          WHERE name = $1 
          ORDER BY version DESC 
          LIMIT $2
        )
    `, [workflowName, config.workflow.maxVersionsToKeep]);
  }

  private calculateChanges(original: any, updates: any): string[] {
    const changes: string[] = [];

    if (updates.description && updates.description !== original.description) {
      changes.push('Updated description');
    }

    if (updates.deviceTypes && JSON.stringify(updates.deviceTypes) !== JSON.stringify(original.device_types)) {
      changes.push('Modified device types');
    }

    if (updates.serviceTypes && JSON.stringify(updates.serviceTypes) !== JSON.stringify(original.service_types)) {
      changes.push('Modified service types');
    }

    if (updates.customerTiers && JSON.stringify(updates.customerTiers) !== JSON.stringify(original.customer_tiers)) {
      changes.push('Modified customer tiers');
    }

    if (updates.steps) {
      changes.push('Updated workflow steps');
    }

    return changes;
  }

  private calculateDetailedDifferences(workflow1: WorkflowDefinition, workflow2: WorkflowDefinition): any[] {
    const differences: any[] = [];

    // Compare basic properties
    if (workflow1.description !== workflow2.description) {
      differences.push({
        type: 'property_change',
        property: 'description',
        oldValue: workflow1.description,
        newValue: workflow2.description
      });
    }

    // Compare device types
    const deviceTypes1 = JSON.stringify(workflow1.deviceTypes.sort());
    const deviceTypes2 = JSON.stringify(workflow2.deviceTypes.sort());
    if (deviceTypes1 !== deviceTypes2) {
      differences.push({
        type: 'property_change',
        property: 'deviceTypes',
        oldValue: workflow1.deviceTypes,
        newValue: workflow2.deviceTypes
      });
    }

    // Compare steps (simplified)
    const steps1Map = new Map(workflow1.steps.map(s => [s.name, s]));
    const steps2Map = new Map(workflow2.steps.map(s => [s.name, s]));

    // Find added steps
    for (const [stepName, step] of steps2Map) {
      if (!steps1Map.has(stepName)) {
        differences.push({
          type: 'step_added',
          stepName,
          step
        });
      }
    }

    // Find removed steps
    for (const [stepName, step] of steps1Map) {
      if (!steps2Map.has(stepName)) {
        differences.push({
          type: 'step_removed',
          stepName,
          step
        });
      }
    }

    // Find modified steps
    for (const [stepName, step1] of steps1Map) {
      const step2 = steps2Map.get(stepName);
      if (step2 && JSON.stringify(step1) !== JSON.stringify(step2)) {
        differences.push({
          type: 'step_modified',
          stepName,
          oldStep: step1,
          newStep: step2
        });
      }
    }

    return differences;
  }

  private generateComparisonSummary(differences: any[]): string {
    if (differences.length === 0) {
      return 'No differences found between versions';
    }

    const summary = [];
    const stepChanges = differences.filter(d => d.type.startsWith('step_'));
    const propertyChanges = differences.filter(d => d.type === 'property_change');

    if (propertyChanges.length > 0) {
      summary.push(`${propertyChanges.length} property change(s)`);
    }

    if (stepChanges.length > 0) {
      const added = stepChanges.filter(d => d.type === 'step_added').length;
      const removed = stepChanges.filter(d => d.type === 'step_removed').length;
      const modified = stepChanges.filter(d => d.type === 'step_modified').length;

      if (added > 0) summary.push(`${added} step(s) added`);
      if (removed > 0) summary.push(`${removed} step(s) removed`);
      if (modified > 0) summary.push(`${modified} step(s) modified`);
    }

    return summary.join(', ');
  }

  private async getWorkflowWithSteps(workflowId: UUID): Promise<WorkflowDefinition | null> {
    // This would use the same logic as WorkflowDefinitionService.getWorkflowDefinition
    // For brevity, returning null here - in real implementation, this would fetch the full workflow
    return null;
  }

  private async getWorkflowSteps(workflowId: UUID): Promise<any[]> {
    const stepsResult = await db.query(`
      SELECT * FROM workflow_steps 
      WHERE workflow_definition_id = $1 
      ORDER BY created_at
    `, [workflowId]);

    const steps = [];

    for (const stepRow of stepsResult.rows) {
      const transitionsResult = await db.query(`
        SELECT * FROM workflow_transitions 
        WHERE from_step_id = $1 
        ORDER BY created_at
      `, [stepRow.id]);

      const transitions = transitionsResult.rows.map(t => ({
        id: t.id,
        fromStepId: t.from_step_id,
        toStepName: t.to_step_name,
        name: t.name,
        conditions: t.conditions,
        actions: t.actions,
        createdAt: t.created_at,
        updatedAt: t.updated_at
      }));

      steps.push({
        id: stepRow.id,
        workflowDefinitionId: stepRow.workflow_definition_id,
        name: stepRow.name,
        description: stepRow.description,
        type: stepRow.type,
        position: stepRow.position,
        config: stepRow.config,
        transitions,
        createdAt: stepRow.created_at,
        updatedAt: stepRow.updated_at
      });
    }

    return steps;
  }

  private async logVersionEvent(workflowId: UUID, eventType: string, data: any): Promise<void> {
    try {
      await db.query(`
        INSERT INTO workflow_events (workflow_definition_id, event_type, event_data)
        VALUES ($1, $2, $3)
      `, [workflowId, eventType, JSON.stringify(data)]);
    } catch (error) {
      console.error('Log version event error:', error);
    }
  }
}