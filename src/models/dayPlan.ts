export interface DayPlanItem {
  id: string;
  spot_id: string;
  start_time: string;
  end_time: string;
  note: string;
  transport: 'walk' | 'metro' | 'taxi' | 'train';
  /** 负责人（单人）；必须是 Trip.members 中的成员 */
  owner?: string;
  /** 协助人（多人，可重复参与同一时段）；均为 Trip.members 中的成员 */
  assistants: string[];
}

export interface DayPlan {
  id: string;
  trip_id: string;
  day_index: number;
  date: string;
  items: DayPlanItem[];
}
