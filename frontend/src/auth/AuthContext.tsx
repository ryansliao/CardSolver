import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react'
import {
  authApi,
  setAuthToken,
  clearAuthToken,
  getAuthToken,
  type AuthUser,
} from '../api/client'

interface AuthState {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  needsUsername: boolean
  signIn: (credential: string) => Promise<void>
  login: (email: string, password: string) => Promise<void>
  register: (username: string, email: string, password: string) => Promise<void>
  setUsername: (username: string) => Promise<void>
  signOut: () => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [needsUsername, setNeedsUsername] = useState(false)

  // On mount, validate existing token
  useEffect(() => {
    const token = getAuthToken()
    if (!token) {
      setIsLoading(false)
      return
    }
    authApi
      .me()
      .then((u) => {
        setUser(u)
        setNeedsUsername(u.needs_username ?? false)
      })
      .catch(() => {
        clearAuthToken()
      })
      .finally(() => setIsLoading(false))
  }, [])

  const signIn = useCallback(async (credential: string) => {
    const result = await authApi.googleSignIn(credential)
    if (result.token) {
      setAuthToken(result.token)
    }
    setUser(result)
    setNeedsUsername(result.needs_username ?? false)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const result = await authApi.login(email, password)
    if (result.token) {
      setAuthToken(result.token)
    }
    setUser(result)
    setNeedsUsername(result.needs_username ?? false)
  }, [])

  const register = useCallback(async (username: string, email: string, password: string) => {
    const result = await authApi.register(username, email, password)
    if (result.token) {
      setAuthToken(result.token)
    }
    setUser(result)
    setNeedsUsername(false)
  }, [])

  const setUsernameAction = useCallback(async (username: string) => {
    const result = await authApi.setUsername(username)
    setUser((prev) => (prev ? { ...prev, username: result.username, needs_username: false } : prev))
    setNeedsUsername(false)
  }, [])

  const signOut = useCallback(() => {
    clearAuthToken()
    setUser(null)
    setNeedsUsername(false)
    window.location.href = '/'
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: user !== null,
        isLoading,
        needsUsername,
        signIn,
        login,
        register,
        setUsername: setUsernameAction,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
