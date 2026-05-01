import { useState } from 'react';
import { User } from 'lucide-react';

interface HeaderProfileAvatarProps {
  imageUrl?: string | null;
  onPress?: () => void;
  size?: number;
}

export function HeaderProfileAvatar({ imageUrl, onPress, size = 44 }: HeaderProfileAvatarProps) {
  const [imgError, setImgError] = useState(false);

  const showImage = !!imageUrl && !imgError;

  return (
    <button
      onClick={onPress}
      className="rounded-full overflow-hidden flex-shrink-0 active:scale-95 transition-transform"
      style={{ width: size, height: size, padding: 0, background: 'none', border: 'none' }}
    >
      {showImage ? (
        <img
          src={imageUrl!}
          alt="Profile"
          onError={() => setImgError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <span className="w-full h-full flex items-center justify-center bg-gray-100 hover:bg-gray-200 rounded-full transition-colors">
          <User style={{ width: size * 0.45, height: size * 0.45 }} className="text-gray-700" strokeWidth={1.5} />
        </span>
      )}
    </button>
  );
}
