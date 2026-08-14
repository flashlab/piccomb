import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from '@/components/Layout'
import CollagePage from '@/pages/CollagePage'
import SplitPage from '@/pages/SplitPage'
import CropPage from '@/pages/CropPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Navigate to="/collage" replace />} />
          <Route path="/collage" element={<CollagePage />} />
          <Route path="/split" element={<SplitPage />} />
          <Route path="/crop" element={<CropPage />} />
          <Route path="*" element={<Navigate to="/collage" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
