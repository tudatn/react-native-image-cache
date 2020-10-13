This module is to provide methods to cache, preload, and download images for React Native projects.

### Installation

Install required dependencies:

`npm install RNFetchBlob @react-native-community/async-storage vavalid-url object-hash`

#### Available methods

`function preloadImages(uris, listener = (value) => {})`

`function fetchImage(uri, callback = (value) => {})`
