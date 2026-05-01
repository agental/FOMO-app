import { useState, useRef } from 'react';
import { Camera, Upload, X, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface ImageUploadProps {
  currentImageUrl?: string | null;
  onImageChange: (url: string | null) => void;
  userId: string;
}

export function ImageUpload({ currentImageUrl, onImageChange, userId }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('נא להעלות קובץ תמונה בלבד');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('התמונה גדולה מדי. גודל מקסימלי: 5MB');
      return;
    }

    setError(null);
    setIsUploading(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      console.log('Uploading image:', { fileName, filePath });

      const { error: uploadError } = await supabase.storage
        .from('images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        throw uploadError;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('images')
        .getPublicUrl(filePath);

      console.log('Image uploaded successfully:', publicUrl);

      onImageChange(publicUrl);

      const { error: updateError } = await supabase
        .from('users')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (updateError) {
        console.error('Error updating user avatar:', updateError);
        throw updateError;
      }

      console.log('Avatar URL updated in database');

    } catch (err: any) {
      console.error('Upload error:', err);
      setError(err.message || 'שגיאה בהעלאת התמונה');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    onImageChange(null);

    try {
      await supabase
        .from('users')
        .update({ avatar_url: null })
        .eq('id', userId);
    } catch (err) {
      console.error('Error removing image:', err);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative group">
        {currentImageUrl ? (
          <div className="relative">
            <img
              src={currentImageUrl}
              alt="Profile"
              className="w-32 h-32 rounded-full object-cover border-4 border-white shadow-lg"
            />
            <button
              type="button"
              onClick={handleRemoveImage}
              className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-all opacity-0 group-hover:opacity-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center border-4 border-white shadow-lg">
            <Camera className="w-12 h-12 text-gray-500" />
          </div>
        )}

        {isUploading && (
          <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={isUploading}
        className="px-6 py-2.5 bg-blue-600 text-white rounded-full text-sm font-medium shadow-md hover:shadow-lg hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        style={{ fontFamily: 'Rubik, sans-serif' }}
      >
        <Upload className="w-4 h-4" />
        {currentImageUrl ? 'שנה תמונה' : 'העלה תמונה'}
      </button>

      {error && (
        <p className="text-red-600 text-sm text-center" style={{ fontFamily: 'Rubik, sans-serif' }}>
          {error}
        </p>
      )}

      <p className="text-gray-500 text-xs text-center" style={{ fontFamily: 'Rubik, sans-serif' }}>
        תמונה ברורה ומחייכת תעזור למטיילים אחרים להכיר אותך
      </p>
    </div>
  );
}
