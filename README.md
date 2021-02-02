This module is to provide methods to cache, preload, and download images for React Native projects.

### Installation

This package is using `FileSystem` of [Expo react-native-unimodules](https://github.com/unimodules/react-native-unimodules). Please follow the instructions at https://docs.expo.io/bare/installing-unimodules/ to add configurations for iOS and Android.

### Usage

#### CacheImage component
```
import { CacheImage } from 'react-native-cache-image';

export default function Example(props) {
    return (
        <View>
            <CacheImage uri='https://images.pexels.com/photos/6468238/pexels-photo-6468238.jpeg' fallbackUri={require('./assets/image_placeholder.jpg')} />
        </View>
    )
}
```

#### Preload images

```
import { preloadImages, fetchImage } from 'react-native-cache-image';
```

### License: MIT
