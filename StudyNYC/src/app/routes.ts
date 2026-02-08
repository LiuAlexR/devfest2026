import { createBrowserRouter } from 'react-router';
import { RootLayout } from './layouts/RootLayout';
import { HomePage } from './pages/HomePage';
import { SpotDetailPage } from './pages/SpotDetailPage';
import { ReviewWritePage } from './pages/ReviewWritePage';
import { LoginPage } from './pages/LoginPage';
import { SignUpPage } from './pages/SignUpPage';
import { HistoryPage } from './pages/HistoryPage';
import { NotFoundPage } from './pages/NotFoundPage';

export const router = createBrowserRouter([
  {
    path: '/',
    Component: RootLayout,
    children: [
      {
        index: true,
        Component: HomePage,
      },
      {
        path: 'spot/:spotId',
        Component: SpotDetailPage,
      },
      {
        path: 'spot/:spotId/review',
        Component: ReviewWritePage,
      },
      {
        path: 'history',
        Component: HistoryPage,
      },
      {
        path: '*',
        Component: NotFoundPage,
      },
    ],
  },
  {
    path: '/login',
    Component: LoginPage,
  },
  {
    path: '/signup',
    Component: SignUpPage,
  },
]);