import Mapbox, {
  Camera,
  FillLayer,
  type FillLayerStyle,
  LineLayer,
  type LineLayerStyle,
  MapView,
  ShapeSource,
  StyleImport,
} from "@rnmapbox/maps";
import { type ComponentRef, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  SlideInDown,
  SlideOutDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

// Natural Earth countries, converted with mapshaper (step 3)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const countries = require("../../../assets/geo/countries.json") as GeoJSON.FeatureCollection;

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN ?? "");

const UNVISITED_COLOR = "#c9ccd1";
const SCRATCHED_COLOR = "#f2a93b";
const BORDER_COLOR = "#6b7280";
const SELECTED_BORDER_COLOR = "#7a7a7a";

const borderStyle: LineLayerStyle = {
  lineColor: BORDER_COLOR,
  lineWidth: ["interpolate", ["linear"], ["zoom"], 1, 0.6, 4, 1, 8, 2],
  lineOpacity: 0.9,
};

type SelectedCountry = { iso: string; name: string };
type Bounds = { ne: [number, number]; sw: [number, number] };

// Smallest box around a country's shape (north-east and south-west corner)
function getBounds(geometry: GeoJSON.Geometry): Bounds {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
  const points = polygons.flat(2);

  const boundsOf = (shiftWesternParts: boolean): Bounds => {
    let minLng = Infinity;
    let minLat = Infinity;
    let maxLng = -Infinity;
    let maxLat = -Infinity;
    for (const [rawLng, lat] of points) {
      const lng = shiftWesternParts && rawLng < 0 ? rawLng + 360 : rawLng;
      minLng = Math.min(minLng, lng);
      maxLng = Math.max(maxLng, lng);
      minLat = Math.min(minLat, lat);
      maxLat = Math.max(maxLat, lat);
    }
    return { ne: [maxLng, maxLat], sw: [minLng, minLat] };
  };

  const bounds = boundsOf(false);
  // Countries crossing the date line (Russia, Fiji, USA with Alaska) would span the whole world:
  // measure them again with their western parts shifted by +360°
  return bounds.ne[0] - bounds.sw[0] > 180 ? boundsOf(true) : bounds;
}

// Bounds per ISO code, calculated once when the file is loaded
const countryBounds = new Map<string, Bounds>(
  countries.features.map((feature) => [feature.properties?.iso as string, getBounds(feature.geometry)]),
);

