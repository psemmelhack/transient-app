import { ActionSheetIOS, Alert, Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as LegacyFileSystem from 'expo-file-system/legacy';
import { POSTER_DECODE_EDGE, resizeForCard } from '../composition/posterPhoto';

export type PickedPhoto = { status: 'ready'; base64: string } | { status: 'cancelled' | 'denied' | 'failed' };

type Source = 'camera' | 'library' | 'cancel';

/**
 * The page is loaded from a file URL. A file input there does not offer the camera in Expo Go,
 * on iOS or Android. This is the same choice the browser sheet would have shown: camera or library.
 * Expo Go already carries the camera and photo-library usage strings, so the prompts can appear.
 */
export async function pickPosterPhoto(): Promise<PickedPhoto> {
  const source = await chooseSource();
  if (source === 'cancel') return { status: 'cancelled' };
  try {
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (permission.status !== 'granted') return { status: 'denied' };
    } else {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (permission.status !== 'granted') return { status: 'denied' };
    }
    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 1, base64: false, exif: false })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1, base64: false, exif: false });
    if (result.canceled || !result.assets[0]) return { status: 'cancelled' };
    return await downscale(result.assets[0].uri, result.assets[0].width, result.assets[0].height);
  } catch {
    return { status: 'failed' };
  }
}

function chooseSource(): Promise<Source> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (value: Source) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        { options: ['Take Photo', 'Photo Library', 'Cancel'], cancelButtonIndex: 2 },
        (index) => finish(index === 0 ? 'camera' : index === 1 ? 'library' : 'cancel'),
      );
      return;
    }
    Alert.alert(
      'Photo',
      undefined,
      [
        { text: 'Take Photo', onPress: () => finish('camera') },
        { text: 'Photo Library', onPress: () => finish('library') },
        { text: 'Cancel', style: 'cancel', onPress: () => finish('cancel') },
      ],
      { cancelable: true, onDismiss: () => finish('cancel') },
    );
  });
}

async function downscale(uri: string, width: number, height: number): Promise<PickedPhoto> {
  const known = width > 0 && height > 0;
  const fitted = known ? resizeForCard(width, height) : { width: POSTER_DECODE_EDGE, height: POSTER_DECODE_EDGE };
  const context = ImageManipulator.manipulate(uri, { maxWidth: fitted.width, maxHeight: fitted.height });
  const rendered = await context.renderAsync();
  const saved = await rendered.saveAsync({ compress: 0.82, format: SaveFormat.JPEG, base64: true });
  if (saved.uri) await LegacyFileSystem.deleteAsync(saved.uri, { idempotent: true }).catch(() => undefined);
  if (!saved.base64) return { status: 'failed' };
  return { status: 'ready', base64: saved.base64 };
}
