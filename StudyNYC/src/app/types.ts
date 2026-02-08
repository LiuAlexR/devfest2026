export interface StudySpot {
  id: string;
  name: string;
  type: 'libraries' | 'cafes' | 'restaurants' | 'parks' | 'co-working';
  address: string;
  neighborhood: string;
  wifi: boolean;
  outlets: boolean;
  hours: string;
  noise: 'Quiet' | 'Moderate' | 'Loud';
  latitude: number;
  longitude: number;
  description?: string;
}

export interface Review {
  id: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
}