import { useState, useEffect } from 'react';
import { comicApi } from '@/db/api';
import type { Comic } from '@/types/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { uploadImage } from '@/utils/upload';
import { Upload, X, Camera } from 'lucide-react';
import CameraCapture from './CameraCapture';

interface ComicFormProps {
  comic?: Comic | null;
  onSuccess: () => void;
}

const CONDITIONS = ['Mint', 'Near Mint', 'Very Fine', 'Fine', 'Very Good', 'Good', 'Fair', 'Poor'];

export default function ComicForm({ comic, onSuccess }: ComicFormProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    issue_number: '',
    publisher: '',
    publish_year: '',
    condition: '',
    grade: '',
    estimated_value: '',
    cover_image_url: '',
    notes: '',
  });

  useEffect(() => {
    if (comic) {
      setFormData({
        title: comic.title || '',
        issue_number: comic.issue_number || '',
        publisher: comic.publisher || '',
        publish_year: comic.publish_year?.toString() || '',
        condition: comic.condition || '',
        grade: comic.grade?.toString() || '',
        estimated_value: comic.estimated_value?.toString() || '',
        cover_image_url: comic.cover_image_url || '',
        notes: comic.notes || '',
      });
    }
  }, [comic]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const url = await uploadImage(file, 'app-7whklnxpov0h_comic_images', user.id);
      setFormData(prev => ({ ...prev, cover_image_url: url }));
      toast({
        title: 'Success',
        description: 'Image uploaded successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload image',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCameraCapture = async (file: File) => {
    if (!user) return;

    setUploading(true);
    try {
      const url = await uploadImage(file, 'app-7whklnxpov0h_comic_images', user.id);
      setFormData(prev => ({ ...prev, cover_image_url: url }));
      toast({
        title: 'Success',
        description: 'Photo captured and uploaded successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload photo',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      toast({
        title: 'Error',
        description: 'Title is required',
        variant: 'destructive',
      });
      return;
    }

    if (!user) return;

    setLoading(true);
    try {
      const comicData = {
        user_id: user.id,
        title: formData.title.trim(),
        issue_number: formData.issue_number.trim() || null,
        publisher: formData.publisher.trim() || null,
        publish_year: formData.publish_year ? parseInt(formData.publish_year) : null,
        condition: formData.condition || null,
        grade: formData.grade ? parseFloat(formData.grade) : null,
        estimated_value: formData.estimated_value ? parseFloat(formData.estimated_value) : null,
        cover_image_url: formData.cover_image_url || null,
        notes: formData.notes.trim() || null,
      };

      if (comic) {
        await comicApi.updateComic(comic.id, comicData);
        toast({
          title: 'Success',
          description: 'Comic updated successfully',
        });
      } else {
        await comicApi.createComic(comicData);
        toast({
          title: 'Success',
          description: 'Comic added to your collection',
        });
      }

      onSuccess();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save comic',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          placeholder="Enter comic title"
          disabled={loading}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="issue_number">Issue Number</Label>
          <Input
            id="issue_number"
            value={formData.issue_number}
            onChange={(e) => setFormData(prev => ({ ...prev, issue_number: e.target.value }))}
            placeholder="e.g., 1, 2A, Annual"
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="publisher">Publisher</Label>
          <Input
            id="publisher"
            value={formData.publisher}
            onChange={(e) => setFormData(prev => ({ ...prev, publisher: e.target.value }))}
            placeholder="e.g., Marvel, DC"
            disabled={loading}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="publish_year">Publish Year</Label>
          <Input
            id="publish_year"
            type="number"
            value={formData.publish_year}
            onChange={(e) => setFormData(prev => ({ ...prev, publish_year: e.target.value }))}
            placeholder="e.g., 1963"
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="condition">Condition</Label>
          <Select
            value={formData.condition}
            onValueChange={(value) => setFormData(prev => ({ ...prev, condition: value }))}
            disabled={loading}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select condition" />
            </SelectTrigger>
            <SelectContent>
              {CONDITIONS.map((cond) => (
                <SelectItem key={cond} value={cond}>
                  {cond}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="grade">Grade (1-10)</Label>
          <Input
            id="grade"
            type="number"
            step="0.1"
            min="1"
            max="10"
            value={formData.grade}
            onChange={(e) => setFormData(prev => ({ ...prev, grade: e.target.value }))}
            placeholder="e.g., 9.2"
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="estimated_value">Estimated Value ($)</Label>
          <Input
            id="estimated_value"
            type="number"
            step="0.01"
            min="0"
            value={formData.estimated_value}
            onChange={(e) => setFormData(prev => ({ ...prev, estimated_value: e.target.value }))}
            placeholder="e.g., 150.00"
            disabled={loading}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Cover Image</Label>
        {formData.cover_image_url ? (
          <div className="relative">
            <img
              src={formData.cover_image_url}
              alt="Cover preview"
              className="w-full h-48 object-cover rounded-lg"
            />
            <Button
              type="button"
              variant="destructive"
              size="icon"
              className="absolute top-2 right-2"
              onClick={() => setFormData(prev => ({ ...prev, cover_image_url: '' }))}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground" />
              <Label htmlFor="image-upload" className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                {uploading ? 'Uploading...' : 'Click to upload cover image'}
              </Label>
              <input
                id="image-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
                disabled={uploading || loading}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => setIsCameraOpen(true)}
              disabled={uploading || loading}
            >
              <Camera className="h-4 w-4 mr-2" />
              Take Photo with Camera
            </Button>
          </div>
        )}
      </div>

      <CameraCapture
        isOpen={isCameraOpen}
        onClose={() => setIsCameraOpen(false)}
        onCapture={handleCameraCapture}
      />

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          placeholder="Any additional notes about this comic..."
          rows={3}
          disabled={loading}
        />
      </div>

      <div className="flex gap-2 pt-4">
        <Button type="submit" className="flex-1" disabled={loading || uploading}>
          {loading ? 'Saving...' : comic ? 'Update Comic' : 'Add Comic'}
        </Button>
      </div>
    </form>
  );
}
