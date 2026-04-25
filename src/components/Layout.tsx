import { Outlet, useLocation } from 'react-router-dom'

export function Layout() {
  const location = useLocation()
  const immersiveReading = location.pathname === '/reading'
  const homePage = location.pathname === '/'
  const widePage = homePage || location.pathname === '/bestiary'

  return (
    <div className={`app-shell${immersiveReading ? ' app-shell--reading' : ''}${widePage ? ' app-shell--home' : ''}`}>
      <Outlet />
    </div>
  )
}
