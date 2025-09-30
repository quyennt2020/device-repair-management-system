import { UUID, CasePriority } from '@drms/shared-types';
import { db } from '@drms/shared-database';
import { config } from '../config';

export interface AssignmentCriteria {
  deviceType: string;
  category: string;
  priority: CasePriority;
  location?: string;
}

export interface TechnicianScore {
  id: UUID;
  name: string;
  email: string;
  score: number;
  skillMatch: number;
  workload: number;
  availability: boolean;
  location?: string;
  distance?: number;
}

export class TechnicianAssignmentService {
  /**
   * Auto-assign technician based on skills, workload, and availability
   */
  async autoAssignTechnician(caseId: UUID, criteria: AssignmentCriteria): Promise<{ id: UUID; name: string } | null> {
    try {
      const candidates = await this.findTechnicianCandidates(criteria);
      if (candidates.length === 0) {
        return null;
      }

      // Score and rank candidates
      const scoredCandidates = await this.scoreTechnicians(candidates, criteria);
      
      // Sort by score (highest first)
      scoredCandidates.sort((a, b) => b.score - a.score);

      const bestCandidate = scoredCandidates[0];
      
      // Log assignment decision
      console.log(`Auto-assigning case ${caseId} to technician ${bestCandidate.name} (score: ${bestCandidate.score})`);

      return {
        id: bestCandidate.id,
        name: bestCandidate.name
      };
    } catch (error) {
      console.error('Auto assign technician error:', error);
      return null;
    }
  }

  /**
   * Get technician workload (active cases count)
   */
  async getTechnicianWorkload(technicianId: UUID): Promise<number> {
    try {
      const result = await db.query(`
        SELECT COUNT(*) as workload
        FROM repair_cases
        WHERE assigned_technician_id = $1 
        AND status IN ('assigned', 'in_progress', 'waiting_parts', 'waiting_customer')
      `, [technicianId]);

      return parseInt(result.rows[0].workload);
    } catch (error) {
      console.error('Get technician workload error:', error);
      return 0;
    }
  }

  /**
   * Get available technicians for assignment
   */
  async getAvailableTechnicians(criteria?: AssignmentCriteria): Promise<TechnicianScore[]> {
    try {
      const candidates = await this.findTechnicianCandidates(criteria);
      return await this.scoreTechnicians(candidates, criteria);
    } catch (error) {
      console.error('Get available technicians error:', error);
      return [];
    }
  }

  /**
   * Check if technician can be assigned more cases
   */
  async canAssignMoreCases(technicianId: UUID): Promise<boolean> {
    try {
      const workload = await this.getTechnicianWorkload(technicianId);
      return workload < config.case.maxCasesPerTechnician;
    } catch (error) {
      console.error('Can assign more cases error:', error);
      return false;
    }
  }

  /**
   * Get technician performance metrics
   */
  async getTechnicianPerformance(technicianId: UUID, days: number = 30): Promise<{
    completedCases: number;
    averageResolutionTime: number;
    customerSatisfaction: number;
    onTimeCompletion: number;
  }> {
    try {
      const result = await db.query(`
        SELECT 
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_cases,
          AVG(CASE WHEN completed_at IS NOT NULL THEN EXTRACT(EPOCH FROM (completed_at - created_at))/3600 END) as avg_resolution_hours,
          AVG(CASE WHEN completed_at <= sla_due_date THEN 1.0 ELSE 0.0 END) as on_time_rate
        FROM repair_cases
        WHERE assigned_technician_id = $1 
        AND created_at >= NOW() - INTERVAL '${days} days'
      `, [technicianId]);

      const row = result.rows[0];
      
      // Get customer satisfaction (would come from feedback/ratings)
      const satisfactionResult = await db.query(`
        SELECT AVG(rating) as avg_rating
        FROM case_feedback
        WHERE case_id IN (
          SELECT id FROM repair_cases 
          WHERE assigned_technician_id = $1 
          AND completed_at >= NOW() - INTERVAL '${days} days'
        )
      `, [technicianId]);

      return {
        completedCases: parseInt(row.completed_cases) || 0,
        averageResolutionTime: parseFloat(row.avg_resolution_hours) || 0,
        customerSatisfaction: parseFloat(satisfactionResult.rows[0]?.avg_rating) || 0,
        onTimeCompletion: parseFloat(row.on_time_rate) || 0
      };
    } catch (error) {
      console.error('Get technician performance error:', error);
      return {
        completedCases: 0,
        averageResolutionTime: 0,
        customerSatisfaction: 0,
        onTimeCompletion: 0
      };
    }
  }

  // Private helper methods

  private async findTechnicianCandidates(criteria?: AssignmentCriteria): Promise<any[]> {
    let query = `
      SELECT 
        t.id,
        u.full_name as name,
        u.email,
        t.location,
        t.skills,
        t.certifications,
        t.is_active,
        COUNT(rc.id) as current_workload
      FROM technicians t
      JOIN users u ON t.user_id = u.id
      LEFT JOIN repair_cases rc ON t.id = rc.assigned_technician_id 
        AND rc.status IN ('assigned', 'in_progress', 'waiting_parts', 'waiting_customer')
      WHERE t.is_active = true 
      AND u.deleted_at IS NULL
    `;

    const params = [];
    let paramCount = 1;

    // Add skill filtering if device type or category specified
    if (criteria?.deviceType || criteria?.category) {
      query += ` AND (`;
      const skillConditions = [];
      
      if (criteria.deviceType) {
        skillConditions.push(`t.skills ? $${paramCount}`);
        params.push(criteria.deviceType);
        paramCount++;
      }
      
      if (criteria.category) {
        skillConditions.push(`t.skills ? $${paramCount}`);
        params.push(criteria.category);
        paramCount++;
      }
      
      query += skillConditions.join(' OR ') + ')';
    }

    query += `
      GROUP BY t.id, u.full_name, u.email, t.location, t.skills, t.certifications, t.is_active
      HAVING COUNT(rc.id) < $${paramCount}
      ORDER BY COUNT(rc.id)
    `;
    
    params.push(config.case.maxCasesPerTechnician);

    const result = await db.query(query, params);
    return result.rows;
  }

