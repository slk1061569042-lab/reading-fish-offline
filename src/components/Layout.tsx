import { Outlet, useLocation } from 'react-router-dom'

export function Layout() {
  const location = useLocation()
  const immersiveReading = location.pathname === '/reading'

  return (
    <div className={`app-shell${immersiveReading ? ' app-shell--reading' : ''}`}>
      <Outlet />
    </div>
  )
}
