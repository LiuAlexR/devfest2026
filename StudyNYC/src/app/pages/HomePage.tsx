import React, { useState, useEffect, useRef } from 'react';
import { StudySpot } from '../types';
import { StudySpotCard } from '../components/StudySpotCard';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Search, MapPin, Navigation, Loader2, Sparkles, X } from 'lucide-react';
import { publicAnonKey, projectId } from '../../../utils/supabase/info';
import { 
  getUserLocation, 
  requestUserLocation, 
  calculateDistance, 
  Coordinates, 
  clearLocationCookie 
} from '../utils/locationUtils';

export const HomePage: React.FC = () => {
  // --- STATE ---
  const [spots, setSpots] = useState<StudySpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  
  // Location & Filters
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'none' | 'distance' | 'rating'>('distance');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const observerTarget = useRef<HTMLDivElement>(null);

  // --- 1. INITIALIZATION ---
  useEffect(() => {
    initializeSpots();
    loadUserLocation();
  }, []);

  // --- 2. SMART SEARCH LOGIC (The "New" Feature) ---
  // Debounce the typing to prevent too many re-renders
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      
      // LOGIC: Automatically switch category based on keywords
      const term = searchQuery.toLowerCase();
      
      if (term.includes('outdoor') || term.includes('outside') || term.includes('nature')) {
        setFilterCategory('parks');
        if (userLocation) setSortBy('distance'); 
      } 
      else if (term.includes('quiet') || term.includes('library') || term.includes('study')) {
        setFilterCategory('libraries');
      }
      else if (term.includes('food') || term.includes('eat') || term.includes('restaurant')) {
        setFilterCategory('restaurants');
      }
      else if (term.includes('coffee') || term.includes('cafe')) {
        setFilterCategory('cafes');
      }
      // If the user clears the search, reset category if it was one of our auto-types
      else if (term === '') {
        setFilterCategory('all');
      }

    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, userLocation]);

  // --- 3. FETCH TRIGGER ---
  // Re-fetch whenever filters change
  useEffect(() => {
    fetchSpots(1, true);
  }, [debouncedSearch, filterCategory, sortBy, userLocation]);

  // Load more pages
  useEffect(() => {
    if (page > 1) fetchSpots(page, false);
  }, [page]);

  // Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && page < totalPages) {
          loadMoreSpots();
        }
      },
      { threshold: 0.1 }
    );
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [loadingMore, page, totalPages]);

  // --- 4. LOCATION FUNCTIONS (Restored from Working Version) ---
  const loadUserLocation = async () => {
    const location = await getUserLocation();
    if (location) {
      setUserLocation(location);
    }
  };

  const handleRequestLocation = async () => {
    setLocationLoading(true);
    const location = await requestUserLocation();
    if (location) {
      setUserLocation(location);
      setSortBy('distance');
      // Force a reset to ensure lists are re-sorted
      setPage(1);
      setSpots([]); 
    } else {
      alert('Unable to get your location. Please enable location services.');
    }
    setLocationLoading(false);
  };

  const handleClearLocation = () => {
    clearLocationCookie();
    setUserLocation(null);
    setSortBy('none'); // Reset sort if location is gone
  };

  // --- 5. DATA FETCHING (Combined Logic) ---
  const initializeSpots = async () => {
    try {
      await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-386acec3/init-spots`,
        {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${publicAnonKey}` },
        }
      );
    } catch (error) {
      console.error('Error initializing spots:', error);
    }
  };

  const fetchSpots = async (currentPage: number, reset: boolean = false) => {
    try {
      if (reset) setLoading(true);
      setLoadingMore(!reset);

      // SMART QUERY CLEANUP: 
      // If the search term is just a "trigger word" (like 'outdoor'), 
      // we don't want to send 'outdoor' as a text search to the server, 
      // because we are already filtering by Category=Parks.
      let textSearch = debouncedSearch;
      const triggers = ['outdoor', 'quiet', 'library', 'park', 'cafe', 'restaurant'];
      if (triggers.some(t => debouncedSearch.toLowerCase().includes(t))) {
         textSearch = ''; 
      }
      
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: sortBy === 'distance' ? '100' : '20', // Fetch more for distance to allow client sorting
        search: textSearch,
        category: filterCategory,
        sortBy: sortBy,
      });
      
      const url = `https://${projectId}.supabase.co/functions/v1/make-server-386acec3/spots?${params.toString()}`;
      
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        let spotsToSet = data.spots || [];
        
        // --- CLIENT SIDE DISTANCE SORTING (Restored from your working version) ---
        // This is crucial because the database might return paginated results not perfectly sorted by distance
        // if the dataset is large. This forces the UI to be correct.
        if (sortBy === 'distance' && userLocation) {
            
            // Helper to calc distance for a spot
            const getDist = (s: StudySpot) => calculateDistance(userLocation.latitude, userLocation.longitude, s.latitude, s.longitude);

            if (reset) {
              // Initial Load: Sort everything we got
              spotsToSet.sort((a: StudySpot, b: StudySpot) => getDist(a) - getDist(b));
              setSpots(spotsToSet);
            } else {
              // Load More: Merge new spots into the existing list in the correct order
              setSpots((prevSpots) => {
                const merged = [...prevSpots];
                spotsToSet.forEach((newSpot: StudySpot) => {
                   const newDist = getDist(newSpot);
                   let insertIndex = merged.length;
                   // Find where to insert to keep the list sorted
                   for(let i=0; i<merged.length; i++) {
                     if (newDist < getDist(merged[i])) {
                       insertIndex = i;
                       break;
                     }
                   }
                   merged.splice(insertIndex, 0, newSpot);
                });
                return merged;
              });
            }
        } else {
          // Standard handling for non-distance sorts
          setSpots(prev => reset ? spotsToSet : [...prev, ...spotsToSet]);
        }
        
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreSpots = () => setPage(p => p + 1);

  const getDistance = (spot: StudySpot): number | null => {
    if (!userLocation || !spot.latitude || !spot.longitude) return null;
    return calculateDistance(userLocation.latitude, userLocation.longitude, spot.latitude, spot.longitude);
  };

  // --- RENDER ---
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Find Your Perfect Study Spot
          </h1>
          <p className="text-xl text-blue-100 mb-8">
            Try typing "quiet" for libraries or "outdoor" for parks.
          </p>
          
          <div className="max-w-2xl relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search by name, neighborhood, or type 'outdoor'..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 py-6 text-lg bg-white text-gray-900 pr-12"
            />
            {searchQuery && (
               <button 
                 onClick={() => {
                   setSearchQuery('');
                   setFilterCategory('all');
                 }}
                 className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
               >
                 <X className="w-5 h-5" />
               </button>
            )}
          </div>

          {/* Visual Feedback for AI/Smart Search */}
          {(filterCategory !== 'all' && searchQuery !== '') && (
             <div className="mt-4 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 text-blue-100">
                <Sparkles className="w-4 h-4 text-yellow-300" />
                <span className="text-sm">
                  Smart Filter Active: Showing <span className="font-bold capitalize">{filterCategory}</span>
                </span>
             </div>
          )}
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {/* Controls */}
        <div className="mb-6 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex flex-wrap gap-3 items-center">
            
            {/* Location Buttons */}
            {!userLocation ? (
              <Button onClick={handleRequestLocation} disabled={locationLoading} variant="outline" className="flex items-center gap-2">
                <Navigation className="w-4 h-4" />
                {locationLoading ? 'Locating...' : 'Enable Location'}
              </Button>
            ) : (
              <Button onClick={handleClearLocation} variant="outline" size="sm" className="flex items-center gap-2 text-green-700 bg-green-50 border-green-200 hover:bg-green-100">
                <MapPin className="w-4 h-4" /> Location Active (Clear)
              </Button>
            )}
            
            {/* Category Filter */}
            <Select 
              value={filterCategory} 
              onValueChange={(value) => {
                setFilterCategory(value);
                setPage(1);
                setSpots([]);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="libraries">Libraries</SelectItem>
                <SelectItem value="cafes">Cafes</SelectItem>
                <SelectItem value="restaurants">Restaurants</SelectItem>
                <SelectItem value="parks">Parks</SelectItem>
                <SelectItem value="coworking">Co-working</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort Filter */}
            <Select 
              value={sortBy} 
              onValueChange={(value) => {
                setSortBy(value as 'none' | 'distance' | 'rating');
                setPage(1);
                setSpots([]);
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Alphabetical</SelectItem>
                <SelectItem value="distance" disabled={!userLocation}>
                  {userLocation ? 'Distance (Nearest)' : 'Distance (Enable Location)'}
                </SelectItem>
                <SelectItem value="rating">Rating (Highest)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results Grid */}
        {loading ? (
          <div className="text-center py-12">
            <Loader2 className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Finding best spots...</p>
          </div>
        ) : spots.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-xl border border-dashed">
            <p className="text-gray-600 mb-2">No study spots found.</p>
            <Button variant="link" onClick={() => {setFilterCategory('all'); setSearchQuery('');}}>
              View All Spots
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-4 text-sm text-gray-500">
                Found {total} spots
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {spots.map((spot) => (
                <StudySpotCard
                  key={spot.id || spot.key}
                  spot={spot}
                  averageRating={spot.avg_rating || 0}
                  reviewCount={spot.review_count || 0}
                  distance={getDistance(spot)}
                />
              ))}
            </div>

            {loadingMore && (
              <div className="text-center py-6">
                <Loader2 className="animate-spin h-6 w-6 text-gray-500 mx-auto" />
              </div>
            )}

            <div ref={observerTarget} className="h-10"></div>
          </>
        )}
      </div>
    </div>
  );
};