/* UPDATED FOR FLAT CSV SCHEMA */

/* Table schema is now:
id, name, wifi, hours, noise, address, outlets, neighborhood, latitude, longitude, type, description
*/

import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const client = () => createClient(
  Deno.env.get("SUPABASE_URL"),
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
);

// Get retrieves a single spot by its ID.
export const get = async (id: string): Promise<any> => {
  const supabase = client();
  // We select "*" to get all your new columns (name, address, etc.)
  const { data, error } = await supabase.from("kv_store_386acec3").select("*").eq("id", id).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  return data; // Return the whole row object
};

// Gets multiple spots by their IDs.
export const mget = async (ids: string[]): Promise<any[]> => {
  const supabase = client();
  const { data, error } = await supabase.from("kv_store_386acec3").select("*").in("id", ids);
  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
};

// Search for spots by ID prefix (e.g., "spot:")
export const getByPrefix = async (prefix: string): Promise<any[]> => {
  const supabase = client();
  // This is likely what Figma calls to show the list
  const { data, error } = await supabase.from("kv_store_386acec3").select("*").like("id", prefix + "%");
  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
};

// Delete a spot.
export const del = async (id: string): Promise<void> => {
  const supabase = client();
  const { error } = await supabase.from("kv_store_386acec3").delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }
};

// --- UPSERT LOGIC ---
// Note: set and mset now expect objects that match your CSV columns.
export const set = async (id: string, value: any): Promise<void> => {
  const supabase = client();
  const { error } = await supabase.from("kv_store_386acec3").upsert({
    id,
    ...value // Spread the object (name, address, etc.) into columns
  });
  if (error) {
    throw new Error(error.message);
  }
};

export const mset = async (ids: string[], values: any[]): Promise<void> => {
  const supabase = client();
  const { error } = await supabase.from("kv_store_386acec3").upsert(
    ids.map((id, i) => ({ id, ...values[i] }))
  );
  if (error) {
    throw new Error(error.message);
  }
};