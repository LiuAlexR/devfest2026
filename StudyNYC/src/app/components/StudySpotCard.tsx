import React from 'react';
import { StudySpot } from '../types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Wifi, Zap, MapPin, Star, Navigation } from 'lucide-react';
import { Link } from 'react-router';
import { ImageWithFallback } from './figma/ImageWithFallback';

interface StudySpotCardProps {
  spot: StudySpot;
  averageRating?: number;
  reviewCount?: number;
  distance?: number | null;
}

export const StudySpotCard: React.FC<StudySpotCardProps> = ({ spot, averageRating, reviewCount, distance }) => {

  // IMAGE SELECTION LOGIC
  const getSpotImage = () => {
    const cat = (spot.category || '').toLowerCase();

    // 1. Park
    if (cat.includes('park') || cat.includes('outdoor') || cat.includes('nature')) {
      return 'https://images.unsplash.com/photo-1568515387631-8b650bbcdb90?q=80&w=2070&auto=format&fit=crop';
    }

    // 2. Library
    if (cat.includes('library') || cat.includes('book') || cat.includes('quiet')) {
      return 'https://images.unsplash.com/photo-1544822688-c5f41d2c1972?auto=format&fit=crop&w=800&q=80';
    }

    // 3. Cafe OR Restaurant
    if (cat.includes('cafe') || cat.includes('coffee') || cat.includes('restaurant') || cat.includes('food')) {
      return 'https://images.unsplash.com/photo-1755275402110-9e8eb8592814?auto=format&fit=crop&w=800&q=80';
    }

    // Default Fallback
    return 'https://images.unsplash.com/photo-1544822688-c5f41d2c1972?auto=format&fit=crop&w=800&q=80';
  };

  const imageUrl = getSpotImage();

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col">
      <div className="relative h-48 overflow-hidden">
        <ImageWithFallback 
          src={imageUrl}
          alt={spot.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
        
        {/* Category Badge */}
        <div className="absolute top-3 right-3">
          <Badge variant="secondary" className="bg-white/90 backdrop-blur capitalize">
            {spot.category || 'Spot'}
          </Badge>
        </div>

        {distance !== null && distance !== undefined && (
          <div className="absolute top-3 left-3">
            <Badge variant="default" className="bg-blue-600/90 backdrop-blur flex items-center gap-1">
              <Navigation className="w-3 h-3" />
              {typeof distance === 'number' ? distance.toFixed(1) : distance} mi
            </Badge>
          </div>
        )}
      </div>
      
      <CardHeader>
        <CardTitle className="text-xl line-clamp-1">{spot.name}</CardTitle>
        
        {/* --- UPDATED: Address Section --- */}
        <div className="flex flex-col gap-1">
          {/* Primary Address Line */}
          <CardDescription className="flex items-start gap-1 text-sm text-gray-700">
            <MapPin className="w-3 h-3 mt-1 flex-shrink-0 text-gray-500" />
            <span className="line-clamp-2">
              {spot.address || spot.neighborhood || 'Address unavailable'}
            </span>
          </CardDescription>
          
          {/* Secondary Neighborhood Line (Optional - only if address is present and different) */}
          {spot.address && spot.neighborhood && !spot.address.includes(spot.neighborhood) && (
             <span className="text-xs text-gray-400 pl-4">
               {spot.neighborhood}
             </span>
          )}
        </div>

        {averageRating !== undefined && reviewCount !== undefined && reviewCount > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">{averageRating.toFixed(1)}</span>
            </div>
            <span className="text-sm text-gray-500">({reviewCount} reviews)</span>
          </div>
        )}
      </CardHeader>
      
      <CardContent className="flex flex-col flex-grow">
        <p className="text-sm text-gray-600 mb-4 line-clamp-2 flex-grow">{spot.description}</p>
        
        <div className="flex flex-wrap gap-2 mb-4">
          {spot.wifi && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Wifi className="w-3 h-3" />
              WiFi
            </Badge>
          )}
          {spot.outlets && (
            <Badge variant="outline" className="flex items-center gap-1">
              <Zap className="w-3 h-3" />
              Outlets
            </Badge>
          )}
          {spot.noise && (
            <Badge variant="outline" className="text-xs capitalize">
              {spot.noise} Noise
            </Badge>
          )}
        </div>
        
        <Link to={`/spot/${spot.key}`} className="mt-auto">
          <Button className="w-full">View Details & Reviews</Button>
        </Link>
      </CardContent>
    </Card>
  );
};