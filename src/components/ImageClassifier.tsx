import { useState, useRef } from 'react';
import { pipeline } from '@huggingface/transformers';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Upload, Image as ImageIcon, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface Prediction {
  label: string;
  score: number;
}

export function ImageClassifier() {
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>('');
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [modelLoading, setModelLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      setImageUrl(URL.createObjectURL(file));
      setPredictions([]);
    }
  };

  const uploadImageToStorage = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${user?.id}/${Date.now()}.${fileExt}`;
    
    const { error } = await supabase.storage
      .from('prediction-images')
      .upload(fileName, file);

    if (error) {
      console.error('Upload error:', error);
      return null;
    }

    const { data } = supabase.storage
      .from('prediction-images')
      .getPublicUrl(fileName);

    return data.publicUrl;
  };

  const savePrediction = async (imageUrl: string, predictions: Prediction[]) => {
    if (!user || predictions.length === 0) return;

    const topPrediction = predictions[0];
    
    const { error } = await supabase
      .from('predictions')
      .insert({
        user_id: user.id,
        image_url: imageUrl,
        prediction_result: predictions as any,
        confidence: topPrediction.score,
        model_used: 'mobilenetv4_conv_small.e2400_r224_in1k'
      });

    if (error) {
      console.error('Error saving prediction:', error);
    }
  };

  const classifyImage = async () => {
    if (!selectedImage) return;

    setLoading(true);
    setModelLoading(true);
    
    try {
      // Upload image to storage
      const uploadedImageUrl = await uploadImageToStorage(selectedImage);
      if (!uploadedImageUrl) {
        throw new Error('Failed to upload image');
      }

      // Load the classification pipeline
      const classifier = await pipeline(
        'image-classification',
        'onnx-community/mobilenetv4_conv_small.e2400_r224_in1k',
        { device: 'webgpu' }
      );
      
      setModelLoading(false);

      // Classify the image
      const result = await classifier(imageUrl);
      
      // Format predictions
      const formattedPredictions = result.slice(0, 5).map((pred: any) => ({
        label: pred.label,
        score: pred.score
      }));
      
      setPredictions(formattedPredictions);
      
      // Save to database
      await savePrediction(uploadedImageUrl, formattedPredictions);
      
      toast({
        title: "Classification complete!",
        description: `Top prediction: ${formattedPredictions[0].label} (${(formattedPredictions[0].score * 100).toFixed(1)}% confidence)`,
      });
      
    } catch (error) {
      console.error('Classification error:', error);
      toast({
        title: "Classification failed",
        description: "There was an error classifying your image. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setModelLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ImageIcon className="h-6 w-6" />
          Image Classifier
        </CardTitle>
        <CardDescription>
          Upload an image and our AI will identify what's in it using a state-of-the-art vision model.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Upload Area */}
        <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          
          {imageUrl ? (
            <div className="space-y-4">
              <img
                src={imageUrl}
                alt="Selected"
                className="max-w-full max-h-64 mx-auto rounded-lg object-contain"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
              >
                Choose Different Image
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  Drag & drop an image here, or click to select
                </p>
                <Button onClick={() => fileInputRef.current?.click()}>
                  Select Image
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Classify Button */}
        {selectedImage && (
          <Button 
            onClick={classifyImage} 
            disabled={loading}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {modelLoading ? 'Loading AI model...' : 'Classifying...'}
              </>
            ) : (
              'Classify Image'
            )}
          </Button>
        )}

        {/* Model Loading Progress */}
        {modelLoading && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Loading AI model for the first time...</p>
            <Progress value={undefined} className="w-full" />
          </div>
        )}

        {/* Results */}
        {predictions.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Predictions</h3>
            <div className="space-y-3">
              {predictions.map((prediction, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{prediction.label}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Progress value={prediction.score * 100} className="flex-1" />
                      <Badge variant="secondary">
                        {(prediction.score * 100).toFixed(1)}%
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}