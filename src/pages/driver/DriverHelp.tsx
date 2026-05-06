import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft, ChevronDown, ChevronUp, MessageCircle,
  Mail, Wifi, Package, Trophy, Wallet, AlertCircle, Users,
} from 'lucide-react';
import { DriverBottomNav } from '@/components/DriverBottomNav';

// ── FAQ data ─────────────────────────────────────────────────────────────────
const FAQ_SECTIONS = [
  {
    title: 'Como usar o app',
    icon: Wifi,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    items: [
      {
        q: 'Como fico disponível para receber entregas?',
        a: 'Na tela inicial, toque na cápsula no canto superior direito onde está escrito "Offline". Ela vai mudar para "Online" em verde e você começará a receber notificações de novas entregas na sua área.',
      },
      {
        q: 'Como aceito uma entrega?',
        a: 'Quando uma entrega aparecer, você tem 10 segundos para decidir. Toque em "Aceitar" ou deslize o card para a direita. Se não responder a tempo, a entrega passa para outro motoboy disponível.',
      },
      {
        q: 'Posso recusar entregas?',
        a: 'Sim, você pode recusar tocando em "Recusar" no card de notificação. Recusas frequentes podem afetar sua prioridade no sistema.',
      },
      {
        q: 'O que significa o raio de atuação?',
        a: 'É a distância máxima em que você recebe ofertas de entrega. Quanto maior o raio, mais entregas você verá. Configure o raio no Admin ou nas Preferências.',
      },
    ],
  },
  {
    title: 'Entregas e coleta',
    icon: Package,
    color: 'text-green-600',
    bg: 'bg-green-50',
    items: [
      {
        q: 'O que fazer ao chegar no ponto de coleta?',
        a: 'Informe ao estabelecimento que veio pela Levei.ai e aguarde o pedido. Quando retirar, toque em "Confirmar Coleta" no app para registrar a retirada.',
      },
      {
        q: 'O que é uma entrega com retorno?',
        a: 'Algumas entregas (como documentos) exigem que você retorne ao ponto de coleta após entregar. Isso é indicado com uma tag laranja "↩ retorno" na notificação. O valor já inclui a ida e a volta.',
      },
      {
        q: 'O que fazer se não encontrar o destinatário?',
        a: 'Tente ligar ou enviar mensagem pelo app. Se não conseguir contato, use o botão "Não consegui entregar" na tela de entrega e aguarde orientações.',
      },
    ],
  },
  {
    title: 'Ganhos e pontos',
    icon: Wallet,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    items: [
      {
        q: 'Como funciona o pagamento?',
        a: 'Você recebe 80% do valor de cada entrega. Os ganhos ficam no seu saldo disponível e você pode solicitar o saque pela tela de Ganhos.',
      },
      {
        q: 'Quando meu saldo fica disponível?',
        a: 'O saldo é creditado imediatamente após confirmar a entrega. Para retiradas, o prazo depende do método escolhido (Pix é imediato).',
      },
      {
        q: 'Como ganho pontos?',
        a: '+10 pontos por entrega concluída e +100 pontos por cada amigo indicado que completar 5 entregas. Os pontos desbloqueiam benefícios na tela de Recompensas.',
      },
    ],
  },
  {
    title: 'Recompensas e indicações',
    icon: Trophy,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    items: [
      {
        q: 'O que são os níveis de recompensa?',
        a: 'São 4 níveis — Iniciante (50 pts), Veloz (100 pts), Destaque (250 pts) e Elite (500 pts). Cada nível traz benefícios como prioridade em entregas e taxas reduzidas.',
      },
      {
        q: 'Como funciona a indicação de amigos?',
        a: 'Compartilhe seu código de indicação (tela "Indique um amigo"). Quando seu amigo se cadastrar com o código e completar 5 entregas, você ganha 100 pontos automaticamente.',
      },
    ],
  },
  {
    title: 'Problemas e suporte',
    icon: AlertCircle,
    color: 'text-red-600',
    bg: 'bg-red-50',
    items: [
      {
        q: 'O mapa não está funcionando corretamente.',
        a: 'Verifique se a localização está ativada para o app nas configurações do seu celular. Feche e reabra o app. Se o problema persistir, entre em contato com o suporte.',
      },
      {
        q: 'Meu saldo está incorreto.',
        a: 'Acesse a tela de Ganhos e verifique o histórico de transações. Se encontrar uma inconsistência, entre em contato com o suporte informando o ID da entrega.',
      },
      {
        q: 'O app está travando ou lento.',
        a: 'Feche completamente o app e reabra. Se o problema continuar, limpe o cache do navegador/app ou reinstale. Certifique-se de estar usando a versão mais recente.',
      },
    ],
  },
];

