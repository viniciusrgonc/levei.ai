import { useState } from 'react'
import { Star, Loader2, ThumbsUp } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/lib/auth'
import { toast } from '@/hooks/use-toast'

interface RatingModalProps {
  deliveryId: string
  driverUserId: string
  driverName: string
  onClose: () => void
  onSubmitted: () => void
}

const QUICK_TAGS = ['Rápido', 'Cuidadoso', 'Pontual', 'Comunicativo', 'Profissional']

const RATING_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: 'Muito ruim',  color: 'text-red-500'    },
  2: { label: 'Ruim',        color: 'text-orange-500'  },
  3: { label: 'Regular',     color: 'text-yellow-500'  },
  4: { label: 'Bom',         color: 'text-blue-500'    },
  5: { label: 'Excelente!',  color: 'text-green-500'   },
}

export function RatingModal({ deliveryId, driverUserId, driverName, onClose, onSubmitted }: RatingModalProps) {
  const { user } = useAuth()
  const [stars, setStars] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [comment, setComment] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  const effective = hovered || stars

  const toggleTag = (tag: string) =>
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )

  const handleSubmit = async () => {
    if (!stars || !user) return
    setIsSubmitting(true)

    try {
      const tagsPart = selectedTags.join(', ')
      const fullComment = [tagsPart, comment.trim()].filter(Boolean).join(' — ')

      // 1. Insere a avaliação
      const { error: insertError } = await supabase.from('ratings').insert({
        delivery_id: deliveryId,
        rated_by: user.id,
        rated_user: driverUserId,
        rating: stars,
        comment: fullComment || null,
      })
      if (insertError) throw insertError

      // 2. Recalcula rating médio do motoboy
      const { data: allRatings } = await supabase
        .from('ratings')
        .select('rating')
        .eq('rated_user', driverUserId)

      if (allRatings && allRatings.length > 0) {
        const avg = allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length
        await supabase
          .from('drivers')
          .update({ rating: parseFloat(avg.toFixed(2)) })
          .eq('user_id', driverUserId)
      }

      setDone(true)
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Erro ao enviar avaliação', description: err?.message })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget && !isSubmitting) onClose() }}
    >
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden">
        {/* Drag handle (mobile) */}
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-1 sm:hidden" />

        {done ? (
          /* ── Tela de sucesso ──────────────────────────────────────────── */
          <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
              <ThumbsUp className="h-10 w-10 text-green-500" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">Obrigado pelo feedback!</h2>
            <p className="text-gray-500 text-sm">
              Sua avaliação ajuda a manter a qualidade das entregas.
            </p>
            <div className="flex gap-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-7 w-7 ${i < stars ? 'fill-amber-400 text-amber-400' : 'fill-gray-100 text-gray-100'}`}
                />
              ))}
            </div>
            <button
              onClick={onSubmitted}
              className="mt-2 w-full py-4 rounded-2xl bg-primary text-white font-semibold text-base"
            >
              Fechar
            </button>
          </div>
        ) : (
          /* ── Formulário ───────────────────────────────────────────────── */
          <div className="px-6 pt-5 pb-8 space-y-5">

            {/* Cabeçalho */}
            <div className="text-center space-y-1">
              <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl font-bold text-primary">
                  {driverName.charAt(0).toUpperCase()}
                </span>
              </div>
              <h2 className="text-lg font-bold text-gray-900">Como foi a entrega?</h2>
              <p className="text-sm text-gray-500">
                Avalie <span className="font-semibold text-gray-700">{driverName}</span>
              </p>
            </div>

            {/* Estrelas */}
            <div className="flex flex-col items-center gap-2">
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, i) => {
                  const val = i + 1
                  return (
                    <button
                      key={val}
                      onClick={() => setStars(val)}
                      onMouseEnter={() => setHovered(val)}
                      onMouseLeave={() => setHovered(0)}
                      className="p-1 transition-transform hover:scale-110 active:scale-90"
                      aria-label={`${val} estrelas`}
                    >
                      <Star
                        className={`h-11 w-11 transition-colors ${
                          val <= effective
                            ? 'fill-amber-400 text-amber-400'
                            : 'fill-gray-100 text-gray-100'
                        }`}
                      />
                    </button>
                  )
                })}
              </div>
              <div className="h-5 flex items-center">
                {effective > 0 && (
                  <p className={`text-sm font-semibold ${RATING_LABELS[effective].color}`}>
                    {RATING_LABELS[effective].label}
                  </p>
                )}
              </div>
            </div>

            {/* Tags rápidas (só para notas altas) */}
            {stars >= 4 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-center">
                  O que se destacou?
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  {QUICK_TAGS.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                        selectedTags.includes(tag)
                          ? 'bg-primary text-white border-primary'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-primary/40'
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Comentário */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                Comentário <span className="normal-case font-normal">(opcional)</span>
              </label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder={
                  stars > 0 && stars <= 3
                    ? 'O que poderia ser melhor?'
                    : 'Deixe um comentário sobre a entrega...'
                }
                rows={3}
                maxLength={500}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary placeholder:text-gray-300"
              />
              <p className="text-right text-xs text-gray-300">{comment.length}/500</p>
            </div>

            {/* Botões */}
            <div className="flex flex-col gap-2 pt-1">
              <button
                onClick={handleSubmit}
                disabled={!stars || isSubmitting}
                className="w-full py-4 rounded-2xl bg-primary text-white font-semibold text-base disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-opacity"
              >
                {isSubmitting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
                ) : (
                  'Enviar avaliação'
                )}
              </button>
              <button
                onClick={onClose}
                disabled={isSubmitting}
                className="w-full py-3 text-gray-400 text-sm font-medium"
              >
                Avaliar depois
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
