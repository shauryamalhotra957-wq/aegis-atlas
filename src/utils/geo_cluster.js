/**
 * Geospatial Bounding-Box Grid Cluster Aggregator.
 * Aggregates dispersed humanitarian crisis points of interest into localized supply clusters.
 */
export class GeoSpatialGridClusterer {
  constructor(gridPrecisionDeg = 0.05) {
    this.gridPrecisionDeg = gridPrecisionDeg;
  }

  clusterPoints(points) {
    const grid = new Map();

    for (const pt of points) {
      const cellLat = Math.floor(pt.lat / this.gridPrecisionDeg) * this.gridPrecisionDeg;
      const cellLng = Math.floor(pt.lng / this.gridPrecisionDeg) * this.gridPrecisionDeg;
      const key = `${cellLat.toFixed(3)},${cellLng.toFixed(3)}`;

      if (!grid.has(key)) {
        grid.set(key, {
          cellKey: key,
          cellOrigin: { lat: Number(cellLat.toFixed(3)), lng: Number(cellLng.toFixed(3)) },
          points: [],
          totalWeight: 0,
        });
      }

      const cell = grid.get(key);
      cell.points.push(pt);
      cell.totalWeight += (pt.weight || 1);
    }

    const clusters = [];
    for (const cell of grid.values()) {
      const avgLat = cell.points.reduce((sum, p) => sum + p.lat, 0) / cell.points.length;
      const avgLng = cell.points.reduce((sum, p) => sum + p.lng, 0) / cell.points.length;
      clusters.push({
        centroid: { lat: Number(avgLat.toFixed(4)), lng: Number(avgLng.toFixed(4)) },
        count: cell.points.length,
        totalWeight: cell.totalWeight,
        points: cell.points,
      });
    }

    return clusters;
  }
}
