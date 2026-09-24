import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { GeoSpatialGridClusterer } from '../src/utils/geo_cluster.js';

describe('GeoSpatialGridClusterer Test Suite', () => {
  test('clusters nearby points into same grid cell', () => {
    const clusterer = new GeoSpatialGridClusterer(0.1);
    const pts = [
      { id: 'req-1', lat: 37.771, lng: -122.411, weight: 10 },
      { id: 'req-2', lat: 37.779, lng: -122.419, weight: 5 },
      { id: 'far-away', lat: 40.712, lng: -74.006, weight: 20 },
    ];
    const clusters = clusterer.clusterPoints(pts);
    assert.strictEqual(clusters.length, 2);
    const sfCluster = clusters.find(c => c.count === 2);
    assert.ok(sfCluster);
    assert.strictEqual(sfCluster.totalWeight, 15);
  });

  test('empty list returns empty clusters', () => {
    const clusterer = new GeoSpatialGridClusterer();
    assert.deepStrictEqual(clusterer.clusterPoints([]), []);
  });
});
