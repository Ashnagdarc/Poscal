import { useState, useRef } from 'react';
import { Camera, X, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { uploadsApi } from '@/lib/api';

interface TradeScreenshotProps {
  tradeId: string;
  userId: string;
  existingUrls: string[];
  onUpdate: (urls: string[]) => void;
}

export const TradeScreenshot = ({ tradeId, userId, existingUrls, onUpdate }: TradeScreenshotProps) => {
  const [uploading, setUploading] = useState(false);
  const [urls, setUrls] = useState<string[]>(existingUrls);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setUploading(true);
    
    try {
      const response = await uploadsApi.uploadTradeScreenshot(tradeId, file);
      
      if (!response?.url) {
        toast.error('Failed to upload image');
        setUploading(false);
        return;
      }

      const newUrls = [...urls, response.url];
      setUrls(newUrls);
      onUpdate(newUrls);
      toast.success('Screenshot uploaded');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      uploadImage(file);
    }
  };

  const removeImage = async (url: string) => {
    try {
      // Extract screenshot ID from URL or use the full URL as ID
      const screenshotId = url.split('/').pop() || url;
      await uploadsApi.deleteTradeScreenshot(screenshotId);
      
      const newUrls = urls.filter(u => u !== url);
      setUrls(newUrls);
      onUpdate(newUrls);
      toast.success('Screenshot removed');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Failed to remove screenshot');
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm text-muted-foreground">Screenshots</label>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1 text-sm text-foreground"
        >
          <Camera className="w-4 h-4" />
          {uploading ? 'Uploading...' : 'Add'}
        </button>
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />

      {urls.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {urls.map((url, i) => (
            <div key={i} className="relative aspect-video bg-secondary rounded-xl overflow-hidden group">
              <img 
                src={url} 
                alt={`Screenshot ${i + 1}`} 
                className="w-full h-full object-cover"
              />
              <button
                onClick={() => removeImage(url)}
                className="absolute top-1 right-1 w-6 h-6 bg-destructive text-background rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div 
          onClick={() => fileInputRef.current?.click()}
          className="border border-dashed border-border rounded-xl p-4 text-center cursor-pointer hover:border-foreground/50 transition-colors"
        >
          <ImageIcon className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Tap to add screenshot</p>
        </div>
      )}
    </div>
  );
};
