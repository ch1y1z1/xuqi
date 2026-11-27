import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { XuqiApi, ApiError } from '@/api/client'
import type { User } from '@shared/api/types'

const DEFAULT_BASE_URL = '/api/v1'
const TOKEN_SESSION_KEY = 'xuqi.session-token'
const TOKEN_LOCAL_KEY = 'xuqi.local-token'
const BASE_URL_KEY = 'xuqi.api-base-url'

type SessionStatus = 'demo' | 'connecting' | 'connected' | 'error'

interface ConnectInput {
  baseUrl: string
  token: string
  remember: boolean
}

interface SessionContextValue {
  api: XuqiApi | null
  baseUrl: string
  token: string
  status: SessionStatus
  user: User | null
  error: string | null
  connect: (input: ConnectInput) => Promise<boolean>
  logout: () => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

function readInitialBaseUrl() {
  return localStorage.getItem(BASE_URL_KEY) ?? sessionStorage.getItem(BASE_URL_KEY) ?? DEFAULT_BASE_URL
}

function readInitialToken() {
  return localStorage.getItem(TOKEN_LOCAL_KEY) ?? sessionStorage.getItem(TOKEN_SESSION_KEY) ?? ''
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [baseUrl, setBaseUrl] = useState(readInitialBaseUrl)
  const [token, setToken] = useState(readInitialToken)
  const [status, setStatus] = useState<SessionStatus>(() => (readInitialToken() ? 'connecting' : 'demo'))
  const [user, setUser] = useState<User | null>(null)
  const [error, setError] = useState<string | null>(null)

  const api = useMemo(() => (token ? new XuqiApi(baseUrl, token) : null), [baseUrl, token])

  const connect = useCallback(async (input: ConnectInput) => {
    const nextBaseUrl = input.baseUrl.trim() || DEFAULT_BASE_URL
    const nextToken = input.token.trim()
    if (!nextToken) {
      setError('请填入 API token')
      setStatus('error')
      return false
    }
    setStatus('connecting')
    setError(null)
    const nextApi = new XuqiApi(nextBaseUrl, nextToken)
    try {
      const nextUser = await nextApi.getMe()
      sessionStorage.setItem(BASE_URL_KEY, nextBaseUrl)
      localStorage.setItem(BASE_URL_KEY, nextBaseUrl)
      sessionStorage.setItem(TOKEN_SESSION_KEY, nextToken)
      if (input.remember) localStorage.setItem(TOKEN_LOCAL_KEY, nextToken)
      else localStorage.removeItem(TOKEN_LOCAL_KEY)
      setBaseUrl(nextBaseUrl)
      setToken(nextToken)
      setUser(nextUser)
      setStatus('connected')
      return true
    } catch (cause) {
      setUser(null)
      setStatus('error')
      setError(cause instanceof ApiError ? cause.message : '连接失败')
      return false
    }
  }, [])

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_SESSION_KEY)
    localStorage.removeItem(TOKEN_LOCAL_KEY)
    setToken('')
    setUser(null)
    setStatus('demo')
    setError(null)
  }, [])

  const value = useMemo(
    () => ({ api, baseUrl, token, status, user, error, connect, logout }),
    [api, baseUrl, token, status, user, error, connect, logout],
  )
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
}

export function useSession() {
  const value = useContext(SessionContext)
  if (!value) throw new Error('useSession must be used within SessionProvider')
  return value
}
