import { describe, expect, it } from 'vitest';
import { CLUSTER_MAX_ZOOM, clusterTransients, type MapPoint } from './cluster';

const world: [number, number, number, number] = [-180, -85, 180, 85];

const nearby: MapPoint[] = [
  { id: 'a', longitude: -118.3833, latitude: 33.8344 },
  { id: 'b', longitude: -118.384, latitude: 33.8348 },
  { id: 'c', longitude: -118.383, latitude: 33.835 },
];

describe('map clusters', () => {
  it('leaves a single transient as a dot', () => {
    const groups = clusterTransients([nearby[0]], { zoom: 10, bbox: world });
    expect(groups).toEqual([{ kind: 'point', id: 'a', longitude: -118.3833, latitude: 33.8344 }]);
  });

  it('merges nearby transients when zoomed out and splits them when zoomed in', () => {
    const zoomedOut = clusterTransients(nearby, { zoom: 10, bbox: world });
    expect(zoomedOut).toHaveLength(1);
    expect(zoomedOut[0]).toMatchObject({ kind: 'cluster', count: 3 });

    const zoomedIn = clusterTransients(nearby, { zoom: 18, bbox: world });
    expect(zoomedIn.map((group) => (group.kind === 'point' ? group.id : group.kind)).sort()).toEqual(['a', 'b', 'c']);
  });

  it('keeps a distant transient out of the cluster', () => {
    const far: MapPoint = { id: 'far', longitude: -122.154222, latitude: 38.244777 };
    const groups = clusterTransients([...nearby, far], { zoom: 10, bbox: world });
    const cluster = groups.find((group) => group.kind === 'cluster');
    const point = groups.find((group) => group.kind === 'point');
    expect(cluster).toMatchObject({ kind: 'cluster', count: 3 });
    expect(point).toMatchObject({ kind: 'point', id: 'far' });
  });

  it('zooms a cluster to the level where it splits', () => {
    const [cluster] = clusterTransients(nearby, { zoom: 10, bbox: world });
    expect(cluster?.kind).toBe('cluster');
    if (cluster?.kind !== 'cluster') return;
    expect(cluster.expansionZoom).toBeGreaterThan(10);
    const opened = clusterTransients(nearby, { zoom: cluster.expansionZoom, bbox: world });
    expect(opened.every((group) => group.kind === 'point')).toBe(true);
    expect(opened).toHaveLength(3);
  });

  it('keeps identical coordinates clustered at the maximum zoom', () => {
    const stacked: MapPoint[] = [0, 1, 2].map((index) => ({
      id: String(index),
      longitude: -118.38,
      latitude: 33.83,
    }));
    const [cluster] = clusterTransients(stacked, { zoom: CLUSTER_MAX_ZOOM, bbox: world });
    expect(cluster).toMatchObject({ kind: 'cluster', count: 3 });
    if (cluster?.kind !== 'cluster') return;
    expect(cluster.expansionZoom).toBeGreaterThan(CLUSTER_MAX_ZOOM);
  });

  it('omits points outside the view and points without coordinates', () => {
    const groups = clusterTransients(
      [
        nearby[0],
        { id: 'east', longitude: 40, latitude: 10 },
        { id: 'bad', longitude: Number.NaN, latitude: 33 },
      ],
      { zoom: 12, bbox: [-119, 33, -118, 34] },
    );
    expect(groups).toEqual([expect.objectContaining({ kind: 'point', id: 'a' })]);
  });
});
