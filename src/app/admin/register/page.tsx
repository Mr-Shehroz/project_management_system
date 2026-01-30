'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { UserRole, TeamType } from '@/db/schema';
import { UserPlus, Loader2, CheckCircle } from 'lucide-react';

type TeamLeader = {
  id: string;
  name: string;
  team_type: string;
};

export default function AdminRegisterPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
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
        setFormData({
          name: '',
          username: '',
          password: '',
          role: 'DEVELOPER',
          team_type: '',
          team_leader_id: '',
        });
        setTimeout(() => router.push('/dashboard'), 1500);
      } else {
        setError(data.error || 'Failed to create user');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  };

  const isTeamRole = !['ADMIN', 'PROJECT_MANAGER', 'QA'].includes(formData.role);

  const handleTeamLeaderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const tlId = e.target.value;
    setFormData(prev => ({
      ...prev,
      team_leader_id: tlId,
      team_type: tlId
        ? teamLeaders.find(tl => tl.id === tlId)?.team_type || ''
        : prev.team_type,
    }));
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900 p-4">
      <div className="w-full max-w-lg">
        {/* Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-purple-600 px-8 py-6">
            <div className="flex items-center justify-center gap-3">
              <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                <UserPlus className="w-6 h-6 text-white" />
              </div>
              <h1 className="text-2xl font-bold text-white">
                Admin Registration
              </h1>
            </div>
            <p className="text-center text-blue-100 mt-2 text-sm">
              Create a new user account
            </p>
          </div>

          {/* Form */}
          <div className="p-8">
            {success && (
              <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2 justify-center">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <p className="text-sm text-green-800 dark:text-green-200">
                  User created successfully!
                </p>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p className="text-sm text-red-800 dark:text-red-200 text-center">
                  {error}
                </p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {[
                { label: 'Full Name', key: 'name', type: 'text' },
                { label: 'Username', key: 'username', type: 'text' },
                { label: 'Password', key: 'password', type: 'password' },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {field.label}
                  </label>
                  <input
                    type={field.type}
                    value={(formData as any)[field.key]}
                    onChange={(e) =>
                      setFormData({ ...formData, [field.key]: e.target.value })
                    }
                    required
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              ))}

              {/* Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Role
                </label>
                <select
                  value={formData.role}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      role: e.target.value as any,
                      team_type: '',
                      team_leader_id: '',
                    })
                  }
                  className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  {UserRole.map(role => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>

              {/* Team Type */}
              {isTeamRole && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Team Type
                  </label>
                  <select
                    value={formData.team_type || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, team_type: e.target.value })
                    }
                    required
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                  >
                    <option value="">Select Team</option>
                    {TeamType.map(team => (
                      <option key={team} value={team}>
                        {team}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Team Leader */}
              {isTeamRole && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Team Leader
                  </label>
                  <select
                    value={formData.team_leader_id}
                    onChange={handleTeamLeaderChange}
                    className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg"
                  >
                    <option value="">— No Team Leader —</option>
                    {teamLeaders.map(tl => (
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
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 shadow-lg"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <UserPlus className="w-5 h-5" />
                    Create User
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Footer */}
          <div className="px-8 py-6 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-700">
            <p className="text-center text-sm text-gray-600 dark:text-gray-400">
              Admin access only
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
