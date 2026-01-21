// src/app/admin/register/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { UserRole, TeamType } from '@/db/schema';

type TeamLeader = {
  id: string;
  name: string;
  team_type: string;
};

export default function AdminRegisterPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === 'loading') {
    return <div className="p-6">Loading...</div>;
  }

  if (!session || session.user.role !== 'ADMIN') {
    router.push('/dashboard');
    return null;
  }

  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '',
    role: 'DEVELOPER' as const,
    team_type: '' as string | null,
    team_leader_id: '',
  });

  const [teamLeaders, setTeamLeaders] = useState<TeamLeader[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch team leaders
  useEffect(() => {
    const fetchTeamLeaders = async () => {
      try {
        const res = await fetch('/api/users/team-leaders');
        if (res.ok) {
          const data = await res.json();
          setTeamLeaders(data.teamLeaders || []);
        }
      } catch (err) {
        console.error(err);
      }
    };
    fetchTeamLeaders();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccess(true);
        setError(null);
        setFormData({
          name: '',
          username: '',
          password: '',
          role: 'DEVELOPER',
          team_type: '',
          team_leader_id: '',
        });
        setTimeout(() => {
          router.push('/dashboard');
        }, 1500);
      } else {
        setError(data.error || 'Failed to create user');
      }
    } catch (err) {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  // Determine if team_type is required
  const isTeamRole = !['ADMIN', 'PROJECT_MANAGER', 'QA'].includes(formData.role);

  // Handle team leader selection
  const handleTeamLeaderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tlId = e.target.value;
    setFormData(prev => ({
      ...prev,
      team_leader_id: tlId,
      team_type: tlId 
        ? teamLeaders.find(tl => tl.id === tlId)?.team_type || ''
        : prev.team_type
    }));
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-tr from-blue-50 to-purple-50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-2xl ring-1 ring-gray-200">
        <h1 className="mb-6 text-center text-3xl font-extrabold text-gray-800">
          Admin: Register New User
        </h1>

        {success && (
          <p className="mb-4 rounded-md bg-green-100 px-4 py-2 text-center text-sm text-green-700">
            User created successfully!
          </p>
        )}

        {error && (
          <p className="mb-4 rounded-md bg-red-100 px-4 py-2 text-center text-sm text-red-700">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Full Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              required
              className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2 text-gray-700 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          {/* Username */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Username
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) =>
                setFormData({ ...formData, username: e.target.value })
              }
              required
              className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2 text-gray-700 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              required
              className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2 text-gray-700 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Role
            </label>
            <select
              value={formData.role}
              onChange={(e) => {
                const newRole = e.target.value as any;
                setFormData({
                  ...formData,
                  role: newRole,
                  team_type: ['ADMIN', 'PROJECT_MANAGER', 'QA'].includes(newRole) ? '' : TeamType[0],
                  team_leader_id: '', // Reset when role changes
                });
              }}
              required
              className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2 text-gray-700 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            >
              {UserRole.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>
          </div>

          {/* Team Type */}
          {isTeamRole ? (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Team Type *
              </label>
              <select
                value={formData.team_type || ''}
                onChange={(e) =>
                  setFormData({ ...formData, team_type: e.target.value || null })
                }
                required
                className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2 text-gray-700 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value="">Select Team</option>
                {TeamType.map((team) => (
                  <option key={team} value={team}>
                    {team}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          {/* Team Leader Dropdown */}
          {isTeamRole && (
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Team Leader
              </label>
              <select
                value={formData.team_leader_id}
                onChange={handleTeamLeaderChange}
                className="mt-1 block w-full rounded-xl border border-gray-300 px-4 py-2 text-gray-700 shadow-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              >
                <option value="">— No Team Leader —</option>
                {teamLeaders.map((tl) => (
                  <option key={tl.id} value={tl.id}>
                    {tl.name} ({tl.team_type})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-gradient-to-r from-blue-500 to-purple-600 px-4 py-2 text-white shadow-md transition-transform hover:scale-105 hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-300 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create User'}
          </button>
        </form>
      </div>
    </div>
  );
}