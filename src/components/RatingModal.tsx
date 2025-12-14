import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Star, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { toast } from '@/hooks/use-toast';

interface RatingModalProps {
  deliveryId: string;
  driverUserId: string;
  driverName: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export function RatingModal({ 
  deliveryId, 
  driverUserId, 
  driverName, 
  onClose, 
  onSubmitted 
}: RatingModalProps) {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!user || rating === 0) {
      toast({
        variant: 'destructive',
        title: 'Selecione uma avaliação',
        description: 'Por favor, selecione de 1 a 5 estrelas'
      });
      return;
    }

    setSubmitting(true);

    try {
      // Insert rating
      const { error: ratingError } = await supabase
        .from('ratings')
        .insert({
          delivery_id: deliveryId,
          rated_by: user.id,
          rated_user: driverUserId,
          rating: rating,
          comment: comment.trim() || null
        });

      if (ratingError) throw ratingError;

      // Calculate new average rating for driver
      const { data: allRatings } = await supabase
        .from('ratings')
        .select('rating')
        .eq('rated_user', driverUserId);

      if (allRatings && allRatings.length > 0) {
        const avgRating = allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length;
        
        // Update driver's rating
        await supabase
          .from('drivers')
          .update({ rating: Number(avgRating.toFixed(2)) })
          .eq('user_id', driverUserId);
      }

      toast({
        title: '⭐ Avaliação enviada!',
        description: 'Obrigado pelo seu feedback'
      });

      onSubmitted();
    } catch (error: any) {
      console.error('Error submitting rating:', error);
      toast({
        variant: 'destructive',
        title: 'Erro ao enviar avaliação',
        description: error.message
      });
    } finally {
      setSubmitting(false);
    }
  };

  const displayRating = hoverRating || rating;

  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/50 animate-in fade-in">
      <Card className="w-full max-w-md mx-4 mb-0 md:mb-4 rounded-b-none md:rounded-b-xl animate-in slide-in-from-bottom duration-300">
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold">Avaliar Entrega</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Driver Info */}
          <div className="text-center mb-6">
            <div className="w-16 h-16 rounded-full bg-primary/10 mx-auto mb-3 flex items-center justify-center">
              <span className="text-2xl">🛵</span>
            </div>
            <p className="font-semibold text-lg">{driverName}</p>
            <p className="text-sm text-muted-foreground">Como foi a entrega?</p>
          </div>

          {/* Stars */}
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className="p-1 transition-transform hover:scale-110 focus:outline-none"
                onMouseEnter={() => setHoverRating(star)}
                onMouseLeave={() => setHoverRating(0)}
                onClick={() => setRating(star)}
              >
                <Star
                  className={`h-10 w-10 transition-colors ${
                    star <= displayRating
                      ? 'fill-yellow-400 text-yellow-400'
                      : 'text-muted-foreground'
                  }`}
                />
              </button>
            ))}
          </div>

          {/* Rating Label */}
          <div className="text-center mb-6">
            {displayRating === 1 && <span className="text-sm text-muted-foreground">Ruim</span>}
            {displayRating === 2 && <span className="text-sm text-muted-foreground">Regular</span>}
            {displayRating === 3 && <span className="text-sm text-muted-foreground">Bom</span>}
            {displayRating === 4 && <span className="text-sm text-muted-foreground">Muito bom</span>}
            {displayRating === 5 && <span className="text-sm text-muted-foreground">Excelente!</span>}
          </div>

          {/* Comment */}
          <div className="mb-6">
            <Textarea
              placeholder="Deixe um comentário (opcional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              maxLength={500}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground text-right mt-1">
              {comment.length}/500
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onClose}
              disabled={submitting}
            >
              Pular
            </Button>
            <Button
              className="flex-1"
              onClick={handleSubmit}
              disabled={submitting || rating === 0}
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Enviando...
                </>
              ) : (
                'Enviar Avaliação'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