// ── Component ─────────────────────────────────────────────────────────────────
export default function DriverHelp() {
  const navigate = useNavigate();
  const [openItem, setOpenItem] = useState<string | null>(null);

  const toggle = (key: string) => setOpenItem(openItem === key ? null : key);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>

      {/* ── Header ── */}
      <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 px-4 pt-4 pb-6">
        <div className="flex items-center gap-3 mb-1">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center active:scale-90 transition-transform"
          >
            <ArrowLeft className="h-5 w-5 text-white" />
          </button>
          <div>
            <h1 className="text-white font-bold text-xl">Central de Ajuda</h1>
            <p className="text-indigo-200 text-xs">Dúvidas frequentes e suporte</p>
          </div>
        </div>
      </div>

      {/* ── FAQ ── */}
      <div className="flex-1 px-4 py-4 pb-28 space-y-4">
        {FAQ_SECTIONS.map((section) => {
          const Icon = section.icon;
          return (
            <div key={section.title}>
              {/* Section header */}
              <div className="flex items-center gap-2 mb-2 px-1">
                <div className={`w-6 h-6 rounded-lg ${section.bg} flex items-center justify-center flex-shrink-0`}>
                  <Icon className={`h-3.5 w-3.5 ${section.color}`} />
                </div>
                <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">{section.title}</p>
              </div>

              {/* Items */}
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
                {section.items.map((item, idx) => {
                  const key = `${section.title}-${idx}`;
                  const isOpen = openItem === key;
                  return (
                    <div key={key} className={idx > 0 ? 'border-t border-gray-50' : ''}>
                      <button
                        onClick={() => toggle(key)}
                        className="w-full flex items-center justify-between px-4 py-3.5 text-left active:bg-gray-50 transition-colors"
                      >
                        <span className="text-gray-800 font-medium text-sm pr-3 flex-1">{item.q}</span>
                        {isOpen
                          ? <ChevronUp className="h-4 w-4 text-gray-400 flex-shrink-0" />
                          : <ChevronDown className="h-4 w-4 text-gray-400 flex-shrink-0" />
                        }
                      </button>
                      {isOpen && (
                        <div className="px-4 pb-4">
                          <p className="text-gray-500 text-sm leading-relaxed">{item.a}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* ── Contato ── */}
        <div>
          <div className="flex items-center gap-2 mb-2 px-1">
            <div className="w-6 h-6 rounded-lg bg-gray-100 flex items-center justify-center">
              <Users className="h-3.5 w-3.5 text-gray-500" />
            </div>
            <p className="text-gray-500 text-xs font-bold uppercase tracking-wider">Falar com o suporte</p>
          </div>

          <div className="space-y-2">
            <a
              href="https://wa.me/5531999999999?text=Olá,%20preciso%20de%20ajuda%20com%20o%20app%20Levei.ai"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 shadow-sm border border-gray-100 active:bg-gray-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                <MessageCircle className="h-4.5 w-4.5 text-green-600" style={{ width: 18, height: 18 }} />
              </div>
              <div className="flex-1">
                <p className="text-gray-800 font-semibold text-sm">WhatsApp</p>
                <p className="text-gray-400 text-xs">Resposta em até 2 horas</p>
              </div>
              <span className="text-[10px] font-bold bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                Recomendado
              </span>
            </a>

            <a
              href="mailto:suporte@leveiai.com?subject=Suporte%20Motoboy%20App"
              className="flex items-center gap-3 bg-white rounded-2xl px-4 py-3.5 shadow-sm border border-gray-100 active:bg-gray-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                <Mail className="h-4.5 w-4.5 text-indigo-600" style={{ width: 18, height: 18 }} />
              </div>
              <div>
                <p className="text-gray-800 font-semibold text-sm">E-mail</p>
                <p className="text-gray-400 text-xs">suporte@leveiai.com</p>
              </div>
            </a>
          </div>
        </div>

        <p className="text-center text-gray-300 text-xs pb-2">Levei.ai v1.0 · leveiai.com</p>
      </div>

      <DriverBottomNav />
    </div>
  );
}
