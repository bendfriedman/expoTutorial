import Mapbox, { Camera, MapView } from "@rnmapbox/maps";
import { StyleSheet, View } from "react-native";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "");

export default function MapScreen() {
  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        styleURL={Mapbox.StyleURL.Light}
        projection="mercator"
        scaleBarEnabled={false}
      >
        <Camera zoomLevel={1.5} centerCoordinate={[13.4, 52.5]} />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
});
