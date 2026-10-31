import { useEffect } from 'react';
import { createBrowserRouter, createMemoryRouter, RouterProvider, type RouteObject } from 'react-router-dom';
import { DEMO } from '../core/demo';
import { LabPage } from '../labs/LabPage';
import { Landing } from '../landing/Landing';
import { Layout } from './Layout';

const routes: RouteObject[] = [
  {
    element: <Layout />,
    children: [
      { path: '/', element: <Landing /> },
      { path: '/lab/:subject', element: <LabPage /> },
      { path: '*', element: <LabPage /> },
    ],
  },
];

/** The demo build runs in a sandboxed frame where the URL path isn't available, so it routes in memory and mirrors only `#physics`-style names into the hash. */
const SUBJECTS = ['biology', 'physics', 'chemistry'];
const fromHash = () => {
  const name = typeof location === 'undefined' ? '' : location.hash.replace(/^#/, '');
  return SUBJECTS.includes(name) ? `/lab/${name}` : '/';
};

const router = DEMO ? createMemoryRouter(routes, { initialEntries: [fromHash()] }) : createBrowserRouter(routes);

function useHashMirror() {
  useEffect(() => {
    if (!DEMO) return;
    const unsub = router.subscribe((state) => {
      const subject = /^\/lab\/(\w+)/.exec(state.location.pathname)?.[1] ?? '';
      try {
        if (location.hash.replace(/^#/, '') !== subject) history.replaceState(null, '', subject ? `#${subject}` : location.pathname + location.search);
      } catch {
        /* the host may forbid it; navigation still works */
      }
    });
    const onHash = () => void router.navigate(fromHash());
    window.addEventListener('hashchange', onHash);
    return () => {
      unsub();
      window.removeEventListener('hashchange', onHash);
    };
  }, []);
}

export function App() {
  useHashMirror();
  return <RouterProvider router={router} />;
}
