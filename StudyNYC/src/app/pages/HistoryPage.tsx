import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { StudySpot } from '../types';
import { StudySpotCard } from '../components/StudySpotCard';
import { Button } from '../components/ui/button';
import { History, ArrowLeft } from 'lucide-react';
import { publicAnonKey, projectId } from '../../../utils/supabase/info';
import { getUserLocation, calculateDistance, Coordinates } from '../utils/locationUtils';
import Cookies from 'js-cookie';

export const HistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [historySpots, setHistorySpots] = useState<StudySpot[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewData, setReviewData] = useState<Record<string, { avg: number; count: number }>>({});
  const [userLocation, setUserLocation] = useState<Coordinates | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/login');
      return;
    }

    fetchHistory();
    loadUserLocation();
  }, [user, navigate]);

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
      const authToken = Cookies.get('auth_token');
      if (!authToken) return;
      
      // Fetch user history
      const historyResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-386acec3/user/history`,
        {
          headers: {
            'Authorization': `Bearer ${authToken}`,
          },
        }
      );

      const historyData = await historyResponse.json();
      const spotIds = historyData.history || [];

      if (spotIds.length === 0) {
        setLoading(false);
        return;
      }

      // Fetch all spots
      const spotsResponse = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-386acec3/spots`,
        {
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
          },
        }
      );

      const spotsData = await spotsResponse.json();
      const allSpots = spotsData.spots || [];

      // Filter spots that are in user history
      const userSpots = allSpots.filter((spot: StudySpot) => spotIds.includes(spot.key));
      setHistorySpots(userSpots);

      // Fetch reviews for these spots
      const reviewPromises = userSpots.map(async (spot: StudySpot) => {
        const reviewResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-386acec3/spots/${spot.key}/reviews`,
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
        return { spotId: spot.key, avg, count: reviews.length };
      });

      const reviewResults = await Promise.all(reviewPromises);
      const reviewMap: Record<string, { avg: number; count: number }> = {};
      reviewResults.forEach(({ spotId, avg, count }) => {
        reviewMap[spotId] = { avg, count };
      });
      setReviewData(reviewMap);
    } catch (error) {
      console.error('Error fetching history:', error);
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
            <h1 className="text-4xl font-bold">My Study Spot History</h1>
          </div>
          <p className="text-purple-100">
            Places you've marked as visited
          </p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        {historySpots.length === 0 ? (
          <div className="text-center py-12">
            <History className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No History Yet</h2>
            <p className="text-gray-600 mb-6">
              Start exploring study spots and add them to your history!
            </p>
            <Button onClick={() => navigate('/')}>
              Browse Study Spots
            </Button>
          </div>
        ) : (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {historySpots.length} {historySpots.length === 1 ? 'Spot' : 'Spots'} Visited
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {historySpots.map((spot) => (
                <StudySpotCard
                  key={spot.key}
                  spot={spot}
                  averageRating={reviewData[spot.key]?.avg}
                  reviewCount={reviewData[spot.key]?.count}
                  distance={getDistance(spot)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
};