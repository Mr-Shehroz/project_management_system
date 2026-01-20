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
export const TeamType = ['ADMIN', 'PROJECT_MANAGER', 'TEAM_LEADER', 'DEVELOPER', 'DESIGNER', 'PROGRAMMER', 'QA'] as const;

export type UserRoleType = (typeof UserRole)[number];
export type TeamTypeType = (typeof TeamType)[number];

export const users = mysqlTable('users', {
    id: varchar('id', { length: 255 }).primaryKey(),
    name: varchar('name', { length: 255 }).notNull(),
    username: varchar('username', { length: 255 }).notNull().unique(),
    password: varchar('password', { length: 255 }).notNull(),
    role: mysqlEnum('role', UserRole).notNull(),
    team_type: mysqlEnum('team_type', TeamType).notNull(),
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
    flavor_order_id: varchar('flavor_order_id', { length: 255 }),
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
    priority: mysqlEnum('priority', ['LOW', 'MEDIUM', 'HIGH']).notNull(),
    assigned_by: varchar('assigned_by', { length: 255 }).notNull(), // user.id
    assigned_to: varchar('assigned_to', { length: 255 }).notNull(), // user.id
    qa_assigned_to: varchar('qa_assigned_to', { length: 255 }), // optional
    estimated_minutes: int('estimated_minutes'),
    status: mysqlEnum('status', [
        'PENDING',
        'IN_PROGRESS',
        'WAITING_FOR_QA',
        'APPROVED',
        'REWORK',
    ]).notNull(),
    started_at: timestamp('started_at'),
    completed_at: timestamp('completed_at'),
    locked_at: timestamp('locked_at'),
    created_at: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
    updated_at: timestamp('updated_at').onUpdateNow(),
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

// Task Dev Notes Table
export const taskDevNotes = mysqlTable('task_dev_notes', {
    id: varchar('id', { length: 255 }).primaryKey(),
    task_id: varchar('task_id', { length: 255 }).notNull(),
    developer_id: varchar('developer_id', { length: 255 }).notNull(),
    note: text('note').notNull(),
    created_at: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Task QA Notes Table
export const taskQANotes = mysqlTable('task_qa_notes', {
    id: varchar('id', { length: 255 }).primaryKey(),
    task_id: varchar('task_id', { length: 255 }).notNull(),
    qa_id: varchar('qa_id', { length: 255 }).notNull(),
    status: mysqlEnum('status', ['APPROVED', 'REWORK']).notNull(),
    note: text('note').notNull(),
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
    ]).notNull(),
    is_read: boolean('is_read').default(false).notNull(),
    created_at: timestamp('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});