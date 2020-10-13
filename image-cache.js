import RNFetchBlob from 'rn-fetch-blob';
import AsyncStorage from '@react-native-community/async-storage';
import validUrl from 'valid-url';
import hash from 'object-hash';

const validImageExtensions = ['.jpg', '.png', '.jpeg', '.gif'];
const dirs = RNFetchBlob.fs.dirs;
const CACHE_STORAGE = 'cache_image';

/**
 * Preload as many prefetchable images as possible from an array of uris.
 * A mapping [uri: path_to_image] will be saved to Async Storage
 *
 * The callback listener if provided will be called on each succesffuly fetched image
 *
 * @param {string[]} uris
 * @returns {Promise} Promise with {info: {tried, downloaded}, cacheMapping} object on resolve or error on reject
 */
export function preloadImages(uris, listener = (value) => {}) {
    return new Promise(async (resolve, reject) => {
        if (!Array.isArray(uris)) reject('uris is not an array');
        try {
            const responses = await downloadImages(uris, listener);
            // construct the cacheMapping
            let cacheMapping = await getCurrentCacheMappingFromAsyncStorage();
            const current = Date.now();
            let numberOfDownloadedImages = 0;
            responses.forEach((r) => {
                if (r !== undefined) {
                    cacheMapping[r.uri] = {
                        created: current,
                        fileInfo: r.fileInfo,
                    };
                    numberOfDownloadedImages++;
                }
            });
            // convenient info to indicate how many images are downloaded sucessfully
            const info = {
                tried: uris.length,
                downloaded: numberOfDownloadedImages,
            };

            try {
                AsyncStorage.setItem(
                    CACHE_STORAGE,
                    JSON.stringify(cacheMapping),
                );
            } catch (error) {
                console.log(error);
            }
            resolve({ info, cacheMapping });
        } catch (error) {
            return reject(error);
        }
    });
}

/**
 * Fetch image from uri and update the cache mapping to async storage on success.
 *
 * The callback if provided will be called on resolve
 *
 * @param {string} uri
 * @returns {Promise} return a promise with {uri, imagePath} object on resolve and error on reject
 */
export function fetchImage(uri, callback = (value) => {}) {
    const fileInfo = getImageInfo(uri);
    return new Promise(async (resolve, reject) => {
        try {
            if (!fileInfo) {
                throw new Error(`wrong file format: ${uri}`);
            }
            // try to get image path
            const imagePath = await getImagePath(fileInfo);
            if (imagePath) {
                callback({ uri, imagePath });
                resolve({ uri, imagePath });
            } else {
                const res = await RNFetchBlob.config({
                    fileCache: true,
                    path: generateAbsolutePath(fileInfo),
                }).fetch('GET', uri);

                if (res.info().status === 200) {
                    const uriMapObject = {
                        uri: uri,
                        imagePath: res.path(),
                    };
                    // resolve the image path
                    callback(uriMapObject);
                    resolve(uriMapObject);

                    // save to cache
                    updateCacheMapping({ uri, fileInfo }).catch((e) =>
                        console.log(e),
                    );
                } else {
                    throwErrorOnInCompletedImageFetch(uri, res);
                }
            }
        } catch (e) {
            if (fileInfo) {
                RNFetchBlob.fs
                    .unlink(generateAbsolutePath(fileInfo))
                    .catch(() => {
                        console.log('cannot unlink');
                    });
            }
            console.log(e);
            reject(e);
        }
    });
}

/**
 * This is convenient method to clear expired items in the cache
 * you should only call this method at App level cause it may hit many I/O operations
 * @param {number} expiredPeriod epxired period by days (default = 30 days)
 *
 */
export function clearExpiredImage(expiredPeriod = 30) {
    return new Promise(async (resolve, reject) => {
        try {
            const value = await AsyncStorage.getItem(CACHE_STORAGE);
            if (value !== null) {
                const now = Date.now();
                const cacheMapping = JSON.parse(value);
                // go through all cache items to check the expired date
                const deleteExpiredImage = (item) => {
                    if (calculateDayGap(now, item.created) > expiredPeriod) {
                        return RNFetchBlob.fs.unlink(
                            generateAbsolutePath(item.fileInfo),
                        );
                    }
                };
                return Promise.all(
                    Object.values(cacheMapping).map(deleteExpiredImage),
                ).then(() => {
                    Object.keys(cacheMapping).forEach((uri) => {
                        if (calculateDayGap(now, cacheMapping[uri].created)) {
                            delete cacheMapping[uri];
                        }
                    });
                    // update cacheMapping back to async storage
                    return AsyncStorage.setItem(
                        CACHE_STORAGE,
                        JSON.stringify(cacheMapping),
                    )
                        .then(() =>
                            resolve('removed expired images from cache'),
                        )
                        .catch((e) => {
                            reject(e);
                        });
                });
            }
        } catch (e) {
            reject(e);
        }
    });
}

