export interface DayPlanItem {
  spot_id: string;
  start_time: string;
  end_time: string;
  note: string;
  transport: 'walk' | 'metro' | 'taxi' | 'train';
  /** 负责人：每个日程项最多 1 名，需引用 Trip.members 中的同行人 */
  owner?: string;
  /** 协助人：可多人，同样引用 Trip.members；同一人可在时间重叠的多项中协助，不受限制 */
  assistants?: string[];
}

export interface DayPlan {
  id: string;
  trip_id: string;
  day_index: number;
  date: string;
  items: DayPlanItem[];
}

