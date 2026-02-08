import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

const app = new Hono();

const getServiceClient = () => {
  return createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );
};

app.use('*', logger(console.log));
app.use("/*", cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}));

// --- UPDATED SPOTS ENDPOINT ---
app.get("/make-server-386acec3/spots", async (c: any) => {
  try {
    const url = new URL(c.req.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const search = url.searchParams.get('search') || '';
    const selectedCategory = url.searchParams.get('category') || 'all'; 
    const sortBy = url.searchParams.get('sortBy') || 'none';
    
    const supabase = getServiceClient();
    
    // FETCH DIRECTLY FROM COLUMNS (Much faster than batching JSON in memory)
    let query = supabase
      .from('kv_store_386acec3')
      .select('*', { count: 'exact' });

    // 1. DATABASE SIDE SEARCH
    if (search) {
      query = query.or(`name.ilike.%${search}%,neighborhood.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // 2. DATABASE SIDE CATEGORY FILTER
    if (selectedCategory !== 'all') {
      const normalizationMap: Record<string, string> = {
        'libraries': 'libraries',
        'cafes': 'cafes',
        'restaurants': 'restaurants',
        'parks': 'parks',
        'coworking': 'coworking'
      };
      const target = normalizationMap[selectedCategory] || selectedCategory;
      query = query.eq('category', target);
    }

    // 3. DATABASE SIDE SORTING
    if (sortBy === 'rating') {
      query = query.order('avg_rating', { ascending: false }).order('review_count', { ascending: false });
    } else if (sortBy === 'distance') {
      // For distance sort, return all spots without pagination (client will sort by distance)
      query = query.order('name', { ascending: true });
    } else {
      query = query.order('name', { ascending: true });
    }

    // 4. PAGINATION
    const pageLimit = sortBy === 'distance' ? 100 : limit; // Use 100 for distance, 20 for others
    const from = (page - 1) * pageLimit;
    const to = from + pageLimit - 1;
    const { data, count, error } = await query.range(from, to);

    if (error) throw error;

    return c.json({ 
      spots: data || [], // 'data' now contains 'key', 'name', 'avg_rating', etc. directly
      total: count || 0,
      page,
      totalPages: Math.ceil((count || 0) / limit)
    });
  } catch (error) {
    console.error("Spots error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return c.json({ error: `Server error: ${errorMessage}` }, 500);
  }
});

// --- UPDATED INIT SPOTS (Uses 'key' instead of 'id') ---
app.post("/make-server-386acec3/init-spots", async (c: any) => {
  try {
    const supabase = getServiceClient();
    
    // Check if table is empty
    const { count } = await supabase.from('kv_store_386acec3').select('*', { count: 'exact', head: true });
    
    if (count === 0) {
      const defaultSpots = [
        {
          key: 'spot:1', // CHANGED FROM id TO key
          name: 'The New York Public Library',
          neighborhood: 'Midtown',
          avg_rating: 4.8,
          review_count: 1250,
          category: 'libraries',
          wifi: true,
          outlets: true,
          noise: 'Quiet',
          latitude: 40.7532,
          longitude: -73.9822
        }
        // ... add others here
      ];

      await supabase.from('kv_store_386acec3').insert(defaultSpots);
      return c.json({ message: "Spots initialized" });
    }
    return c.json({ message: "Spots already exist" });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return c.json({ error: errorMessage }, 500);
  }
});

// --- GET SINGLE SPOT BY KEY ---
app.get("/make-server-386acec3/spots/:spotId", async (c: any) => {
  const spotId = c.req.param('spotId');
  const supabase = getServiceClient();

  console.log("Searching for spot with key:", spotId); // Debug log

  const { data, error } = await supabase
    .from('kv_store_386acec3')
    .select('*')
    .eq('key', spotId)
    .maybeSingle();

  if (error) {
    console.error("Supabase error:", error);
    return c.json({ error: "Database lookup failed" }, 500);
  }
  
  if (!data) {
    console.warn("Spot not found with key:", spotId);
    return c.json({ error: "Study spot not found in database" }, 404);
  }

  // Returns the full row (which includes key, name, category, etc.)
  return c.json(data);
});

// --- GET REVIEWS FOR A SPOT ---
app.get("/make-server-386acec3/spots/:spotId/reviews", async (c: any) => {
  const spotId = c.req.param('spotId');
  const supabase = getServiceClient();

  try {
    console.log("Looking up reviews for spot:", spotId);
    // Check if spot exists first
    const { data: spotData, error: spotError } = await supabase
      .from('kv_store_386acec3')
      .select('key')
      .eq('key', spotId)
      .maybeSingle();

    if (spotError) {
      console.error("Spot lookup error:", spotError);
      return c.json({ reviews: [] }); // Return empty array if spot not found
    }
    
    if (!spotData) {
      console.warn("No spot found with key:", spotId);
      return c.json({ reviews: [] }); // Return empty array if spot not found
    }

    const actualSpotId = spotId;

    const { data, error } = await supabase
      .from('reviews_386acec3')
      .select('*')
      .eq('spot_id', actualSpotId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error("Supabase error:", error);
      return c.json({ reviews: [] }); // Return empty array if table doesn't exist
    }

    // Transform data to match Review interface
    const reviews = (data || []).map((review: any) => ({
      id: review.id,
      userId: review.user_id,
      userName: review.user_name || 'Anonymous',
      rating: review.rating,
      comment: review.comment,
      createdAt: review.created_at,
    }));

    return c.json({ reviews });
  } catch (error) {
    console.error("Error fetching reviews:", error);
    return c.json({ reviews: [] });
  }
});

// --- POST A REVIEW ---
app.post("/make-server-386acec3/spots/:spotId/reviews", async (c: any) => {
  const spotId = c.req.param('spotId');
  const supabase = getServiceClient();
  
  try {
    const body = await c.req.json();
    let { rating, comment, userName, userId } = body;

    console.log('Creating review:', { spotId, userId, userName, rating, comment: comment?.substring(0, 30) });

    if (!rating || rating < 1 || rating > 5) {
      return c.json({ error: 'Invalid rating. Must be between 1 and 5' }, 400);
    }

    // Check if spot exists first
    const { data: spotData, error: spotError } = await supabase
      .from('kv_store_386acec3')
      .select('key')
      .eq('key', spotId)
      .maybeSingle();

    if (spotError) {
      console.error("Spot lookup error:", spotError);
      return c.json({ error: `Spot lookup failed: ${spotError.message}` }, 500);
    }
    
    if (!spotData) {
      console.warn("No spot found with key:", spotId);
      return c.json({ error: 'Study spot not found' }, 404);
    }

    const actualSpotId = spotId;

    // Keep userId as null if not provided (no foreign key constraint issue)
    const reviewData: any = {
      spot_id: actualSpotId,
      user_name: userName || 'User',
      rating: parseInt(rating),
      comment: comment || '',
      created_at: new Date().toISOString(),
    };

    // Only add user_id if it's a valid value
    if (userId && userId !== 'anonymous') {
      reviewData.user_id = userId;
    }

    const { data, error } = await supabase
      .from('reviews_386acec3')
      .insert(reviewData)
      .select()
      .single();

    if (error) {
      console.error("Supabase insert error:", error);
      return c.json({ error: `Database error: ${error.message}` }, 500);
    }

    console.log('Review created successfully:', data.id);

    return c.json({
      id: data.id,
      userId: data.user_id || null,
      userName: data.user_name,
      rating: data.rating,
      comment: data.comment,
      createdAt: data.created_at,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Review error:", errorMessage);
    return c.json({ error: `Server error: ${errorMessage}` }, 500);
  }
});

Deno.serve(app.fetch);