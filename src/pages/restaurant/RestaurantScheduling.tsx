import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Badge } from '@/components/ui/badge';
import { SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar';
import { RestaurantSidebar } from '@/components/RestaurantSidebar';
import NotificationBell from '@/components/NotificationBell';
import { Clock, MapPin, Calendar as CalendarIcon } from 'lucide-react';

export default function RestaurantScheduling() {
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  // Mock scheduled deliveries
  const scheduledDeliveries = [
    {
      id: '1',
      date: new Date(2025, 0, 25, 14, 0),
      address: 'Rua das Flores, 123 - Centro',
      status: 'scheduled',
    },
    {
      id: '2',
      date: new Date(2025, 0, 25, 16, 30),
      address: 'Av. Brasil, 456 - Jardins',
      status: 'scheduled',
    },
  ];

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="min-h-screen flex w-full">
        <RestaurantSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-16 border-b border-border flex items-center justify-between px-6 bg-primary">
            <div className="flex items-center gap-4">
              <SidebarTrigger className="text-primary-foreground hover:bg-primary-foreground/10" />
              <h1 className="text-xl font-bold text-primary-foreground">Agendamento de Entregas</h1>
            </div>
            <NotificationBell />
          </header>

          <main className="flex-1 p-6 bg-background overflow-auto animate-fade-in">
            <div className="max-w-7xl mx-auto space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-3xl font-bold">Agendar Entregas</h2>
                  <p className="text-muted-foreground">Programe suas entregas com antecedência</p>
                </div>
                <Button 
                  onClick={() => navigate('/restaurant/new-delivery')}
                  className="transition-all duration-300 hover:scale-110 active:scale-95"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  Agendar Nova Entrega
                </Button>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Calendar */}
                <Card className="animate-fade-in hover:shadow-lg transition-all duration-300">
                  <CardHeader>
                    <CardTitle>Calendário</CardTitle>
                    <CardDescription>Selecione uma data para ver entregas agendadas</CardDescription>
                  </CardHeader>
                  <CardContent className="flex justify-center">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      className="rounded-2xl border"
                    />
                  </CardContent>
                </Card>

                {/* Scheduled Deliveries */}
                <Card className="animate-fade-in hover:shadow-lg transition-all duration-300" style={{ animationDelay: '100ms' }}>
                  <CardHeader>
                    <CardTitle>Entregas Agendadas</CardTitle>
                    <CardDescription>
                      {selectedDate?.toLocaleDateString('pt-BR', { dateStyle: 'full' })}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {scheduledDeliveries.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Nenhuma entrega agendada para esta data
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {scheduledDeliveries.map((delivery, index) => (
                          <Card 
                            key={delivery.id}
                            className="animate-scale-in transition-all duration-300 hover:scale-105 cursor-pointer"
                            style={{ animationDelay: `${index * 100}ms` }}
                          >
                            <CardContent className="pt-4">
                              <div className="flex justify-between items-start">
                                <div className="space-y-2 flex-1">
                                  <div className="flex items-center gap-2">
                                    <Clock className="h-4 w-4 text-primary" />
                                    <span className="font-medium">
                                      {delivery.date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <div className="flex items-start gap-2">
                                    <MapPin className="h-4 w-4 text-primary mt-0.5" />
                                    <span className="text-sm text-muted-foreground">{delivery.address}</span>
                                  </div>
                                </div>
                                <Badge variant="secondary">Agendado</Badge>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
