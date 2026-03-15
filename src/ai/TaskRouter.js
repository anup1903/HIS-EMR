/**
 * Cross-System Task Router
 * Routes clinical and operational tasks to the right care team members.
 * Bridges EHR orders, agent actions, n8n workflows, and manual requests
 * into a unified task queue with priority-based assignment.
 */

const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../database/db');

class TaskRouter {
    /**
     * Route a new task to the appropriate assignee
     */
    static route(params) {
        const db = getDb();
        const id = uuidv4();
        const {
            patient_id, encounter_id, task_type, priority = 'normal',
            title, description, assignee_role, assigned_to,
            source_system = 'manual', due_at, metadata = {},
            agent_session_id
        } = params;

        // Auto-determine assignee role if not specified
        const role = assignee_role || this._inferRole(task_type);
        const inferredPriority = priority || this._inferPriority(task_type);

        db.prepare(`
            INSERT INTO care_tasks (id, patient_id, encounter_id, task_type, priority, status,
                title, description, assignee_role, assigned_to, source_system, due_at, metadata, agent_session_id)
            VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(id, patient_id || null, encounter_id || null, task_type, inferredPriority,
            title, description || '', role, assigned_to || null,
            source_system, due_at || null, JSON.stringify(metadata), agent_session_id || null);

        return {
            task_id: id,
            status: 'pending',
            assignee_role: role,
            priority: inferredPriority,
            task_type,
            title
        };
    }

    /**
     * List tasks with filters
     */
    static list(filters = {}) {
        const db = getDb();
        const where = [];
        const params = [];

        if (filters.status) { where.push('status = ?'); params.push(filters.status); }
        if (filters.assignee_role) { where.push('assignee_role = ?'); params.push(filters.assignee_role); }
        if (filters.priority) { where.push('priority = ?'); params.push(filters.priority); }
        if (filters.patient_id) { where.push('patient_id = ?'); params.push(filters.patient_id); }
        if (filters.task_type) { where.push('task_type = ?'); params.push(filters.task_type); }
        if (filters.source_system) { where.push('source_system = ?'); params.push(filters.source_system); }

        const clause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
        const limit = filters.limit || 50;

        const tasks = db.prepare(`SELECT * FROM care_tasks ${clause} ORDER BY
            CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 WHEN 'low' THEN 4 END,
            created_at ASC LIMIT ?`).all(...params, limit);

        tasks.forEach(t => { t.metadata = JSON.parse(t.metadata || '{}'); });
        return tasks;
    }

    /**
     * Update task status
     */
    static updateStatus(taskId, status, assignedTo = null) {
        const db = getDb();
        const task = db.prepare('SELECT * FROM care_tasks WHERE id = ?').get(taskId);
        if (!task) throw new Error(`Task ${taskId} not found`);

        const updates = ['status = ?', 'updated_at = datetime(\'now\')'];
        const params = [status];

        if (assignedTo) { updates.push('assigned_to = ?'); params.push(assignedTo); }
        if (status === 'completed') { updates.push("completed_at = datetime('now')"); }

        params.push(taskId);
        db.prepare(`UPDATE care_tasks SET ${updates.join(', ')} WHERE id = ?`).run(...params);

        return { task_id: taskId, status, assigned_to: assignedTo };
    }

    /**
     * Escalate a task
     */
    static escalate(taskId, reason) {
        const db = getDb();
        const task = db.prepare('SELECT * FROM care_tasks WHERE id = ?').get(taskId);
        if (!task) throw new Error(`Task ${taskId} not found`);

        const metadata = JSON.parse(task.metadata || '{}');
        metadata.escalation_reason = reason;
        metadata.escalated_at = new Date().toISOString();
        metadata.original_priority = task.priority;

        db.prepare(`
            UPDATE care_tasks SET status = 'escalated', priority = 'critical',
                metadata = ?, updated_at = datetime('now') WHERE id = ?
        `).run(JSON.stringify(metadata), taskId);

        return { task_id: taskId, status: 'escalated', priority: 'critical', reason };
    }

    /**
     * Get task queue metrics
     */
    static getMetrics() {
        const db = getDb();
        const total = db.prepare('SELECT COUNT(*) as count FROM care_tasks').get().count;
        const pending = db.prepare("SELECT COUNT(*) as count FROM care_tasks WHERE status = 'pending'").get().count;
        const inProgress = db.prepare("SELECT COUNT(*) as count FROM care_tasks WHERE status = 'in_progress'").get().count;
        const completed = db.prepare("SELECT COUNT(*) as count FROM care_tasks WHERE status = 'completed'").get().count;
        const escalated = db.prepare("SELECT COUNT(*) as count FROM care_tasks WHERE status = 'escalated'").get().count;

        const byRole = db.prepare(`
            SELECT assignee_role, COUNT(*) as count FROM care_tasks
            WHERE status IN ('pending', 'in_progress', 'escalated')
            GROUP BY assignee_role ORDER BY count DESC
        `).all();

        const byPriority = db.prepare(`
            SELECT priority, COUNT(*) as count FROM care_tasks
            WHERE status IN ('pending', 'in_progress', 'escalated')
            GROUP BY priority
        `).all();

        return { total, pending, in_progress: inProgress, completed, escalated, by_role: byRole, by_priority: byPriority };
    }

    // ── Auto-inference helpers ──────────────────────────────────────

    static _inferRole(taskType) {
        const roleMap = {
            prior_auth: 'billing',
            discharge: 'case_manager',
            referral: 'case_manager',
            order: 'physician',
            lab: 'nurse',
            imaging: 'nurse',
            consult: 'physician',
            follow_up: 'scheduler',
            documentation: 'physician',
            medication: 'pharmacist',
            transport: 'nurse',
            insurance: 'billing'
        };
        return roleMap[taskType] || 'nurse';
    }

    static _inferPriority(taskType) {
        const highPriority = ['prior_auth', 'order', 'consult', 'medication'];
        const lowPriority = ['documentation', 'follow_up'];
        if (highPriority.includes(taskType)) return 'high';
        if (lowPriority.includes(taskType)) return 'low';
        return 'normal';
    }
}

module.exports = TaskRouter;
