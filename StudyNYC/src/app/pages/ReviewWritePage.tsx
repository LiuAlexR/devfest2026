import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Navigate } from 'react-router';
import { StudySpot } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Star, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { publicAnonKey, projectId } from '../../../utils/supabase/info';
import { ImageWithFallback } from '../components/figma/ImageWithFallback';

const spotImages: Record<string, string> = {
  'spot:1': 'https://images.unsplash.com/photo-1661951934175-61dbbb20406e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuZXclMjB5b3JrJTIwcHVibGljJTIwbGlicmFyeSUyMGludGVyaW9yfGVufDF8fHx8MTc3MDUwNjA5Mnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
  'spot:2': 'https://images.unsplash.com/photo-1755275402110-9e8eb8592814?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb3p5JTIwY29mZmVlJTIwc2hvcCUyMHN0dWR5fGVufDF8fHx8MTc3MDUwNjA5Mnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
  'spot:3': 'https://images.unsplash.com/photo-1544822688-c5f41d2c1972?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsaWJyYXJ5JTIwc3R1ZHklMjBkZXNrfGVufDF8fHx8MTc3MDUwNjA5Mnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
};

export const ReviewWritePage: React.FC = () => {
  const { spotId } = useParams<{ spotId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [spot, setSpot] = useState<StudySpot | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [hoveredStar, setHoveredStar] = useState(0);

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to={`/login?redirect=/spot/${spotId}/review`} replace />;
  }

  useEffect(() => {
    if (spotId) {
      fetchSpot();
    }
  }, [spotId]);

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

      const data = await response.json();
      if (response.ok) {
        setSpot(data);
      } else {
        toast.error('Failed to load study spot');
      }
    } catch (error) {
      console.error('Error fetching spot:', error);
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    if (!spotId) {
      toast.error('Study spot not found');
      return;
    }

    if (rating === 0) {
      toast.error('Please select a rating');
      return;
    }

    setSubmitting(true);
    try {
      console.log('Submitting review with:', { spotId, rating, comment: comment.substring(0, 50) });
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-386acec3/spots/${spotId}/reviews`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`,
          },
          body: JSON.stringify({ 
            rating: parseInt(rating.toString()), 
            comment,
            userName: user?.name || 'User',
            userId: user?.id || 'anonymous',
          }),
        }
      );

      console.log('Review response status:', response.status);
      const responseText = await response.text();
      console.log('Review response text:', responseText);

      let data;
      try {
        data = JSON.parse(responseText);
      } catch (e) {
        console.error('Failed to parse response:', e);
        toast.error('Server error: Invalid response');
        return;
      }

      if (response.ok) {
        toast.success('Review submitted successfully!');
        navigate(`/spot/${spotId}`);
      } else {
        const errorMsg = data?.error || data?.message || 'Failed to submit review';
        console.error('Review submission failed:', errorMsg);
        toast.error(errorMsg);
      }
    } catch (error) {
      console.error('Error submitting review:', error);
      toast.error('Failed to submit review');
    } finally {
      setSubmitting(false);
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with spot preview */}
      <div className="relative h-48 bg-gray-900">
        <ImageWithFallback
          src={imageUrl}
          alt={spot.name}
          className="w-full h-full object-cover opacity-60"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

        <div className="absolute top-6 left-6">
          <Button variant="secondary" onClick={() => navigate(`/spot/${spotId}`)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Spot
          </Button>
        </div>

        <div className="absolute bottom-6 left-6 right-6 text-white">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Write a Review</h1>
          <p className="text-white/90">Share your experience at {spot.name}</p>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12">
        <div className="max-w-2xl mx-auto">
          {/* Spot info card */}
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex gap-4 items-start">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold mb-2">{spot.name}</h2>
                  <div className="flex gap-2 mb-3">
                    <Badge>{spot.neighborhood}</Badge>
                    <Badge className="capitalize">{spot.category}</Badge>
                  </div>
                  <p className="text-gray-600">{spot.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Review form */}
          <Card>
            <CardHeader>
              <CardTitle>Your Review</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Star rating */}
              <div>
                <label className="block text-sm font-semibold mb-4">Rating</label>
                <div className="flex items-center gap-3">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      onMouseEnter={() => setHoveredStar(star)}
                      onMouseLeave={() => setHoveredStar(0)}
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        className={`w-10 h-10 ${
                          star <= (hoveredStar || rating)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    </button>
                  ))}
                  {rating > 0 && (
                    <span className="ml-4 text-lg font-medium">
                      {rating === 1 && 'Poor'}
                      {rating === 2 && 'Fair'}
                      {rating === 3 && 'Good'}
                      {rating === 4 && 'Very Good'}
                      {rating === 5 && 'Excellent'}
                    </span>
                  )}
                </div>
              </div>

              {/* Comment */}
              <div>
                <label className="block text-sm font-semibold mb-2">Your Review (optional)</label>
                <Textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Tell other students what you think about this study spot. What's the vibe? Is it quiet? Good wifi? Comfortable seating?"
                  rows={6}
                  className="resize-none"
                />
                <p className="text-xs text-gray-500 mt-2">
                  {comment.length} / 500 characters
                </p>
              </div>

              {/* Action buttons */}
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={() => navigate(`/spot/${spotId}`)}
                  variant="outline"
                  className="flex-1"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitReview}
                  disabled={submitting || rating === 0}
                  className="flex-1"
                >
                  {submitting ? 'Submitting...' : 'Submit Review'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};
