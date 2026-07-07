// Admin-drawn "central area" highlights, persisted in the `map_areas` table and shown to all
// users. Mirrors the admin_locations pattern: direct client writes gated by RLS (admin only),
// everyone reads, MapScreen renders + subscribes to realtime changes.
import { supabase } from '../lib/supabase';

export interface MapArea {
  id: string;
  name: string;
  polygon: [number, number][]; // boundary ring: [lng,lat] points
  color: string | null;
  created_by: string | null;
  created_at: string;
}

export async function loadMapAreas(): Promise<MapArea[]> {
  const { data, error } = await supabase
    .from('map_areas')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) { console.error('loadMapAreas:', error.message); return []; }
  return (data ?? []) as MapArea[];
}

export async function insertMapArea(area: {
  name: string;
  polygon: [number, number][];
  color?: string;
  created_by: string | null;
}) {
  return supabase.from('map_areas').insert({
    name: area.name,
    polygon: area.polygon,
    color: area.color ?? '#F97316',
    created_by: area.created_by,
  });
}

export async function deleteMapArea(id: string) {
  return supabase.from('map_areas').delete().eq('id', id);
}
