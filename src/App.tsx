import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { Reading } from './pages/Reading'
import { Records } from './pages/Records'
import { Result } from './pages/Result'

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="reading" element={<Reading />} />
        <Route path="result" element={<Result />} />
        <Route path="records" element={<Records />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
