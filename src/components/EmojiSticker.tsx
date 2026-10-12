import { Image } from "expo-image";
import { ImageSourcePropType, View } from "react-native";

type EmojiStickerProps = {
  imageSize: number;
  stickerSource: ImageSourcePropType;
};

export default function EmojiSticker({ imageSize, stickerSource }: EmojiStickerProps) {
  return (
    <View style={{ top: -350 }}>
      <Image source={stickerSource} style={{ width: imageSize, height: imageSize }} />
    </View>
  );
}
