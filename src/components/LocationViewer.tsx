import React from 'react';
import { useJsApiLoader, GoogleMap, Marker, StreetViewPanorama } from '@react-google-maps/api';

interface LocationViewerProps {
  lat: number;
  lng: number;
}

const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = ['places', 'geometry'];

export const LocationViewer: React.FC<LocationViewerProps> = ({ lat, lng }) => {
  const { isLoaded } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries
  });

  if (!isLoaded) {
    return <div className="w-full h-64 bg-slate-100 animate-pulse rounded-xl flex items-center justify-center text-slate-500">Cargando mapas...</div>;
  }

  const center = { lat, lng };

  const handleStreetViewLoad = (panorama: google.maps.StreetViewPanorama) => {
    const location = panorama.getLocation();
    if (location && location.latLng) {
      const heading = google.maps.geometry.spherical.computeHeading(
        location.latLng,
        new google.maps.LatLng(lat, lng)
      );
      panorama.setPov({
        heading: heading,
        pitch: 10
      });
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      <div className="space-y-2">
        <h4 className="text-sm font-bold text-slate-700">Ubicación en Mapa</h4>
        <div className="h-64 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={center}
            zoom={18}
            options={{
              disableDefaultUI: true,
              zoomControl: true,
            }}
          >
            <Marker position={center} />
          </GoogleMap>
        </div>
      </div>
      <div className="space-y-2">
        <h4 className="text-sm font-bold text-slate-700">Street View</h4>
        <div className="h-64 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={center}
            zoom={18}
          >
            <StreetViewPanorama
              onLoad={handleStreetViewLoad}
              options={{
                position: center,
                visible: true,
                disableDefaultUI: true,
                enableCloseButton: false,
                panControl: true,
                zoomControl: true,
              }}
            />
          </GoogleMap>
        </div>
      </div>
    </div>
  );
};
