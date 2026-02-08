import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { StudySpot } from '../types';
import { StudySpotCard } from '../components/StudySpotCard';
import { Button } from '../components/ui/button';
import { Card, CardContent } from '../components/ui/card';
import { History, ArrowLeft, Star, Trash2 } from 'lucide-react';
import { publicAnonKey, projectId } from '../../../utils/supabase/info';
import { getUserLocation, calculateDistance, Coordinates } from '../utils/locationUtils';
import { toast } from 'sonner';

interface MyReview {
  id: string;
  spotId: string;
  spotName: string;
  rating: number;
  comment: string;
  userName: string;
  createdAt: string;
}

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [historySpots, setHistorySpots] = useState<StudySpot[]>([]);
  const [myReviews, setMyReviews] = useState<MyReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);

  useEffect(() => {
    fetchHistory();
    loadUserLocation();
    
    // Listen for review submissions (localStorage change)
    const handleStorageChange = () => {
      console.log('Storage changed, reloading reviews');
      loadReviews();
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const loadReviews = () => {
    const reviews = JSON.parse(localStorage.getItem('my_reviews') || '[]');
    console.log('Loaded reviews from localStorage:', reviews);
    setMyReviews(reviews);
  };

  const handleDeleteReview = (reviewId: string) => {
    const updatedReviews = myReviews.filter(r => r.id !== reviewId);
    localStorage.setItem('my_reviews', JSON.stringify(updatedReviews));
    setMyReviews(updatedReviews);
    toast.success('Review deleted');
  };

  const loadUserLocation = async () => {
    const location = await getUserLocation();
    if (location) {
      setUserLocation(location);
    }
  };

  const getDistance = (spot: StudySpot): number | null => {
    if (!userLocation) return null;
    return calculateDistance(userLocation.latitude, userLocation.longitude, spot.latitude, spot.longitude);
  };

  const fetchHistory = async () => {
    try {
      // Get spot IDs from localStorage
      const spotIds = JSON.parse(localStorage.getItem('spot_history') || '[]');

      if (spotIds.length === 0) {
        loadReviews();
        setLoading(false);
        return;
      }

      // Fetch each spot individually
      const spotPromises = spotIds.map(async (spotId: string) => {
        try {
          const response = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-386acec3/spots/${spotId}`,
            {
              headers: {
                'Authorization': `Bearer ${publicAnonKey}`,
              },
            }
          );
          if (response.ok) {
            return await response.json();
          }
          return null;
        } catch (error) {
          console.error(`Error fetching spot ${spotId}:`, error);
          return null;
        }
      });

      const spots = await Promise.all(spotPromises);
      const validSpots = spots.filter((spot): spot is StudySpot => spot !== null);
      setHistorySpots(validSpots);
      loadReviews();
    } catch (error) {
      console.error('Error fetching history:', error);
      loadReviews();
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading your history...</p>
      </div>
    );
  }

  const hasHistory = historySpots.length > 0;
  const hasReviews = myReviews.length > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white py-12">
        <div className="container mx-auto px-4">
          <Button
            variant="secondary"
            onClick={() => navigate('/')}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
          
          <div className="flex items-center gap-3 mb-4">
            <History className="w-10 h-10" />
            <h1 className="text-4xl font-bold">My Account</h1>
          </div>
          <p className="text-purple-100">
            Your study spot history and reviews
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {/* My History Section */}
        <div className="mb-16">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">My Study Spot History</h2>
          
          {hasHistory ? (
            <>
              <div className="mb-6">
                <p className="text-gray-600">
                  {historySpots.length} {historySpots.length === 1 ? 'Spot' : 'Spots'} Visited
                </p>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {historySpots.map((spot) => (
                  <StudySpotCard
                    key={spot.key}
                    spot={spot}
                    distance={getDistance(spot)}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <History className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No History Yet</h3>
              <p className="text-gray-600 mb-6">
                Start exploring study spots and add them to your history!
              </p>
              <Button onClick={() => navigate('/')}>
                Browse Study Spots
              </Button>
            </div>
          )}
        </div>

        {/* My Reviews Section */}
        <div className="border-t pt-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-6">My Reviews</h2>
          
          {hasReviews ? (
            <>
              <div className="mb-6">
                <p className="text-gray-600">
                  {myReviews.length} {myReviews.length === 1 ? 'Review' : 'Reviews'} Written
                </p>
              </div>
              
              <div className="space-y-4">
                {myReviews.map((review) => (
                  <Card key={review.id}>
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">{review.spotName}</h3>
                          <div className="flex items-center gap-2 mt-1 mb-3">
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`w-4 h-4 ${
                                    star <= review.rating
                                      ? 'fill-yellow-400 text-yellow-400'
                                      : 'text-gray-300'
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-sm text-gray-600">
                              {new Date(review.createdAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteReview(review.id)}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                      
                      {review.comment && (
                        <p className="text-gray-700 mb-3">{review.comment}</p>
                      )}
                      
                      <button
                        onClick={() => navigate(`/spot/${review.spotId}`)}
                        className="text-sm text-purple-600 hover:text-purple-700 font-medium"
                      >
                        View Spot →
                      </button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
              <Star className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Reviews Yet</h3>
              <p className="text-gray-600 mb-6">
                Share your experience by writing reviews for study spots!
              </p>
              <Button onClick={() => navigate('/')}>
                Browse Study Spots
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};