import { Image } from "expo-image";
import { ImageSourcePropType, View } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from "react-native-reanimated";

type EmojiStickerProps = {
  imageSize: number;
  stickerSource: ImageSourcePropType;
};

export default function EmojiSticker({ imageSize, stickerSource }: EmojiStickerProps) {
  const scaleImage = useSharedValue(imageSize);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .onStart(() => {
      if (scaleImage.value !== imageSize * 2) {
        scaleImage.value = scaleImage.value * 2;
      } else {
        scaleImage.value = Math.round(scaleImage.value / 2);
      }
    });

  const animatedStyle = useAnimatedStyle(() => {
    return {
      width: withSpring(scaleImage.value, { damping: 25, stiffness: 600 }),
      height: withSpring(scaleImage.value, { damping: 25, stiffness: 600 }),
    };
  });

  const drag = Gesture.Pan().onChange((e) => {
    translateX.value += e.changeX;
    translateY.value += e.changeY;
  });

  const containerStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: translateX.value }, { translateY: translateY.value }],
    };
  });

  return (
    <GestureDetector gesture={drag}>
      <Animated.View style={[{ top: -350 }, containerStyle]}>
        <GestureDetector gesture={doubleTap}>
          <Animated.Image source={stickerSource} resizeMode="contain" style={animatedStyle} />
        </GestureDetector>
      </Animated.View>
    </GestureDetector>
  );
}
