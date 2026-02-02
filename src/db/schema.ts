// src/db/schema.ts
import {
    mysqlTable,
    varchar,
    text,
    int,
    boolean,
    timestamp,
    mysqlEnum,
} from 'drizzle-orm/mysql-core';
import { sql } from 'drizzle-orm';

export const UserRole = ['ADMIN', 'PROJECT_MANAGER', 'TEAM_LEADER', 'DEVELOPER', 'DESIGNER', 'PROGRAMMER', 'QA'] as const;
export const TeamType = ['DEVELOPER', 'DESIGNER', 'PROGRAMMER'] as const;

export type UserRoleType = (typeof UserRole)[number];
export type TeamTypeType = (typeof TeamType)[number];

export const users = mysqlTable('users', {
    id: varchar('id', { length: 255 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    username: varchar('username', { length: 255 }).notNull().unique(),
    password: varchar('password', { length: 255 }).notNull(),
    role: mysqlEnum('role', UserRole).notNull(),
    team_type: mysqlEnum('team_type', TeamType),
    team_leader_id: varchar('team_leader_id', { length: 255 }),
    is_active: boolean('is_active').default(true).notNull(),
    created_at: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
    updated_at: timestamp('updated_at').onUpdateNow(),
});

// Projects Table
export const projects = mysqlTable('projects', {
    id: varchar('id', { length: 255 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    client_name: varchar('client_name', { length: 255 }),
    website_url: varchar('website_url', { length: 255 }),
    files: text('files'),
    fiverr_order_id: varchar('fiverr_order_id', { length: 255 }),
    status: mysqlEnum('status', ['CLIENT', 'COMPLETED']).notNull(),
    created_by: varchar('created_by', { length: 255 }).notNull(), // user.id
    created_at: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
    updated_at: timestamp('updated_at').onUpdateNow(),
});

// Tasks Table
export const tasks = mysqlTable('tasks', {
    id: varchar('id', { length: 255 }).primaryKey(),
    project_id: varchar('project_id', { length: 255 }).notNull(),
    team_type: mysqlEnum('team_type', TeamType).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    files: text('files'),
    priority: mysqlEnum('priority', ['LOW', 'MEDIUM', 'HIGH']).notNull(),
    assigned_by: varchar('assigned_by', { length: 255 }).notNull(),
    assigned_to: varchar('assigned_to', { length: 255 }).notNull(),
    qa_assigned_to: varchar('qa_assigned_to', { length: 255 }), // optional
    qa_assigned_at: timestamp('qa_assigned_at'), // ✅ NEW FIELD
    estimated_minutes: int('estimated_minutes'),
    status: mysqlEnum('status', [
      'IN_PROGRESS',
      'WAITING_FOR_QA',
      'APPROVED',
      'REWORK',
    ]).notNull(),
    started_at: timestamp('started_at'),
    completed_at: timestamp('completed_at'),
    locked_at: timestamp('locked_at'),
    created_at: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
    updated_at: timestamp('updated_at').default(sql`CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP`),
  });


// Task Timers Table
export const taskTimers = mysqlTable('task_timers', {
    id: varchar('id', { length: 255 }).primaryKey(),
    task_id: varchar('task_id', { length: 255 }).notNull(),
    start_time: timestamp('start_time').notNull(),
    end_time: timestamp('end_time'),
    duration_minutes: int('duration_minutes'),
    is_rework: boolean('is_rework').default(false).notNull(),
    created_at: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Unified Task Notes Table - UPDATED WITH FEEDBACK_IMAGE
export const taskNotes = mysqlTable('task_notes', {
    id: varchar('id', { length: 255 }).primaryKey(),
    task_id: varchar('task_id', { length: 255 }).notNull(),
    user_id: varchar('user_id', { length: 255 }).notNull(), // author
    note: text('note').notNull(),
    note_type: mysqlEnum('note_type', ['COMMENT', 'APPROVAL', 'REJECTION', 'FEEDBACK_IMAGE']).notNull(),
    metadata: text('metadata'), // for image data
    created_at: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Notifications Table
export const notifications = mysqlTable('notifications', {
  id: varchar('id', { length: 255 }).primaryKey(),
  user_id: varchar('user_id', { length: 255 }).notNull(),
  task_id: varchar('task_id', { length: 255 }).notNull(),
  type: mysqlEnum('type', [
    'TASK_ASSIGNED',
    'TASK_COMPLETED',
    'QA_REVIEWED',
    'READY_FOR_ASSIGNMENT',
    'TIME_EXCEEDED',
    'HELP_REQUEST', // ✅ ADD THIS
    'TASK_APPROVED',      // ✅ Added
    'TASK_REWORK',        // ✅ Added
    'TASK_RESUBMITTED',   // ✅ Added - for reassignment
  ]).notNull(),
  is_read: boolean('is_read').default(false).notNull(),
  created_at: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});