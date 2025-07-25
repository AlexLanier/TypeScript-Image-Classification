import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { History, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface PredictionRecord {
  id: string;
  image_url: string;
  prediction_result: any;
  confidence: number;
  created_at: string;
}

export function PredictionHistory() {
  const [predictions, setPredictions] = useState<PredictionRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      fetchPredictions();
    }
  }, [user]);

  const fetchPredictions = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (error) {
      console.error('Error fetching predictions:', error);
    } else {
      setPredictions(data || []);
    }
    
    setLoading(false);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Prediction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <p className="text-muted-foreground">Loading history...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Prediction History
        </CardTitle>
        <CardDescription>
          Your recent AI predictions
        </CardDescription>
      </CardHeader>
      <CardContent>
        {predictions.length === 0 ? (
          <div className="text-center py-8">
            <History className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No predictions yet</p>
            <p className="text-sm text-muted-foreground">Upload an image to get started!</p>
          </div>
        ) : (
          <ScrollArea className="h-96">
            <div className="space-y-4">
              {predictions.map((prediction) => {
                const topPrediction = prediction.prediction_result[0];
                return (
                  <div key={prediction.id} className="flex gap-4 p-4 border rounded-lg">
                    <img
                      src={prediction.image_url}
                      alt="Prediction"
                      className="w-16 h-16 object-cover rounded-md"
                    />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium">{topPrediction.label}</h4>
                        <Badge variant="secondary">
                          {(prediction.confidence * 100).toFixed(1)}%
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        {formatDistanceToNow(new Date(prediction.created_at), { addSuffix: true })}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}