  private async scoreTechnicians(candidates: any[], criteria?: AssignmentCriteria): Promise<TechnicianScore[]> {
    const scored: TechnicianScore[] = [];

    for (const candidate of candidates) {
      let score = 0;
      let skillMatch = 0;
      const workload = parseInt(candidate.current_workload);

      // Skill matching (40% of score)
      if (criteria) {
        const skills = candidate.skills || {};
        let matchedSkills = 0;
        let totalSkills = 0;

        if (criteria.deviceType) {
          totalSkills++;
          if (skills[criteria.deviceType]) {
            matchedSkills++;
          }
        }

        if (criteria.category) {
          totalSkills++;
          if (skills[criteria.category]) {
            matchedSkills++;
          }
        }

        skillMatch = totalSkills > 0 ? (matchedSkills / totalSkills) * 100 : 50;
        score += skillMatch * 0.4;
      } else {
        skillMatch = 50; // Default skill match
        score += 20; // 40% of 50
      }

      // Workload balancing (30% of score)
      const workloadScore = Math.max(0, (config.case.maxCasesPerTechnician - workload) / config.case.maxCasesPerTechnician * 100);
      score += workloadScore * 0.3;

      // Availability (20% of score) - for now, all active technicians are considered available
      const availabilityScore = 100;
      score += availabilityScore * 0.2;

      // Location proximity (10% of score) - simplified for now
      let locationScore = 50; // Default score
      if (criteria?.location && candidate.location) {
        // In a real implementation, this would calculate actual distance
        locationScore = candidate.location === criteria.location ? 100 : 30;
      }
      score += locationScore * 0.1;

      scored.push({
        id: candidate.id,
        name: candidate.name,
        email: candidate.email,
        score: Math.round(score),
        skillMatch: Math.round(skillMatch),
        workload,
        availability: true,
        location: candidate.location
      });
    }

    return scored;
  }

  /**
   * Suggest technician reassignment based on workload balancing
   */
  async suggestReassignments(): Promise<Array<{
    caseId: UUID;
    currentTechnicianId: UUID;
    suggestedTechnicianId: UUID;
    reason: string;
  }>> {
    try {
      // Find overloaded technicians
      const overloadedResult = await db.query(`
        SELECT 
          t.id as technician_id,
          u.full_name as technician_name,
          COUNT(rc.id) as workload
        FROM technicians t
        JOIN users u ON t.user_id = u.id
        JOIN repair_cases rc ON t.id = rc.assigned_technician_id
        WHERE rc.status IN ('assigned', 'in_progress', 'waiting_parts', 'waiting_customer')
        AND t.is_active = true
        GROUP BY t.id, u.full_name
        HAVING COUNT(rc.id) > $1
        ORDER BY COUNT(rc.id) DESC
      `, [config.case.maxCasesPerTechnician]);

      const suggestions = [];

      for (const overloaded of overloadedResult.rows) {
        // Find cases that could be reassigned (lowest priority, newest)
        const casesResult = await db.query(`
          SELECT id, priority, created_at
          FROM repair_cases
          WHERE assigned_technician_id = $1
          AND status IN ('assigned', 'waiting_parts', 'waiting_customer')
          ORDER BY 
            priority = 'low' DESC,
            priority = 'medium' DESC,
            created_at DESC
          LIMIT 3
        `, [overloaded.technician_id]);

        for (const caseRow of casesResult.rows) {
          // Find available technicians
          const availableResult = await db.query(`
            SELECT 
              t.id,
              u.full_name,
              COUNT(rc.id) as workload
            FROM technicians t
            JOIN users u ON t.user_id = u.id
            LEFT JOIN repair_cases rc ON t.id = rc.assigned_technician_id 
              AND rc.status IN ('assigned', 'in_progress', 'waiting_parts', 'waiting_customer')
            WHERE t.is_active = true 
            AND t.id != $1
            GROUP BY t.id, u.full_name
            HAVING COUNT(rc.id) < $2
            ORDER BY COUNT(rc.id)
            LIMIT 1
          `, [overloaded.technician_id, config.case.maxCasesPerTechnician - 1]);

          if (availableResult.rows.length > 0) {
            const available = availableResult.rows[0];
            suggestions.push({
              caseId: caseRow.id,
              currentTechnicianId: overloaded.technician_id,
              suggestedTechnicianId: available.id,
              reason: `Workload balancing: ${overloaded.technician_name} (${overloaded.workload} cases) -> ${available.full_name} (${available.workload} cases)`
            });
          }
        }
      }

      return suggestions;
    } catch (error) {
      console.error('Suggest reassignments error:', error);
      return [];
    }
  }
}