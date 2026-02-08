import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Create Supabase clients
const getServiceClient = () => {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
};

const getAnonClient = () => {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  );
};

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-386acec3/health", (c) => {
  return c.json({ status: "ok" });
});

// Sign up endpoint
app.post("/make-server-386acec3/signup", async (c) => {
  try {
    const { email, password, name } = await c.req.json();
    
    if (!email || !password || !name) {
      return c.json({ error: "Email, password, and name are required" }, 400);
    }

    const supabase = getServiceClient();
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { name },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });

    if (error) {
      console.log('Signup error:', error);
      return c.json({ error: `Signup failed: ${error.message}` }, 400);
    }

    return c.json({ 
      message: "User created successfully", 
      userId: data.user.id 
    });
  } catch (error) {
    console.log('Signup error:', error);
    return c.json({ error: `Signup failed: ${error}` }, 500);
  }
});

app.get("/make-server-386acec3/spots", async (c) => {
  try {
    const url = new URL(c.req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const search = url.searchParams.get('search') || '';
    const selectedCategory = url.searchParams.get('category') || 'all'; 
    const sortBy = url.searchParams.get('sortBy') || 'none';
    const userLat = parseFloat(url.searchParams.get('userLat') || '0');
    const userLon = parseFloat(url.searchParams.get('userLon') || '0');
    
    const supabase = getServiceClient();
    
    // --- BATCH FETCHING (Keep as is) ---
    const batchSize = 10000;
    let allSpots: any[] = [];
    let fetchedCount = 0;
    let hasMore = true;
    
    while (hasMore) {
      const { data, error } = await supabase
        .from('kv_store_386acec3')
        .select('value')
        .like('key', 'spot:%')
        .range(fetchedCount, fetchedCount + batchSize - 1);
      
      if (error) return c.json({ error: `Fetch error: ${error.message}` }, 500);
      
      if (!data || data.length === 0) {
        hasMore = false;
      } else {
        allSpots = allSpots.concat(data.map(d => d.value));
        fetchedCount += data.length;
        if (data.length < batchSize) hasMore = false;
      }
    }
    
    let spots = allSpots;
    
    // --- 1. SEARCH FILTER ---
    if (search) {
      const query = search.toLowerCase();
      spots = spots.filter((spot: any) => 
        (spot.name?.toLowerCase() || '').includes(query) ||
        (spot.neighborhood?.toLowerCase() || '').includes(query) ||
        (spot.description?.toLowerCase() || '').includes(query)
      );
    }
    
    // --- 2. CATEGORY FILTER (The Fix) ---
    if (selectedCategory !== 'all') {
      // Map UI plurals to DB singulars
      const normalizationMap: Record<string, string> = {
        'libraries': 'library',
        'cafes': 'cafe',
        'restaurants': 'restaurant',
        'parks': 'park',
        'coworking': 'coworking'
      };

      const target = normalizationMap[selectedCategory] || selectedCategory;

      spots = spots.filter((spot: any) => {
        // Ensure we are checking the 'category' field specifically
        const spotCat = (spot.category || '').toLowerCase();
        return spotCat === target.toLowerCase();
      });
    }
    
    // --- 3. SORTING ---
    if (sortBy === 'distance' && userLat && userLon) {
      spots = spots.filter((spot: any) => spot.latitude && spot.longitude);
      spots.sort((a: any, b: any) => {
        const distA = calculateDistance(userLat, userLon, a.latitude, a.longitude);
        const distB = calculateDistance(userLat, userLon, b.latitude, b.longitude);
        return distA - distB;
      });
    }
    
    const total = spots.length;
    const offset = (page - 1) * limit;
    const paginatedSpots = spots.slice(offset, offset + limit);
    
    return c.json({ 
      spots: paginatedSpots, 
      total,
      page,
      totalPages: Math.ceil(total / limit),
      limit
    });
  } catch (error) {
    return c.json({ error: `Server error: ${error}` }, 500);
  }
});

// Helper function to calculate distance (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3959; // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// Get user's visited spots
app.get("/make-server-386acec3/user/history", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const supabase = getServiceClient();
    const { data: { user }, error } = await supabase.auth.getUser(accessToken || '');
    
    if (!user?.id || error) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const history = await kv.get(`user:${user.id}:history`);
    return c.json({ history: history || [] });
  } catch (error) {
    console.log('Get user history error:', error);
    return c.json({ error: `Failed to fetch user history: ${error}` }, 500);
  }
});