export default function MapScreen() {
  const [scratchedIsoCodes, setScratchedIsoCodes] = useState<string[]>([]);
  const [selectedCountry, setSelectedCountry] = useState<SelectedCountry | null>(null);
  const cameraRef = useRef<ComponentRef<typeof Camera>>(null);

  // Drawer: follows the finger when dragged down, closes when dragged far or fast enough
  const drawerOffset = useSharedValue(0);
  const drawerAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ translateY: drawerOffset.get() }] }));
  const closeDrawer = () => setSelectedCountry(null);
  const swipeDownToClose = Gesture.Pan()
    .runOnJS(true)
    .onUpdate((event) => {
      drawerOffset.set(Math.max(0, event.translationY));
    })
    .onEnd((event) => {
      if (event.translationY > 80 || event.velocityY > 800) {
        closeDrawer();
      } else {
        drawerOffset.set(withSpring(0));
      }
    });

  // Colour every country by whether its ISO code is in the scratched list.
  const fillStyle = useMemo<FillLayerStyle>(
    () => ({
      fillColor: ["case", ["in", ["get", "iso"], ["literal", scratchedIsoCodes]], SCRATCHED_COLOR, UNVISITED_COLOR],
      fillOpacity: 0.75,
    }),
    [scratchedIsoCodes],
  );

  const handleCountryPress = (event: { features: GeoJSON.Feature[] }) => {
    const country = event.features[0];
    const iso = country?.properties?.iso as string | undefined;
    if (!iso) return;
    const name = (country.properties?.name as string | undefined) ?? iso;

    // Every tap opens the drawer; scratching/removing happens via its buttons
    drawerOffset.set(0);
    setSelectedCountry({ iso, name });

    // Zoom so the whole country is visible; extra space at the bottom for the panel
    const bounds = countryBounds.get(iso);
    if (bounds) {
      cameraRef.current?.fitBounds(bounds.ne, bounds.sw, [60, 40, 200, 40], 800);
    }
  };

  const removeSelectedCountry = () => {
    if (!selectedCountry) return;
    setScratchedIsoCodes((current) => current.filter((code) => code !== selectedCountry.iso));
    setSelectedCountry(null);
  };

  const scratchSelectedCountry = () => {
    if (!selectedCountry) return;
    setScratchedIsoCodes((current) => [...current, selectedCountry.iso]);
    setSelectedCountry(null);
  };

  const isSelectedScratched = selectedCountry !== null && scratchedIsoCodes.includes(selectedCountry.iso);

  return (
    <View style={styles.container}>
      <MapView
        style={styles.map}
        styleURL="mapbox://styles/mapbox/standard"
        projection="mercator"
        scaleBarEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        <StyleImport
          id="basemap"
          existing
          config={{
            theme: "faded",
            lightPreset: "day",
            show3dObjects: false,
            showPointOfInterestLabels: false,
            showTransitLabels: false,
          }}
        />
        <Camera ref={cameraRef} defaultSettings={{ zoomLevel: 1.5, centerCoordinate: [13.4, 52.5] }} />

        <ShapeSource id="countries" shape={countries} onPress={handleCountryPress} hitbox={{ width: 1, height: 1 }}>
          <FillLayer id="countries-fill" slot="middle" style={fillStyle} />
          <LineLayer id="countries-border" slot="middle" style={borderStyle} />
          <LineLayer
            id="countries-selected"
            slot="middle"
            filter={["==", ["get", "iso"], selectedCountry?.iso ?? ""]}
            style={{ lineColor: SELECTED_BORDER_COLOR, lineWidth: 2.5 }}
          />
        </ShapeSource>
      </MapView>

      {selectedCountry ? (
        <GestureDetector gesture={swipeDownToClose}>
          <Animated.View
            entering={SlideInDown.duration(250)}
            exiting={SlideOutDown.duration(200)}
            style={[styles.drawer, drawerAnimatedStyle]}
          >
            <View style={styles.drawerHandle} />
            <Text style={styles.panelTitle}>{selectedCountry.name}</Text>
            <Text style={styles.panelSubtitle}>{isSelectedScratched ? "Scratched" : "Not visited yet"}</Text>
            <View style={styles.panelButtons}>
              <Pressable style={[styles.button, styles.buttonSecondary]} onPress={closeDrawer}>
                <Text style={styles.buttonText}>Close</Text>
              </Pressable>
              {isSelectedScratched ? (
                <Pressable style={[styles.button, styles.buttonDanger]} onPress={removeSelectedCountry}>
                  <Text style={styles.buttonText}>Remove</Text>
                </Pressable>
              ) : (
                <Pressable style={[styles.button, styles.buttonScratch]} onPress={scratchSelectedCountry}>
                  <Text style={[styles.buttonText, styles.buttonScratchText]}>Scratch</Text>
                </Pressable>
              )}
            </View>
          </Animated.View>
        </GestureDetector>
      ) : (
        <View style={styles.info} pointerEvents="none">
          <Text style={styles.infoText}>Scratched: {scratchedIsoCodes.length}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { flex: 1 },
  info: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    padding: 10,
    borderRadius: 8,
    backgroundColor: "rgba(94, 56, 0, 0.77)",
  },
  infoText: { color: "#fff", textAlign: "center" },
  drawer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: "#fff",
    elevation: 12,
  },
  drawerHandle: {
    alignSelf: "center",
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#d1d5db",
    marginBottom: 12,
  },
  panelTitle: { fontSize: 18, fontWeight: "600", color: "#25292e" },
  panelSubtitle: { marginTop: 2, color: "#666" },
  panelButtons: { flexDirection: "row", gap: 8, marginTop: 12 },
  button: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: "center" },
  buttonSecondary: { backgroundColor: "#888" },
  buttonDanger: { backgroundColor: "#c0392b" },
  buttonText: { color: "#fff", fontWeight: "600" },
  buttonScratch: { backgroundColor: SCRATCHED_COLOR },
  buttonScratchText: { color: "#25292e" },
});
