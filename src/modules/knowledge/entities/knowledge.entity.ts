export class Knowledge {
  id: number;
  name: string;
  description?: string;
  avatar?: string;
  owner_id: number;
  is_shared?: boolean;
  is_deleted?: boolean;
  created_at?: Date;
  updated_at?: Date;
}
