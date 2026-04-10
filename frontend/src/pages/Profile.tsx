import { useAuth } from '../auth/AuthContext'
import { Navigate } from 'react-router-dom'

export default function Profile() {
  const { user, isAuthenticated, isLoading, signOut } = useAuth()

  if (isLoading) {
    return <div className="text-center text-slate-400 py-20">Loading...</div>
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="max-w-lg mx-auto mt-12">
      <h1 className="text-2xl font-bold text-white mb-8">Profile Settings</h1>

      <div className="bg-slate-900 border border-slate-700 rounded-xl p-6">
        <div className="flex items-center gap-4 mb-6 pb-6 border-b border-slate-700">
          {user.picture ? (
            <img
              src={user.picture}
              alt=""
              className="w-16 h-16 rounded-full"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-slate-700 flex items-center justify-center text-slate-400 text-xl font-bold">
              {user.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-white font-semibold text-lg">{user.username ?? user.name}</p>
            <p className="text-slate-400 text-sm">{user.email}</p>
          </div>
        </div>

        <div className="space-y-4">
          {user.username && (
            <div>
              <label className="text-slate-400 text-xs uppercase tracking-wide">Username</label>
              <p className="text-white text-sm mt-1">{user.username}</p>
            </div>
          )}
          <div>
            <label className="text-slate-400 text-xs uppercase tracking-wide">Name</label>
            <p className="text-white text-sm mt-1">{user.name}</p>
          </div>
          <div>
            <label className="text-slate-400 text-xs uppercase tracking-wide">Email</label>
            <p className="text-white text-sm mt-1">{user.email}</p>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-slate-700">
          <button
            type="button"
            onClick={signOut}
            className="text-sm font-medium px-5 py-2 rounded-full text-red-400 hover:text-red-300 hover:bg-slate-800 transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}
