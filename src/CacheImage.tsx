import React, { useState, useEffect } from "react";
import {
  Image,
  Platform,
  ImageBackground,
  ImageSourcePropType,
} from "react-native";
import { imageCache } from ".";

type ImagePropsType = Image["props"];

interface Props extends Omit<ImagePropsType, "source"> {
  uri: string;
  localFallbackImage?: ImageSourcePropType;
  isBackgroundImage?: boolean;
  children?: JSX.Element | JSX.Element[];
}

/**
 * Render and cache image
 * @param {string}  uri                                 image uri
 * @param {ImageSourcePropType}  localFallbackImage     path to local image path to render if the given uri cannot be loaded
 * @param {boolean}  isBackgroundImage                  using RN ImageBackgroud if it's true, default to false
 * @param {JSX.Element}  children                       any children to be rendered if isBackgroundImage is true
 */

export default function CacheImage(props: Props) {
  const [source, setSource] = useState<ImageSourcePropType>({ uri: "" });

  useEffect(() => {
    let isMounted = true;
    imageCache
      .fetchImage(props.uri)
      .then((mappingObj) => {
        if (isMounted) {
          setSource({
            uri:
              Platform.OS === "android"
                ? "file://" + mappingObj.imagePath
                : "" + mappingObj.imagePath,
          });
        }
      })
      .catch(() => {
        props.localFallbackImage && setSource(props.localFallbackImage);
      });
    return () => {
      isMounted = false;
    };
  }, [props.uri]);

  if (props.isBackgroundImage) {
    return (
      <ImageBackground key={props.uri} source={source} {...props}>
        {props.children}
      </ImageBackground>
    );
  }

  return <Image key={props.uri} source={source} {...props} />;
}
