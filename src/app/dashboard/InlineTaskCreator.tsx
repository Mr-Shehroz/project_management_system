// src/app/dashboard/InlineTaskCreator.tsx
'use client';

import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';

type User = {
  id: string;
  name: string;
  username: string;
  team_type: string;
  role: string;
};

type Project = {
  id: string;
  name: string;
};

export default function InlineTaskCreator({
  projects,
  teamMembers,
  onCreate,
  selectedProjectId,
}: {
  projects: Project[];
  teamMembers: User[];
  onCreate: (task: {
    title: string;
    projectId: string;
    teamType: string;
    assignedTo: string;
    priority: string;
    estimatedMinutes: number | null;
  }) => Promise<boolean>;
  selectedProjectId?: string | null;
}) {
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [projectId, setProjectId] = useState(selectedProjectId || '');
  const [teamType, setTeamType] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [priority, setPriority] = useState('MEDIUM');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');

  // Auto-set project when selectedProjectId changes
  useEffect(() => {
    if (selectedProjectId) {
      setProjectId(selectedProjectId);
    }
  }, [selectedProjectId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !projectId || !teamType || !assignedTo) {
      toast.error('Please fill all required fields');
      return;
    }

    // Validate estimated minutes if provided
    const minutes = estimatedMinutes ? parseInt(estimatedMinutes) : null;
    if (estimatedMinutes && (isNaN(minutes!) || minutes! <= 0)) {
      toast.error('Please enter a valid time estimate');
      return;
    }

    // Pass data to parent component - parent handles API call
    const taskData = {
      title: title.trim(),
      projectId,
      teamType,
      assignedTo,
      priority,
      estimatedMinutes: minutes,
    };

    const success = await onCreate(taskData);
    
    if (success) {
      // Reset form but keep project if selected
      setTitle('');
      setTeamType('');
      setAssignedTo('');
      setPriority('MEDIUM');
      setEstimatedMinutes('');
      setIsCreating(false);
    }
  };

  const filteredTeamMembers = teamMembers.filter(user => user.team_type === teamType);

  if (!isCreating) {
    return (
      <button
        onClick={() => setIsCreating(true)}
        className="w-full px-3 py-2 text-left text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg transition-colors"
      >
        + Add Task
      </button>
    );
  }

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
      <form onSubmit={handleSubmit} className="space-y-2">
        {/* Task Title */}
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Task title..."
          className="w-full px-2 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          autoFocus
        />
        
        {/* Project Selector - Only show if no project is selected */}
        {!selectedProjectId && (
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full px-2 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Select Project</option>
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        )}

        {/* Show project name if already selected */}
        {selectedProjectId && (
          <div className="px-2 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded text-gray-700 dark:text-gray-300">
            {projects.find(p => p.id === selectedProjectId)?.name || 'Selected Project'}
          </div>
        )}

        {/* Team Type */}
        <select
          value={teamType}
          onChange={(e) => {
            setTeamType(e.target.value);
            setAssignedTo(''); // Reset assignee when team changes
          }}
          className="w-full px-2 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Select Team</option>
          <option value="DEVELOPER">Developer</option>
          <option value="DESIGNER">Designer</option>
        </select>

        {/* Assignee */}
        {teamType && (
          <select
            value={assignedTo}      
            onChange={(e) => setAssignedTo(e.target.value)}
            className="w-full px-2 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Assign To</option>
            {filteredTeamMembers.map(user => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.username})
              </option>
            ))}
          </select>
        )}

        {/* Priority and Time Estimate Row */}
        <div className="grid grid-cols-2 gap-2">
          {/* Priority */}
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="w-full px-2 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="LOW">🟢 Low</option>
            <option value="MEDIUM">🟡 Medium</option>
            <option value="HIGH">🔴 High</option>
          </select>

          {/* Time Estimate */}
          <div className="relative">
            <input
              type="number"
              value={estimatedMinutes}
              onChange={(e) => setEstimatedMinutes(e.target.value)}
              placeholder="Time (min)"
              min="1"
              className="w-full px-2 py-1.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {estimatedMinutes && (
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">
                min
              </span>
            )}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex space-x-2 pt-1">
          <button
            type="submit"
            disabled={!title.trim() || !projectId || !teamType || !assignedTo}
            className="flex-1 px-2 py-1 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Create
          </button>
          <button
            type="button"
            onClick={() => {
              setIsCreating(false);
              setTitle('');
              setTeamType('');
              setAssignedTo('');
              setPriority('MEDIUM');
              setEstimatedMinutes('');
            }}
            className="px-2 py-1 text-xs bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 text-gray-700 dark:text-gray-300 rounded transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}