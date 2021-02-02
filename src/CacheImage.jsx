import React, { useState, useEffect } from "react";
import { Image, Platform, ImageBackground } from "react-native";
import { imageCache } from "./image-cache";

/**
 * Render and cache image
 * @param {string}  uri                     image uri
 * @param {string}  fallbackUri             recommend using a local image uri to render if the given uri cannot be rendered
 * @param {boolean}  isBackgroundImage      using RN ImageBackgroud if it's true, default to false
 * @param {JSX.Element}  children           any children to be rendered if isBackgroundImage is true
 */

export default function CacheImage(props) {
  const [imagePath, setImagePath] = useState();

  useEffect(() => {
    let isMounted = true;
    imageCache
      .fetchImage(props.uri)
      .then((mappingObj) => {
        if (isMounted) setImagePath(mappingObj.imagePath);
      })
      .catch((e) => {
        setImagePath(props.fallbackUri);
      });
    return () => {
      isMounted = false;
    };
  }, [props.uri]);

  const source =
    imagePath === props.fallbackUri
      ? imagePath
      : {
          uri:
            Platform.OS === "android" ? "file://" + imagePath : "" + imagePath,
        };

  if (props.isBackgroundImage) {
    return (
      <ImageBackground
        key={imagePath}
        source={imagePath ? source : props.fallbackUri}
        {...props}
      >
        {props.children}
      </ImageBackground>
    );
  }

  return (
    <Image
      key={imagePath}
      source={imagePath ? source : props.fallbackUri}
      {...props}
    />
  );
}
