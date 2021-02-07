This module is to provide methods to cache, preload, and download images for React Native projects.

### Installation

This package is using `FileSystem` of [Expo react-native-unimodules](https://github.com/unimodules/react-native-unimodules). Please follow the instructions at https://docs.expo.io/bare/installing-unimodules/ to add configurations for iOS and Android.

### Usage

#### CacheImage component
```typescript
import { CacheImage } from 'react-native-caches-image';

export default function Example(props) {
    return (
        <View>
            <CacheImage 
                uri='https://images.pexels.com/photos/6468238/pexels-photo-6468238.jpeg' 
                localFallbackImage={require('./assets/image_placeholder.jpg')} />
        </View>
    )
}
```

#### Preload images

```typescript
import { imageCache } from 'react-native-images-cache';

imageCache
    .preloadImages(preloadingImages, updateProgress)
    .then((result) => {
        const downloadPercentage =
            result.downloaded / result.tried;
        } else setDataProgress(1);
    })
    .catch((error) => {
        console.log(error);
    });

function updateProgress(mappingObject) {
    // calculate progress for each fetched image
}
```

### License:

The source code is made available under the MIT license. Some of the dependencies are licensed differently, with the BSD license, for example.
