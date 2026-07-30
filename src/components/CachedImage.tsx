import { getCachedImage, cacheImage } from '../utils/imageCache';

/*
  Drop-in <img> that renders the persisted (downscaled) copy of a remote image when available, so
  it appears instantly on a refresh / cold start. On the first live load it caches a small copy in
  the background for next time. All other <img> props (className, onClick, onError, alt, style…) are
  forwarded unchanged, so callers keep their own fallback/error handling.
*/

type Props = Omit<React.ImgHTMLAttributes<HTMLImageElement>, 'src'> & {
  url: string;
  /** Longest edge to downscale the cached copy to (avatars ~96, covers ~640). */
  maxDim?: number;
};

export function CachedImage({ url, maxDim = 640, onLoad, ...imgProps }: Props) {
  const cached = getCachedImage(url);
  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (!cached) cacheImage(url, { maxDim }); // fire-and-forget; instant next time
    onLoad?.(e);
  };
  return <img src={cached ?? url} onLoad={handleLoad} {...imgProps} />;
}
