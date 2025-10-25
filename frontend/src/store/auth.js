import { create } from 'zustand'
import { setAuthToken } from '../api/client'

export const useAuth = create((set) => ({
  token: null,
  user: null,
  login: (token, user) => {
    setAuthToken(token)
    set({ token, user })
  },
  logout: () => {
    setAuthToken(null)
    set({ token: null, user: null })
  }
}))
