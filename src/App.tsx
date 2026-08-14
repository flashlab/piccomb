import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import Layout from '@/components/Layout'
import CollagePage from '@/pages/CollagePage'
import SplitPage from '@/pages/SplitPage'
import CropPage from '@/pages/CropPage'

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <Navigate to="/collage" replace /> },
      { path: 'collage', element: <CollagePage /> },
      { path: 'split', element: <SplitPage /> },
      { path: 'crop', element: <CropPage /> },
      { path: '*', element: <Navigate to="/collage" replace /> },
    ],
  },
])

export default function App() {
  return <RouterProvider router={router} />
}
