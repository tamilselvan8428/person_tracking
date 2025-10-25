import { Link, NavLink } from 'react-router-dom'
import { useAuth } from '../store/auth'
import '../styles/components/NavBar.css'

export default function NavBar() {
  const { user, logout } = useAuth()
  const scopes = (user?.scopes || '').split(',').map(s=>s.trim()).filter(Boolean)
  const has = (s)=> scopes.includes(s)
  return (
    <nav className="nav">
      <div className="brand"><Link to="/">PersonTracker</Link></div>
      <div className="nav-right nav-links">
        <NavLink to="/" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Home</NavLink>
        {user ? (
          <>
            {(user.role === 'super_admin' || user.role === 'sub_admin') && (
              <NavLink to="/dashboard" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Dashboard</NavLink>
            )}
            {(user.role !== 'tenant_user' || has('tracking')) && (
              <NavLink to="/tracking" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Tracking</NavLink>
            )}
            {(user.role !== 'tenant_user' || has('config')) && (
              <NavLink to="/ble-config" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>BLE Config</NavLink>
            )}
            <NavLink to="/contact" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Contact</NavLink>
            <button className="btn" onClick={logout}>Logout</button>
          </>
        ) : (
          <NavLink to="/login" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Login</NavLink>
        )}
      </div>
    </nav>
  )
}
