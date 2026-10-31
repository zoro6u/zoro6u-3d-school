import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Layout } from './Layout';
import { Landing } from '../landing/Landing';
import { LabPage } from '../labs/LabPage';

const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Landing /> },
      { path: '/lab/:subject', element: <LabPage /> },
      { path: '*', element: <LabPage /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
