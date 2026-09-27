import * as SunCalc from "suncalc";

const D2R = Math.PI / 180;

/**
 * Sun position in radians: `azimuth` measured from south, positive toward west; `altitude` above horizon.
 * (suncalc 2.x returns degrees with azimuth from north — normalised here, the one place it is called.)
 */
export function sunPosition(date: Date, lat: number, lon: number) {
  const p = SunCalc.getPosition(date, lat, lon);
  return { azimuth: (p.azimuth - 180) * D2R, altitude: p.altitude * D2R };
}

/** Unit vector toward the sun in scene space (north = -Z, east = +X, up = +Y). */
export function sunVector(date: Date, lat: number, lon: number): [number, number, number] {
  const { azimuth, altitude } = sunPosition(date, lat, lon);
  return sunVectorFromAngles(azimuth, altitude);
}

/** suncalc azimuth: radians from south, positive toward west. */
export function sunVectorFromAngles(azimuth: number, altitude: number): [number, number, number] {
  const c = Math.cos(altitude);
  return [-Math.sin(azimuth) * c, Math.sin(altitude), Math.cos(azimuth) * c];
}

/**
 * Panel pose that points the panel normal at the sun, for a robot yawed by `yaw` (rotation.y).
 * Returns rig values for Robot: azimuth (rotation.y of panel_azimuth) and tilt (rotation.x of panel_tilt).
 * Tilt is clamped to the actuator range; below the horizon the panel stows flat.
 */
export function trackingPose(sun: [number, number, number], yaw = 0, maxTilt = 1.05) {
  const [sx, sy, sz] = sun;
  if (sy <= 0.02) return { azimuth: 0, tilt: 0, stowed: true };
  const c = Math.cos(-yaw);
  const s = Math.sin(-yaw);
  const lx = sx * c + sz * s;
  const lz = -sx * s + sz * c;
  const azimuth = Math.atan2(lx, lz);
  const tilt = Math.min(maxTilt, Math.acos(Math.min(1, sy)));
  return { azimuth, tilt, stowed: false };
}

/** Incidence factor (cos of angle between panel normal and sun) for a given pose. */
export function incidence(sun: [number, number, number], tilt: number, azimuth: number, yaw = 0) {
  const a = azimuth + yaw;
  const n = [Math.sin(tilt) * Math.sin(a), Math.cos(tilt), Math.sin(tilt) * Math.cos(a)];
  return Math.max(0, n[0] * sun[0] + n[1] * sun[1] + n[2] * sun[2]);
}

/** Simple clear-sky irradiance model (W/m²) from solar altitude. */
export function clearSkyDNI(altitude: number) {
  if (altitude <= 0) return 0;
  const am = 1 / (Math.sin(altitude) + 0.50572 * Math.pow((altitude * 180) / Math.PI + 6.07995, -1.6364));
  return 1353 * Math.pow(0.7, Math.pow(am, 0.678));
}
