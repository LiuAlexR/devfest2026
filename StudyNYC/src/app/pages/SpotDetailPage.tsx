import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router';
import { StudySpot } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { ReviewSection } from '../components/ReviewSection';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { Wifi, Zap, Clock, MapPin, ArrowLeft, Bookmark, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import { publicAnonKey, projectId } from '../../../utils/supabase/info';
import Cookies from 'js-cookie';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';
import { getUserLocation, calculateDistance, Coordinates } from '../utils/locationUtils';

const spotImages: Record<string, string> = {
  'spot:1': 'https://images.unsplash.com/photo-1661951934175-61dbbb20406e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuZXclMjB5b3JrJTIwcHVibGljJTIwbGlicmFyeSUyMGludGVyaW9yfGVufDF8fHx8MTc3MDUwNjA5Mnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
  'spot:2': 'https://images.unsplash.com/photo-1755275402110-9e8eb8592814?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb3p5JTIwY29mZmVlJTIwc2hvcCUyMHN0dWR5fGVufDF8fHx8MTc3MDUwNjA5Mnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
  'spot:3': 'https://images.unsplash.com/photo-1544822688-c5f41d2c1972?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsaWJyYXJ5JTIwc3R1ZHklMjBkZXNrfGVufDF8fHx8MTc3MDUwNjA5Mnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
};

export const SpotDetailPage: React.FC = () => {
  const { spotId } = useParams<{ spotId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [spot, setSpot] = useState<StudySpot | null>(null);
  const [loading, setLoading] = useState(true);
  const [addingToHistory, setAddingToHistory] = useState(false);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);

  useEffect(() => {
    if (spotId) {
      fetchSpot();
      loadUserLocation();
    }
  }, [spotId]);

  const loadUserLocation = async () => {
    const location = await getUserLocation();
    if (location) {
      setUserLocation(location);
    }
  };

  const fetchSpot = async () => {
  try {
    setLoading(true);
    console.log('Fetching spot with ID:', spotId);
    // 1. Point directly to the individual spot endpoint using the ID from the URL
    const response = await fetch(
      `https://${projectId}.supabase.co/functions/v1/make-server-386acec3/spots/${spotId}`,
      {
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
        },
      }
    );

    console.log('Spot fetch response status:', response.status);
    const responseText = await response.text();
    console.log('Raw response:', responseText);
    
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse JSON:', parseError);
      throw parseError;
    }
    console.log('Spot fetch data:', data);
    console.log('Response ok?', response.ok);

    if (response.ok) {
      // 2. Data is now the spot object itself, not an array
      setSpot(data);
    } else {
      const errorMsg = data?.error || data?.message || JSON.stringify(data) || 'Unknown error';
      console.error('Fetch error details:', errorMsg);
      toast.error(`Failed to load spot: ${errorMsg}`);
      setSpot(null);
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error('Network error:', errorMsg);
    toast.error(`Network error: ${errorMsg}`);
    setSpot(null);
  } finally {
    setLoading(false);
  }
};

  const handleAddToHistory = async () => {
    if (!user || !spotId) {
      toast.error('Please log in to save to history');
      return;
    }

    setAddingToHistory(true);
    try {
      const authToken = Cookies.get('auth_token');
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-386acec3/user/history`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({ spotId }),
        }
      );

      const data = await response.json();
      if (response.ok) {
        toast.success('Added to your history!');
      } else {
        toast.error(data.error || 'Failed to add to history');
      }
    } catch (error) {
      console.error('Error adding to history:', error);
      toast.error('Failed to add to history');
    } finally {
      setAddingToHistory(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (!spot) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 mb-4">Study spot not found</p>
          <Button onClick={() => navigate('/')}>Back to Home</Button>
        </div>
      </div>
    );
  }

  const imageUrl = spotImages[spot.key] || 'https://images.unsplash.com/photo-1544822688-c5f41d2c1972?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080';
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
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        
        <div className="absolute top-6 left-6">
          <Button variant="secondary" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
        </div>

        <div className="absolute bottom-6 left-6 right-6 text-white">
          <div className="flex gap-2 mb-3">
            <Badge variant="secondary">
              {spot.neighborhood}
            </Badge>
            <Badge variant="secondary" className="capitalize">
              {spot.category}
            </Badge>
            {distance && (
              <Badge variant="secondary" className="flex items-center gap-1">
                <Navigation className="w-3 h-3" />
                {distance} mi away
              </Badge>
            )}
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-2">{spot.name}</h1>
          <div className="flex items-center gap-2 text-white/90">
            <MapPin className="w-4 h-4" />
            <span>{spot.neighborhood}, New York</span>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardContent className="pt-6">
                <h2 className="text-2xl font-bold mb-4">About This Spot</h2>
                <p className="text-gray-700 mb-6">{spot.description}</p>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h3 className="font-semibold mb-2">Amenities</h3>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Wifi className={`w-4 h-4 ${spot.wifi ? 'text-green-600' : 'text-gray-400'}`} />
                        <span className={spot.wifi ? 'text-gray-900' : 'text-gray-400'}>
                          WiFi {spot.wifi ? 'Available' : 'Not Available'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Zap className={`w-4 h-4 ${spot.outlets ? 'text-green-600' : 'text-gray-400'}`} />
                        <span className={spot.outlets ? 'text-gray-900' : 'text-gray-400'}>
                          Power Outlets {spot.outlets ? 'Available' : 'Not Available'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold mb-2">Rating</h3>
                    <div className="flex items-center gap-2 mb-4">
                      <Badge>{spot.avg_rating.toFixed(1)} ★ ({spot.review_count} reviews)</Badge>
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
                  <Clock className="w-4 h-4" />
                  Location
                </h3>
                <p className="text-sm text-gray-700">{spot.neighborhood}</p>
              </CardContent>
            </Card>

            {user && (
              <Card>
                <CardContent className="pt-6">
                  <Button
                    onClick={handleAddToHistory}
                    disabled={addingToHistory}
                    className="w-full"
                    variant="outline"
                  >
                    <Bookmark className="w-4 h-4 mr-2" />
                    {addingToHistory ? 'Adding...' : 'Add to My History'}
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};