// Add spot to user history
app.post("/make-server-386acec3/user/history", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const supabase = getServiceClient();
    const { data: { user }, error } = await supabase.auth.getUser(accessToken || '');
    
    if (!user?.id || error) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    const { spotId } = await c.req.json();
    
    const history = await kv.get(`user:${user.id}:history`) || [];
    if (!history.includes(spotId)) {
      history.push(spotId);
      await kv.set(`user:${user.id}:history`, history);
    }

    return c.json({ message: "Added to history", history });
  } catch (error) {
    console.log('Add to history error:', error);
    return c.json({ error: `Failed to add to history: ${error}` }, 500);
  }
});

// Get reviews for a spot
app.get("/make-server-386acec3/spots/:spotId/reviews", async (c) => {
  try {
    const spotId = c.req.param('spotId');
    const reviews = await kv.get(`reviews:${spotId}`);
    return c.json({ reviews: reviews || [] });
  } catch (error) {
    console.log('Get reviews error:', error);
    return c.json({ error: `Failed to fetch reviews: ${error}` }, 500);
  }
});

// Add a review
app.post("/make-server-386acec3/spots/:spotId/reviews", async (c) => {
  try {
    const accessToken = c.req.header('Authorization')?.split(' ')[1];
    const supabase = getServiceClient();
    const { data: { user }, error } = await supabase.auth.getUser(accessToken || '');
    
    if (!user?.id || error) {
      return c.json({ error: 'Unauthorized - please log in to submit a review' }, 401);
    }

    const spotId = c.req.param('spotId');
    const { rating, comment } = await c.req.json();

    if (!rating || rating < 1 || rating > 5) {
      return c.json({ error: "Rating must be between 1 and 5" }, 400);
    }

    const reviews = await kv.get(`reviews:${spotId}`) || [];
    const newReview = {
      id: `${user.id}-${Date.now()}`,
      userId: user.id,
      userName: user.user_metadata?.name || 'Anonymous',
      rating,
      comment: comment || '',
      createdAt: new Date().toISOString()
    };
    
    reviews.push(newReview);
    await kv.set(`reviews:${spotId}`, reviews);

    return c.json({ message: "Review added", review: newReview });
  } catch (error) {
    console.log('Add review error:', error);
    return c.json({ error: `Failed to add review: ${error}` }, 500);
  }
});

