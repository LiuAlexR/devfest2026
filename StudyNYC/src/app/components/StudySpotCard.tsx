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

const spotImages: Record<string, string> = {
  'spot:1': 'https://images.unsplash.com/photo-1661951934175-61dbbb20406e?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxuZXclMjB5b3JrJTIwcHVibGljJTIwbGlicmFyeSUyMGludGVyaW9yfGVufDF8fHx8MTc3MDUwNjA5Mnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
  'spot:2': 'https://images.unsplash.com/photo-1755275402110-9e8eb8592814?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxjb3p5JTIwY29mZmVlJTIwc2hvcCUyMHN0dWR5fGVufDF8fHx8MTc3MDUwNjA5Mnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
  'spot:3': 'https://images.unsplash.com/photo-1544822688-c5f41d2c1972?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxsaWJyYXJ5JTIwc3R1ZHklMjBkZXNrfGVufDF8fHx8MTc3MDUwNjA5Mnww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral',
};

export const StudySpotCard: React.FC<StudySpotCardProps> = ({ spot, averageRating, reviewCount, distance }) => {
  const imageUrl = spotImages[spot.key] || 'https://images.unsplash.com/photo-1544822688-c5f41d2c1972?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080';

  return (
    <Card className="overflow-hidden hover:shadow-lg transition-shadow">
      <div className="relative h-48 overflow-hidden">
        <ImageWithFallback 
          src={imageUrl}
          alt={spot.name}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-3 right-3">
          <Badge variant="secondary" className="bg-white/90 backdrop-blur">
            {spot.neighborhood}
          </Badge>
        </div>
        {distance !== null && distance !== undefined && (
          <div className="absolute top-3 left-3">
            <Badge variant="default" className="bg-blue-600/90 backdrop-blur flex items-center gap-1">
              <Navigation className="w-3 h-3" />
              {distance} mi
            </Badge>
          </div>
        )}
      </div>
      
      <CardHeader>
        <CardTitle className="text-xl">{spot.name}</CardTitle>
        <CardDescription className="flex items-center gap-1 text-sm">
          <MapPin className="w-3 h-3" />
          {spot.neighborhood}
        </CardDescription>
        
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
      
      <CardContent>
        <p className="text-sm text-gray-600 mb-4">{spot.description}</p>
        
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
          <Badge variant="outline" className="text-xs">
            {spot.noise} Noise
          </Badge>
        </div>
        
        <Link to={`/spot/${spot.key}`}>
          <Button className="w-full">View Details & Reviews</Button>
        </Link>
      </CardContent>
    </Card>
  );
};