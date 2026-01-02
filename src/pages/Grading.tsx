import { useEffect, useState } from 'react';
import { gradingApi, profileApi, comicApi } from '@/db/api';
import type { GradingRequest, ScanStatus } from '@/types/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { Award, Lock, Upload, Camera, X, Zap, Save, Printer, Trash2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { uploadImage } from '@/utils/upload';
import CameraCapture from '@/components/CameraCapture';

export default function Grading() {
  const [requests, setRequests] = useState<GradingRequest[]>([]);
  const [scanStatus, setScanStatus] = useState<ScanStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [conditionNotes, setConditionNotes] = useState('');
  const [uploadedImages, setUploadedImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  
  // Comic form fields
  const [comicTitle, setComicTitle] = useState('');
  const [issueNumber, setIssueNumber] = useState('');
  const [publisher, setPublisher] = useState('');
  const [publishYear, setPublishYear] = useState('');
  const [condition, setCondition] = useState('');
  
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();

  const loadData = async () => {
    if (!user) return;

    try {
      const [reqData, status] = await Promise.all([
        gradingApi.getMyGradingRequests(),
        profileApi.getScanStatus(user.id),
      ]);
      setRequests(reqData);
      setScanStatus(status);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to load data',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !user) return;

    setUploading(true);
    try {
      const uploadPromises = Array.from(files).map(file => uploadImage(file, 'app-7whklnxpov0h_comic_images', user.id));
      const urls = await Promise.all(uploadPromises);
      setUploadedImages(prev => [...prev, ...urls]);
      toast({
        title: 'Success',
        description: `${files.length} image(s) uploaded successfully`,
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload images',
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
      setUploadedImages(prev => [...prev, url]);
      setIsCameraOpen(false);
      toast({
        title: 'Success',
        description: 'Photo captured successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to upload photo',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setUploadedImages(prev => prev.filter((_, i) => i !== index));
  };

  const clearForm = () => {
    setUploadedImages([]);
    setConditionNotes('');
    setComicTitle('');
    setIssueNumber('');
    setPublisher('');
    setPublishYear('');
    setCondition('');
  };

  const handleSaveToCollection = async () => {
    if (!user) return;
    if (uploadedImages.length === 0) {
      toast({
        title: 'Error',
        description: 'Please upload at least one image',
        variant: 'destructive',
      });
      return;
    }

    if (!comicTitle.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a comic title',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      await comicApi.createComic({
        user_id: user.id,
        title: comicTitle.trim(),
        issue_number: issueNumber.trim() || null,
        publisher: publisher.trim() || null,
        publish_year: publishYear ? parseInt(publishYear) : null,
        condition: condition.trim() || null,
        grade: null,
        estimated_value: null,
        cover_image_url: uploadedImages[0],
        notes: conditionNotes.trim() || null,
      });

      toast({
        title: 'Success',
        description: 'Comic saved to your collection!',
      });

      setIsDialogOpen(false);
      clearForm();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to save comic',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmitRequest = async () => {
    if (!user) return;

    if (uploadedImages.length < 2) {
      toast({
        title: 'Error',
        description: 'Please upload at least two images (front & back).',
        variant: 'destructive',
      });
      return;
    }

    setUploading(true);
    try {
      const canScan = await profileApi.canScan(user.id);
      if (!canScan) {
        toast({
          title: 'No Scans Available',
          description: 'You have no scans remaining. Please upgrade your plan or purchase scan packs.',
          variant: 'destructive',
        });
        setUploading(false);
        return;
      }

      const usedScan = await profileApi.useScan(user.id);
      if (!usedScan) {
        toast({
          title: 'Error',
          description: 'Failed to use scan. Please try again.',
          variant: 'destructive',
        });
        setUploading(false);
        return;
      }

      // Create grading request in database
      const request = await gradingApi.createGradingRequest({
        user_id: user.id,
        comic_id: null,
        image_urls: uploadedImages,
        condition_notes: conditionNotes || null,
      });

      // Convert Supabase URLs to File objects
      const frontBlob = await fetch(uploadedImages[0]).then(r => r.blob());
      const backBlob = await fetch(uploadedImages[1]).then(r => r.blob());

      const frontFile = new File([frontBlob], 'front.jpg', { type: frontBlob.type });
      const backFile = new File([backBlob], 'back.jpg', { type: backBlob.type });

      // Send to AI grading backend using API function
      console.log('Sending grading request to AI backend...');
      const result = await gradingApi.submitToBackend(user.id, frontFile, backFile);

      // Save the real grade into database
      await gradingApi.processGrading(
        request.id,
        result.subgrades.final,
        null
      );

      toast({
        title: 'Success',
        description: 'Your comic has been graded!',
      });

      setIsDialogOpen(false);
      clearForm();
      loadData();
    } catch (error: any) {
      console.error(error);
      toast({
        title: 'Error',
        description: error.message || 'Something went wrong.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const canSubmitGrading = scanStatus && (
    scanStatus.trial_active ||
    scanStatus.monthly_scans_remaining > 0 || 
    scanStatus.one_time_scans > 0 || 
    scanStatus.tier === 'pro'
  );

  const handleDialogChange = (open: boolean) => {
    setIsDialogOpen(open);
    if (!open) {
      // Reset uploading state when dialog closes
      setUploading(false);
    }
  };

  const handlePrintReport = (request: GradingRequest) => {
    // Create a new window for printing
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast({
        title: 'Error',
        description: 'Please allow popups to print the report',
        variant: 'destructive',
      });
      return;
    }

    // Get comic details if available
    const comicTitle = request.comic_id ? 'Comic Details' : 'Grading Report';
    
    // Generate print HTML
    const printHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>Comic Grading Report</title>
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Arial', sans-serif;
              padding: 40px;
              color: #1a2332;
              background: white;
            }
            .header {
              text-align: center;
              margin-bottom: 40px;
              border-bottom: 3px solid #dc2626;
              padding-bottom: 20px;
            }
            .header h1 {
              font-size: 32px;
              color: #1a2332;
              margin-bottom: 10px;
            }
            .header p {
              color: #666;
              font-size: 14px;
            }
            .report-info {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 20px;
              margin-bottom: 30px;
            }
            .info-box {
              padding: 15px;
              background: #f8f9fa;
              border-radius: 8px;
              border-left: 4px solid #dc2626;
            }
            .info-box label {
              display: block;
              font-size: 12px;
              color: #666;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              margin-bottom: 5px;
            }
            .info-box .value {
              font-size: 18px;
              font-weight: bold;
              color: #1a2332;
            }
            .grade-section {
              display: grid;
              grid-template-columns: 1fr 1fr;
              gap: 30px;
              margin: 30px 0;
              padding: 30px;
              background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
              border-radius: 12px;
            }
            .grade-box {
              text-align: center;
            }
            .grade-box label {
              display: block;
              font-size: 14px;
              color: #666;
              margin-bottom: 10px;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .grade-box .grade-value {
              font-size: 48px;
              font-weight: bold;
              color: #dc2626;
              margin-bottom: 5px;
            }
            .grade-box .grade-subtitle {
              font-size: 12px;
              color: #666;
            }
            .images-section {
              margin: 30px 0;
            }
            .images-section h2 {
              font-size: 20px;
              margin-bottom: 15px;
              color: #1a2332;
            }
            .images-grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 15px;
            }
            .images-grid img {
              width: 100%;
              height: 200px;
              object-fit: cover;
              border-radius: 8px;
              border: 2px solid #e9ecef;
            }
            .notes-section {
              margin: 30px 0;
              padding: 20px;
              background: #f8f9fa;
              border-radius: 8px;
              border-left: 4px solid #fbbf24;
            }
            .notes-section h2 {
              font-size: 16px;
              margin-bottom: 10px;
              color: #1a2332;
            }
            .notes-section p {
              font-size: 14px;
              line-height: 1.6;
              color: #666;
            }
            .footer {
              margin-top: 50px;
              padding-top: 20px;
              border-top: 2px solid #e9ecef;
              text-align: center;
              color: #666;
              font-size: 12px;
            }
            .grade-scale {
              margin: 30px 0;
              padding: 20px;
              background: white;
              border: 2px solid #e9ecef;
              border-radius: 8px;
            }
            .grade-scale h3 {
              font-size: 16px;
              margin-bottom: 15px;
              color: #1a2332;
            }
            .scale-item {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px solid #f0f0f0;
            }
            .scale-item:last-child {
              border-bottom: none;
            }
            .scale-grade {
              font-weight: bold;
              color: #dc2626;
            }
            @media print {
              body {
                padding: 20px;
              }
              .no-print {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>🎨 Comic Vault</h1>
            <p>Professional Comic Book Grading Report</p>
          </div>

          <div class="report-info">
            <div class="info-box">
              <label>Report ID</label>
              <div class="value">${request.id.substring(0, 8).toUpperCase()}</div>
            </div>
            <div class="info-box">
              <label>Date Submitted</label>
              <div class="value">${new Date(request.created_at).toLocaleDateString('en-US', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</div>
            </div>
            <div class="info-box">
              <label>Date Completed</label>
              <div class="value">${request.completed_at 
                ? new Date(request.completed_at).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })
                : 'Pending'
              }</div>
            </div>
            <div class="info-box">
              <label>Status</label>
              <div class="value" style="text-transform: capitalize;">${request.status}</div>
            </div>
          </div>

          ${request.status === 'completed' ? `
            <div class="grade-section">
              <div class="grade-box">
                <label>Grade</label>
                <div class="grade-value">${request.grade_result?.toFixed(1) || 'N/A'}</div>
                <div class="grade-subtitle">Out of 10.0</div>
              </div>
              <div class="grade-box">
                <label>Estimated Value</label>
                <div class="grade-value" style="color: #fbbf24;">$${request.value_estimate?.toFixed(2) || '0.00'}</div>
                <div class="grade-subtitle">Based on Current Market</div>
              </div>
            </div>

            <div class="grade-scale">
              <h3>Grading Scale Reference</h3>
              <div class="scale-item">
                <span class="scale-grade">10.0 - Gem Mint</span>
                <span>Perfect condition, no flaws</span>
              </div>
              <div class="scale-item">
                <span class="scale-grade">9.0-9.9 - Mint</span>
                <span>Nearly perfect, minor printing defects allowed</span>
              </div>
              <div class="scale-item">
                <span class="scale-grade">8.0-8.9 - Very Fine</span>
                <span>Excellent condition, minor wear</span>
              </div>
              <div class="scale-item">
                <span class="scale-grade">6.0-7.9 - Fine</span>
                <span>Above average, light to moderate wear</span>
              </div>
              <div class="scale-item">
                <span class="scale-grade">4.0-5.9 - Very Good</span>
                <span>Average used comic, moderate wear</span>
              </div>
              <div class="scale-item">
                <span class="scale-grade">2.0-3.9 - Good</span>
                <span>Complete but well-read, heavy wear</span>
              </div>
              <div class="scale-item">
                <span class="scale-grade">0.5-1.9 - Fair/Poor</span>
                <span>Heavily worn, major defects</span>
              </div>
            </div>
          ` : ''}

          ${request.image_urls && request.image_urls.length > 0 ? `
            <div class="images-section">
              <h2>Comic Images</h2>
              <div class="images-grid">
                ${request.image_urls.map((url: string, index: number) => `
                  <img src="${url}" alt="Comic Image ${index + 1}" />
                `).join('')}
              </div>
            </div>
          ` : ''}

          ${request.condition_notes ? `
            <div class="notes-section">
              <h2>Condition Notes</h2>
              <p>${request.condition_notes}</p>
            </div>
          ` : ''}

          <div class="footer">
            <p><strong>Comic Vault</strong> - Professional Comic Book Grading Service</p>
            <p>This report was generated on ${new Date().toLocaleDateString('en-US', { 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}</p>
            <p style="margin-top: 10px; font-size: 11px;">
              Report ID: ${request.id} | For questions or concerns, please contact support.
            </p>
          </div>
        </body>
      </html>
    `;

    printWindow.document.write(printHTML);
    printWindow.document.close();
    
    // Wait for images to load before printing
    printWindow.onload = () => {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
  };

  const handleDeleteRequest = async (requestId: string) => {
    if (!confirm('Are you sure you want to delete this grading request? This action cannot be undone.')) {
      return;
    }

    try {
      await gradingApi.deleteGradingRequest(requestId);
      
      // Remove from local state
      setRequests(prev => prev.filter(r => r.id !== requestId));
      
      toast({
        title: 'Success',
        description: 'Grading request deleted successfully',
      });
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete grading request',
        variant: 'destructive',
      });
    }
  };

  const handleResubmitRequest = async (request: GradingRequest) => {
    if (!user) return;

    setUploading(true);
    
    try {
      console.log('Resubmitting grading request:', request.id);
      console.log('Image URLs:', request.image_urls);

      // Convert image URLs to File objects
      const frontBlob = await fetch(request.image_urls[0]).then(r => r.blob());
      const backBlob = await fetch(request.image_urls[1]).then(r => r.blob());

      const frontFile = new File([frontBlob], 'front.jpg', { type: frontBlob.type });
      const backFile = new File([backBlob], 'back.jpg', { type: backBlob.type });

      console.log('Files created:', frontFile.size, backFile.size);

      // Submit to backend (no scan charge for resubmits)
      console.log('Submitting to backend...');
      const result = await gradingApi.submitToBackend(user.id, frontFile, backFile);
      console.log('Backend result:', result);

      // Update the existing request with results
      await gradingApi.processGrading(
        request.id,
        result.subgrades.final,
        null
      );

      // Refresh requests
      const updatedRequests = await gradingApi.getMyGradingRequests();
      setRequests(updatedRequests);

      toast({
        title: 'Success',
        description: 'Comic graded successfully!',
      });
    } catch (error: any) {
      console.error('Resubmit error:', error);

      // Provide more helpful error messages
      let errorMessage = 'Failed to resubmit grading request';
      
      if (error.message.includes('Failed to fetch') || error.message.includes('fetch')) {
        errorMessage = 'Unable to connect to the grading service. This could be due to:\n\n' +
                      '• The backend service is starting up (can take 30-60 seconds on first request)\n' +
                      '• Network connectivity issues\n' +
                      '• CORS restrictions\n\n' +
                      'Please try again in a moment.';
      } else if (error.message.includes('timeout')) {
        errorMessage = 'Request timed out. The backend may be starting up. Please try again in a moment.';
      } else {
        errorMessage = error.message || errorMessage;
      }

      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const getTotalScansAvailable = () => {
    if (!scanStatus) return 0;
    if (scanStatus.trial_active) return scanStatus.trial_scans_remaining;
    if (scanStatus.tier === 'pro') return 999999;
    return scanStatus.monthly_scans_remaining + scanStatus.one_time_scans;
  };

  const getScanBadgeText = () => {
    if (!scanStatus) return '';
    
    if (scanStatus.trial_active) {
      return `${scanStatus.trial_scans_remaining} Trial Scans`;
    }
    
    if (scanStatus.tier === 'pro') return 'Unlimited Scans';
    
    const total = getTotalScansAvailable();
    if (total === 0) return 'No Scans Remaining';
    
    const parts = [];
    if (scanStatus.monthly_scans_remaining > 0) {
      parts.push(`${scanStatus.monthly_scans_remaining} Monthly`);
    }
    if (scanStatus.one_time_scans > 0) {
      parts.push(`${scanStatus.one_time_scans} Bonus`);
    }
    return parts.join(' + ');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {scanStatus?.trial_active && (
        <Card className="border-2 border-accent bg-gradient-to-r from-accent/10 to-accent/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Zap className="h-6 w-6 text-accent shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                  🎉 Free Trial Active
                </h3>
                <p className="text-sm text-muted-foreground mb-2">
                  You have <strong>{scanStatus?.trial_scans_remaining || 0} of 3 trial scans</strong> remaining. 
                  {scanStatus?.trial_expires_at && (
                    <> Your trial expires on <strong>{new Date(scanStatus.trial_expires_at).toLocaleDateString()}</strong>.</>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  During your trial, you have full COLLECTOR tier access: 1,000 comics storage and 6% marketplace fees.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Award className="h-8 w-8" />
            Comic Grading
          </h1>
          <p className="text-muted-foreground mt-1">
            Professional comic book grading service
          </p>
        </div>
        {scanStatus && (
          <Badge 
            variant={getTotalScansAvailable() > 0 ? 'secondary' : 'outline'}
            className="text-sm px-4 py-2"
          >
            <Zap className="h-4 w-4 mr-2" />
            {getScanBadgeText()}
          </Badge>
        )}
      </div>

      {!canSubmitGrading && (
        <Card className="border-accent bg-accent/5">
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <Lock className="h-6 w-6 text-accent shrink-0 mt-1" />
              <div className="flex-1">
                <h3 className="font-semibold text-lg mb-2">No Scans Available</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {scanStatus?.tier === 'free' 
                    ? `You've used all ${scanStatus?.monthly_scans_limit || 10} scans for this month. Upgrade to Collector (50 scans/month) or Pro (unlimited) for more grading power.`
                    : `You've used all your scans. Upgrade to Pro for unlimited scans or purchase scan packs.`
                  }
                </p>
                <div className="flex gap-3">
                  <Button onClick={() => navigate('/subscription')}>
                    View Plans
                  </Button>
                  {scanStatus?.tier !== 'free' && (
                    <Button variant="outline" onClick={() => navigate('/subscription')}>
                      Buy Scan Packs
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {canSubmitGrading && (
        <Dialog open={isDialogOpen} onOpenChange={handleDialogChange}>
          <DialogTrigger asChild>
            <Button size="lg" className="w-full xl:w-auto">
              <Upload className="mr-2 h-5 w-5" />
              New Grading Request
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Submit Comic for Grading</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Comic Images</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  Upload multiple images showing the front, back, and any notable features
                </p>
                
                <div className="flex gap-2 mb-3">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById('image-upload')?.click()}
                    disabled={uploading}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    {uploading ? 'Uploading...' : 'Upload Images'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsCameraOpen(true)}
                  >
                    <Camera className="mr-2 h-4 w-4" />
                    Take Photo
                  </Button>
                </div>

                <input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {uploadedImages.length > 0 && (
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {uploadedImages.map((url, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={url}
                          alt={`Upload ${index + 1}`}
                          className="w-full h-32 object-cover rounded border"
                        />
                        <button
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-4 border-t pt-4">
                <h3 className="font-semibold">Comic Details</h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label htmlFor="comic-title">Title *</Label>
                    <Input
                      id="comic-title"
                      placeholder="e.g., Amazing Spider-Man"
                      value={comicTitle}
                      onChange={(e) => setComicTitle(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="issue-number">Issue Number</Label>
                    <Input
                      id="issue-number"
                      placeholder="e.g., #1"
                      value={issueNumber}
                      onChange={(e) => setIssueNumber(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="publisher">Publisher</Label>
                    <Input
                      id="publisher"
                      placeholder="e.g., Marvel"
                      value={publisher}
                      onChange={(e) => setPublisher(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="publish-year">Publish Year</Label>
                    <Input
                      id="publish-year"
                      type="number"
                      placeholder="e.g., 1963"
                      value={publishYear}
                      onChange={(e) => setPublishYear(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor="condition">Condition</Label>
                    <Input
                      id="condition"
                      placeholder="e.g., Near Mint"
                      value={condition}
                      onChange={(e) => setCondition(e.target.value)}
                      className="mt-2"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="condition-notes">Notes (Optional)</Label>
                <Textarea
                  id="condition-notes"
                  placeholder="Describe any notable features, defects, or condition details..."
                  value={conditionNotes}
                  onChange={(e) => setConditionNotes(e.target.value)}
                  rows={4}
                  className="mt-2"
                />
              </div>

              <div className="flex justify-between gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsDialogOpen(false);
                    clearForm();
                  }}
                >
                  Cancel
                </Button>
                
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    onClick={handleSaveToCollection}
                    disabled={uploadedImages.length === 0 || uploading || !comicTitle.trim()}
                  >
                    <Save className="mr-2 h-4 w-4" />
                    {uploading ? 'Saving...' : 'Save to Collection'}
                  </Button>
                  <Button
                    onClick={handleSubmitRequest}
                    disabled={uploadedImages.length === 0 || uploading || !canSubmitGrading}
                  >
                    <Award className="mr-2 h-4 w-4" />
                    {uploading ? 'Submitting...' : 'Submit for Grading'}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {isCameraOpen && (
        <Dialog open={isCameraOpen} onOpenChange={setIsCameraOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Take Photo</DialogTitle>
            </DialogHeader>
            <CameraCapture
              isOpen={isCameraOpen}
              onCapture={handleCameraCapture}
              onClose={() => setIsCameraOpen(false)}
            />
          </DialogContent>
        </Dialog>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Grading History</h2>
            <p className="text-muted-foreground text-sm mt-1">
              View your previous grading requests and results
            </p>
          </div>
          {requests.length > 0 && (
            <Badge variant="secondary" className="text-sm">
              {requests.length} {requests.length === 1 ? 'Request' : 'Requests'}
            </Badge>
          )}
        </div>

        <div className="grid gap-4">
          {requests.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center py-12">
              <Award className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No grading requests yet</p>
              {canSubmitGrading && (
                <p className="text-sm text-muted-foreground mt-2">
                  Submit your first comic for professional grading
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          requests.map((request) => (
            <Card key={request.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>Grading Request</CardTitle>
                    <CardDescription>
                      Submitted {new Date(request.created_at).toLocaleDateString()}
                    </CardDescription>
                  </div>
                  <Badge variant={request.status === 'completed' ? 'default' : 'secondary'}>
                    {request.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-2">
                  {request.image_urls.map((url, index) => (
                    <img
                      key={index}
                      src={url}
                      alt={`Comic ${index + 1}`}
                      className="w-full h-32 object-cover rounded border"
                    />
                  ))}
                </div>

                {request.condition_notes && (
                  <div>
                    <Label>Condition Notes</Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      {request.condition_notes}
                    </p>
                  </div>
                )}

                {request.status === 'completed' && (
                  <>
                    <div className="grid xl:grid-cols-2 gap-4 pt-4 border-t">
                      <div>
                        <Label>Grade</Label>
                        <p className="text-2xl font-bold text-primary mt-1">
                          {request.grade_result?.toFixed(1) || 'N/A'}
                        </p>
                        <p className="text-xs text-muted-foreground">Out of 10.0</p>
                      </div>
                      <div>
                        <Label>Estimated Value</Label>
                        <p className="text-2xl font-bold text-accent mt-1">
                          ${request.value_estimate?.toFixed(2) || '0.00'}
                        </p>
                        <p className="text-xs text-muted-foreground">Based on current market</p>
                      </div>
                    </div>
                    
                    <div className="flex justify-end pt-4 border-t">
                      <Button
                        variant="outline"
                        onClick={() => handlePrintReport(request)}
                        className="gap-2"
                      >
                        <Printer className="h-4 w-4" />
                        Print Report
                      </Button>
                    </div>
                  </>
                )}

                {request.status === 'pending' && (
                  <div className="flex flex-col gap-3 pt-4 border-t">
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <p className="text-sm text-muted-foreground">
                        This grading request is pending. You can resubmit it to try again (no additional charge), or delete it if no longer needed.
                      </p>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        onClick={() => handleDeleteRequest(request.id)}
                        className="gap-2"
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                      <Button
                        onClick={() => handleResubmitRequest(request)}
                        disabled={uploading}
                        className="gap-2"
                      >
                        <RefreshCw className={`h-4 w-4 ${uploading ? 'animate-spin' : ''}`} />
                        {uploading ? 'Resubmitting...' : 'Resubmit'}
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
      </div>
    </div>
  );
}
