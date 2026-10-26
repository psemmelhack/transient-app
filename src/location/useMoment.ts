import * as Location from 'expo-location';
import { useCallback, useEffect, useState } from 'react';
import { reverseGeocode } from '../data/geocode';
import {
  deviceTimeZone,
  exampleMoment,
  EXAMPLE_INSTANT,
  type Moment,
  type PlaceInfo,
} from '../data/moment';
import { fetchTemperatureC } from '../data/weather';
import { isNativeShell, NATIVE_LOCATION_EVENT, onNativeEvent, postToNative } from '../native/shell';
import type { ShellLocationDetail } from '../native/protocol';

export type LocateStatus = 'acquiring' | 'ready';

interface ReadyLoc {
  status: 'ready';
  source: 'device' | 'example';
  latitude: number;
  longitude: number;
  altitude: number | null;
  accuracy: number | null;
  altitudeAccuracy: number | null;
  speed: number | null;
  course: number | null;
  place: PlaceInfo | null;
}

interface AcquiringLoc {
  status: 'acquiring';
}

type LocState = ReadyLoc | AcquiringLoc;

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function exampleLoc(): ReadyLoc {
  const sample = exampleMoment();
  return {
    status: 'ready',
    source: 'example',
    latitude: sample.latitude,
    longitude: sample.longitude,
    altitude: sample.altitude,
    accuracy: null,
    altitudeAccuracy: null,
    speed: null,
    course: null,
    place: sample.place,
  };
}

export function useMoment(fixture: boolean): {
  moment: Moment | null;
  now: Date;
  status: LocateStatus;
  retry: () => void;
} {
  const [now, setNow] = useState(() => (fixture ? EXAMPLE_INSTANT : new Date()));
  const [loc, setLoc] = useState<LocState>(fixture ? { ...exampleLoc(), source: 'example' } : { status: 'acquiring' });
  const [temperatureC, setTemperatureC] = useState<number | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (fixture) return;
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, [fixture]);

  useEffect(() => {
    if (fixture || !isNativeShell()) return;
    const stop = onNativeEvent<ShellLocationDetail>(NATIVE_LOCATION_EVENT, (detail) => {
      if (!detail || detail.status === 'unavailable') {
        setLoc(exampleLoc());
        return;
      }
      const location = detail.location;
      if (typeof location?.latitude !== 'number' || typeof location.longitude !== 'number') {
        setLoc(exampleLoc());
        return;
      }
      setLoc({
        status: 'ready',
        source: 'device',
        latitude: location.latitude,
        longitude: location.longitude,
        altitude: finiteOrNull(location.altitude),
        accuracy: finiteOrNull(location.accuracy),
        altitudeAccuracy: finiteOrNull(location.altitudeAccuracy),
        speed: finiteOrNull(location.speed),
        course: finiteOrNull(location.course),
        place: location.place ?? null,
      });
    });
    const giveUp = setTimeout(() => {
      setLoc((prev) => (prev.status === 'acquiring' ? exampleLoc() : prev));
    }, 9000);
    postToNative(attempt > 0 ? { type: 'retry-location' } : { type: 'ready' });
    return () => {
      clearTimeout(giveUp);
      stop();
    };
  }, [fixture, attempt]);

  useEffect(() => {
    if (fixture || isNativeShell()) return;
    let cancelled = false;
    let watch: Location.LocationSubscription | null = null;
    setLoc({ status: 'acquiring' });
    const giveUp = setTimeout(() => {
      if (!cancelled) setLoc(exampleLoc());
    }, 9000);

    const apply = (pos: Location.LocationObject) => {
      if (cancelled) return;
      clearTimeout(giveUp);
      setLoc({
        status: 'ready',
        source: 'device',
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        altitude: finiteOrNull(pos.coords.altitude),
        accuracy: finiteOrNull(pos.coords.accuracy),
        altitudeAccuracy: finiteOrNull(pos.coords.altitudeAccuracy),
        speed: finiteOrNull(pos.coords.speed),
        course: finiteOrNull(pos.coords.heading),
        place: null,
      });
    };

    (async () => {
      try {
        const perm = await Location.requestForegroundPermissionsAsync();
        if (cancelled) return;
        if (perm.status !== 'granted') {
          clearTimeout(giveUp);
          setLoc(exampleLoc());
          return;
        }
        const first = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
        apply(first);
        watch = await Location.watchPositionAsync(
          { accuracy: Location.Accuracy.Balanced, timeInterval: 5000, distanceInterval: 8 },
          apply,
        );
      } catch {
        if (!cancelled) {
          clearTimeout(giveUp);
          setLoc(exampleLoc());
        }
      }
    })();

    return () => {
      cancelled = true;
      clearTimeout(giveUp);
      watch?.remove();
    };
  }, [fixture, attempt]);

  useEffect(() => {
    if (loc.status !== 'ready' || loc.source !== 'device' || loc.place?.full) return;
    let cancelled = false;
    reverseGeocode(loc.latitude, loc.longitude).then((place) => {
      if (cancelled || !place) return;
      setLoc((prev) => {
        if (prev.status !== 'ready' || prev.source !== 'device') return prev;
        return { ...prev, place };
      });
    });
    return () => {
      cancelled = true;
    };
  }, [loc.status, loc.status === 'ready' ? loc.source : '', loc.status === 'ready' ? loc.latitude : 0, loc.status === 'ready' ? loc.longitude : 0]);

  useEffect(() => {
    if (loc.status !== 'ready') return;
    let cancelled = false;
    fetchTemperatureC(loc.latitude, loc.longitude).then((value) => {
      if (!cancelled) setTemperatureC(value);
    });
    return () => {
      cancelled = true;
    };
  }, [loc.status, loc.status === 'ready' ? loc.latitude.toFixed(2) : '', loc.status === 'ready' ? loc.longitude.toFixed(2) : '']);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);

  const moment: Moment | null =
    loc.status === 'ready'
      ? {
          at: now,
          latitude: loc.latitude,
          longitude: loc.longitude,
          altitude: loc.altitude,
          accuracy: loc.accuracy,
          altitudeAccuracy: loc.altitudeAccuracy,
          speed: loc.speed,
          course: loc.course,
          place: loc.place,
          timezone: loc.source === 'example' ? 'America/Los_Angeles' : deviceTimeZone(),
          source: loc.source,
          temperatureC,
          sensors: null,
        }
      : null;

  return { moment, now, status: loc.status, retry };
}
