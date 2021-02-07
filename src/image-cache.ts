import { FileSystem } from "react-native-unimodules";
import validUrl from "valid-url";
import hash from "object-hash";

const validImageExtensions = [".jpg", ".png", ".jpeg", ".gif"];

export interface MappingObj {
  uri: string;
  imagePath: string;
}

/**
 * Preload as many prefetchable images as possible from an array of uris.
 *
 * The callback listener if provided will be called on each succesffuly fetched image
 *
 * @param {string[]} uris
 * @returns {Promise} Promise with {info: {tried, downloaded}} object on resolve or error on reject
 */
export function preloadImages(uris: string[], listener?: (value: any) => void) {
  return new Promise(async (resolve, reject) => {
    if (!Array.isArray(uris)) reject("uris is not an array");
    try {
      const responses = await downloadImages(uris, listener);
      let numberOfDownloadedImages = 0;
      responses.forEach((r) => {
        if (r !== undefined) {
          numberOfDownloadedImages++;
        }
      });
      // convenient info to indicate how many images are downloaded sucessfully
      const info = {
        tried: uris.length,
        downloaded: numberOfDownloadedImages,
      };
      resolve({ info });
    } catch (error) {
      return reject(error);
    }
  });
}

/**
 * Fetch image from uri
 *
 * The callback if provided will be called on resolve
 *
 * @param {string} uri
 * @returns {Promise} return a promise with {uri, imagePath} object on resolve and error on reject
 */
export function fetchImage(uri: string, callback?: (value: any) => void) {
  const fileInfo = getImageInfo(uri);
  return new Promise<MappingObj>(async (resolve, reject) => {
    try {
      if (!fileInfo) {
        throw new Error(`wrong file format: ${uri}`);
      }
      // try to get image path
      const imagePath = await getImagePath(fileInfo);
      if (imagePath) {
        callback && callback({ uri, imagePath });
        resolve({ uri, imagePath });
      } else {
        const fileUri = generateAbsolutePath(fileInfo);
        try {
          const res = await FileSystem.downloadAsync(uri, fileUri);
          if (res.status === 200) {
            const uriMapObject = {
              uri: uri,
              imagePath: res.uri,
            };
            // resolve the image path
            callback && callback(uriMapObject);
            resolve(uriMapObject);
          } else {
            throwErrorOnInCompletedImageFetch(uri, fileUri);
          }
        } catch (error) {
          throwErrorOnInCompletedImageFetch(uri, fileUri);
        }
      }
    } catch (e) {
      reject(e);
    }
  });
}

function generateAbsolutePath(fileInfo: string) {
  return FileSystem.cacheDirectory + fileInfo;
}

/**
 * Return the image location in the cache for the provided fileInfo,
 * if the image is not cached yet, return undefine
 *
 * @param {string} fileInfo
 */
async function getImagePath(fileInfo: string) {
  try {
    const imagePath = generateAbsolutePath(fileInfo);
    const isDownloaded = await FileSystem.getInfoAsync(imagePath);
    if (isDownloaded.exists) {
      return imagePath;
    }
    return isDownloaded.exists ? imagePath : undefined;
  } catch {
    return;
  }
}

/**
 * Try to download as many valid images as possible from an array of uris.
 * Function caller is expected to handle verify download completion.
 *
 * @param {string[]} uris array of image uris
 * @returns {Promise} A promise with array of [{uri, imagePath} | undefined]
 */
function downloadImages(uris: string[], callback?: (value: any) => void) {
  const loadImage = async (uri: string) => {
    return preloadImage(uri, callback).catch(() => {});
  };
  // TODO: replace by Promise.allSettled()
  return Promise.all(uris.map(loadImage));
}

/**
 * Get image info (hashed name and extension) for the provided uri
 *
 * @param {string} uri Uri of the file
 * @returns hashed_file_name.fileExtension | undefined
 */
function getImageInfo(uri: string) {
  if (validUrl.isUri(uri)) {
    const path = uri.substring(uri.lastIndexOf("/"));
    const pathName =
      path.indexOf("?") === -1 ? path : path.substring(0, path.indexOf("?"));
    if (pathName.lastIndexOf(".") >= 0) {
      // check if it has valid image extensions
      const fileExtension = pathName.substring(pathName.lastIndexOf("."));
      if (validImageExtensions.includes(fileExtension)) {
        return hash(uri) + "." + fileExtension.substring(1);
      }
    }
  }
  return;
}

/**
 * Preload image from uri
 * @param {*} uri
 * @param {*} callback
 * @returns {Promise} return a promise with {uri, imagePath} object on resolve and error on reject
 */
function preloadImage(uri: string, callback?: (value: any) => void) {
  const fileInfo = getImageInfo(uri);
  return new Promise(async (resolve, reject) => {
    try {
      if (!fileInfo) {
        throw new Error(`wrong file format: ${uri}`);
      }
      const imagePath = await getImagePath(fileInfo);
      if (imagePath) {
        callback && callback({ uri, imagePath });
        resolve({ uri, imagePath });
      } else {
        const fileUri = generateAbsolutePath(fileInfo);
        try {
          const res = await FileSystem.downloadAsync(uri, fileUri);
          if (res.status === 200) {
            const uriMapObject = {
              uri: uri,
              imagePath: res.uri,
            };
            callback && callback({ uriMapObject });
            resolve({ uri, fileInfo });
          } else {
            throwErrorOnInCompletedImageFetch(uri, fileUri);
          }
        } catch (error) {
          throwErrorOnInCompletedImageFetch(uri, fileUri);
        }
      }
    } catch (e) {
      reject(e);
    }
  });
}

function throwErrorOnInCompletedImageFetch(uri: string, fileUri: string) {
  FileSystem.deleteAsync(fileUri, { idempotent: true });
  throw new Error(`cannot preload image: ${uri}`);
}
