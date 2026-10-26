import Supercluster from 'supercluster';

/** Same radius and zoom cap as supercluster’s usual defaults. */
export const CLUSTER_RADIUS = 40;
export const CLUSTER_MAX_ZOOM = 16;

export interface MapPoint {
  id: string;
  longitude: number;
  latitude: number;
}

export type ClusterGroup =
  | { kind: 'point'; id: string; longitude: number; latitude: number }
  | { kind: 'cluster'; count: number; longitude: number; latitude: number; expansionZoom: number };

export interface ClusterQuery {
  zoom: number;
  /** West, south, east, north. */
  bbox: [number, number, number, number];
}

/**
 * Nearby transients become one dot while the map is zoomed out, and split again on the way in.
 * The index is rebuilt per call; a personal library is small enough that this stays cheap.
 */
export function clusterTransients(points: MapPoint[], query: ClusterQuery): ClusterGroup[] {
  if (!query.bbox.every((value) => Number.isFinite(value))) return [];
  const features = points
    .filter((point) => Number.isFinite(point.longitude) && Number.isFinite(point.latitude))
    .map((point) => ({
      type: 'Feature' as const,
      properties: { id: point.id },
      geometry: { type: 'Point' as const, coordinates: [point.longitude, point.latitude] as [number, number] },
    }));
  const index = new Supercluster<{ id: string }>({
    radius: CLUSTER_RADIUS,
    maxZoom: CLUSTER_MAX_ZOOM,
    minPoints: 2,
  }).load(features);
  const zoom = Number.isFinite(query.zoom) ? Math.floor(query.zoom) : 0;
  return index.getClusters(query.bbox, zoom).flatMap((feature): ClusterGroup[] => {
    const [longitude, latitude] = feature.geometry.coordinates;
    const props = feature.properties;
    if (props && 'cluster' in props && props.cluster) {
      return [
        {
          kind: 'cluster',
          count: props.point_count,
          longitude,
          latitude,
          expansionZoom: index.getClusterExpansionZoom(props.cluster_id),
        },
      ];
    }
    const id = props && 'id' in props ? props.id : '';
    if (!id) return [];
    return [{ kind: 'point', id, longitude, latitude }];
  });
}
