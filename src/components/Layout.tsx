import { NavLink, Outlet } from 'react-router-dom'

export function Layout() {
  return (
    <div className="app-shell">
      <nav className="nav-row" aria-label="主导航">
        <NavLink to="/" end>
          首页
        </NavLink>
        <NavLink to="/reading">阅读</NavLink>
        <NavLink to="/records">记录</NavLink>
        <NavLink to="/settings">设置</NavLink>
      </nav>
      <Outlet />
    </div>
  )
}
