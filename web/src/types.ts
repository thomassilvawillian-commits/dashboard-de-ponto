export type Role = 'ADMIN' | 'GESTOR' | 'FUNCIONARIO';
export interface User {
  id: number; name: string; username: string; email: string | null; role: Role; active: boolean;
  registration: string | null; department: string | null; jobTitle: string | null;
  startDate: string; endDate: string | null; initialBalanceMin: number; trackTime: boolean; mustChangePassword: boolean;
}
export interface Schedule { id?: number; validFrom: string; dayMinutes: Record<string, number>; expectedStart: string | null; breakMinutes: number }
export type DayStatus = 'fora_periodo' | 'futuro' | 'completo' | 'em_andamento' | 'incompleto' | 'falta' | 'aguardando' | 'folga' | 'feriado' | 'ausencia' | 'compensacao';
export interface Day {
  date: string; weekday: number; status: DayStatus; expectedMin: number; workedMin: number; balanceMin: number; lateMin: number; breakMin: number;
  punches: { id: number; time: string; source: string; note?: string | null }[]; holiday?: string; absence?: string; alerts: string[];
}
export interface MonthSummary {
  month: string; days: Day[]; workedMin: number; expectedMin: number; plannedMin: number; extraMin: number; missingMin: number; balanceMin: number;
  lateMin: number; lateDays: number; daysWorked: number; absences: number; pending: number; alerts: number; bankMin: number; bankPending: number;
}
export interface PunchRequest {
  id: number; userId: number; userName?: string; kind: 'ADD' | 'REMOVE'; date: string; time: string | null; punchId: number | null;
  reason: string; status: 'PENDENTE' | 'APROVADO' | 'REJEITADO' | 'CANCELADO'; decidedBy: string | null; decidedAt: string | null; decisionNote: string | null; createdAt: string;
}
