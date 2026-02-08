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
      query = query.order('avg_rating', { ascending: false });
    } else {
      query = query.order('name', { ascending: true });
    }

    // 4. PAGINATION
    const from = (page - 1) * limit;
    const to = from + limit - 1;
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
    .single();

  if (error || !data) {
    console.error("Supabase error or no data:", error);
    return c.json({ error: "Study spot not found in database" }, 404);
  }

  // Returns the full row (which includes key, name, category, etc.)
  return c.json(data);
});

Deno.serve(app.fetch);