import React from 'react';
import { Autocomplete, useJsApiLoader } from '@react-google-maps/api';
import { Form } from 'react-bootstrap';

const libraries = ['places'];

function LocationAutocomplete({ value, onChange, required = true }) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  const [autocomplete, setAutocomplete] = React.useState(null);

  const onLoad = (autocompleteInstance) => {
    setAutocomplete(autocompleteInstance);
  };

  const onPlaceChanged = () => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      if (place.formatted_address) {
        onChange(place.formatted_address);
      } else if (place.name) {
        onChange(place.name);
      }
    }
  };

  // If Google Maps API key is not configured or loading failed, show regular input
  if (loadError || !process.env.REACT_APP_GOOGLE_MAPS_API_KEY) {
    return (
      <Form.Control
        type="text"
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g., BCB Community Center, Frisco, CO"
      />
    );
  }

  if (!isLoaded) {
    return (
      <Form.Control
        type="text"
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Loading Google Maps..."
        disabled
      />
    );
  }

  return (
    <Autocomplete
      onLoad={onLoad}
      onPlaceChanged={onPlaceChanged}
      options={{
        types: ['establishment', 'geocode'],
        componentRestrictions: { country: 'us' },
      }}
    >
      <Form.Control
        type="text"
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="e.g., BCB Community Center, Frisco, CO"
      />
    </Autocomplete>
  );
}

export default LocationAutocomplete;
