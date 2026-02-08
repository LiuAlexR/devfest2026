import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { StudySpot } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { ReviewSection } from '../components/ReviewSection';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { Wifi, Zap, Clock, MapPin, ArrowLeft, Bookmark, Navigation, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { publicAnonKey, projectId } from '../../../utils/supabase/info';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { getUserLocation, calculateDistance, Coordinates } from '../utils/locationUtils';

export const SpotDetailPage: React.FC = () => {
  const { spotId } = useParams<{ spotId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [spot, setSpot] = useState<StudySpot | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingToHistory, setAddingToHistory] = useState(false);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
  const [isInHistory, setIsInHistory] = useState(false);

  useEffect(() => {
    if (spotId) {
      fetchSpot();
      loadUserLocation();
      checkIfInHistory();
    }
  }, [spotId]);

  const checkIfInHistory = () => {
    if (!spotId) return;
    const history = JSON.parse(localStorage.getItem('spot_history') || '[]');
    setIsInHistory(history.includes(spotId));
  };

  const loadUserLocation = async () => {
    const location = await getUserLocation();
    if (location) {
      setUserLocation(location);
    }
  };

  const fetchSpot = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-386acec3/spots/${spotId}`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSpot(data);
      } else {
        const data = await response.json();
        toast.error(`Failed to load spot: ${data.error || 'Unknown error'}`);
        setSpot(null);
      }
    } catch (error) {
      console.error('Network error:', error);
      toast.error('Network error loading spot details');
      setSpot(null);
    } finally {
      setLoading(false);
    }
  };

  const handleAddToHistory = async () => {
    if (!spotId) return;

    setAddingToHistory(true);
    try {
      const history = JSON.parse(localStorage.getItem('spot_history') || '[]');
      
      if (history.includes(spotId)) {
        const updatedHistory = history.filter((id: string) => id !== spotId);
        localStorage.setItem('spot_history', JSON.stringify(updatedHistory));
        setIsInHistory(false);
        toast.success('Removed from your history');
      } else {
        history.unshift(spotId); 
        localStorage.setItem('spot_history', JSON.stringify(history.slice(0, 100))); 
        setIsInHistory(true);
        toast.success('Added to your history!');
      }
    } catch (error) {
      toast.error('Failed to update history');
    } finally {
      setAddingToHistory(false);
    }
  };

  // --- NEW: Consistent Image Logic (Matches HomePage) ---
  const getSpotImage = (currentSpot: StudySpot) => {
    const cat = (currentSpot.category || '').toLowerCase();

    // 1. Park
    if (cat.includes('park') || cat.includes('outdoor') || cat.includes('nature')) {
      return 'https://images.unsplash.com/photo-1568515387631-8b650bbcdb90?q=80&w=2070&auto=format&fit=crop';
    }

    // 2. Library
    if (cat.includes('library') || cat.includes('book') || cat.includes('quiet')) {
      return 'https://images.unsplash.com/photo-1544822688-c5f41d2c1972?auto=format&fit=crop&w=1200&q=80';
    }

    // 3. Cafe OR Restaurant
    if (cat.includes('cafe') || cat.includes('coffee') || cat.includes('restaurant') || cat.includes('food')) {
      return 'https://images.unsplash.com/photo-1755275402110-9e8eb8592814?auto=format&fit=crop&w=1200&q=80';
    }

    return 'https://images.unsplash.com/photo-1544822688-c5f41d2c1972?auto=format&fit=crop&w=1200&q=80';
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><p className="text-gray-600">Loading...</p></div>;
  if (!spot) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><Button onClick={() => navigate('/')}>Back to Home</Button></div>;

  const imageUrl = getSpotImage(spot);
  const distance = (userLocation && spot.latitude && spot.longitude) 
    ? calculateDistance(userLocation.latitude, userLocation.longitude, spot.latitude, spot.longitude) 
    : null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="relative h-96 bg-gray-900">
        <ImageWithFallback
          src={imageUrl}
          alt={spot.name}
          className="w-full h-full object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />
        
        <div className="absolute top-6 left-6">
          <Button variant="secondary" onClick={() => navigate('/')} className="bg-white/20 hover:bg-white/30 text-white border-none backdrop-blur-md">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>

        <div className="absolute bottom-6 left-6 right-6 text-white">
          <div className="flex gap-2 mb-4">
            <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 backdrop-blur-md border-none">
              {spot.neighborhood}
            </Badge>
            <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 backdrop-blur-md border-none capitalize">
              {spot.category}
            </Badge>
            {distance && (
              <Badge variant="secondary" className="bg-blue-600/80 text-white hover:bg-blue-600/90 backdrop-blur-md border-none flex items-center gap-1">
                <Navigation className="w-3 h-3" />
                {distance.toFixed(1)} mi away
              </Badge>
            )}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-3">{spot.name}</h1>
          
          {/* --- UPDATED: Address Display in Header --- */}
          <div className="flex items-center gap-2 text-white/90 text-lg">
            <MapPin className="w-5 h-5 text-gray-300" />
            <span>{spot.address || spot.neighborhood || "Address unavailable"}</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-2xl font-bold mb-4">About This Spot</h2>
                <p className="text-gray-700 mb-6 leading-relaxed">{spot.description}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold mb-3 text-gray-900">Amenities</h3>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
                        <Wifi className={`w-5 h-5 ${spot.wifi ? 'text-blue-600' : 'text-gray-400'}`} />
                        <span className={spot.wifi ? 'text-gray-900 font-medium' : 'text-gray-500'}>
                          WiFi {spot.wifi ? 'Available' : 'Not Available'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
                        <Zap className={`w-5 h-5 ${spot.outlets ? 'text-blue-600' : 'text-gray-400'}`} />
                        <span className={spot.outlets ? 'text-gray-900 font-medium' : 'text-gray-500'}>
                          Power Outlets {spot.outlets ? 'Available' : 'Not Available'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
                         <span className="text-xl">🔊</span>
                         <span className="capitalize text-gray-900 font-medium">
                           {spot.noise || 'Moderate'} Noise Level
                         </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-3 text-gray-900">Rating</h3>
                    <div className="flex items-center gap-2 mb-4">
                      <div className="flex items-center gap-1 bg-yellow-50 px-3 py-1 rounded-full border border-yellow-100">
                        <span className="text-yellow-600 text-lg">★</span>
                        <span className="font-bold text-yellow-700 text-lg">{spot.avg_rating ? spot.avg_rating.toFixed(1) : 'New'}</span>
                      </div>
                      <span className="text-gray-500">({spot.review_count || 0} reviews)</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <ReviewSection spot={spot} />
          </div>

          <div className="space-y-6">
            <Card>
              <CardContent className="pt-6">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Location
                </h3>
                
                {/* --- UPDATED: Address Display in Side Card --- */}
                <p className="text-gray-800 font-medium mb-1">
                    {spot.address || spot.neighborhood || "No address provided"}
                </p>
                {spot.address && spot.neighborhood && !spot.address.includes(spot.neighborhood) && (
                    <p className="text-sm text-gray-500">{spot.neighborhood}, NYC</p>
                )}
                
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <Card>
               <CardContent className="pt-6 space-y-3">
                 <Button 
                   onClick={() => user ? navigate(`/spot/${spotId}/review`) : navigate(`/login?redirect=/spot/${spotId}`)}
                   className="w-full"
                 >
                   <MessageSquare className="w-4 h-4 mr-2" />
                   {user ? 'Write a Review' : 'Sign in to Review'}
                 </Button>

                 <Button
                    onClick={handleAddToHistory}
                    disabled={addingToHistory}
                    className="w-full"
                    variant={isInHistory ? "secondary" : "outline"}
                 >
                    <Bookmark className={`w-4 h-4 mr-2 ${isInHistory ? 'fill-current' : ''}`} />
                    {addingToHistory ? 'Updating...' : (isInHistory ? 'Saved to History' : 'Save Spot')}
                 </Button>
               </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};