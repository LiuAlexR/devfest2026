import React, { useState, useEffect, useRef } from 'react';
import { StudySpot } from '../types';
import { StudySpotCard } from '../components/StudySpotCard';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Search, MapPin, Navigation, Loader2, Sparkles } from 'lucide-react';
import { publicAnonKey, projectId } from '/utils/supabase/info';
import { 
  getUserLocation, 
  requestUserLocation, 
  calculateDistance, 
  Coordinates, 
  clearLocationCookie 
} from '../utils/locationUtils';

export const HomePage: React.FC = () => {
  const [spots, setSpots] = useState<StudySpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [reviewData, setReviewData] = useState<Record<string, { avg: number; count: number }>>({});
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [locationLoading, setLocationLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'none' | 'distance' | 'rating'>('none');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const observerTarget = useRef<HTMLDivElement>(null);

  // --- NEW STATE: Store AI Keywords from Python ---
  const [aiKeywords, setAiKeywords] = useState<string[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  // --- NEW FUNCTION: Call Python Backend ---
  const analyzeSearchIntent = async (query: string) => {
    if (!query.trim()) {
      setAiKeywords([]);
      return;
    }

    setAiLoading(true);
    try {
      // Assumes your Python FastAPI server is running on port 8000
      const response = await fetch('http://localhost:8000/analyze-search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query }),
      });

      if (response.ok) {
        const data = await response.json();
        // data.keywords should match the structure returned by your Python script
        console.log("Python Dedalus Response:", data.keywords);
        setAiKeywords(data.keywords || []);
      }
    } catch (error) {
      console.error("Failed to connect to Python backend:", error);
    } finally {
      setAiLoading(false);
    }
  };

  // Debounce search input & Trigger Python Analysis
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      
      // Trigger the Python analysis when the user stops typing
      if (searchQuery.trim().length > 0) {
        analyzeSearchIntent(searchQuery);
      } else {
        setAiKeywords([]);
      }

      setPage(1);
      setSpots([]);
    }, 500); // 500ms delay
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    initializeSpots();
    loadUserLocation();
  }, []);

  useEffect(() => {
    fetchSpots(1, true);
  }, [debouncedSearch, filterCategory, sortBy, userLocation]);

  // Load more when page changes
  useEffect(() => {
    if (page > 1) {
      fetchSpots(page, false);
    }
  }, [page]);

  // Infinite scroll observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loadingMore && page < totalPages) {
          loadMoreSpots();
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [loadingMore, page, totalPages]);

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
    } else {
      alert('Unable to get your location. Please enable location services in your browser.');
    }
    setLocationLoading(false);
  };

  const handleClearLocation = () => {
    clearLocationCookie();
    setUserLocation(null);
  };

  const initializeSpots = async () => {
    try {
      // Initialize default spots
      await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-386acec3/init-spots`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );
    } catch (error) {
      console.error('Error initializing spots:', error);
    }
  };

  const fetchSpots = async (currentPage: number, reset: boolean = false) => {
    try {
      setLoadingMore(true);
      
      // Build query params
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: '50',
        search: debouncedSearch,
        category: filterCategory,
        sortBy: sortBy,
      });
      
      if (userLocation) {
        params.append('userLat', userLocation.latitude.toString());
        params.append('userLon', userLocation.longitude.toString());
      }
      
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-386acec3/spots?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      const data = await response.json();
      if (response.ok) {
        if (reset) {
          setSpots(data.spots || []);
        } else {
          setSpots((prevSpots) => [...prevSpots, ...(data.spots || [])]);
        }
        
        // Fetch reviews for all spots
        const reviewPromises = (data.spots || []).map(async (spot: StudySpot) => {
          const reviewResponse = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-386acec3/spots/${spot.id}/reviews`,
            {
              headers: {
                'Authorization': `Bearer ${publicAnonKey}`,
              },
            }
          );
          const reviewData = await reviewResponse.json();
          const reviews = reviewData.reviews || [];
          const avg = reviews.length > 0
            ? reviews.reduce((sum: number, r: any) => sum + r.rating, 0) / reviews.length
            : 0;
          return { spotId: spot.id, avg, count: reviews.length };
        });

        const reviewResults = await Promise.all(reviewPromises);
        const reviewMap: Record<string, { avg: number; count: number }> = {};
        reviewResults.forEach(({ spotId, avg, count }) => {
          reviewMap[spotId] = { avg, count };
        });
        setReviewData(reviewMap);

        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
      } else {
        console.error('Failed to fetch spots:', data.error);
      }
    } catch (error) {
      console.error('Error fetching spots:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const loadMoreSpots = () => {
    setPage((prevPage) => prevPage + 1);
  };

  const getDistance = (spot: StudySpot): number | null => {
    if (!userLocation || !spot.latitude || !spot.longitude) return null;
    return calculateDistance(userLocation.latitude, userLocation.longitude, spot.latitude, spot.longitude);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white py-16">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Find Your Perfect Study Spot in NYC
          </h1>
          <p className="text-xl text-blue-100 mb-8">
            Discover the best libraries, coffee shops, and co-working spaces to boost your productivity
          </p>
          
          <div className="max-w-2xl relative">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Search by name, neighborhood, or description..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 py-6 text-lg bg-white text-gray-900"
            />
            {/* AI Loading Indicator inside search bar */}
            {aiLoading && (
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                    <Loader2 className="animate-spin text-blue-600 w-5 h-5" />
                </div>
            )}
          </div>

          {/* AI Keywords Display Area */}
          {(aiKeywords.length > 0) && (
            <div className="max-w-2xl mt-4 flex flex-wrap gap-2 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center gap-2 text-blue-100 text-sm mr-2">
                <Sparkles className="w-4 h-4" />
                <span>AI Detected:</span>
              </div>
              {aiKeywords.map((keyword, idx) => (
                <span 
                  key={idx} 
                  className="bg-white/20 hover:bg-white/30 backdrop-blur-sm px-3 py-1 rounded-full text-sm text-white border border-white/20 transition-colors"
                >
                  {keyword}
                </span>
              ))}
            </div>
          )}

        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {/* Location and Filter Controls */}
        <div className="mb-6 flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <div className="flex flex-wrap gap-3 items-center">
            {!userLocation ? (
              <Button
                onClick={handleRequestLocation}
                disabled={locationLoading}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Navigation className="w-4 h-4" />
                {locationLoading ? 'Getting location...' : 'Enable Location'}
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleClearLocation}
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                >
                  <MapPin className="w-4 h-4" />
                  Location Enabled
                </Button>
              </div>
            )
            }
            
            <Select value={filterCategory} onValueChange={setFilterCategory}>
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

            <Select value={sortBy} onValueChange={(value) => setSortBy(value as 'none' | 'distance' | 'rating')}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Default Order</SelectItem>
                <SelectItem value="distance" disabled={!userLocation}>
                  {userLocation ? 'Distance (Nearest)' : 'Distance (Enable location)'}
                </SelectItem>
                <SelectItem value="rating">Rating (Highest)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-gray-600">Loading study spots...</p>
          </div>
        ) : spots.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-600">No study spots found matching your search.</p>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {total > 0 ? `${total} Study Spots` : `${spots.length} Study Spots Available`}
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {spots.map((spot) => (
                <StudySpotCard
                  key={spot.id}
                  spot={spot}
                  averageRating={reviewData[spot.id]?.avg}
                  reviewCount={reviewData[spot.id]?.count}
                  distance={getDistance(spot)}
                />
              ))}
            </div>

            {loadingMore && (
              <div className="text-center py-6">
                <Loader2 className="animate-spin h-6 w-6 text-gray-500" />
              </div>
            )}

            <div ref={observerTarget} className="h-10"></div>
          </>
        )}
      </div>
    </div>
  );
};