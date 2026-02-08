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
  // --- State ---
  const [spots, setSpots] = useState<StudySpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  
  // Filters & Location
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'none' | 'distance' | 'rating'>('distance'); // Default to distance
  const [filterCategory, setFilterCategory] = useState<string>('all');
  
  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const observerTarget = useRef<HTMLDivElement>(null);

  // --- 1. SIMPLIFIED SEARCH LOGIC ---
  const handleSearchLogic = (query: string) => {
    if (!query.trim()) {
      setFilterCategory('all');
      return;
    }

    const lowerQuery = query.toLowerCase();

    // RULE 1: "outdoor" -> Park
    if (lowerQuery.includes('outdoor') || lowerQuery.includes('outside')) {
      setFilterCategory('parks');
    } 
    // RULE 2: "quiet" -> Library
    else if (lowerQuery.includes('quiet') || lowerQuery.includes('silent')) {
      setFilterCategory('libraries');
    }
    // RULE 3: "restaurant" (Explicit check since you mentioned you have 3 categories)
    else if (lowerQuery.includes('restaurant') || lowerQuery.includes('food')) {
      setFilterCategory('restaurants');
    }

    // RULE 4: Always sort by distance when searching
    if (userLocation) {
        setSortBy('distance');
    } else {
        // If they don't have location yet, ask for it
        handleRequestLocation();
    }
  };

  // --- 2. Search Effect (Debounce) ---
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearchLogic(searchQuery);
    }, 600); 

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // --- 3. Main Data Fetch ---
  useEffect(() => {
    fetchSpots(1, true);
  }, [filterCategory, sortBy, userLocation]); 

  // --- 4. Pagination Trigger ---
  useEffect(() => {
    if (page > 1) fetchSpots(page, false);
  }, [page]);

  // --- 5. Init ---
  useEffect(() => {
    initializeSpots();
    loadUserLocation();
  }, []);

  // --- Infinite Scroll ---
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && page < totalPages) {
          loadMoreSpots();
        }
      }, { threshold: 0.1 }
    );
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [loadingMore, page, totalPages]);


  // --- Helper Functions ---
  const loadUserLocation = async () => {
    const location = await getUserLocation();
    if (location) setUserLocation(location);
  };

  const handleRequestLocation = async () => {
    setLocationLoading(true);
    const location = await requestUserLocation();
    if (location) {
      setUserLocation(location);
      setSortBy('distance');
      // Trigger a refresh with the new location
      setPage(1);
      setSpots([]); 
    }
    setLocationLoading(false);
  };

  const initializeSpots = async () => {
    try {
      await fetch(`https://${projectId}.supabase.co/functions/v1/make-server-386acec3/init-spots`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });
    } catch (e) { console.error(e); }
  };

  const fetchSpots = async (currentPage: number, reset: boolean = false) => {
    try {
      if (reset) setLoading(true);
      setLoadingMore(!reset);
      
      // We don't send "quiet" or "outdoor" to the text search anymore 
      // because we already converted them into Category Filters.
      // We only send the text if it's NOT one of our trigger words.
      let textSearch = searchQuery;
      const triggers = ['outdoor', 'quiet', 'restaurant', 'parks', 'library', 'outside', 'silent'];
      
      // If the query is JUST a trigger word, clear the text search so we get ALL spots in that category
      if (triggers.some(t => searchQuery.toLowerCase().includes(t))) {
          textSearch = ''; 
      }

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: sortBy === 'distance' ? '100' : '20',
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

        // Client-side Distance Sorting
        if (sortBy === 'distance' && userLocation) {
             const sortFn = (a: StudySpot, b: StudySpot) => {
                const distA = calculateDistance(userLocation.latitude, userLocation.longitude, a.latitude, a.longitude);
                const distB = calculateDistance(userLocation.latitude, userLocation.longitude, b.latitude, b.longitude);
                return distA - distB;
             };

             if (reset) {
                setSpots([...spotsToSet].sort(sortFn));
             } else {
               setSpots(prev => [...prev, ...spotsToSet].sort(sortFn));
             }
        } else {
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

  const getDistance = (spot: StudySpot) => {
    if (!userLocation || !spot.latitude || !spot.longitude) return null;
    return calculateDistance(userLocation.latitude, userLocation.longitude, spot.latitude, spot.longitude);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Find Your Spot</h1>
          <p className="text-xl text-blue-100 mb-8">
            Try typing "quiet" for libraries or "outdoor" for parks.
          </p>
          
          <div className="max-w-2xl relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Type 'quiet', 'outdoor', or a name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 py-6 text-lg bg-white text-gray-900 pr-12"
            />
            {searchQuery && (
               <button 
                 onClick={() => {
                   setSearchQuery('');
                   setFilterCategory('all');
                   setSortBy('distance');
                 }}
                 className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
               >
                 <X className="w-5 h-5" />
               </button>
            )}
          </div>
          
          {/* Visual Indicator of what logic is active */}
          {(filterCategory !== 'all') && (
             <div className="mt-4 flex items-center gap-2 animate-in fade-in slide-in-from-top-2 text-blue-100">
                <Sparkles className="w-4 h-4 text-yellow-300" />
                <span className="text-sm">
                  Found keyword. Showing: <span className="font-bold capitalize">{filterCategory}</span> near you.
                </span>
             </div>
          )}

        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {/* Controls */}
        <div className="mb-6 flex flex-col md:flex-row gap-4 items-center justify-between">
          <div className="flex flex-wrap gap-3 items-center">
            {/* Location Button */}
            {!userLocation ? (
              <Button onClick={handleRequestLocation} disabled={locationLoading} variant="outline" className="gap-2">
                <Navigation className="w-4 h-4" /> {locationLoading ? 'Locating...' : 'Enable Location'}
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="gap-2 text-green-600 border-green-200 bg-green-50">
                <MapPin className="w-4 h-4" /> Location Active
              </Button>
            )}
            
            {/* Category Dropdown (Automatically updates based on search) */}
            <Select value={filterCategory} onValueChange={(v) => { setFilterCategory(v); setPage(1); }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="libraries">Libraries</SelectItem>
                <SelectItem value="cafes">Cafes</SelectItem>
                <SelectItem value="restaurants">Restaurants</SelectItem>
                <SelectItem value="parks">Parks</SelectItem>
              </SelectContent>
            </Select>

            {/* Sort Dropdown */}
            <Select value={sortBy} onValueChange={(v) => { setSortBy(v as any); setPage(1); }}>
              <SelectTrigger className="w-[160px]"><SelectValue placeholder="Sort" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">A-Z</SelectItem>
                <SelectItem value="distance" disabled={!userLocation}>Distance</SelectItem>
                <SelectItem value="rating">Rating</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Results */}
        {loading ? (
          <div className="text-center py-20">
            <Loader2 className="animate-spin h-10 w-10 text-blue-600 mx-auto mb-4" />
            <p className="text-gray-500">Finding best matches...</p>
          </div>
        ) : spots.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
            <p className="text-gray-500 text-lg">No spots found.</p>
            <Button variant="link" onClick={() => {setFilterCategory('all'); setSearchQuery('');}}>Clear Filters</Button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {spots.map((spot) => (
                <StudySpotCard
                  key={spot.id || spot.key || Math.random()} 
                  spot={spot}
                  averageRating={spot.avg_rating || 0}
                  reviewCount={spot.review_count || 0}
                  distance={getDistance(spot)}
                />
              ))}
            </div>
            {loadingMore && <div className="text-center py-6"><Loader2 className="animate-spin h-6 w-6 mx-auto text-gray-400" /></div>}
            <div ref={observerTarget} className="h-4" />
          </>
        )}
      </div>
    </div>
  );
};