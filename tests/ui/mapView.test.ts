import { describe, expect, it } from 'vitest';
import { INITIAL_VIEW, MAX_ZOOM, MIN_ZOOM, clampView, toMapPoint, viewAt, zoomOf } from '../../src/ui/map/mapView.ts';

const phone = { width: 390, height: 640 };

describe('zoom et déplacement de la carte avec les doigts', () => {
  it('pincer zoome autour des doigts : le point du plan sous les doigts ne bouge pas', () => {
    const anchor = toMapPoint(INITIAL_VIEW, phone, 200, 300);
    const zoomed = viewAt(anchor, phone, 200, 300, 2.5);
    expect(zoomOf(zoomed)).toBeCloseTo(2.5);
    const after = toMapPoint(zoomed, phone, 200, 300);
    expect(after.x).toBeCloseTo(anchor.x);
    expect(after.y).toBeCloseTo(anchor.y);
  });

  it('glisser un doigt déplace la carte avec lui', () => {
    const anchor = toMapPoint(INITIAL_VIEW, phone, 100, 100);
    const moved = viewAt(anchor, phone, 160, 140, 1);
    const after = toMapPoint(moved, phone, 160, 140);
    expect(after.x).toBeCloseTo(anchor.x);
    expect(after.y).toBeCloseTo(anchor.y);
  });

  it('le zoom reste entre 1 et 3, et la vue reste sur la ville', () => {
    const anchor = toMapPoint(INITIAL_VIEW, phone, 195, 320);
    expect(zoomOf(viewAt(anchor, phone, 195, 320, 20))).toBeCloseTo(MAX_ZOOM);
    expect(zoomOf(viewAt(anchor, phone, 195, 320, 0.1))).toBeCloseTo(MIN_ZOOM);
    const far = clampView({ ...INITIAL_VIEW, x: 5000, y: -5000 });
    expect(far.x + far.width / 2).toBeLessThanOrEqual(1000);
    expect(far.y + far.height / 2).toBeGreaterThanOrEqual(120);
  });
});
