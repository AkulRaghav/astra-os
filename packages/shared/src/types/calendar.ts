export interface CalendarEvent {
  id: string;
  title: string;
  description?: string;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  location?: string;
  recurrence?: RecurrenceRule;
  reminders: Reminder[];
  attendees: string[];
  ownerId: string;
  color?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval: number;
  endDate?: string;
  count?: number;
  daysOfWeek?: number[];
}

export interface Reminder {
  type: 'email' | 'push' | 'in_app';
  minutesBefore: number;
}
