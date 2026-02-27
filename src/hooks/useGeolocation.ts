'use client';

import { useState, useCallback } from 'react';

interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  loading: boolean;
  error: string | null;
}

export function useGeolocation() {
  const [state, setState] = useState<GeolocationState>({
    latitude: null,
    longitude: null,
    loading: false,
    error: null,
  });

  const getPosition = useCallback(() => {
    if (!navigator.geolocation) {
      setState((prev) => ({ ...prev, error: 'Géolocalisation non disponible' }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true, error: null }));

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          loading: false,
          error: null,
        });
      },
      (error) => {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error.message,
        }));
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }, []);

  return { ...state, getPosition };
}
