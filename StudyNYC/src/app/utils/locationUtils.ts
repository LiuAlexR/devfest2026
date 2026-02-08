import Cookies from 'js-cookie';

export interface Coordinates {
  latitude: number;
  longitude: number;
}

const LOCATION_COOKIE_NAME = 'user_location';
const LOCATION_EXPIRY_DAYS = 7;

// Haversine formula to calculate distance between two coordinates in miles
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 3959; // Earth's radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  
  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

function toRad(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Save user location to cookies
export function saveLocationToCookie(coords: Coordinates): void {
  Cookies.set(LOCATION_COOKIE_NAME, JSON.stringify(coords), { 
    expires: LOCATION_EXPIRY_DAYS 
  });
}

// Get user location from cookies
export function getLocationFromCookie(): Coordinates | null {
  const locationStr = Cookies.get(LOCATION_COOKIE_NAME);
  if (locationStr) {
    try {
      return JSON.parse(locationStr);
    } catch (e) {
      return null;
    }
  }
  return null;
}

// Request user's current location from browser
export async function requestUserLocation(): Promise<Coordinates | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords: Coordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        saveLocationToCookie(coords);
        resolve(coords);
      },
      (error) => {
        console.warn('Geolocation error:', error.message);
        resolve(null);
      },
      {
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
}

// Get location from cookie, or request new location
export async function getUserLocation(): Promise<Coordinates | null> {
  const savedLocation = getLocationFromCookie();
  if (savedLocation) {
    return savedLocation;
  }
  return await requestUserLocation();
}

// Clear location from cookies
export function clearLocationCookie(): void {
  Cookies.remove(LOCATION_COOKIE_NAME);
}
