import { useCallback, useState } from "react";
import { View } from "react-native";

import { formatCoord, parseLatLngPair } from "./admin";
import { FieldCell, FieldRow, Note } from "./adminUi";
import { currentPosition } from "./device";
import { PinMap } from "./PinMap";
import { spacing } from "./theme";
import { Button, ErrorText, Input } from "./ui";

type Props = {
  latitude: string;
  longitude: string;
  onChange: (lat: string, lng: string) => void;
  errors?: { latitude?: string; longitude?: string };
};

/**
 * Pin on a map + "Use my GPS location" + the two number fields. Take the pin at the site when you can:
 * coordinates copied from other maps (Google, OpenStreetMap) bring their licence terms with them.
 */
export function LocationPicker({ latitude, longitude, onChange, errors }: Props) {
  const [locating, setLocating] = useState(false);
  const [gpsError, setGpsError] = useState("");
  const [mapKey, setMapKey] = useState("initial"); // changes when the pin moves from outside the map

  const lat = latitude.trim() ? Number(latitude) : null;
  const lng = longitude.trim() ? Number(longitude) : null;

  const fromMap = useCallback((la: number, ln: number) => onChange(formatCoord(la), formatCoord(ln)), [onChange]);

  const useGps = async () => {
    setGpsError("");
    setLocating(true);
    try {
      const pos = await currentPosition();
      onChange(formatCoord(pos.lat), formatCoord(pos.lng));
      setMapKey(`gps-${Date.now()}`);
    } catch (e: any) {
      setGpsError(e.message);
    } finally {
      setLocating(false);
    }
  };

  return (
    <View>
      <Note icon="map-marker-check-outline">
        Stand at the mandir gate and use GPS, or tap the map. Don’t copy coordinates from other map apps.
      </Note>
      <PinMap lat={Number.isFinite(lat) ? lat : null} lng={Number.isFinite(lng) ? lng : null} onMove={fromMap} resetKey={mapKey} />
      <View style={{ height: spacing.md }} />
      <Button testID="location-gps" title="Use my GPS location" icon="crosshairs-gps" variant="tonal" onPress={useGps} loading={locating} />
      <View style={{ height: spacing.md }} />
      <ErrorText testID="location-gps-error">{gpsError}</ErrorText>
      <FieldRow>
        <FieldCell min={160}>
          <Input
            testID="location-lat"
            label="Latitude"
            keyboardType="numbers-and-punctuation"
            value={latitude}
            error={errors?.latitude}
            onChangeText={(t) => {
              const pair = parseLatLngPair(t); // pasted "lat, lng" fills both fields
              if (pair) onChange(formatCoord(pair.lat), formatCoord(pair.lng));
              else onChange(t, longitude);
            }}
            onBlur={() => setMapKey(`typed-${latitude},${longitude}`)}
          />
        </FieldCell>
        <FieldCell min={160}>
          <Input
            testID="location-lng"
            label="Longitude"
            keyboardType="numbers-and-punctuation"
            value={longitude}
            error={errors?.longitude}
            onChangeText={(t) => onChange(latitude, t)}
            onBlur={() => setMapKey(`typed-${latitude},${longitude}`)}
          />
        </FieldCell>
      </FieldRow>
    </View>
  );
}