// Initialize default study spots if not exists
app.post("/make-server-386acec3/init-spots", async (c) => {
  try {
    const existingSpots = await kv.getByPrefix('spot:');
    
    // Check if we need to update spots with new fields
    const needsUpdate = existingSpots && existingSpots.length > 0 && 
      existingSpots.some(spot => !spot.latitude || !spot.longitude || !spot.category);
    
    if (!existingSpots || existingSpots.length === 0 || needsUpdate) {
      // Delete old spots if they exist
      if (existingSpots && existingSpots.length > 0) {
        const deleteKeys = existingSpots.map(spot => spot.id);
        await kv.mdel(...deleteKeys);
      }
      
      const defaultSpots = [
        // Libraries
        {
          id: 'spot:1',
          name: 'The New York Public Library - Stephen A. Schwarzman Building',
          neighborhood: 'Midtown Manhattan',
          address: '476 5th Ave, New York, NY 10018',
          description: 'Iconic library with stunning reading rooms and free WiFi. Perfect for focused studying.',
          wifi: true,
          outlets: true,
          noise: 'Quiet',
          hours: 'Mon-Sat: 10AM-6PM, Sun: 1PM-5PM',
          latitude: 40.7532,
          longitude: -73.9822,
          category: 'library'
        },
        {
          id: 'spot:2',
          name: 'Brooklyn Public Library - Central Library',
          neighborhood: 'Prospect Heights',
          address: '10 Grand Army Plaza, Brooklyn, NY 11238',
          description: 'Beautiful library with spacious study areas and excellent natural lighting.',
          wifi: true,
          outlets: true,
          noise: 'Quiet',
          hours: 'Mon-Thu: 9AM-9PM, Fri-Sat: 9AM-6PM, Sun: 1PM-5PM',
          latitude: 40.6725,
          longitude: -73.9682,
          category: 'library'
        },
        {
          id: 'spot:3',
          name: 'Jefferson Market Library',
          neighborhood: 'Greenwich Village',
          address: '425 6th Ave, New York, NY 10011',
          description: 'Historic Gothic Revival building with quiet study spaces and great architecture.',
          wifi: true,
          outlets: true,
          noise: 'Quiet',
          hours: 'Mon, Wed: 10AM-8PM, Tue, Thu: 10AM-6PM, Fri-Sat: 10AM-5PM',
          latitude: 40.7350,
          longitude: -73.9996,
          category: 'library'
        },
        {
          id: 'spot:4',
          name: 'Queens Public Library - Flushing Branch',
          neighborhood: 'Flushing',
          address: '41-17 Main St, Flushing, NY 11355',
          description: 'Large modern library with dedicated study rooms and extensive resources.',
          wifi: true,
          outlets: true,
          noise: 'Quiet',
          hours: 'Mon-Thu: 10AM-9PM, Fri-Sat: 10AM-5PM, Sun: 1PM-5PM',
          latitude: 40.7590,
          longitude: -73.8303,
          category: 'library'
        },
        {
          id: 'spot:5',
          name: 'Science, Industry and Business Library (SIBL)',
          neighborhood: 'Midtown Manhattan',
          address: '188 Madison Ave, New York, NY 10016',
          description: 'Modern business-focused library with tech resources and collaborative spaces.',
          wifi: true,
          outlets: true,
          noise: 'Low',
          hours: 'Mon, Thu-Sat: 10AM-6PM, Tue-Wed: 10AM-8PM',
          latitude: 40.7444,
          longitude: -73.9825,
          category: 'library'
        },
        
        // Cafes
        {
          id: 'spot:6',
          name: 'Think Coffee',
          neighborhood: 'Greenwich Village',
          address: '248 Mercer St, New York, NY 10012',
          description: 'Popular coffee shop near NYU with plenty of seating and good atmosphere for studying.',
          wifi: true,
          outlets: true,
          noise: 'Moderate',
          hours: 'Daily: 7AM-10PM',
          latitude: 40.7282,
          longitude: -73.9960,
          category: 'cafe'
        },
        {
          id: 'spot:7',
          name: 'Starbucks Reserve Roastery',
          neighborhood: 'Chelsea',
          address: '61 9th Ave, New York, NY 10011',
          description: 'Upscale Starbucks with multiple floors, great for group study or solo work.',
          wifi: true,
          outlets: true,
          noise: 'Moderate',
          hours: 'Daily: 7AM-10PM',
          latitude: 40.7420,
          longitude: -74.0060,
          category: 'cafe'
        },
        {
          id: 'spot:8',
          name: 'Joe Coffee - West Village',
          neighborhood: 'West Village',
          address: '141 Waverly Pl, New York, NY 10014',
          description: 'Cozy neighborhood coffee shop with friendly atmosphere and good espresso.',
          wifi: true,
          outlets: true,
          noise: 'Moderate',
          hours: 'Daily: 7AM-8PM',
          latitude: 40.7338,
          longitude: -74.0006,
          category: 'cafe'
        },
        {
          id: 'spot:9',
          name: 'Birch Coffee',
          neighborhood: 'Flatiron',
          address: '134 1/2 W 17th St, New York, NY 10011',
          description: 'Small batch coffee roaster with minimalist design and quiet study nooks.',
          wifi: true,
          outlets: true,
          noise: 'Low',
          hours: 'Mon-Fri: 7AM-7PM, Sat-Sun: 8AM-7PM',
          latitude: 40.7400,
          longitude: -73.9960,
          category: 'cafe'
        },
        {
          id: 'spot:10',
          name: 'Bluestone Lane',
          neighborhood: 'Upper West Side',
          address: '2090 Broadway, New York, NY 10023',
          description: 'Australian-inspired cafe with spacious seating and excellent natural light.',
          wifi: true,
          outlets: true,
          noise: 'Moderate',
          hours: 'Daily: 7AM-7PM',
          latitude: 40.7784,
          longitude: -73.9819,
          category: 'cafe'
        },
        
        // Restaurants
        {
          id: 'spot:11',
          name: 'Panera Bread - Union Square',
          neighborhood: 'Union Square',
          address: '7 E 14th St, New York, NY 10003',
          description: 'Chain restaurant with reliable WiFi, comfortable booths, and all-day dining options.',
          wifi: true,
          outlets: true,
          noise: 'Moderate',
          hours: 'Daily: 7AM-9PM',
          latitude: 40.7354,
          longitude: -73.9910,
          category: 'restaurant'
        },
        {
          id: 'spot:12',
          name: 'Sweetgreen',
          neighborhood: 'NoMad',
          address: '1164 Broadway, New York, NY 10001',
          description: 'Healthy fast-casual spot with communal tables perfect for laptop work.',
          wifi: true,
          outlets: true,
          noise: 'Moderate',
          hours: 'Daily: 10:30AM-10PM',
          latitude: 40.7455,
          longitude: -73.9881,
          category: 'restaurant'
        },
        {
          id: 'spot:13',
          name: 'Le Pain Quotidien',
          neighborhood: 'Upper East Side',
          address: '1131 Madison Ave, New York, NY 10028',
          description: 'Belgian bakery-restaurant with communal tables and cozy atmosphere.',
          wifi: true,
          outlets: true,
          noise: 'Low',
          hours: 'Daily: 8AM-8PM',
          latitude: 40.7815,
          longitude: -73.9587,
          category: 'restaurant'
        },
        {
          id: 'spot:14',
          name: 'Chipotle Mexican Grill',
          neighborhood: 'Financial District',
          address: '150 Broadway, New York, NY 10038',
          description: 'Fast-casual with spacious second-floor seating and reliable WiFi.',
          wifi: true,
          outlets: true,
          noise: 'Moderate',
          hours: 'Daily: 10:45AM-10PM',
          latitude: 40.7094,
          longitude: -74.0101,
          category: 'restaurant'
        },
        {
          id: 'spot:15',
          name: 'Dig Inn',
          neighborhood: 'Midtown East',
          address: '401 Park Ave S, New York, NY 10016',
          description: 'Farm-to-table restaurant with comfortable seating and power outlets.',
          wifi: true,
          outlets: true,
          noise: 'Moderate',
          hours: 'Daily: 11AM-9PM',
          latitude: 40.7452,
          longitude: -73.9836,
          category: 'restaurant'
        },
        {
          id: 'spot:16',
          name: 'Two Hands',
          neighborhood: 'Tribeca',
          address: '164 Mott St, New York, NY 10013',
          description: 'Australian cafe with all-day breakfast and laptop-friendly atmosphere.',
          wifi: true,
          outlets: true,
          noise: 'Moderate',
          hours: 'Daily: 8AM-5PM',
          latitude: 40.7212,
          longitude: -73.9956,
          category: 'restaurant'
        },
        {
          id: 'spot:17',
          name: 'The Smith',
          neighborhood: 'Midtown',
          address: '956 2nd Ave, New York, NY 10022',
          description: 'American brasserie with spacious booths and work-friendly during off-peak hours.',
          wifi: true,
          outlets: true,
          noise: 'Moderate',
          hours: 'Mon-Fri: 7:30AM-11PM, Sat-Sun: 10AM-11PM',
          latitude: 40.7589,
          longitude: -73.9658,
          category: 'restaurant'
        },
        {
          id: 'spot:18',
          name: 'Pret A Manger',
          neighborhood: 'Chelsea',
          address: '220 W 23rd St, New York, NY 10011',
          description: 'British sandwich chain with comfortable seating and quiet corners.',
          wifi: true,
          outlets: true,
          noise: 'Low',
          hours: 'Mon-Fri: 6:30AM-8PM, Sat-Sun: 7AM-7PM',
          latitude: 40.7445,
          longitude: -73.9974,
          category: 'restaurant'
        },
        
        // Parks
        {
          id: 'spot:19',
          name: 'Bryant Park',
          neighborhood: 'Midtown Manhattan',
          address: '42nd St & 6th Ave, New York, NY 10018',
          description: 'Beautiful urban park with free WiFi, movable chairs, and seasonal reading room.',
          wifi: true,
          outlets: false,
          noise: 'Low',
          hours: 'Daily: 7AM-10PM',
          latitude: 40.7536,
          longitude: -73.9832,
          category: 'park'
        },
        {
          id: 'spot:20',
          name: 'Washington Square Park',
          neighborhood: 'Greenwich Village',
          address: '5th Ave & Washington Square N, New York, NY 10011',
          description: 'Historic park near NYU with benches and tables, great for outdoor study sessions.',
          wifi: false,
          outlets: false,
          noise: 'Moderate',
          hours: 'Daily: 6AM-12AM',
          latitude: 40.7308,
          longitude: -73.9973,
          category: 'park'
        },
        {
          id: 'spot:21',
          name: 'Madison Square Park',
          neighborhood: 'Flatiron',
          address: 'Madison Ave & E 23rd St, New York, NY 10010',
          description: 'Peaceful park with benches, tables, and beautiful landscaping.',
          wifi: false,
          outlets: false,
          noise: 'Low',
          hours: 'Daily: 6AM-11PM',
          latitude: 40.7425,
          longitude: -73.9887,
          category: 'park'
        },
        {
          id: 'spot:22',
          name: 'Brooklyn Bridge Park',
          neighborhood: 'Brooklyn Heights',
          address: '334 Furman St, Brooklyn, NY 11201',
          description: 'Waterfront park with stunning Manhattan views and quiet spots for reading.',
          wifi: false,
          outlets: false,
          noise: 'Low',
          hours: 'Daily: 6AM-1AM',
          latitude: 40.7023,
          longitude: -73.9966,
          category: 'park'
        },
        {
          id: 'spot:23',
          name: 'Central Park - Conservatory Garden',
          neighborhood: 'Upper East Side',
          address: '1 E 105th St, New York, NY 10029',
          description: 'Formal garden within Central Park offering peaceful, quiet study environment.',
          wifi: false,
          outlets: false,
          noise: 'Quiet',
          hours: 'Daily: 8AM-Dusk',
          latitude: 40.7947,
          longitude: -73.9516,
          category: 'park'
        },
        {
          id: 'spot:24',
          name: 'The High Line',
          neighborhood: 'Chelsea',
          address: 'Gansevoort St to 34th St, New York, NY 10011',
          description: 'Elevated park with benches, art installations, and unique city views.',
          wifi: false,
          outlets: false,
          noise: 'Low',
          hours: 'Daily: 7AM-10PM',
          latitude: 40.7480,
          longitude: -74.0048,
          category: 'park'
        },
        {
          id: 'spot:25',
          name: 'Fort Tryon Park',
          neighborhood: 'Washington Heights',
          address: 'Riverside Dr to Broadway, New York, NY 10040',
          description: 'Hilltop park with quiet spots, beautiful views, and The Met Cloisters.',
          wifi: false,
          outlets: false,
          noise: 'Quiet',
          hours: 'Daily: 6AM-1AM',
          latitude: 40.8592,
          longitude: -73.9320,
          category: 'park'
        },
        
        // Co-working Spaces
        {
          id: 'spot:26',
          name: 'WeWork SoHo',
          neighborhood: 'SoHo',
          address: '115 Broadway, New York, NY 10006',
          description: 'Professional co-working environment with fast internet and comfortable seating.',
          wifi: true,
          outlets: true,
          noise: 'Low',
          hours: 'Mon-Fri: 9AM-6PM',
          latitude: 40.7089,
          longitude: -74.0105,
          category: 'coworking'
        },
        {
          id: 'spot:27',
          name: 'New York Public Library - Stavros Niarchos Foundation Library',
          neighborhood: 'Midtown Manhattan',
          address: '455 5th Ave, New York, NY 10016',
          description: 'Modern library branch with tech-friendly spaces and collaborative study areas.',
          wifi: true,
          outlets: true,
          noise: 'Low',
          hours: 'Mon-Sat: 10AM-6PM, Sun: 1PM-5PM',
          latitude: 40.7485,
          longitude: -73.9835,
          category: 'library'
        },
        {
          id: 'spot:28',
          name: 'Greenlight Bookstore Cafe',
          neighborhood: 'Fort Greene',
          address: '686 Fulton St, Brooklyn, NY 11217',
          description: 'Independent bookstore with cafe, perfect for reading and light studying.',
          wifi: true,
          outlets: true,
          noise: 'Low',
          hours: 'Daily: 10AM-9PM',
          latitude: 40.6867,
          longitude: -73.9814,
          category: 'cafe'
        },
        {
          id: 'spot:29',
          name: 'Variety Coffee Roasters',
          neighborhood: 'Williamsburg',
          address: '146 Wythe Ave, Brooklyn, NY 11249',
          description: 'Specialty coffee shop with industrial design and dedicated work space.',
          wifi: true,
          outlets: true,
          noise: 'Moderate',
          hours: 'Daily: 7AM-6PM',
          latitude: 40.7169,
          longitude: -73.9573,
          category: 'cafe'
        },
        {
          id: 'spot:30',
          name: 'Whole Foods Market - Union Square',
          neighborhood: 'Union Square',
          address: '4 Union Square S, New York, NY 10003',
          description: 'Grocery store with spacious seating area, food options, and WiFi.',
          wifi: true,
          outlets: true,
          noise: 'Moderate',
          hours: 'Daily: 8AM-11PM',
          latitude: 40.7347,
          longitude: -73.9907,
          category: 'restaurant'
        }
      ];

      for (const spot of defaultSpots) {
        await kv.set(spot.id, spot);
      }

      return c.json({ message: "Default spots initialized", count: defaultSpots.length });
    }

    return c.json({ message: "Spots already exist" });
  } catch (error) {
    console.log('Init spots error:', error);
    return c.json({ error: `Failed to initialize spots: ${error}` }, 500);
  }
});

Deno.serve(app.fetch);