/**
 * Construct a cache mapping from uris to their absolute path to Cache folder
 * @returns {object} returns {uri: absolutePath}
 */
export async function constructCacheMappingFromAsyncStorage() {
    try {
        let absoluteCacheMapping = {};
        const value = await AsyncStorage.getItem(CACHE_STORAGE);
        if (value !== null) {
            const cacheMapping = JSON.parse(value);
            Object.keys(cacheMapping).forEach((uri) => {
                const mappingObject = cacheMapping[uri];
                absoluteCacheMapping[uri] = generateAbsolutePath(
                    mappingObject.fileInfo,
                );
            });
        }
        return absoluteCacheMapping;
    } catch (error) {
        console.log(error);
        return {};
    }
}

/**
 * Calculate day gap between two timestamps generated by Date.now()
 *
 * @param {number, number} expiredPeriod
 */
function calculateDayGap(date1, date2) {
    return (date1 - date2) / (24 * 60 * 60 * 1000);
}

function generateAbsolutePath(fileInfo) {
    return dirs.CacheDir + '/' + fileInfo;
}

/**
 * Return the image location in the cache for the provided fileInfo,
 * if the image is not cached yet, return undefine
 *
 * @param {string} fileInfo
 */
async function getImagePath(fileInfo) {
    try {
        const imagePath = generateAbsolutePath(fileInfo);
        const isDownloaded = await RNFetchBlob.fs.exists(imagePath);
        if (isDownloaded) {
            return imagePath;
        }
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
function downloadImages(uris, callback) {
    const loadImage = async (uri) => {
        return preloadImage(uri, callback).catch((e) => {
            // for debug
            console.log(e);
        });
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
function getImageInfo(uri) {
    if (validUrl.isUri(uri)) {
        const path = uri.substring(uri.lastIndexOf('/'));
        const pathName =
            path.indexOf('?') === -1
                ? path
                : path.substring(0, path.indexOf('?'));
        if (pathName.lastIndexOf('.') >= 0) {
            // check if it has valid image extensions
            const fileExtension = pathName.substring(pathName.lastIndexOf('.'));
            if (validImageExtensions.includes(fileExtension)) {
                return hash(uri) + '.' + fileExtension.substring(1);
            }
        }
    }
}

/**
 * Preload image from uri
 * @param {*} uri
 * @param {*} callback
 * @returns {Promise} return a promise with {uri, imagePath} object on resolve and error on reject
 */
function preloadImage(uri, callback = (value) => {}) {
    const fileInfo = getImageInfo(uri);
    return new Promise(async (resolve, reject) => {
        try {
            if (!fileInfo) {
                throw new Error(`wrong file format: ${uri}`);
            }
            const imagePath = await getImagePath(fileInfo);
            if (imagePath) {
                callback({ uri, imagePath });
                resolve({ uri, imagePath });
            } else {
                const res = await RNFetchBlob.config({
                    fileCache: true,
                    path: generateAbsolutePath(fileInfo),
                }).fetch('GET', uri);

                if (res.info().status === 200) {
                    const uriMapObject = {
                        uri: uri,
                        imagePath: res.path(),
                    };
                    callback({ uriMapObject });
                    resolve({ uri, fileInfo });
                } else {
                    throwErrorOnInCompletedImageFetch(uri, res);
                }
            }
        } catch (e) {
            if (fileInfo) {
                RNFetchBlob.fs
                    .unlink(generateAbsolutePath(fileInfo))
                    .catch(() => {
                        console.log('cannot unlink');
                    });
            }
            console.log(e);
            reject(e);
        }
    });
}

async function updateCacheMapping({ uri, fileInfo }) {
    return new Promise(async (resolve, reject) => {
        try {
            let cacheMapping = await getCurrentCacheMappingFromAsyncStorage();
            if (cacheMapping[uri]) {
                resolve(cacheMapping);
            } else {
                cacheMapping[uri] = {
                    fileInfo: fileInfo,
                    created: Date.now(),
                };
                const mappingStringObject = JSON.stringify(cacheMapping);
                try {
                    await AsyncStorage.setItem(
                        CACHE_STORAGE,
                        mappingStringObject,
                    );
                    resolve(cacheMapping);
                } catch (error) {
                    reject(error);
                }
            }
        } catch (e) {
            reject(e);
        }
    });
}

async function getCurrentCacheMappingFromAsyncStorage() {
    let cacheMapping = {};
    const value = await AsyncStorage.getItem(CACHE_STORAGE);
    if (value !== null) {
        try {
            cacheMapping = JSON.parse(value);
        } catch (error) {
            console.log('Cannot parse cacheMapping, the cache is reset', error);
        }
    }
    return cacheMapping;
}

function throwErrorOnInCompletedImageFetch(uri, res) {
    res.flush();
    throw new Error(`cannot preload image: ${uri}`);
}
